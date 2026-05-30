# Banco de Dados — Coffeelier ERP

**Última atualização:** Maio 2026  
**Projeto Supabase:** `njxxqdcwvehlvqufuyww`  
**Região:** `sa-east-1` (São Paulo)  
**PostgreSQL:** 17.6  
**Total de tabelas:** 103 | **Views:** 12

---

## Convenções

- Todas as PKs são `uuid` gerado via `gen_random_uuid()`
- Todas as tabelas têm `created_at timestamptz DEFAULT now()`
- A maioria tem `updated_at` atualizado por trigger automático
- **RLS ativo em 100% das tabelas** — nenhum acesso público
- Nomes de tabelas em `snake_case`, colunas em `snake_case`

---

## Domínios

### A. Materiais e Estoque

#### `materials`
Cadastro central de todos os itens. Toda movimentação do sistema parte daqui.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | Identificador único |
| code | text | Código interno (ex: INS0166) |
| name | text | Nome padronizado |
| material_type | text | `insumo`, `embalagem`, `descartavel`, `produto_intermediario`, `produto_acabado`, `revenda`, `operacional` |
| category | text | Categoria (legado — preferir `category_term_id`) |
| subcategory | text | Subcategoria (legado) |
| category_term_id | uuid → taxonomy_terms | Categoria via taxonomia |
| subcategory_term_id | uuid → taxonomy_terms | Subcategoria via taxonomia |
| type_term_id | uuid → taxonomy_terms | Tipo via taxonomia |
| purchase_unit | text | Unidade de compra (caixa, kg, unidade) |
| usage_unit | text | Unidade de uso em receitas (g, ml, un) |
| conversion_factor | numeric | Fator de conversão entre unidade de compra e uso |
| unit_weight | numeric | Peso unitário em gramas |
| density_g_per_ml | numeric | Densidade (para líquidos) |
| cost_price | numeric | Custo de referência (atualizado pelo custo médio) |
| supplier_id | uuid → suppliers | Fornecedor principal |
| supplier | text | ⚠️ LEGADO — usar supplier_id |
| is_sellable | boolean | Pode aparecer em propostas de venda |
| is_archived | boolean | Material arquivado (não aparece nas buscas) |
| is_system_generated | boolean | Criado automaticamente pelo sistema |
| ncm / cfop_padrao / cst_csosn / origem | text/int | Dados fiscais |
| allowed_brands | text[] | Marcas aceitas para este material |

#### `stock_items`
Saldo atual de cada material no estoque.

| Coluna | Tipo | Descrição |
|---|---|---|
| material_id | uuid → materials | |
| current_quantity | numeric | Quantidade física atual |
| minimum_quantity | numeric | Quantidade mínima (alerta abaixo disso) |
| ideal_qty | numeric | Quantidade ideal de manutenção |
| reserved_qty | numeric | Reservado para ordens de produção |
| committed_qty | numeric | Comprometido para eventos aprovados |
| average_price | numeric | Custo médio ponderado atual |
| total_value | numeric | current_quantity × average_price |
| cost_source | enum | Origem do custo: `manual`, `purchase`, `calculated` |
| manual_price | boolean | Se o custo foi definido manualmente |
| cost_last_updated_at | timestamptz | |

> `available_qty` = `current_quantity` - `reserved_qty` - `committed_qty` (calculado)

#### `stock_movements`
Toda entrada e saída de estoque. Imutável — nunca deletar registros.

| Coluna | Tipo | Descrição |
|---|---|---|
| material_id | uuid → materials | |
| movement_type | text | `entrada_compra`, `saida_producao`, `ajuste_inventario`, `perda`, `transferencia` |
| quantity | numeric | Positivo = entrada, Negativo = saída |
| unit_price | numeric | Preço unitário desta movimentação |
| total_cost | numeric | quantity × unit_price |
| reference_type | text | Origem: `purchase_invoice`, `production_order`, `inventory_adjustment` |
| reference_id | uuid | ID da origem |
| idempotency_key | text | Previne movimentações duplicadas |
| movement_date | timestamptz | |

#### `stock_parameters`
Parâmetros de planejamento de estoque por material.

| Coluna | Tipo | Descrição |
|---|---|---|
| material_id | uuid → materials | |
| abc_classification | text | `A`, `B`, `C` |
| minimum_stock | numeric | Estoque mínimo de segurança |
| maximum_stock | numeric | Estoque máximo |
| reorder_point | numeric | Ponto de pedido (trigger de compra) |
| safety_stock | numeric | Estoque de segurança |
| lead_time_days | int | Prazo de entrega do fornecedor em dias |
| review_period_days | int | Periodicidade de revisão |

