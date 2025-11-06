# 📋 DOCUMENTAÇÃO COMPLETA DO SISTEMA COFFEELIER ERP

**Versão**: 2.0  
**Data**: Janeiro 2025  
**Tecnologia**: React + TypeScript + Supabase + Tailwind CSS

---

## 🎯 VISÃO GERAL

Sistema ERP completo para gestão de cafeterias e confeitarias, com foco em:
- Gestão de materiais e estoque
- Produção e BOM (Bill of Materials)
- Compras e fornecedores
- Vendas e clientes
- Financeiro
- Recursos Humanos
- Agenda e Eventos

---

## 🏗️ ARQUITETURA DO SISTEMA

### Stack Tecnológico
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **UI**: Tailwind CSS + shadcn/ui + Radix UI
- **Estado**: TanStack Query (React Query)
- **Roteamento**: React Router v6
- **Autenticação**: Supabase Auth com PKCE
- **Segurança**: RLS (Row Level Security) + RBAC (Role-Based Access Control)

### Estrutura de Pastas
```
src/
├── components/          # Componentes reutilizáveis
│   ├── ui/             # Componentes base (shadcn)
│   ├── config/         # Configurações
│   ├── bom/            # Bill of Materials
│   ├── inventory/      # Inventário
│   ├── purchase/       # Compras
│   ├── sales/          # Vendas
│   ├── events/         # Eventos
│   ├── security/       # Segurança
│   └── ...
├── pages/              # Páginas/Rotas
├── hooks/              # Custom Hooks
├── lib/                # Utilitários
├── types/              # TypeScript Types
└── integrations/       # Integrações (Supabase)

supabase/
├── functions/          # Edge Functions
└── migrations/         # Migrações SQL
```

---

## 🗄️ ESTRUTURA DO BANCO DE DADOS

### 1️⃣ MATERIAIS (materials)
**Tabela central do sistema** - armazena todos os tipos de materiais

```sql
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,              -- Código único (ex: MAT-0001)
  name TEXT NOT NULL,                     -- Nome do material
  description TEXT,                       -- Descrição detalhada
  material_type TEXT NOT NULL,            -- Tipo: ingredient, packaging, intermediate_product, finished_product, composite_product
  category TEXT NOT NULL,                 -- Categoria principal
  subcategory TEXT,                       -- Subcategoria
  category_term_id UUID,                  -- FK para taxonomy_terms
  subcategory_term_id UUID,               -- FK para taxonomy_terms
  purchase_unit TEXT NOT NULL,            -- Unidade de compra (kg, un, cx)
  usage_unit TEXT NOT NULL,               -- Unidade de uso (g, mL, un)
  conversion_factor NUMERIC NOT NULL,     -- Fator de conversão
  price_per_purchase_unit NUMERIC,        -- Preço por unidade de compra
  unit_weight NUMERIC,                    -- Peso unitário (quando aplicável)
  supplier_id UUID,                       -- FK para suppliers
  allowed_brands TEXT[],                  -- Marcas permitidas
  is_sellable BOOLEAN DEFAULT false,      -- Pode ser vendido?
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Tipos de Materiais**:
- `ingredient`: Ingredientes (farinha, açúcar, ovos)
- `packaging`: Embalagens (caixas, sacolas, etiquetas)
- `intermediate_product`: Produtos intermediários (massa pronta, recheio)
- `finished_product`: Produtos finais (bolo pronto, pão)
- `composite_product`: Kits/cestas (kit café da manhã)

### 2️⃣ ESTOQUE (stock_items, stock_movements)

**stock_items** - Estoque atual por material
```sql
CREATE TABLE stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID UNIQUE NOT NULL,       -- FK para materials
  quantity NUMERIC DEFAULT 0,             -- Quantidade atual
  unit TEXT NOT NULL,                     -- Unidade de medida
  min_stock NUMERIC DEFAULT 0,            -- Estoque mínimo
  max_stock NUMERIC,                      -- Estoque máximo
  last_counted_at TIMESTAMPTZ,           -- Última contagem
  last_purchase_date DATE,               -- Última compra
  last_purchase_price NUMERIC,           -- Último preço pago
  weighted_avg_price NUMERIC,            -- Preço médio ponderado
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**stock_movements** - Histórico de movimentações
```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL,              -- FK para materials
  movement_type TEXT NOT NULL,            -- Tipo: purchase, production, sale, adjustment, return, transfer, waste
  quantity NUMERIC NOT NULL,              -- Quantidade movimentada
  unit TEXT NOT NULL,                     -- Unidade
  unit_price NUMERIC,                     -- Preço unitário
  total_cost NUMERIC,                     -- Custo total
  reference_id UUID,                      -- ID de referência (pedido, nota, etc)
  reference_type TEXT,                    -- Tipo de referência
  notes TEXT,                             -- Observações
  created_by UUID,                        -- Usuário que criou
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Tipos de Movimentação**:
- `purchase`: Entrada por compra
- `production`: Entrada/saída por produção
- `sale`: Saída por venda
- `adjustment`: Ajuste de inventário
- `return`: Devolução
- `transfer`: Transferência
- `waste`: Descarte/perda

### 3️⃣ BOM - BILL OF MATERIALS

**recipes_bom** - Receitas/Fichas Técnicas
```sql
CREATE TABLE recipes_bom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finished_material_id UUID UNIQUE NOT NULL, -- Material produzido
  yield_quantity NUMERIC NOT NULL,           -- Rendimento
  yield_unit TEXT NOT NULL,                  -- Unidade do rendimento
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**recipe_bom_items** - Ingredientes/componentes
```sql
CREATE TABLE recipe_bom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL,                   -- FK para recipes_bom
  material_id UUID NOT NULL,                 -- Material usado
  quantity NUMERIC NOT NULL,                 -- Quantidade
  unit TEXT NOT NULL,                        -- Unidade
  position INTEGER,                          -- Ordem
  is_packaging BOOLEAN DEFAULT false,        -- É embalagem?
  UNIQUE(recipe_id, material_id)
);
```

