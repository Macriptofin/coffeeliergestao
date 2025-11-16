import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Database, FileText, Loader2, Upload } from "lucide-react";
import Papa from "papaparse";

interface CSVMaterial {
  id: string;
  code: string;
  name: string;
  material_type_NOVO: string;
  category_NOVO: string;
  subcategory_NOVO: string;
}

interface MigrationStats {
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
}

export function MaterialsMigration() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<MigrationStats>({
    total: 0,
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  });
  const [changes, setChanges] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const loadCSV = async (): Promise<CSVMaterial[]> => {
    const response = await fetch("/data/PRODUTOS_LIMPOS.csv");
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const materials = results.data as CSVMaterial[];
          resolve(materials.filter(m => m.id && m.id.trim() !== ''));
        },
        error: (error) => reject(error),
      });
    });
  };

  const analyzeChanges = async () => {
    setIsAnalyzing(true);
    setShowPreview(false);
    
    try {
      toast.loading("Analisando alterações...");

      // Carregar CSV
      const csvMaterials = await loadCSV();
      
      // Buscar materiais atuais do banco
      const { data: dbMaterials, error } = await supabase
        .from("materials")
        .select("id, code, name, material_type, category, subcategory")
        .in("id", csvMaterials.map(m => m.id));

      if (error) throw error;

      // Comparar e identificar mudanças
      const detectedChanges = [];
      for (const csvMat of csvMaterials) {
        const dbMat = dbMaterials?.find(m => m.id === csvMat.id);
        
        if (!dbMat) {
          detectedChanges.push({
            id: csvMat.id,
            code: csvMat.code,
            name: csvMat.name,
            status: "not_found",
            message: "Material não encontrado no banco"
          });
          continue;
        }

        const hasChanges = 
          dbMat.material_type !== csvMat.material_type_NOVO ||
          dbMat.category !== csvMat.category_NOVO ||
          dbMat.subcategory !== csvMat.subcategory_NOVO;

        if (hasChanges) {
          detectedChanges.push({
            id: csvMat.id,
            code: csvMat.code,
            name: csvMat.name,
            status: "will_update",
            old: {
              material_type: dbMat.material_type,
              category: dbMat.category,
              subcategory: dbMat.subcategory,
            },
            new: {
              material_type: csvMat.material_type_NOVO,
              category: csvMat.category_NOVO,
              subcategory: csvMat.subcategory_NOVO,
            }
          });
        }
      }

      setChanges(detectedChanges);
      setStats({
        total: csvMaterials.length,
        processed: 0,
        updated: detectedChanges.filter(c => c.status === "will_update").length,
        skipped: csvMaterials.length - detectedChanges.filter(c => c.status === "will_update").length,
        errors: detectedChanges.filter(c => c.status === "not_found").length,
      });
      setShowPreview(true);

      toast.dismiss();
      toast.success(`Análise completa: ${detectedChanges.filter(c => c.status === "will_update").length} materiais serão atualizados`);

    } catch (error) {
      console.error("Erro ao analisar:", error);
      toast.dismiss();
      toast.error("Erro ao analisar alterações");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const executeMigration = async () => {
    if (!window.confirm("Confirma a migração de todos os materiais? Esta ação irá atualizar o banco de dados.")) {
      return;
    }

    setIsMigrating(true);
    setProgress(0);
    
    const toastId = toast.loading("Iniciando migração...");

    try {
      const csvMaterials = await loadCSV();
      const materialsToUpdate = changes.filter(c => c.status === "will_update");
      
      let processed = 0;
      let updated = 0;
      let errors = 0;

      // Atualizar em lotes de 10
      const batchSize = 10;
      for (let i = 0; i < materialsToUpdate.length; i += batchSize) {
        const batch = materialsToUpdate.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (change) => {
            const csvMat = csvMaterials.find(m => m.id === change.id);
            if (!csvMat) return;

            const { error } = await supabase
              .from("materials")
              .update({
                material_type: csvMat.material_type_NOVO || null,
                category: csvMat.category_NOVO || null,
                subcategory: csvMat.subcategory_NOVO || null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", change.id);

            if (error) {
              console.error(`Erro ao atualizar ${change.code}:`, error);
              errors++;
            } else {
              updated++;
            }
            
            processed++;
            const progressPercent = Math.round((processed / materialsToUpdate.length) * 100);
            setProgress(progressPercent);
            
            setStats(prev => ({
              ...prev,
              processed,
              updated,
              errors,
            }));
          })
        );

        // Pequeno delay entre lotes
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast.dismiss(toastId);
      
      if (errors > 0) {
        toast.warning(`Migração concluída com ${errors} erros. ${updated} materiais atualizados.`);
      } else {
        toast.success(`✅ Migração completa! ${updated} materiais atualizados com sucesso.`);
      }

      // Limpar preview após sucesso
      setShowPreview(false);
      setChanges([]);

    } catch (error) {
      console.error("Erro na migração:", error);
      toast.dismiss(toastId);
      toast.error("Erro ao executar migração");
    } finally {
      setIsMigrating(false);
      setProgress(0);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Migração Automática de Materiais
        </CardTitle>
        <CardDescription>
          Atualize automaticamente as categorias e tipos de todos os materiais baseado no arquivo PRODUTOS_LIMPOS.csv
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status do CSV */}
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <strong>Arquivo fonte:</strong> /public/data/PRODUTOS_LIMPOS.csv
            <br />
            <span className="text-muted-foreground text-sm">
              Contém 151 produtos com categorias e subcategorias atualizadas
            </span>
          </AlertDescription>
        </Alert>

        {/* Botões de ação */}
        <div className="flex gap-3">
          <Button
            onClick={analyzeChanges}
            disabled={isAnalyzing || isMigrating}
            variant="outline"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Analisar Alterações
              </>
            )}
          </Button>

          {showPreview && changes.length > 0 && (
            <Button
              onClick={executeMigration}
              disabled={isMigrating}
              size="lg"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Migrando... {progress}%
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Migrar Todos Automaticamente
                </>
              )}
            </Button>
          )}
        </div>

        {/* Barra de progresso */}
        {isMigrating && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-center">
              {stats.processed} de {changes.filter(c => c.status === "will_update").length} materiais processados
            </p>
          </div>
        )}

        {/* Estatísticas */}
        {showPreview && (
          <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.updated}</div>
              <div className="text-sm text-muted-foreground">Atualizarão</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.skipped}</div>
              <div className="text-sm text-muted-foreground">Sem mudanças</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
              <div className="text-sm text-muted-foreground">Erros</div>
            </div>
          </div>
        )}

        {/* Preview das mudanças */}
        {showPreview && changes.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Preview das Alterações (primeiros 10):</h3>
            <div className="max-h-80 overflow-y-auto space-y-2 border rounded-lg p-3">
              {changes.filter(c => c.status === "will_update").slice(0, 10).map((change) => (
                <div key={change.id} className="p-3 bg-card border rounded text-sm">
                  <div className="font-medium text-primary">{change.code} - {change.name}</div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div className="text-muted-foreground">
                      <div>Tipo: {change.old.material_type || "—"}</div>
                      <div>Categoria: {change.old.category || "—"}</div>
                      <div>Subcategoria: {change.old.subcategory || "—"}</div>
                    </div>
                    <div className="text-green-600">
                      <div>→ {change.new.material_type || "—"}</div>
                      <div>→ {change.new.category || "—"}</div>
                      <div>→ {change.new.subcategory || "—"}</div>
                    </div>
                  </div>
                </div>
              ))}
              {changes.filter(c => c.status === "will_update").length > 10 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  ... e mais {changes.filter(c => c.status === "will_update").length - 10} materiais
                </p>
              )}
            </div>
          </div>
        )}

        {/* Avisos */}
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> Esta operação irá atualizar diretamente o banco de dados.
            Certifique-se de revisar as alterações antes de executar a migração.
          </AlertDescription>
        </Alert>

        {stats.updated > 0 && !isMigrating && !showPreview && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <strong>Migração concluída!</strong> {stats.updated} materiais foram atualizados com sucesso.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
