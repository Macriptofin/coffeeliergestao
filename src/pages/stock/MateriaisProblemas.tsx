import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, RefreshCw, ChevronLeft, ChevronRight, Save, Sparkles, Info } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTaxonomy } from "@/hooks/useConfig";
import { useMaterialsDiagnostics } from "@/hooks/useMaterialsDiagnostics";

interface Material {
  id: string;
  name: string;
  code: string;
  material_type: string;
  category: string;
  subcategory?: string;
}

interface MaterialIssue extends Material {
  issues: {
    field: string;
    current: string | number;
    expected: string | number;
    severity: 'high' | 'medium' | 'low';
  }[];
  csvSuggestions?: {
    material_type?: string;
    category?: string;
    subcategory?: string;
  };
}

const materialTypeMap: Record<string, string> = {
  'Insumo': 'ingredient',
  'Embalagem': 'packaging',
  'Produto Intermediário': 'intermediate_product',
  'Produto Acabado': 'finished_product',
  'Produto Composto': 'composite_product',
  'Produto de Revenda': 'resale_product'
};

const materialTypeLabels: Record<string, string> = {
  'ingredient': 'Insumo',
  'packaging': 'Embalagem',
  'intermediate_product': 'Produto Intermediário',
  'finished_product': 'Produto Acabado',
  'composite_product': 'Produto Composto',
  'resale_product': 'Produto de Revenda'
};

