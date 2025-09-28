import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Palette, RotateCcw } from "lucide-react";
import { useConfig } from "@/hooks/useConfig";
import { useState, useEffect } from "react";

interface ConfigColorsProps {
  namespace: string;
}

export const ConfigColors = ({ namespace }: ConfigColorsProps) => {
  const { getConfigValue, setConfigValue, loading } = useConfig();
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const defaultColors = {
    "Insumo": "#7C8C65",
    "Embalagem": "#8B7355", 
    "Produto Acabado": "#6B73A0",
    "Produto Intermediário": "#A0826B",
    "Produto Composto": "#8A6BA0",
    "Produto de Revenda": "#6BA08A"
  };

  useEffect(() => {
    if (!loading) {
      const colors = getConfigValue(namespace, 'cores_categoria') || defaultColors;
      setColorMap(colors);
    }
  }, [loading, getConfigValue, namespace]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setConfigValue(namespace, 'cores_categoria', colorMap);
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = (category: string, color: string) => {
    setColorMap(prev => ({ ...prev, [category]: color }));
  };

  const resetToDefaults = () => {
    setColorMap(defaultColors);
  };

  // Gerar variações de cor para subcategorias
  const generateColorVariations = (baseColor: string, count: number = 3) => {
    const variations = [];
    for (let i = 0; i < count; i++) {
      // Criar variações ajustando saturação e luminosidade
      const lightness = 40 + (i * 15); // 40%, 55%, 70%
      variations.push(`hsl(${baseColor}, 60%, ${lightness}%)`);
    }
    return variations;
  };

  const hexToHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return `${Math.round(h * 360)}`;
  };

  if (loading) {
    return <div className="animate-pulse">Carregando configurações de cores...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Cores das Categorias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(colorMap).map(([category, color]) => (
              <div key={category} className="space-y-2">
                <Label htmlFor={category}>{category}</Label>
                <div className="flex gap-2">
                  <Input
                    id={category}
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange(category, e.target.value)}
                    className="w-16 h-10"
                  />
                  <div className="flex-1">
                    <Input
                      value={color}
                      onChange={(e) => handleColorChange(category, e.target.value)}
                      placeholder="#000000"
                      className="font-mono"
                    />
                  </div>
                  <Badge 
                    style={{ backgroundColor: color, color: 'white' }}
                    className="px-3 py-1 text-xs"
                  >
                    {category}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Cores'}
            </Button>
            <Button variant="outline" onClick={resetToDefaults}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Padrões
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview das Cores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-3">Como ficará na interface:</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(colorMap).map(([category, color]) => (
                  <Badge 
                    key={category}
                    style={{ backgroundColor: color, color: 'white' }}
                    className="px-3 py-1"
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Variações para subcategorias:</h4>
              <div className="max-h-96 overflow-y-auto space-y-3">
                {Object.entries(colorMap).map(([category, color]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium w-40 flex-shrink-0">{category}:</span>
                      <div className="flex gap-1 flex-wrap">
                        {generateColorVariations(hexToHsl(color)).map((variation, index) => (
                          <div className="flex flex-col items-center gap-1">
                            <div
                              key={index}
                              className="w-12 h-8 rounded border shadow-sm"
                              style={{ backgroundColor: variation }}
                              title={variation}
                            />
                            <span className="text-xs text-muted-foreground font-mono">
                              {index === 0 ? 'Escuro' : index === 1 ? 'Médio' : 'Claro'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};