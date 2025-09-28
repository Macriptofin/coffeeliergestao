import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Download, Upload, FileSpreadsheet, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportResult {
  success: boolean;
  imported_categories: number;
  imported_subcategories: number;
  message: string;
}

interface MigrationSuggestion {
  material_id: string;
  material_name: string;
  current_category: string;
  current_subcategory: string;
  suggested_category_name: string;
  suggested_subcategory_name: string;
  confidence_score: number;
}

export function TaxonomyImporter() {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [migrationSuggestions, setMigrationSuggestions] = useState<MigrationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleImportTaxonomy = async () => {
    setIsImporting(true);
    try {
      const { data, error } = await supabase.rpc('import_taxonomy_from_csv');
      
      if (error) {
        console.error('Erro na importação:', error);
        toast.error('Erro ao importar taxonomia: ' + error.message);
        return;
      }

      const result = data as unknown as ImportResult;
      setImportResult(result);
      toast.success(`Taxonomia importada! ${result.imported_categories} categorias e ${result.imported_subcategories} subcategorias`);
      
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro inesperado durante a importação');
    } finally {
      setIsImporting(false);
    }
  };

  const handleGetMigrationSuggestions = async () => {
    try {
      const { data, error } = await supabase.rpc('suggest_material_taxonomy_migration');
      
      if (error) {
        console.error('Erro ao buscar sugestões:', error);
        toast.error('Erro ao buscar sugestões de migração');
        return;
      }

      const suggestions = data as unknown as MigrationSuggestion[];
      setMigrationSuggestions(suggestions || []);
      setShowSuggestions(true);
      toast.info(`${suggestions?.length || 0} materiais encontrados para migração`);
      
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro inesperado ao buscar sugestões');
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return "bg-green-100 text-green-800";
    if (score >= 70) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 90) return "Alta";
    if (score >= 70) return "Média";
    return "Baixa";
  };

  return (
    <div className="space-y-6">
      {/* Importação de Taxonomia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Nova Estrutura de Categorias
          </CardTitle>
          <CardDescription>
            Importe a nova estrutura hierárquica de categorias e subcategorias baseada nos arquivos CSV fornecidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta ação irá atualizar as taxonomias do sistema com 11 categorias principais e 42 subcategorias organizadas hierarquicamente.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleImportTaxonomy}
              disabled={isImporting}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {isImporting ? 'Importando...' : 'Importar Taxonomia'}
            </Button>
          </div>

          {importResult && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Importação concluída!</strong><br />
                • {importResult.imported_categories} categorias importadas<br />
                • {importResult.imported_subcategories} subcategorias importadas
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Migração de Materiais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Migração de Materiais Existentes
          </CardTitle>
          <CardDescription>
            Analise e migre os materiais existentes para a nova estrutura de taxonomia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              O sistema analisará seus materiais existentes e sugerirá a melhor categoria/subcategoria na nova estrutura.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleGetMigrationSuggestions}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Analisar Materiais para Migração
          </Button>

          {showSuggestions && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Sugestões de Migração</h4>
                <Badge variant="secondary">
                  {migrationSuggestions.length} materiais
                </Badge>
              </div>

              {migrationSuggestions.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Todos os materiais já estão migrados para a nova taxonomia!
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {migrationSuggestions.slice(0, 20).map((suggestion, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium truncate">{suggestion.material_name}</h5>
                          <div className="text-sm text-muted-foreground mt-1">
                            <div className="flex items-center gap-2">
                              <span className="text-red-600">
                                {suggestion.current_category}
                                {suggestion.current_subcategory && ` → ${suggestion.current_subcategory}`}
                              </span>
                              <span>➔</span>
                              <span className="text-green-600">
                                {suggestion.suggested_category_name}
                                {suggestion.suggested_subcategory_name && ` → ${suggestion.suggested_subcategory_name}`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Badge 
                          className={getConfidenceColor(suggestion.confidence_score)}
                          variant="secondary"
                        >
                          {getConfidenceLabel(suggestion.confidence_score)} ({suggestion.confidence_score}%)
                        </Badge>
                      </div>
                    </Card>
                  ))}
                  
                  {migrationSuggestions.length > 20 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Mostrando apenas os primeiros 20 resultados. Total: {migrationSuggestions.length} materiais.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estrutura da Nova Taxonomia */}
      <Card>
        <CardHeader>
          <CardTitle>Estrutura da Nova Taxonomia</CardTitle>
          <CardDescription>
            Visualização das categorias e subcategorias que serão importadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-green-700">Insumo (INS)</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Panificados</li>
                <li>• Condimentos & Temperos</li>
                <li>• Hortifruti</li>
                <li>• Grãos & Cereais</li>
                <li>• Laticínios</li>
                <li>• Proteínas</li>
                <li>• Óleos & Gorduras</li>
                <li>• Açúcares & Adoçantes</li>
                <li>• Conservas & Enlatados</li>
                <li>• Líquidos Base</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-blue-700">Embalagem (EMB)</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Embalagens Primárias</li>
                <li>• Embalagens Secundárias</li>
                <li>• Materiais de Apresentação</li>
              </ul>
              
              <h4 className="font-medium text-purple-700 mt-4">Produto Intermediário (INT)</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Massas & Bases</li>
                <li>• Recheios & Coberturas</li>
                <li>• Caldas & Molhos</li>
                <li>• Bases de Bebidas</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-orange-700">Produto Acabado (FIN)</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Salgados</li>
                <li>• Doces</li>
                <li>• Bebidas</li>
                <li>• Padaria</li>
                <li>• Outros Acabados</li>
              </ul>
              
              <h4 className="font-medium text-red-700 mt-4">Outros</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Produto Composto (4 subcategorias)</li>
                <li>• Produto de Revenda (4 subcategorias)</li>
                <li>• Higiene e Limpeza (2 subcategorias)</li>
                <li>• Equipamentos (2 subcategorias)</li>
                <li>• Utensílios (2 subcategorias)</li>
                <li>• Têxteis & Apoios (2 subcategorias)</li>
                <li>• Infraestrutura & Eventos (3 subcategorias)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}