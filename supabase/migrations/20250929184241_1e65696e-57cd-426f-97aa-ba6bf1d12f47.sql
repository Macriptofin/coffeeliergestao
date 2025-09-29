-- ============================================================================
-- CORREÇÃO: ADICIONAR SEARCH_PATH ÀS FUNÇÕES DE TRIGGER
-- ============================================================================

-- Função de trigger para updated_at em bom_production_orders
create or replace function public.update_bom_production_orders_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.update_bom_production_orders_updated_at is 
  'Trigger function para atualizar updated_at automaticamente';

-- Garantir que o trigger está configurado corretamente
drop trigger if exists update_bom_production_orders_updated_at 
  on public.bom_production_orders;
  
create trigger update_bom_production_orders_updated_at
  before update on public.bom_production_orders
  for each row
  execute function public.update_bom_production_orders_updated_at();

-- ============================================================================
-- VERIFICAÇÃO: Garantir que update_updated_at_column também tem search_path
-- ============================================================================

-- Esta função é usada por múltiplas tabelas, vamos garantir que está segura
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.update_updated_at_column is 
  'Trigger function genérica para atualizar updated_at (com search_path seguro)';

-- ============================================================================
-- FIM DAS CORREÇÕES
-- ============================================================================