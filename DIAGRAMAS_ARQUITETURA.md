# 🏗️ DIAGRAMAS DE ARQUITETURA - SISTEMA COFFEELIER ERP

Este documento contém diagramas visuais da arquitetura, estrutura e fluxos do sistema.

---

## 📊 1. ARQUITETURA GERAL DO SISTEMA

```mermaid
graph TB
    subgraph "Frontend - React + TypeScript"
        UI[Interface do Usuário]
        Components[Componentes React]
        Hooks[Custom Hooks]
        State[TanStack Query]
    end
    
    subgraph "Camada de Integração"
        SupabaseClient[Supabase Client]
        Auth[Autenticação PKCE]
        RLS[Row Level Security]
    end
    
    subgraph "Backend - Supabase"
        Database[(PostgreSQL)]
        EdgeFunctions[Edge Functions]
        Storage[Storage Buckets]
        Realtime[Realtime]
    end
    
    subgraph "Segurança"
        RBAC[Role-Based Access]
        Permissions[Permissões Granulares]
        Audit[Log de Auditoria]
    end
    
    UI --> Components
    Components --> Hooks
    Hooks --> State
    State --> SupabaseClient
    SupabaseClient --> Auth
    Auth --> RLS
    RLS --> Database
    SupabaseClient --> EdgeFunctions
    SupabaseClient --> Storage
    Database --> RBAC
    RBAC --> Permissions
    Database --> Audit
    EdgeFunctions --> Database
```

---

## 🗄️ 2. ESTRUTURA DO BANCO DE DADOS (PRINCIPAIS ENTIDADES)

```mermaid
erDiagram
    MATERIALS ||--o{ STOCK_ITEMS : "tem estoque"
    MATERIALS ||--o{ STOCK_MOVEMENTS : "movimenta"
    MATERIALS ||--o{ RECIPE_BOM_ITEMS : "usado em"
    MATERIALS ||--o{ COMPOSITE_BOM_ITEMS : "componente de"
    
    RECIPES_BOM ||--|{ RECIPE_BOM_ITEMS : "contém"
    RECIPES_BOM ||--|| MATERIALS : "produz"
    RECIPES_BOM ||--o{ BOM_PRODUCTION_ORDERS : "gera ordem"
    
    COMPOSITES_BOM ||--|{ COMPOSITE_BOM_ITEMS : "contém"
    COMPOSITES_BOM ||--|| MATERIALS : "é material"
    
    SUPPLIERS ||--o{ MATERIALS : "fornece"
    SUPPLIERS ||--o{ PURCHASE_INVOICES : "vende para"
    
    PURCHASE_INVOICES ||--|{ PURCHASE_INVOICE_ITEMS : "contém"
    PURCHASE_INVOICE_ITEMS ||--|| MATERIALS : "compra"
    
    CLIENTS ||--o{ SALES_PROPOSALS : "recebe"
    SALES_PROPOSALS ||--|{ SALES_PROPOSAL_ITEMS : "contém"
    SALES_PROPOSAL_ITEMS ||--|| MATERIALS : "vende"
    
    EVENTS ||--o{ EVENT_TABLES : "tem mesas"
    EVENT_TABLES ||--o{ EVENT_TABLE_ITEMS : "requer materiais"
    EVENT_TABLE_ITEMS ||--|| MATERIALS : "usa"
    
    TAXONOMY_DEFINITIONS ||--|{ TAXONOMY_TERMS : "define termos"
    TAXONOMY_TERMS ||--o{ MATERIALS : "categoriza"
    
    MATERIALS {
        uuid id PK
        text code UK
        text name
        text material_type
        text category
        numeric price_per_purchase_unit
    }
    
    STOCK_ITEMS {
        uuid id PK
        uuid material_id FK
        numeric quantity
        numeric min_stock
    }
    
    RECIPES_BOM {
        uuid id PK
        uuid finished_material_id FK
        numeric yield_quantity
    }
    
    COMPOSITES_BOM {
        uuid id PK
        uuid composite_material_id FK
    }
```

---

## 🔐 3. FLUXO DE AUTENTICAÇÃO E AUTORIZAÇÃO

