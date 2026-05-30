# Segurança — Coffeelier ERP

**Última atualização:** Maio 2026

---

## 1. Modelo de Segurança

O sistema usa três camadas de segurança complementares:

```
┌─────────────────────────────────────────┐
│  1. Supabase Auth (Autenticação)        │
│     Email + senha + MFA opcional        │
├─────────────────────────────────────────┤
│  2. Row Level Security (Autorização)    │
│     PostgreSQL RLS em 100% das tabelas  │
├─────────────────────────────────────────┤
│  3. Permissões Granulares (Aplicação)   │
│     user_roles + user_permissions       │
└─────────────────────────────────────────┘
```

---

## 2. Autenticação

### Fluxo de Login
1. Usuário acessa `/auth`
2. Submete email + senha para Supabase Auth
3. Supabase valida credenciais
4. Se MFA habilitado: solicita código TOTP
5. JWT emitido com `user_id`, `role` e `email`
6. Frontend armazena o JWT em memória (não em localStorage)
7. Todas as requisições incluem o JWT no header

### MFA (Autenticação Multifator)
- Implementado via TOTP (Time-based One-Time Password)
- Configurações armazenadas em `mfa_settings`
- Campos: `totp_secret`, `backup_codes` (array), `recovery_email`
- Hook: `useMFASettings`

### Proteção contra Força Bruta
- `auth_attempts` registra todas as tentativas (sucesso e falha)
- `account_lockouts` bloqueia a conta após N tentativas falhas
- Campos: `locked_at`, `locked_until`, `failed_attempts`, `lock_reason`
- Desbloqueio: automático (tempo) ou manual por administrador

---

## 3. Row Level Security (RLS)

**RLS está ativo em 100% das tabelas.** Nenhuma tabela é publicamente acessível.

### Como funciona
Cada query ao Supabase passa pelo JWT do usuário. O PostgreSQL avalia as políticas RLS antes de retornar qualquer dado:

```sql
-- Exemplo de política RLS típica
CREATE POLICY "users_see_own_data" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admins_see_all" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

### Implicações para desenvolvimento
- Queries no frontend nunca precisam de filtro `WHERE user_id = ...` — o RLS cuida disso
- Se uma query retorna 0 resultados inesperadamente, verificar se a política RLS está correta
- Para testar RLS, usar o SQL Editor do Supabase com `SET role = authenticated; SET request.jwt.claims...`

---

## 4. Perfis e Permissões

### Papéis (user_roles)
| Role | Descrição |
|---|---|
| `admin` | Acesso total ao sistema, incluindo configurações e usuários |
| `gestor` | Acesso a todos os módulos operacionais, sem configurações |
| `comercial` | Vendas, Clientes, Propostas, Agenda |
| `compras` | Compras, Fornecedores, leitura de Materiais |
| `producao` | Produção, Fichas Técnicas, Ordens de Produção, leitura de Estoque |
| `estoque` | Materiais completo, Movimentações, Inventário |
| `financeiro` | Módulo Financeiro completo |
| `logistica` | Agenda, Eventos, leitura de Produção |

### Permissões Granulares (user_permissions)
Além do papel, cada usuário pode ter permissões específicas por módulo e ação:

```
module: 'financeiro' | 'rh' | 'estoque' | 'producao' | 'vendas' | 'compras' | 'config'
action: 'view' | 'create' | 'edit' | 'delete' | 'approve'
scope:  'all' | <id_específico>  (ex: id de um cliente ou departamento)
```

### Verificação no Frontend
```tsx
import { useUserRole } from '@/hooks/useUserRole';

