# Documentação Técnica - Receita Maestro Digital
## Sistema de Gestão para Catering e Eventos

---

## 📋 Sumário Executivo

**Nome do Projeto:** Receita Maestro Digital  
**Tipo:** Sistema de Gestão ERP para Catering/Eventos  
**Plataforma:** Web Application (React + Supabase)  
**Status:** Em Desenvolvimento Ativo  
**URL Produção:** receita-maestro-digital.lovable.app

### Objetivo
Sistema completo de gestão para empresas de catering, integrando:
- Gestão de materiais e estoque
- BOMs (Bill of Materials) para receitas e produtos compostos
- Gestão de eventos e propostas comerciais
- Ordens de produção
- Gestão financeira
- Recursos humanos
- Sistema de segurança robusto

---

## 🏗️ Arquitetura do Sistema

### Stack Tecnológica

**Frontend:**
- React 18.3.1 com TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui (design system)
- React Router DOM v6.30.1
- React Hook Form + Zod (validação)
- TanStack Query v5.83.0 (state management)
- Recharts (visualizações)

**Backend:**
- Supabase (BaaS - Backend as a Service)
  - PostgreSQL (database)
  - Row Level Security (RLS)
  - Edge Functions (serverless)
  - Authentication

**Infraestrutura:**
- Hospedagem: Lovable Cloud
- Database: Supabase (PostgreSQL)
- CDN: Automático via Lovable
- SSL: Automático

### Padrão Arquitetural

```
┌─────────────────────────────────────┐
│         React Frontend              │
│  (Components + Hooks + Pages)       │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│      Supabase Client SDK            │
│   (@supabase/supabase-js)           │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│         Supabase Backend            │
│                                      │
│  ┌──────────────────────────────┐  │
│  │  PostgreSQL Database         │  │
│  │  + Row Level Security (RLS)  │  │
│  └──────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐  │
│  │  Edge Functions              │  │
│  │  (password-reset, etc)       │  │
│  └──────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐  │
│  │  Auth Service                │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## 🗄️ Estrutura do Banco de Dados

### Principais Entidades

#### 1. Gestão de Materiais
- **materials**: Insumos, produtos acabados, intermediários, compostos
- **stock_items**: Controle de estoque
- **stock_movements**: Movimentações de estoque
- **suppliers**: Fornecedores
- **supplier_products**: Produtos por fornecedor

#### 2. BOMs (Bill of Materials)
- **recipes_bom**: BOMs de receitas (produtos acabados)
- **recipe_bom_items**: Itens da BOM de receita
- **composites_bom**: BOMs de produtos compostos
- **composite_bom_items**: Itens da BOM de composto

#### 3. Produção
- **bom_production_orders**: Ordens de produção baseadas em BOMs
- **bom_production_order_items**: Itens das ordens de produção
- **bom_production_consolidated_materials**: Materiais consolidados
- **bom_production_stock_movements**: Movimentações de estoque da produção

#### 4. Eventos
- **clients**: Clientes
- **events**: Eventos agendados
- **event_tables**: Mesas/configurações de eventos
- **event_table_items**: Itens por mesa
- **event_table_templates**: Templates de eventos
- **event_production_orders**: Ordens de produção vinculadas a eventos
- **event_checklist**: Checklists de eventos
- **event_notifications**: Notificações automáticas
- **consumption_profiles**: Perfis de consumo
- **consumption_profile_mix**: Mix de categorias por perfil

#### 5. Vendas
- **proposals**: Propostas comerciais
- **proposal_items**: Itens das propostas

#### 6. Financeiro
- **accounts_payable**: Contas a pagar
- **accounts_receivable**: Contas a receber
- **cash_transactions**: Transações de caixa
- **cost_centers**: Centros de custo
- **chart_of_accounts**: Plano de contas

#### 7. Recursos Humanos
- **employees**: Colaboradores
- **employee_salary_info**: Informações salariais (acesso restrito)

#### 8. Inventário
- **inventory_cycles**: Ciclos de inventário
- **inventory_adjustments**: Ajustes de inventário
- **cost_adjustments**: Ajustes de custo

#### 9. Compras
- **purchase_invoices**: Notas fiscais de compra
- **invoice_items**: Itens das notas fiscais

#### 10. Segurança e Auditoria
- **security_audit_log**: Log de auditoria de segurança
- **security_alerts**: Alertas de segurança
- **pii_access_anomalies**: Anomalias de acesso a dados pessoais
- **account_lockouts**: Bloqueios de conta
- **auth_attempts**: Tentativas de autenticação
- **access_time_restrictions**: Restrições de horário de acesso

#### 11. Sistema de Usuários e Permissões
- **user_roles**: Roles dos usuários (admin, manager, user)
- **user_permissions**: Permissões granulares por categoria
- **user_profiles**: Perfis de usuários
- **financial_permissions**: Permissões financeiras específicas

#### 12. Configurações
- **config_namespaces**: Namespaces de configuração
- **config_options**: Opções de configuração
- **config_values**: Valores de configuração
- **app_settings**: Configurações gerais do app
- **taxonomy_definitions**: Definições de taxonomias
- **taxonomy_terms**: Termos de taxonomias

#### 13. Auditoria Operacional
- **ops_config_audit_log**: Log de mudanças de configuração
- **ops_bom_audit_log**: Log de operações em BOMs

### Enums (Tipos Customizados)

```sql
-- Roles do sistema
CREATE TYPE app_role AS ENUM ('admin', 'manager', 'user');