```mermaid
sequenceDiagram
    participant User as Usuário
    participant UI as Interface
    participant Auth as Supabase Auth
    participant DB as Database
    participant RLS as Row Level Security
    
    User->>UI: Acessar sistema
    UI->>Auth: Login (email/senha)
    Auth->>Auth: Validar credenciais
    Auth->>DB: Verificar user_roles
    DB-->>Auth: Roles do usuário
    Auth-->>UI: Token JWT + Session
    UI->>UI: Armazenar sessão
    
    User->>UI: Tentar acessar recurso
    UI->>DB: Query com JWT
    DB->>RLS: Avaliar políticas
    RLS->>RLS: Verificar auth.uid()
    RLS->>RLS: Verificar has_role()
    RLS->>RLS: Verificar permissões
    
    alt Autorizado
        RLS-->>DB: Permitir acesso
        DB-->>UI: Retornar dados
        UI-->>User: Mostrar conteúdo
    else Não autorizado
        RLS-->>DB: Bloquear acesso
        DB-->>UI: Erro 403
        UI-->>User: Acesso negado
    end
```

---

## 🏭 4. FLUXO DE PRODUÇÃO (BOM)

```mermaid
flowchart TD
    Start([Iniciar Produção]) --> CheckMaterial{Material tem BOM?}
    
    CheckMaterial -->|Não| Error1[Erro: BOM não encontrado]
    CheckMaterial -->|Sim| GetBOM[Buscar BOM e ingredientes]
    
    GetBOM --> ValidateStock{Estoque suficiente?}
    ValidateStock -->|Não| Alert1[Alerta: Estoque insuficiente]
    Alert1 --> Decision1{Continuar mesmo assim?}
    Decision1 -->|Não| End1([Cancelar])
    Decision1 -->|Sim| CreateOrder
    
    ValidateStock -->|Sim| CreateOrder[Criar ordem de produção]
    CreateOrder --> ReserveStock[Reservar materiais]
    ReserveStock --> StartProduction[Iniciar produção]
    
    StartProduction --> ConsumeStock[Baixar ingredientes do estoque]
    ConsumeStock --> RecordMovements[Registrar stock_movements tipo 'production']
    RecordMovements --> AddFinished[Adicionar produto acabado]
    AddFinished --> CalculateCost[Calcular custo total]
    CalculateCost --> UpdateHistory[Atualizar bom_cost_history]
    UpdateHistory --> CheckAlert{Variação > 10%?}
    
    CheckAlert -->|Sim| CreateAlert[Criar bom_cost_alerts]
    CheckAlert -->|Não| CompleteOrder
    CreateAlert --> CompleteOrder[Completar ordem]
    CompleteOrder --> End2([Produção Concluída])
    
    style Start fill:#90EE90
    style End1 fill:#FFB6C1
    style End2 fill:#90EE90
    style Error1 fill:#FF6B6B
    style Alert1 fill:#FFD700
```

---

## 🛒 5. FLUXO DE COMPRAS

```mermaid
flowchart LR
    subgraph "1. Identificação"
        A1[Estoque abaixo do mínimo] --> B1[Gerar requisição]
        A2[Necessidade de produção] --> B1
        A3[Solicitação manual] --> B1
    end
    
    subgraph "2. Cotação"
        B1 --> C1[Consultar fornecedores]
        C1 --> C2[Comparar preços]
        C2 --> C3[Selecionar fornecedor]
    end
    
    subgraph "3. Pedido"
        C3 --> D1[Criar ordem de compra]
        D1 --> D2[Enviar ao fornecedor]
        D2 --> D3[Aguardar entrega]
    end
    
    subgraph "4. Recebimento"
        D3 --> E1[Receber mercadoria]
        E1 --> E2[Validar quantidade/qualidade]
        E2 --> E3{OK?}
        E3 -->|Não| E4[Registrar devolução]
        E3 -->|Sim| E5[Upload nota fiscal]
    end
    
    subgraph "5. Processamento"
        E5 --> F1[OCR da nota fiscal]
        F1 --> F2[Validar dados]
        F2 --> F3[Criar purchase_invoice]
        F3 --> F4[Criar purchase_invoice_items]
        F4 --> F5[Gerar stock_movements]
        F5 --> F6[Atualizar stock_items]
        F6 --> F7[Calcular preço médio ponderado]
    end
    
    subgraph "6. Financeiro"
        F7 --> G1[Criar contas a pagar]
        G1 --> G2[Agendar pagamento]
        G2 --> G3[Registrar pagamento]
    end
    
    E4 --> H1([Fim])
    G3 --> H2([Concluído])
    
    style B1 fill:#FFE4B5
    style F1 fill:#87CEEB
    style G3 fill:#90EE90
```