#### `inventory_cycles` + `inventory_adjustments`
Controle de inventário físico periódico.

---

### B. BOM (Fichas Técnicas)

#### `recipes_bom`
Ficha técnica de produto acabado.

| Coluna | Tipo | Descrição |
|---|---|---|
| finished_material_id | uuid → materials | Material que este BOM produz |
| yield_quantity | numeric | Quantidade produzida por lote |
| yield_unit | text | Unidade do rendimento |
| waste_percent | numeric | % de perda na produção |
| cached_total_cost | numeric | **Calculado automaticamente. Nunca editar.** |
| cost_status | text | `complete` \| `incomplete` \| `partial` \| `unknown` |
| missing_cost_items | jsonb | Materiais sem custo (array de IDs) |
| is_archived | boolean | |

#### `recipe_bom_items`
Ingredientes de uma ficha técnica.

| Coluna | Tipo | Descrição |
|---|---|---|
| recipe_id | uuid → recipes_bom | |
| material_id | uuid → materials | |
| quantity | numeric | Quantidade necessária |
| unit | text | Unidade (pode diferir da `usage_unit` do material) |
| waste_percent | numeric | % de perda específica deste item nesta receita |
| is_packaging | boolean | Se é embalagem (não entra no custo de insumo) |
| position | int | Ordem de exibição |

#### `composites_bom` + `composite_bom_items`
Fichas técnicas de produtos intermediários (patês, molhos, recheios).
Estrutura idêntica a `recipes_bom` / `recipe_bom_items`, mas para materiais do tipo `produto_intermediario`.

#### `bom_production_orders`
Ordens de produção.

| Coluna | Tipo | Descrição |
|---|---|---|
| order_name | text | Nome descritivo da OP |
| order_date | date | Data planejada |
| status | text | `pending` \| `in_progress` \| `completed` \| `cancelled` |
| total_cost | numeric | Custo total calculado |
| cost_status | text | Status do custo (igual ao BOM) |
| created_by | uuid | Usuário que criou |

#### `bom_production_order_items`
BOMs incluídos em uma OP (uma OP pode produzir múltiplos produtos).

#### `bom_production_consolidated_materials`
Consolidação de todos os materiais necessários para uma OP (resultado da explosão do BOM).

#### `bom_production_stock_movements`
Movimentações de estoque geradas pela execução de uma OP.

#### `bom_cost_history`
Histórico de variações de custo de qualquer BOM.

#### `bom_cost_alerts`
Alertas gerados quando o custo de um BOM varia acima de um threshold configurável.

---

### C. Eventos e Mesas

#### `event_tables`
Configuração operacional de um evento de mesa (coffee break, brunch, etc.).

| Coluna | Tipo | Descrição |
|---|---|---|
| event_code | text | Código do evento |
| client_id | uuid → clients | |
| date_start / date_end | timestamptz | |
| attendees | int | Número de pessoas |
| profile_id | uuid → consumption_profiles | Perfil de consumo (g/pessoa) |
| template_id | uuid → event_table_templates | Template aplicado |
| department_id | uuid → client_departments | Departamento do cliente |
| unit_id | uuid → client_units | Unidade do cliente |
| room_id | uuid → client_rooms | Sala do evento |

#### `event_table_items`
Itens planejados para a mesa (material + quantidade por pessoa).

#### `event_table_templates` + `event_table_template_items`
Templates reutilizáveis de configuração de mesa (Coffee Básico, Coffee Executivo, etc.).

#### `consumption_profiles` + `consumption_profile_mix`
Perfis de consumo por categoria (ex: Coffee Break = 400g/pessoa, sendo 30% salgados, 25% doces...).

#### `event_category_standards`
Padrões percentuais recomendados por categoria de evento e produto.

#### `events`
Evento como entidade de calendário.

| Coluna | Tipo | Descrição |
|---|---|---|
| proposal_id | uuid → proposals | Proposta que gerou este evento |
| client_id | uuid → clients | |
| event_name | text | |
| event_date | date | |
| status | text | `agendado` \| `em_andamento` \| `concluido` \| `cancelado` |
| total_people | int | |
| venue | text | Local do evento |

#### `event_sessions`
Múltiplos turnos dentro do mesmo evento.

---

### D. Propostas e Vendas

#### `proposals`
Proposta comercial — entidade central do módulo de vendas.

