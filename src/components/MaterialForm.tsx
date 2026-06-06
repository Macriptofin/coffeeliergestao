import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Textarea } from "@/components/ui/textarea";
import { X, AlertTriangle, Package, Tag, Layers, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Material } from "@/types";
import { useTaxonomy } from "@/hooks/useConfig";
import { HelpTooltip } from "@/components/ui/help-tooltip";

interface MaterialFormProps {
  material?: Material | null;
  existingMaterials: Material[];
  onSubmit: (material: Omit<Material, 'id' | 'code'>) => void;
  onCancel: () => void;
}

export const MaterialForm = ({ material, existingMaterials, onSubmit, onCancel }: MaterialFormProps) => {
  const { loading: taxonomyLoading, getTermsByTaxonomy } = useTaxonomy();

  const materialTypesFromTaxonomy = getTermsByTaxonomy('material_type').filter(term => term.is_active);
  const allCategories = getTermsByTaxonomy('material_category').filter(term => term.is_active);
  const allSubcategories = getTermsByTaxonomy('material_subcategory').filter(term => term.is_active);

  const getInitialTypeTermId = () => {
    if (!material) return '';
    if (material.typeTermId) return material.typeTermId;
    const map: Record<string, string> = {
      'ingredient': 'd2498815-bbd6-4f94-957b-d134c8823d32',
      'packaging': '8c31df83-585c-4412-b6a0-bd0be8eee94a',
      'finished_product': 'e263616d-2bc2-47b7-992b-1813621c4479',
      'intermediate_product': '6131ef24-9980-4cf1-98be-74a7b8643790',
      'composite_product': 'f0255968-b549-4cd4-b645-8a828ed00bca',
    };
    return map[material.materialType] || '';
  };

  const [formData, setFormData] = useState({
    // Classificação
    typeTermId: getInitialTypeTermId(),
    category: material?.category || '',
    subcategory: material?.subcategory || '',
    // Identificação
    name: material?.name || '',
    description: material?.description || '',
    allowedBrands: material?.allowedBrands?.join(', ') || '',
    // Unidades & Medidas
    purchaseUnit: material?.purchaseUnit || '',
    usageUnit: material?.usageUnit || '',
    conversionFactor: material?.conversionFactor?.toString() || '',
    pricePerPurchaseUnit: material?.pricePerPurchaseUnit?.toString() || '0',
    unitWeight: material?.unitWeight?.toString() || '',
    // Fiscal
    ncm: material?.ncm || '',
    cfop: material?.cfop || '',
    cst: material?.cst || '',
    origem: material?.origem?.toString() || '0',
  });

  const [duplicateError, setDuplicateError] = useState('');
  const originalName = material?.name || '';

  const units = [
    'kg', 'g', 'L', 'mL', 'unidade', 'pacote', 'caixa', 'lata', 'saco', 'envelope', 'dúzia', 'centena'
  ];

  const isWeightUnit = ['kg', 'g'].includes(formData.usageUnit);
  const needsUnitWeight = !isWeightUnit && formData.usageUnit;

  const selectedTypeTerm = materialTypesFromTaxonomy.find(t => t.id === formData.typeTermId);
  const availableCategories = formData.typeTermId
    ? allCategories.filter(cat => cat.parent_id === formData.typeTermId)
    : [];

  const selectedCategoryTerm = allCategories.find(cat => cat.name === formData.category);
  const availableSubcategories = selectedCategoryTerm
    ? allSubcategories.filter(sub => sub.parent_id === selectedCategoryTerm.id)
    : [];

  const getLegacyMaterialType = (typeTermId: string): Material['materialType'] => {
    const term = materialTypesFromTaxonomy.find(t => t.id === typeTermId);
    if (!term) return 'ingredient';
    const map: Record<string, Material['materialType']> = {
      'Insumo': 'ingredient',
      'Embalagem': 'packaging',
      'Produto Acabado': 'finished_product',
      'Produto Intermediário': 'intermediate_product',
      'Produto Composto': 'composite_product',
      'Produto de Revenda': 'finished_product',
      'Material de Limpeza': 'ingredient',
      'Material de Consumo': 'ingredient',
    };
    return map[term.name] || 'ingredient';
  };

  const handleTypeChange = (newTypeTermId: string) => {
    setFormData({ ...formData, typeTermId: newTypeTermId, category: '', subcategory: '' });
  };

  const handleCategoryChange = (newCategory: string) => {
    setFormData({ ...formData, category: newCategory, subcategory: '' });
  };

  const handleNameChange = (value: string) => {
    setFormData({ ...formData, name: value });
    if (duplicateError) setDuplicateError('');
  };

  const handleNameSelect = (selectedName: string) => {
    const existing = existingMaterials.find(mat =>
      mat.name.toLowerCase() === selectedName.toLowerCase()
    );
    if (existing && (!material || existing.id !== material.id) && selectedName.toLowerCase() !== originalName.toLowerCase()) {
      setDuplicateError(`Material "${selectedName}" já está cadastrado`);
    }
  };

  const isBOMProduct = material && ['intermediate_product', 'finished_product'].includes(material.materialType);

  // Tipo atualmente selecionado no formulário (pode diferir do material salvo ao trocar o tipo)
  const currentLegacyType = formData.typeTermId ? getLegacyMaterialType(formData.typeTermId) : (material?.materialType || 'ingredient');
  // Produto produzido = intermediário ou acabado. Não é comprado, portanto não tem
  // unidade de compra nem fator de conversão — esses campos são preenchidos automaticamente.
  const isProducedType = ['intermediate_product', 'finished_product'].includes(currentLegacyType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.typeTermId) {
      setDuplicateError('Selecione o Tipo de Material');
      return;
    }
    if (!formData.category) {
      setDuplicateError('Selecione a Categoria');
      return;
    }
    // Produtos produzidos não precisam de unidade de compra — é preenchida automaticamente
    if (isProducedType) {
      if (!formData.name || !formData.usageUnit) return;
    } else {
      if (!formData.name || !formData.purchaseUnit || !formData.usageUnit || !formData.conversionFactor) return;
    }

    if (formData.name.toLowerCase() !== originalName.toLowerCase()) {
      const duplicate = existingMaterials.find(mat =>
        mat.name.toLowerCase() === formData.name.toLowerCase() &&
        (!material || mat.id !== material.id)
      );
      if (duplicate) {
        setDuplicateError(`Já existe um material com o nome "${duplicate.name}"`);
        return;
      }
    }

    setDuplicateError('');

    const categoryTerm = allCategories.find(cat => cat.name === formData.category);
    const subcategoryTerm = formData.subcategory
      ? availableSubcategories.find(sub => sub.name === formData.subcategory)
      : undefined;

    // Para produtos produzidos, purchaseUnit = usageUnit e conversionFactor = 1
    const finalPurchaseUnit = isProducedType ? formData.usageUnit : formData.purchaseUnit;
    const finalConversionFactor = isProducedType ? 1 : parseFloat(formData.conversionFactor);
    // CMV de produtos produzidos vem da ficha técnica — preço manual não faz sentido
    const finalPrice = isProducedType ? 0 : (parseFloat(formData.pricePerPurchaseUnit) || 0);

    onSubmit({
      name: formData.name,
      description: formData.description || undefined,
      purchaseUnit: finalPurchaseUnit,
      usageUnit: formData.usageUnit,
      conversionFactor: finalConversionFactor,
      pricePerPurchaseUnit: finalPrice,
      allowedBrands: formData.allowedBrands
        ? formData.allowedBrands.split(',').map(b => b.trim()).filter(Boolean)
        : undefined,
      category: formData.category,
      subcategory: formData.subcategory || undefined,
      typeTermId: formData.typeTermId,
      categoryTermId: categoryTerm?.id,
      subcategoryTermId: subcategoryTerm?.id,
      materialType: getLegacyMaterialType(formData.typeTermId),
      unitWeight: formData.unitWeight ? parseFloat(formData.unitWeight) : undefined,
      // Fiscal
      ncm: formData.ncm || undefined,
      cfop: formData.cfop || undefined,
      cst: formData.cst || undefined,
      origem: formData.origem !== '' ? parseInt(formData.origem) : undefined,
    });
  };

  return (
    <Card className="shadow-elegant border-primary/20 w-full">
      <CardHeader className="pb-4 px-4 sm:px-6">
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-5 w-5 flex-shrink-0 text-primary" />
            <CardTitle className="text-primary truncate">
              {material ? 'Editar Material' : 'Novo Material'}
            </CardTitle>
            {material && (
              <Badge variant="outline" className="ml-2 flex-shrink-0">
                {material.code}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel} className="flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          {isBOMProduct && (
            <Alert className="border-primary/30 bg-primary/5">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <AlertDescription>
                <strong>Produto com BOM:</strong> Unidades e conversão são gerenciados pela ficha técnica.
              </AlertDescription>
            </Alert>
          )}

          {duplicateError && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{duplicateError}</AlertDescription>
            </Alert>
          )}

          {/* ── SEÇÃO 1: CLASSIFICAÇÃO ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <Layers className="h-4 w-4" />
              <span>Classificação</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tipo */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Tipo *
                  <HelpTooltip content="Tipo principal do material. Define as categorias disponíveis." />
                </Label>
                <Select value={formData.typeTermId} onValueChange={handleTypeChange} disabled={taxonomyLoading}>
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder={taxonomyLoading ? "Carregando..." : "Selecione o tipo"} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border shadow-lg z-50">
                    {materialTypesFromTaxonomy.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categoria */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Categoria *
                  <HelpTooltip content="Categoria dentro do tipo selecionado." />
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={handleCategoryChange}
                  disabled={taxonomyLoading || !formData.typeTermId || availableCategories.length === 0}
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder={
                      !formData.typeTermId ? "Selecione o tipo primeiro" :
                      availableCategories.length === 0 ? "Nenhuma categoria" :
                      "Selecione a categoria"
                    } />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border shadow-lg z-50">
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subcategoria */}
              <div className="space-y-2">
                <Label>Subcategoria</Label>
                <Select
                  value={formData.subcategory || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, subcategory: v === 'none' ? '' : v })}
                  disabled={taxonomyLoading || !formData.category || availableSubcategories.length === 0}
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder={
                      !formData.category ? "Selecione categoria primeiro" :
                      availableSubcategories.length === 0 ? "Nenhuma subcategoria" :
                      "Selecione (opcional)"
                    } />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border shadow-lg z-50">
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {availableSubcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.name}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* ── SEÇÃO 2: IDENTIFICAÇÃO ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <Tag className="h-4 w-4" />
              <span>Identificação</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome do Material *</Label>
              <AutocompleteInput
                id="name"
                value={formData.name}
                onChange={handleNameChange}
                onSelect={handleNameSelect}
                suggestions={existingMaterials.map(mat => mat.name)}
                placeholder="Ex: Farinha de trigo, Caixa de papelão"
                required
                originalValue={originalName}
                className={duplicateError ? "border-red-300 focus:border-red-500" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Características, especificações técnicas, qualidade..."
                className="min-h-16"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="allowedBrands">
                Marcas Permitidas
                <span className="text-muted-foreground font-normal ml-1 text-xs">(separar por vírgulas)</span>
              </Label>
              <Input
                id="allowedBrands"
                value={formData.allowedBrands}
                onChange={(e) => setFormData({ ...formData, allowedBrands: e.target.value })}
                placeholder="Ex: Fleischmann, Fermipan, Itaiquara"
              />
            </div>
          </div>

          <div className="border-t border-border" />

          {/* ── SEÇÃO 3: UNIDADES & MEDIDAS ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <Package className="h-4 w-4" />
              <span>Unidades & Medidas</span>
            </div>

            {isProducedType ? (
              /* ── Produto produzido: só unidade de uso/produção ── */
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      Unidade de Produção / Uso *
                      <HelpTooltip content="Unidade em que este produto é produzido e usado nas receitas (ex: unidade, porção, kg)." />
                    </Label>
                    <Select
                      value={formData.usageUnit}
                      onValueChange={(v) => setFormData({ ...formData, usageUnit: v })}
                    >
                      <SelectTrigger className="bg-card">
                        <SelectValue placeholder="Ex: unidade, porção, kg..." />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border shadow-lg z-50">
                        {units.map((unit) => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {needsUnitWeight && (
                    <div className="space-y-2">
                      <Label>
                        Peso por {formData.usageUnit} (gramas)
                        <HelpTooltip content="Peso em gramas de 1 unidade, para cálculos de receita." />
                      </Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.unitWeight}
                        onChange={(e) => setFormData({ ...formData, unitWeight: e.target.value })}
                        placeholder="Ex: 50"
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">
                  O custo deste produto é calculado automaticamente a partir da ficha técnica (BOM), com base nos preços médios ponderados dos insumos.
                </p>
              </div>
            ) : (
              /* ── Insumo / embalagem: unidade compra + uso + conversão ── */
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      Unidade de Compra *
                      <HelpTooltip content="Unidade na qual o material é adquirido (ex: kg, pacote, caixa)." />
                    </Label>
                    <Select
                      value={formData.purchaseUnit}
                      onValueChange={(v) => setFormData({ ...formData, purchaseUnit: v })}
                    >
                      <SelectTrigger className="bg-card">
                        <SelectValue placeholder="Como você compra?" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border shadow-lg z-50">
                        {units.map((unit) => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      Unidade de Uso *
                      <HelpTooltip content="Unidade utilizada na produção/receita (ex: g, ml, unidade)." />
                    </Label>
                    <Select
                      value={formData.usageUnit}
                      onValueChange={(v) => setFormData({ ...formData, usageUnit: v })}
                    >
                      <SelectTrigger className="bg-card">
                        <SelectValue placeholder="Como você usa?" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border shadow-lg z-50">
                        {units.map((unit) => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      Fator de Conversão *
                      <HelpTooltip content="Quantas unidades de uso em 1 unidade de compra. Ex: 1kg = 1000g → fator 1000." />
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.conversionFactor}
                      onChange={(e) => setFormData({ ...formData, conversionFactor: e.target.value })}
                      placeholder="Ex: 1000"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      Preço por Unidade de Compra (R$)
                      <HelpTooltip content="Preço de referência por unidade de compra. Atualizado automaticamente ao lançar NF." />
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.pricePerPurchaseUnit}
                      onChange={(e) => setFormData({ ...formData, pricePerPurchaseUnit: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>

                  {needsUnitWeight && (
                    <div className="space-y-2">
                      <Label>
                        Peso por {formData.usageUnit} (gramas)
                        <HelpTooltip content="Peso em gramas de 1 unidade de uso, para cálculos de receita." />
                      </Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.unitWeight}
                        onChange={(e) => setFormData({ ...formData, unitWeight: e.target.value })}
                        placeholder="Ex: 50 (gramas por unidade)"
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="border-t border-border" />

          {/* ── SEÇÃO 4: FISCAL ── */}
          {/* Para produtos produzidos internamente, fiscal só faz sentido se for revendido avulso */}
          {isProducedType && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2 -mb-2">
              Dados fiscais são necessários apenas se este produto for revendido avulso (NF de saída). Caso contrário, pode deixar em branco.
            </p>
          )}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <Receipt className="h-4 w-4" />
              <span>Fiscal <span className="font-normal normal-case text-xs">(opcional)</span></span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  NCM
                  <HelpTooltip content="Nomenclatura Comum do Mercosul. Código de 8 dígitos para classificação fiscal." />
                </Label>
                <Input
                  value={formData.ncm}
                  onChange={(e) => setFormData({ ...formData, ncm: e.target.value })}
                  placeholder="Ex: 19059090"
                  maxLength={10}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  CFOP
                  <HelpTooltip content="Código Fiscal de Operações e Prestações. 4 dígitos." />
                </Label>
                <Input
                  value={formData.cfop}
                  onChange={(e) => setFormData({ ...formData, cfop: e.target.value })}
                  placeholder="Ex: 5102"
                  maxLength={5}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  CST
                  <HelpTooltip content="Código de Situação Tributária. 3 dígitos." />
                </Label>
                <Input
                  value={formData.cst}
                  onChange={(e) => setFormData({ ...formData, cst: e.target.value })}
                  placeholder="Ex: 040"
                  maxLength={4}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Origem
                  <HelpTooltip content="Origem da mercadoria para fins fiscais." />
                </Label>
                <Select
                  value={formData.origem}
                  onValueChange={(v) => setFormData({ ...formData, origem: v })}
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border shadow-lg z-50">
                    <SelectItem value="0">0 — Nacional</SelectItem>
                    <SelectItem value="1">1 — Estrangeira (importação direta)</SelectItem>
                    <SelectItem value="2">2 — Estrangeira (mercado interno)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── BOTÕES ── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button type="submit" className="bg-gradient-primary flex-1">
              {material ? 'Atualizar Material' : 'Cadastrar Material'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>

        </form>
      </CardContent>
    </Card>
  );
};
