-- Conciliação Bancária (05/set/2026) — regularização de 2026 e rotina mensal.
--
-- O extrato (OFX/CSV) vira a fonte da verdade do caixa. Fluxo:
--   importar linhas (dedupe por fitid) → casar automático com cash_transactions
--   já existentes (mesma conta, valor, data ±N dias) → sugerir classificação por
--   regra (contraparte) → aplicar em lote: cada linha vira o registro certo
--   (despesa paga / receita recebida / transferência entre contas / movimento
--   de sócio / empréstimo / repasse / ignorar) → o caixa nasce pelos triggers
--   já existentes e fica ligado à linha (cash_transactions.statement_line_id).
-- Regras aprendem: classificou uma contraparte, as próximas vêm sugeridas.
-- Desfazer: só o que a própria conciliação criou (AP/AR → Cancelado; pagamento/
-- recebimento/caixa removidos; linha volta a pendente).

-- ── Plano de contas: contas que faltavam pros movimentos do extrato ───
DO $$
DECLARE
  v_pl uuid; v_ativo uuid; v_pc uuid; v_53 uuid; v_523 uuid; v_43 uuid;
  v_lvl_523 int; v_lvl_53 int; v_lvl_43 int;
  v_12 uuid;
BEGIN
  select id into v_pl from chart_of_accounts where code = '3';
  select id into v_ativo from chart_of_accounts where code = '1';
  select id into v_pc from chart_of_accounts where code = '2.1';
  select id, level into v_53, v_lvl_53 from chart_of_accounts where code = '5.3';
  select id, level into v_523, v_lvl_523 from chart_of_accounts where code = '5.2.3';
  select id, level into v_43, v_lvl_43 from chart_of_accounts where code = '4.3';

  insert into chart_of_accounts (code, name, account_type, parent_id, level, is_active, is_postable)
  select * from (values
    ('3.2', 'Retiradas do Sócio (distribuição / adiantamento)', 'Patrimônio Líquido', v_pl, 2, true, true),
    ('3.3', 'Aportes do Sócio', 'Patrimônio Líquido', v_pl, 2, true, true),
    ('2.1.1', 'Empréstimos de Terceiros (funcionários/família)', 'Passivo', v_pc, 3, true, true),
    ('2.1.2', 'Valores de Terceiros (repasses)', 'Passivo', v_pc, 3, true, true),
    ('5.3.4', '(-) Deságio de Antecipação de Recebíveis', 'Despesas', v_53, v_lvl_53 + 1, true, true),
    ('5.3.5', '(-) Taxas de Cartão (maquininha)', 'Despesas', v_53, v_lvl_53 + 1, true, true),
    ('5.2.3.3', 'Locação de Veículos', 'Despesas', v_523, v_lvl_523 + 1, true, true),
    ('4.3.3', '(+) Cashbacks e Reembolsos', 'Receitas', v_43, v_lvl_43 + 1, true, true)
  ) as v(code, name, account_type, parent_id, level, is_active, is_postable)
  where not exists (select 1 from chart_of_accounts c where c.code = v.code);

  -- Imobilizado (equipamentos não são despesa)
  insert into chart_of_accounts (code, name, account_type, parent_id, level, is_active, is_postable)
  select '1.2', 'ATIVO NÃO CIRCULANTE', 'Ativo', v_ativo, 2, true, false
  where not exists (select 1 from chart_of_accounts where code = '1.2');
  select id into v_12 from chart_of_accounts where code = '1.2';
  insert into chart_of_accounts (code, name, account_type, parent_id, level, is_active, is_postable)
  select '1.2.1', 'Máquinas e Equipamentos', 'Ativo', v_12, 3, true, true
  where not exists (select 1 from chart_of_accounts where code = '1.2.1');
END $$;

-- ── Contas bancárias: InfinityPay + saldo inicial real do Nubank ──────
insert into bank_accounts (name, bank_name, account_number, agency_number, account_type, initial_balance, is_active, is_default, notes)
select 'InfinityPay', 'CloudWalk / InfinityPay', '22073670-8', '0001', 'corrente', 3.60, true, false,
       'Maquininha + cartão PJ. Saldo inicial = saldo em 01/01/2026 pelo extrato OFX.'
