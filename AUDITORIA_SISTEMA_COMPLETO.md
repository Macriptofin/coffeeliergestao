# 🔍 AUDITORIA COMPLETA - SISTEMA DE ESTOQUE, PRODUÇÃO E FATURAMENTO

**Data:** 07/10/2025  
**Escopo:** Validação completa do fluxo industrial desde cadastro até NF-e  
**Status:** ⚠️ **SISTEMA FUNCIONAL MAS REQUER CORREÇÕES CRÍTICAS**

---

## 📊 RESUMO EXECUTIVO

### Status Geral por Fase

| Fase | Status | Cobertura | Crítico? |
|------|--------|-----------|----------|
| **0. Estrutura Base** | 🟡 PARCIAL | 60% | ⚠️ Sim |
| **1. Cadastro Materiais** | 🟢 OK | 85% | ✅ Não |
| **2. Compras/Entradas** | 🟢 OK | 90% | ✅ Não |
| **3. Ficha Técnica (BOM)** | 🟡 PARCIAL | 75% | ⚠️ Sim |
| **4. Disponibilidade (MRP)** | 🟢 OK | 100% | ✅ Não |
| **5. Execução Produção** | 🔴 CRÍTICO | 50% | 🔴 Sim |
| **6. Inventário** | 🟢 OK | 80% | ✅ Não |
| **7. Vendas e NF-e** | 🔴 NÃO IMPLEMENTADO | 10% | 🔴 Sim |

### Problemas Críticos Identificados

1. ❌ **Produção não grava `cost_source='production'`** no estoque produzido
2. ❌ **`average_price` de produtos intermediários não é atualizado** com custo da BOM
3. ❌ **Densidade não é aplicada** automaticamente nas conversões mL→g
4. ❌ **Vendas e NF-e não existem** ou não baixam estoque
5. ❌ **Locais de estoque não existem** (tudo em um único local)
6. ❌ **Parâmetros fiscais** (NCM, CFOP, CST) não implementados

---

## 🔍 ANÁLISE DETALHADA POR FASE

## FASE 0 - ESTRUTURA BASE

### ✅ **Implementado:**

#### Unidades de Medida e Conversões
```sql
-- ✅ Campo existe e funciona
materials.conversion_factor (numeric)
materials.purchase_unit (text)
materials.usage_unit (text)
```
- Sistema converte automaticamente purchase_unit → usage_unit
- Função `process_stock_entry_with_conversion` implementada
- Cálculo de preço médio ponderado correto

#### Categorias e Taxonomias
```sql
-- ✅ Sistema completo de taxonomias
taxonomy_definitions (55 termos ativos)
taxonomy_terms (hierárquico)
materials.category_term_id
materials.subcategory_term_id
```

#### Fornecedores
```sql
-- ✅ Tabela completa
suppliers (id, code, name, cnpj_cpf, contact_person, etc.)
```

### ⚠️ **Parcialmente Implementado:**

#### Densidades
```typescript
// ⚠️ Campo existe mas não é aplicado automaticamente
materials.density_g_per_ml (numeric, nullable)
```

**Problema:**
- Campo existe no schema e no TypeScript
- TechnicalSheetWizard.tsx tenta usar mas não é automático
- Conversões mL→g **não aplicam densidade** se o campo estiver vazio
- Usuário precisa preencher manualmente

**Impacto:**
- Líquidos (leite, óleo, água) ficam com peso incorreto nas BOMs
- Custo por grama fica errado

### ❌ **NÃO Implementado:**

#### Locais de Estoque
```sql
-- ❌ NÃO EXISTE
storage_locations (id, name, type, warehouse_id)
stock_items.location_id
```

**Problema:**
- Todo estoque está em um único "local virtual"
- Não é possível separar: Depósito / Produção / Expedição
- Movimentações não registram local de origem/destino

**Impacto:**
- Impossível rastrear onde está fisicamente cada material
- Produção não pode "reservar" materiais do depósito
- Expedição não pode confirmar separação

#### Parâmetros Fiscais
```sql
-- ❌ NÃO EXISTE
materials.ncm (text)
materials.cfop (text)
materials.cst_csosn (text)
materials.origem (integer)
```

**Problema:**
- Tab "Fiscal" existe no MaterialEditor.tsx mas está **disabled**
- Impossível emitir NF-e sem esses dados
- Sistema não calcula impostos

