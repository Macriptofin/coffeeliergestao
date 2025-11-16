# 🛠️ Scripts de Manutenção

Esta pasta contém scripts SQL para manutenção, correções e utilitários.

## 📝 Scripts Disponíveis

### Correções
- **CORRECAO_CUSTOS_MOVIMENTACOES.sql** - Script para correção de custos em movimentações de estoque
  - Recalcula custos médios ponderados
  - Corrige inconsistências históricas
  - **Status:** Executado (arquivo mantido para referência)

## ⚠️ Avisos Importantes

1. **Backup Obrigatório**: Sempre faça backup do banco antes de executar scripts de correção
2. **Teste em Staging**: Execute primeiro em ambiente de teste
3. **Documentação**: Mantenha registro de execuções e resultados
4. **Validação**: Valide os dados após execução

## 🔄 Como Usar

```bash
# 1. Conectar ao banco (usando psql ou Supabase SQL Editor)
# 2. Fazer backup
# 3. Executar script
\i scripts/NOME_DO_SCRIPT.sql

# 4. Validar resultados
# 5. Documentar execução
```

---

**Atenção:** Scripts nesta pasta podem modificar dados. Use com cautela!
