# CLAUDE.md — Coffeelier Gestão

Guia de contexto para o Claude Code. Leia este arquivo antes de qualquer tarefa.

---

## 1. O Projeto

**Coffeelier Gestão** — sistema web de gestão operacional para buffet/catering. Cobre estoque, produção, compras (NF), financeiro, propostas comerciais, agenda de eventos e RH.

- **Stack**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL 17, Auth, Edge Functions, Storage)
- **Hospedagem frontend**: Vercel (deploy automático via push no GitHub) — ver Seção 11
- **Repo**: https://github.com/Macriptofin/coffeeliergestao.git

---

## 2. Localização dos Arquivos

```
/Users/macielluchtemberg/Projetos/coffeeliergestao/   ← raiz do projeto
│
├── src/
│   ├── pages/          ← uma página por módulo (rota)
│   │   ├── Dashboard.tsx
│   │   ├── Agenda.tsx
│   │   ├── Materials.tsx / Materiais.tsx
│   │   ├── Stock.tsx / EstoqueMovimentacoes.tsx
│   │   ├── Purchases.tsx
│   │   ├── Recipes.tsx
│   │   ├── ProducaoMain.tsx
│   │   ├── Suppliers.tsx
│   │   ├── Reports.tsx
│   │   ├── Financeiro.tsx
│   │   ├── financeiro/   ← sub-rotas financeiras
│   │   │   ├── ContasPagar.tsx
│   │   │   ├── ContasReceber.tsx
│   │   │   ├── FluxoCaixa.tsx
│   │   │   ├── DRE.tsx
│   │   │   ├── PlanoContas.tsx
│   │   │   └── ...
│   │   ├── production/   ← sub-rotas de produção
│   │   ├── stock/
│   │   └── rh/
│   │
│   ├── components/     ← componentes reutilizáveis
│   │   ├── agenda/
│   │   ├── inventory/
│   │   ├── stock/
│   │   ├── ui/         ← shadcn/ui (não editar manualmente)
│   │   └── ...
│   │
│   ├── hooks/          ← React hooks customizados
│   ├── lib/            ← utilitários (date-utils, etc.)
│   └── integrations/
│       └── supabase/
│           ├── client.ts   ← instância do Supabase (gerada automaticamente)
│           └── types.ts    ← tipos TypeScript gerados pelo Supabase
│
├── supabase/
│   ├── config.toml         ← project_id = "njxxqdcwvehlvqufuyww"
│   ├── migrations/         ← 301 migrations SQL (histórico completo)
│   └── functions/          ← Edge Functions (Deno)
│       ├── create-user-with-invite/
│       ├── delete-user/
│       ├── invoice-ocr/
│       ├── password-reset/
│       ├── password-verification-hook/
│       ├── update-overdue-status/
│       └── admin-set-password/
│
├── CLAUDE.md               ← este arquivo
├── package.json
├── vite.config.ts          ← porta dev: 8080, alias @ → src/
└── tsconfig.json
```

---

## 3. Supabase

| Campo | Valor |
|---|---|
| **Project ID** | `njxxqdcwvehlvqufuyww` |
| **URL** | `https://njxxqdcwvehlvqufuyww.supabase.co` |
| **Região** | `sa-east-1` (São Paulo) |
| **Anon Key** | hardcoded em `src/integrations/supabase/client.ts` |
| **Dashboard** | https://supabase.com/dashboard/project/njxxqdcwvehlvqufuyww |

### Como aplicar migrations no banco

Via MCP do Supabase (disponível no Claude Code com o plugin instalado):
```
apply_migration(project_id="njxxqdcwvehlvqufuyww", name="nome_snake_case", query="SQL...")
```

Após aplicar via MCP, **sempre salvar o arquivo local** em:
```
supabase/migrations/AAAAMMDDHHMMSS_nome_snake_case.sql
```

### Convenções de banco

- Todos os campos de status/tipo devem ser em **Português** (sem inglês):
  - `movement_type`: `'Entrada'`, `'Saída'`, `'Ajuste'`
  - `reference_type`: `'Compra'`, `'Produção'`, `'Ajuste'`, `'Perda'`, `'Ordem de Produção'`, `'Ciclo de Inventário'`, `'Ajuste de Inventário'`, `'Ajuste de Custo'`
  - `bom_production_orders.status`: `'Planejado'`, `'Em Produção'`, `'Concluído'`, `'Cancelado'`
  - `event_production_orders.status`: `'Planejado'`, `'Em Produção'`, `'Concluído'`, `'Cancelado'`
  - `inventory_cycles.status`: `'Rascunho'`, `'Contagem'`, `'Reconciliando'`, `'Fechado'`
  - `proposals.status`: `'Rascunho'` → `'Enviada'` → `'Aprovada pelo Cliente'` → `'Aprovada'` (+ `'Rejeitada'`, `'Cancelada'`). Fluxo: cliente **aceita** (`Aprovada pelo Cliente`, não gera nada) → equipe **revisa e aprova** (`Aprovada` → gera evento + ordens)
  - `materials.material_type` (chave **comportamental**, em inglês — exceção à regra PT-BR; define onde o item aparece): `'ingredient'`, `'packaging'`, `'intermediate_product'`, `'finished_product'`, `'composite_product'`, `'resale_product'`, `'equipment'`, `'supply'`
- Todas as funções SECURITY DEFINER devem ter `SET search_path = public`
- Constraints CHECK estão ativas nas tabelas — sempre verificar antes de inserir valores novos
- **Nunca excluir, somente desativar**: regra dura do sistema. Materiais usam `materials.is_archived = true` (não há `is_active` em materials). O `code` do material é **único e imutável** após a criação; os demais atributos são mutáveis. Desativar preserva histórico (NF, movimentação, fichas, propostas) e integridade referencial. No Cadastro há filtro de status (Ativos/Arquivados/Todos) + ação em massa **Reativar**. O **Controle de Estoque** mostra ativos por padrão, com toggle "Incluir arquivados" para ver saldo residual de descontinuados.
  - Os caminhos de **delete físico** de materiais (menu "Excluir Selecionados", `handleBulkDelete`, `deleteMaterial`, `RecipeMigrationDialog`) foram **removidos** (jun/2026). Ao tocar qualquer tela, auditar `.delete()` e trocar por desativação — ver memória `audit-hard-delete-paths`.

