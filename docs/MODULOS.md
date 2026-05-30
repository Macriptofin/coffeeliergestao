# Módulos do Sistema Coffeelier ERP

**Última atualização:** Maio 2026

---

## Módulo 1 — Materiais

**Rota:** `/materiais`  
**Objetivo:** Cadastro único e centralizado de todos os itens que passam pela operação.

### Telas
| Tela | Rota | Descrição |
|---|---|---|
| Hub de Materiais | `/materiais` | Página de entrada com cards de acesso aos sub-módulos |
| Cadastro de Materiais | `/ingredientes` | Lista completa + criação/edição de materiais |
| Controle de Estoque | `/materiais/controle` | Saldos, movimentações e alertas |
| Gestão de Estoque | `/materiais/gestao` | Parâmetros ABC, mínimos, máximos |
| Movimentações | `/materiais/movimentacoes` | Histórico de entradas e saídas |
| Relatórios de Estoque | `/materiais/relatorios` | Análises e relatórios de valorização |
| Inventário e Ajustes | `/materiais/inventario-ajustes` | Contagens físicas e ajustes auditáveis |
| Importação de Dados | `/materiais/importacao` | Importar materiais via planilha CSV |
| Diagnóstico | `/materiais/diagnostico` | Identificar inconsistências no cadastro |
| Materiais com Problemas | `/materiais/problemas` | Corrigir materiais com dados incompletos |
| Editar Material | `/materiais/:id/editar` | Formulário de edição de material específico |

### Tabelas Principais
- `materials` — cadastro central
- `stock_items` — saldo atual por material
- `stock_movements` — toda movimentação (entrada, saída, ajuste, produção)
- `stock_parameters` — parâmetros ABC, pontos de reabastecimento
- `inventory_cycles` + `inventory_adjustments` — ciclos de contagem
- `cost_adjustments` — ajustes manuais de custo
- `taxonomy_terms` — categorias e subcategorias

### Tipos de Material
```
Insumo           → matéria-prima para produção
Embalagem        → caixas, potes, sacos
Descartável      → copos, pratos, talheres descartáveis
Produto Intermediário → patês, molhos, recheios (têm BOM próprio)
Produto Acabado  → produto final pronto para venda
Produto de Revenda → comprado pronto, revendido sem transformação
Material Operacional → limpeza, higiene, manutenção
```

### Fluxo de Custo
1. Material criado com custo inicial (ou sem custo)
2. Ao confirmar uma NF de compra, `trigger_update_weighted_average_on_purchase` recalcula o custo médio ponderado
3. Novo custo médio atualiza `stock_items.average_price`
4. Trigger propaga o novo custo para todos os BOMs que usam esse material

---

## Módulo 2 — Compras

**Rota:** `/compras`  
**Objetivo:** Controle completo do ciclo de compras, desde a necessidade até a entrada no estoque.

### Telas
| Aba | Descrição |
|---|---|
| Necessidades (MRP) | Necessidades geradas por planejamento de estoque |
| Requisições | Solicitações internas de compra |
| Cotações | Solicitações de cotação enviadas a fornecedores |
| Pedidos | Ordens de compra emitidas |
| Notas Fiscais | Lançamento e confirmação de NFs recebidas |
| Fornecedores | Cadastro de fornecedores e produtos vinculados |

### Tabelas Principais
- `purchase_requirements` — necessidades de compra (origem: MRP ou manual)
- `purchase_requests` → `purchase_request_items` — solicitações internas
- `quote_requests` → `quote_request_suppliers` → `supplier_quotes` → `supplier_quote_items` — fluxo de cotação
- `purchase_orders` → `purchase_order_items` — ordens de compra
- `purchase_invoices` → `invoice_items` — notas fiscais e seus itens
- `suppliers` + `supplier_products` — fornecedores
- `invoice_ocr_sessions` + `invoice_ocr_items` + `material_name_mappings` — OCR de NFs

### Fluxo de Compra Completo
```
Necessidade identificada (estoque baixo ou evento futuro)
    ↓
Solicitação de compra interna (purchase_requests)
    ↓
Solicitação de cotação enviada a fornecedores (quote_requests)
    ↓
Fornecedores respondem (supplier_quotes)
    ↓
Melhor cotação selecionada → Ordem de Compra (purchase_orders)
    ↓
Recebimento da mercadoria → NF lançada (purchase_invoices)
    ↓
NF confirmada → estoque atualizado via stock_movements
             → custo médio recalculado
             → contas a pagar gerado (accounts_payable)
```

