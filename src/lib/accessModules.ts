// Módulos e ações do sistema de controle de acesso (Perfis de Acesso).
// Fonte única — usado tanto na edição de um Perfil (Configurações > Perfis de
// Acesso) quanto nas exceções pontuais por usuário (UserEditor.tsx), pra manter
// as duas telas sempre com a mesma lista.
export const ACCESS_MODULES = [
  { key: 'materiais', label: 'Materiais' },
  { key: 'compras', label: 'Compras' },
  { key: 'vendas', label: 'Vendas' },
  { key: 'producao', label: 'Produção' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'fornecedores', label: 'Fornecedores' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'rh', label: 'RH' },
  { key: 'config', label: 'Configurações' },
] as const;

export const ACCESS_ACTIONS = [
  { key: 'view', label: 'Ver' },
  { key: 'create', label: 'Criar' },
  { key: 'edit', label: 'Editar' },
  { key: 'delete', label: 'Excluir' },
  { key: 'approve', label: 'Aprovar' },
] as const;

export type AccessModuleKey = typeof ACCESS_MODULES[number]['key'];
export type AccessActionKey = typeof ACCESS_ACTIONS[number]['key'];