**composites_bom** - Produtos compostos (kits)
```sql
CREATE TABLE composites_bom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composite_material_id UUID UNIQUE NOT NULL, -- Material composto
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**composite_bom_items** - Componentes do kit
```sql
CREATE TABLE composite_bom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composite_id UUID NOT NULL,                -- FK para composites_bom
  component_material_id UUID NOT NULL,       -- Componente
  quantity NUMERIC NOT NULL,                 -- Quantidade
  unit TEXT NOT NULL,                        -- Unidade
  UNIQUE(composite_id, component_material_id)
);
```

### 4️⃣ PRODUÇÃO (bom_production_orders)

```sql
CREATE TABLE bom_production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,         -- Número da ordem
  recipe_id UUID,                            -- FK para recipes_bom
  composite_id UUID,                         -- FK para composites_bom
  finished_material_id UUID NOT NULL,        -- Material produzido
  planned_quantity NUMERIC NOT NULL,         -- Quantidade planejada
  produced_quantity NUMERIC DEFAULT 0,       -- Quantidade produzida
  status TEXT DEFAULT 'planned',             -- Status: planned, in_progress, completed, cancelled
  production_date DATE,                      -- Data de produção
  completed_at TIMESTAMPTZ,                  -- Data de conclusão
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 5️⃣ FORNECEDORES (suppliers)

