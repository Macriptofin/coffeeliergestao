import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Camera, FileText, Sparkles, Loader2, X, Check } from "lucide-react";
import type { Ingredient, Recipe } from "@/pages/Index";

interface ExtractedRecipeData {
  name: string;
  description: string;
  category: string;
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    pricePerUnit?: number;
  }>;
  instructions: string;
  preparationTime: number;
  difficulty: 'Fácil' | 'Médio' | 'Difícil';
  yield: number;
}

interface RecipeExtractorProps {
  existingIngredients: Ingredient[];
  onRecipeExtracted: (recipeData: Omit<Recipe, 'id' | 'totalCost'>) => void;
  onIngredientsExtracted: (ingredients: Omit<Ingredient, 'id'>[]) => void;
  onCancel: () => void;
}

export const RecipeExtractor = ({ 
  existingIngredients, 
  onRecipeExtracted, 
  onIngredientsExtracted,
  onCancel 
}: RecipeExtractorProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedRecipeData | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [editingIngredients, setEditingIngredients] = useState<boolean>(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    
    // Check file type
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';
    
    if (!isImage && !isPDF) {
      toast({
        title: "Formato não suportado",
        description: "Por favor, envie uma imagem (JPG, PNG) ou arquivo PDF",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      let extractedText = '';
      
      if (isPDF) {
        // For PDFs, we would need to parse the document
        // This is a simplified approach - in real implementation, use document parsing
        extractedText = "PDF parsing não implementado nesta demo. Cole o texto manualmente abaixo.";
      } else {
        // For images, we'll use AI vision to extract text
        const base64 = await fileToBase64(file);
        extractedText = await extractTextFromImage(base64);
      }
      
      setRawText(extractedText);
      
      if (extractedText.length > 50) {
        await processExtractedText(extractedText);
      }
      
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: "Erro no processamento",
        description: "Erro ao processar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const extractTextFromImage = async (base64Image: string): Promise<string> => {
    // This would integrate with an OCR service or AI vision API
    // For now, return a placeholder
    return `
    BOLO DE CHOCOLATE CREMOSO
    
    Ingredientes:
    - 2 xícaras de farinha de trigo
    - 1 xícara de açúcar
    - 1/2 xícara de cacau em pó
    - 3 ovos
    - 1 xícara de leite
    - 1/2 xícara de óleo
    - 1 colher de sopa de fermento em pó
    
    Modo de preparo:
    1. Misture os ingredientes secos
    2. Adicione os líquidos
    3. Bata bem a massa
    4. Asse por 40 minutos a 180°C
    
    Tempo: 60 minutos
    Rendimento: 8 fatias
    Dificuldade: Fácil
    `;
  };

  const processExtractedText = async (text: string) => {
    setIsProcessing(true);
    
    try {
      // Simulate AI processing - in real implementation, this would call an AI service
      const aiResponse = await simulateAIExtraction(text);
      setExtractedData(aiResponse);
      
      toast({
        title: "Receita extraída com sucesso!",
        description: "Revise os dados antes de salvar",
      });
      
    } catch (error) {
      console.error('Error processing text:', error);
      toast({
        title: "Erro na extração",
        description: "Erro ao processar o texto com AI. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const simulateAIExtraction = async (text: string): Promise<ExtractedRecipeData> => {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // This would be replaced with actual AI service call
    return {
      name: "Bolo de Chocolate Cremoso",
      description: "Um delicioso bolo de chocolate com textura cremosa e sabor intenso",
      category: "Bolos",
      ingredients: [
        { name: "Farinha de trigo", quantity: 2, unit: "xícara" },
        { name: "Açúcar cristal", quantity: 1, unit: "xícara" },
        { name: "Cacau em pó", quantity: 0.5, unit: "xícara" },
        { name: "Ovos", quantity: 3, unit: "unidade" },
        { name: "Leite integral", quantity: 1, unit: "xícara" },
        { name: "Óleo vegetal", quantity: 0.5, unit: "xícara" },
        { name: "Fermento em pó", quantity: 1, unit: "colher de sopa" }
      ],
      instructions: `1. Pré-aqueça o forno a 180°C e unte uma forma redonda.
2. Em uma tigela, misture todos os ingredientes secos: farinha, açúcar, cacau e fermento.
3. Em outra tigela, bata os ovos e adicione o leite e o óleo.
4. Misture os ingredientes líquidos aos secos, mexendo até obter uma massa homogênea.
5. Despeje a massa na forma untada.
6. Asse por 40-45 minutos ou até que um palito inserido saia limpo.
7. Deixe esfriar antes de desenformar.`,
      preparationTime: 60,
      difficulty: 'Fácil',
      yield: 8
    };
  };

  const updateIngredientPrice = (index: number, price: string) => {
    if (!extractedData) return;
    
    const updated = { ...extractedData };
    updated.ingredients[index].pricePerUnit = parseFloat(price) || 0;
    setExtractedData(updated);
  };

  const handleSaveRecipe = () => {
    if (!extractedData) return;

    // First, save new ingredients
    const newIngredients: Omit<Ingredient, 'id'>[] = [];
    const recipeIngredients: Array<{ ingredientId: string; quantity: number }> = [];

    extractedData.ingredients.forEach((ingredient) => {
      // Check if ingredient already exists
      const existing = existingIngredients.find(
        ing => ing.name.toLowerCase() === ingredient.name.toLowerCase()
      );

      if (existing) {
        // Use existing ingredient
        recipeIngredients.push({
          ingredientId: existing.id,
          quantity: ingredient.quantity
        });
      } else {
        // Create new ingredient
        const newId = `extracted_${Date.now()}_${Math.random()}`;
        newIngredients.push({
          name: ingredient.name,
          unit: ingredient.unit,
          pricePerUnit: ingredient.pricePerUnit || 0,
        });
        
        recipeIngredients.push({
          ingredientId: newId,
          quantity: ingredient.quantity
        });
      }
    });

    // Save ingredients first
    if (newIngredients.length > 0) {
      onIngredientsExtracted(newIngredients);
    }

    // Save recipe
    onRecipeExtracted({
      name: extractedData.name,
      description: extractedData.description,
      category: extractedData.category,
      ingredients: recipeIngredients,
      instructions: extractedData.instructions,
      preparationTime: extractedData.preparationTime,
      difficulty: extractedData.difficulty,
      yield: extractedData.yield,
    });

    toast({
      title: "Receita salva!",
      description: `${newIngredients.length} novos ingredientes e receita foram adicionados`,
    });
  };

  return (
    <Card className="shadow-elegant border-purple-200">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-purple-600 flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Extrair Receita com AI
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {!extractedData && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Upload de Receita</Label>
              <div className="flex gap-2">
                <Input
                  id="file-upload"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={isProcessing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isProcessing ? 'Processando...' : 'Selecionar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Aceita: JPG, PNG, PDF • Máx: 20MB
              </p>
            </div>

            {uploadedFile && (
              <div className="p-3 bg-accent rounded-lg">
                <div className="flex items-center gap-2">
                  {uploadedFile.type.startsWith('image/') ? (
                    <Camera className="h-4 w-4 text-primary" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-sm font-medium">{uploadedFile.name}</span>
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="flex items-center gap-2 p-4 bg-purple-50 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                <span className="text-sm text-purple-700">
                  Processando com AI... Extraindo ingredientes e instruções
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="manual-text">Ou cole o texto da receita manualmente:</Label>
              <Textarea
                id="manual-text"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Cole aqui o texto completo da receita..."
                rows={6}
                disabled={isProcessing}
              />
              {rawText.length > 50 && (
                <Button 
                  onClick={() => processExtractedText(rawText)}
                  disabled={isProcessing}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Processar com AI
                </Button>
              )}
            </div>
          </div>
        )}

        {extractedData && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700 font-medium">
                Receita extraída com sucesso! Revise os dados:
              </span>
            </div>

            {/* Recipe Info */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Nome da Receita</Label>
                <Input
                  value={extractedData.name}
                  onChange={(e) => setExtractedData({...extractedData, name: e.target.value})}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Categoria</Label>
                  <Input
                    value={extractedData.category}
                    onChange={(e) => setExtractedData({...extractedData, category: e.target.value})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Dificuldade</Label>
                  <Input
                    value={extractedData.difficulty}
                    onChange={(e) => setExtractedData({...extractedData, difficulty: e.target.value as any})}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Ingredients */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Ingredientes Extraídos</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingIngredients(!editingIngredients)}
                >
                  {editingIngredients ? 'Finalizar Edição' : 'Editar Preços'}
                </Button>
              </div>
              
              <div className="space-y-2">
                {extractedData.ingredients.map((ingredient, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{ingredient.name}</span>
                      <Badge variant="outline">
                        {ingredient.quantity} {ingredient.unit}
                      </Badge>
                    </div>
                    {editingIngredients && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={ingredient.pricePerUnit || ''}
                          onChange={(e) => updateIngredientPrice(index, e.target.value)}
                          className="w-20 h-8"
                        />
                        <span className="text-xs text-muted-foreground">/{ingredient.unit}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions Preview */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Modo de Preparo</Label>
              <div className="p-3 bg-accent rounded-lg max-h-32 overflow-y-auto">
                <p className="text-sm whitespace-pre-wrap">{extractedData.instructions}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={handleSaveRecipe}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Salvar Receita
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setExtractedData(null)}
              >
                Tentar Novamente
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};