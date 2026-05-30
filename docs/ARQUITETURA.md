# Arquitetura do Sistema Coffeelier ERP

**Última atualização:** Maio 2026

---

## 1. Princípio Fundamental

> Cada informação deve possuir uma única origem e alimentar automaticamente todos os módulos subsequentes.

O sistema não é orientado a estoque nem a financeiro. O núcleo é:

```
Composição → Precificação → Produção → Evento
```

O estoque existe para suportar a produção. O financeiro existe como consequência das operações. Nunca o contrário.

---

## 2. Fluxo Principal do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO OPERACIONAL                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Cadastro de Materiais                                      │
│          ↓                                                  │
│  Compras + NF (OCR) → Estoque (custo médio automático)     │
│          ↓                                                  │
│  Fichas Técnicas (BOM) + Produtos Intermediários           │
│          ↓                                                  │
│  Configurador de Propostas (custo em tempo real)           │
│          ↓                                                  │
│  Proposta Aprovada                                          │
│          ↓                    ↓                   ↓        │
│       Evento            Ordem de Produção      A Receber   │
│          ↓                    ↓                            │
│     Execução         Baixa no Estoque                      │
│          ↓                    ↓                            │
│          └────────→ Financeiro (DRE, Fluxo)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Stack Tecnológica

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Tipagem estática |
| Vite | 5 | Build tool e dev server |
| React Router v6 | 6 | Roteamento SPA |
| shadcn/ui | — | Componentes de UI (Radix UI) |
| Tailwind CSS | 3 | Estilização utility-first |
| TanStack Query | 5 | Cache e estado de servidor |
| Lucide React | — | Ícones |

### Backend
| Tecnologia | Uso |
|---|---|
| Supabase | BaaS — PostgreSQL + Auth + Storage + Edge Functions |
| PostgreSQL 17 | Banco de dados principal |
| Row Level Security (RLS) | Controle de acesso por linha |
| Supabase Auth | Autenticação (email + MFA) |
| Edge Functions | Lógica serverless (OCR, emails, PDF) |

### Infraestrutura
| Item | Detalhe |
|---|---|
| Hospedagem frontend | Lovable (deploy automático via push no main) |
| Banco de dados | Supabase Cloud — região sa-east-1 (São Paulo) |
| Gerenciador de pacotes | Bun |
| Controle de versão | Git + GitHub |

---

## 4. Arquitetura de Dados

### Camadas do Banco

```
┌──────────────────────────────────────────────┐
│  CAMADA DE CONFIGURAÇÃO                      │
│  taxonomy, config_*, app_settings, app_flags │
└──────────────────┬───────────────────────────┘
                   ↓
┌──────────────────────────────────────────────┐
│  CAMADA DE CADASTRO BASE                     │
│  materials, suppliers, clients, employees    │
└──────────────────┬───────────────────────────┘
                   ↓
┌──────────────────────────────────────────────┐
│  CAMADA OPERACIONAL                          │
│  fichas técnicas (BOM), estoque, compras     │
│  propostas, eventos, produção                │
└──────────────────┬───────────────────────────┘
                   ↓
┌──────────────────────────────────────────────┐
│  CAMADA FINANCEIRA                           │
│  accounts_payable/receivable, cash_flow, DRE │
└──────────────────┬───────────────────────────┘
                   ↓
┌──────────────────────────────────────────────┐
│  CAMADA DE AUDITORIA E SEGURANÇA             │
│  security_audit_log, pii_access_log,         │
│  auth_attempts, bom_cost_history             │
└──────────────────────────────────────────────┘
```

### Padrão de Tabelas
Todas as tabelas seguem o padrão:
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
created_at  timestamptz DEFAULT now()
updated_at  timestamptz DEFAULT now()  -- via trigger
```
A coluna `updated_at` é atualizada automaticamente por trigger na maioria das tabelas.

---

## 5. Sistema de BOM (Bill of Materials)

O coração técnico do sistema é o modelo de BOM duplo:

### BOM de Produto Acabado (`recipes_bom` + `recipe_bom_items`)
- Representa a estrutura de um produto final (ex: Focaccia, Mini Sanduíche)
- `finished_material_id` → aponta para `materials` com `material_type = 'produto_acabado'`
- `cached_total_cost` é calculado automaticamente via trigger `refresh_bom_costs_for_material`
- `cost_status`: `complete` | `incomplete` | `partial` | `unknown`

### BOM de Produto Intermediário (`composites_bom` + `composite_bom_items`)
- Representa patês, molhos, recheios, massas, bases
- `composite_material_id` → aponta para `materials` com `material_type = 'produto_intermediario'`
- Pode ser referenciado como componente dentro de um `recipe_bom_items`

### Trigger de Propagação de Custo
Quando o custo de um material muda (nova entrada de NF, ajuste manual):
```
materials.cost_price atualizado
    ↓ trigger: trigger_refresh_bom_costs_on_material_price_change
