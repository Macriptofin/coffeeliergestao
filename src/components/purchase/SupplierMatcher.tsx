import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Search } from 'lucide-react';

interface Supplier {
  id: string;
  company_name: string;
  cnpj_cpf: string | null;
}

interface SupplierSuggestion extends Supplier {
  confidence: number;
  method: 'exact' | 'fuzzy';
}

interface SupplierMatcherProps {
  supplierText: string;
  selectedSupplierId: string | null;
  onSupplierSelect: (supplierId: string | null) => void;
  onCreateNew: () => void;
}

export const SupplierMatcher = ({
  supplierText,
  selectedSupplierId,
  onSupplierSelect,
  onCreateNew
}: SupplierMatcherProps) => {
  const [suggestions, setSuggestions] = useState<SupplierSuggestion[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierSearch, setSupplierSearch] = useState('');

  const isManualMode = !supplierText;

  useEffect(() => {
    loadSuppliers();
  }, [supplierText]);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const { data: all } = await supabase
        .from('suppliers')
        .select('id, company_name, cnpj_cpf')
        .eq('status', 'Ativo')
        .order('company_name');

      setAllSuppliers(all || []);

      if (!isManualMode) {
        const suggs = generateSuggestions(supplierText, all || []);
        setSuggestions(suggs);
      }
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = (text: string, suppliers: Supplier[]): SupplierSuggestion[] => {
    if (!text) return [];

    const suggestions: SupplierSuggestion[] = [];
    const textLower = text.toLowerCase();

    // Buscar por CNPJ exato
    const cnpjMatch = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (cnpjMatch) {
      const exactMatch = suppliers.find(s => s.cnpj_cpf === cnpjMatch[0]);
      if (exactMatch) {
        suggestions.push({ ...exactMatch, confidence: 1.0, method: 'exact' });
      }
    }

    // Buscar por nome similar
    suppliers.forEach(supplier => {
      const nameLower = supplier.company_name.toLowerCase();
      if (nameLower.includes(textLower) || textLower.includes(nameLower)) {
        const confidence = calculateSimilarity(nameLower, textLower);
        if (confidence > 0.3 && !suggestions.find(s => s.id === supplier.id)) {
          suggestions.push({ ...supplier, confidence, method: 'fuzzy' });
        }
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

  const handleSelect = (value: string) => {
    if (value === '__new__') {
      onCreateNew();
    } else {
      onSupplierSelect(value);
    }
  };

  // Filtrar fornecedores pelo termo de busca (nome ou CNPJ)
  const filteredSuppliers = supplierSearch.trim()
    ? allSuppliers.filter(s => {
        const q = supplierSearch.toLowerCase();
        return (
          s.company_name.toLowerCase().includes(q) ||
          (s.cnpj_cpf && s.cnpj_cpf.replace(/\D/g, '').includes(supplierSearch.replace(/\D/g, '')))
        );
      })
    : allSuppliers;

  // Em modo manual, mostrar todos (filtrados); em modo OCR, separar sugestões dos demais
  const suppliersToShow = isManualMode
    ? filteredSuppliers
    : filteredSuppliers.filter(s => !suggestions.find(sg => sg.id === s.id));

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        Fornecedor *
        {!isManualMode && supplierText && (
          <Badge variant="outline" className="font-normal text-xs">{supplierText}</Badge>
        )}
      </Label>

      <Select value={selectedSupplierId || ''} onValueChange={handleSelect} disabled={loading}>
        <SelectTrigger className={!selectedSupplierId ? 'border-destructive' : ''}>
          <SelectValue placeholder={loading ? 'Carregando...' : 'Busque ou selecione o fornecedor'} />
        </SelectTrigger>
        <SelectContent>
          {/* Campo de busca live */}
          <div className="px-2 py-2 sticky top-0 bg-popover border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="h-8 pl-7 text-sm"
                // Impede que o Select feche ou mude de valor ao digitar
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Sugestões OCR (apenas em modo OCR quando não há busca ativa) */}
          {!isManualMode && suggestions.length > 0 && !supplierSearch && (
            <>
              <SelectGroup>
                <SelectLabel>Sugestões</SelectLabel>
                {suggestions.map(s => (
                  <SelectItem key={s.id} value={s.id} textValue={s.company_name}>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        s.confidence > 0.8 ? 'default' :
                        s.confidence > 0.5 ? 'secondary' : 'outline'
                      } className="text-xs shrink-0">
                        {(s.confidence * 100).toFixed(0)}%
                      </Badge>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">{s.company_name}</span>
                        {s.cnpj_cpf && (
                          <span className="text-xs text-muted-foreground">{s.cnpj_cpf}</span>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
            </>
          )}

          {/* Lista principal */}
          <SelectGroup>
            {!isManualMode && !supplierSearch && <SelectLabel>Todos os Fornecedores</SelectLabel>}
            {suppliersToShow.length > 0 ? (
              suppliersToShow.map(s => (
                <SelectItem key={s.id} value={s.id} textValue={s.company_name}>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium">{s.company_name}</span>
                    {s.cnpj_cpf && (
                      <span className="text-xs text-muted-foreground">{s.cnpj_cpf}</span>
                    )}
                  </div>
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                Nenhum fornecedor encontrado
              </div>
            )}
          </SelectGroup>

          <SelectSeparator />

          <SelectItem value="__new__" textValue="Cadastrar Novo Fornecedor">
            <div className="flex items-center gap-2 text-primary">
              <Plus className="h-4 w-4 shrink-0" />
              <span className="font-medium">Cadastrar Novo Fornecedor</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {!selectedSupplierId && (
        <p className="text-sm text-destructive">
          Fornecedor obrigatório para lançamento
        </p>
      )}
    </div>
  );
};
