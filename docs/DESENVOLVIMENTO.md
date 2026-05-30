# Guia de Desenvolvimento — Coffeelier ERP

**Última atualização:** Maio 2026

---

## 1. Setup do Ambiente

### Pré-requisitos
- **Bun** 1.0+ (gerenciador de pacotes — não usar npm)
- **Node.js** 18+ (compatibilidade com Vite)
- **Git** 2.x
- Acesso ao projeto Supabase `njxxqdcwvehlvqufuyww`

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/Macriptofin/coffeeliergestao.git
cd coffeeliergestao

# Instalar dependências (bun, não npm install)
bun install

# Criar arquivo de variáveis de ambiente
cp .env.example .env.local
```

### Variáveis de Ambiente

Editar `.env.local` com:

```env
VITE_SUPABASE_URL=https://njxxqdcwvehlvqufuyww.supabase.co
VITE_SUPABASE_ANON_KEY=<chave_anonima_do_supabase>
```

> Chaves disponíveis em: Supabase Dashboard → Project Settings → API

### Rodando o projeto

```bash
bun run dev          # http://localhost:8080
bun run build        # build de produção em /dist
bun run preview      # preview do build de produção
```

---

## 2. Estrutura do Projeto

```
src/
├── App.tsx                    # Roteamento principal (React Router v6)
├── main.tsx                   # Entry point
│
├── pages/                     # Páginas da aplicação
│   ├── Dashboard.tsx
│   ├── Materiais.tsx          # Hub de materiais
│   ├── Materials.tsx          # ⚠️ LEGADO — a remover
│   ├── Estoque.tsx            # ⚠️ LEGADO — sem rota ativa
│   ├── ProducaoMain.tsx       # Hub de produção
│   ├── Production.tsx         # ⚠️ LEGADO — a remover
│   ├── IndexLegacy.tsx        # ⚠️ LEGADO — a remover
│   ├── IngredientsLegacy.tsx  # ⚠️ LEGADO — a remover
│   ├── financeiro/            # Sub-páginas financeiras
│   ├── production/            # Sub-páginas de produção
│   ├── rh/                    # Sub-páginas de RH
│   └── stock/                 # Sub-páginas de estoque
│
├── components/                # Componentes reutilizáveis
│   ├── ui/                    # Componentes shadcn/ui (não editar diretamente)
│   ├── Layout.tsx             # Layout principal com sidebar
│   ├── FichasTecnicas.tsx     # Componente de fichas técnicas
│   ├── MaterialsTable.tsx     # ⚠️ LEGADO — consolidar com SafeMaterialsTable
│   ├── SafeMaterialsTable.tsx # Versão atual (usar esta)
│   ├── SimplifiedMaterialsTable.tsx # ⚠️ LEGADO — a remover
│   └── FeatureFlagRedirect.tsx
│
├── hooks/                     # React hooks customizados
│   ├── useUserRole.tsx        # Perfil e permissões do usuário logado
│   ├── useFeatureFlags.tsx    # Acesso às feature flags
│   ├── useMaterialBOM.tsx     # Operações de BOM
│   ├── useStockEntryWithConversion.tsx # Entrada no estoque com conversão de unidade
│   ├── useSecurityMonitoring.tsx       # Monitoramento de segurança
│   └── ...                   # Ver lista completa abaixo
│
├── integrations/
│   └── supabase/
│       ├── client.ts          # Cliente Supabase configurado
│       └── types.ts           # Tipos TypeScript gerados do schema
│
└── lib/
    └── utils.ts               # Utilitários (cn, formatters, etc.)
```

---

## 3. Padrões de Código

### Componentes React
```tsx
// Usar function declarations, não arrow functions para componentes de página
export default function NomeDaPagina() {
  return <div>...</div>;
}

// Para componentes menores, arrow functions são ok
const MeuComponente = ({ prop }: { prop: string }) => {
  return <span>{prop}</span>;
};
```

### Queries ao Supabase
```tsx
// Sempre usar TanStack Query para queries
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Query
const { data, isLoading } = useQuery({
  queryKey: ['materials', filtros],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('is_archived', false);
    if (error) throw error;
    return data;
  },
});

