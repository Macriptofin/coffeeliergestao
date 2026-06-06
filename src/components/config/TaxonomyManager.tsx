import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  List, 
  Upload,
  Download,
  AlertCircle
} from "lucide-react";
import { useTaxonomy } from "@/hooks/useConfig";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface TaxonomyManagerProps {
  taxonomyKey: string;
  title: string;
  description: string;
  showParent?: boolean;
  parentTaxonomyKey?: string; // Key da taxonomia pai para filtrar opções de parent
}

export const TaxonomyManager = ({ 
  taxonomyKey, 
  title, 
  description, 
  showParent = false,
  parentTaxonomyKey
}: TaxonomyManagerProps) => {
  const { 
    terms, 
    loading, 
    getTermsByTaxonomy, 
    createTerm, 
    updateTerm, 
    deleteTerm 
  } = useTaxonomy();
  
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<any>(null);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    parent_id: '',
    sort_order: 0,
    is_active: true
  });

  // Auto-generate code from name + optional parent
  const generateCode = (name: string, parentId?: string): string => {
    const clean = (str: string) =>
      str
        .toUpperCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')  // strip accents
        .replace(/[^A-Z0-9]/g, '')        // keep alphanumeric only
        .slice(0, 3);

    const namePart = clean(name);
    if (!parentId) return namePart;

    const parent = terms.find(t => t.id === parentId);
    const parentPart = parent ? clean(parent.name) : '';
    return parentPart ? `${parentPart}_${namePart}` : namePart;
  };

  const taxonomyTerms = getTermsByTaxonomy(taxonomyKey);
  // Filtrar termos: baseado na taxonomyKey específica e apenas ativos
  const allTerms = taxonomyTerms.filter(t => t.is_active !== false);

  const handleCreate = () => {
    setEditingTerm(null);
    setCodeManuallyEdited(false);
    setFormData({
      name: '',
      code: '',
      parent_id: '',
      sort_order: taxonomyTerms.length,
      is_active: true
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (term: any) => {
    setEditingTerm(term);
    setCodeManuallyEdited(true); // editing: don't auto-overwrite code
    setFormData({
      name: term.name,
      code: term.code || '',
      parent_id: term.parent_id || '',
      sort_order: term.sort_order,
      is_active: term.is_active
    });
    setIsDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => {
      const newCode = !codeManuallyEdited ? generateCode(name, prev.parent_id) : prev.code;
      return { ...prev, name, code: newCode };
    });
  };

  const handleParentChange = (parentId: string) => {
    setFormData(prev => {
      const newCode = !codeManuallyEdited ? generateCode(prev.name, parentId) : prev.code;
      return { ...prev, parent_id: parentId, code: newCode };
    });
  };

  const handleCodeChange = (code: string) => {
    setCodeManuallyEdited(true);
    setFormData(prev => ({ ...prev, code: code.toUpperCase() }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "O nome do termo é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingTerm) {
        await updateTerm(editingTerm.id, {
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          parent_id: formData.parent_id || undefined,
          sort_order: formData.sort_order,
          is_active: formData.is_active
        });
      } else {
        await createTerm(taxonomyKey, {
          name: formData.name.trim(),
          code: formData.code.trim() || undefined,
          parent_id: formData.parent_id || undefined,
          sort_order: formData.sort_order,
          is_active: formData.is_active
        });
      }
      setIsDialogOpen(false);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleDelete = async (termId: string) => {
    if (confirm('Tem certeza que deseja excluir este termo?')) {
      await deleteTerm(termId);
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['Código', 'Nome', 'Pai', 'Ordem', 'Ativo'].join(','),
      ...allTerms.map(term => [
        term.code || '',
        term.name,
        term.parent_id ? terms.find(p => p.id === term.parent_id)?.name || '' : '',
        term.sort_order,
        term.is_active ? 'Sim' : 'Não'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${taxonomyKey}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get parent options based on parentTaxonomyKey
  const parentOptions = showParent && parentTaxonomyKey
    ? getTermsByTaxonomy(parentTaxonomyKey).filter(t => t.is_active !== false)
    : [];

  if (loading) {
    return <div className="animate-pulse">Carregando taxonomias...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              {title}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Termo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingTerm ? 'Editar' : 'Novo'} Termo
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Nome do termo"
                      autoFocus
                    />
                  </div>

                  {showParent && parentOptions.length > 0 && (
                    <div className="space-y-2">
                      <Label>
                        {parentTaxonomyKey === 'material_category' ? 'Categoria' : 'Termo Pai'}
                      </Label>
                      <Select
                        value={formData.parent_id}
                        onValueChange={handleParentChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {parentOptions.map(parent => (
                            <SelectItem key={parent.id} value={parent.id}>
                              {parent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="code">Código</Label>
                      {!codeManuallyEdited && formData.code && (
                        <span className="text-xs text-muted-foreground">gerado automaticamente</span>
                      )}
                    </div>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      placeholder="Gerado automaticamente ao digitar o nome"
                      maxLength={12}
                      className="font-mono"
                    />
                    {!codeManuallyEdited && (
                      <p className="text-xs text-muted-foreground">
                        Edite o campo acima para personalizar o código.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                    <Label htmlFor="is_active">Ativo</Label>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSave}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {allTerms.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum termo encontrado. Clique em "Novo Termo" para começar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allTerms.map((term) => (
              <div
                key={term.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {term.code && (
                    <Badge variant="outline" className="font-mono">
                      {term.code}
                    </Badge>
                  )}
                  <span className={`${!term.is_active ? 'text-muted-foreground line-through' : ''}`}>
                    {term.name}
                  </span>
                  {showParent && term.parent_id && (
                    <span className="text-xs text-muted-foreground">
                      → {terms.find(p => p.id === term.parent_id)?.name}
                    </span>
                  )}
                  {!term.is_active && (
                    <Badge variant="secondary" className="text-xs">
                      Inativo
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(term)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(term.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};