-- Categorias de permissões
CREATE TYPE permission_category AS ENUM (
  'materials', 'production', 'stock', 'sales', 
  'financial', 'hr', 'reports', 'settings'
);

-- Subcategorias de permissões
CREATE TYPE permission_subcategory AS ENUM (
  'view', 'create', 'edit', 'delete', 
  'approve', 'export'
);

-- Categorias de eventos
CREATE TYPE event_category AS ENUM (
  'coffee_break', 'coquetel', 'almoco', 
  'jantar', 'brunch', 'outros'
);

-- Categorias de produtos
CREATE TYPE product_category AS ENUM (
  'salgados', 'doces', 'bebidas', 
  'paes', 'frutas', 'outros'
);
```

### Principais Funções do Banco de Dados

#### Segurança e Roles
- `has_role(_user_id uuid, _role app_role)`: Verifica se usuário tem role específica
- `is_admin_or_manager(_user_id uuid)`: Verifica se é admin ou manager
- `has_permission(p_user_id uuid, p_category, p_subcategory)`: Verifica permissões granulares

#### PII (Personally Identifiable Information)
- `mask_cnpj_cpf(cnpj_cpf_value text)`: Mascara CPF/CNPJ
- `mask_phone(phone_value text)`: Mascara telefones
- `mask_email(email_value text)`: Mascara emails
- `get_masked_client_data()`: Retorna dados de clientes mascarados
- `log_pii_access()`: Registra acesso a dados pessoais
- `detect_pii_anomaly()`: Detecta anomalias no acesso a PII

#### Segurança e Monitoramento
- `create_security_alert()`: Cria alertas de segurança
- `check_account_lockout(p_email text)`: Verifica bloqueio de conta
- `create_account_lockout()`: Cria bloqueio de conta
- `sanitize_error_message(error_msg text)`: Sanitiza mensagens de erro

#### Gestão de Eventos
- `create_event_from_proposal()`: Cria evento a partir de proposta aprovada
- `create_event_notifications()`: Cria notificações automáticas de evento

#### Configurações
- `get_config(p_namespace text, p_key text)`: Busca configuração
- `audit_config_changes()`: Audita mudanças em configurações

#### BOMs e Produção
- `sanitize_bom_for_material()`: Sanitiza BOMs duplicadas
- `merge_materials()`: Merge de materiais duplicados
- `archive_recipe_bom()`: Arquiva BOM e material vinculado
- `diag_bom_migration_report()`: Relatório de diagnóstico de BOMs
- `run_bom_cleanup_playbook()`: Limpeza automática de BOMs

#### Inventário
- `process_inventory_adjustment()`: Processa ajuste de inventário
- `process_cost_adjustment()`: Processa ajuste de custo
- `rpc_inventory_finalize(p_cycle_id uuid)`: Finaliza ciclo de inventário

#### Taxonomias
- `suggest_material_taxonomy_migration()`: Sugere migração para taxonomias
- `import_taxonomy_from_csv()`: Importa taxonomias do CSV

#### Utilitários
- `generate_supplier_code()`: Gera código de fornecedor automaticamente
- `sync_user_profile_email()`: Sincroniza email do perfil com auth.users

### Row Level Security (RLS)

**Todas as tabelas têm RLS habilitado.** Principais políticas:

#### Padrão Admin/Manager
```sql
-- Visualização: usuários autenticados
SELECT: auth.uid() IS NOT NULL