// Mutation
const mutation = useMutation({
  mutationFn: async (material: NovoMaterial) => {
    const { data, error } = await supabase
      .from('materials')
      .insert(material)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['materials'] });
  },
});
```

### Imports
```tsx
// Usar aliases — não imports relativos com ../../
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
```

### Tipagem
```tsx
// Usar os tipos gerados pelo Supabase quando possível
import type { Tables } from '@/integrations/supabase/types';
type Material = Tables<'materials'>;

// Para tipos customizados, definir no próprio arquivo ou em types/
```

### Nomenclatura
- Componentes: `PascalCase`
- Hooks: `camelCase` prefixado com `use` (`useMaterials`, `useUserRole`)
- Variáveis e funções: `camelCase`
- Constantes: `SCREAMING_SNAKE_CASE`
- Arquivos de componentes: `PascalCase.tsx`
- Arquivos de hooks: `camelCase.tsx`
- Arquivos de utilitários: `camelCase.ts`

---

## 4. Roteamento

Todas as rotas estão definidas em `src/App.tsx`. O sistema usa React Router v6.

### Estrutura de rotas
```
/auth                          → tela de login
/                              → layout principal (com sidebar)
  /                            → Dashboard
  /materiais                   → Hub de Materiais
  /ingredientes                → Cadastro de Materiais
  /materiais/controle          → Controle de Estoque
  /materiais/gestao            → Gestão de Estoque (parâmetros)
  /materiais/movimentacoes     → Histórico de Movimentações
  /materiais/relatorios        → Relatórios de Estoque
  /materiais/inventario-ajustes → Inventário e Ajustes
  /materiais/:id/editar        → Editar Material
  /compras                     → Gestão de Compras
  /vendas                      → Gestão de Vendas
  /agenda                      → Agenda de Eventos
  /producao                    → Hub de Produção
  /producao/fichas-tecnicas    → Fichas Técnicas (BOM)
  /producao/planejamento       → Ordens de Produção
  /producao/calculo-custos     → Cálculo de Custos
  /producao/relatorios         → Relatórios de Produção
  /producao/bom                → BOM Management
  /producao/eventos            → Mesas/Eventos
  /fornecedores                → Fornecedores
  /financeiro                  → Hub Financeiro
  /financeiro/pagar            → Contas a Pagar
  /financeiro/receber          → Contas a Receber
  /financeiro/fluxo            → Fluxo de Caixa
  /financeiro/custos           → Centros de Custo
  /financeiro/analises         → Análise Financeira
  /financeiro/relatorios       → Relatórios Contábeis
  /financeiro/bancos           → Contas Bancárias
  /financeiro/recorrentes      → Transações Recorrentes
  /financeiro/aging            → Aging de Contas
  /financeiro/previsao         → Previsão de Caixa
  /rh                          → Hub de RH
  /rh/colaboradores            → Colaboradores
  /rh/ponto                    → Controle de Ponto
  /usuarios                    → Usuários do Sistema
  /seguranca                   → Monitoramento de Segurança
  /seguranca/avancado          → Segurança Avançada
  /seguranca/anomalias         → Anomalias de Segurança
  /config                      → Configurações
  /relatorios                  → Relatórios Gerais