### Funções RPC principais

| Função | Descrição |
|---|---|
| `process_inventory_adjustment` | Ajuste de quantidade de estoque. Define o saldo direto em `stock_items` (qtd + valor), grava auditoria em `inventory_adjustments` e registra a movimentação em `stock_movements` (`'Ajuste'` / `'Ajuste de Inventário'`) quando há diferença. **Só existe a sobrecarga de 8 args** (a de 9 args com `p_cycle_id` era quebrada e foi removida) |
| `process_cost_adjustment` | Revalorização de custo (preço médio). **Sobrecarga única de 8 args** (a de 9 args com `p_cycle_id` era quebrada e foi removida). Grava na tabela dedicada `cost_adjustments` (não em `inventory_adjustments`), atualiza `stock_items.average_price/total_value` e registra `stock_movements` (`'Ajuste'`/`'Ajuste de Custo'`, qty 0) de auditoria |
| `bom_unit_content(uuid)` | Conteúdo líquido (peso g / volume mL) por unidade de uso de um produto, recursivo pela ficha: massa→g, volume→mL, contável→qtd×conteúdo do componente; `final_weight_manual` (override) tem prioridade; ÷ rendimento. Sem override = somatório dos ingredientes |
| `refresh_bom_weight_for_material(uuid)` | Recalcula `recipes_bom.cached_unit_weight` e sincroniza `materials.unit_weight` do produzido (cascateia p/ produtos que o usam) |
| `refresh_overdue_status()` | Marca AR/AP como `'Vencido'` quando `due_date < hoje` e há saldo. Agendada via **pg_cron** (`refresh-overdue-status-daily`, 06:00 UTC) |
| `recompute_bank_balance(uuid)` | `bank_accounts.current_balance = initial_balance + Σ(entradas−saídas)` do caixa da conta |
| `rpc_inventory_update_status` | Avança status do ciclo de inventário |
| `rpc_inventory_finalize` | Fecha ciclo e aplica todos os ajustes |
| `finalize_production_order` | Finaliza OP BOM com rendimento real; carimba custo real do lote no histórico e valora perdas |
| `reserve_stock_for_production_order` | Reserva estoque para OP |
| `compute_product_pricing(uuid)` | Calcula precificação do produto (custo, overhead, margem efetiva, preço sugerido/praticado, margem realizada) resolvendo produto→categoria→global |
| `recompute_all_pricing()` | Recalcula `suggested_price` de todos os tipos vendáveis (usar após mudar default global/categoria) |
| `create_event_from_proposal(uuid)` | Gera **1 evento na agenda por composição** da proposta (idempotente) |
| `generate_production_from_proposal(uuid)` | Gera **Ordem de Evento** (separação, `event_production_orders`) por composição + **Ordem de Produção** (`bom_production_orders`) só do **déficit vs estoque** |
| `approve_proposal_by_token(text)` | Cliente aceita pela página pública → status `'Aprovada pelo Cliente'` (NÃO gera; geração é na aprovação final da equipe) |

### Taxonomia de materiais (3 eixos independentes) e motor de proposta

- **Taxonomia** em `taxonomy_definitions` (keys: `material_type`, `material_category`, `material_subcategory`, `material_restriction`) + `taxonomy_terms` (hierárquico por `parent_id`). `term_id` é a **fonte da verdade**; as colunas texto `materials.category/subcategory` são sincronizadas a partir do termo.
  - **Tipo** = papel no sistema (`material_type`, 8 valores acima). **Categoria → Subcategoria** = domínio de negócio (9 categorias canônicas: Alimentos & Ingredientes, Doces & Confeitaria, Salgados, Bebidas, Embalagem, Higiene e Limpeza, Equipamentos, Operacionais, Kits & Mesas).
  - **Tags de restrição/característica** = eixo transversal (Low Fat, Vegano, Sem Glúten…) — taxonomia `material_restriction` + tabela de ligação `material_tags (material_id, term_id)` (many-to-many). Um produto pode ter várias.
- **Proposta = o MOMENTO (composição) é a unidade central.** `proposals` (cabeçalho: `event_name`, cliente, `proposal_date`, solicitante/`portal_created_by`, departamento, contato, **unidade**=endereço que dirige o frete único) → **`proposal_compositions`** (por momento: `name`, **`event_category`** (tipo), `scheduled_date/time`, **`room_id`** (sala), `location`, **`number_of_people`**, `price_per_person`) → `proposal_categories` (seções, com `composition_id`) → `proposal_category_items`. O compositor (`ProposalEditor.tsx`) monta seções por categoria + Low Fat por tag. PDF (`ProposalPDF.tsx`) e geração de evento/ordens são **por composição**.
  - **Nº de pessoas, tipo de evento e sala são por momento**; o total de pessoas da proposta é derivado (soma). Campos legados de cabeçalho (`event_category`, `event_date`, `number_of_people`) são mantidos sincronizados como derivados (tipo do 1º momento, menor data, soma) p/ PDF/lista/RPCs. `create_event_from_proposal` usa o **nome da sala** (`room_id`) como local do evento.
  - **Indicadores de consumo por pessoa**: a proposta separa **comida (g)** e **bebida (mL)** por momento (bebida = categoria `'Bebidas'`), usando `unit_weight` (conteúdo por unidade). Objetivo: padrões de consumo (peso de comida/pessoa e mL de bebida/pessoa).
  - **Portal** alinhado ao mesmo modelo: wizard captura `event_name` + tipo por momento; `create_portal_order`/`get_portal_proposal(s)` gravam/expõem `event_name` e `event_category` por composição.

### Matriz tipo→comportamento (espinha dorsal, estilo SAP MTART)