const MateriaisProblemas = () => {
  const { diagnostics, loading: diagLoading, runDiagnostics } = useMaterialsDiagnostics();
  const [issues, setIssues] = useState<MaterialIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState<'list' | 'individual'>('list');
  const { getTermsByTaxonomy } = useTaxonomy();
  
  // Edição individual
  const [editedMaterial, setEditedMaterial] = useState<MaterialIssue | null>(null);

  useEffect(() => {
    runDiagnostics();
  }, []);

  useEffect(() => {
    if (diagnostics) {
      // Carregar dados completos dos materiais com problemas
      loadMaterialsDetails(diagnostics.discrepancies.map(d => d.id));
    }
  }, [diagnostics]);

  const loadMaterialsDetails = async (materialIds: string[]) => {
    if (materialIds.length === 0) {
      setIssues([]);
      setLoading(false);
      return;
    }

    try {
      const { data: materials, error } = await supabase
        .from('materials')
        .select('id, name, code, material_type, category, subcategory')
        .in('id', materialIds);

      if (error) throw error;

      // Combinar com diagnósticos do CSV
      const materialIssues: MaterialIssue[] = (materials || []).map(material => {
        const diag = diagnostics!.discrepancies.find(d => d.id === material.id);
        if (!diag) return null;

        const csvSuggestions: MaterialIssue['csvSuggestions'] = {};
        
        diag.issues.forEach(issue => {
          if (issue.field === 'material_type') {
            csvSuggestions.material_type = materialTypeMap[String(issue.expected)] || String(issue.expected);
          } else if (issue.field === 'category') {
            csvSuggestions.category = String(issue.expected);
          } else if (issue.field === 'subcategory') {
            csvSuggestions.subcategory = String(issue.expected);
          }
        });

        return {
          ...material,
          issues: diag.issues,
          csvSuggestions
        } as MaterialIssue;
      }).filter(m => m !== null && m.issues.length > 0);

      setIssues(materialIssues);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  };

  const saveMaterial = async (material: MaterialIssue) => {
    setFixing(material.id);
    try {
      const { error } = await supabase
        .from('materials')
        .update({
          material_type: material.material_type,
          category: material.category,
          subcategory: material.subcategory || null
        })
        .eq('id', material.id);

      if (error) throw error;

      toast.success(`Material "${material.name}" atualizado`);
      
      // Recarregar diagnósticos
      await runDiagnostics();
      
      // Avançar para o próximo material automaticamente
      if (currentIndex < issues.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Erro ao salvar material:', error);
      toast.error('Erro ao salvar material');
    } finally {
      setFixing(null);
    }
  };

  const applySuggestion = (field: 'material_type' | 'category' | 'subcategory') => {
    if (!editedMaterial || !editedMaterial.csvSuggestions) return;

    const suggestion = editedMaterial.csvSuggestions[field];
    if (!suggestion) return;

    if (field === 'category') {
      // Ao mudar categoria, limpar subcategoria
      setEditedMaterial({ 
        ...editedMaterial, 
        category: suggestion,
        subcategory: ''
      });
    } else {
      setEditedMaterial({ 
        ...editedMaterial, 
        [field]: suggestion 
      });
    }
  };

  const handleIndividualSave = () => {
    if (editedMaterial) {
      saveMaterial(editedMaterial);
    }
  };

  const navigateToMaterial = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (direction === 'next' && currentIndex < issues.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  useEffect(() => {
    if (issues.length > 0 && issues[currentIndex]) {
      setEditedMaterial(issues[currentIndex]);
    }
  }, [currentIndex, issues]);

  const materialCategories = getTermsByTaxonomy('material_category').filter(term => term.is_active && !term.parent_id);
  const allSubcategories = getTermsByTaxonomy('material_subcategory').filter(term => term.is_active);
  
  const availableSubcategories = editedMaterial
    ? allSubcategories.filter(sub => {
        const categoryTerm = materialCategories.find(cat => cat.name === editedMaterial.category);
        return categoryTerm && sub.parent_id === categoryTerm.id;
      })
    : [];

  const getSeverityColor = (issueCount: number) => {
    if (issueCount >= 3) return 'text-destructive';
    if (issueCount >= 2) return 'text-orange-600';
    return 'text-yellow-600';
  };

  const getIssueLabel = (issue: MaterialIssue['issues'][0]) => {
    const labels: Record<string, string> = {
      'material_type': 'Tipo Operacional',
      'category': 'Categoria Comercial',
      'subcategory': 'Subcategoria',
      'code_prefix': 'Prefixo do Código'
    };
    return labels[issue.field] || issue.field;
  };

  if (loading || diagLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Analisando materiais com referência CSV...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Limpeza de Materiais</h1>
        <p className="text-muted-foreground">
          Revise e corrija tipo, categoria e subcategoria com base em PRODUTOS_LIMPOS.csv
        </p>
      </div>

      {issues.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Sistema Íntegro!</h3>
              <p className="text-muted-foreground">
                Todos os materiais estão consistentes com PRODUTOS_LIMPOS.csv
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <strong>{issues.length} materiais</strong> precisam de correção baseada no CSV de referência
            </AlertDescription>
          </Alert>

          <Tabs value={editMode} onValueChange={(v) => setEditMode(v as 'list' | 'individual')} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="list">Lista Completa</TabsTrigger>
              <TabsTrigger value="individual">Correção Individual</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Materiais Pendentes</CardTitle>
                  <CardDescription>
                    {issues.length} materiais com discrepâncias em relação ao CSV
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo Atual</TableHead>
                        <TableHead>Categoria Atual</TableHead>
                        <TableHead>Problemas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issues.map((material, idx) => (
                        <TableRow 
                          key={material.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setCurrentIndex(idx);
                            setEditMode('individual');
                          }}
                        >
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {material.code}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{material.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {materialTypeLabels[material.material_type] || material.material_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{material.category}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className={getSeverityColor(material.issues.length)}>
                                {material.issues.length} {material.issues.length === 1 ? 'problema' : 'problemas'}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="individual" className="mt-6">
              {editedMaterial && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {editedMaterial.code}
                          </Badge>
                          {editedMaterial.name}
                        </CardTitle>
                        <CardDescription>
                          Material {currentIndex + 1} de {issues.length}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigateToMaterial('prev')}
                          disabled={currentIndex === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigateToMaterial('next')}
                          disabled={currentIndex >= issues.length - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Problemas detectados */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Discrepâncias Encontradas:</h4>
                      <div className="space-y-2">
                        {editedMaterial.issues.map((issue, idx) => (
                          <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-start gap-2 mb-1">
                              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                              <span className="font-medium text-sm">{getIssueLabel(issue)}</span>
                            </div>
                            <div className="ml-6 text-xs space-y-1">
                              <div>
                                <span className="text-muted-foreground">Atual: </span>
                                <span className="text-destructive">{String(issue.current)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Esperado (CSV): </span>
                                <span className="text-green-600 dark:text-green-400">{String(issue.expected)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Use os botões <Sparkles className="h-3 w-3 inline mx-1" /> para aplicar as sugestões do CSV automaticamente
                      </AlertDescription>
                    </Alert>

                    {/* Edição */}
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Tipo Operacional *</label>
                          {editedMaterial.csvSuggestions?.material_type && 
                           editedMaterial.csvSuggestions.material_type !== editedMaterial.material_type && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => applySuggestion('material_type')}
                              className="h-7 text-xs"
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Aplicar: {materialTypeLabels[editedMaterial.csvSuggestions.material_type]}
                            </Button>
                          )}
                        </div>
                        <Select
                          value={editedMaterial.material_type}
                          onValueChange={(value) =>
                            setEditedMaterial({ ...editedMaterial, material_type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ingredient">Insumo</SelectItem>
                            <SelectItem value="packaging">Embalagem</SelectItem>
                            <SelectItem value="intermediate_product">Produto Intermediário</SelectItem>
                            <SelectItem value="finished_product">Produto Acabado</SelectItem>
                            <SelectItem value="composite_product">Produto Composto</SelectItem>
                            <SelectItem value="resale_product">Produto de Revenda</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Categoria Comercial *</label>
                          {editedMaterial.csvSuggestions?.category && 
                           editedMaterial.csvSuggestions.category !== editedMaterial.category && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => applySuggestion('category')}
                              className="h-7 text-xs"
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Aplicar: {editedMaterial.csvSuggestions.category}
                            </Button>
                          )}
                        </div>
                        <Select
                          value={editedMaterial.category}
                          onValueChange={(value) =>
                            setEditedMaterial({ ...editedMaterial, category: value, subcategory: '' })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {materialCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.name}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Subcategoria</label>
                          {editedMaterial.csvSuggestions?.subcategory && 
                           editedMaterial.csvSuggestions.subcategory !== editedMaterial.subcategory && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => applySuggestion('subcategory')}
                              className="h-7 text-xs"
                            >
                              <Sparkles className="h-3 w-3 mr-1" />
                              Aplicar: {editedMaterial.csvSuggestions.subcategory}
                            </Button>
                          )}
                        </div>
                        <Select
                          value={editedMaterial.subcategory || 'none'}
                          onValueChange={(value) =>
                            setEditedMaterial({ ...editedMaterial, subcategory: value === 'none' ? '' : value })
                          }
                          disabled={availableSubcategories.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={
                              availableSubcategories.length === 0
                                ? "Nenhuma subcategoria disponível"
                                : "Selecione subcategoria"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma subcategoria</SelectItem>
                            {availableSubcategories.map((sub) => (
                              <SelectItem key={sub.id} value={sub.name}>
                                {sub.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2 justify-end pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => setEditMode('list')}
                      >
                        Voltar à Lista
                      </Button>
                      <Button
                        onClick={handleIndividualSave}
                        disabled={fixing === editedMaterial.id}
                      >
                        {fixing === editedMaterial.id ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Salvar e Próximo
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default MateriaisProblemas;