| Coluna | Tipo | Descrição |
|---|---|---|
| proposal_number | text | Número sequencial (ex: 2026-0004) |
| client_id | uuid → clients | |
| number_of_people | int | |
| target_weight_per_person | numeric | Meta de peso por pessoa (g) |
| total_weight | numeric | Peso total calculado |
| total_amount | numeric | Valor total |
| status | text | `rascunho` \| `enviada` \| `aprovada` \| `recusada` \| `cancelada` |
| version | int | Versão da proposta |
| parent_proposal_id | uuid → proposals | Versão anterior |
| event_category | text | Tipo de evento (Coffee Break, Brunch, etc.) |
| proposal_kind | text | `evento_mesa` \| `kit_individual` \| `revenda` |
| auto_generated_event_id | uuid → events | Event criado ao aprovar |
| auto_generated_event_table_id | uuid → event_tables | Mesa criada ao aprovar |
| auto_generated_bom_order_id | uuid → bom_production_orders | OP criada ao aprovar |
| generated_order_id | uuid → sales_orders | Pedido criado ao aprovar |

#### `proposal_categories` + `proposal_category_items`
Estrutura de itens da proposta (modelo atual — por categoria e material).

| Campo de `proposal_category_items` | Descrição |
|---|---|
| material_id | Material selecionado |
| item_kind | `produce_finished` \| `pick_resale` \| `support_material` |
| qty_per_person | Quantidade por pessoa |
| fixed_qty | Quantidade fixa total (alternativo ao qty_per_person) |
| unit_override | Unidade diferente da padrão do material |

#### `proposal_picklists` + `proposal_picklist_items`
Lista de separação gerada a partir da proposta para o estoque.

#### `sales_orders` + `sales_order_items`
Pedido de venda gerado ao aprovar uma proposta.

---

### E. Clientes e CRM

#### `clients`
| Campo relevante | Descrição |
|---|---|
| client_code | Código interno do cliente |
| client_type | `empresa` \| `pessoa_fisica` |
| cnpj_cpf | |
| status | `ativo` \| `inativo` \| `prospecto` |

#### `client_units` → `client_departments` → `client_rooms`
Hierarquia de localização do cliente: empresa → unidade/filial → departamento → sala.

#### `client_contacts`
Contatos associados a um cliente, com vínculo opcional a departamento.

#### `client_assignments`
Associa um usuário do sistema a um cliente específico (controle de carteira comercial).

---

### F. Compras e Fornecedores

#### `suppliers`
| Campo relevante | Descrição |
|---|---|
| company_name / trade_name | Razão social e nome fantasia |
| cnpj_cpf | |
| main_category | Categoria principal de produtos |
| payment_terms | Prazo de pagamento padrão (dias) |
| minimum_order_value | Pedido mínimo |

#### `supplier_products`
Mapeamento de produto do fornecedor → material do sistema (com fator de conversão de unidade).

#### Fluxo de cotação
`quote_requests` → `quote_request_suppliers` → `supplier_quotes` → `supplier_quote_items`

#### OCR
- `invoice_ocr_sessions` — sessão de OCR de uma NF
- `invoice_ocr_items` — itens extraídos
- `invoice_material_matches` — cache de matches
- `material_name_mappings` — aprendizado persistente (nome na NF → material no sistema)

---

### G. Financeiro

#### `chart_of_accounts`
Plano de contas hierárquico (pai-filho via `parent_id`).

#### `cost_centers`
Centros de custo hierárquicos (pai-filho via `parent_id`).

#### `accounts_payable`
| Campo relevante | Descrição |
|---|---|
| supplier_id | Fornecedor |
| due_date | Data de vencimento |
| original_amount | Valor original |
| paid_amount | Valor já pago |
| remaining_amount | Saldo restante |
| status | `pendente` \| `pago` \| `vencido` \| `cancelado` |
| source_type / source_id | Origem (purchase_invoice, etc.) |

#### `accounts_receivable`
Estrutura similar ao payable, mas vinculado a `clients` e `proposals`.

#### `cash_transactions`
Todas as movimentações de caixa — visão consolidada de fluxo.

> ⚠️ Campo `bank_account` (text) está legado. Usar `bank_account_id` (uuid).

---

### H. RH

#### `employees`
Cadastro completo: dados pessoais, dados de trabalho, dados bancários, documentos.

#### `employee_salary_info`
> ⚠️ Tem FK duplicada para `employees.id`. Manter apenas uma das constraints.

#### `work_schedules`
Jornadas de trabalho com horários e dias da semana.

#### `time_records`
Registros de ponto com localização (lat/lng) e IP.

---

### I. Segurança e Acesso

