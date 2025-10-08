# 🎫 TICKET: Melhorias na Lista de Materiais de Produção

**Status:** 📋 Backlog  
**Prioridade:** Média (após validação de precificação)  
**Módulo:** Produção → Ordens BOM  
**Criado em:** 08/10/2025

---

## 📝 CONTEXTO

Atualmente a "Lista de Compras Consolidada" nas ordens de produção BOM mostra apenas:
- Nome do material e unidade
- Quantidade total necessária
- Custo total calculado
- Indicador se usado em múltiplas BOMs

**Problema:** Não permite visualizar disponibilidade de estoque nem identificar materiais faltantes que precisam ser comprados.

---

## 🎯 OBJETIVO

Transformar a lista em uma **"Lista de Necessidades de Materiais"** com análise de estoque e geração automática de requisições de compra.

---

## 📋 REQUISITOS FUNCIONAIS

### 1. Renomear componente
- **De:** "Lista de Compras Consolidada"
- **Para:** "Lista de Necessidades de Materiais" ou "Análise de Necessidades"

### 2. Adicionar consulta de estoque
Para cada material consolidado, buscar em `stock_items`:
```sql
SELECT current_quantity, minimum_quantity, average_price 
FROM stock_items 
WHERE material_id = ?
```

### 3. Calcular status de disponibilidade
```typescript
interface MaterialNeed {
  material: Material;
  required_quantity: number;      // Quantidade necessária
  available_stock: number;        // Em estoque atualmente
  shortage_quantity: number;      // Faltante (se negativo = sobra)
  unit_cost: number;             // Custo unitário
  total_cost: number;            // Custo total
  status: 'sufficient' | 'warning' | 'insufficient';
  usedInBOMs: { bomName: string; quantity: number }[];
}
```

### 4. Nova estrutura da tabela

```
┌──────────────────┬────────────┬────────────┬────────────┬──────────────┬────────┐
│ Material         │ Necessário │ Em Estoque │ Faltante   │ Custo Unit.  │ Status │
├──────────────────┼────────────┼────────────┼────────────┼──────────────┼────────┤
│ Açúcar refinado  │  2700 g    │   5000 g   │     -      │  R$ 0,0044   │   ✅   │
│ Cacau em pó      │   600 g    │      0 g   │   600 g    │  R$ 0,0000   │   🔴   │
│ Creme de leite   │  2000 g    │  10000 g   │     -      │  R$ 0,0040   │   ✅   │
│ Farinha trigo    │   700 g    │    500 g   │   200 g    │  R$ 0,0000   │   ⚠️   │
└──────────────────┴────────────┴────────────┴────────────┴──────────────┴────────┘
```

### 5. Indicadores visuais por status

**Status: `sufficient` (Estoque suficiente)**
- Badge verde com ✅
- Estoque disponível ≥ quantidade necessária

**Status: `warning` (Estoque baixo)**  
- Badge amarelo com ⚠️
- Estoque disponível < quantidade necessária
- Mas estoque > 0

**Status: `insufficient` (Sem estoque)**
- Badge vermelho com 🔴
- Estoque = 0 ou faltante > 80% do necessário

### 6. Botão "Gerar Requisições de Compra"

**Quando aparece:**
- Somente se houver pelo menos 1 material com `status !== 'sufficient'`

**O que faz ao clicar:**
```typescript
async function generatePurchaseRequirements(materialNeeds: MaterialNeed[], productionOrderId: string) {
  const itemsToOrder = materialNeeds.filter(m => m.shortage_quantity > 0);
  
  for (const item of itemsToOrder) {
    await supabase.from('purchase_requirements').insert({
      material_id: item.material.id,
      required_quantity: item.shortage_quantity,
      required_unit: item.material.usage_unit,
      source_type: 'production_order',
      source_id: productionOrderId,
      priority: item.status === 'insufficient' ? 'high' : 'medium',
      required_date: addDays(new Date(), 3), // 3 dias antes da produção
      notes: `Requisição automática para ordem: ${orderName}`
    });
  }
  
  toast.success(`${itemsToOrder.length} requisições de compra criadas!`);
  // Opcional: Redirecionar para módulo de Compras
}
```

**Fluxo:**
1. Clicar no botão "Gerar Requisições"
2. Dialog de confirmação mostrando materiais que serão requisitados
3. Criar registros em `purchase_requirements`
4. Toast de sucesso com opção de ir para Compras
5. Atualizar status da ordem (ex: adicionar flag `has_pending_purchases`)

---

## 🗂️ TABELAS ENVOLVIDAS

### Leitura:
- `stock_items` (consultar estoque atual)
- `bom_production_orders` (ordem sendo criada/visualizada)
- `bom_production_consolidated_materials` (materiais já salvos)

### Escrita:
- `purchase_requirements` (criar requisições)
- Opcional: nova coluna em `bom_production_orders`:
  ```sql
  ALTER TABLE bom_production_orders 
  ADD COLUMN has_pending_purchases BOOLEAN DEFAULT FALSE;
  ```

---

## 🎨 LAYOUT PROPOSTO