```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,                 -- Código (FORN-0001)
  name TEXT NOT NULL,                        -- Nome/Razão Social
  trading_name TEXT,                         -- Nome Fantasia
  cnpj_cpf TEXT,                            -- CNPJ/CPF
  email TEXT,                               -- Email
  phone TEXT,                               -- Telefone
  address TEXT,                             -- Endereço completo
  city TEXT,                                -- Cidade
  state TEXT,                               -- Estado
  zip_code TEXT,                            -- CEP
  contact_person TEXT,                      -- Pessoa de contato
  payment_terms TEXT,                       -- Condições de pagamento
  notes TEXT,                               -- Observações
  is_active BOOLEAN DEFAULT true,           -- Ativo?
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 6️⃣ COMPRAS (purchase_invoices, purchase_invoice_items)

**purchase_invoices** - Notas fiscais de compra
```sql
CREATE TABLE purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,              -- Número da NF
  supplier_id UUID NOT NULL,                 -- FK para suppliers
  issue_date DATE NOT NULL,                  -- Data de emissão
  receipt_date DATE,                         -- Data de recebimento
  total_amount NUMERIC NOT NULL,             -- Valor total
  discount_amount NUMERIC DEFAULT 0,         -- Desconto
  net_amount NUMERIC NOT NULL,               -- Valor líquido
  status TEXT DEFAULT 'pending',             -- Status: pending, received, cancelled
  payment_due_date DATE,                     -- Vencimento
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**purchase_invoice_items** - Itens da nota
```sql
CREATE TABLE purchase_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,                  -- FK para purchase_invoices
  material_id UUID NOT NULL,                 -- FK para materials
  quantity NUMERIC NOT NULL,                 -- Quantidade
  unit TEXT NOT NULL,                        -- Unidade
  unit_price NUMERIC NOT NULL,               -- Preço unitário
  total_price NUMERIC NOT NULL,              -- Total do item
  discount NUMERIC DEFAULT 0,                -- Desconto
  notes TEXT
);
```

### 7️⃣ CLIENTES (clients)

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,                 -- Código (CLI-0001)
  name TEXT NOT NULL,                        -- Nome/Razão Social
  trading_name TEXT,                         -- Nome Fantasia
  cnpj_cpf TEXT,                            -- CNPJ/CPF
  email TEXT,                               -- Email
  phone TEXT,                               -- Telefone
  address TEXT,                             -- Endereço
  city TEXT,                                -- Cidade
  state TEXT,                               -- Estado
  zip_code TEXT,                            -- CEP
  contact_person TEXT,                      -- Pessoa de contato
  customer_type TEXT,                       -- Tipo: individual, corporate, government
  payment_terms TEXT,                       -- Condições de pagamento
  credit_limit NUMERIC,                     -- Limite de crédito
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 8️⃣ VENDAS (sales_proposals, sales_proposal_items)

**sales_proposals** - Propostas/Orçamentos
```sql
CREATE TABLE sales_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_number TEXT UNIQUE NOT NULL,      -- Número da proposta
  client_id UUID NOT NULL,                   -- FK para clients
  issue_date DATE NOT NULL,                  -- Data de emissão
  valid_until DATE,                          -- Válido até
  status TEXT DEFAULT 'draft',               -- Status: draft, sent, approved, rejected, expired
  total_amount NUMERIC NOT NULL,             -- Valor total
  discount_amount NUMERIC DEFAULT 0,         -- Desconto
  net_amount NUMERIC NOT NULL,               -- Valor líquido
  payment_terms TEXT,                        -- Condições de pagamento
  delivery_terms TEXT,                       -- Condições de entrega
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**sales_proposal_items** - Itens da proposta
```sql
CREATE TABLE sales_proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL,                 -- FK para sales_proposals
  material_id UUID NOT NULL,                 -- FK para materials
  category TEXT,                             -- Categoria do item
  quantity NUMERIC NOT NULL,                 -- Quantidade
  unit TEXT NOT NULL,                        -- Unidade
  unit_price NUMERIC NOT NULL,               -- Preço unitário
  total_price NUMERIC NOT NULL,              -- Total
  notes TEXT,
  position INTEGER                           -- Ordem
);
```

### 9️⃣ EVENTOS (events, event_tables)

**events** - Eventos/Cerimônias
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,                       -- Título do evento
  client_id UUID,                            -- FK para clients
  event_date TIMESTAMPTZ NOT NULL,           -- Data/hora do evento
  event_type TEXT NOT NULL,                  -- Tipo: wedding, birthday, corporate, etc
  location TEXT,                             -- Local
  guest_count INTEGER,                       -- Número de convidados
  status TEXT DEFAULT 'planned',             -- Status: planned, confirmed, in_progress, completed, cancelled
  budget NUMERIC,                            -- Orçamento
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**event_tables** - Mesas do evento
```sql
CREATE TABLE event_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,                    -- FK para events
  table_number TEXT NOT NULL,                -- Número/nome da mesa
  guest_count INTEGER NOT NULL,              -- Convidados nesta mesa
  service_style TEXT,                        -- Estilo de serviço
  notes TEXT,
  UNIQUE(event_id, table_number)
);
```

### 🔟 TAXONOMIAS (taxonomy_definitions, taxonomy_terms)

**taxonomy_definitions** - Definições de taxonomia
```sql
CREATE TABLE taxonomy_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,                  -- Chave única (material_category)
  name TEXT NOT NULL,                        -- Nome (Categorias de Materiais)
  description TEXT,                          -- Descrição
  is_hierarchical BOOLEAN DEFAULT false,     -- Permite hierarquia?
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**taxonomy_terms** - Termos da taxonomia
```sql
CREATE TABLE taxonomy_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomy_id UUID NOT NULL,                 -- FK para taxonomy_definitions
  term TEXT NOT NULL,                        -- Termo (Laticínios)
  slug TEXT NOT NULL,                        -- Slug (laticinios)
  parent_id UUID,                            -- Pai (para hierarquia)
  description TEXT,                          -- Descrição
  sort_order INTEGER DEFAULT 0,              -- Ordem
  metadata JSONB,                            -- Metadados extras
  UNIQUE(taxonomy_id, slug)
);
```