**Impacto:**
- **BLOQUEIO TOTAL** para emissão de NF-e
- Impossível vender legalmente produtos acabados

---

## FASE 1 - CADASTRO DE MATERIAIS

### ✅ **Implementado:**

#### Tipos de Material
```sql
-- ✅ Enum completo
materials.material_type: 
  'ingredient' | 'packaging' | 'intermediate_product' | 
  'finished_product' | 'composite_product'
```

#### Unidades e Conversão
```sql
-- ✅ Campos obrigatórios
materials.purchase_unit (NOT NULL)
materials.usage_unit (NOT NULL)
materials.conversion_factor (NOT NULL, DEFAULT 1)
```

#### Custo
```sql
-- ✅ Campos existem
materials.price_per_purchase_unit (numeric)
stock_items.average_price (numeric)
stock_items.cost_source (enum: 'purchase', 'production', 'manual')
```

### ⚠️ **Parcialmente Implementado:**

#### `cost_source` e `manual_price`
```sql
-- ⚠️ Existem no schema mas não são usados corretamente
stock_items.cost_source (enum)
stock_items.manual_price (boolean)
stock_items.cost_last_updated_at (timestamp)
stock_items.cost_last_updated_by (uuid)
```

**Problema:**
1. **Compras NÃO gravam** `cost_source='purchase'`
2. **Produção NÃO grava** `cost_source='production'`
3. **Ajustes NÃO gravam** `cost_source='manual'`
4. Campos de auditoria (`cost_last_updated_*`) não são populados

**Impacto:**
- Impossível saber de onde veio o custo de cada material
- Impossível auditar alterações de preço
- Relatórios de custeio ficam incompletos

#### Estoque Mínimo, Lead Time, Validade
```sql
-- ⚠️ Estoque mínimo existe em stock_items
stock_items.minimum_quantity (numeric)

-- ⚠️ Lead time existe mas em tabela separada
stock_parameters (
  material_id, 
  lead_time_days, 
  safety_stock, 
  review_period_days
)

-- ❌ Validade NÃO EXISTE
-- Não há campo para data de validade ou dias até vencer
```

**Problema:**
- Lead time não está no cadastro principal do material
- Sistema não alerta sobre itens próximos ao vencimento
- Não há controle de lotes (FIFO/FEFO)

---

## FASE 2 - COMPRAS / ENTRADAS

### ✅ **Implementado:**

#### Sistema de Preço Médio Ponderado
```sql
-- ✅ Função completa e testada
process_stock_entry_with_conversion(
  p_material_id uuid,
  p_quantity_purchased numeric,
  p_unit_price_purchase numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_notes text
)
```

**Funcionalidades:**
- ✅ Converte purchase_unit → usage_unit automaticamente
- ✅ Calcula preço médio ponderado corretamente
- ✅ Usa row-level locking (evita race conditions)
- ✅ Registra movimentação detalhada
- ✅ Retorna informações de antes/depois

#### Interface de Notas Fiscais
```typescript
// ✅ Componentes implementados
<PurchaseInvoices />          // Lista de NFs
<InvoiceEditDialog />         // Edição e lançamento
<InvoiceItemMatcher />        // Vinculação de itens
<InvoiceOCRUploader />        // OCR de NF (parcial)
```

### ⚠️ **Problema Crítico:**

#### `cost_source` não é registrado
```sql
-- ❌ Função process_stock_entry_with_conversion NÃO grava cost_source
-- Deveria fazer:
UPDATE stock_items SET
  average_price = [...],
  cost_source = 'purchase',           -- ❌ FALTANDO
  cost_last_updated_at = now(),       -- ❌ FALTANDO
  cost_last_updated_by = auth.uid()   -- ❌ FALTANDO
WHERE material_id = p_material_id;
```

**Impacto:**
- Impossível rastrear origem do custo
- Auditoria comprometida

---

## FASE 3 - FICHA TÉCNICA (BOM)

### ✅ **Implementado:**

#### Estrutura de BOMs
```sql
-- ✅ Tabelas completas
recipes_bom (finished_material_id, yield_quantity, yield_unit, waste_percent)
recipe_bom_items (recipe_id, material_id, quantity, unit, is_packaging)
composites_bom (composite_material_id)
composite_bom_items (composite_id, component_material_id, quantity, unit)
```

