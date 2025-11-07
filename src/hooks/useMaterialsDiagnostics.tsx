import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';

interface CSVMaterial {
  id: string;
  code: string;
  name: string;
  material_type_ATUAL: string;
  category_ATUAL: string;
  subcategory_ATUAL: string;
  purchase_unit: string;
  usage_unit: string;
  conversion_factor: string;
  material_type_NOVO: string;
  category_NOVO: string;
  subcategory_NOVO: string;
  OBSERVACOES: string;
}

interface DBMaterial {
  id: string;
  code: string;
  name: string;
  material_type: string;
  category: string;
  subcategory?: string;
  purchase_unit: string;
  usage_unit: string;
  conversion_factor: number;
}

interface MaterialDiscrepancy {
  id: string;
  code: string;
  name: string;
  issues: {
    field: string;
    current: string | number;
    expected: string | number;
    severity: 'high' | 'medium' | 'low';
  }[];
}

interface DiagnosticsResult {
  total_materials: number;
  materials_with_issues: number;
  discrepancies: MaterialDiscrepancy[];
  summary: {
    material_type_issues: number;
    category_issues: number;
    subcategory_issues: number;
    code_prefix_issues: number;
  };
}

export const useMaterialsDiagnostics = () => {
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Carregar CSV de referência
      const csvResponse = await fetch('/data/PRODUTOS_LIMPOS.csv');
      const csvText = await csvResponse.text();
      
      const { data: csvData } = Papa.parse<CSVMaterial>(csvText, {
        header: true,
        skipEmptyLines: true,
      });

      // 2. Carregar dados atuais do banco
      const { data: dbData, error: dbError } = await supabase
        .from('materials')
        .select('id, code, name, material_type, category, subcategory, purchase_unit, usage_unit, conversion_factor')
        .order('code');

      if (dbError) throw dbError;

      // 3. Criar mapa de referência do CSV
      const csvMap = new Map<string, CSVMaterial>();
      csvData.forEach((row) => {
        if (row.id) {
          csvMap.set(row.id, row);
        }
      });

      // 4. Comparar e identificar discrepâncias
      const discrepancies: MaterialDiscrepancy[] = [];
      let materialTypeIssues = 0;
      let categoryIssues = 0;
      let subcategoryIssues = 0;
      let codePrefixIssues = 0;

      (dbData || []).forEach((dbMaterial: DBMaterial) => {
        const csvMaterial = csvMap.get(dbMaterial.id);
        if (!csvMaterial) return; // Material não está no CSV de referência

        const issues: MaterialDiscrepancy['issues'] = [];

        // Verificar material_type
        if (csvMaterial.material_type_NOVO !== dbMaterial.material_type) {
          issues.push({
            field: 'material_type',
            current: dbMaterial.material_type,
            expected: csvMaterial.material_type_NOVO,
            severity: 'high',
          });
          materialTypeIssues++;
        }

        // Verificar category
        if (csvMaterial.category_NOVO !== dbMaterial.category) {
          issues.push({
            field: 'category',
            current: dbMaterial.category,
            expected: csvMaterial.category_NOVO,
            severity: 'high',
          });
          categoryIssues++;
        }

        // Verificar subcategory
        const expectedSubcategory = csvMaterial.subcategory_NOVO || '';
        const currentSubcategory = dbMaterial.subcategory || '';
        if (expectedSubcategory !== currentSubcategory) {
          issues.push({
            field: 'subcategory',
            current: currentSubcategory,
            expected: expectedSubcategory,
            severity: 'medium',
          });
          subcategoryIssues++;
        }

        // Verificar prefixo do código
        const expectedPrefix = getExpectedPrefix(csvMaterial.material_type_NOVO);
        if (!dbMaterial.code.startsWith(expectedPrefix)) {
          issues.push({
            field: 'code_prefix',
            current: dbMaterial.code,
            expected: `${expectedPrefix}xxxx`,
            severity: 'medium',
          });
          codePrefixIssues++;
        }

        // Verificar prefixos obsoletos
        if (dbMaterial.code.match(/^(PAC|OLD|MAT)\d+/)) {
          issues.push({
            field: 'code_prefix',
            current: dbMaterial.code,
            expected: `${expectedPrefix}xxxx (remover prefixo obsoleto)`,
            severity: 'high',
          });
          codePrefixIssues++;
        }

        if (issues.length > 0) {
          discrepancies.push({
            id: dbMaterial.id,
            code: dbMaterial.code,
            name: dbMaterial.name,
            issues,
          });
        }
      });

      setDiagnostics({
        total_materials: dbData?.length || 0,
        materials_with_issues: discrepancies.length,
        discrepancies,
        summary: {
          material_type_issues: materialTypeIssues,
          category_issues: categoryIssues,
          subcategory_issues: subcategoryIssues,
          code_prefix_issues: codePrefixIssues,
        },
      });
    } catch (err) {
      console.error('Erro no diagnóstico:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const getExpectedPrefix = (materialType: string): string => {
    const prefixMap: Record<string, string> = {
      'Insumo': 'INS',
      'Produto Intermediário': 'INT',
      'Produto Acabado': 'FIN',
      'Produto Composto': 'COM',
      'Produto de Revenda': 'REV',
      'Embalagem': 'EMB',
    };
    return prefixMap[materialType] || 'MAT';
  };

  return {
    loading,
    diagnostics,
    error,
    runDiagnostics,
  };
};