**Taxonomias Principais**:
- `material_category`: Categorias de materiais
- `material_subcategory`: Subcategorias
- `product_category`: Categorias de produtos
- `event_type`: Tipos de eventos
- `expense_category`: Categorias de despesas

### 1️⃣1️⃣ CONFIGURAÇÕES (config_namespaces, config_options, config_values)

**config_namespaces** - Namespaces de configuração
```sql
CREATE TABLE config_namespaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,                  -- Namespace (producao, estoque, financeiro)
  name TEXT NOT NULL,                        -- Nome
  description TEXT,                          -- Descrição
  icon TEXT,                                 -- Ícone (Lucide)
  sort_order INTEGER DEFAULT 0
);
```

**config_options** - Opções disponíveis
```sql
CREATE TABLE config_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id UUID NOT NULL,                -- FK para config_namespaces
  key TEXT NOT NULL,                         -- Chave (perdas_percentual)
  name TEXT NOT NULL,                        -- Nome
  description TEXT,                          -- Descrição
  value_type TEXT NOT NULL,                  -- Tipo: string, number, boolean, json
  default_value JSONB,                       -- Valor padrão
  validation_rules JSONB,                    -- Regras de validação
  UNIQUE(namespace_id, key)
);
```

**config_values** - Valores configurados
```sql
CREATE TABLE config_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id UUID NOT NULL,                -- FK para config_namespaces
  key TEXT NOT NULL,                         -- Chave
  value_jsonb JSONB NOT NULL,                -- Valor
  updated_by UUID,                           -- Quem atualizou
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(namespace_id, key)
);
```

**Namespaces Ativos**:
1. `producao`: Configurações de produção
2. `estoque`: Configurações de estoque
3. `financeiro`: Configurações financeiras
4. `vendas`: Configurações de vendas
5. `eventos`: Configurações de eventos
6. `rh`: Configurações de RH
7. `geral`: Configurações gerais

### 1️⃣2️⃣ USUÁRIOS E PERMISSÕES (user_roles, user_permissions)

**user_roles** - Funções dos usuários
```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,                     -- FK para auth.users
  role TEXT NOT NULL,                        -- Role: admin, manager, financial, user
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);
```

**Roles Disponíveis**:
- `admin`: Administrador total
- `manager`: Gerente (acesso amplo)
- `financial`: Financeiro
- `user`: Usuário padrão

**user_permissions** - Permissões granulares
```sql
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,                     -- FK para auth.users
  category TEXT NOT NULL,                    -- Categoria
  subcategory TEXT,                          -- Subcategoria
  permission_level TEXT DEFAULT 'read',      -- Level: none, read, write, admin
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, category, subcategory)
);
```

### 1️⃣3️⃣ RECURSOS HUMANOS (employees, time_records)