---

## 💰 6. FLUXO DE VENDAS E PROPOSTAS

```mermaid
stateDiagram-v2
    [*] --> Cadastro_Cliente
    
    Cadastro_Cliente --> Criar_Proposta : Cliente registrado
    
    state Criar_Proposta {
        [*] --> Selecionar_Produtos
        Selecionar_Produtos --> Definir_Quantidades
        Definir_Quantidades --> Calcular_Custos
        Calcular_Custos --> Aplicar_Margem
        Aplicar_Margem --> Definir_Preços
        Definir_Preços --> [*]
    }
    
    Criar_Proposta --> Proposta_Rascunho : Salvar
    
    Proposta_Rascunho --> Proposta_Enviada : Enviar ao cliente
    Proposta_Enviada --> Proposta_Aprovada : Cliente aprova
    Proposta_Enviada --> Proposta_Rejeitada : Cliente rejeita
    Proposta_Enviada --> Proposta_Expirada : Prazo vence
    
    Proposta_Aprovada --> Gerar_Producao : Produtos precisam produção
    Gerar_Producao --> Executar_Producao
    Executar_Producao --> Baixar_Estoque
    
    Proposta_Aprovada --> Baixar_Estoque : Produtos em estoque
    
    Baixar_Estoque --> Faturamento
    Faturamento --> Contas_Receber
    Contas_Receber --> Recebimento
    Recebimento --> [*]
    
    Proposta_Rejeitada --> [*]
    Proposta_Expirada --> [*]
```

---

## 📅 7. FLUXO DE EVENTOS

```mermaid
graph TD
    A[Criar Evento] --> B[Definir dados básicos]
    B --> C[Adicionar cliente]
    C --> D[Definir data e local]
    D --> E{Usar template?}
    
    E -->|Sim| F[Selecionar template de mesa]
    E -->|Não| G[Criar mesas manualmente]
    
    F --> H[Criar mesas com template]
    G --> H
    H --> I[Definir número de convidados por mesa]
    
    I --> J{Usar perfil de consumo?}
    J -->|Sim| K[Selecionar perfil existente]
    J -->|Não| L[Adicionar itens manualmente]
    
    K --> M[Aplicar mix de categorias]
    M --> N[Calcular quantidades por pessoa]
    N --> O[Gerar event_table_items]
    
    L --> O
    O --> P[Consolidar necessidades totais]
    P --> Q[Gerar ordens de produção automáticas]
    
    Q --> R[event_production_orders]
    R --> S[Executar produção]
    S --> T[Realizar evento]
    T --> U[Finalizar e analisar]
    
    style A fill:#E6F3FF
    style T fill:#90EE90
    style U fill:#FFD700
```

---

## 🧩 8. MÓDULOS E SUAS INTERAÇÕES

