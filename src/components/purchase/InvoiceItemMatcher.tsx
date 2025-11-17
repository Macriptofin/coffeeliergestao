import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, AlertTriangle, Clock, Plus, Factory } from 'lucide-react';

interface Material {
  id: string;
  name: string;
  code: string | null;
  usage_unit: string;
  conversion_factor: number;
}

interface MaterialSuggestion extends Material {
  confidence: number;
  match_method: string;
  reason: string;
}

interface InvoiceItem {
  nome: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  preco_total: number;
  desconto?: number;
  desconto_percentual?: number;
  preco_com_desconto?: number;
  material_id?: string | null;
  material_nome?: string | null;
  material_codigo?: string | null;
  status?: 'matched' | 'not_found' | 'pending';
  conversion_factor?: number;
  usage_unit?: string;
  converted_quantity?: number;
  converted_unit_price?: number;
  match_confidence?: number;
  match_method?: string;
}

interface InvoiceItemMatcherProps {
  item: InvoiceItem;
  index: number;
  onMaterialSelect: (index: number, materialId: string) => void;
  onCreateNew: (index: number) => void;
  onConversionFactorAdjust: (index: number, newFactor: number) => void;
  onItemValueChange: (index: number, field: keyof InvoiceItem, value: any) => void;
}

export const InvoiceItemMatcher = ({
  item,
  index,
  onMaterialSelect,
  onCreateNew,
  onConversionFactorAdjust,
  onItemValueChange
}: InvoiceItemMatcherProps) => {
  const [suggestions, setSuggestions] = useState<MaterialSuggestion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, [item.nome]);

  useEffect(() => {
    if (searchTerm) {
      searchMaterials();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const loadSuggestions = async () => {
    try {
      // Buscar apenas materiais SEM ficha técnica (que podem receber NF)
      const { data: materials } = await supabase
        .from('materials')
        .select(`
          id, 
          name, 
          code, 
          usage_unit, 
          conversion_factor,
          material_type,
          stock_items(cost_source)
        `)
        .eq('is_archived', false)
        .not('material_type', 'in', '(finished_product,intermediate_product,composite_product)')
        .limit(100);

      if (!materials) return;

      const suggs = generateSuggestions(item.nome, materials);
      setSuggestions(suggs);

    } catch (error) {
      console.error('Erro ao carregar sugestões:', error);
    }
  };

  const generateSuggestions = (itemName: string, materials: Material[]): MaterialSuggestion[] => {
    const suggestions: MaterialSuggestion[] = [];
    const nameLower = itemName.toLowerCase();

    materials.forEach(material => {
      const materialNameLower = material.name.toLowerCase();
      
      // Match exato
      if (materialNameLower === nameLower) {
        suggestions.push({
          ...material,
          confidence: 1.0,
          match_method: 'exact',
          reason: 'Nome idêntico'
        });
        return;
      }

      // Match parcial
      if (materialNameLower.includes(nameLower) || nameLower.includes(materialNameLower)) {
        const confidence = calculateSimilarity(materialNameLower, nameLower);
        suggestions.push({
          ...material,
          confidence,
          match_method: 'fuzzy',
          reason: 'Nome similar'
        });
      }
    });

    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  };

  const searchMaterials = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('materials')
        .select('id, name, code, usage_unit, conversion_factor')
        .eq('is_archived', false)
        .ilike('name', `%${searchTerm}%`)
        .limit(20);

      setSearchResults(data || []);
    } catch (error) {
      console.error('Erro ao buscar materiais:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (value: string) => {
    if (value === '__new__') {
      onCreateNew(index);
    } else {
      onMaterialSelect(index, value);
    }
  };

  return (
    <Card className={
      item.status === 'matched' ? 'border-green-200' :
      item.status === 'not_found' ? 'border-destructive' : ''
    }>
      <CardContent className="pt-6">
        <div className="grid grid-cols-12 gap-4">
          {/* Dados da Nota */}
          <div className="col-span-4 space-y-3">
            <Label className="text-xs text-muted-foreground">
              Item da Nota Fiscal
            </Label>
            <div className="space-y-3">
              <p className="font-medium">{item.nome}</p>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Quantidade</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={item.quantidade}
                    onChange={(e) => onItemValueChange(index, 'quantidade', parseFloat(e.target.value) || 0)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Unidade</Label>
                  <Input
                    value={item.unidade}
                    onChange={(e) => onItemValueChange(index, 'unidade', e.target.value)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Preço Unit.</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.preco_unitario}
                    onChange={(e) => onItemValueChange(index, 'preco_unitario', parseFloat(e.target.value) || 0)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Total</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.preco_total}
                    className="h-8 bg-muted"
                    readOnly
                  />
                </div>
                <div>
                  <Label className="text-xs">Desconto R$</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.desconto || 0}
                    onChange={(e) => onItemValueChange(index, 'desconto', parseFloat(e.target.value) || 0)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Desconto %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.desconto_percentual || 0}
                    onChange={(e) => onItemValueChange(index, 'desconto_percentual', parseFloat(e.target.value) || 0)}
                    className="h-8"
                  />
                </div>
              </div>
              
              {item.desconto && item.desconto > 0 && (
                <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-900">
                  <div className="text-xs text-green-700 dark:text-green-400 font-medium">
                    Preço com desconto: R$ {(item.preco_com_desconto || item.preco_total).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Match de Material */}
          <div className="col-span-6 space-y-2">
            <Label className="text-xs text-muted-foreground">
              Material do Estoque
            </Label>
            <Select value={item.material_id || ''} onValueChange={handleSelect}>
              <SelectTrigger className={
                !item.material_id ? 'border-destructive' : 'border-green-500'
              }>
                <SelectValue placeholder="Selecione o material correspondente" />
              </SelectTrigger>
              <SelectContent>
                {suggestions.length > 0 && (
                  <>
                    <SelectGroup>
                      <SelectLabel>Sugestões</SelectLabel>
                      {suggestions.map(sug => (
                        <SelectItem key={sug.id} value={sug.id}>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              sug.confidence > 0.8 ? 'default' :
                              sug.confidence > 0.5 ? 'secondary' : 'outline'
                            }>
                              {(sug.confidence * 100).toFixed(0)}%
                            </Badge>
                            <div className="flex flex-col">
                              <span className="font-medium">{sug.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {sug.code} • {sug.usage_unit}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                  </>
                )}
                
                <SelectGroup>
                  <SelectLabel>Buscar Manualmente</SelectLabel>
                  <div className="px-2 py-1">
                    <Input
                      placeholder="Digite para buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  {searchResults.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.code} • {m.usage_unit}
                      </span>
                    </div>
                  </SelectItem>
                  ))}
                </SelectGroup>
                
                <SelectSeparator />
                
                <SelectItem value="__new__">
                  <div className="flex items-center gap-2 text-primary">
                    <Plus className="h-4 w-4" />
                    <span className="font-medium">Cadastrar Material</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            {/* Alerta informativo sobre materiais com BOM */}
            <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
              <Factory className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Importante:</strong> Materiais com Ficha Técnica (Produtos Acabados/Intermediários) têm seu custo calculado automaticamente pela composição e <strong>não podem receber entrada por Nota Fiscal</strong>.
              </AlertDescription>
            </Alert>
            
            {/* Preview de conversão com fator editável */}
            {item.material_id && item.conversion_factor && (
              <div className="p-2 bg-muted/50 rounded-lg text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Compra:</span>
                  <span className="font-medium">
                    {item.quantidade} {item.unidade} × R$ {(() => {
                      // Calcular preço unitário com desconto se houver
                      if (item.desconto_percentual) {
                        const precoComDesconto = item.preco_unitario * (1 - (item.desconto_percentual / 100));
                        return precoComDesconto.toFixed(2);
                      }
                      return item.preco_unitario.toFixed(2);
                    })()}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-muted-foreground">Fator de Conversão:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs">1 {item.unidade} =</span>
                    <Input
                      type="number"
                      step="0.001"
                      value={item.conversion_factor}
                      onChange={(e) => {
                        const newFactor = parseFloat(e.target.value) || 1;
                        onConversionFactorAdjust(index, newFactor);
                      }}
                      className="h-7 w-20 text-xs"
                    />
                    <span className="text-xs">{item.usage_unit}</span>
                  </div>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-muted-foreground">Entrada no Estoque:</span>
                  <span className="font-medium text-primary">
                    {item.converted_quantity?.toFixed(3)} {item.usage_unit} × R$ {item.converted_unit_price?.toFixed(4)}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Status */}
          <div className="col-span-2 flex flex-col items-end justify-between">
            <Badge variant={
              item.status === 'matched' ? 'default' :
              item.status === 'not_found' ? 'destructive' : 'secondary'
            }>
              {item.status === 'matched' && (
                <><Check className="h-3 w-3 mr-1" />Vinculado</>
              )}
              {item.status === 'not_found' && (
                <><AlertTriangle className="h-3 w-3 mr-1" />Não cadastrado</>
              )}
              {item.status === 'pending' && (
                <><Clock className="h-3 w-3 mr-1" />Pendente</>
              )}
            </Badge>
            
            {item.match_confidence && (
              <span className="text-xs text-muted-foreground">
                {item.match_method}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