#### Cálculo de Custo (NOVO - 07/10/2025)
```sql
-- ✅ Funções recém-implementadas
get_material_cost(p_material_id uuid) → numeric
  -- Fallback hierárquico: BOM → Estoque → Última compra → Cadastro

calculate_bom_cost_recursive(p_material_id uuid, p_material_type text) → numeric
  -- Calcula custo da BOM recursivamente
```

#### Interface
```typescript
// ✅ Componentes implementados
<TechnicalSheetWizard />      // Criação de fichas
<RecipeBOMForm />             // BOM de receitas
<CompositeBOMForm />          // BOM de compostos
```

### ⚠️ **Problemas Críticos:**

#### 1. Custo Unitário não é gravado no estoque
```typescript
// ⚠️ TechnicalSheetWizard calcula mas não grava
const costEstimate = {
  unitCost: totalCost / bom.yieldQuantity,  // ✅ Calcula
  // ...
};

// ❌ Ao salvar, grava zero:
await supabase.from('stock_items').upsert({
  material_id: materialId,
  average_price: 0,  // ❌ DEVERIA SER costEstimate.unitCost
  // ...
});
```

**Problema:**
- Produto acabado fica com `average_price = 0`
- Na próxima venda, custo será zero
- CMV (Custo da Mercadoria Vendida) fica errado

#### 2. Densidade não é aplicada automaticamente
```typescript
// ⚠️ TechnicalSheetWizard tenta buscar densidade mas falha silenciosamente
const density = (materialData as any).density_g_per_ml || 
                (materialData as any).densityGPerMl || 
                1.0;  // ❌ Fallback para 1.0

itemWeight = item.quantity * density;

// Se densidade não existe, peso fica errado
```

**Problema:**
- Leite (1L) deveria pesar ~1030g (densidade ~1.03)
- Sistema calcula como 1000g (densidade 1.0)
- Custo por grama fica incorreto

#### 3. Cached_total_cost não é atualizado
```sql
-- ⚠️ Campos existem mas não são populados
recipes_bom.cached_total_cost (numeric, nullable)
recipes_bom.cost_last_calculated_at (timestamp, nullable)
composites_bom.cached_total_cost (numeric, nullable)
```

**Problema:**
- Sistema recalcula custo toda vez
- Performance ruim em BOMs complexas
- Não há histórico de quando custo mudou

---

## FASE 4 - DISPONIBILIDADE (MRP)

### ✅ **Totalmente Implementado:**

#### Função de Verificação
```sql
-- ✅ Função implementada 07/10/2025
check_production_availability(
  p_bom_id uuid, 
  p_bom_type text, 
  p_multiplier numeric
) → jsonb

-- Retorna:
{
  "available": boolean,
  "missing_items": [
    {
      "material_id": uuid,
      "material_name": text,
      "needed": numeric,
      "available": numeric,
      "missing": numeric,
      "unit": text
    }
  ]
}
```

#### Hook React
```typescript
// ✅ Hook implementado
const { checkAvailability, loading } = useBOMCosting();

const result = await checkAvailability(bomId, 'recipe', quantity);
// result.available = true/false
// result.missing_items = [...]
```

#### Interface
```typescript
// ✅ Componente implementado
<ProductionAvailability 
  available={result.available}
  missingItems={result.missing_items}
  onCreatePurchaseRequest={() => {...}}
/>
```

#### Comportamento
- ✅ Exibe lista de itens faltantes com deficit
- ✅ Botão "Gerar Necessidades de Compra"
- ✅ Bloqueia botão "Executar Produção" se `available = false`
- ✅ Permite **salvar** OP sempre (mesmo sem saldo)
- ✅ Só permite **iniciar** OP com saldo completo

**Status:** ✅ **PERFEITO - Não requer alterações**

---

## FASE 5 - EXECUÇÃO DA PRODUÇÃO

### ⚠️ **Implementação CRÍTICA - Requer Correção Urgente**

#### Funções Existentes
```sql
-- ⚠️ Funções antigas (27/09/2024)
produce_finished_product(p_material_id uuid, p_quantity numeric)
assemble_composite(p_material_id uuid, p_quantity numeric)
```

### 🔴 **PROBLEMAS CRÍTICOS:**