-- Modificação: apenas admin/manager
INSERT/UPDATE/DELETE: is_admin_or_manager(auth.uid())
```

#### Dados Sensíveis (Clientes, Colaboradores)
```sql
-- Acesso restrito a admin/manager
SELECT/INSERT/UPDATE/DELETE: is_admin_or_manager(auth.uid())
```

#### Dados Super Sensíveis (Salários)
```sql
-- Apenas admins
ALL: has_role(auth.uid(), 'admin')
```

#### Configurações
```sql
-- Leitura: todos autenticados
SELECT: true

-- Modificação: apenas admins
ALL: has_role(auth.uid(), 'admin')
```

---

## 🔐 Sistema de Segurança

### Camadas de Segurança

#### 1. Autenticação
- Supabase Auth (email/password)
- Validação de senha forte (edge function)
- Check contra HaveIBeenPwned API
- Rate limiting em tentativas de login
- Bloqueio automático de contas após falhas

#### 2. Autorização
- Sistema de roles (admin, manager, user)
- Permissões granulares por categoria e subcategoria
- RLS policies em todas as tabelas
- Funções `SECURITY DEFINER` para evitar recursão

#### 3. Proteção de Dados Pessoais (PII)
- Mascaramento automático de dados sensíveis
- Log de acesso a PII
- Detecção de anomalias:
  - Acesso em massa (bulk access)
  - Acesso fora do horário
  - Sucessão rápida de acessos
- Alertas automáticos para padrões suspeitos

#### 4. Auditoria
- Log completo de acessos (`security_audit_log`)
- Rastreamento de mudanças em configurações
- Histórico de operações em BOMs
- Registro de tentativas de autenticação

#### 5. Monitoramento em Tempo Real
- Detecção de comportamento suspeito
- Alertas de segurança com severidade
- Dashboard de segurança para admins
- Subscriptions em tempo real via Supabase

#### 6. Rate Limiting
- Controle de tentativas de autenticação
- Prevenção de ataques de força bruta
- Bloqueio temporário de contas

#### 7. Restrições de Acesso
- Controle de horário de operações sensíveis
- Dias permitidos para operações
- Configurável por tipo de operação

### Hooks de Segurança Implementados

**Frontend:**
- `useSecurityMonitoring`: Log de eventos de segurança e acesso a PII
- `useSecurityValidation`: Validação de operações sensíveis
- `useSecurityScanner`: Varredura de vulnerabilidades
- `useRateLimiting`: Controle de taxa de requisições
- `useSecureAuth`: Autenticação segura
- `useSessionSecurity`: Gerenciamento de sessão e timeout
- `useEnhancedSecurityMonitoring`: Monitoramento avançado com anomalias
- `usePasswordSecurity`: Validação de senha forte
- `useMFASettings`: Configuração de autenticação multi-fator (preparado)

**Componentes:**
- `SecurityHeader`: Headers de segurança HTTP
- `SecurityDashboard`: Dashboard de segurança
- `SecurityAnomaliesDashboard`: Dashboard de anomalias
- `EnhancedSecurityDashboard`: Dashboard avançado
- `SecurityIncidentResponse`: Resposta a incidentes
- `SecureErrorBoundary`: Boundary com sanitização de erros
- `PIIDataMask`: Mascaramento de dados sensíveis

---

## 📁 Estrutura de Arquivos

### Estrutura Geral
```
src/
├── assets/                    # Imagens e recursos estáticos
├── components/                # Componentes React
│   ├── ui/                   # Componentes UI (shadcn)
│   ├── security/             # Componentes de segurança
│   ├── agenda/               # Componentes de eventos
│   ├── bom/                  # Componentes de BOM
│   ├── config/               # Componentes de configuração
│   ├── employees/            # Componentes de RH
│   ├── events/               # Componentes de eventos
│   ├── inventory/            # Componentes de inventário
│   ├── purchase/             # Componentes de compras
│   ├── sales/                # Componentes de vendas
│   ├── stock/                # Componentes de estoque
│   └── users/                # Componentes de usuários
├── hooks/                     # Custom hooks
├── integrations/              # Integrações externas
│   └── supabase/             # Cliente Supabase
├── lib/                       # Utilitários e helpers
├── pages/                     # Páginas/rotas
│   ├── financeiro/           # Páginas financeiras
│   ├── production/           # Páginas de produção
│   └── stock/                # Páginas de estoque
├── types/                     # TypeScript types
├── utils/                     # Funções utilitárias
├── App.tsx                    # Componente raiz
├── main.tsx                   # Entry point
└── index.css                  # Estilos globais

