# 🔧 GUIA DE CORREÇÃO DOS MATERIAIS

**Data:** 02/10/2024  
**Status:** 102 materiais precisam de correção

## 📊 DIAGNÓSTICO ATUAL

**Problema principal:** 102 materiais sem preço de compra cadastrado
- 101 destes têm estoque positivo
- Preços médios existem mas estão inconsistentes
- Sem preço de compra, novas entradas não funcionam corretamente

## 🎯 PLANO DE AÇÃO

### FASE 1: Cadastrar Preços de Compra (URGENTE)

#### Opção A: Correção Manual (Recomendado para início)
1. Acesse **Materiais** → **Gestão de Materiais**
2. Para cada material listado abaixo, edite e adicione:
   - **Preço por Unidade de Compra**: preço real da última compra
   - Verifique se **Unidade de Compra** está correta
   - Verifique se **Fator de Conversão** está correto

#### Opção B: Atualização via SQL (Rápida, mas requer cuidado)
```sql
-- Exemplo: atualizar material específico
UPDATE materials 
SET price_per_purchase_unit = 15.50
WHERE code = 'INS0001';

-- Para múltiplos materiais de uma categoria
UPDATE materials 
SET price_per_purchase_unit = 
  CASE code
    WHEN 'INS0087' THEN 12.00  -- Açúcar mascavo: R$ 12/kg
    WHEN 'INS0092' THEN 2.00   -- Água mineral: R$ 2/L
    -- adicione mais casos...
  END
WHERE code IN ('INS0087', 'INS0092', ...);
```

### FASE 2: Recalcular Preços Médios

Após cadastrar os preços de compra, use a função de recálculo:

```sql
-- Recalcular preço médio de um material específico
SELECT recalculate_material_average_price(
  'ID_DO_MATERIAL',
  false  -- false = execução real, true = simulação
);

-- Exemplo prático:
SELECT recalculate_material_average_price(
  '86fa963c-72b5-49f7-a578-5f16b44a57d2',  -- Açúcar mascavo
  true  -- primeiro simule
);
```

### FASE 3: Verificar Saúde do Sistema

Acesse: **Materiais** → **Diagnóstico de Preços**

Ou via SQL:
```sql
SELECT * FROM analyze_system_pricing_health();
```

## 📝 MATERIAIS QUE PRECISAM DE CORREÇÃO

### 🔴 PRIORIDADE ALTA (Com estoque > 100 unidades)

1. **INS0121 - Farinha integral** (sem stock_item)
2. **INS0066 - Água sem gás** (63.000 mL em estoque)
3. **INS0093 - Farinha de trigo** (62.000g em estoque)
4. **INS0099 - Leite integral** (62.000 mL em estoque)
5. **INS0102 - Manteiga sem sal** (26.000g em estoque)
6. **INS0106 - Ovo** (13.000 unidades em estoque)
7. **INS0019 - Pão francês** (9.340g em estoque)
8. **INS0001 - Pão de forma** (4.088g em estoque)
9. **INS0022 - Banana** (2.582g em estoque)
10. **INS0091 - Café Especial Moído** (1.250g em estoque)

### 🟡 PRIORIDADE MÉDIA (Com estoque 10-100)

11. **INS0087 - Açúcar mascavo** (1.000g)
12. **INS0092 - Água mineral sem gás** (2.000 mL)
13. **INS0088 - Amido** (2.000g)
14. **INS0109 - Azeite de oliva** (2.000 mL)
15. E mais 87 materiais...

## ⚠️ CASOS ESPECIAIS

### Material sem stock_item
- **INS0121 - Farinha integral**: Criar registro de estoque primeiro

```sql
INSERT INTO stock_items (material_id, current_quantity, minimum_quantity, average_price)
VALUES (
  'da841277-1f9f-4bf1-a1cc-416dc23319d7',
  0,  -- quantidade inicial
  10, -- estoque mínimo
  0   -- será calculado na primeira entrada
);
```

### Materiais com preço médio muito baixo
Alguns materiais têm `average_price` extremamente baixo (ex: R$ 0,000012/g).
Isso indica entrada com preço errado. Soluções:

1. **Corrigir entrada errada** (se identificar qual foi)
2. **Recalcular** após adicionar preço de compra correto
3. **Fazer ajuste de custo manual** se necessário

## 🔍 COMO IDENTIFICAR PREÇOS CORRETOS

### Consultar última compra real
```sql
SELECT 
  m.name,
  sm.movement_date,
  sm.quantity,
  sm.unit_price,
  sm.notes
FROM stock_movements sm
JOIN materials m ON m.id = sm.material_id
WHERE sm.material_id = 'ID_DO_MATERIAL'
  AND sm.movement_type IN ('Compra', 'Entrada')
ORDER BY sm.movement_date DESC
LIMIT 5;
```

### Consultar notas fiscais
```sql
SELECT 
  pi.invoice_number,
  pi.invoice_date,
  m.name,
  ii.quantity,
  ii.unit_price,
  ii.total_price
FROM invoice_items ii
JOIN purchase_invoices pi ON pi.id = ii.invoice_id
JOIN materials m ON m.id = ii.material_id
WHERE ii.material_id = 'ID_DO_MATERIAL'
ORDER BY pi.invoice_date DESC
LIMIT 5;
```

## 📋 CHECKLIST DE CORREÇÃO

- [ ] **Passo 1**: Listar todos os materiais sem preço de compra
- [ ] **Passo 2**: Identificar preços corretos (consultar compras/notas)
- [ ] **Passo 3**: Atualizar `price_per_purchase_unit` nos materiais
- [ ] **Passo 4**: Criar stock_items faltantes (apenas INS0121)
- [ ] **Passo 5**: Recalcular preços médios (usar função SQL)
- [ ] **Passo 6**: Verificar diagnóstico completo
- [ ] **Passo 7**: Testar nova entrada de estoque

## 🚀 PRÓXIMOS PASSOS APÓS CORREÇÃO

1. **Configurar preços mínimos de alerta**
2. **Estabelecer rotina de revisão mensal**
3. **Treinar equipe no novo fluxo de entrada**
4. **Sempre usar a função `process_stock_entry_with_conversion`**

## 📞 SUPORTE

Em caso de dúvidas:
- Consulte `README_SISTEMA_PRECOS.md` para entender o sistema
- Use `TESTES_IMPLEMENTACAO_PRECOS.md` para validar correções
- Acesse o Diagnóstico de Preços para monitoramento contínuo

---

**Importante:** Faça backup antes de executar updates em massa!