```

### Rotas de compatibilidade (backward compat)
As rotas `/estoque/*` redirecionam para `/materiais/*` para manter bookmarks antigos.

---

## 5. Supabase — Migrations

### Localização
```
supabase/migrations/
  20230101000000_initial_schema.sql
  20230102000000_add_materials.sql
  ... (200+ migrations)
```

### Criar nova migration

```bash
# Nomear com timestamp + descrição descritiva
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_descricao_da_mudanca.sql
```

### Aplicar migration em produção
Pelo Supabase MCP ou pelo painel do Supabase (SQL Editor).

### Convenções de migration
```sql
-- Sempre incluir comentário descritivo no topo
-- Migration: Adiciona campos de estoque inteligente a stock_items
-- Data: YYYY-MM-DD
-- Autor: nome

-- Usar IF NOT EXISTS para segurança
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS reserved_qty numeric DEFAULT 0;

-- Incluir rollback comentado quando possível
-- ROLLBACK: ALTER TABLE stock_items DROP COLUMN IF EXISTS reserved_qty;
```

---

## 6. Hooks Disponíveis

| Hook | Arquivo | Uso |
|---|---|---|
| `useUserRole` | hooks/useUserRole.tsx | Papel e permissões do usuário logado |
| `useFeatureFlags` | hooks/useFeatureFlags.tsx | Acesso a feature flags |
| `useMaterialBOM` | hooks/useMaterialBOM.tsx | Operações de BOM (criação, atualização) |
| `useMaterialsDiagnostics` | hooks/useMaterialsDiagnostics.tsx | Diagnóstico de materiais com problemas |
| `useStockEntryWithConversion` | hooks/useStockEntryWithConversion.tsx | Entrada no estoque com conversão de unidade |
| `useProductionValidation` | hooks/useProductionValidation.tsx | Validar estoque antes de iniciar produção |
| `useTimeClock` | hooks/useTimeClock.tsx | Controle de ponto (registro de horas) |
| `useFinancialPermissions` | hooks/useFinancialPermissions.tsx | Permissões do módulo financeiro |
| `useHRPermissions` | hooks/useHRPermissions.tsx | Permissões do módulo RH |
| `useClientAssignments` | hooks/useClientAssignments.tsx | Carteira de clientes do usuário |
| `useConfig` | hooks/useConfig.tsx | Ler/escrever configurações do sistema |
| `useInvoiceOCR` | hooks/useInvoiceOCR.tsx | Processar NF via OCR |
| `useMFASettings` | hooks/useMFASettings.tsx | Configurações de MFA do usuário |
| `usePricingAnalysis` | hooks/usePricingAnalysis.tsx | Análise de precificação |
| `useSecurityMonitoring` | hooks/useSecurityMonitoring.tsx | Monitoramento de segurança |
| `useSecurityAlerts` | hooks/useSecurityAlerts.tsx | Alertas de segurança |
| `useSessionSecurity` | hooks/useSessionSecurity.tsx | Segurança de sessão |

---

## 7. Feature Flags

Feature flags controlam funcionalidades em tempo real sem necessidade de deploy.

```tsx
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

function MeuComponente() {
  const { flags } = useFeatureFlags();
  
  if (!flags.nova_funcionalidade) return null;
  
  return <div>Nova funcionalidade ativa!</div>;
}
```

Flags são gerenciadas na tabela `app_flags` no Supabase.

---

## 8. Deploy

O sistema usa **Lovable** para deploy automático.

- Todo push na branch `main` dispara um deploy automático
- Não há CI/CD configurado além do Lovable
- Variáveis de ambiente são configuradas no painel do Lovable

**URL de produção:** https://coffeelier.com.br

---

## 9. Problemas Conhecidos e Débitos Técnicos

| Item | Descrição | Fase de Correção |
|---|---|---|
| Páginas legado | `Materials.tsx`, `Production.tsx`, `IndexLegacy.tsx`, `IngredientsLegacy.tsx`, `Estoque.tsx` | Fase 1 |
| Tabelas legado | `recipes`, `products`, `recipe_ingredients`, `proposal_items` (0 registros) | Fase 1 |
| 3 lockfiles | `bun.lock` + `bun.lockb` + `package-lock.json` | Fase 1 |
| MaterialsTable duplicado | 3 versões do componente | Fase 1 |
| FK duplicada | `employee_salary_info` tem 2 FKs para `employees.id` | Fase 1 |
| Estoque sem estados múltiplos | `stock_items` só tem `current_quantity`, sem `reserved_qty` | Fase 2 |
| Motor de conversão ausente | Conversões espalhadas, sem tabela centralizada | Fase 2 |
| Dashboard sem dados operacionais | Mostra apenas contagens, não KPIs do negócio | Fase 3 |
| Permissões fragmentadas | 4 tabelas de permissão (user_roles + 3 outras) | Fase 5 |

---

## 10. Boas Práticas de Segurança

- Nunca commitar credenciais ou chaves no repositório
- Nunca expor a `service_role` key no frontend (usar apenas `anon` key)
- Todas as queries passam por RLS — não há necessidade de filtros manuais de segurança na maioria dos casos
- Para operações administrativas, usar Supabase Edge Functions (server-side)
- Logs de ações sensíveis vão para `security_audit_log` — não remover essa integração