**employees** - Funcionários
```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,                       -- FK para auth.users (opcional)
  code TEXT UNIQUE NOT NULL,                 -- Código (FUNC-0001)
  full_name TEXT NOT NULL,                   -- Nome completo
  cpf TEXT,                                  -- CPF
  email TEXT,                                -- Email
  phone TEXT,                                -- Telefone
  birth_date DATE,                           -- Data de nascimento
  hire_date DATE,                            -- Data de admissão
  termination_date DATE,                     -- Data de demissão
  position TEXT,                             -- Cargo
  department TEXT,                           -- Departamento
  salary NUMERIC,                            -- Salário
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**time_records** - Registros de ponto
```sql
CREATE TABLE time_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,                 -- FK para employees
  record_date DATE NOT NULL,                 -- Data
  clock_in TIMESTAMPTZ,                      -- Entrada
  clock_out TIMESTAMPTZ,                     -- Saída
  break_start TIMESTAMPTZ,                   -- Início intervalo
  break_end TIMESTAMPTZ,                     -- Fim intervalo
  total_hours NUMERIC,                       -- Total de horas
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🔐 SEGURANÇA

### RLS (Row Level Security)
Todas as tabelas principais têm RLS ativado com políticas baseadas em:
- Autenticação (auth.uid())
- Roles (user_roles)
- Permissões (user_permissions)

### Funções de Segurança
```sql
-- Verificar se usuário tem role específico
has_role(user_id, role) RETURNS boolean

-- Verificar se é admin ou manager
is_admin_or_manager(user_id) RETURNS boolean

-- Mascarar email
mask_email(email) RETURNS text

-- Mascarar CNPJ/CPF
mask_cnpj_cpf(cnpj_cpf) RETURNS text
```

### Políticas RLS Principais
1. **SELECT**: Todos autenticados podem ler (com algumas exceções)
2. **INSERT**: Usuários autenticados podem inserir seus dados
3. **UPDATE**: Admin/Manager ou proprietário do registro
4. **DELETE**: Apenas Admin/Manager

---

## 🔄 FUNCIONALIDADES PRINCIPAIS

### 1. Gestão de Materiais
- ✅ Cadastro completo de materiais (5 tipos)
- ✅ Sistema de categorização hierárquico (taxonomia)
- ✅ Conversão de unidades automática
- ✅ Preços e fornecedores
- ✅ Importação em lote via CSV
- ✅ Códigos automáticos

### 2. Controle de Estoque
- ✅ Visão em tempo real do estoque
- ✅ Movimentações rastreadas
- ✅ Inventário cíclico
- ✅ Alertas de estoque mínimo
- ✅ Preço médio ponderado
- ✅ Relatórios de estoque

### 3. BOM (Bill of Materials)
- ✅ Fichas técnicas de produção
- ✅ BOM para produtos intermediários e finais
- ✅ Kits e compostos
- ✅ Cálculo automático de custos
- ✅ Validação de estoque disponível
- ✅ Histórico de custos

### 4. Produção
- ✅ Ordens de produção
- ✅ Execução de produção
- ✅ Baixa automática de estoque
- ✅ Entrada automática de produto acabado
- ✅ Rastreabilidade completa
- ✅ Relatórios de produção

### 5. Compras
- ✅ Cadastro de fornecedores
- ✅ Requisições de compra
- ✅ Ordens de compra
- ✅ Notas fiscais
- ✅ OCR de notas fiscais (via Edge Function)
- ✅ Entrada automática em estoque
- ✅ Gestão de preços

### 6. Vendas
- ✅ Cadastro de clientes
- ✅ Propostas comerciais
- ✅ Composição por categorias
- ✅ Cálculo de margem
- ✅ Impressão de propostas
- ✅ Controle de status
- ✅ Histórico de vendas

### 7. Eventos
- ✅ Agenda de eventos
- ✅ Gestão de mesas
- ✅ Perfis de consumo
- ✅ Integração com produção
- ✅ Notificações
- ✅ Anexos e documentos

### 8. Financeiro
- ✅ Contas a pagar
- ✅ Contas a receber
- ✅ Fluxo de caixa
- ✅ Centros de custo
- ✅ Análise financeira
- ✅ Relatórios contábeis

### 9. Recursos Humanos
- ✅ Cadastro de funcionários
- ✅ Controle de ponto
- ✅ Gestão de permissões
- ✅ Relatórios de RH

