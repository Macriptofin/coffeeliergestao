import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, AlertTriangle, Clock, Plus, Factory, Search, ChevronDown, ChevronUp, Receipt } from 'lucide-react';

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
  // Campos fiscais
  ncm?: string;
  cst?: string;
  cfop?: string;
  icms_base?: number;
  icms_aliquota?: number;
  icms_valor?: number;
  icms_st_base?: number;
  icms_st_valor?: number;
  ipi_valor?: number;
  ipi_aliquota?: number;
}

interface InvoiceItemMatcherProps {
  item: InvoiceItem;
  index: number;
  onMaterialSelect: (index: number, materialId: string) => void;
  onCreateNew: (index: number) => void;
  onConversionFactorAdjust: (index: number, newFactor: number) => void;
  onItemValueChange: (index: number, field: keyof InvoiceItem, value: any) => void;
  onItemNameChange?: (index: number, newName: string) => void;
  onFiscalChange?: (index: number, field: keyof InvoiceItem, value: any) => void;
  canEditName?: boolean;
}

export const InvoiceItemMatcher = ({
  item,
  index,
  onMaterialSelect,
  onCreateNew,
  onConversionFactorAdjust,
  onItemValueChange,
  onItemNameChange,
  onFiscalChange,
  canEditName = false
}: InvoiceItemMatcherProps) => {
  const [suggestions, setSuggestions] = useState<MaterialSuggestion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [fiscalOpen, setFiscalOpen] = useState(false);

  // Modo manual = quando o nome do item ainda está vazio OU o usuário pode editar
  const isManualMode = canEditName;

  useEffect(() => {
    if (item.nome) {
      loadSuggestions();
    }
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
        .limit(200);

      if (!materials) return;

      // Excluir apenas materiais cujo custo é calculado por ficha técnica (composite/intermediate com recipe)
      // Produto acabado SEM ficha (ex: revenda) pode receber entrada por NF
      const eligible = materials.filter((m: any) => {
        const costSource = m.stock_items?.[0]?.cost_source;
        if (costSource === 'recipe') return false; // tem ficha técnica → não pode receber NF
        if (m.material_type === 'intermediate_product' || m.material_type === 'composite_product') return false;
        return true;
      });

      const suggs = generateSuggestions(item.nome, eligible);
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

      if (materialNameLower === nameLower) {
        suggestions.push({ ...material, confidence: 1.0, match_method: 'exact', reason: 'Nome idêntico' });
        return;
      }

      if (materialNameLower.includes(nameLower) || nameLower.includes(materialNameLower)) {
        const confidence = calculateSimilarity(materialNameLower, nameLower);
        suggestions.push({ ...material, confidence, match_method: 'fuzzy', reason: 'Nome similar' });
      }
    });

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
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
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
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
        .select('id, name, code, usage_unit, conversion_factor, material_type, stock_items(cost_source)')
        .eq('is_archived', false)
        .not('material_type', 'in', '(intermediate_product,composite_product)')
        .ilike('name', `%${searchTerm}%`)
        .limit(30);

      // Excluir apenas finished_product com ficha técnica (cost_source = 'recipe')
      const eligible = (data || []).filter((m: any) => {
        if (m.material_type === 'finished_product') {
          return m.stock_items?.[0]?.cost_source !== 'recipe';
        }
        return true;
      });

      setSearchResults(eligible);
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
      // Auto-preencher nome do item em modo manual quando ainda está vazio
      if (isManualMode && onItemNameChange && !item.nome) {
        const material = [...suggestions, ...searchResults].find(m => m.id === value);
        if (material) {
          onItemNameChange(index, material.name);
        }
      }
      onMaterialSelect(index, value);
    }
  };

  // ─── LAYOUT MODO MANUAL ──────────────────────────────────────────────────────
  // Seleção de material em destaque no topo, depois campos de qtd/preço
  if (isManualMode) {
    return (
      <Card className={
        item.status === 'matched' ? 'border-green-200' :
        item.status === 'not_found' ? 'border-destructive' : ''
      }>
        <CardContent className="pt-4 space-y-4">
          {/* Material + Status */}
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Material do Estoque *
              </Label>
              <Select value={item.material_id || ''} onValueChange={handleSelect}>
                <SelectTrigger className={!item.material_id ? 'border-destructive' : 'border-green-500'}>
                  <SelectValue placeholder="Pesquise e selecione o material..." />
                </SelectTrigger>
                <SelectContent>
                  {/* Campo de busca live */}
                  <div className="px-2 py-2 sticky top-0 bg-popover border-b">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Digite para buscar material..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-8 pl-7 text-sm"
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  {/* Resultados da busca */}
                  {searchTerm ? (
                    <SelectGroup>
                      {loading ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">Buscando...</div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map(m => (
                          <SelectItem key={m.id} value={m.id} textValue={m.name}>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium">{m.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {m.code} • {m.usage_unit}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                          Nenhum material encontrado
                        </div>
                      )}
                    </SelectGroup>
                  ) : (
                    /* Sugestões baseadas no nome digitado */
                    suggestions.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel>Sugestões</SelectLabel>
                        {suggestions.map(sug => (
                          <SelectItem key={sug.id} value={sug.id} textValue={sug.name}>
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                sug.confidence > 0.8 ? 'default' :
                                sug.confidence > 0.5 ? 'secondary' : 'outline'
                              } className="text-xs shrink-0">
                                {(sug.confidence * 100).toFixed(0)}%
                              </Badge>
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium">{sug.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {sug.code} • {sug.usage_unit}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        Digite para buscar ou selecione abaixo
                      </div>
                    )
                  )}

                  <SelectSeparator />

                  <SelectItem value="__new__" textValue="Cadastrar Material">
                    <div className="flex items-center gap-2 text-primary">
                      <Plus className="h-4 w-4 shrink-0" />
                      <span className="font-medium">Cadastrar Material</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Badge de status */}
            <div className="pt-6">
              <Badge variant={
                item.status === 'matched' ? 'default' :
                item.status === 'not_found' ? 'destructive' : 'secondary'
              }>
                {item.status === 'matched' && <><Check className="h-3 w-3 mr-1" />Vinculado</>}
                {item.status === 'not_found' && <><AlertTriangle className="h-3 w-3 mr-1" />Não cadastrado</>}
                {item.status === 'pending' && <><Clock className="h-3 w-3 mr-1" />Pendente</>}
              </Badge>
            </div>
          </div>

          {/* Alerta sobre produtos com ficha técnica */}
          <Alert className="py-2 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <Factory className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Atenção:</strong> Produtos com Ficha Técnica <strong>não podem receber entrada por NF</strong> — seu custo é calculado pela composição.
            </AlertDescription>
          </Alert>

          {/* Descrição do Item (nome que aparece na NF física) */}
          {onItemNameChange && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Descrição na NF <span className="italic">(opcional — pré-preenchida ao selecionar material)</span>
              </Label>
              <Input
                value={item.nome}
                onChange={(e) => onItemNameChange(index, e.target.value)}
                placeholder="Ex: Polvilho doce 1kg..."
                className="text-sm"
              />
            </div>
          )}

          {/* Campos de quantidade e preço */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number"
                step="0.001"
                value={item.quantidade}
                onChange={(e) => onItemValueChange(index, 'quantidade', parseFloat(e.target.value) || 0)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unidade</Label>
              <Input
                value={item.unidade}
                onChange={(e) => onItemValueChange(index, 'unidade', e.target.value)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preço Unit.</Label>
              <Input
                type="number"
                step="0.01"
                value={item.preco_unitario}
                onChange={(e) => onItemValueChange(index, 'preco_unitario', parseFloat(e.target.value) || 0)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Total</Label>
              <Input
                type="number"
                step="0.01"
                value={item.preco_total}
                className="h-8 bg-muted"
                readOnly
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desconto R$</Label>
              <Input
                type="number"
                step="0.01"
                value={item.desconto || 0}
                onChange={(e) => onItemValueChange(index, 'desconto', parseFloat(e.target.value) || 0)}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
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

          {/* Preview de conversão */}
          {item.material_id && item.conversion_factor && (
            <div className="p-2 bg-muted/50 rounded-lg text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Compra:</span>
                <span className="font-medium">
                  {item.quantidade} {item.unidade} × R$ {(() => {
                    if (item.desconto_percentual) {
                      return (item.preco_unitario * (1 - item.desconto_percentual / 100)).toFixed(2);
                    }
                    return item.preco_unitario.toFixed(2);
                  })()}
                </span>
              </div>
              {(item.ipi_valor || 0) > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>IPI ({item.ipi_aliquota || 0}%) — {item.quantidade} un:</span>
                  <span>+ R$ {((item.ipi_valor || 0) / item.quantidade).toFixed(4)}/un</span>
                </div>
              )}
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
                <span className="text-muted-foreground">Custo unitário no estoque{(item.ipi_valor || 0) > 0 ? ' (c/ IPI)' : ''}:</span>
                <span className="font-medium text-primary">
                  R$ {item.converted_unit_price?.toFixed(4)} / {item.usage_unit}
                </span>
              </div>
            </div>
          )}

          {/* Seção fiscal colapsável */}
          {onFiscalChange && (
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setFiscalOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5" />
                  Dados Fiscais
                  {(item.ncm || item.icms_valor || item.ipi_valor) && (
                    <Badge variant="secondary" className="text-xs py-0">preenchido</Badge>
                  )}
                </span>
                {fiscalOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {fiscalOpen && (
                <div className="p-3 border-t space-y-3 bg-muted/20">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">NCM</Label>
                      <Input value={item.ncm || ''} onChange={e => onFiscalChange(index, 'ncm', e.target.value)} className="h-7 text-xs" placeholder="00000000" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CST/CSOSN</Label>
                      <Input value={item.cst || ''} onChange={e => onFiscalChange(index, 'cst', e.target.value)} className="h-7 text-xs" placeholder="051" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CFOP</Label>
                      <Input value={item.cfop || ''} onChange={e => onFiscalChange(index, 'cfop', e.target.value)} className="h-7 text-xs" placeholder="5102" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Base ICMS (R$)</Label>
                      <Input type="number" step="0.01" value={item.icms_base || 0} onChange={e => onFiscalChange(index, 'icms_base', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Alíq. ICMS (%)</Label>
                      <Input type="number" step="0.01" value={item.icms_aliquota || 0} onChange={e => onFiscalChange(index, 'icms_aliquota', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Valor ICMS (R$)</Label>
                      <Input type="number" step="0.01" value={item.icms_valor || 0} onChange={e => onFiscalChange(index, 'icms_valor', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-amber-700">IPI Valor (R$) ⚡ afeta custo</Label>
                      <Input type="number" step="0.01" value={item.ipi_valor || 0} onChange={e => onFiscalChange(index, 'ipi_valor', parseFloat(e.target.value) || 0)} className="h-7 text-xs border-amber-200 focus:border-amber-400" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Alíq. IPI (%)</Label>
                      <Input type="number" step="0.01" value={item.ipi_aliquota || 0} onChange={e => onFiscalChange(index, 'ipi_aliquota', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                    </div>
                  </div>
                  {(item.ipi_valor || 0) > 0 && item.quantidade > 0 && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      ⚡ IPI de R$ {(item.ipi_valor || 0).toFixed(2)} ÷ {item.quantidade} un = <strong>+R$ {((item.ipi_valor || 0) / item.quantidade).toFixed(4)}/un</strong> adicionado ao custo unitário do estoque.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ─── LAYOUT MODO OCR ─────────────────────────────────────────────────────────
  // Layout original de 3 colunas para fluxo de matching de OCR
  return (
    <Card className={
      item.status === 'matched' ? 'border-green-200' :
      item.status === 'not_found' ? 'border-destructive' : ''
    }>
      <CardContent className="pt-6">
        <div className="grid grid-cols-12 gap-4">
          {/* Dados da Nota (OCR) */}
          <div className="col-span-4 space-y-3">
            <Label className="text-xs text-muted-foreground">Item da Nota Fiscal</Label>
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
            <Label className="text-xs text-muted-foreground">Material do Estoque</Label>
            <Select value={item.material_id || ''} onValueChange={handleSelect}>
              <SelectTrigger className={!item.material_id ? 'border-destructive' : 'border-green-500'}>
                <SelectValue placeholder="Selecione o material correspondente" />
              </SelectTrigger>
              <SelectContent>
                {suggestions.length > 0 && (
                  <>
                    <SelectGroup>
                      <SelectLabel>Sugestões</SelectLabel>
                      {suggestions.map(sug => (
                        <SelectItem key={sug.id} value={sug.id} textValue={sug.name}>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              sug.confidence > 0.8 ? 'default' :
                              sug.confidence > 0.5 ? 'secondary' : 'outline'
                            } className="text-xs shrink-0">
                              {(sug.confidence * 100).toFixed(0)}%
                            </Badge>
                            <div className="flex flex-col min-w-0">
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
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>

                  {searchResults.map(m => (
                    <SelectItem key={m.id} value={m.id} textValue={m.name}>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {m.code} • {m.usage_unit}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>

                <SelectSeparator />

                <SelectItem value="__new__" textValue="Cadastrar Material">
                  <div className="flex items-center gap-2 text-primary">
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="font-medium">Cadastrar Material</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

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
                {(item.ipi_valor || 0) > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>IPI ({item.ipi_aliquota || 0}%):</span>
                    <span>+ R$ {((item.ipi_valor || 0) / item.quantidade).toFixed(4)}/un</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1">
                  <span className="text-muted-foreground">Custo unitário no estoque{(item.ipi_valor || 0) > 0 ? ' (c/ IPI)' : ''}:</span>
                  <span className="font-medium text-primary">
                    R$ {item.converted_unit_price?.toFixed(4)} / {item.usage_unit}
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
              {item.status === 'matched' && <><Check className="h-3 w-3 mr-1" />Vinculado</>}
              {item.status === 'not_found' && <><AlertTriangle className="h-3 w-3 mr-1" />Não cadastrado</>}
              {item.status === 'pending' && <><Clock className="h-3 w-3 mr-1" />Pendente</>}
            </Badge>

            {item.match_confidence && (
              <span className="text-xs text-muted-foreground">{item.match_method}</span>
            )}
          </div>
        </div>

        {/* Seção fiscal colapsável — OCR mode */}
        {onFiscalChange && (
          <div className="border rounded-lg overflow-hidden mt-4">
            <button
              type="button"
              onClick={() => setFiscalOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                Dados Fiscais
                {(item.ncm || item.icms_valor || item.ipi_valor) && (
                  <Badge variant="secondary" className="text-xs py-0">preenchido</Badge>
                )}
              </span>
              {fiscalOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {fiscalOpen && (
              <div className="p-3 border-t space-y-3 bg-muted/20">
                <div className="grid grid-cols-6 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">NCM</Label>
                    <Input value={item.ncm || ''} onChange={e => onFiscalChange(index, 'ncm', e.target.value)} className="h-7 text-xs" placeholder="00000000" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">CST/CSOSN</Label>
                    <Input value={item.cst || ''} onChange={e => onFiscalChange(index, 'cst', e.target.value)} className="h-7 text-xs" placeholder="051" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">CFOP</Label>
                    <Input value={item.cfop || ''} onChange={e => onFiscalChange(index, 'cfop', e.target.value)} className="h-7 text-xs" placeholder="5102" />
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Base ICMS (R$)</Label>
                    <Input type="number" step="0.01" value={item.icms_base || 0} onChange={e => onFiscalChange(index, 'icms_base', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Alíq. ICMS (%)</Label>
                    <Input type="number" step="0.01" value={item.icms_aliquota || 0} onChange={e => onFiscalChange(index, 'icms_aliquota', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Valor ICMS (R$)</Label>
                    <Input type="number" step="0.01" value={item.icms_valor || 0} onChange={e => onFiscalChange(index, 'icms_valor', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-amber-700">IPI Valor (R$) ⚡ afeta custo</Label>
                    <Input type="number" step="0.01" value={item.ipi_valor || 0} onChange={e => onFiscalChange(index, 'ipi_valor', parseFloat(e.target.value) || 0)} className="h-7 text-xs border-amber-200 focus:border-amber-400" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Alíq. IPI (%)</Label>
                    <Input type="number" step="0.01" value={item.ipi_aliquota || 0} onChange={e => onFiscalChange(index, 'ipi_aliquota', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                  </div>
                </div>
                {(item.ipi_valor || 0) > 0 && item.quantidade > 0 && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    ⚡ IPI de R$ {(item.ipi_valor || 0).toFixed(2)} ÷ {item.quantidade} un = <strong>+R$ {((item.ipi_valor || 0) / item.quantidade).toFixed(4)}/un</strong> adicionado ao custo unitário do estoque.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