#### `user_roles`
Papel do usuário: `admin`, `gestor`, `comercial`, `compras`, `producao`, `estoque`, `financeiro`, `logistica`.

#### `user_permissions`
Permissões granulares por categoria e subcategoria (enums definidos no banco).

#### `security_audit_log`
Log de auditoria com `risk_score`, `anomaly_flags` e `device_fingerprint`.

#### `auth_attempts`
Todas as tentativas de login, independente de sucesso.

#### `mfa_settings`
Configuração de TOTP e códigos de backup para MFA.

---

### J. Configuração

#### `taxonomy_definitions` + `taxonomy_terms`
Sistema de classificação hierárquica para materiais. Permite adicionar novas categorias sem alterar o schema.

```
taxonomy_definitions: { key: "material_category", label: "Categoria de Material" }
taxonomy_terms:       { code: "bebidas", name: "Bebidas", parent_id: null }
                      { code: "aguas", name: "Águas", parent_id: <id_bebidas> }
```

#### `app_flags`
Feature flags para ligar/desligar funcionalidades em tempo real sem deploy.

#### `config_namespaces` + `config_options` + `config_values`
Sistema de configuração estruturado para parâmetros operacionais (margens padrão, thresholds de alerta, etc.).

---

## Views de Diagnóstico

| View | Descrição |
|---|---|
| `vw_bom_cost_history_detailed` | Histórico detalhado de variações de custo |
| `vw_cost_audit` | Auditoria de custos inconsistentes |
| `vw_diag_bom_inconsistencies` | BOMs com estrutura inconsistente |
| `vw_diag_material_dupes` | Materiais com nomes duplicados |
| `vw_diag_orphan_materials` | Materiais sem movimentação |
| `vw_diag_orphans` | Registros órfãos em geral |
| `vw_proposal_breakdown` | Detalhamento de propostas |
| `vw_stock_below_min` | Materiais abaixo do estoque mínimo |
| `vw_stock_no_avg_price` | Materiais sem custo médio |
| `vw_stock_zero` | Materiais com estoque zerado |

---

## Funções e Triggers Principais

| Função | Tipo | Descrição |
|---|---|---|
| `calculate_weighted_average_price` | FUNCTION | Calcula PMPF |
| `recalculate_material_average_price` | FUNCTION | Recalcula histórico de custo médio |
| `calculate_bom_cost_recursive` | FUNCTION | Calcula custo de BOM recursivamente (inclui compostos) |
| `calculate_bom_current_cost` | FUNCTION | Custo atual de um BOM específico |
| `calculate_composite_current_cost` | FUNCTION | Custo atual de um composto |
| `refresh_bom_costs_for_material` | FUNCTION | Propaga mudança de custo de um material para todos os BOMs |
| `trigger_update_weighted_average_on_purchase` | TRIGGER | Atualiza custo médio ao confirmar NF |
| `trigger_refresh_bom_costs_on_material_price_change` | TRIGGER | Propaga custo quando material muda |
| `trigger_update_bom_costs_on_price_change` | TRIGGER | Atualiza cached_total_cost nos BOMs |
| `process_cost_adjustment` | FUNCTION | Processa ajuste manual de custo |
| `produce_finished_product_with_correct_cost` | FUNCTION | Executa produção de produto acabado |
| `produce_composite_product_with_correct_cost` | FUNCTION | Executa produção de produto intermediário |
| `analyze_material_price_history` | FUNCTION | Análise histórica de preços |
| `get_material_cost` | FUNCTION | Retorna custo atual de um material |

---

## Observações Importantes para Desenvolvedores

1. **Nunca editar `cached_total_cost` manualmente** — é calculado por trigger. Editar causa inconsistência.

2. **Nunca deletar registros de `stock_movements`** — é log imutável. Usar movimentação de ajuste para correções.

3. **`bom_id` em `bom_cost_history` e `bom_cost_alerts` é polimórfico** — pode apontar para `recipes_bom.id` ou `composites_bom.id`. Verificar `bom_type` antes de fazer join.

4. **`production_order_id` em `sales_orders` é polimórfico** — pode apontar para `bom_production_orders` ou `event_production_orders`. Verificar o contexto.

5. **O campo `supplier` em `materials` é legado** — usar `supplier_id`. O campo texto existe por migração histórica.

6. **`employee_salary_info` tem FK duplicada** — tem dois constraints apontando para `employees.id`. Um será removido na Fase 1.

7. **`access_time_restrictions` é tabela isolada** — sem FK entrada ou saída. Funciona como configuração global de horários permitidos.
