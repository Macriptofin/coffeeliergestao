# Coffeelier ERP — Sistema de Gestão

Sistema ERP completo para gestão de empresas de catering, coffee breaks, eventos corporativos, kits gastronômicos e revenda de produtos.

**URL de produção:** https://coffeelier.com.br  
**Stack:** React + TypeScript + Vite + Supabase + shadcn/ui + Tailwind CSS  
**Banco de dados:** PostgreSQL (Supabase) — região `sa-east-1`  
**Projeto Supabase:** `njxxqdcwvehlvqufuyww`

---

## Visão Geral

O núcleo operacional do Coffeelier é o fluxo:

```
Materiais → Fichas Técnicas → Propostas → Eventos → Produção → Financeiro
```

Todo módulo existe para alimentar esse processo. O sistema não é orientado a estoque nem a financeiro — é orientado a **eventos de catering**.

---

## Documentação Técnica

| Documento | Descrição |
|---|---|
| [docs/ARQUITETURA.md](./docs/ARQUITETURA.md) | Fluxo do sistema, decisões técnicas, estrutura de módulos |
| [docs/BANCO_DE_DADOS.md](./docs/BANCO_DE_DADOS.md) | Todas as tabelas, campos, relacionamentos e observações |
| [docs/MODULOS.md](./docs/MODULOS.md) | Cada módulo explicado: telas, tabelas, fluxo operacional |
| [docs/DESENVOLVIMENTO.md](./docs/DESENVOLVIMENTO.md) | Setup local, variáveis de ambiente, padrões de código |
| [docs/SEGURANCA.md](./docs/SEGURANCA.md) | RLS, perfis de acesso, hooks de segurança |

---

## Setup Rápido

### Pré-requisitos
- Node.js 18+ ou Bun 1.0+
- Conta Supabase com acesso ao projeto `njxxqdcwvehlvqufuyww`

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/Macriptofin/coffeeliergestao.git
cd coffeeliergestao

# Instalar dependências (usar bun, não npm)
bun install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com as chaves do Supabase

# Rodar em desenvolvimento
bun run dev
```

### Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://njxxqdcwvehlvqufuyww.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
```

> As chaves estão disponíveis em: Supabase Dashboard → Project Settings → API

---

## Estrutura de Pastas

```
coffeeliergestao/
├── src/
│   ├── pages/              # Páginas da aplicação (roteadas via App.tsx)
│   │   ├── financeiro/     # Sub-páginas do módulo financeiro
│   │   ├── production/     # Sub-páginas de produção
│   │   ├── rh/             # Sub-páginas de RH
│   │   └── stock/          # Sub-páginas de estoque
│   ├── components/         # Componentes reutilizáveis
│   │   └── ui/             # Componentes shadcn/ui
│   ├── hooks/              # React hooks customizados (29 hooks)
│   ├── integrations/       # Clientes Supabase e tipos gerados
│   └── lib/                # Utilitários
├── supabase/
│   └── migrations/         # Histórico de migrations SQL (200+)
├── docs/                   # Documentação técnica
├── diagnostics/            # Arquivos de diagnóstico do banco
└── scripts/                # Scripts SQL de manutenção
```

---

## Gerenciador de Pacotes

Este projeto usa **Bun** como gerenciador de pacotes. Não commitar `package-lock.json` (npm) — usar apenas `bun.lockb`.

```bash
bun install          # instalar dependências
bun run dev          # servidor de desenvolvimento
bun run build        # build de produção
bun run type-check   # verificar TypeScript
```

---

## Branch Strategy

| Branch | Propósito |
|---|---|
| `main` | Produção — deploy automático via Lovable |
| `feature/fase*` | Branches de desenvolvimento por fase |

Nunca fazer commit direto em `main`. Sempre abrir PR e revisar antes do merge.

---

## Contato

**Responsável:** Maciel  
**Email:** macriptofin@gmail.com  
**Última atualização da documentação:** Maio 2026
