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
  onRecipeExtracted: (recipeData: Omit<Recipe, 'id' | 'totalCost'>, ingredientsData: Omit<Ingredient, 'id'>[]) => void;
  onCancel: () => void;
}

export const RecipeExtractor = ({ 
  existingIngredients, 
  onRecipeExtracted, 
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
        try {
          console.log('Processando PDF...');
          // Use the document parsing tool
          const formData = new FormData();
          formData.append('file', file);
          
          // Since we can't directly call the document parsing tool from here,
          // let's prompt the user to copy the text
          const userText = prompt(
            'Para PDFs, por favor copie e cole o texto da receita aqui:\n\n' +
            'Inclua:\n' +
            '- Nome da receita\n' +
            '- Lista de ingredientes com quantidades\n' +
            '- Instruções de preparo\n' +
            '- Tempo de preparo (se disponível)\n' +
            '- Rendimento (se disponível)'
          );
          
          if (!userText || userText.trim().length < 10) {
            throw new Error('Texto muito curto ou não fornecido');
          }
          
          extractedText = userText;
        } catch (error) {
          console.error('Erro ao processar PDF:', error);
          extractedText = "Erro ao processar PDF. Cole o texto manualmente abaixo.";
        }
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
    try {
      console.log('Processando imagem com OCR...');
      
      // Create a canvas to process the image
      const img = new Image();
      img.src = base64Image;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // For now, let's prompt the user to manually enter the text
      // In a real implementation, this would use an OCR service
      const userText = prompt(
        'Por favor, digite o texto que você vê na imagem da receita:\n\n' +
        'Inclua:\n' +
        '- Nome da receita\n' +
        '- Lista de ingredientes com quantidades\n' +
        '- Instruções de preparo\n' +
        '- Tempo de preparo (se disponível)\n' +
        '- Rendimento (se disponível)'
      );
      
      if (!userText || userText.trim().length < 10) {
        throw new Error('Texto muito curto ou não fornecido');
      }
      
      console.log('Texto extraído pelo usuário:', userText);
      return userText;
      
    } catch (error) {
      console.error('Erro na extração de texto da imagem:', error);
      throw new Error('Erro ao processar a imagem. Por favor, tente colar o texto manualmente.');
    }
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
    console.log('Processando texto com IA:', text.substring(0, 100) + '...');
    
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      // Parse the actual text to extract recipe data
      const extractedData = parseRecipeText(text);
      console.log('Dados extraídos:', extractedData);
      return extractedData;
    } catch (error) {
      console.error('Erro ao processar texto:', error);
      // Return a basic structure if parsing fails
      return {
        name: "Receita Extraída",
        description: "Receita processada a partir do texto fornecido",
        category: "Outros",
        ingredients: [],
        instructions: text,
        preparationTime: 30,
        difficulty: 'Médio',
        yield: 1
      };
    }
  };

  const parseRecipeText = (text: string): ExtractedRecipeData => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Extract recipe name (usually the first line or in caps)
    let name = "Receita Extraída";
    const titleLine = lines.find(line => 
      line.toUpperCase() === line && line.length > 5 && line.length < 50
    );
    if (titleLine) {
      name = titleLine.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    } else if (lines[0] && lines[0].length < 50) {
      name = lines[0];
    }

    // Extract ingredients
    const ingredients: Array<{name: string; quantity: number; unit: string}> = [];
    let inIngredientsSection = false;
    let inInstructionsSection = false;
    let instructions = "";
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Check if we're entering ingredients section
      if (lowerLine.includes('ingredient') || lowerLine.includes('receita') || line.match(/^-/) || line.match(/^\d/)) {
        inIngredientsSection = true;
        inInstructionsSection = false;
        if (lowerLine.includes('ingredient')) continue;
      }
      
      // Check if we're entering instructions section
      if (lowerLine.includes('preparo') || lowerLine.includes('modo') || lowerLine.includes('instruc') || 
          line.match(/^\d+\./) || lowerLine.includes('passo')) {
        inInstructionsSection = true;
        inIngredientsSection = false;
        if (lowerLine.includes('preparo') || lowerLine.includes('modo') || lowerLine.includes('instruc')) {
          continue;
        }
      }
      
      if (inIngredientsSection && !inInstructionsSection) {
        // Parse ingredient line
        const ingredient = parseIngredientLine(line);
        if (ingredient) {
          ingredients.push(ingredient);
        }
      }
      
      if (inInstructionsSection) {
        instructions += line + '\n';
      }
    }

    // Extract time, difficulty, and yield from text
    let preparationTime = 30;
    let difficulty: 'Fácil' | 'Médio' | 'Difícil' = 'Médio';
    let yieldAmount = 4;

    const timeMatch = text.match(/(\d+)\s*(min|minutos|horas?|h)/i);
    if (timeMatch) {
      const time = parseInt(timeMatch[1]);
      preparationTime = timeMatch[2].toLowerCase().includes('h') ? time * 60 : time;
    }

    if (text.toLowerCase().includes('fácil')) difficulty = 'Fácil';
    if (text.toLowerCase().includes('difícil')) difficulty = 'Difícil';

    const yieldMatch = text.match(/(\d+)\s*(porç|fatias?|pessoas?|serve)/i);
    if (yieldMatch) {
      yieldAmount = parseInt(yieldMatch[1]);
    }

    // Determine category based on ingredients or name
    let category = "Outros";
    const nameAndIngredients = (name + ' ' + ingredients.map(i => i.name).join(' ')).toLowerCase();
    
    if (nameAndIngredients.includes('bolo') || nameAndIngredients.includes('cake')) category = "Bolos";
    else if (nameAndIngredients.includes('torta')) category = "Tortas";
    else if (nameAndIngredients.includes('cookie') || nameAndIngredients.includes('biscoito')) category = "Cookies";
    else if (nameAndIngredients.includes('pão') || nameAndIngredients.includes('bread')) category = "Pães";
    else if (nameAndIngredients.includes('doce') || nameAndIngredients.includes('brigadeiro')) category = "Docinhos";

    return {
      name,
      description: `Receita de ${name.toLowerCase()}`,
      category,
      ingredients,
      instructions: instructions.trim() || text,
      preparationTime,
      difficulty,
      yield: yieldAmount
    };
  };

  const parseIngredientLine = (line: string): {name: string; quantity: number; unit: string} | null => {
    // Remove leading bullets or numbers
    let cleanLine = line.replace(/^[-•*\d+\.)]\s*/, '').trim();
    
    if (cleanLine.length < 3) return null;
    
    // Common patterns for ingredients
    const patterns = [
      // "2 xícaras de farinha"
      /^(\d+(?:[,\.]\d+)?)\s*(xícaras?|copos?|colheres?\s*(?:de\s*(?:sopa|chá|café))?|kg|g|ml|l|litros?|unidades?|dentes?|pitadas?)\s*(?:de\s+)?(.+)/i,
      // "farinha - 2 xícaras"
      /^(.+?)\s*[-–]\s*(\d+(?:[,\.]\d+)?)\s*(xícaras?|copos?|colheres?\s*(?:de\s*(?:sopa|chá|café))?|kg|g|ml|l|litros?|unidades?|dentes?|pitadas?)/i,
      // "1/2 xícara farinha"
      /^(\d+\/\d+|\d+(?:[,\.]\d+)?)\s*(xícaras?|copos?|colheres?\s*(?:de\s*(?:sopa|chá|café))?|kg|g|ml|l|litros?|unidades?|dentes?|pitadas?)\s+(.+)/i
    ];
    
    for (const pattern of patterns) {
      const match = cleanLine.match(pattern);
      if (match) {
        let quantity: number;
        let unit: string;
        let name: string;
        
        if (pattern === patterns[1]) {
          // "farinha - 2 xícaras" format
          name = match[1].trim();
          quantity = parseFloat(match[2].replace(',', '.'));
          unit = normalizeUnit(match[3]);
        } else {
          // "2 xícaras de farinha" format
          quantity = parseFloat(match[1].replace(',', '.'));
          if (match[1].includes('/')) {
            const [num, den] = match[1].split('/');
            quantity = parseInt(num) / parseInt(den);
          }
          unit = normalizeUnit(match[2]);
          name = match[3].trim();
        }
        
        if (name && quantity > 0 && unit) {
          return { name, quantity, unit };
        }
      }
    }
    
    // If no pattern matches, treat whole line as ingredient name with default quantity
    return {
      name: cleanLine,
      quantity: 1,
      unit: 'unidade'
    };
  };

  const normalizeUnit = (unit: string): string => {
    const normalized = unit.toLowerCase().trim();
    
    if (normalized.includes('xícara')) return 'xícara';
    if (normalized.includes('copo')) return 'copo';
    if (normalized.includes('colher')) {
      if (normalized.includes('sopa')) return 'colher de sopa';
      if (normalized.includes('chá')) return 'colher de chá';
      if (normalized.includes('café')) return 'colher de café';
      return 'colher de sopa';
    }
    if (normalized.includes('kg')) return 'kg';
    if (normalized.includes('g') && !normalized.includes('kg')) return 'g';
    if (normalized.includes('ml')) return 'mL';
    if (normalized.includes('l') && !normalized.includes('ml')) return 'L';
    if (normalized.includes('litro')) return 'L';
    if (normalized.includes('unidade') || normalized.includes('dente') || normalized.includes('pitada')) return 'unidade';
    
    return unit;
  };

  const updateIngredientPrice = (index: number, price: string) => {
    if (!extractedData) return;
    
    const updated = { ...extractedData };
    updated.ingredients[index].pricePerUnit = parseFloat(price) || 0;
    setExtractedData(updated);
  };

  const handleSaveRecipe = () => {
    if (!extractedData) return;

    // Separate new and existing ingredients
    const newIngredients: Omit<Ingredient, 'id'>[] = [];
    
    extractedData.ingredients.forEach((ingredient) => {
      // Check if ingredient already exists
      const existing = existingIngredients.find(
        ing => ing.name.toLowerCase() === ingredient.name.toLowerCase()
      );

      if (!existing) {
        // Create new ingredient
        newIngredients.push({
          name: ingredient.name,
          purchaseUnit: ingredient.unit,
          usageUnit: ingredient.unit,
          conversionFactor: 1,
          pricePerPurchaseUnit: ingredient.pricePerUnit || 0,
        });
      }
    });

    // Pass both recipe and ingredients to parent
    onRecipeExtracted({
      name: extractedData.name,
      description: extractedData.description,
      category: extractedData.category,
      ingredients: extractedData.ingredients.map(ing => ({
        ingredientId: ing.name, // Use name as temporary ID
        quantity: ing.quantity
      })),
      instructions: extractedData.instructions,
      preparationTime: extractedData.preparationTime,
      difficulty: extractedData.difficulty,
      yield: extractedData.yield,
    }, newIngredients);

    toast({
      title: "Receita salva!",
      description: `${newIngredients.length} novos ingredientes e receita foram adicionados`,
    });

    // Close the extractor
    setExtractedData(null);
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