function BotaoAprovar() {
  const { hasPermission, role } = useUserRole();
  
  // Verificar por papel
  if (role !== 'admin' && role !== 'gestor') return null;
  
  // Verificar por permissão granular
  if (!hasPermission('vendas', 'approve')) return null;
  
  return <Button>Aprovar Proposta</Button>;
}
```

---

## 5. Auditoria

### security_audit_log
Registra todas as ações sensíveis do sistema.

| Campo | Descrição |
|---|---|
| user_id | Usuário que executou a ação |
| target_user_id | Usuário afetado (quando aplicável) |
| action | Descrição da ação (ex: `user.role_changed`, `proposal.approved`) |
| old_role / new_role | Para mudanças de papel |
| resource_type / resource_id | Recurso afetado |
| details | JSONB com detalhes adicionais |
| risk_score | Score de risco (0-100) |
| anomaly_flags | Array de flags de anomalia detectadas |
| session_id | ID da sessão |
| device_fingerprint | Fingerprint do dispositivo |

### Ações que geram log de auditoria
- Login / logout
- Mudança de senha
- Mudança de papel de usuário
- Aprovação de proposta
- Ajuste de estoque
- Ajuste de custo de material
- Acesso a dados sensíveis de funcionários
- Exportação de dados

### pii_access_log
Log específico para acesso a dados pessoais (compliance LGPD).

| Campo | Descrição |
|---|---|
| accessed_table | Tabela acessada (ex: `employees`) |
| accessed_record_id | ID do registro acessado |
| accessed_fields | Array de campos visualizados |
| access_type | `view`, `export`, `edit` |
| justification | Justificativa (quando exigida) |

### pii_access_anomalies
Detecta padrões anômalos de acesso a dados pessoais:
- Acesso em volume incomum
- Acesso fora do horário normal
- Acesso a registros sem relação com o trabalho do usuário

---

## 6. Restrições de Acesso

### access_time_restrictions
Permite configurar horários em que operações específicas são permitidas.

```
operation_type: tipo de operação
allowed_start_hour: hora de início (0-23)
allowed_end_hour: hora de término (0-23)
allowed_days: array de dias da semana (0=domingo, 6=sábado)
```

---

## 7. Hooks de Segurança no Frontend

O sistema tem 13 hooks relacionados a segurança:

| Hook | Responsabilidade |
|---|---|
| `useSecureAuth` | Autenticação segura com validação de sessão |
| `useSessionSecurity` | Monitoramento de validade e expiração da sessão |
| `useSecurityMonitoring` | Monitoramento em tempo real de eventos de segurança |
| `useEnhancedSecurityMonitoring` | Monitoramento avançado com análise de anomalias |
| `useSecurityAlerts` | Leitura e gestão de alertas de segurança |
| `useSecurityNotifications` | Notificações de eventos de segurança para o usuário |
| `useSecurityScanner` | Varredura de vulnerabilidades conhecidas |
| `useSecurityValidation` | Validação de inputs e operações antes de executar |
| `useSecurityDashboard` | Dados para o painel de monitoramento de segurança |
| `usePasswordSecurity` | Políticas e validação de senha |
| `useRateLimiting` | Controle de frequência de operações |
| `useSecureClientData` | Acesso seguro a dados de clientes (com log de auditoria) |
| `useSecureEmployeeData` | Acesso seguro a dados de funcionários (com log PII) |

> ⚠️ Esses hooks têm sobreposição funcional. Na Fase 5 serão consolidados.

---

## 8. Boas Práticas para Novos Módulos

### Ao criar nova tabela
```sql
-- 1. Sempre habilitar RLS
ALTER TABLE nova_tabela ENABLE ROW LEVEL SECURITY;

-- 2. Criar pelo menos uma política
CREATE POLICY "authenticated_access" ON nova_tabela
  FOR ALL USING (auth.role() = 'authenticated');

-- 3. Refinar conforme necessário
CREATE POLICY "only_owner" ON nova_tabela
  FOR ALL USING (created_by = auth.uid());
```

### Ao criar novo endpoint ou operação sensível
1. Registrar em `security_audit_log`
2. Verificar permissão do usuário antes de executar
3. Validar o input antes de persistir
4. Nunca expor dados de outros usuários sem verificar a policy

### Dados pessoais (LGPD)
- CPF, RG, endereço, salário, dados bancários são PII
- Acesso a PII deve ser registrado via `pii_access_log`
- Usar `useSecureEmployeeData` para acessar dados de funcionários
- Não retornar campos PII em queries onde não são necessários

---

## 9. Incidentes e Resposta

### Como responder a um alerta de segurança
1. Verificar em `security_alerts` o tipo e severidade
2. Verificar em `security_audit_log` as ações recentes do usuário envolvido
3. Se necessário, bloquear via `account_lockouts`
4. Investigar e registrar em `pii_access_anomalies.is_investigated`
5. Documentar resolução

### Revogação de acesso de emergência
```sql
-- Bloquear usuário imediatamente
INSERT INTO account_lockouts (user_email, locked_at, lock_reason)
VALUES ('email@exemplo.com', now(), 'Bloqueio administrativo de emergência');

-- Ou via Supabase Dashboard: Authentication → Users → Disable user
```