supabase/
├── functions/                 # Edge Functions
│   ├── password-reset/       # Reset de senha
│   └── password-verification-hook/  # Hook de verificação
└── migrations/                # Migrações do banco (read-only)

public/                        # Arquivos públicos
```

### Principais Componentes

#### Layout e Navegação
- `Layout.tsx`: Layout principal com sidebar
- `Sidebar.tsx`: Menu lateral com navegação
- `CoffeelierLogo.tsx`: Logo da aplicação

#### Materiais e BOMs
- `MaterialsList.tsx`, `MaterialsTable.tsx`: Listagem de materiais
- `MaterialForm.tsx`, `MaterialEditor.tsx`: Formulários
- `RecipeBOMForm.tsx`, `CompositeBOMForm.tsx`: Formulários de BOM
- `RecipesList.tsx`: Lista de receitas
- `BOMDiagnostics.tsx`: Diagnóstico de BOMs

#### Produção
- `ProductionOrder.tsx`: Ordem de produção
- `BOMProductionOrdersList.tsx`: Lista de ordens BOM
- `ProductionExecutor.tsx`: Execução de produção
- `EventProductionIntegration.tsx`: Integração eventos-produção

#### Eventos
- `EventCalendar.tsx`: Calendário de eventos
- `EventForm.tsx`: Formulário de evento
- `EventsList.tsx`: Lista de eventos
- `EventTableForm.tsx`: Formulário de mesa de evento
- `ConsumptionProfileForm.tsx`: Perfis de consumo

#### Vendas
- `ClientsList.tsx`, `ClientForm.tsx`: Gestão de clientes
- `ProposalsList.tsx`, `ProposalForm.tsx`: Propostas
- `ProposalComposer.tsx`: Compositor de propostas

#### Estoque
- `StockOverview.tsx`: Visão geral
- `StockMovements.tsx`: Movimentações
- `StockPlanning.tsx`: Planejamento
- `InventoryCountForm.tsx`: Contagem de inventário
- `InventoryCyclesList.tsx`: Ciclos de inventário

#### Compras
- `PurchaseInvoices.tsx`: Notas fiscais
- `PurchaseOrders.tsx`: Ordens de compra
- `PurchaseRequirements.tsx`: Requisições

#### Segurança
- `SecurityDashboard.tsx`: Dashboard principal
- `SecurityAnomaliesDashboard.tsx`: Anomalias
- `EnhancedSecurityDashboard.tsx`: Dashboard avançado
- `SecurityIncidentResponse.tsx`: Resposta a incidentes
- `MFASetupDialog.tsx`: Setup de MFA
- `PIIDataMask.tsx`: Mascaramento de PII

#### Usuários e Permissões
- `AdminSetup.tsx`: Setup inicial de admin
- `UserRoleManager.tsx`: Gestão de roles
- `UsersList.tsx`, `UserForm.tsx`: Gestão de usuários
- `PermissionsSelector.tsx`: Seletor de permissões

#### Configurações
- `ConfigGeneral.tsx`: Configurações gerais
- `ConfigColors.tsx`: Cores do sistema
- `ConfigParams.tsx`: Parâmetros
- `TaxonomyManager.tsx`: Gestão de taxonomias
- `TaxonomyImporter.tsx`: Importação de taxonomias

### Principais Hooks Customizados

#### Configuração e Sistema
- `useConfig.tsx`: Gerenciamento de configurações
- `useFeatureFlags.tsx`: Feature flags
- `useUserRole.tsx`: Role do usuário atual

#### Produção e BOMs
- `useMaterialBOM.tsx`: Gestão de BOMs de material
- `useProductionValidation.tsx`: Validação de produção

#### Segurança
- `useSecurityMonitoring.tsx`: Monitoramento
- `useSecurityValidation.tsx`: Validação
- `useSecurityScanner.tsx`: Scanner de vulnerabilidades
- `useRateLimiting.tsx`: Rate limiting
- `useSecureAuth.tsx`: Autenticação segura
- `useSessionSecurity.tsx`: Segurança de sessão
- `useEnhancedSecurityMonitoring.tsx`: Monitoramento avançado
- `usePasswordSecurity.tsx`: Validação de senhas
- `useMFASettings.tsx`: Configurações de MFA
- `useSecurityAlerts.tsx`: Alertas
- `useSecurityDashboard.tsx`: Dashboard
- `useSecurityNotifications.tsx`: Notificações

#### Dados Seguros
- `useSecureClientData.tsx`: Clientes com mascaramento
- `useSecureEmployeeData.tsx`: Colaboradores com mascaramento

#### Financeiro
- `useFinancialPermissions.tsx`: Permissões financeiras

---

## 🔄 Fluxos Principais

### 1. Fluxo de Autenticação e Autorização

```
Login
  ↓
