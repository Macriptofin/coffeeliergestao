-- Vínculo 1 linha do extrato ↔ N lançamentos de caixa (lotes de antecipação, Pix que paga várias NFs, maquininha).
create table if not exists public.bank_statement_line_links (
  line_id uuid not null references public.bank_statement_lines(id) on delete cascade,
  cash_transaction_id uuid not null references public.cash_transactions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (line_id, cash_transaction_id)
);
create index if not exists idx_bsl_links_cash on public.bank_statement_line_links(cash_transaction_id);
alter table public.bank_statement_line_links enable row level security;
drop policy if exists bsl_links_fin on public.bank_statement_line_links;
create policy bsl_links_fin on public.bank_statement_line_links for all to authenticated
  using (public.has_financial_access(auth.uid())) with check (public.has_financial_access(auth.uid()));

-- Concilia uma linha pendente com um conjunto de lançamentos já existentes (soma tem que bater).
create or replace function public.reconcile_link_existing(p_line_id uuid, p_cash_ids uuid[], p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l record; v_sum numeric; v_n int; v_bad int;
begin
  if not public.has_financial_access(auth.uid()) then raise exception 'Acesso restrito ao financeiro'; end if;
  select * into l from bank_statement_lines where id = p_line_id;
  if not found then raise exception 'Linha % não encontrada', p_line_id; end if;
  if l.status <> 'pendente' then raise exception 'Linha já conciliada/ignorada'; end if;
  if p_cash_ids is null or array_length(p_cash_ids, 1) is null then raise exception 'Informe ao menos um lançamento'; end if;

  select count(*), coalesce(sum(case when transaction_type = 'Entrada' then amount else -amount end), 0)
    into v_n, v_sum
  from cash_transactions where id = any(p_cash_ids) and bank_account_id = l.bank_account_id;
  if v_n <> array_length(p_cash_ids, 1) then raise exception 'Lançamento inexistente ou de outra conta bancária'; end if;
  select count(*) into v_bad from cash_transactions where id = any(p_cash_ids) and statement_line_id is not null;
  if v_bad > 0 then raise exception '% lançamento(s) já vinculado(s) a outra linha do extrato', v_bad; end if;
  if abs(v_sum - l.amount) > 0.02 then
    raise exception 'Soma dos lançamentos (%) difere do valor da linha (%)', v_sum, l.amount;
  end if;

  update cash_transactions set statement_line_id = p_line_id where id = any(p_cash_ids);
  insert into bank_statement_line_links (line_id, cash_transaction_id)
    select p_line_id, unnest(p_cash_ids) on conflict do nothing;
  update bank_statement_lines
  set status = 'conciliada', kind = 'existente', cash_transaction_id = p_cash_ids[1],
      notes = coalesce(p_notes, notes), updated_at = now()
  where id = p_line_id;
  return jsonb_build_object('success', true, 'linked', v_n);
end $$;

-- Undo ciente dos vínculos N:1
create or replace function public.reconcile_undo(p_line_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l record;
begin
  if not public.has_financial_access(auth.uid()) then raise exception 'Acesso restrito ao financeiro'; end if;
  select * into l from bank_statement_lines where id = p_line_id;
  if not found then raise exception 'Linha % não encontrada', p_line_id; end if;

  update bank_statement_lines set cash_transaction_id = null where id = p_line_id;

  if l.kind = 'existente' then
    update cash_transactions set statement_line_id = null where statement_line_id = l.id;
    update cash_transactions set statement_line_id = null
      where id in (select cash_transaction_id from bank_statement_line_links where line_id = l.id);
    delete from bank_statement_line_links where line_id = l.id;
  elsif l.kind is not null and l.kind <> 'ignorar' then
    if l.created_ap_id is not null then
      delete from cash_transactions where reference_id in (select id from payment_transactions where account_payable_id = l.created_ap_id);
      delete from payment_transactions where account_payable_id = l.created_ap_id;
      update accounts_payable set status = 'Cancelado', notes = coalesce(notes,'') || ' [desfeito na conciliação]' where id = l.created_ap_id;
    end if;
    if l.created_ar_id is not null then
      delete from cash_transactions where reference_id in (select id from receipt_transactions where account_receivable_id = l.created_ar_id);
      delete from receipt_transactions where account_receivable_id = l.created_ar_id;
      update accounts_receivable set status = 'Cancelado', notes = coalesce(notes,'') || ' [desfeito na conciliação]' where id = l.created_ar_id;
    end if;
    delete from cash_transactions where statement_line_id = l.id and reference_type = 'Manual';
    update cash_transactions set statement_line_id = null where statement_line_id = l.id;
    delete from bank_statement_line_links where line_id = l.id;
  end if;

  update bank_statement_lines
  set status = 'pendente', kind = null, cash_transaction_id = null, created_ap_id = null, created_ar_id = null,
      account_id = null, cost_center_id = null, supplier_id = null, client_id = null, transfer_bank_account_id = null,
      updated_at = now()
  where id = p_line_id;
  return jsonb_build_object('success', true);
end $$;

revoke execute on function public.reconcile_link_existing(uuid, uuid[], text) from public;
grant execute on function public.reconcile_link_existing(uuid, uuid[], text) to authenticated;