where not exists (select 1 from bank_accounts where name = 'InfinityPay');

update bank_accounts
set bank_name = 'Nubank', account_number = '203211769-6', agency_number = '0001',
    initial_balance = 12.05,
    notes = coalesce(notes, '') || ' Saldo inicial = saldo em 01/01/2026 pelo extrato OFX (conciliação 05/09/2026).'
where name = 'Principal' and initial_balance = 0;

-- ── Vínculo caixa ↔ linha do extrato ──────────────────────────────────
create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id),
  source text not null check (source in ('ofx', 'csv')),
  file_name text,
  period_start date,
  period_end date,
  line_count int not null default 0,
  imported_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id),
  import_id uuid references public.bank_statement_imports(id),
  fitid text not null,
  posted_date date not null,
  amount numeric not null,                       -- assinado: >0 entrada, <0 saída
  counterparty text,                             -- quem pagou / quem recebeu
  description text,                              -- memo do banco
  raw_type text,
  status text not null default 'pendente' check (status in ('pendente', 'conciliada', 'ignorada')),
  -- casamento com caixa já existente OU criado pela conciliação
  cash_transaction_id uuid references public.cash_transactions(id) on delete set null,
  -- classificação aplicada
  kind text check (kind in ('despesa','receita','transferencia','retirada_socio','aporte_socio',
                            'emprestimo_recebido','emprestimo_pago','repasse','ignorar','existente')),
  account_id uuid references public.chart_of_accounts(id),
  cost_center_id uuid references public.cost_centers(id),
  supplier_id uuid references public.suppliers(id),
  client_id uuid references public.clients(id),
  transfer_bank_account_id uuid references public.bank_accounts(id),
  created_ap_id uuid references public.accounts_payable(id),
  created_ar_id uuid references public.accounts_receivable(id),
  -- sugestão por regra (não aplicada ainda)
  suggested_kind text,
  suggested_account_id uuid,
  suggested_cost_center_id uuid,
  suggested_supplier_id uuid,
  suggested_client_id uuid,
  suggested_transfer_bank_account_id uuid,
  suggested_rule_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bank_account_id, fitid)
);
create index if not exists idx_bsl_account_status on public.bank_statement_lines (bank_account_id, status, posted_date);