`material_type` governa toda a cadeia. **Comportamento deriva do tipo**, nunca de flags paralelas:

| Tipo | Aprovisionamento | Custo (origem) | Ficha | Vendável/preço | Estoque |
|---|---|---|---|---|---|
| `ingredient` / `packaging` / `supply` | Compra | preço médio compra | Não | Não | Sim |
| `intermediate_product` | Produção | custo-padrão (ficha) | Sim | Não | Sim |
| `finished_product` | Produção | custo-padrão (ficha) | Sim | **Sim** | Sim |
| `composite_product` | Montagem | custo componentes | Sim (`composites_bom`) | **Sim** | Sim |
| `resale_product` | Compra | preço médio compra | Não | **Sim** | Sim |
| `equipment` | Compra (ativo) | compra | Não | Não | Especial |

- `is_sellable` é **derivado do tipo** no banco (trigger `trg_enforce_is_sellable`): vendável = finished/composite/resale.

### Custo e precificação

- **Custo do produto = custo-padrão (rolled-up)**, vivo: `recipes_bom.cached_unit_cost` = Σ(insumo `average_price` × qtd) ÷ rendimento, recalculado pela cascata `trigger_refresh_bom_costs_on_material_price_change` quando um insumo muda de preço. Dono de `materials.cost_price` e `stock_items.average_price` dos produzidos.
- **Custo real do lote** é carimbado no `stock_movements` da produção (`finalize_production_order`) p/ CMV/DRE; **não** altera o custo-padrão. Média ponderada (`trg_update_weighted_average`) é só p/ itens **comprados** — entradas de produção são excluídas.
- **Peso/volume do produto = rollup da ficha** (espelha o custo): `recipes_bom.cached_unit_weight` = Σ(conteúdo dos ingredientes) ÷ rendimento (massa→g, volume→mL, contável→qtd×`unit_weight`), com **override manual** `recipes_bom.final_weight_manual` (perda por cocção/evaporação). Sincroniza `materials.unit_weight` dos produzidos, com cascata quando o peso de um insumo muda. Para produzidos, o `unit_weight` é **derivado** (read-only no cadastro); insumos comprados mantêm `unit_weight` manual.
- **Perda** = saída valorada (qtd × custo) → despesa, sem mexer no custo do produto.
- **Preço de venda** (só tipos vendáveis): hierarquia margem/overhead **produto → categoria (`pricing_rules`) → global (`app_settings` `pricing.*`)**. `compute_product_pricing(material_id)` calcula; `suggested_price` (cache) mantido por `trg_material_pricing_refresh`. `preço = (custo + overhead)/(1 − margem)`. `practiced_price` (manual) é o preço que a proposta usa (senão `suggested_price`). Config em **Configurações > Precificação**; por produto na aba **Precificação** do cadastro. Proposta mostra **lucratividade por composição**.
- Produção consolidada no fluxo de **Ordem de Produção** (`finalize_production_order`); o fluxo "Executar Produção" / `produce_finished_product` / `assemble_composite` foi **aposentado** (quebrado e conflitante).

### Financeiro e contábil (regime de competência) — nível PME

Reforma jun/2026, **nível PME** (Simples Nacional): relatórios corretos, **sem** partidas dobradas/razão/balanço formal (isso fica com o contador externo). Ver memória `finance-accounting-model`.

- **DRE = regime de COMPETÊNCIA**: receita e custo reconhecidos na **ENTREGA do serviço/evento** (princípio do confronto), nunca no recebimento/pagamento. O **prazo de pagamento do cliente rege só o CAIXA**.
  - `accounts_receivable.competence_date` e `accounts_payable.competence_date` (default = `issue_date` via trigger; p/ eventos = data da entrega; editável em Contas a Receber, campo "Competência (entrega)").
  - `DRE.tsx`: receita = AR por `competence_date`; despesas = AP por `competence_date` (antes filtrava por `due_date`, errado). **PDD** (provisão p/ inadimplência) por faixa de atraso: >90d 100%, 61-90 50%, 31-60 25%, deduzida como despesa operacional. Painel **"reconhecida (competência) × recebida (caixa) × a receber × vencida"**.
- **Fluxo de Caixa = regime de CAIXA**: `cash_transactions` por `transaction_date`. Recebimento (`receipt_transactions`)/pagamento (`payment_transactions`) geram caixa via triggers `insert_cash_on_receipt`/`insert_cash_on_payment` (que agora carregam `bank_account_id`: transação→conta→padrão).
- **Saldo bancário** sincronizado por trigger (`recompute_bank_balance`): `current_balance = initial_balance + Σ(entradas−saídas)`. **Conta padrão única = "Principal"**. ⚠️ o **saldo inicial real** de cada conta deve ser informado em Contas Bancárias p/ bater com o extrato.
- **Vencidos** marcados diariamente por `refresh_overdue_status()` via **pg_cron**.
- **Plano de contas** (`chart_of_accounts`): hierárquico, `is_postable` (analítica/sintética); despesas financeiras = código `5.3.x`. Centros de custo em `cost_centers`.
- Telas em `src/pages/financeiro/` (DRE, FluxoCaixa, ContasPagar/Receber, AgingReport, CashFlowForecast, PlanoContas, CentrosCusto, ContasBancarias, RecurringTransactions). **Competência** já tem campo em Contas a Pagar **e** a Receber (default = emissão via trigger). **Fluxo de Caixa unificado**: `FluxoCaixa.tsx` é a página-casca com abas **Realizado** (extrato `cash_transactions`) e **Previsto** (`CashFlowForecast` embutido via prop `embedded`); a rota `/financeiro/previsao` abre direto na aba Previsto e o card/sidebar "Previsão de Caixa" foi removido (dobrado no Fluxo de Caixa). A previsão considera contas `Pendente` + `Parcial`. Avançado (não feito, fica com contador): partidas dobradas / razão / balanço patrimonial formal.

### Triggers importantes