### 10. Configurações
- ✅ Sistema de configuração flexível
- ✅ Namespaces organizados
- ✅ Valores padrão e customizados
- ✅ Auditoria de mudanças
- ✅ Taxonomias customizáveis

---

## 📊 FLUXOS PRINCIPAIS

### Fluxo de Produção
```
1. Criar material do tipo "finished_product"
2. Criar BOM (recipes_bom) com ingredientes
3. Criar ordem de produção
4. Executar produção:
   - Valida estoque disponível
   - Baixa ingredientes do estoque
   - Adiciona produto acabado ao estoque
   - Registra movimentações
   - Calcula custos
5. Finalizar ordem
```

### Fluxo de Compras
```
1. Identificar necessidade (estoque baixo ou requisição)
2. Criar ordem de compra
3. Receber nota fiscal
4. Processar entrada:
   - Criar purchase_invoice
   - Criar purchase_invoice_items
   - Gerar stock_movements (tipo: purchase)
   - Atualizar stock_items
   - Atualizar preços (médio ponderado)
5. Registrar pagamento (financeiro)
```

### Fluxo de Vendas
```
1. Cadastrar cliente
2. Criar proposta:
   - Selecionar produtos vendáveis
   - Calcular custos e margens
   - Definir preços
3. Enviar proposta
4. Aprovar proposta
5. Gerar ordem de produção (se necessário)
6. Faturar e dar baixa em estoque
7. Registrar recebimento (financeiro)
```

### Fluxo de Eventos
```
1. Criar evento
2. Definir mesas e convidados
3. Selecionar perfil de consumo
4. Calcular necessidades de produção
5. Gerar ordens de produção automáticas
6. Executar produção
7. Realizar evento
8. Finalizar e analisar
```

---

## 🎨 COMPONENTES UI PRINCIPAIS

### Layout
- `Layout.tsx`: Layout principal com header, sidebar e outlet
- `Sidebar.tsx`: Menu lateral responsivo

### Materiais
- `MaterialsList.tsx`: Lista de materiais
- `MaterialsTable.tsx`: Tabela com filtros
- `MaterialForm.tsx`: Formulário de cadastro/edição
- `MaterialEditor.tsx`: Editor completo

### Estoque
- `StockOverview.tsx`: Visão geral do estoque
- `StockMovements.tsx`: Movimentações
- `InventoryCountForm.tsx`: Contagem de inventário
- `PricingHealthDashboard.tsx`: Diagnóstico de preços

### BOM e Produção
- `RecipeBOMForm.tsx`: Ficha técnica
- `CompositeBOMForm.tsx`: Produtos compostos
- `ProductionExecutor.tsx`: Execução de produção
- `BOMProductionOrdersList.tsx`: Lista de ordens

### Compras
- `PurchaseOrders.tsx`: Ordens de compra
- `PurchaseInvoices.tsx`: Notas fiscais
- `InvoiceOCRUploader.tsx`: Upload e OCR de NF
- `SupplierMatcher.tsx`: Matcher de fornecedores

### Vendas
- `ProposalComposer.tsx`: Compositor de propostas
- `ProposalsList.tsx`: Lista de propostas
- `ClientsList.tsx`: Lista de clientes

### Eventos
- `EventCalendar.tsx`: Calendário de eventos
- `EventForm.tsx`: Formulário de eventos
- `EventTableForm.tsx`: Gestão de mesas

### Configurações
- `ConfigParams.tsx`: Editor de parâmetros
- `TaxonomyManager.tsx`: Gestão de taxonomias

---

## 🪝 CUSTOM HOOKS PRINCIPAIS

### Autenticação e Segurança
- `useSecureAuth()`: Autenticação segura
- `useUserRole()`: Verificação de roles
- `useSessionSecurity()`: Monitoramento de sessão

### Dados
- `useConfig()`: Configurações do sistema
- `useMaterialBOM()`: BOMs de materiais
- `useStockEntryWithConversion()`: Entrada de estoque com conversão
- `useProductionValidation()`: Validação de produção

### Financeiro e RH
- `useFinancialPermissions()`: Permissões financeiras
- `useHRPermissions()`: Permissões de RH
- `useTimeClock()`: Controle de ponto

