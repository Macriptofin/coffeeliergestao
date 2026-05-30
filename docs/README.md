# Documentação Técnica — Coffeelier ERP

**Última atualização:** Maio 2026

---

## Documentos

| Documento | Conteúdo |
|---|---|
| [ARQUITETURA.md](./ARQUITETURA.md) | Princípios do sistema, fluxo operacional, stack tecnológica, modelo de dados, sistema de BOM, custo médio móvel |
| [MODULOS.md](./MODULOS.md) | Cada módulo detalhado: telas, rotas, tabelas, fluxos operacionais |
| [BANCO_DE_DADOS.md](./BANCO_DE_DADOS.md) | Todas as 103 tabelas, campos, relacionamentos, funções e triggers |
| [DESENVOLVIMENTO.md](./DESENVOLVIMENTO.md) | Setup local, padrões de código, roteamento, migrations, hooks disponíveis |
| [SEGURANCA.md](./SEGURANCA.md) | RLS, autenticação, perfis e permissões, auditoria, LGPD |

---

## Referência Rápida

**Rodar localmente:**
```bash
bun install && bun run dev
```

**Stack:** React 18 + TypeScript + Vite + Supabase (PostgreSQL) + shadcn/ui + Tailwind

**Banco:** Supabase `njxxqdcwvehlvqufuyww` — região sa-east-1

**Produção:** https://coffeelier.com.br

**Fluxo principal:**
```
Materiais → Fichas Técnicas → Propostas → Eventos → Produção → Financeiro
```

---

## Arquivos de Diagnóstico

A pasta `/diagnostics/` contém exports do banco para análise:
- Schema SQL
- Índices e constraints
- Views e functions
- Políticas RLS

## Scripts de Manutenção

A pasta `/scripts/` contém scripts SQL para:
- Correções de custos
- Migrations manuais
- Utilitários de banco

---

*Documentação gerada em Maio 2026 com base em análise completa do repositório e banco de dados.*