| Trigger | Tabela | Função | Comportamento |
|---|---|---|---|
| `trg_sync_stock_quantity` | `stock_movements` | `trigger_sync_stock_quantity` | Recalcula `stock_items.current_quantity` em INSERT/UPDATE/**DELETE** (jul/2026: função lia só `NEW`, quebrava em DELETE — corrigida p/ usar `OLD` nesse caso). **EXCEÇÃO**: pula o recálculo para `movement_type = 'Ajuste'` (a função já faz UPDATE direto) |
| `trg_update_weighted_average` | `stock_movements` | `trigger_update_weighted_average_on_purchase` | Recalcula preço médio ponderado em entradas com unit_price. **EXCEÇÃO**: pula entradas de produção (`reference_type` `'Ordem de Produção'`/`'Producao'`/`'production'`) — custo do produzido é o custo-padrão |
| `trg_update_bom_costs` | `stock_items` | `trigger_update_bom_costs_on_price_change` | Cascateia atualização de custo nas fichas técnicas |
| `trg_material_pricing_refresh` | `materials` | `trg_material_pricing_refresh` | Recalcula `suggested_price` ao mudar `material_type`/`cost_price`/overrides de margem; só p/ tipos vendáveis |
| `trg_enforce_is_sellable` | `materials` | `enforce_is_sellable_from_type` | Deriva `is_sellable` do `material_type` (vendável = finished/composite/resale) |
| `trg_sync_recipe_archive` | `materials` | `sync_recipe_archive_with_material` | Ao mudar `materials.is_archived`, sincroniza `recipes_bom.is_archived` das fichas daquele produto. A ficha **segue** o produto (arquivar/reativar o material leva a ficha junto), evitando drift |
| `trg_bom_weight_on_items` / `trg_bom_weight_on_recipe` | `recipe_bom_items` / `recipes_bom` | `refresh_bom_weight_for_material` | Recalcula `cached_unit_weight` ao mudar itens, rendimento ou override manual da ficha |
| `trg_cascade_weight_on_material` | `materials` | `trg_cascade_weight_on_material` | Peso de um insumo mudou → recalcula o peso dos produtos que o usam (cascata, como o custo) |
| `trg_sync_bank_balance` | `cash_transactions` | `recompute_bank_balance` | Mantém `bank_accounts.current_balance` = inicial + Σ(entradas−saídas) da conta |
| `trg_default_competence_ar` / `trg_default_competence_ap` | `accounts_receivable` / `accounts_payable` | `default_competence_date` | `competence_date` recebe `issue_date` quando não informada |

### Segurança do banco (hardening jul/2026)

Auditoria disparada pelo Supabase Advisor (migrations `20260701000001`–`20260701000005`). Ver memória `db-security-hardening-jul2026`.

- **2 CRITICAL corrigidos**: `vw_stock_available` → `security_invoker = true` (rodava com permissão do criador da view); `_backup_material_names` (backup manual pré-reclassificação, jun/2026) → RLS habilitado sem policies (estava legível por qualquer anon key).
- **14 funções** com `search_path` mutável → `SET search_path = public`.
- **`pricing_rules`**: policy `ALL` liberada p/ qualquer autenticado → restrita a admin/manager via `is_admin_or_manager()`.
- **~110 funções `SECURITY DEFINER` de mutação** (estoque/custo/produção/financeiro/materiais/portal/diagnóstico): `EXECUTE` era concedido a `PUBLIC` → chamáveis por qualquer um na internet com a anon key, sem login. Revogado de `PUBLIC`, `authenticated` mantido.
  - ⚠️ **Armadilha real**: `REVOKE ... FROM anon` não basta se o ACL concede a `PUBLIC` (aparece como `=X` em `pg_proc.proacl`) — todo papel herda `PUBLIC`. É preciso `REVOKE ... FROM PUBLIC`; verificar com `has_function_privilege('anon', oid, 'EXECUTE')`.
- **Deliberadamente NÃO tocados**: helpers de permissão/máscara (usados dentro de RLS de outras tabelas), funções de log/rate-limit (rodam pré-auth) e fluxo público por token (`approve_proposal_by_token` — anon por design).
- **Pendente (não urgente, liga ao #200)**: 174 warns `authenticated_security_definer_function_executable` — qual role autenticado pode chamar cada RPC é objetivo da fundação multi-tenant. `pg_trgm` em `public` deixado (cosmético).

---

## 4. GitHub

| Campo | Valor |
|---|---|
| **Repositório** | https://github.com/Macriptofin/coffeeliergestao |
| **Branch principal** | `main` |
| **Remote** | `origin` |

### Fluxo de trabalho

1. Todo desenvolvimento é feito direto na pasta local `/Users/macielluchtemberg/Projetos/coffeeliergestao`
2. O Lovable (plataforma de deploy) monitora `origin/main` e faz deploy automático
3. Branches de feature foram usadas historicamente mas o trabalho atual é direto no `main`

### Estado atual do repositório (julho 2026)

Working tree limpo — trabalho commitado e empurrado direto no `main` (deploy automático Vercel).

**Depuração do catálogo de materiais (jun/2026)** — concluída e no ar (migrations `20260620000001`–`20260620000007`):
- Exclusão de 26 itens duplicados/obsoletos via `is_archived` (com merge de Óleo→Oleo de Soja e Água sem Gás→Água Mineral sem Gás nas fichas antes de arquivar).
- Reclassificação em massa de 254 itens (tipo/categoria/subcategoria texto+`term_id` + unidades) e limpeza da taxonomia (53 subcategorias canônicas; duplicatas desativadas).
- Controle de Estoque passou a filtrar arquivados (toggle "incluir arquivados"); saneamento dos saldos residuais de descontinuados (zerados, auditados em `inventory_adjustments`, sem impacto em DRE).
- Trigger `trg_sync_recipe_archive` (ficha segue o material) e ferramenta de ativar/desativar no Cadastro.
- **#100 concluído de fato**: `process_inventory_adjustment` agora registra `stock_movements`; removida a sobrecarga quebrada de 9 args.

**Reforma de proposta, ficha e financeiro (jun/2026)** — no ar (migrations `20260621000003`–`20260621000013`):
- `process_cost_adjustment` unificado (1 sobrecarga; grava em `cost_adjustments` + `stock_movements`).
- **Proposta reorganizada em torno do momento**: `proposals.event_name` (cabeçalho) + `proposal_compositions.event_category`/`room_id`/`number_of_people` (por momento); total derivado; portal alinhado.
- **Rollup de peso/volume na ficha** (`cached_unit_weight`, `final_weight_manual`, cascata) → `materials.unit_weight` derivado p/ produzidos; proposta/PDF mostram comida g/pessoa e bebida mL/pessoa por momento.
- **Financeiro nível PME**: DRE por competência + PDD + painel reconhecida×recebida×a receber; `competence_date` em AR/AP; saldo bancário sincronizado; vencidos via pg_cron; caixa carrega o banco. Ver seção "Financeiro e contábil".
- Removidos os caminhos de **delete físico** de materiais (só desativar).
- **code-splitting** das rotas (lazy + Suspense) e botão fantasma "Salvar e Continuar" removido.

**Migração de infra + segurança (jul/2026)** — no ar (commits `985bc8e`…`cdd5574`):
- **Hospedagem migrada de Lovable → Vercel** (#24): deploy automático via push no `main`; backend Supabase inalterado. Domínio próprio `app.coffeelier.com.br`. Ver Seção 11.
- **Financeiro concluído no front**: campo Competência em Contas a Pagar; Fluxo de Caixa unificado (abas Realizado × Previsto numa página só; card/menu "Previsão de Caixa" removido).
- **Headers de segurança HTTP reais** via `vercel.json` (CSP, X-Frame-Options, etc.); removido o "teatro de segurança" client-side (`SecurityHeader.tsx`, bloqueio de F12).
- **Hardening do banco** (Advisor): ver subseção "Segurança do banco" na Seção 3.
- Marca visual: favicon/ícones oficiais da Coffeelier substituíram o ícone genérico.

> Lembrete de fluxo: commit/push só quando o usuário pedir; trabalhar direto no `main`. Mensagens de commit em PT-BR.

---

## 5. Desenvolvimento Local

```bash
# Instalar dependências
cd /Users/macielluchtemberg/Projetos/coffeeliergestao
npm install

# Rodar em dev (porta 8080)
npm run dev

# Build de produção
npm run build

# Lint
npm run lint
```

### Alias de imports

Usar sempre `@/` em vez de caminhos relativos:
```typescript
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
```

---

## 6. Estrutura de Módulos do Sistema

| Módulo | Página principal | Descrição |
|---|---|---|
| Dashboard | `Dashboard.tsx` | KPIs e visão geral |
| Materiais | `Materials.tsx` / `Materiais.tsx` | Cadastro de insumos e produtos |
| Estoque | `Stock.tsx` / `EstoqueMovimentacoes.tsx` | Saldo, histórico, ajustes, ciclos de inventário |
| Fichas Técnicas | `Recipes.tsx` | BOM (bill of materials) para produção |
| Produção | `ProducaoMain.tsx` + `production/` | Ordens de produção BOM e por evento |
| Compras | `Purchases.tsx` | Necessidades (planejamento MRP/ABC), notas fiscais, contas a pagar, fornecedores, cotações |
| Financeiro | `Financeiro.tsx` + `financeiro/` | Contas a pagar/receber, fluxo de caixa, DRE, plano de contas |
| Propostas | `Sales.tsx` + aprovação via link | Propostas comerciais com PDF |
| Agenda | `Agenda.tsx` | Calendário de eventos + cards operacionais |
| Fornecedores | `Suppliers.tsx` | Cadastro com campos fiscais e localização |
| Configurações | `Config.tsx` | Formas de pagamento, taxonomia, permissões |
| RH | `RecursosHumanos.tsx` + `rh/` | Colaboradores, ponto |
| Segurança | `SecurityMonitoring.tsx` | Auditoria e anomalias |
| Portal do Cliente | `pages/portal/*` + `Sales.tsx` aba "Portal" | Canal externo de autoatendimento (`/portal/*`) |

### Portal do Cliente (CRM Fase 5 / #22)

Canal externo "loja online" para o cliente acompanhar/aprovar propostas (Fase 1 no ar) e, em breve, montar pedidos (Fase 2). Rotas `/portal/login`, `/portal`, `/portal/proposta/:id` (guarda `PortalRoute`). Admin interno em **Vendas → aba Portal** (`PortalAdmin`): solicitações de alteração, locais a aprovar, acessos e configurações (WhatsApp/e-mail).

- **Acesso**: mesmo Supabase Auth; `user_profiles.user_type='client'` + `client_users (user_id, client_id, portal_role 'solicitante'|'aprovador')`. Convite pela aba Portal do cadastro do cliente (edge `invite-client-user`); redefinição `portal-reset-password`. **E-mail já interno não pode virar cliente** (perderia acesso interno).
- **Visibilidade POR USUÁRIO**: cada usuário vê só os pedidos que **ele criou** (`proposals.portal_created_by = auth.uid()`), não todos do cliente. Em aberto: visibilidade do aprovador sobre pedidos de solicitantes da área.
- **Segurança**: leitura via RPCs SECURITY DEFINER (`get_portal_proposals`, `get_portal_proposal`, `get_portal_settings`) que nunca expõem custo/margem; RLS aditivo escopa o cliente; helpers `current_portal_client_id()`/`is_portal_client()`/`is_internal_user()`. Aprovação mantém **gate interno** (`approve_proposal_as_client` → 'Aprovada pelo Cliente'; equipe confirma → dispara cadeia). Alterações via `request_proposal_change`.
- **Deploy**: Edge Functions **não** sobem no publish do app — exigir `supabase functions deploy <nome>`. Client é PKCE + `detectSessionInUrl:false` → `PortalLogin` faz `exchangeCodeForSession` no retorno do e-mail.

### Necessidades de Compra (MRP unificado) — jul/2026

**Compras → aba Necessidades** (`StockPlanning.tsx`, mesmo componente também em Materiais → Gestão de Estoque → Planejamento): fonte única de necessidade de compra, unificando dois motores que existiam separados e nenhum completo. Analisa `stock_parameters` (classificação ABC, mínimo, máximo, ponto de pedido, estoque de segurança, lead time — configurados manualmente em `StockParameters.tsx` ou via **"Sugerir Classificação ABC"**, que calcula curva de Pareto do valor de consumo real dos últimos 180 dias, RPC `suggest_abc_classification`) + demanda de eventos futuros confirmados na Agenda no horizonte escolhido (7/14/30/60d, RPC `explode_event_requirements`). `projected_stock = estoque_atual − demanda_de_eventos`; dispara necessidade se `projected_stock ≤ ponto_de_pedido`, recomendando repor até o `máximo`. Material com demanda de evento mas sem parâmetro configurado aparece como linha "sem parâmetro ABC" (não escondido). Botão **"Gerar Requisições"** fecha o loop: cria `purchase_requirements` de verdade (evita duplicar — se já existe requisição aberta pro material de uma execução anterior, só vincula nela em vez de criar outra).

- **Só materiais comprávels** (`ingredient`/`packaging`/`supply`/`resale_product`/`equipment`) entram em `stock_parameters`/passada reativa — produzidos sob demanda (`intermediate_product`/`finished_product`/`composite_product`, ex.: um sanduíche montado horas antes do evento, estoque sempre zerado) nunca viram necessidade de compra, só os insumos da ficha técnica deles.
- **`explode_event_requirements` agora explode recursivamente fichas em cascata** — corrigido um bug real: antes só descia UM nível (se um componente da ficha era ele mesmo `intermediate_product`/`finished_product`, ficha em cascata, voltava como "compra isso" em vez de continuar explodindo). Agora desce até chegar só em insumos comprávels, via helper `explode_bom_to_purchasable` (recursivo, guarda contra ciclo/profundidade).
- **Aposentado**: `MRPGenerator.tsx` (reativo por `stock_items.minimum_quantity`/`ideal_qty`, praticamente vazio — 2/290 e 0/290 configurados — sem ABC/máximo/ponto de pedido) e `EstoquePlanejamento.tsx` (já era código morto, nenhuma rota apontava pra ele).
- `stock_items.minimum_quantity`/`ideal_qty` continuam existindo só como indicador visual (badge de status em Estoque/Dashboard) — não alimentam mais a geração de requisição.

### Cotações (RFQ) em Compras — Fase 1 manual (jul/2026)

**Compras → aba Cotações** (`QuoteRequestsList.tsx` → `QuoteRequestForm.tsx`/`QuoteRequestDetail.tsx`): o comprador cria uma cotação (prazo, itens a cotar), adiciona os fornecedores que está comparando e digita manualmente o preço que cada um passou por fora do sistema (telefone/WhatsApp/e-mail) — a matriz item×fornecedor destaca o mais barato por linha e permite marcar o vencedor. Schema reaproveitado de set/2025 (`quote_requests`, `quote_request_suppliers`, `supplier_quotes`, `supplier_quote_items`, todo em `is_admin_or_manager`), que estava 100% morto (zero UI); somado a `quote_request_items` (nova, jul/2026 — a lista mestra do que foi pedido, independente da resposta de qualquer fornecedor) e a FK `supplier_quote_items.quote_request_item_id`. Numeração automática `COT-AAAA-NNNN` (`generate_quote_number`, sem `SECURITY DEFINER`). Status em PT-BR com CHECK: `quote_requests.status` (`Coletando Cotações`/`Concluída`/`Cancelada`), `supplier_quotes.status` (`Recebida`/`Selecionada`/`Rejeitada`).

- **Fase 1 (no ar)**: unidade travada na do pedido (não compara preço em unidades diferentes); `quote_request_suppliers.response_status`/`sent_at`/`responded_at` existem mas não são escritos ainda (pressupõem um fluxo de envio/resposta que só existe na Fase 2).
- **Fase 2 (futura, não implementada)**: o próprio fornecedor logaria e preencheria a cotação dele — mesmo padrão do Portal do Cliente (`supplier_users` espelhando `client_users`, `current_portal_supplier_id()`, RLS aditiva em `supplier_quotes`/`supplier_quote_items` por `supplier_id`, RPCs que escondem o que não deve ser visto). `quote_request_items` já é, hoje, exatamente a lista que esse fornecedor veria — nenhuma mudança de schema da Fase 1 precisa ser desfeita.

### Cadeia completa: Requisição → Cotação → Pedido de Compra (jul/2026)

**Compras → aba Requisições** (`PurchaseRequestsList.tsx`, antes placeholder "Em breve", agora ligada): lista `purchase_requests` (criadas a partir de uma necessidade em `PurchaseRequirements.tsx`, botão "Criar Requisição"), aprova/rejeita. Requisição **aprovada** ganha botão **"Criar Cotação"** → navega pra `/compras?fromRequest=<id>#cotacoes`, que abre `QuoteRequestForm` já com os itens da requisição importados (convertidos de unidade de uso pra unidade de compra pelo `conversion_factor` do material) e grava `quote_requests.request_id`. Uma cotação referencia no máximo **uma** requisição de origem (FK singular, sem tabela de junção).

Na cotação, depois de marcar um fornecedor **Selecionada**, aparece **"Criar Pedido de Compra"**: copia os `supplier_quote_items` do vencedor pra `purchase_orders`/`purchase_order_items` (avisa, sem bloquear, se o fornecedor não cotou todos os itens pedidos), e fecha a rastreabilidade — `purchase_requests.purchase_order_id` e `purchase_requirements.status='ordered'`. **Compras → aba Pedidos** (`PurchaseOrders.tsx`, antes só leitura): ver itens, status `Pendente → Aprovado → Enviado` (marcação manual, sem envio real — mesma disciplina das Cotações).

**Dois achados de schema corrigidos nesta entrega** (confirmados ao vivo no banco, não presumidos pela migration):
- `purchase_requests.request_number` nunca teve trigger de geração (`generate_request_number`, formato `REQ-AAAA-NNNN`, adicionado agora) — a 2ª requisição de qualquer material estourava `UNIQUE` em `request_number=''`.
- `purchase_orders` em produção **não tinha** o schema que a migration de set/2025 dizia criar: `CREATE TABLE IF NOT EXISTS` rodou contra uma tabela homônima *mais antiga* (23/set) e foi um no-op silencioso — `quote_request_id`/`supplier_quote_id`/`payment_terms`/`approved_by`/etc. não existiam de fato. Adicionadas via `ALTER TABLE`; status recriado em PT-BR (`Pendente`/`Aprovado`/`Enviado`/`Recebido`/`Cancelado`). `purchase_order_items` também só tinha RLS de `SELECT` (mesmo bug de `stock_planning_results`, corrigido igual).

**"Receber" o pedido, fechando com a NF (jul/2026)** — Compras → Notas Fiscais ganhou o botão **"Lançar Pedido de Compra"**: abre um seletor dos pedidos `Aprovado`/`Enviado` ainda sem NF vinculada, pré-preenche fornecedor + itens (convertidos p/ unidade de uso) no `InvoiceEditDialog` e grava `purchase_invoices.purchase_order_id` (FK que já existia, nunca lida/escrita por nenhum código). Ao lançar essa NF no estoque (`postToStock`), o pedido de origem é marcado `status='Recebido'` — fecha a rastreabilidade sem duplicar lógica de baixa em `purchase_order_items.quantity_received` (deliberadamente não usado). Reaproveita o posting de estoque que a NF já fazia certo.
- **Achado corrigido nesta entrega**: `InvoiceEditDialog` não desmonta entre aberturas — o `supplierId` interno só inicializava 1x via `useState(prop)`, então trocar de NF (ou pré-preencher a partir de um pedido) não ressincronizava o fornecedor selecionado, exigindo escolha manual mesmo já sabendo o ID certo. Corrigido ressincronizando `supplierId` a cada abertura do dialog.
- **Achado corrigido nesta entrega (fora do escopo da feature, mas bloqueava até o teste)**: `trg_sync_stock_quantity` dispara em `INSERT OR DELETE OR UPDATE`, mas a função só lia `NEW` — em `DELETE`, `NEW` é nulo, e o `INSERT INTO stock_items` subsequente violava o `NOT NULL` de `material_id`, derrubando **qualquer exclusão de `stock_movements`** (inclusive o fluxo já existente de excluir uma NF já lançada, que reverte os movimentos). Corrigido pra usar `OLD` em `DELETE`.
- **Fora de escopo, não construído**: baixa formal de `purchase_order_items.quantity_received` — a FK + o flip de status já fecham o ciclo operacional; granularidade por item fica pra quando/se fizer falta.

---

## 7. Tasks Pendentes (backlog ativo)

| ID | Descrição | Prioridade |
|---|---|---|
| ~~#73~~ | ~~Filtros em Contas a Pagar (período, status, fornecedor)~~ — ✅ Concluído (auditado jul/2026: `ContasPagar.tsx` já tem os 3 filtros, com atalhos de período + range livre) | — |
| ~~#74~~ | ~~Fix datas: frete e handleMarkPaid~~ — ✅ Concluído (jun/2026, fuso local centralizado) | — |
| ~~#75 / #65~~ | ~~Lançamento sem NF: despesas diretas / Suporte a lançamentos sem nota fiscal~~ — ✅ Concluído (eram o mesmo item duplicado; `accounts_payable.document_type` desde jun/2026 com fornecedor/nº de documento opcionais quando não é `nota_fiscal`) | — |
| ~~#64~~ | ~~Fluxo de caixa: usar data de pagamento~~ — ✅ Concluído (reforma financeira jun/2026: `cash_transactions.transaction_date` já vem de `payment_date` via trigger `insert_cash_on_payment`) | — |
| ~~#91~~ | ~~Frontend: seção fiscal por item + IPI no custo unitário~~ — ✅ Concluído (`InvoiceItemMatcher.tsx`: NCM/CST/CFOP/ICMS/IPI por item, IPI somado ao custo unitário de estoque) | — |
| ~~#70~~ | ~~Revisão completa fichas técnicas e ordens de produção~~ — ✅ Concluído (jul/2026: `ProductionReportsEnhanced.tsx`/`loadCostData` corrigido pra consultar `recipes_bom`/`recipe_bom_items` em vez das tabelas antigas `recipes`/`recipe_ingredients`; aba "Análise de Custos" agora mostra custo/margem reais. A aba "Relatórios de Produção" do mesmo arquivo segue como placeholder — não fazia parte deste item, é escopo novo em aberto se for retomado). | — |
| #102 | Concluir migração react-query: **~24-35 arquivos reais restantes** (reestimado jul/2026, era ~53) — ~24 componentes + ~11 hooks sem `useQuery`/`useMutation`. Boa parte dos hooks é de segurança/monitoramento (`useSecurityMonitoring`, `useEnhancedSecurityMonitoring`, `useSecurityScanner`, `useSecurityAlerts`, `useRateLimiting`, `useSecureClientData`, `useSecureEmployeeData`) — candidatos a excluir do escopo (padrão já é auth/segurança fora do react-query). Migrar o resto ao tocar em cada área. Ver memória `react-query-data-fetching-standard`. | Média |
| #34 | Geocodificação precisa via Google Maps API — confirmado pendente (jul/2026): hoje é CEP → BrasilAPI → Haversine (`src/lib/geo.ts`, linha reta aproximada); já arquitetado para trocar por Google Routes/Mapbox sem mudar os chamadores, mas o provedor real ainda não foi integrado | Baixa |
| #200 | **SaaS multi-tenant (vender o sistema por assinatura)** — épico futuro, depois de organizar o resto. Fases: (1) **fundação multi-tenant** = `organizations` + `org_id` em todas as tabelas + RLS por `current_org_id()` + auditar funções SECURITY DEFINER + **testes de isolamento** + pen test (pré-requisito inegociável de tudo); (2) onboarding self-service + baseline "empresa vazia" (hoje há seeds Coffeelier); (3) billing (planos, Stripe/Asaas, limites e feature-flags por org); (4) white-label + back-office/superadmin + LGPD (export/exclusão, DPA); (5) infra de produção (depende do #24). Reaproveita o padrão de isolamento já validado no Portal (`current_portal_client_id`). Ver memória `saas-multitenant-roadmap`. | Futuro/Estratégico |

---

## 8. Convenções de Código

- **TypeScript**: `noImplicitAny: false`, `strictNullChecks: false` — tolerante, não forçar tipagem rígida
- **Componentes**: PascalCase, um arquivo por componente
- **Hooks**: prefixo `use`, em `src/hooks/`
- **Datas**: sempre usar `formatLocalDate` de `@/lib/date-utils` para evitar offset de timezone
- **Toasts**: usar `toast.success()` / `toast.error()` do `sonner`
- **Forms**: `react-hook-form` + `@hookform/resolvers` com zod
- **Ícones**: `lucide-react`
- **Queries**: `@tanstack/react-query` para cache; Supabase direto para mutations simples

---

## 9. Variáveis de Ambiente

O app **funciona sem `.env`** — há fallback hardcoded em `src/integrations/supabase/client.ts` (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`/`VITE_SUPABASE_PUBLISHABLE_KEY`). Definir as variáveis apenas torna explícito o alvo e permite trocar de projeto Supabase sem editar código.

> A **anon key é pública por design** (já vai no bundle do navegador) — não é segredo.

- **Produção (Vercel)**: definir em *Project Settings → Environment Variables*.
- **Local**: copiar `.env.example` para `.env.local` e preencher:

```
VITE_SUPABASE_URL=https://njxxqdcwvehlvqufuyww.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

---

## 10. Edge Functions (Supabase)

Localização: `supabase/functions/<nome>/index.ts`

| Função | `verify_jwt` | Uso |
|---|---|---|
| `create-user-with-invite` | true | Admin cria usuário e envia convite |
| `delete-user` | true | Admin deleta usuário do Auth |
| `invoice-ocr` | true | OCR de nota fiscal via IA |
| `password-reset` | false | Reset de senha por email |
| `password-verification-hook` | false | Hook de verificação de senha |
| `update-overdue-status` | false | Atualiza status de contas vencidas (cron) |
| `admin-set-password` | true | Admin define senha manual |

Para deploy de edge function:
```bash
supabase functions deploy <nome> --project-ref njxxqdcwvehlvqufuyww
```

---

## 11. Arquitetura de Marcas e Domínios

### Hospedagem

| Camada | Onde | Observação |
|---|---|---|
| **Frontend** | **Vercel** | Deploy automático via push no `main`. Migrado do Lovable em jul/2026 (#24). |
| **Backend** | **Supabase** | Inalterado na migração (mesmo project `njxxqdcwvehlvqufuyww`, região `sa-east-1`). |

`vercel.json` define: framework Vite, SPA `rewrites` (React Router), cache longo em `/assets/*` e **headers de segurança HTTP reais** (CSP, X-Frame-Options: DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy). O CSP escopa `img-src`/`connect-src` ao domínio Supabase e Google Fonts.

### Domínios

| Domínio | Uso |
|---|---|
| **`app.coffeelier.com.br`** | Produção (sistema de gestão). Domínio oficial. |
| `coffeeliergestao.vercel.app` | URL técnica da Vercel (fallback/preview). |
| `app.coffeelier.com.br/portal/*` | Portal do cliente (mesmo app, rotas `/portal`). |

- **DNS** no **Registro.br** ("Configurar Zona DNS"): `app` → CNAME apontando para a Vercel. SSL **auto-provisionado pela Vercel** após detectar o DNS (alguns minutos de lag são normais).
  - ⚠️ **Gotcha Registro.br**: o painel **não faz troca A→CNAME atômica** no mesmo `Nome` — valida contra o estado salvo, não o pendente. É preciso **deletar+salvar** e depois **adicionar+salvar** em operações separadas. Para diagnosticar propagação vs. save falho, consultar o nameserver autoritativo direto (`dig @<ns>`).
- **Supabase Auth → Redirect URLs**: precisa listar `https://app.coffeelier.com.br/**`. (Havia um `coffeeliergestao.vercel.app/**` temporário de teste — remover.)

### Identidade visual

- **Ícones da marca** (o "C" da Coffeelier) em `public/`: `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`. Referenciados em `index.html`; OG/Twitter apontam para `https://app.coffeelier.com.br/icon-512.png`.
- **Cores** — as 5 cores da paleta em `src/index.css` (tokens HSL) **já batem com o MIV oficial**: Oliva `--primary #626432`, Café `--foreground/--accent-coffee #552D19`, Caramelo `--secondary #C06C3A`, Mocca `--accent-mocca #DAAA73`, Creme `--background/--accent-creme #FCE8D0`. Os tokens `--sidebar-*` (do primitivo shadcn `ui/sidebar.tsx` — hoje sem uso no app; o sidebar real é `components/Sidebar.tsx` e já usava os tokens de marca) foram harmonizados com a paleta (jul/2026), substituindo o default cinza/azul do shadcn.
- **Fontes** (Google Fonts): **Inter** para o sistema interno; **Dancing Script** para documentos de cliente (proposta em PDF). Consolidação concluída (jul/2026) — ver `BRAND.md` §12.3: Fraunces/Nunito (Portal) e Times New Roman (impressões) foram removidas; Beround/Adelia (MIV) ficam só como referência de design, sem licença comercial para uso no ERP.
