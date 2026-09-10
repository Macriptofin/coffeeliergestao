-- Baixa de contas a receber direto na conciliação: 1 crédito do extrato ↔ N NFs (10/09/2026).
-- Casos: antecipação Monkey (a financeira paga em lote o Σ LÍQUIDO de N NFs, na data da operação) e Pix de cliente que paga várias NFs.
-- Gera um recibo por NF pelo saldo em aberto, rateia a diferença proporcionalmente (deságio/desconto se o crédito é menor,
-- juros/multa se é maior), vincula todos os caixas à linha (bank_statement_line_links) e o desfazer apaga os recibos —
-- o trigger update_receivable_remaining_amount devolve o saldo das contas. Nunca cria AR nova nem AP de deságio:
-- o deságio fica no recibo (adjustment_type) e o DRE o lê como despesa financeira.

alter table public.bank_statement_lines drop constraint if exists bank_statement_lines_kind_check;
alter table public.bank_statement_lines add constraint bank_statement_lines_kind_check
  check (kind in ('despesa','receita','transferencia','retirada_socio','aporte_socio','emprestimo_recebido','emprestimo_pago',
                  'repasse','ignorar','existente','baixa_receber'));

create or replace function public.reconcile_settle_receivables(
  p_line_id uuid, p_ar_ids uuid[], p_adjustment_type text default null, p_receipt_method text default 'PIX', p_notes text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l record; ar record;
  v_ids uuid[]; v_n int; v_gross numeric; v_net numeric; v_diff numeric; v_adj text;
  v_i int := 0; v_alloc numeric := 0; v_share numeric; v_disc numeric; v_int numeric; v_amount numeric;
  v_rc uuid; v_cash uuid; v_cash_ids uuid[] := '{}'; v_sum numeric; v_client uuid;
begin
  if not public.has_financial_access(auth.uid()) then raise exception 'Acesso restrito ao financeiro'; end if;
  select * into l from bank_statement_lines where id = p_line_id;
  if not found then raise exception 'Linha % não encontrada', p_line_id; end if;
  if l.status <> 'pendente' then raise exception 'Linha já conciliada/ignorada'; end if;
  if l.amount <= 0 then raise exception 'Só um crédito (entrada) pode baixar contas a receber'; end if;

  select array_agg(distinct x) into v_ids from unnest(p_ar_ids) x;
  if v_ids is null or array_length(v_ids, 1) is null then raise exception 'Selecione ao menos uma conta a receber'; end if;

  select count(*), coalesce(sum(remaining_amount), 0) into v_n, v_gross
  from accounts_receivable where id = any(v_ids) and status in ('Pendente', 'Vencido') and remaining_amount > 0;
  if v_n <> array_length(v_ids, 1) then raise exception 'Há conta a receber inexistente, cancelada ou já recebida na seleção'; end if;

  v_net  := l.amount;
  v_diff := round(v_gross - v_net, 2);  -- > 0: deságio/desconto concedido; < 0: juros/multa recebidos a mais
  if v_diff > v_gross * 0.25 then
    raise exception 'Crédito (%) muito menor que a soma das contas (%) — confira as NFs selecionadas; baixa parcial de uma NF é feita em Contas a Receber', v_net, v_gross;
  end if;
  if -v_diff > v_gross * 0.25 then
    raise exception 'Crédito (%) muito maior que a soma das contas (%) — falta selecionar NF', v_net, v_gross;
  end if;
  if abs(v_diff) <= 0.005 then v_diff := 0; end if;
  v_adj := case when v_diff = 0 then null
                when v_diff > 0 then coalesce(p_adjustment_type, 'Desconto de Antecipação')
                else coalesce(p_adjustment_type, 'Juros por Atraso') end;
  if v_adj is not null and v_adj not in ('Desconto de Antecipação','Multa por Atraso','Juros por Atraso','Desconto Comercial','Taxa Bancária','Outros') then
    raise exception 'Classificação da diferença inválida: %', v_adj;
  end if;

  -- Um recibo por conta, pelo saldo em aberto; diferença rateada pelo saldo (o último absorve o arredondamento)
  for ar in select id, remaining_amount from accounts_receivable where id = any(v_ids) order by due_date, created_at, id loop
    v_i := v_i + 1;
    if v_i < v_n then
      v_share := round(v_diff * ar.remaining_amount / v_gross, 2); v_alloc := v_alloc + v_share;
    else
      v_share := v_diff - v_alloc;
    end if;
    v_disc   := greatest(v_share, 0);
    v_int    := greatest(-v_share, 0);
    v_amount := round(ar.remaining_amount - v_disc + v_int, 2);

    insert into receipt_transactions (account_receivable_id, receipt_date, amount, gross_amount, discount_amount, interest_amount,
                                      adjustment_type, bank_account_id, receipt_method, notes)
    values (ar.id, l.posted_date, v_amount, ar.remaining_amount, v_disc, v_int,
            case when v_disc > 0 or v_int > 0 then v_adj end, l.bank_account_id, coalesce(p_receipt_method, 'PIX'),
            'Conciliação bancária — ' || coalesce(l.counterparty, l.description, ''))
    returning id into v_rc;

    select id into v_cash from cash_transactions where reference_type = 'Manual' and reference_id = v_rc order by created_at desc limit 1;
    if v_cash is null then raise exception 'Caixa do recebimento não foi gerado (trigger insert_cash_on_receipt)'; end if;
    update cash_transactions set statement_line_id = l.id where id = v_cash;
    v_cash_ids := v_cash_ids || v_cash;
  end loop;

  select coalesce(sum(amount), 0) into v_sum from cash_transactions where id = any(v_cash_ids);
  if abs(v_sum - v_net) > 0.02 then raise exception 'Soma dos recebimentos (%) difere do crédito (%)', v_sum, v_net; end if;

  insert into bank_statement_line_links (line_id, cash_transaction_id) select l.id, unnest(v_cash_ids) on conflict do nothing;
  select case when count(distinct client_id) = 1 then (array_agg(client_id))[1] end into v_client
  from accounts_receivable where id = any(v_ids);

  update bank_statement_lines
  set status = 'conciliada', kind = 'baixa_receber', cash_transaction_id = v_cash_ids[1], client_id = v_client,
      account_id = null, notes = coalesce(p_notes, notes), updated_at = now()
  where id = l.id;

  return jsonb_build_object('success', true, 'receipts', v_n, 'gross', v_gross, 'net', v_net, 'adjustment', v_diff, 'adjustment_type', v_adj);
end $$;
revoke execute on function public.reconcile_settle_receivables(uuid, uuid[], text, text, text) from public;
grant execute on function public.reconcile_settle_receivables(uuid, uuid[], text, text, text) to authenticated;

-- Undo ciente da baixa de contas a receber (apaga caixa + recibos gerados; o trigger devolve o saldo)
create or replace function public.reconcile_undo(p_line_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l record; v_rcs uuid[];
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
  elsif l.kind = 'baixa_receber' then
    select array_agg(ct.reference_id) into v_rcs
    from cash_transactions ct join bank_statement_line_links k on k.cash_transaction_id = ct.id
    where k.line_id = l.id and ct.reference_type = 'Manual';
    delete from cash_transactions where id in (select cash_transaction_id from bank_statement_line_links where line_id = l.id);
    delete from cash_transactions where statement_line_id = l.id;
    delete from receipt_transactions where id = any(coalesce(v_rcs, '{}'));
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
