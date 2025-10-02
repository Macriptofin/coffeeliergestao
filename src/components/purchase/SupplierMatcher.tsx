import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

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

  useEffect(() => {
    loadSuppliers();
  }, [supplierText]);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      // Buscar todos os fornecedores
      const { data: all } = await supabase
        .from('suppliers')
        .select('id, company_name, cnpj_cpf')
        .order('company_name');
      
      setAllSuppliers(all || []);

      // Gerar sugestões
      const suggs = await generateSuggestions(supplierText, all || []);
      setSuggestions(suggs);

    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async (text: string, suppliers: Supplier[]): Promise<SupplierSuggestion[]> => {
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

  const handleSelect = (value: string) => {
    if (value === '__new__') {
      onCreateNew();
    } else {
      onSupplierSelect(value);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        Fornecedor *
        <Badge variant="outline">{supplierText}</Badge>
      </Label>
      <Select value={selectedSupplierId || ''} onValueChange={handleSelect}>
        <SelectTrigger className={!selectedSupplierId ? 'border-destructive' : ''}>
          <SelectValue placeholder="Selecione o fornecedor cadastrado" />
        </SelectTrigger>
        <SelectContent>
          {suggestions.length > 0 && (
            <>
              <SelectGroup>
                <SelectLabel>Sugestões</SelectLabel>
                {suggestions.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        s.confidence > 0.8 ? 'default' :
                        s.confidence > 0.5 ? 'secondary' : 'outline'
                      }>
                        {(s.confidence * 100).toFixed(0)}%
                      </Badge>
                      <div className="flex flex-col">
                        <span className="font-medium">{s.company_name}</span>
                        {s.cnpj_cpf && (
                          <span className="text-xs text-muted-foreground">
                            {s.cnpj_cpf}
                          </span>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
            </>
          )}
          
          <SelectGroup>
            <SelectLabel>Todos os Fornecedores</SelectLabel>
            {allSuppliers.map(s => (
            <SelectItem key={s.id} value={s.id}>
              <div className="flex flex-col">
                <span className="font-medium">{s.company_name}</span>
                {s.cnpj_cpf && (
                  <span className="text-xs text-muted-foreground">
                    {s.cnpj_cpf}
                  </span>
                )}
              </div>
            </SelectItem>
            ))}
          </SelectGroup>
          
          <SelectSeparator />
          
          <SelectItem value="__new__">
            <div className="flex items-center gap-2 text-primary">
              <Plus className="h-4 w-4" />
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