```mermaid
graph TB
    subgraph "Módulo Central"
        Materials[Materiais]
        Stock[Estoque]
    end
    
    subgraph "Produção"
        BOM[Bill of Materials]
        Production[Ordens de Produção]
    end
    
    subgraph "Compras"
        Suppliers[Fornecedores]
        Purchases[Pedidos de Compra]
        Invoices[Notas Fiscais]
    end
    
    subgraph "Vendas"
        Clients[Clientes]
        Proposals[Propostas]
    end
    
    subgraph "Eventos"
        Events[Agenda de Eventos]
        EventTables[Mesas]
        EventProduction[Produção de Eventos]
    end
    
    subgraph "Financeiro"
        Payable[Contas a Pagar]
        Receivable[Contas a Receber]
        CashFlow[Fluxo de Caixa]
    end
    
    subgraph "RH"
        Employees[Funcionários]
        TimeClock[Ponto Eletrônico]
    end
    
    subgraph "Configurações"
        Config[Parâmetros]
        Taxonomy[Taxonomias]
        Permissions[Permissões]
    end
    
    %% Interações principais
    Materials --> Stock
    Materials --> BOM
    BOM --> Production
    Production --> Stock
    
    Suppliers --> Purchases
    Purchases --> Invoices
    Invoices --> Stock
    Invoices --> Payable
    
    Clients --> Proposals
    Proposals --> Production
    Proposals --> Receivable
    
    Events --> EventTables
    EventTables --> EventProduction
    EventProduction --> Production
    
    Stock --> Materials
    Payable --> CashFlow
    Receivable --> CashFlow
    
    Taxonomy --> Materials
    Config --> Production
    Config --> Stock
    Permissions --> Employees
    
    style Materials fill:#FFE4B5
    style Stock fill:#87CEEB
    style BOM fill:#DDA0DD
    style Production fill:#F0E68C
```

---

## 🔄 9. CICLO DE VIDA DE UM MATERIAL

```mermaid
stateDiagram-v2
    [*] --> Cadastro
    
    state Cadastro {
        [*] --> Dados_Basicos
        Dados_Basicos --> Categoria
        Categoria --> Unidades
        Unidades --> Fornecedor
        Fornecedor --> [*]
    }
    
    Cadastro --> Material_Ativo
    
    state Material_Ativo {
        state "Em Estoque" as Estoque
        state "Sem Estoque" as SemEstoque
        
        [*] --> SemEstoque
        SemEstoque --> Estoque : Compra
        Estoque --> SemEstoque : Consumo
        Estoque --> Estoque : Ajustes
    }
    
    Material_Ativo --> Usado_BOM : Material é ingrediente
    Usado_BOM --> Material_Ativo
    
    Material_Ativo --> Tem_BOM : Material é produto
    Tem_BOM --> Material_Ativo
    
    Material_Ativo --> Em_Proposta : Material vendável
    Em_Proposta --> Material_Ativo
    
    Material_Ativo --> Material_Inativo : Descontinuar
    Material_Inativo --> Material_Ativo : Reativar
    
    Material_Ativo --> [*] : Arquivar
```

---

## 💾 10. CAMADAS DE DADOS E SEGURANÇA

```mermaid
graph LR
    subgraph "Frontend Layer"
        A1[UI Components] --> A2[Custom Hooks]
        A2 --> A3[TanStack Query]
    end
    
    subgraph "API Layer"
        A3 --> B1[Supabase Client]
        B1 --> B2[Authentication]
        B2 --> B3[Session Management]
    end
    
    subgraph "Security Layer"
        B3 --> C1{Authenticated?}
        C1 -->|No| C2[Reject]
        C1 -->|Yes| C3[Check RLS Policies]
        C3 --> C4[Verify Role]
        C4 --> C5[Check Permissions]
    end
    
    subgraph "Data Layer"
        C5 -->|Authorized| D1[PostgreSQL]
        D1 --> D2[Tables]
        D1 --> D3[Views]
        D1 --> D4[Functions]
    end
    
    subgraph "Audit Layer"
        D2 --> E1[Trigger: audit_log]
        D2 --> E2[Trigger: updated_at]
        E1 --> E3[(ops_config_audit_log)]
    end
    
    C2 --> F1[Return 403]
    D1 --> F2[Return Data]
    
    style C1 fill:#FFD700
    style C5 fill:#90EE90
    style C2 fill:#FF6B6B
```

---

## 📈 11. FLUXO DE CÁLCULO DE CUSTOS

