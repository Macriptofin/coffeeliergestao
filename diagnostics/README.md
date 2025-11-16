# 🔍 Diagnósticos do Sistema

Esta pasta contém arquivos de diagnóstico e análise do banco de dados.

## 📊 Schema e Estrutura

- **01_schema_objects.sql** - Export completo do schema (DDL de todas as tabelas)
- **02_indexes_constraints.csv** - Lista de índices e constraints
- **03_views_and_funcs.sql** - Views e functions do banco
- **04_rls_policies.csv** - Políticas de Row Level Security
- **05_extensions.txt** - Extensões PostgreSQL ativas

## 📈 Contagens e Taxonomias

- **10_counts.csv** - Contagem de registros por tabela
- **15_taxonomies.csv** - Estrutura de taxonomias do sistema

## ⚠️ Health Checks

- **20_bom_cycles.csv** - Detecção de ciclos em BOMs
- **21_bom_missing_cost.csv** - BOMs sem custo calculado
- **22_units_inconsistencies.csv** - Inconsistências de unidades
- **23_materials_mismatch.csv** - Incompatibilidades em materiais
- **24_stock_orphans.csv** - Itens órfãos no estoque
- **25_indexes_missing.csv** - Índices faltantes sugeridos

## 🎛️ Configurações

- **31_feature_flags.json** - Feature flags do sistema

---

**Nota:** Estes arquivos são gerados periodicamente para análise e troubleshooting. Não devem ser editados manualmente.
