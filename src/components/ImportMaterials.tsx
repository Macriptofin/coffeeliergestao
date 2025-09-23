import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileSpreadsheet, CheckCircle } from 'lucide-react';

interface MaterialData {
  codigo: string;
  material: string;
  categoria: string;
  subcategoria: string;
  unidadeCompra: string;
  unidadeUso: string;
  fatorConversao: number;
}

interface ImportMaterialsProps {
  onRefresh?: () => void;
}

export const ImportMaterials: React.FC<ImportMaterialsProps> = ({ onRefresh }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });

  const parseCSV = (text: string): MaterialData[] => {
    const lines = text.split('\n');
    const materials: MaterialData[] = [];

    // Skip header lines (first 2 lines)
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.split(',');
      if (columns.length < 13) continue;

      const codigo = columns[0]?.replace(/"/g, '').trim();
      const status = columns[1]?.replace(/"/g, '').trim();
      const material = columns[2]?.replace(/"/g, '').trim();
      const categoria = columns[4]?.replace(/"/g, '').trim();
      const subcategoria = columns[5]?.replace(/"/g, '').trim();
      const unidadeCompra = columns[6]?.replace(/"/g, '').trim();
      const unidadeUso = columns[9]?.replace(/"/g, '').trim();
      const fatorConversaoStr = columns[12]?.replace(/"/g, '').replace(',', '.').trim();

      // Skip if not active or missing required data
      if (status !== 'Ativo' || !material || !unidadeCompra || !unidadeUso) continue;

      const fatorConversao = parseFloat(fatorConversaoStr) || 1;

      materials.push({
        codigo,
        material,
        categoria,
        subcategoria,
        unidadeCompra,
        unidadeUso,
        fatorConversao
      });
    }

    return materials;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
    } else {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo CSV válido.",
        variant: "destructive"
      });
    }
  };

  const importMaterials = async () => {
    if (!file) return;

    setIsImporting(true);
    setProgress({ processed: 0, total: 0 });

    try {
      const text = await file.text();
      const materials = parseCSV(text);
      
      setProgress({ processed: 0, total: materials.length });

      let processedCount = 0;
      const batchSize = 10;

      for (let i = 0; i < materials.length; i += batchSize) {
        const batch = materials.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (material) => {
            try {
              // Check if ingredient already exists
              const { data: existing } = await supabase
                .from('ingredients')
                .select('id')
                .eq('name', material.material)
                .maybeSingle();

              if (!existing) {
                // Create new ingredient
                await supabase
                  .from('ingredients')
                  .insert({
                    name: material.material,
                    usage_unit: material.unidadeUso,
                    purchase_unit: material.unidadeCompra,
                    conversion_factor: material.fatorConversao,
                    price_per_purchase_unit: 0, // Default price, can be updated later
                    supplier: `${material.categoria} - ${material.subcategoria}`
                  });
              }
            } catch (error) {
              console.error(`Erro ao importar material ${material.material}:`, error);
            }
          })
        );

        processedCount += batch.length;
        setProgress({ processed: processedCount, total: materials.length });
      }

      toast({
        title: "Importação concluída!",
        description: `${processedCount} materiais foram processados com sucesso.`,
      });

      onRefresh?.();
      setFile(null);
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: "Erro na importação",
        description: "Ocorreu um erro ao processar o arquivo. Verifique o formato e tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      setProgress({ processed: 0, total: 0 });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar Cadastro de Materiais
        </CardTitle>
        <CardDescription>
          Importe o cadastro completo de materiais com unidades e fatores de conversão
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="materials-file">Arquivo CSV de Materiais</Label>
          <Input
            id="materials-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isImporting}
          />
          {file && (
            <p className="text-sm text-muted-foreground">
              Arquivo selecionado: {file.name}
            </p>
          )}
        </div>

        {isImporting && progress.total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progresso da importação</span>
              <span>{progress.processed} / {progress.total}</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.processed / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <Button 
          onClick={importMaterials}
          disabled={!file || isImporting}
          className="w-full"
        >
          {isImporting ? (
            <>
              <Upload className="mr-2 h-4 w-4 animate-spin" />
              Importando materiais...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Importar Materiais
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Formato esperado:</strong> CSV com cadastro completo de materiais</p>
          <p><strong>Colunas necessárias:</strong> Material, Unidade de Compra, Unidade de Uso, Fator de Conversão</p>
          <p><strong>Nota:</strong> Apenas materiais com status "Ativo" serão importados</p>
        </div>
      </CardContent>
    </Card>
  );
};