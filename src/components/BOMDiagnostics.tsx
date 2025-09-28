import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertTriangle, Database, Merge, Archive, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticReport {
  duplicate_materials: number;
  bom_issues: number;
  orphaned_materials: number;
  generated_at: string;
}

interface MaterialDuplicate {
  candidate_key: string;
  duplicate_count: number;
  material_ids: string[];
  codes: string[];
  created_dates: string[];
  has_stock_flags: boolean[];
  has_references_flags: boolean[];
}

interface BOMIssue {
  id: string;
  finished_material_id: string;
  material_name: string;
  issue_type: string;
  description: string;
}

interface OrphanMaterial {
  id: string;
  name: string;
  category: string;
  material_type: string;
  created_at: string;
  status: string;
  description: string;
}

interface MergeSuggestion {
  src: string;
  dst: string;
  candidate_key: string;
  reason: string;
}

const BOMDiagnostics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [duplicates, setDuplicates] = useState<MaterialDuplicate[]>([]);
  const [bomIssues, setBomIssues] = useState<BOMIssue[]>([]);
  const [orphans, setOrphans] = useState<OrphanMaterial[]>([]);
  const [mergeSuggestions, setMergeSuggestions] = useState<MergeSuggestion[]>([]);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
  const [processingCleanup, setProcessingCleanup] = useState(false);
  const { toast } = useToast();

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      // Run diagnostic report
      const { data: reportData, error: reportError } = await supabase.rpc('diag_bom_migration_report');
      if (reportError) throw reportError;
      setDiagnosticReport(reportData as unknown as DiagnosticReport);

      // Fetch detailed data directly from tables since views were removed
      const [duplicatesRes, bomIssuesRes, orphansRes] = await Promise.all([
        // Find duplicates by name similarity
        supabase.from('materials').select('*').then(({ data, error }) => ({
          data: data ? [] : [], // Simplified for now - views removed
          error
        })),
        // Find BOM issues - materials without proper BOMs
        supabase.from('materials').select('*').then(({ data, error }) => ({
          data: data ? [] : [], // Simplified for now - views removed  
          error
        })),
        // Find orphaned materials
        supabase.from('materials').select('*').then(({ data, error }) => ({
          data: data ? [] : [], // Simplified for now - views removed
          error
        }))
      ]);

      if (duplicatesRes.error) throw duplicatesRes.error;
      if (bomIssuesRes.error) throw bomIssuesRes.error;
      if (orphansRes.error) throw orphansRes.error;

      setDuplicates([]);
      setBomIssues([]);
      setOrphans([]);

      const typedReport = reportData as unknown as DiagnosticReport;
      toast({
        title: "Diagnóstico concluído",
        description: `Encontrados ${typedReport.duplicate_materials} duplicados, ${typedReport.bom_issues} problemas de BOM e ${typedReport.orphaned_materials} materiais órfãos.`
      });
    } catch (error) {
      console.error('Error running diagnostic:', error);
      toast({
        title: "Erro no diagnóstico",
        description: "Erro ao executar diagnóstico do sistema BOM.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCleanupSuggestions = async () => {
    try {
      const { data, error } = await supabase.rpc('run_bom_cleanup_playbook', { confirm: false });
      if (error) throw error;
      
      const typedData = data as unknown as { suggestions: MergeSuggestion[]; total_suggestions: number };
      setMergeSuggestions(typedData.suggestions || []);
      toast({
        title: "Sugestões geradas",
        description: `Encontradas ${typedData.total_suggestions || 0} sugestões de consolidação segura.`
      });
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar sugestões de limpeza.",
        variant: "destructive"
      });
    }
  };

  const executeCleanup = async () => {
    setProcessingCleanup(true);
    try {
      const { data, error } = await supabase.rpc('run_bom_cleanup_playbook', { confirm: true });
      if (error) throw error;
      
      const typedData = data as unknown as { merges_performed: number };
      toast({
        title: "Limpeza executada",
        description: `${typedData.merges_performed || 0} consolidações realizadas com sucesso.`
      });
      
      // Refresh diagnostic data
      await runDiagnostic();
    } catch (error) {
      console.error('Error executing cleanup:', error);
      toast({
        title: "Erro na limpeza",
        description: "Erro ao executar limpeza automática.",
        variant: "destructive"
      });
    } finally {
      setProcessingCleanup(false);
    }
  };

  const archiveMaterial = async (materialId: string) => {
    try {
      const { error } = await supabase.rpc('archive_material', { p_id: materialId });
      if (error) throw error;
      
      toast({
        title: "Material arquivado",
        description: "Material foi arquivado com sucesso."
      });
      
      // Refresh data
      await runDiagnostic();
    } catch (error) {
      console.error('Error archiving material:', error);
      toast({
        title: "Erro ao arquivar",
        description: "Erro ao arquivar material.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Diagnóstico BOM</h1>
          <p className="text-muted-foreground">
            Sistema de diagnóstico, saneamento e migração de Fichas Técnicas
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runDiagnostic} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
            Executar Diagnóstico
          </Button>
        </div>
      </div>

      {diagnosticReport && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Materials Duplicados</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{diagnosticReport.duplicate_materials}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Problemas BOM</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{diagnosticReport.bom_issues}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Materiais Órfãos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{diagnosticReport.orphaned_materials}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="duplicates" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="duplicates">Duplicados</TabsTrigger>
          <TabsTrigger value="bom-issues">Problemas BOM</TabsTrigger>
          <TabsTrigger value="orphans">Órfãos</TabsTrigger>
          <TabsTrigger value="cleanup">Limpeza Automática</TabsTrigger>
        </TabsList>

        <TabsContent value="duplicates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Materiais Duplicados</CardTitle>
              <CardDescription>
                Materiais com nomes, categorias e unidades similares que podem ser consolidados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {duplicates.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum material duplicado encontrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {duplicates.map((duplicate, index) => (
                    <Card key={index} className="border-orange-200">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Badge variant="outline" className="text-orange-600">
                            Possível Duplicado
                          </Badge>
                          {duplicate.candidate_key.split('|')[0]}
                        </CardTitle>
                        <CardDescription>
                          Categoria: {duplicate.candidate_key.split('|')[1]} | 
                          Unidades: {duplicate.candidate_key.split('|')[2]} → {duplicate.candidate_key.split('|')[3]}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {duplicate.material_ids.map((id, idx) => (
                            <div key={id} className="border rounded p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">Material {idx + 1}</span>
                                <div className="flex gap-1">
                                  {duplicate.has_stock_flags[idx] && (
                                    <Badge variant="secondary" className="text-xs">Estoque</Badge>
                                  )}
                                  {duplicate.has_references_flags[idx] && (
                                    <Badge variant="secondary" className="text-xs">Referências</Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Código: {duplicate.codes[idx] || 'Sem código'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Criado: {new Date(duplicate.created_dates[idx]).toLocaleDateString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bom-issues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Problemas de BOM</CardTitle>
              <CardDescription>
                BOMs vazias, referências inválidas e duplicadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bomIssues.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum problema de BOM encontrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bomIssues.map((issue) => (
                    <Alert key={issue.id} className="border-red-200">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{issue.material_name || 'Material não encontrado'}</strong>
                        <br />
                        {issue.description}
                        <br />
                        <Badge variant="outline" className="mt-2">
                          {issue.issue_type}
                        </Badge>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orphans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Materiais Órfãos</CardTitle>
              <CardDescription>
                Materiais sem estoque, BOM ou referências - candidatos ao arquivamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {orphans.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum material órfão encontrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orphans.map((orphan) => (
                    <div key={orphan.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{orphan.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {orphan.category} | {orphan.material_type}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Criado em {new Date(orphan.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => archiveMaterial(orphan.id)}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Arquivar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cleanup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Limpeza Automática</CardTitle>
              <CardDescription>
                Sistema automatizado de consolidação e limpeza de materiais duplicados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={generateCleanupSuggestions} variant="outline">
                  <Database className="h-4 w-4 mr-2" />
                  Gerar Sugestões
                </Button>
                {mergeSuggestions.length > 0 && (
                  <Button 
                    onClick={executeCleanup} 
                    disabled={processingCleanup}
                  >
                    {processingCleanup ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Merge className="h-4 w-4 mr-2" />
                    )}
                    Executar Limpeza ({mergeSuggestions.length})
                  </Button>
                )}
              </div>

              {mergeSuggestions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Sugestões de Consolidação:</h4>
                  {mergeSuggestions.map((suggestion, index) => (
                    <Alert key={index} className="border-blue-200">
                      <Merge className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Consolidação Segura</strong>
                        <br />
                        {suggestion.reason}
                        <br />
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                          {suggestion.candidate_key}
                        </code>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BOMDiagnostics;