### Análises
- `usePricingAnalysis()`: Análise de precificação
- `useSecurityDashboard()`: Dashboard de segurança

---

## 🔧 EDGE FUNCTIONS (Supabase)

### 1. invoice-ocr
**Função**: Extração de dados de notas fiscais via OCR
**Endpoint**: `/invoice-ocr`
**Método**: POST
**Input**: Arquivo de imagem (base64)
**Output**: Dados estruturados da NF

### 2. admin-set-password
**Função**: Definir senha de usuário (admin)
**Endpoint**: `/admin-set-password`
**Método**: POST
**Requer**: Role admin

### 3. create-user-with-invite
**Função**: Criar usuário e enviar convite
**Endpoint**: `/create-user-with-invite`
**Método**: POST
**Requer**: Role admin/manager

### 4. delete-user
**Função**: Deletar usuário
**Endpoint**: `/delete-user`
**Método**: POST
**Requer**: Role admin

### 5. password-reset
**Função**: Reset de senha
**Endpoint**: `/password-reset`
**Método**: POST
**Público**: Sim

### 6. password-verification-hook
**Função**: Hook de verificação de senha (auth)
**Tipo**: Auth Hook
**Automático**: Sim

---

## 📈 MÉTRICAS E KPIs

### Estoque
- Valor total em estoque
- Itens abaixo do mínimo
- Taxa de giro de estoque
- Materiais sem preço
- Acurácia de inventário

### Produção
- Ordens completadas vs planejadas
- Taxa de desperdício
- Custo médio de produção
- Tempo médio de produção

### Financeiro
- Faturamento mensal
- Margem de lucro média
- Contas a receber pendentes
- Contas a pagar pendentes
- Fluxo de caixa projetado

### Vendas
- Taxa de conversão de propostas
- Ticket médio
- Clientes ativos
- Produtos mais vendidos

---

## 🚀 FEATURES AVANÇADAS

### 1. Sistema de Taxonomia Flexível
Permite categorização customizável e hierárquica para:
- Materiais
- Produtos
- Eventos
- Despesas
- Clientes

### 2. Conversão Automática de Unidades
Sistema inteligente que:
- Converte automaticamente entre unidades
- Mantém precisão nos cálculos
- Suporta múltiplos tipos de unidades

### 3. Preço Médio Ponderado
Cálculo automático de:
- Custo médio de materiais
- Impacto nas movimentações
- Histórico de preços

### 4. Validação de Estoque em Tempo Real
Antes de produzir:
- Valida disponibilidade
- Considera pedidos pendentes
- Sugere alternativas

### 5. Auditoria Completa
Registra:
- Todas as mudanças de configuração
- Movimentações de estoque
- Alterações de dados sensíveis
- Login/logout de usuários

### 6. Mascaramento de Dados Sensíveis
Proteção automática de:
- Emails (ma***@domain.com)
- CPF/CNPJ (***.**-**99)
- Dados financeiros (por permissão)

### 7. Sistema de Permissões Granulares
Controle fino por:
- Categoria
- Subcategoria
- Nível (none, read, write, admin)

### 8. Relatórios Dinâmicos
Geração automática de:
- Relatórios de estoque
- Análises de produção
- Demonstrativos financeiros
- Performance de vendas

---

## 🎛️ CONFIGURAÇÕES DO SISTEMA

### Namespace: producao
- `perdas_percentual`: Percentual de perdas (padrão: 5%)
- `tempo_preparo_padrao`: Tempo padrão de preparo (padrão: 30 min)
- `margem_seguranca`: Margem de segurança (padrão: 10%)

### Namespace: estoque
- `alerta_estoque_minimo`: Alertar estoque mínimo (padrão: true)
- `dias_alerta_vencimento`: Dias para alertar vencimento (padrão: 30)
- `habilitar_lotes`: Controle de lotes (padrão: false)

### Namespace: financeiro
- `moeda_padrao`: Moeda (padrão: BRL)
- `casas_decimais`: Casas decimais (padrão: 2)
- `regime_tributario`: Regime tributário

### Namespace: vendas
- `margem_lucro_minima`: Margem mínima (padrão: 30%)
- `validade_proposta_dias`: Validade proposta (padrão: 15)
- `desconto_maximo`: Desconto máximo (padrão: 20%)