recipe_bom_items e composite_bom_items recalculados
    ↓ trigger: trigger_update_bom_costs_on_price_change
recipes_bom.cached_total_cost e composites_bom.cached_total_cost atualizados
    ↓
bom_cost_history registra a variação
bom_cost_alerts cria alerta se variação > threshold
```

---

## 6. Custo Médio Móvel

O custo dos materiais é calculado pelo método PMPF (Preço Médio Ponderado Móvel):

```
novo_custo_médio = (qtd_atual × custo_atual + qtd_entrada × custo_entrada)
                  ÷ (qtd_atual + qtd_entrada)
```

**Funções envolvidas:**
- `calculate_weighted_average_price()` — cálculo do PMPF
- `recalculate_material_average_price()` — recalcula o histórico
- `trigger_update_weighted_average_on_purchase` — dispara ao confirmar uma NF

O resultado é armazenado em `stock_items.average_price` e propagado para os BOMs via o trigger de custo descrito acima.

---

## 7. Fluxo de Autenticação e Segurança

```
Usuário acessa /auth
      ↓
Supabase Auth (email + senha)
      ↓ (opcional)
MFA (TOTP via mfa_settings)
      ↓
JWT token emitido pelo Supabase
      ↓
Todas as queries passam pelo RLS do PostgreSQL
      ↓
user_roles define o papel (admin, comercial, producao, etc.)
user_permissions define ações granulares por módulo
      ↓
security_audit_log registra ações sensíveis
```

**RLS está ativo em 100% das tabelas.** Nenhuma tabela permite acesso público.

---

## 8. Gerações de Arquitetura (Contexto Histórico)

O sistema passou por 3 gerações de desenvolvimento:

**Geração 1 — Modelo "receitas culinárias" (legado):**
`recipes` → `recipe_ingredients` → `products` → `proposal_items`
> Status: Em processo de remoção. Tabelas existem mas com 0 registros ativos.

**Geração 2 — Modelo BOM de manufatura (atual):**
`recipes_bom` → `recipe_bom_items` → `proposal_category_items` → `bom_production_orders`
> Status: Modelo correto em uso.

**Geração 3 — Modelo direto por material (em expansão):**
`materials` → `event_table_items` → `event_production_orders`
> Status: Em uso para o módulo de Mesas/Eventos. Será integrado ao modelo BOM.

---

## 9. Decisões Técnicas Importantes

### Por que Supabase?
- PostgreSQL completo com RLS nativo — segurança sem código extra no frontend
- Auth integrado com suporte a MFA
- Edge Functions para lógica server-side (OCR, PDFs, emails)
- Realtime subscriptions para alertas automáticos
- Dashboard visual para gerenciar dados em produção

### Por que shadcn/ui?
- Componentes copiados para o projeto (não dependência externa)
- Personalizáveis sem conflito com Tailwind
- Acessíveis (Radix UI por baixo)
- Consistência visual garantida em toda a aplicação

### Por que Bun?
- Instalação de dependências ~3x mais rápida que npm
- Compatível com o ecossistema Node.js
- `bun.lockb` como lockfile binário — determinístico

### Fichas técnicas não armazenam custos fixos
`cached_total_cost` em `recipes_bom` é um **cache calculado**, não um valor estático.
Ele é sempre recalculado a partir do `average_price` atual dos materiais, garantindo que o custo de cada produto reflita o mercado atual.

---

## 10. Módulos e Suas Responsabilidades

| Módulo | Responsabilidade Principal | Tabelas Centrais |
|---|---|---|
| Materiais | Cadastro único de insumos, embalagens, produtos | `materials`, `stock_items`, `taxonomy_terms` |
| Compras | NF, fornecedores, cotações, OCR | `purchase_invoices`, `suppliers`, `invoice_ocr_sessions` |
| Produção | BOM, fichas técnicas, ordens de produção | `recipes_bom`, `bom_production_orders` |
| Vendas | Propostas, clientes, pedidos | `proposals`, `clients`, `sales_orders` |
| Agenda | Calendário de eventos | `events`, `event_sessions` |
| Financeiro | CP, CR, fluxo de caixa | `accounts_payable`, `accounts_receivable` |
| RH | Colaboradores, ponto, usuários | `employees`, `time_records`, `user_profiles` |
| Configurações | Feature flags, taxonomia, permissões | `app_flags`, `config_values`, `user_permissions` |

Para detalhes de cada módulo, ver [MODULOS.md](./MODULOS.md).