```mermaid
flowchart TD
    A[Iniciar Cálculo] --> B{Tipo de Material}
    
    B -->|Ingrediente/Embalagem| C[Custo = price_per_purchase_unit]
    
    B -->|Produto Intermediário| D[Buscar recipes_bom]
    D --> E[Buscar recipe_bom_items]
    E --> F[Para cada ingrediente:]
    F --> G[Custo = quantidade × custo_unitário]
    G --> H[Somar todos os custos]
    H --> I[Custo Total do BOM]
    
    B -->|Produto Final| J[Buscar recipes_bom]
    J --> K[Processar ingredientes recursivamente]
    K --> L[Incluir embalagens is_packaging=true]
    L --> M[Aplicar perdas configuráveis]
    M --> N[Custo Final]
    
    B -->|Produto Composto| O[Buscar composites_bom]
    O --> P[Para cada componente:]
    P --> Q[Buscar custo do componente]
    Q --> R[Multiplicar por quantidade]
    R --> S[Somar todos]
    S --> T[Custo do Composto]
    
    C --> U{Salvar em cache?}
    I --> U
    N --> U
    T --> U
    
    U -->|Sim| V[Atualizar cached_total_cost]
    U -->|Não| W[Retornar custo calculado]
    V --> W
    
    W --> X{Mudança > 10%?}
    X -->|Sim| Y[Criar bom_cost_alerts]
    X -->|Não| Z[Fim]
    Y --> AA[Registrar bom_cost_history]
    AA --> Z[Fim]
    
    style A fill:#E6F3FF
    style Z fill:#90EE90
    style Y fill:#FFD700
```

---

## 🔍 12. SISTEMA DE TAXONOMIAS

```mermaid
graph TD
    A[taxonomy_definitions] --> B[material_category]
    A --> C[material_subcategory]
    A --> D[product_category]
    A --> E[event_type]
    A --> F[expense_category]
    
    B --> B1[taxonomy_terms]
    B1 --> B2[Laticínios]
    B1 --> B3[Cereais]
    B1 --> B4[Bebidas]
    
    B2 --> B2A[Leite]
    B2 --> B2B[Queijos]
    B2 --> B2C[Iogurtes]
    
    C --> C1[taxonomy_terms - subcategorias]
    
    D --> D1[taxonomy_terms]
    D1 --> D2[Salgados]
    D1 --> D3[Doces]
    D1 --> D4[Bebidas]
    
    B1 -.referencia.-> M[materials.category_term_id]
    C1 -.referencia.-> M2[materials.subcategory_term_id]
    
    style A fill:#FFE4B5
    style B fill:#DDA0DD
    style D fill:#87CEEB
```

---

## ⚙️ 13. SISTEMA DE CONFIGURAÇÕES

```mermaid
graph TB
    subgraph "Estrutura"
        A[config_namespaces] --> B[producao]
        A --> C[estoque]
        A --> D[financeiro]
        A --> E[vendas]
        A --> F[eventos]
        A --> G[rh]
        
        B --> B1[config_options]
        B1 --> B1A[perdas_percentual]
        B1 --> B1B[tempo_preparo_padrao]
        
        C --> C1[config_options]
        C1 --> C1A[alerta_estoque_minimo]
        C1 --> C1B[dias_alerta_vencimento]
    end
    
    subgraph "Valores"
        B1A -.tem valor.-> V1[config_values]
        V1 --> V1A[value_jsonb: 5]
        
        B1B -.usa padrão.-> V2[default_value]
        V2 --> V2A[30 minutos]
    end
    
    subgraph "Uso"
        APP[Aplicação] --> HOOK[useConfig hook]
        HOOK --> FUNC[get_config function]
        FUNC --> CHECK{Valor customizado?}
        CHECK -->|Sim| RET1[Retorna config_values]
        CHECK -->|Não| RET2[Retorna default_value]
    end
    
    style A fill:#FFE4B5
    style V1 fill:#90EE90
    style V2 fill:#87CEEB
```

---

## 🎯 CONCLUSÃO

Estes diagramas fornecem uma visão visual completa da arquitetura do Sistema Coffeelier ERP, incluindo:

- ✅ Arquitetura geral em camadas
- ✅ Modelo de dados e relacionamentos
- ✅ Fluxos de autenticação e autorização
- ✅ Processos de negócio (produção, compras, vendas, eventos)
- ✅ Interações entre módulos
- ✅ Ciclo de vida de dados
- ✅ Sistemas de segurança e auditoria
- ✅ Cálculos e configurações

**Para visualizar**: Cole o código Mermaid em ferramentas como:
- GitHub (suporte nativo)
- Mermaid Live Editor (https://mermaid.live)
- VS Code com extensão Mermaid
- Documentação markdown com suporte Mermaid