### OCR de Notas Fiscais
1. Usuário fotografa ou faz upload da NF
2. Sistema envia para OCR (Supabase Edge Function)
3. Texto extraído é processado: itens, quantidades, preços
4. Cada item é cruzado com `material_name_mappings` para sugerir o material correspondente
5. Usuário confirma o match de cada item
6. Ao confirmar: NF é lançada, estoque atualizado, aprendizado salvo em `material_name_mappings`

---

## Módulo 3 — Produção

**Rota:** `/producao`  
**Objetivo:** Gestão de fichas técnicas (BOM), ordens de produção e rastreabilidade de custos.

### Telas
| Tela | Rota | Descrição |
|---|---|
| Hub de Produção | `/producao` | Cards para sub-módulos |
| Fichas Técnicas | `/producao/fichas-tecnicas` | Lista e gestão de BOMs |
| Nova Ficha / Editar | `/producao/fichas/novo` e `/:id` | Formulário de BOM |
| Planejamento e Ordens | `/producao/planejamento` | Ordens de produção ativas |
| Cálculo de Custos | `/producao/calculo-custos` | Análise de custos de produção |
| Relatórios | `/producao/relatorios` | Performance e custos detalhados |
| BOM Management | `/producao/bom` | Gestão avançada de estruturas BOM |
| Mesas/Eventos | `/producao/eventos` | Ordens de produção ligadas a eventos |

### Tabelas Principais
- `recipes_bom` — ficha técnica de produto acabado
- `recipe_bom_items` — ingredientes de cada ficha
- `composites_bom` — ficha técnica de produto intermediário
- `composite_bom_items` — ingredientes de cada composto
- `bom_production_orders` — ordens de produção
- `bom_production_order_items` — itens de cada OP
- `bom_production_consolidated_materials` — materiais consolidados por OP
- `bom_production_stock_movements` — movimentações geradas pela produção
- `bom_cost_history` — histórico de variação de custo
- `bom_cost_alerts` — alertas de variação acima do threshold
- `event_tables` + `event_production_orders` — produção ligada a eventos de mesa

### Ciclo de Vida de uma Ordem de Produção
```
Proposta aprovada (ou criação manual)
    ↓
bom_production_orders criada (status: pending)
    ↓
bom_production_consolidated_materials calculado (explosão do BOM)
    ↓
Estoque reservado (reserved_qty incrementado por material)
    ↓
Produção iniciada (status: in_progress)
    ↓
Saídas de estoque registradas em bom_production_stock_movements
    ↓
Produção concluída (status: completed)
    ↓
Produto acabado entra no estoque (stock_movements: type = 'producao_entrada')
```

### Campos importantes de `recipes_bom`
| Campo | Descrição |
|---|---|
| `finished_material_id` | Material que este BOM produz |
| `yield_quantity` | Quantidade produzida por lote |
| `yield_unit` | Unidade do rendimento (unidade, kg, etc.) |
| `waste_percent` | % de perda/quebra na produção |
| `cached_total_cost` | Custo calculado automaticamente (NUNCA editar manualmente) |
| `cost_status` | `complete` \| `incomplete` \| `partial` \| `unknown` |
| `missing_cost_items` | JSONB com materiais sem custo cadastrado |

---

## Módulo 4 — Vendas / Propostas

**Rota:** `/vendas`  
**Objetivo:** Gestão comercial — clientes, propostas, pedidos.

### Telas (abas dentro de `/vendas`)
| Aba | Descrição |
|---|---|
| Dashboard | KPIs comerciais: receita, propostas, pedidos |
| Clientes | Cadastro completo com unidades, departamentos, salas, contatos |
| Propostas | Lista e criação de propostas comerciais |
| Pedidos | Pedidos de venda gerados de propostas aprovadas |
| Relatórios | Análise de vendas por período, cliente, categoria |
| Produtos | Produtos vendáveis (legado — em migração) |

