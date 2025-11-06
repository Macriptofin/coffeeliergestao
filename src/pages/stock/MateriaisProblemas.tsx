import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Wrench, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface MaterialIssue {
  id: string;
  name: string;
  code: string;
  material_type: string;
  category: string;
  issues: string[];
}

const MateriaisProblemas = () => {
  const [issues, setIssues] = useState<MaterialIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);

  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const { data: materials, error } = await supabase
        .from('materials')
        .select('id, name, code, material_type, category')
        .order('code');

      if (error) throw error;

      const problematicMaterials: MaterialIssue[] = [];

      materials?.forEach(material => {
        const materialIssues: string[] = [];

        // Check 1: Invalid code prefix
        const expectedPrefix = getExpectedPrefix(material.material_type);
        if (!material.code.startsWith(expectedPrefix)) {
          materialIssues.push(`Código "${material.code}" não inicia com prefixo esperado "${expectedPrefix}"`);
        }

        // Check 2: Invalid code format (PAC, OLD prefixes)
        if (material.code.match(/^(PAC|OLD|MAT)\d+/)) {
          materialIssues.push(`Código usa prefixo obsoleto ou inválido: "${material.code}"`);
        }

        // Check 3: Category vs material_type mismatch
        const expectedCategory = getCategoryFromMaterialType(material.material_type);
        if (material.category !== expectedCategory) {
          materialIssues.push(`Category "${material.category}" não corresponde ao material_type "${material.material_type}" (esperado: "${expectedCategory}")`);
        }

        if (materialIssues.length > 0) {
          problematicMaterials.push({
            ...material,
            issues: materialIssues
          });
        }
      });

      setIssues(problematicMaterials);
    } catch (error) {
      console.error('Erro ao carregar problemas:', error);
      toast.error('Erro ao carregar materiais com problemas');
    } finally {
      setLoading(false);
    }
  };

  const getExpectedPrefix = (materialType: string): string => {
    const prefixMap: Record<string, string> = {
      'ingredient': 'INS',
      'packaging': 'EMB',
      'finished_product': 'FIN',
      'intermediate_product': 'INT',
      'composite_product': 'COM',
      'resale_product': 'REV'
    };
    return prefixMap[materialType] || 'MAT';
  };

  const getCategoryFromMaterialType = (materialType: string): string => {
    const categoryMap: Record<string, string> = {
      'ingredient': 'Insumo',
      'packaging': 'Embalagem',
      'intermediate_product': 'Produto Intermediário',
      'finished_product': 'Produto Acabado',
      'composite_product': 'Produto Composto',
      'resale_product': 'Produto de Revenda'
    };
    return categoryMap[materialType] || 'Insumo';
  };

  const fixMaterial = async (material: MaterialIssue) => {
    setFixing(material.id);
    try {
      const expectedPrefix = getExpectedPrefix(material.material_type);
      const expectedCategory = getCategoryFromMaterialType(material.material_type);
      
      // Get next available code number
      const { data: maxCodeData } = await supabase
        .from('materials')
        .select('code')
        .like('code', `${expectedPrefix}%`)
        .order('code', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (maxCodeData && maxCodeData.length > 0) {
        const lastCode = maxCodeData[0].code;
        const match = lastCode.match(/\d+$/);
        if (match) {
          nextNumber = parseInt(match[0]) + 1;
        }
      }

      const newCode = `${expectedPrefix}${String(nextNumber).padStart(4, '0')}`;

      // Update material
      const { error } = await supabase
        .from('materials')
        .update({
          code: newCode,
          category: expectedCategory
        })
        .eq('id', material.id);

      if (error) throw error;

      toast.success(`Material corrigido: ${material.name} → ${newCode}`);
      loadIssues(); // Reload to refresh list
    } catch (error) {
      console.error('Erro ao corrigir material:', error);
      toast.error('Erro ao corrigir material');
    } finally {
      setFixing(null);
    }
  };

  const fixAllMaterials = async () => {
    if (issues.length === 0) return;
    
    const confirmFix = window.confirm(
      `Deseja corrigir automaticamente ${issues.length} materiais com problemas?\n\n` +
      'Isso irá:\n' +
      '- Regenerar códigos inválidos com prefixos corretos\n' +
      '- Sincronizar campo "category" com "material_type"\n\n' +
      'Esta ação não pode ser desfeita.'
    );

    if (!confirmFix) return;

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const material of issues) {
      try {
        await fixMaterial(material);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    toast.success(`Correção concluída: ${successCount} sucesso, ${errorCount} erros`);
    setLoading(false);
  };

  const getSeverityColor = (issueCount: number) => {
    if (issueCount >= 3) return 'text-red-600';
    if (issueCount >= 2) return 'text-orange-600';
    return 'text-yellow-600';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Analisando materiais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Materiais com Problemas</h1>
        <p className="text-muted-foreground">
          Diagnóstico e correção de inconsistências em códigos e categorias
        </p>
      </div>

      {issues.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Sistema Íntegro!</h3>
              <p className="text-muted-foreground">
                Nenhuma inconsistência encontrada. Todos os materiais estão corretamente configurados.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>{issues.length} materiais</strong> com problemas identificados. 
              Recomenda-se corrigir para garantir consistência do sistema.
            </AlertDescription>
          </Alert>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Ações de Correção
                  </CardTitle>
                  <CardDescription>
                    Corrigir automaticamente códigos e categorias
                  </CardDescription>
                </div>
                <Button 
                  onClick={fixAllMaterials} 
                  disabled={loading}
                  variant="default"
                  size="lg"
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  Corrigir Todos ({issues.length})
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Problemas Detectados</CardTitle>
              <CardDescription>
                Clique em "Corrigir" para normalizar cada material individualmente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código Atual</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Problemas</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {material.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {material.material_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {material.issues.map((issue, idx) => (
                            <div key={idx} className={`text-xs ${getSeverityColor(material.issues.length)}`}>
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              {issue}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => fixMaterial(material)}
                          disabled={fixing === material.id}
                        >
                          {fixing === material.id ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Corrigindo...
                            </>
                          ) : (
                            <>
                              <Wrench className="h-3 w-3 mr-1" />
                              Corrigir
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default MateriaisProblemas;
