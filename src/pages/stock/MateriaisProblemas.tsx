import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Wrench, RefreshCw, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTaxonomy } from "@/hooks/useConfig";

interface Material {
  id: string;
  name: string;
  code: string;
  material_type: string;
  category: string;
  subcategory?: string;
}

interface MaterialIssue extends Material {
  issues: string[];
  suggestedCategory?: string;
  suggestedSubcategory?: string;
}

const MateriaisProblemas = () => {
  const [issues, setIssues] = useState<MaterialIssue[]>([]);
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editMode, setEditMode] = useState<'list' | 'individual'>('list');
  const { getTermsByTaxonomy } = useTaxonomy();
  
  // Edição individual
  const [editedMaterial, setEditedMaterial] = useState<Material | null>(null);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const { data: materials, error } = await supabase
        .from('materials')
        .select('id, name, code, material_type, category, subcategory')
        .order('code');

      if (error) throw error;

      setAllMaterials(materials || []);
      const problematicMaterials = analyzeMaterials(materials || []);
      setIssues(problematicMaterials);
    } catch (error) {
      console.error('Erro ao carregar materiais:', error);
      toast.error('Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  };

  const analyzeMaterials = (materials: Material[]): MaterialIssue[] => {
    const problematicMaterials: MaterialIssue[] = [];

    materials.forEach(material => {
      const materialIssues: string[] = [];
      let suggestedCategory: string | undefined;
      let suggestedSubcategory: string | undefined;

      // Check 1: Invalid code prefix
      const expectedPrefix = getExpectedPrefix(material.material_type);
      if (!material.code.startsWith(expectedPrefix)) {
        materialIssues.push(`Código com prefixo incorreto (esperado: ${expectedPrefix})`);
      }

      // Check 2: Invalid code format (obsolete prefixes)
      if (material.code.match(/^(PAC|OLD|MAT)\d+/)) {
        materialIssues.push(`Código usa prefixo obsoleto`);
      }

      // Check 3: Category precisa revisão (antigas categorias operacionais)
      const oldOperationalCategories = ['Insumo', 'Embalagem', 'Produto Intermediário', 'Produto Acabado', 'Produto Composto', 'Produto de Revenda'];
      if (oldOperationalCategories.includes(material.category)) {
        materialIssues.push(`Categoria operacional antiga "${material.category}" precisa ser atualizada para categoria comercial`);
        suggestedCategory = getSuggestedCategory(material.material_type);
      }

      // Check 4: Missing subcategory
      if (!material.subcategory) {
        materialIssues.push(`Subcategoria não definida`);
      }

      if (materialIssues.length > 0) {
        problematicMaterials.push({
          ...material,
          issues: materialIssues,
          suggestedCategory,
          suggestedSubcategory
        });
      }
    });

    return problematicMaterials;
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

  const getSuggestedCategory = (materialType: string): string => {
    // Sugere categorias comerciais baseadas no tipo operacional
    const suggestionMap: Record<string, string> = {
      'ingredient': 'Alimentos & Ingredientes',
      'packaging': 'Embalagens',
      'intermediate_product': 'Doces & Confeitaria',
      'finished_product': 'Doces & Confeitaria',
      'composite_product': 'Kits & Mesas',
      'resale_product': 'Bebidas'
    };
    return suggestionMap[materialType] || 'Alimentos & Ingredientes';
  };

  const saveMaterial = async (material: Material) => {
    setFixing(material.id);
    try {
      const { error } = await supabase
        .from('materials')
        .update({
          category: material.category,
          subcategory: material.subcategory
        })
        .eq('id', material.id);

      if (error) throw error;

      toast.success(`Material "${material.name}" atualizado`);
      await loadMaterials();
      
      // Avançar para o próximo material automaticamente
      if (currentIndex < issues.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (issues.length > 0) {
        // Se era o último e ainda tem problemas, voltar ao início
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Erro ao salvar material:', error);
      toast.error('Erro ao salvar material');
    } finally {
      setFixing(null);
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
    <div className="container mx-auto py-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Limpeza de Materiais</h1>
        <p className="text-muted-foreground">
          Revise e atualize tipo, categoria e subcategoria de todos os materiais
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
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>{issues.length} materiais</strong> precisam de revisão. 
              Revise tipo, categoria e subcategoria de cada um.
            </AlertDescription>
          </Alert>

          <Tabs value={editMode} onValueChange={(v) => setEditMode(v as 'list' | 'individual')} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="list">Lista Completa</TabsTrigger>
              <TabsTrigger value="individual">Revisão Individual</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Materiais Pendentes</CardTitle>
                  <CardDescription>
                    {issues.length} materiais precisam de revisão
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
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
                              {material.material_type}
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
                      <h4 className="font-medium text-sm">Problemas Detectados:</h4>
                      <div className="space-y-1">
                        {issues[currentIndex].issues.map((issue, idx) => (
                          <div key={idx} className="text-sm flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                            <span>{issue}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Edição */}
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tipo Operacional (não editável)</label>
                        <Select value={editedMaterial.material_type} disabled>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          O tipo define o comportamento operacional e não pode ser alterado aqui
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Categoria Comercial *</label>
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
                        {issues[currentIndex].suggestedCategory && (
                          <p className="text-xs text-muted-foreground">
                            Sugestão: {issues[currentIndex].suggestedCategory}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Subcategoria</label>
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
