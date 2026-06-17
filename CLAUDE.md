# CLAUDE.md — Coffeelier Gestão

Guia de contexto para o Claude Code. Leia este arquivo antes de qualquer tarefa.

---

## 1. O Projeto

**Coffeelier Gestão** — sistema web de gestão operacional para buffet/catering. Cobre estoque, produção, compras (NF), financeiro, propostas comerciais, agenda de eventos e RH.

- **Stack**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL 17, Auth, Edge Functions, Storage)
- **Hospedagem frontend**: Lovable (deploy automático via push no GitHub)
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
│   ├── migrations/         ← 232 migrations SQL (histórico completo)
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

### Funções RPC principais

| Função | Descrição |
|---|---|
| `process_inventory_adjustment` | Ajuste de quantidade de estoque |
| `process_cost_adjustment` | Ajuste de preço médio |
| `rpc_inventory_update_status` | Avança status do ciclo de inventário |
| `rpc_inventory_finalize` | Fecha ciclo e aplica todos os ajustes |
| `finalize_production_order` | Finaliza OP BOM com rendimento real |
| `reserve_stock_for_production_order` | Reserva estoque para OP |
| `create_event_from_proposal(uuid)` | Gera **1 evento na agenda por composição** da proposta (idempotente) |
| `generate_production_from_proposal(uuid)` | Gera **Ordem de Evento** (separação, `event_production_orders`) por composição + **Ordem de Produção** (`bom_production_orders`) só do **déficit vs estoque** |
| `approve_proposal_by_token(text)` | Cliente aceita pela página pública → status `'Aprovada pelo Cliente'` (NÃO gera; geração é na aprovação final da equipe) |

### Taxonomia de materiais (3 eixos independentes) e motor de proposta

- **Taxonomia** em `taxonomy_definitions` (keys: `material_type`, `material_category`, `material_subcategory`, `material_restriction`) + `taxonomy_terms` (hierárquico por `parent_id`). `term_id` é a **fonte da verdade**; as colunas texto `materials.category/subcategory` são sincronizadas a partir do termo.
  - **Tipo** = papel no sistema (`material_type`, 8 valores acima). **Categoria → Subcategoria** = domínio de negócio (9 categorias canônicas: Alimentos & Ingredientes, Doces & Confeitaria, Salgados, Bebidas, Embalagem, Higiene e Limpeza, Equipamentos, Operacionais, Kits & Mesas).
  - **Tags de restrição/característica** = eixo transversal (Low Fat, Vegano, Sem Glúten…) — taxonomia `material_restriction` + tabela de ligação `material_tags (material_id, term_id)` (many-to-many). Um produto pode ter várias.
- **Proposta** = `proposals` → **`proposal_compositions`** (momentos: nome, `scheduled_date/time`, local, preço/pessoa) → `proposal_categories` (seções, com `composition_id`) → `proposal_category_items`. O compositor (`ProposalEditor.tsx`) monta seções por categoria + Low Fat por tag. PDF (`ProposalPDF.tsx`) e geração de evento/ordens são **por composição**.

### Triggers importantes

| Trigger | Tabela | Função | Comportamento |
|---|---|---|---|
| `trg_sync_stock_quantity` | `stock_movements` | `trigger_sync_stock_quantity` | Recalcula `stock_items.current_quantity` em INSERT/UPDATE. **EXCEÇÃO**: pula o recálculo para `movement_type = 'Ajuste'` (a função já faz UPDATE direto) |
| `trg_update_weighted_average` | `stock_movements` | `trigger_update_weighted_average_on_purchase` | Recalcula preço médio ponderado em entradas com unit_price |
| `trg_update_bom_costs` | `stock_items` | `trigger_update_bom_costs_on_price_change` | Cascateia atualização de custo nas fichas técnicas |

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

### Estado atual do repositório (junho 2026)

Arquivos modificados ainda não commitados:
```
src/components/BOMProductionOrdersList.tsx
src/components/ProductionOrdersList.tsx
src/components/agenda/EventOperationalCard.tsx
src/components/inventory/HistoricoUnificado.tsx
src/components/stock/StockMovements.tsx
src/pages/Dashboard.tsx
src/pages/InventarioCiclo.tsx
src/pages/Reports.tsx
src/pages/production/ProductionPlanning.tsx
supabase/migrations/20260616000000_reactivate_inventory_adjustment_movement.sql  (novo)
```

Estes arquivos fazem parte das tasks #99 (padronização de terminologia PT-BR) e #100 (reativação de movimentação em ajustes de inventário). **Fazer commit e push antes de começar novas tasks.**

Comando para commitar:
```bash
cd /Users/macielluchtemberg/Projetos/coffeeliergestao
git add -A
git commit -m "feat: padronização terminologia PT-BR + reativar movimentação ajuste inventário (#99 #100)"
git push origin main
```

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
| Compras | `Purchases.tsx` | Notas fiscais, contas a pagar, fornecedores |
| Financeiro | `Financeiro.tsx` + `financeiro/` | Contas a pagar/receber, fluxo de caixa, DRE, plano de contas |
| Propostas | `Sales.tsx` + aprovação via link | Propostas comerciais com PDF |
| Agenda | `Agenda.tsx` | Calendário de eventos + cards operacionais |
| Fornecedores | `Suppliers.tsx` | Cadastro com campos fiscais e localização |
| Configurações | `Config.tsx` | Formas de pagamento, taxonomia, permissões |
| RH | `RecursosHumanos.tsx` + `rh/` | Colaboradores, ponto |
| Segurança | `SecurityMonitoring.tsx` | Auditoria e anomalias |

---

## 7. Tasks Pendentes (backlog ativo)

| ID | Descrição | Prioridade |
|---|---|---|
| #73 | Filtros em Contas a Pagar (período, status, fornecedor) | Alta |
| ~~#74~~ | ~~Fix datas: frete e handleMarkPaid~~ — ✅ Concluído (jun/2026, fuso local centralizado) | — |
| #75 | Lançamento sem NF: despesas diretas | Alta |
| #70 | Revisão completa fichas técnicas e ordens de produção | Média |
| #91 | Frontend: seção fiscal por item + IPI no custo unitário | Média |
| #64 | Fluxo de caixa: usar data de pagamento | Média |
| #65 | Suporte a lançamentos sem nota fiscal | Média |
| #102 | Concluir migração react-query: ~53 componentes menores + hooks de dados restantes (forms/dialogs/listas; padrão em ContasPagar/Dashboard). Páginas e sub-páginas já migradas. Migrar ao tocar em cada área. Ver memória `react-query-data-fetching-standard`. | Média |
| #34 | Geocodificação precisa via Google Maps API | Baixa |

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

O projeto funciona **sem arquivo `.env`** — as credenciais Supabase estão hardcoded no `client.ts` como fallback.

Para usar variáveis de ambiente no Vite, criar `.env.local`:
```
VITE_SUPABASE_URL=https://njxxqdcwvehlvqufuyww.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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