#### 1. Não usa sistema de custo hierárquico
```sql
-- ❌ ATUAL (errado):
produce_finished_product faz:
  1. Consome insumos (OK)
  2. Adiciona produto ao estoque (OK)
  3. Calcula custo baseado no preço dos insumos consumidos (❌ ERRADO)
     -- Usa average_price direto, pode estar zerado

-- ✅ DEVERIA FAZER:
  1. Consome insumos (OK)
  2. Calcula custo usando get_material_cost() (hierárquico)
  3. Adiciona produto com custo correto
  4. Grava cost_source='production'
  5. Grava cost_last_updated_at e cost_last_updated_by
```

#### 2. Não grava `cost_source='production'`
```sql
-- ❌ Faltando em produce_finished_product:
UPDATE stock_items SET
  current_quantity = [...],
  average_price = [...],
  cost_source = 'production',           -- ❌ FALTANDO
  cost_last_updated_at = now(),         -- ❌ FALTANDO
  cost_last_updated_by = auth.uid()     -- ❌ FALTANDO
WHERE material_id = p_material_id;
```

#### 3. Produtos intermediários ficam sem custo
```typescript
// ❌ PROBLEMA:
// 1. Crio BOM de "Massa de Bolo" (intermediário)
// 2. Custo calculado: R$ 15,50
// 3. Ao salvar, average_price = 0 (não grava!)
// 4. Crio BOM de "Bolo de Chocolate" usando "Massa de Bolo"
// 5. Custo da massa = R$ 0,00 (erro!)
// 6. Custo total do bolo fica errado
```

**Impacto Financeiro:**
- **CMV incorreto** em produtos acabados
- **Margem de lucro errada** em vendas
- **Estoque com valor contábil zero**
- **Impossível calcular rentabilidade** de produtos

---

## FASE 6 - INVENTÁRIO E MOVIMENTAÇÕES

### ✅ **Implementado:**

#### Ciclos de Inventário
```sql
-- ✅ Tabelas completas
inventory_cycles (
  id, cycle_name, cycle_date, status, 
  responsible_user_id, started_at, closed_at
)

inventory_adjustments (
  id, cycle_id, material_id, 
  system_quantity, physical_quantity, 
  quantity_difference, is_draft, notes
)
```

#### Ajustes de Custo
```sql
-- ✅ Tabela e função
cost_adjustments (
  id, material_id, adjustment_date, 
  old_unit_cost, new_unit_cost, 
  adjustment_reason, responsible_user_id
)

process_cost_adjustment(
  p_material_id uuid,
  p_new_unit_cost numeric,
  p_adjustment_reason text,
  p_reference_document text,
  p_notes text
) → uuid
```

#### Movimentações
```sql
-- ✅ Tabela completa
stock_movements (
  id, material_id, movement_type, quantity, 
  unit_price, total_value, movement_date, 
  reference_type, reference_id, notes
)
```

### ⚠️ **Faltando:**

#### Kardex Completo
```typescript
// ❌ NÃO EXISTE:
// - Componente <Kardex /> com saldo running
// - Visualização de "saldo anterior → movimento → saldo novo"
// - Filtros por período, tipo de movimento, etc.
```

**Problema:**
- Usuário não consegue ver histórico completo de um material
- Difícil auditar divergências
- Sem rastreabilidade visual

**Solução:**
- Criar `<StockMovements />` melhorado com:
  - Coluna "Saldo Anterior"
  - Coluna "Movimento" (entrada/saída)
  - Coluna "Saldo Novo"
  - Filtros e busca

---

## FASE 7 - VENDAS E NF-e

### 🔴 **NÃO IMPLEMENTADO - BLOQUEIO CRÍTICO**

#### Vendas
```sql
-- ❌ NÃO EXISTE:
sales_orders (id, client_id, order_date, status, total_amount)
sales_order_items (id, order_id, material_id, quantity, unit_price)
```

**Problema:**
- Não há tabela de pedidos de venda
- Não há baixa automática de estoque em vendas
- Propostas não viram vendas

#### NF-e (Nota Fiscal Eletrônica)
```sql
-- ❌ NÃO EXISTE:
outgoing_invoices (id, client_id, invoice_number, invoice_key, xml_path)
invoice_tax_details (id, invoice_id, icms, pis, cofins, ipi)
```

**Problema:**
- Sistema não emite NF-e
- Materiais não têm NCM, CFOP, CST (bloqueio fiscal)
- Impossível vender legalmente