### Tabelas Principais
- `clients` + `client_units` + `client_departments` + `client_rooms` + `client_contacts` — CRM
- `client_assignments` — atribuição de cliente a usuário
- `proposals` — proposta comercial
- `proposal_categories` + `proposal_category_items` — itens da proposta (modelo atual)
- `proposal_picklists` + `proposal_picklist_items` — listas de separação
- `sales_orders` + `sales_order_items` — pedido de venda

### Ciclo de Vida de uma Proposta
```
Nova proposta criada (status: rascunho)
    → cliente, data, nº pessoas, categoria definidos
    ↓
Composição: itens adicionados por categoria
    → custo calculado em tempo real via BOM
    ↓
Proposta enviada ao cliente (status: enviada)
    ↓
Proposta aprovada pelo cliente (status: aprovada)
    ↓ AUTOMÁTICO
    ├→ Event criado (auto_generated_event_id)
    ├→ BOM Production Order criada (auto_generated_bom_order_id)
    ├→ Sales Order gerada (generated_order_id)
    └→ Estoque reservado para a produção
    ↓
Evento realizado → produção concluída
    ↓
Fatura emitida → accounts_receivable criado
```

### Tipos de Proposta
| Tipo | Descrição |
|---|---|
| `Evento/Mesa` | Coffee break, brunch, coquetel para evento corporativo |
| `Kit Individual` | Kit gastronômico para entrega |
| `Revenda` | Produtos prontos para revenda sem produção |

### Campos importantes de `proposals`
| Campo | Descrição |
|---|---|
| `proposal_number` | Número sequencial (ex: 2026-0004) |
| `version` | Versão da proposta (permite histórico) |
| `parent_proposal_id` | FK para versão anterior (versionamento) |
| `auto_generated_event_id` | Event criado automaticamente ao aprovar |
| `auto_generated_bom_order_id` | OP criada automaticamente ao aprovar |
| `generated_order_id` | Sales Order criada ao aprovar |

---

## Módulo 5 — Agenda

**Rota:** `/agenda`  
**Objetivo:** Visão calendário de todos os eventos agendados.

### Telas
| Aba | Descrição |
|---|---|
| Dashboard | Contadores Hoje / Esta Semana / Este Mês + próximos eventos |
| Calendário | Visão calendário mensal com eventos marcados |
| Eventos | Lista detalhada de todos os eventos |
| Notificações | Alertas e lembretes de eventos |

### Tabelas Principais
- `events` — evento como entidade de negócio (data, local, status, nº pessoas)
- `event_sessions` — múltiplos turnos dentro de um mesmo evento
- `event_notifications` — alertas associados ao evento
- `event_checklist` — tarefas operacionais do evento
- `event_attachments` — arquivos e documentos do evento

### Diferença entre Event e Event Table
- **`events`** → entidade do calendário (quando, onde, quem, quantas pessoas)
- **`event_tables`** → configuração operacional de uma "mesa" de evento (o que vai ser servido, em que quantidade, com qual perfil de consumo)

Toda proposta aprovada gera automaticamente um registro em `events` e um em `event_tables`.

---

## Módulo 6 — Financeiro

**Rota:** `/financeiro`  
**Objetivo:** Controle financeiro como consequência das operações — nunca como origem dos dados.

### Telas
| Tela | Rota | Descrição |
|---|---|
| Hub Financeiro | `/financeiro` | Alertas + acesso a sub-módulos |
| Contas a Pagar | `/financeiro/pagar` | Gestão de pagamentos a fornecedores |
| Contas a Receber | `/financeiro/receber` | Recebimentos de clientes |
| Fluxo de Caixa | `/financeiro/fluxo` | Entradas e saídas por período |
| Centros de Custo | `/financeiro/custos` | Rateio de custos por departamento |
| Análise Financeira | `/financeiro/analises` | DRE, margens, indicadores |
| Relatórios Contábeis | `/financeiro/relatorios` | Relatórios para contabilidade |
| Contas Bancárias | `/financeiro/bancos` | Saldos e conciliação bancária |
| Transações Recorrentes | `/financeiro/recorrentes` | Lançamentos automáticos periódicos |
| Aging de Contas | `/financeiro/aging` | Análise de inadimplência por faixa |
| Previsão de Caixa | `/financeiro/previsao` | Projeção de fluxo futuro |