### Versão Desktop (Tabela)
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center justify-between">
      <span>📋 Lista de Necessidades de Materiais</span>
      {hasMissingItems && (
        <Button onClick={handleGeneratePurchaseReqs}>
          <ShoppingCart className="mr-2 h-4 w-4" />
          Gerar Requisições ({missingItemsCount})
        </Button>
      )}
    </CardTitle>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material</TableHead>
          <TableHead className="text-right">Necessário</TableHead>
          <TableHead className="text-right">Em Estoque</TableHead>
          <TableHead className="text-right">Faltante</TableHead>
          <TableHead className="text-right">Custo Unit.</TableHead>
          <TableHead className="text-center">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materialNeeds.map(need => (
          <TableRow key={need.material.id}>
            <TableCell>{need.material.name}</TableCell>
            <TableCell className="text-right">
              {need.required_quantity.toFixed(2)} {need.material.usage_unit}
            </TableCell>
            <TableCell className="text-right">
              {need.available_stock.toFixed(2)} {need.material.usage_unit}
            </TableCell>
            <TableCell className="text-right">
              {need.shortage_quantity > 0 
                ? `${need.shortage_quantity.toFixed(2)} ${need.material.usage_unit}`
                : '-'
              }
            </TableCell>
            <TableCell className="text-right">
              R$ {need.unit_cost.toFixed(4)}
            </TableCell>
            <TableCell className="text-center">
              <Badge variant={getStatusVariant(need.status)}>
                {getStatusIcon(need.status)} {getStatusLabel(need.status)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

### Versão Mobile (Cards)
Grid de cards com informações condensadas, similar ao layout atual mas com os novos campos.

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Backend
- [ ] Criar função `getMaterialStockStatus(materialId: string)`
- [ ] Modificar `consolidateIngredients()` para incluir dados de estoque
- [ ] Adicionar tipo `MaterialNeed` com campos de estoque

### Fase 2: UI - Visualização
- [ ] Renomear seção para "Lista de Necessidades de Materiais"
- [ ] Adicionar colunas: "Em Estoque" e "Faltante"
- [ ] Implementar badges de status coloridos
- [ ] Adicionar totalizadores no rodapé

### Fase 3: Geração de Requisições
- [ ] Criar botão condicional "Gerar Requisições"
- [ ] Implementar dialog de confirmação
- [ ] Criar função `generatePurchaseRequirements()`
- [ ] Integrar com tabela `purchase_requirements`
- [ ] Adicionar toast com link para Compras

### Fase 4: Melhorias Adicionais (opcional)
- [ ] Permitir editar data de necessidade por material
- [ ] Sugerir fornecedores baseado no histórico
- [ ] Exportar lista de necessidades para Excel
- [ ] Enviar email automático para setor de Compras

---

## 📊 DADOS DE TESTE

```typescript
// Cenário 1: Todos materiais disponíveis
{
  material: "Açúcar refinado",
  required: 2700,
  stock: 5000,
  shortage: 0,
  status: 'sufficient'
}

// Cenário 2: Estoque parcial
{
  material: "Farinha de trigo",
  required: 700,
  stock: 500,
  shortage: 200,
  status: 'warning'
}

// Cenário 3: Sem estoque
{
  material: "Cacau em pó",
  required: 600,
  stock: 0,
  shortage: 600,
  status: 'insufficient'
}
```

---

## 🔗 ARQUIVOS A MODIFICAR

### Frontend
1. `src/components/ProductionOrderBOM.tsx`
   - Modificar função `consolidateIngredients()`
   - Adicionar consulta de estoque
   - Atualizar interface `ConsolidatedIngredient`
   - Adicionar botão de requisições

2. `src/components/PrintableBOMProductionOrder.tsx`
   - Atualizar para imprimir nova estrutura
   - Incluir coluna de status (opcional)

### Backend (se necessário)
3. Nova migration (opcional):
   ```sql
   -- Adicionar flag de compras pendentes
   ALTER TABLE bom_production_orders 
   ADD COLUMN has_pending_purchases BOOLEAN DEFAULT FALSE;
   ```

---

## 🎯 CRITÉRIOS DE ACEITE

1. ✅ Lista renomeada e com novos campos visíveis
2. ✅ Consulta de estoque funcionando para todos os materiais
3. ✅ Cálculo correto de "Faltante" (necessário - estoque)
4. ✅ Status visual claro (verde/amarelo/vermelho)
5. ✅ Botão de requisições aparece apenas quando necessário
6. ✅ Requisições criadas corretamente no banco
7. ✅ Toast com feedback e link para Compras
8. ✅ Funciona tanto na criação quanto na visualização de ordens

---

## 📝 OBSERVAÇÕES

- **Prioridade:** Implementar APÓS validação completa do sistema de precificação
- **Estimativa:** 6-8 horas de desenvolvimento
- **Depende de:** Sistema de precificação funcionando corretamente
- **Impacto:** Alto - melhora significativa no planejamento de produção

---

## 💬 NOTAS DA REUNIÃO (08/10/2025)

> "Como você pode ver nos dois prints, eu estou criando a ordem de produção [...] Na lista de compra consolidada aparecem só os valores, as quantidades de todos os insumos. Alguns têm valor e outros não. Eu preciso entender o que essa tabela mostra."

> "Seria interessante puxar o nome do produto, a quantidade em estoque e a necessidade. Se a quantidade em estoque é suficiente, não precisa gerar compra. Se não tem suficiente, teria que gerar compra da diferença."

> "Além do botão salvar ordem e imprimir, teria que ter um botão para gerar requisição de compra de itens faltantes e mandar para o módulo de compras."

**Decisão:** Salvar como ticket para implementar depois, focar primeiro em validar a precificação.