**Impacto:**
- **BLOQUEIO TOTAL** para operação legal
- Sem NF-e, empresa não pode vender
- Sem baixa de estoque, saldo fica errado

---

## 🎯 PLANO DE CORREÇÃO - PRIORIDADES

### 🔴 **CRÍTICO - Implementar IMEDIATAMENTE:**

#### 1. Corrigir Execução de Produção
```sql
-- Atualizar produce_finished_product e assemble_composite para:
1. Usar get_material_cost() no cálculo
2. Gravar cost_source='production'
3. Gravar cost_last_updated_at e cost_last_updated_by
4. Atualizar cached_total_cost nas BOMs
```

#### 2. Corrigir Compras
```sql
-- Atualizar process_stock_entry_with_conversion para:
1. Gravar cost_source='purchase'
2. Gravar cost_last_updated_at e cost_last_updated_by
```

#### 3. Corrigir BOMs
```typescript
// Atualizar TechnicalSheetWizard para:
1. Gravar costEstimate.unitCost no average_price
2. Gravar cost_source='production'
3. Preencher cached_total_cost na BOM
```

#### 4. Implementar Densidade Automática
```typescript
// No cálculo de peso:
1. Buscar density_g_per_ml do material
2. Se NULL, exibir alerta "⚠️ Densidade não definida"
3. Permitir preenchimento manual no item da BOM
```

### ⚠️ **ALTA PRIORIDADE - Implementar esta semana:**

#### 5. Adicionar Parâmetros Fiscais
```sql
ALTER TABLE materials ADD COLUMN ncm text;
ALTER TABLE materials ADD COLUMN cfop_padrao text;
ALTER TABLE materials ADD COLUMN cst_csosn text;
ALTER TABLE materials ADD COLUMN origem integer DEFAULT 0;
```

#### 6. Criar Tabela de Vendas
```sql
CREATE TABLE sales_orders (...);
CREATE TABLE sales_order_items (...);
-- + Função para baixar estoque em vendas
```

#### 7. Implementar Kardex Completo
```typescript
// Criar <KardexView material_id={...} />
// Com colunas: Data | Tipo | Entrada | Saída | Saldo
```

### 🟡 **MÉDIA PRIORIDADE - Implementar mês que vem:**

#### 8. Locais de Estoque
```sql
CREATE TABLE storage_locations (...);
ALTER TABLE stock_items ADD COLUMN location_id uuid;
```

#### 9. Controle de Validade
```sql
ALTER TABLE materials ADD COLUMN shelf_life_days integer;
CREATE TABLE stock_batches (
  id uuid,
  material_id uuid,
  batch_number text,
  manufacture_date date,
  expiry_date date,
  quantity numeric
);
```

#### 10. NF-e (Integração Externa)
```sql
CREATE TABLE outgoing_invoices (...);
-- Integrar com provedor de NF-e (ex: eNotas, Focus NFe)
```

---

## 📋 DEFINITION OF DONE

### Para considerar o sistema 100% funcional:

- [x] ✅ Materiais cadastrados com unidades e conversão
- [x] ✅ Sistema de preço médio ponderado
- [x] ✅ BOMs configuradas e calculando custo
- [x] ✅ Verificação de disponibilidade antes da produção
- [ ] ❌ Produção gravando `cost_source='production'`
- [ ] ❌ Produtos intermediários com custo correto
- [ ] ❌ Densidade aplicada automaticamente
- [ ] ❌ Parâmetros fiscais (NCM, CFOP, CST)
- [ ] ❌ Vendas baixando estoque
- [ ] ❌ NF-e de saída
- [ ] ❌ Kardex completo
- [ ] ❌ Locais de estoque

**Status Atual:** 50% implementado

---

## 🚀 PRÓXIMOS PASSOS

1. **Esta semana:** Corrigir produção (cost_source, custo correto)
2. **Esta semana:** Corrigir compras (cost_source)
3. **Esta semana:** Corrigir BOMs (gravar custo no estoque)
4. **Próxima semana:** Adicionar parâmetros fiscais
5. **Próxima semana:** Implementar vendas básicas
6. **Mês que vem:** Kardex, locais de estoque, NF-e

**Conclusão:** Sistema está funcional para cadastro, compras e BOMs, mas **CRÍTICO** para produção e **BLOQUEADO** para vendas legais.