[Supabase Auth]
  ↓
Verifica senha (password-verification-hook)
  ↓
Check HaveIBeenPwned
  ↓
Verifica rate limiting
  ↓
Busca user_roles
  ↓
Busca user_permissions
  ↓
Session criada
  ↓
RLS policies aplicadas automaticamente
  ↓
Acesso concedido com permissões
```

### 2. Fluxo de Criação de BOM

```
Selecionar material acabado/intermediário
  ↓
[RecipeBOMForm]
  ↓
Adicionar ingredientes
  ↓
Definir quantidades e unidades
  ↓
Definir yield (rendimento)
  ↓
Salvar em recipes_bom
  ↓
Criar recipe_bom_items
  ↓
Calcular custos automaticamente
```

### 3. Fluxo de Ordem de Produção

```
Criar BOM Production Order
  ↓
Adicionar BOMs (receitas/compostos)
  ↓
Definir multiplicadores
  ↓
[Consolidação Automática]
  ↓
bom_production_consolidated_materials
  ↓
Verificar disponibilidade em estoque
  ↓
Status: planned → in_progress
  ↓
Reservar materiais
  ↓
Consumir materiais (baixa no estoque)
  ↓
Status: completed
  ↓
Entrada de produtos acabados no estoque
```

### 4. Fluxo de Evento

```
Cliente solicita evento
  ↓
Criar proposta comercial
  ↓
Adicionar itens (produtos/serviços)
  ↓
Status: Em Análise
  ↓
Negociação
  ↓
Status: Aprovada
  ↓
[Trigger automático]
  ↓
Criar registro em events
  ↓
Criar event_notifications (30d, 15d, 7d, 3d, 1d, dia)
  ↓
Criar event_table
  ↓
Aplicar consumption_profile
  ↓
Gerar event_production_order
  ↓
Produção executada
  ↓
Evento realizado
  ↓
Status: Concluído
```

### 5. Fluxo de Inventário

```
Criar inventory_cycle
  ↓
Status: draft
  ↓
Gerar inventory_adjustments (draft)
  ↓
Contadores realizam contagem física
  ↓
Atualizar physical_quantity
  ↓
Finalizar ciclo
  ↓
[rpc_inventory_finalize]
  ↓
Ajustes aplicados em stock_items
  ↓
Criar stock_movements para auditoria
  ↓
Status: closed
```

### 6. Fluxo de Acesso a Dados Sensíveis (PII)

```
Usuário acessa dados de cliente
  ↓
[useSecureClientData]
  ↓
Verificar role via RLS
  ↓
Se não-admin: aplicar mascaramento
  ↓