### Tabelas Principais
- `chart_of_accounts` — plano de contas hierárquico
- `cost_centers` — centros de custo hierárquicos
- `bank_accounts` — contas bancárias
- `accounts_payable` — contas a pagar (geradas ao confirmar NFs)
- `accounts_receivable` — contas a receber (geradas ao aprovar propostas)
- `payment_transactions` — pagamentos realizados
- `receipt_transactions` — recebimentos realizados
- `cash_transactions` — fluxo de caixa
- `recurring_transactions` — lançamentos recorrentes
- `bank_reconciliations` — conciliação bancária
- `financial_alerts` — alertas de vencimentos

### Integração com o resto do sistema
| Origem | Gerado automaticamente |
|---|---|
| NF de compra confirmada | `accounts_payable` |
| Proposta aprovada | `accounts_receivable` |
| Pagamento de NF | `payment_transactions` + baixa em `accounts_payable` |
| Recebimento de cliente | `receipt_transactions` + baixa em `accounts_receivable` |
| Todas as transações | `cash_transactions` (visão consolidada de fluxo) |

---

## Módulo 7 — Recursos Humanos

**Rota:** `/rh`  
**Objetivo:** Gestão de colaboradores, controle de ponto e usuários do sistema.

### Telas Implementadas
| Tela | Rota | Descrição |
|---|---|
| Hub RH | `/rh` | Cards de acesso |
| Colaboradores | `/rh/colaboradores` | Cadastro completo de funcionários |
| Controle de Ponto | `/rh/ponto` | Registros de ponto e horas |
| Usuários do Sistema | `/usuarios` | Perfis e permissões de acesso |

### Telas Planejadas (não implementadas ainda)
- Folha de Pagamento
- Férias e Afastamentos
- Treinamentos

### Tabelas Principais
- `employees` — cadastro de colaboradores
- `employee_salary_info` — informações salariais
- `work_schedules` — jornadas de trabalho
- `time_records` — registros de ponto (data, hora, tipo: entrada/saída/almoço)
- `user_profiles` — perfil de usuário do sistema
- `user_roles` — papel do usuário (admin, comercial, producao, etc.)
- `user_permissions` — permissões granulares por módulo e ação
- `hr_permissions` — permissões específicas do módulo RH

---

## Módulo 8 — Configurações

**Rota:** `/config`  
**Objetivo:** Configurações do sistema, feature flags e parâmetros operacionais.

### Tabelas Principais
- `app_settings` — configurações chave-valor globais (simples)
- `app_flags` — feature flags (ligar/desligar funcionalidades)
- `config_namespaces` + `config_options` + `config_values` — sistema de configuração estruturado
- `taxonomy_definitions` + `taxonomy_terms` — definição de categorias e subcategorias hierárquicas

---

## Módulo 9 — Segurança

**Rota:** `/seguranca`, `/seguranca/avancado`, `/seguranca/anomalias`  
**Objetivo:** Monitoramento de acessos, auditoria e proteção dos dados.

### Tabelas Principais
- `security_audit_log` — log de todas as ações sensíveis
- `security_alerts` — alertas de comportamento suspeito
- `auth_attempts` — tentativas de login (sucesso e falha)
- `account_lockouts` — contas bloqueadas por excesso de tentativas
- `mfa_settings` — configurações de autenticação multifator
- `pii_access_log` — acesso a dados pessoais (LGPD)
- `pii_access_anomalies` — padrões anômalos de acesso a PII
- `access_time_restrictions` — restrições de horário de acesso

---

## Perfis de Usuário e Permissões

| Perfil | Acesso Principal |
|---|---|
| Administrador | Tudo + configurações + usuários |
| Gestor | Todos os módulos, sem configurações |
| Comercial | Vendas, Clientes, Propostas, Agenda |
| Compras | Compras, Fornecedores, Materiais (leitura) |
| Produção | Produção, Fichas Técnicas, Ordens de Produção |
| Estoque | Materiais, Movimentações, Inventário |
| Financeiro | Financeiro completo |
| Logística | Agenda, Eventos, Produção (leitura) |

Permissões são definidas na tabela `user_permissions` com granularidade por módulo e ação (view, create, edit, delete, approve).