create table if not exists public.reconciliation_rules (
  id uuid primary key default gen_random_uuid(),
  pattern text not null,                         -- ILIKE %pattern% na contraparte/descrição
  direction text check (direction in ('Entrada', 'Saída')),  -- null = qualquer
  kind text not null check (kind in ('despesa','receita','transferencia','retirada_socio','aporte_socio',
                                     'emprestimo_recebido','emprestimo_pago','repasse','ignorar')),
  account_id uuid references public.chart_of_accounts(id),
  cost_center_id uuid references public.cost_centers(id),
  supplier_id uuid references public.suppliers(id),
  client_id uuid references public.clients(id),
  transfer_bank_account_id uuid references public.bank_accounts(id),
  document_type text,
  priority int not null default 100,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.cash_transactions add column if not exists statement_line_id uuid references public.bank_statement_lines(id);
create index if not exists idx_cash_statement_line on public.cash_transactions (statement_line_id);

-- RLS: financeiro interno
alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.reconciliation_rules enable row level security;
drop policy if exists bsi_fin on public.bank_statement_imports;
create policy bsi_fin on public.bank_statement_imports for all to authenticated using (public.has_financial_access(auth.uid())) with check (public.has_financial_access(auth.uid()));
drop policy if exists bsl_fin on public.bank_statement_lines;
create policy bsl_fin on public.bank_statement_lines for all to authenticated using (public.has_financial_access(auth.uid())) with check (public.has_financial_access(auth.uid()));
drop policy if exists rr_fin on public.reconciliation_rules;
create policy rr_fin on public.reconciliation_rules for all to authenticated using (public.has_financial_access(auth.uid())) with check (public.has_financial_access(auth.uid()));

-- ── Importar linhas (dedupe por fitid) ────────────────────────────────
create or replace function public.reconcile_import_lines(
  p_bank_account_id uuid, p_source text, p_file_name text,
  p_period_start date, p_period_end date, p_lines jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_import uuid; v_ins int := 0; v_skip int := 0; l jsonb;
begin
  if not public.has_financial_access(auth.uid()) then raise exception 'Acesso restrito ao financeiro'; end if;
  insert into bank_statement_imports (bank_account_id, source, file_name, period_start, period_end, imported_by)
  values (p_bank_account_id, p_source, p_file_name, p_period_start, p_period_end, auth.uid())
  returning id into v_import;

  for l in select * from jsonb_array_elements(p_lines) loop
    insert into bank_statement_lines (bank_account_id, import_id, fitid, posted_date, amount, counterparty, description, raw_type)
    values (p_bank_account_id, v_import, l->>'fitid', (l->>'posted_date')::date, (l->>'amount')::numeric,
            nullif(btrim(coalesce(l->>'counterparty','')), ''), nullif(btrim(coalesce(l->>'description','')), ''), l->>'raw_type')
    on conflict (bank_account_id, fitid) do nothing;
    if found then v_ins := v_ins + 1; else v_skip := v_skip + 1; end if;
  end loop;
  update bank_statement_imports set line_count = v_ins where id = v_import;
  return jsonb_build_object('import_id', v_import, 'inserted', v_ins, 'skipped', v_skip);
end $$;

-- ── Casamento automático com caixa já existente ───────────────────────
-- Linha pendente × cash_transactions da mesma conta ainda sem linha, mesmo
-- sentido, mesmo valor (±0,01), data mais próxima dentro de ±p_days.
create or replace function public.reconcile_auto_match(p_bank_account_id uuid, p_days int default 5)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record; v_cash uuid; v_n int := 0;
begin
  if not public.has_financial_access(auth.uid()) then raise exception 'Acesso restrito ao financeiro'; end if;
  for r in
    select * from bank_statement_lines
    where bank_account_id = p_bank_account_id and status = 'pendente'
    order by posted_date, id
  loop
    select ct.id into v_cash
    from cash_transactions ct
    where ct.bank_account_id = p_bank_account_id
      and ct.statement_line_id is null
      and ct.transaction_type = case when r.amount > 0 then 'Entrada' else 'Saída' end
      and abs(ct.amount - abs(r.amount)) < 0.011
      and abs(ct.transaction_date - r.posted_date) <= p_days
    order by abs(ct.transaction_date - r.posted_date), ct.created_at
    limit 1;
    if v_cash is not null then
      update cash_transactions set statement_line_id = r.id where id = v_cash;
      update bank_statement_lines
      set status = 'conciliada', kind = 'existente', cash_transaction_id = v_cash, updated_at = now()
      where id = r.id;
      v_n := v_n + 1;
    end if;
  end loop;
  return jsonb_build_object('matched', v_n);
end $$;

-- ── Sugestão por regra (contraparte/descrição ILIKE %pattern%) ────────
create or replace function public.reconcile_suggest(p_bank_account_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_n int := 0;
begin
  if not public.has_financial_access(auth.uid()) then raise exception 'Acesso restrito ao financeiro'; end if;
  with cand as (
    select l.id as line_id, rr.id as rule_id,
      row_number() over (partition by l.id order by rr.priority, length(rr.pattern) desc, rr.created_at) as rn
    from bank_statement_lines l
    join reconciliation_rules rr
      on rr.is_active
     and (rr.direction is null or rr.direction = case when l.amount > 0 then 'Entrada' else 'Saída' end)
     and (coalesce(l.counterparty, '') ilike '%' || rr.pattern || '%'
          or coalesce(l.description, '') ilike '%' || rr.pattern || '%')
    where l.bank_account_id = p_bank_account_id and l.status = 'pendente'
  )
  update bank_statement_lines l
  set suggested_kind = rr.kind, suggested_account_id = rr.account_id, suggested_cost_center_id = rr.cost_center_id,
      suggested_supplier_id = rr.supplier_id, suggested_client_id = rr.client_id,
      suggested_transfer_bank_account_id = rr.transfer_bank_account_id, suggested_rule_id = rr.id, updated_at = now()
  from cand c join reconciliation_rules rr on rr.id = c.rule_id
  where c.rn = 1 and l.id = c.line_id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('suggested', v_n);
end $$;

-- ── Aplicar classificação em lote ─────────────────────────────────────
-- p_payload: account_id, cost_center_id, supplier_id, client_id, transfer_bank_account_id,
--   description, document_type, invoice_number, competence_date, payment_method,
--   save_rule (bool), rule_pattern (text)
create or replace function public.reconcile_apply(p_line_ids uuid[], p_kind text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l record; v_amt numeric; v_dir text; v_desc text; v_acc uuid; v_cc uuid;
  v_ap uuid; v_ar uuid; v_pay uuid; v_rec uuid; v_cash uuid; v_other uuid;
  v_ok int := 0; v_err jsonb := '[]'::jsonb; v_method text;
  v_acc_code text;
begin
  if not public.has_financial_access(auth.uid()) then raise exception 'Acesso restrito ao financeiro'; end if;
  if p_kind not in ('despesa','receita','transferencia','retirada_socio','aporte_socio','emprestimo_recebido','emprestimo_pago','repasse','ignorar') then
    raise exception 'Classificação desconhecida: %', p_kind;
  end if;

  -- Conta contábil padrão por natureza quando não informada
  v_acc_code := case p_kind
    when 'retirada_socio' then '3.2' when 'aporte_socio' then '3.3'
    when 'emprestimo_recebido' then '2.1.1' when 'emprestimo_pago' then '2.1.1'
    when 'repasse' then '2.1.2' else null end;
  v_acc := coalesce((p_payload->>'account_id')::uuid, (select id from chart_of_accounts where code = v_acc_code));
  v_cc := (p_payload->>'cost_center_id')::uuid;
  -- receipt_transactions tem CHECK de método (Dinheiro/PIX/Cartão Débito/Cartão Crédito/Transferência/Boleto/Cheque)
  v_method := coalesce(p_payload->>'payment_method', 'PIX');
  if v_method not in ('Dinheiro','PIX','Cartão Débito','Cartão Crédito','Transferência','Boleto','Cheque') then v_method := 'PIX'; end if;

  for l in select * from bank_statement_lines where id = any(p_line_ids) and status = 'pendente' loop
    begin
      v_amt := abs(l.amount);
      v_dir := case when l.amount > 0 then 'Entrada' else 'Saída' end;
      v_desc := coalesce(nullif(btrim(coalesce(p_payload->>'description','')), ''), l.counterparty, l.description, 'Movimento bancário');
      v_ap := null; v_ar := null; v_cash := null;

      if p_kind = 'ignorar' then
        update bank_statement_lines set status = 'ignorada', kind = 'ignorar', updated_at = now() where id = l.id;

      elsif p_kind = 'despesa' then
        if v_dir <> 'Saída' then raise exception 'Linha de entrada não pode ser despesa'; end if;
        insert into accounts_payable (supplier_id, description, document_number, issue_date, due_date, competence_date,
          original_amount, discount_amount, interest_amount, paid_amount, remaining_amount, status, payment_date,
          account_id, cost_center_id, document_type, bank_account_id, source_type, source_id, notes)
        values ((p_payload->>'supplier_id')::uuid, v_desc, p_payload->>'invoice_number', l.posted_date, l.posted_date,
          coalesce((p_payload->>'competence_date')::date, l.posted_date),
          v_amt, 0, 0, v_amt, 0, 'Pago', l.posted_date,
          v_acc, v_cc, coalesce(p_payload->>'document_type', 'comprovante'), l.bank_account_id,
          'bank_reconciliation', l.id, 'Criado pela conciliação bancária — ' || coalesce(l.description, ''))
        returning id into v_ap;
        insert into payment_transactions (account_payable_id, payment_date, amount, payment_method, bank_account_id, notes)
        values (v_ap, l.posted_date, v_amt, v_method, l.bank_account_id, 'Conciliação bancária')
        returning id into v_pay;
        select id into v_cash from cash_transactions where reference_id = v_pay order by created_at desc limit 1;
        update cash_transactions set statement_line_id = l.id, account_id = coalesce(account_id, v_acc), cost_center_id = coalesce(cost_center_id, v_cc)
        where id = v_cash;

      elsif p_kind = 'receita' then
        if v_dir <> 'Entrada' then raise exception 'Linha de saída não pode ser receita'; end if;
        insert into accounts_receivable (client_id, invoice_number, description, issue_date, due_date, competence_date,
          original_amount, discount_amount, interest_amount, received_amount, remaining_amount, status,
          account_id, cost_center_id, bank_account_id, source_type, source_id, notes)
        values ((p_payload->>'client_id')::uuid, p_payload->>'invoice_number', v_desc,
          coalesce((p_payload->>'competence_date')::date, l.posted_date), l.posted_date,
          coalesce((p_payload->>'competence_date')::date, l.posted_date),
          v_amt, 0, 0, 0, v_amt, 'Pendente',
          coalesce(v_acc, (select id from chart_of_accounts where code = '4.1.1')), v_cc, l.bank_account_id,
          'bank_reconciliation', l.id, 'Criado pela conciliação bancária — ' || coalesce(l.description, ''))
        returning id into v_ar;
        insert into receipt_transactions (account_receivable_id, receipt_date, amount, receipt_method, bank_account_id, notes)
        values (v_ar, l.posted_date, v_amt, v_method, l.bank_account_id, 'Conciliação bancária')
        returning id into v_rec;
        select id into v_cash from cash_transactions where reference_id = v_rec order by created_at desc limit 1;
        update cash_transactions set statement_line_id = l.id, account_id = coalesce(account_id, v_acc) where id = v_cash;

      elsif p_kind = 'transferencia' then
        insert into cash_transactions (transaction_date, description, transaction_type, category, amount, payment_method,
          account_id, reference_type, bank_account_id, statement_line_id, notes)
        values (l.posted_date, 'Transferência entre contas — ' || v_desc, v_dir, 'Transferência entre contas', v_amt,
          'Transferência', null, 'Manual', l.bank_account_id, l.id, 'Conciliação bancária')
        returning id into v_cash;
        -- contraparte: linha pendente da outra conta com sinal oposto, mesmo valor, ±3 dias
        v_other := null;
        if (p_payload->>'transfer_bank_account_id') is not null then
          select o.id into v_other from bank_statement_lines o
          where o.bank_account_id = (p_payload->>'transfer_bank_account_id')::uuid and o.status = 'pendente'
            and sign(o.amount) = -sign(l.amount) and abs(abs(o.amount) - v_amt) < 0.011
            and abs(o.posted_date - l.posted_date) <= 3
          order by abs(o.posted_date - l.posted_date) limit 1;
          if v_other is not null then
            insert into cash_transactions (transaction_date, description, transaction_type, category, amount, payment_method,
              reference_type, bank_account_id, statement_line_id, notes)
            select o.posted_date, 'Transferência entre contas — ' || v_desc, case when o.amount > 0 then 'Entrada' else 'Saída' end,
              'Transferência entre contas', v_amt, 'Transferência', 'Manual', o.bank_account_id, o.id, 'Conciliação bancária (contraparte)'
            from bank_statement_lines o where o.id = v_other;
            update bank_statement_lines set status = 'conciliada', kind = 'transferencia',
              transfer_bank_account_id = l.bank_account_id,
              cash_transaction_id = (select id from cash_transactions where statement_line_id = v_other), updated_at = now()
            where id = v_other;
          end if;
        end if;

      else
        -- retirada_socio / aporte_socio / emprestimo_recebido / emprestimo_pago / repasse: só caixa, com conta patrimonial
        if p_kind in ('retirada_socio','emprestimo_pago') and v_dir <> 'Saída' then raise exception 'Natureza % exige saída', p_kind; end if;
        if p_kind in ('aporte_socio','emprestimo_recebido') and v_dir <> 'Entrada' then raise exception 'Natureza % exige entrada', p_kind; end if;
        insert into cash_transactions (transaction_date, description, transaction_type, category, amount, payment_method,
          account_id, cost_center_id, reference_type, bank_account_id, statement_line_id, notes)
        values (l.posted_date, v_desc, v_dir,
          case p_kind when 'retirada_socio' then 'Retirada do sócio' when 'aporte_socio' then 'Aporte do sócio'
                      when 'emprestimo_recebido' then 'Empréstimo recebido' when 'emprestimo_pago' then 'Quitação de empréstimo'
                      else 'Repasse por conta de terceiros' end,
          v_amt, v_method, v_acc, v_cc, 'Manual', l.bank_account_id, l.id, 'Conciliação bancária')
        returning id into v_cash;
      end if;

      if p_kind <> 'ignorar' then
        update bank_statement_lines
        set status = 'conciliada', kind = p_kind, account_id = v_acc, cost_center_id = v_cc,
            supplier_id = (p_payload->>'supplier_id')::uuid, client_id = (p_payload->>'client_id')::uuid,
            transfer_bank_account_id = (p_payload->>'transfer_bank_account_id')::uuid,
            created_ap_id = v_ap, created_ar_id = v_ar, cash_transaction_id = v_cash, updated_at = now()
        where id = l.id;
      end if;
      v_ok := v_ok + 1;
    exception when others then
      v_err := v_err || jsonb_build_object('line_id', l.id, 'error', sqlerrm);
    end;
  end loop;

  -- Regra aprendida (opcional)
  if coalesce((p_payload->>'save_rule')::boolean, false) and nullif(btrim(coalesce(p_payload->>'rule_pattern','')), '') is not null then
    insert into reconciliation_rules (pattern, direction, kind, account_id, cost_center_id, supplier_id, client_id, transfer_bank_account_id, document_type)
    values (btrim(p_payload->>'rule_pattern'), p_payload->>'rule_direction', p_kind, v_acc, v_cc,
            (p_payload->>'supplier_id')::uuid, (p_payload->>'client_id')::uuid, (p_payload->>'transfer_bank_account_id')::uuid,
            p_payload->>'document_type');
  end if;

  return jsonb_build_object('applied', v_ok, 'errors', v_err);
end $$;

-- ── Desfazer (só o que a conciliação criou) ───────────────────────────
create or replace function public.reconcile_undo(p_line_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l record;
begin
  if not public.has_financial_access(auth.uid()) then raise exception 'Acesso restrito ao financeiro'; end if;
  select * into l from bank_statement_lines where id = p_line_id;
  if not found then raise exception 'Linha % não encontrada', p_line_id; end if;

  -- Solta o vínculo da linha ANTES de remover caixa (FK cash_transaction_id)
  update bank_statement_lines set cash_transaction_id = null where id = p_line_id;

  if l.kind = 'existente' then
    -- casamento automático: só solta o vínculo, o lançamento original fica
    update cash_transactions set statement_line_id = null where statement_line_id = l.id;
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
  end if;

  update bank_statement_lines
  set status = 'pendente', kind = null, cash_transaction_id = null, created_ap_id = null, created_ar_id = null,
      account_id = null, cost_center_id = null, supplier_id = null, client_id = null, transfer_bank_account_id = null,
      updated_at = now()
  where id = p_line_id;
  return jsonb_build_object('success', true);
end $$;

revoke execute on function public.reconcile_import_lines(uuid, text, text, date, date, jsonb) from public;
revoke execute on function public.reconcile_auto_match(uuid, int) from public;
revoke execute on function public.reconcile_suggest(uuid) from public;
revoke execute on function public.reconcile_apply(uuid[], text, jsonb) from public;
revoke execute on function public.reconcile_undo(uuid) from public;
grant execute on function public.reconcile_import_lines(uuid, text, text, date, date, jsonb) to authenticated;
grant execute on function public.reconcile_auto_match(uuid, int) to authenticated;
grant execute on function public.reconcile_suggest(uuid) to authenticated;
grant execute on function public.reconcile_apply(uuid[], text, jsonb) to authenticated;
grant execute on function public.reconcile_undo(uuid) to authenticated;