### Namespace: eventos
- `antecedencia_minima_dias`: Antecedência mínima (padrão: 7)
- `tempo_montagem_horas`: Tempo de montagem (padrão: 2)

---

## 🔄 INTEGRAÇÕES FUTURAS

### Planejadas
1. **Nota Fiscal Eletrônica (NF-e)**
   - Emissão automática
   - Importação via XML

2. **Pagamentos Online**
   - Stripe/Mercado Pago
   - PIX automático

3. **WhatsApp Business**
   - Notificações
   - Confirmações de pedidos

4. **Sistema de Delivery**
   - Integração com apps
   - Rastreamento

5. **BI e Analytics**
   - Dashboard avançado
   - Previsão de demanda
   - Machine Learning

---

## 🐛 TROUBLESHOOTING COMUM

### 1. Material sem preço
**Problema**: Material não tem `price_per_purchase_unit`
**Solução**: Atualizar via tela de materiais ou importar nota fiscal

### 2. BOM duplicado
**Problema**: Material com múltiplos BOMs
**Solução**: Usar função `sanitize_bom_for_material(material_id)`

### 3. Estoque negativo
**Problema**: Movimentação deixou estoque negativo
**Solução**: Ajustar via inventário ou revisar movimentação

### 4. Erro de conversão de unidades
**Problema**: `conversion_factor` incorreto
**Solução**: Corrigir no cadastro do material

### 5. Permissão negada
**Problema**: Usuário sem role ou permissão
**Solução**: Atribuir role correto via User Management

---

## 📚 GLOSSÁRIO

**BOM**: Bill of Materials (Lista de Materiais)  
**RLS**: Row Level Security (Segurança em Nível de Linha)  
**RBAC**: Role-Based Access Control (Controle de Acesso Baseado em Papéis)  
**OCR**: Optical Character Recognition (Reconhecimento Óptico de Caracteres)  
**PKCE**: Proof Key for Code Exchange (chave de prova para troca de código)  
**Edge Function**: Função serverless executada na borda (Supabase)  
**Preço Médio Ponderado**: Método de custeio que considera o preço médio das compras  
**Produto Intermediário**: Produto semi-acabado usado em outras receitas  
**Produto Composto**: Kit ou cesta com vários produtos  
**Taxonomia**: Sistema de classificação hierárquico e customizável  

---

## 📞 SUPORTE TÉCNICO

### Logs e Debugging
- Console do navegador: Logs de autenticação e erros
- Supabase Dashboard: Logs de banco e edge functions
- Network tab: Requisições e respostas

### Comandos Úteis SQL
```sql
-- Ver todos os materiais sem preço
SELECT * FROM materials WHERE price_per_purchase_unit IS NULL;

-- Ver estoque abaixo do mínimo
SELECT m.name, s.quantity, s.min_stock 
FROM stock_items s 
JOIN materials m ON m.id = s.material_id 
WHERE s.quantity < s.min_stock;

-- Ver BOMs duplicados
SELECT finished_material_id, COUNT(*) 
FROM recipes_bom 
GROUP BY finished_material_id 
HAVING COUNT(*) > 1;

-- Ver movimentações de um material
SELECT * FROM stock_movements 
WHERE material_id = 'UUID_DO_MATERIAL' 
ORDER BY created_at DESC;
```

---

## 🏁 CONCLUSÃO

Este documento fornece uma visão completa do Sistema Coffeelier ERP v2.0. 

**Principais Destaques**:
- ✅ Arquitetura moderna e escalável
- ✅ Segurança robusta com RLS e RBAC
- ✅ Flexibilidade via sistema de taxonomias
- ✅ Rastreabilidade completa
- ✅ Interface intuitiva e responsiva
- ✅ Pronto para crescimento

**Próximos Passos Sugeridos**:
1. Implementar NF-e
2. Adicionar previsão de demanda
3. Criar app mobile
4. Integrar com sistemas de pagamento
5. Dashboard de BI avançado

---

**Última Atualização**: Janeiro 2025  
**Versão do Sistema**: 2.0  
**Autor**: Sistema Coffeelier ERP  
**Licença**: Proprietário