[log_pii_access]
  ↓
Registrar em security_audit_log
  ↓
[detect_pii_anomaly]
  ↓
Verificar padrões suspeitos
  ↓
Se anomalia: criar em pii_access_anomalies
  ↓
Se severidade alta: criar security_alert
  ↓
Retornar dados (mascarados ou completos)
```

### 7. Fluxo de Bloqueio de Conta

```
Tentativa de login
  ↓
[check_account_lockout]
  ↓
Se bloqueado: rejeitar com mensagem
  ↓
Verificar credenciais
  ↓
Se falha: registrar em auth_attempts
  ↓
Contar falhas recentes (últimos 15min)
  ↓
Se >= 5 falhas
  ↓
[create_account_lockout]
  ↓
Bloquear por 30 minutos
  ↓
Criar security_alert
  ↓
Notificar admins
```

---

## 🎨 Design System

### Cores (Tailwind Theme)
- Primary: HSL baseado
- Secondary, Accent, Muted
- Destructive, Success, Warning
- Background, Foreground, Border
- Suporte a dark/light mode

### Componentes UI (shadcn/ui)
- Button, Input, Select, Textarea
- Dialog, Sheet, Popover, Dropdown
- Table, Card, Badge, Alert
- Calendar, Date Picker
- Form components com validação
- Toast notifications (Sonner)
- Charts (Recharts)

### Tokens Semânticos
Todas as cores são definidas via CSS custom properties:
```css
--primary, --secondary, --accent
--background, --foreground
--card, --border, --input
--muted, --destructive, --success
```

---

## 📊 Métricas e Relatórios

### Relatórios Disponíveis
- Custo de produção
- Análise de estoque
- Materiais abaixo do mínimo
- Materiais sem preço
- Movimentações de estoque
- Relatórios financeiros
- Relatórios de produção
- Diagnósticos de BOMs

### Dashboards
- Dashboard principal (visão geral)
- Dashboard de segurança
- Dashboard de anomalias
- Dashboard financeiro

---

## 🔧 Configurações do Sistema

### Namespaces de Configuração
- `general`: Configurações gerais
- `colors`: Cores do sistema
- `stock`: Parâmetros de estoque
- `production`: Parâmetros de produção
- `events`: Configurações de eventos
- `sales`: Configurações de vendas
- `financial`: Configurações financeiras
- `rh`: Configurações de RH

### Feature Flags
Sistema preparado para feature flags configuráveis por namespace.

### Taxonomias
Sistema de taxonomias para categorização flexível:
- `material_category`: Categorias de materiais
- `material_subcategory`: Subcategorias
- Relacionamentos hierárquicos (parent_id)

---

## 🚀 Deployment e Produção

### Ambiente de Produção
- URL: receita-maestro-digital.lovable.app
- SSL automático
- CDN global
- Auto-scaling

### Supabase
- Project ID: njxxqdcwvehlvqufuyww
- Região: Auto-selecionada
- Backups automáticos
- Realtime subscriptions habilitado

### Edge Functions
- `password-reset`: Reset de senha via email
- `password-verification-hook`: Validação de senha + HaveIBeenPwned

---

## 📝 Dados de Exemplo e Seeds

### Taxonomias Pre-cadastradas
Ao importar via `import_taxonomy_from_csv()`:

**Categorias Principais:**
- INS: Insumo
- EMB: Embalagem
- INT: Produto Intermediário
- FIN: Produto Acabado
- COM: Produto Composto
- REV: Produto de Revenda
- HIG: Higiene e Limpeza
- EQU: Equipamentos
- UTE: Utensílios
- TEX: Têxteis & Apoios
- INF: Infraestrutura & Eventos

**Subcategorias (exemplos):**
- INS_PAN: Panificados
- INS_COND: Condimentos & Temperos
- INS_HORT: Hortifruti
- INS_LAT: Laticínios
- EMB_PRI: Embalagens Primárias
- FIN_SAL: Salgados (sanduíches, tortinhas)
- FIN_DOC: Doces (bolos, tortas)

---

## 🐛 Diagnóstico e Manutenção

### Views de Diagnóstico
- `vw_diag_material_dupes`: Materiais duplicados
- `vw_diag_bom_inconsistencies`: Inconsistências em BOMs
- `vw_diag_orphans`: Materiais órfãos

### Funções de Diagnóstico
- `diag_bom_migration_report()`: Relatório de status
- `sanitize_bom_for_material(uuid)`: Limpar BOMs duplicadas
- `run_bom_cleanup_playbook()`: Limpeza automática

### Funções de Migração
- `suggest_material_taxonomy_migration()`: Sugerir migração para taxonomias
- `ops_archive_legacy_recipes()`: Arquivar receitas legadas
- `finalize_legacy_recipes_to_bom()`: Migrar receitas para BOMs

---

## 🔒 Segurança: Resumo de Controles

| Camada | Controle | Status |
|--------|----------|--------|
| Autenticação | Email/Password | ✅ |
| Autenticação | Password Strength | ✅ |
| Autenticação | HaveIBeenPwned Check | ✅ |
| Autenticação | Rate Limiting | ✅ |
| Autenticação | Account Lockout | ✅ |
| Autorização | Role-based (RLS) | ✅ |
| Autorização | Permission-based | ✅ |
| Dados | PII Masking | ✅ |
| Dados | PII Access Log | ✅ |
| Dados | Anomaly Detection | ✅ |
| Auditoria | Security Audit Log | ✅ |
| Auditoria | Config Changes Log | ✅ |
| Auditoria | Auth Attempts Log | ✅ |
| Monitoring | Real-time Alerts | ✅ |
| Monitoring | Security Dashboard | ✅ |
| Session | Timeout | ✅ |
| Session | Activity Tracking | ✅ |
| Network | HTTPS (SSL) | ✅ |
| Network | CORS | ✅ |
| MFA | Preparado | 🚧 |

---

## 📚 Dependências Principais

### Frontend
```json
{
  "@supabase/supabase-js": "^2.57.4",
  "@tanstack/react-query": "^5.83.0",
  "react": "^18.3.1",
  "react-router-dom": "^6.30.1",
  "react-hook-form": "^7.61.1",
  "zod": "^3.25.76",
  "tailwindcss": "latest",
  "recharts": "^2.15.4",
  "lucide-react": "^0.462.0",
  "sonner": "^1.7.4"
}
```

### Backend
- PostgreSQL 15+
- Supabase Edge Functions (Deno)

---

## 🎯 Roadmap Futuro (Planejado)

### Multi-Tenancy (SaaS)
- [ ] Tabela `organizations`
- [ ] Isolamento por `organization_id`
- [ ] Integração Stripe para assinaturas
- [ ] Planos e limites por organização
- [ ] Onboarding multi-tenant

### Features Adicionais
- [ ] MFA (Multi-Factor Authentication)
- [ ] Notificações push
- [ ] App mobile (React Native)
- [ ] Integrações (WhatsApp, email)
- [ ] Analytics avançado
- [ ] BI e relatórios customizáveis

---

## 📞 Informações Técnicas de Contato

**Supabase Project:**
- Project ID: njxxqdcwvehlvqufuyww
- Anon Key: (configurado no ambiente)
- URL: https://njxxqdcwvehlvqufuyww.supabase.co

**Lovable:**
- Plataforma: https://lovable.dev
- Projeto: receita-maestro-digital

---

## 🏁 Conclusão

O **Receita Maestro Digital** é um sistema ERP completo e robusto para gestão de catering e eventos, com foco em:

1. **Gestão Completa de Produção**: BOMs hierárquicos, ordens de produção, controle de estoque
2. **Segurança de Nível Enterprise**: RLS, PII masking, anomaly detection, auditoria completa
3. **Flexibilidade**: Taxonomias customizáveis, configurações por namespace, feature flags
4. **Escalabilidade**: Arquitetura baseada em Supabase, preparada para crescimento
5. **UX Moderna**: React + shadcn/ui, design system consistente, responsivo

**Status Atual:** Sistema funcional em produção, com arquitetura sólida e pronto para expansão.

**Próximos Passos:** Transformação em plataforma SaaS multi-tenant com modelo de assinaturas.

---

*Documento gerado em: 2025-10-02*  
*Versão: 1.0*  
*Para uso técnico e análise do sistema*
