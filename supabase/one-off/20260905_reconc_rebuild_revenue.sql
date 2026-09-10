-- ONE-OFF (executado em 05/09/2026 e depois REMOVIDO do banco). Arquivado só para auditoria.
-- Reconstrução da receita 2026 a partir das NFs (NF-e VHSYS + NFS-e Guaíba) e do CSV da Monkey,
-- casando com as linhas do extrato Nubank já importadas na Conciliação Bancária.
-- NÃO reexecutar: não é idempotente (recriaria os 54 recebimentos das antecipações e os deságios).
-- Tabelas de apoio usadas (também removidas): reconc_stage_nf(kind, nf, client_name, client_doc, amount, issue_date, situacao)
-- e reconc_stage_monkey(kind, nf, nf_raw, bank, op_date, gross, fee, net, paid). Resumo de cada execução ficou em public.reconc_log.
--
-- Modo de uso na época: p_commit=false roda tudo e lança exceção 'ROLLBACK_TEST <json>' (ensaio);
-- p_commit=true grava e devolve o mesmo json.

create or replace function public.reconc_rebuild_revenue(p_commit boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_principal uuid; v_acc_rev uuid; v_acc_fee uuid; v_cc_ev uuid; v_cc_fin uuid;
  r record; c record; ln record; v_client uuid; v_ar uuid; v_rc uuid; v_ap uuid; v_pay uuid; v_sup uuid;
  v_n_cli int := 0; v_n_upd int := 0; v_n_ins int := 0; v_n_rc_mk int := 0; v_n_ap_fee int := 0; v_n_ln_mk int := 0;
  v_n_rc_pix int := 0; v_n_ln_pix int := 0; v_n_partial int := 0;
  v_label text; v_due date; v_cash uuid[]; v_nets numeric[]; v_keys text[]; v_cnt int; v_mask int; v_m int; v_sum numeric; v_k int;
  v_fin_name text; v_fin_cnpj text; v_cids uuid[]; v_rems numeric[]; v_found boolean; v_sel text[];
  v_best int; v_pc int; v_cnt2 int; v_pid uuid; v_prem numeric;
  v_summary jsonb;
begin
  select id into v_principal from bank_accounts where name = 'Principal';
  select id into v_acc_rev from chart_of_accounts where code = '4.1.1';
  select id into v_acc_fee from chart_of_accounts where code = '5.3.4';
  select id into v_cc_ev from cost_centers where name = 'Eventos';
  select id into v_cc_fin from cost_centers where name = 'Financeiro';

  create temp table t_cli (doc text primary key, client_id uuid) on commit drop;
  create temp table t_ar (kind text, nf int, ar_id uuid, mode text, client_id uuid, primary key (kind, nf)) on commit drop;
  create temp table t_mk (bank text, op_date date, nf_key text, net numeric, cash uuid[], assigned boolean default false) on commit drop;

  -- 1. clientes das NFs (por CNPJ/CPF; fallback nome; senão cria)
  for c in select client_doc, min(client_name) as client_name from reconc_stage_nf where situacao = 'valida' group by client_doc loop
    select id into v_client from clients where regexp_replace(coalesce(cnpj_cpf,''), '\D', '', 'g') = c.client_doc limit 1;
    if v_client is null then
      select id into v_client from clients where name ilike split_part(c.client_name,' ',1) || ' ' || split_part(c.client_name,' ',2) || '%' limit 1;
    end if;
    if v_client is null then
      insert into clients (name, cnpj_cpf, client_type, notes)
      values (c.client_name,
              case when length(c.client_doc) = 14 then regexp_replace(c.client_doc, '(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})', '\1.\2.\3/\4-\5')
                   else regexp_replace(c.client_doc, '(\d{3})(\d{3})(\d{3})(\d{2})', '\1.\2.\3-\4') end,
              case when length(c.client_doc) = 14 then 'PJ' else 'PF' end,
              'Criado pela conciliação bancária (importação de NFs 2026)')
      returning id into v_client;
      v_n_cli := v_n_cli + 1;
    end if;
    insert into t_cli values (c.client_doc, v_client);
  end loop;

  -- 2. contas a receber: casa com AR manual existente (mesmo valor, nº da NF no invoice_number ou ±120 dias) ou cria
  for r in
    select s.*, t.client_id as cid, m.paid as monkey_due
    from reconc_stage_nf s join t_cli t on t.doc = s.client_doc
    left join reconc_stage_monkey m on m.kind = s.kind and m.nf = s.nf
    where s.situacao = 'valida' order by s.issue_date, s.kind, s.nf
  loop
    v_label := case when r.kind = 'nfe' then 'NF-e ' else 'NFS-e ' end || r.nf;
    v_due := coalesce(r.monkey_due, r.issue_date + 30);
    select a.id into v_ar from accounts_receivable a
    where a.status <> 'Cancelado' and a.id not in (select ar_id from t_ar)
      and a.original_amount = r.amount
      and (coalesce(a.invoice_number,'') ~ ('(^|[^0-9])' || r.nf || '([^0-9]|$)') or abs(a.issue_date - r.issue_date) <= 120)
    order by (case when coalesce(a.invoice_number,'') ~ ('(^|[^0-9])' || r.nf || '([^0-9]|$)') then 0 else 1 end), abs(a.issue_date - r.issue_date)
    limit 1;
    if v_ar is not null then
      update accounts_receivable a set
        invoice_number = v_label, document_number = r.nf::text, client_id = r.cid,
        competence_date = least(a.issue_date, r.issue_date), issue_date = r.issue_date, due_date = v_due,
        account_id = coalesce(a.account_id, v_acc_rev), cost_center_id = coalesce(a.cost_center_id, v_cc_ev),
        source_type = coalesce(a.source_type, 'nf_import'),
        notes = coalesce(a.notes,'') || ' [' || v_label || ' vinculada pela conciliação 05/09/2026; data original ' || to_char(a.issue_date,'DD/MM/YYYY') || ']'
      where a.id = v_ar;
      insert into t_ar values (r.kind, r.nf, v_ar, 'update', r.cid);
      v_n_upd := v_n_upd + 1;
    else
      insert into accounts_receivable (client_id, invoice_number, document_number, description, issue_date, due_date, competence_date,
        original_amount, received_amount, remaining_amount, status, account_id, cost_center_id, source_type, notes)
      values (r.cid, v_label, r.nf::text, v_label || ' — ' || r.client_name, r.issue_date, v_due, r.issue_date,
        r.amount, 0, r.amount, 'Pendente', v_acc_rev, v_cc_ev, 'nf_import', 'Importada pela conciliação bancária 05/09/2026')
      returning id into v_ar;
      insert into t_ar values (r.kind, r.nf, v_ar, 'insert', r.cid);
      v_n_ins := v_n_ins + 1;
    end if;
  end loop;

  -- 3. Monkey: recebimento pelo valor cheio + deságio como despesa financeira (5.3.4), por NF
  for r in select m.*, t.ar_id from reconc_stage_monkey m join t_ar t on t.kind = m.kind and t.nf = m.nf order by m.op_date, m.bank, m.nf loop
    v_label := case when r.kind = 'nfe' then 'NF-e ' else 'NFS-e ' end || r.nf;
    v_fin_name := case r.bank when 'BNP' then 'Banco BNP Paribas Brasil S.A.' when 'SOFISA' then 'Banco Sofisa S.A.' when 'CREFISA' then 'Banco Crefisa S.A.' else 'Itaú Unibanco S.A.' end;
    v_fin_cnpj := case r.bank when 'BNP' then '01.522.368/0001-82' when 'SOFISA' then '60.889.128/0001-80' when 'CREFISA' then '61.033.106/0001-86' else '60.701.190/4816-09' end;
    select id into v_sup from suppliers where company_name = v_fin_name;
    if v_sup is null then
      insert into suppliers (company_name, trade_name, cnpj_cpf, supplier_type, main_category, notes)
      values (v_fin_name, 'Monkey — ' || r.bank, v_fin_cnpj, 'PJ', 'Financeiro', 'Financeira da antecipação de recebíveis (Monkey)') returning id into v_sup;
    end if;
    insert into receipt_transactions (account_receivable_id, receipt_date, amount, receipt_method, bank_account_id, document_number, notes)
    values (r.ar_id, r.op_date, r.gross, 'Transferência', v_principal, r.nf_raw,
            'Antecipação Monkey (' || r.bank || ') — líquido ' || r.net || ', deságio ' || r.fee)
    returning id into v_rc;
    v_n_rc_mk := v_n_rc_mk + 1;
    insert into accounts_payable (supplier_id, description, document_number, issue_date, due_date, competence_date, original_amount, remaining_amount, paid_amount,
      status, account_id, cost_center_id, document_type, bank_account_id, source_type, notes)
    values (v_sup, 'Deságio antecipação Monkey — ' || v_label || ' (' || r.bank || ' ' || to_char(r.op_date,'DD/MM/YYYY') || ')', r.nf_raw, r.op_date, r.op_date, r.op_date,
      r.fee, r.fee, 0, 'Pendente', v_acc_fee, v_cc_fin, 'sem_documento', v_principal, 'conciliacao', 'Retido pela financeira na antecipação')
    returning id into v_ap;
    insert into payment_transactions (account_payable_id, payment_date, amount, payment_method, bank_account_id, notes)
    values (v_ap, r.op_date, r.fee, 'PIX', v_principal, 'Retido na antecipação') returning id into v_pay;
    v_n_ap_fee := v_n_ap_fee + 1;
    select array_agg(id) into v_cash from cash_transactions where reference_id in (v_rc, v_pay);
    if coalesce(array_length(v_cash, 1), 0) <> 2 then raise exception 'Caixa não gerado para % (rc=%, pay=%)', v_label, v_rc, v_pay; end if;
    insert into t_mk (bank, op_date, nf_key, net, cash) values (r.bank, r.op_date, v_label, r.net, v_cash);
  end loop;

  -- 3b. vincula cada crédito da financeira ao subconjunto de NFs cuja soma líquida bate (lotes por banco + data de operação)
  for ln in
    select l.id, l.posted_date, l.amount,
      case when l.counterparty ilike '%BNP%' then 'BNP' when l.counterparty ilike '%SOFISA%' then 'SOFISA'
           when l.counterparty ilike '%CREFISA%' then 'CREFISA' when l.counterparty ilike '%UNIBANCO%' then 'ITAU' end as bank
    from bank_statement_lines l
    where l.bank_account_id = v_principal and l.status = 'pendente' and l.amount > 0 and l.description ilike 'Transferência Recebida%'
    order by l.posted_date, l.amount desc
  loop
    select array_agg(nf_key order by nf_key), array_agg(net order by nf_key), count(*) into v_keys, v_nets, v_cnt
    from t_mk where bank = ln.bank and op_date = ln.posted_date and not assigned;
    continue when coalesce(v_cnt, 0) = 0 or v_cnt > 12;
    v_found := false; v_mask := 0;
    for v_m in 1 .. (2 ^ v_cnt)::int - 1 loop   -- atenção: a variável do FOR é local do loop; o resultado vai em v_mask
      v_sum := 0;
      for v_k in 1 .. v_cnt loop
        if (v_m >> (v_k - 1)) & 1 = 1 then v_sum := v_sum + v_nets[v_k]; end if;
      end loop;
      if abs(v_sum - ln.amount) <= 0.02 then v_found := true; v_mask := v_m; exit; end if;
    end loop;
    if v_found then
      v_sel := '{}';
      for v_k in 1 .. v_cnt loop
        if (v_mask >> (v_k - 1)) & 1 = 1 then v_sel := v_sel || v_keys[v_k]; end if;
      end loop;
      select array_agg(x) into v_cash from t_mk, unnest(cash) x where bank = ln.bank and op_date = ln.posted_date and nf_key = any(v_sel);
      update t_mk set assigned = true where bank = ln.bank and op_date = ln.posted_date and nf_key = any(v_sel);
      perform reconcile_link_existing(ln.id, v_cash, 'Antecipação Monkey ' || ln.bank || ' — lote ' || to_char(ln.posted_date,'DD/MM') || ': ' || array_to_string(v_sel, ', '));
      v_n_ln_mk := v_n_ln_mk + 1;
    end if;
  end loop;

  -- 4. Pix direto de clientes: (a) AR única de valor exato; (b) menor combinação de ARs abertas; (c) parcial se só há 1 AR maior
  for ln in
    select l.id, l.posted_date, l.amount, l.counterparty,
      case when l.counterparty ilike '%CMPC CELULOSE%' then '11234954000185'
           when l.counterparty ilike '%SIND DOS TECNICOS%' then '93247534000106'
           when l.counterparty ilike '%W RENTAL%' then '07626346000149'
           when l.counterparty ilike '%INSTITUTO UM%' then '51374591000106'
           when l.counterparty ilike '%PRIMEIRO MUNDO%' then '81015158000137'
           when l.counterparty ilike '%INSTITUTO ARVORECER%' then '41841523000148'
           when l.counterparty ilike '%RSS3%' or l.counterparty ilike '%Gabriel Wessler%' then '27918099000161'
           when l.counterparty ilike '%UNDIME%' then '05387322000159'
           when l.counterparty ilike '%IZYDROS%' then '01925458000114'
           when l.counterparty ilike '%IBIS STYLES%' then '80732928002143' end as doc
    from bank_statement_lines l
    where l.bank_account_id = v_principal and l.status = 'pendente' and l.amount > 0
    order by l.posted_date, l.amount
  loop
    continue when ln.doc is null;
    select client_id into v_client from t_cli where doc = ln.doc;
    continue when v_client is null;
    v_cash := '{}'; v_found := false;
    select id into v_pid from accounts_receivable
    where client_id = v_client and status <> 'Cancelado' and abs(remaining_amount - ln.amount) <= 0.02
      and issue_date between ln.posted_date - 180 and ln.posted_date + 15
    order by abs(issue_date - ln.posted_date), id limit 1;
    if v_pid is not null then
      insert into receipt_transactions (account_receivable_id, receipt_date, amount, receipt_method, bank_account_id, notes)
      values (v_pid, ln.posted_date, ln.amount, 'PIX', v_principal, 'Pix ' || ln.counterparty || ' (conciliação)') returning id into v_rc;
      v_n_rc_pix := v_n_rc_pix + 1; v_found := true;
      select array_agg(id) into v_cash from cash_transactions where reference_id = v_rc;
    else
      select array_agg(id order by d, id), array_agg(rem order by d, id), count(*) into v_cids, v_rems, v_cnt
      from (select id, remaining_amount as rem, abs(issue_date - ln.posted_date) as d from accounts_receivable
            where client_id = v_client and status <> 'Cancelado' and remaining_amount > 0.005 and remaining_amount <= ln.amount + 0.02
              and issue_date between ln.posted_date - 120 and ln.posted_date + 15
            order by abs(issue_date - ln.posted_date), id limit 16) x;
      v_mask := 0; v_best := 99;
      if coalesce(v_cnt, 0) > 1 then
        for v_m in 1 .. (2 ^ v_cnt)::int - 1 loop
          v_sum := 0; v_pc := 0;
          for v_k in 1 .. v_cnt loop
            if (v_m >> (v_k - 1)) & 1 = 1 then v_sum := v_sum + v_rems[v_k]; v_pc := v_pc + 1; end if;
          end loop;
          if abs(v_sum - ln.amount) <= 0.02 and v_pc < v_best then v_best := v_pc; v_mask := v_m; v_found := true; exit when v_pc <= 2; end if;
        end loop;
      end if;
      if v_found then
        for v_k in 1 .. v_cnt loop
          if (v_mask >> (v_k - 1)) & 1 = 1 then
            insert into receipt_transactions (account_receivable_id, receipt_date, amount, receipt_method, bank_account_id, notes)
            values (v_cids[v_k], ln.posted_date, v_rems[v_k], 'PIX', v_principal, 'Pix ' || ln.counterparty || ' (conciliação)') returning id into v_rc;
            v_n_rc_pix := v_n_rc_pix + 1;
            v_cash := v_cash || (select array_agg(id) from cash_transactions where reference_id = v_rc);
          end if;
        end loop;
      else
        select count(*), (array_agg(id))[1] into v_cnt2, v_pid from accounts_receivable
        where client_id = v_client and status <> 'Cancelado' and remaining_amount > ln.amount + 0.02
          and issue_date between ln.posted_date - 120 and ln.posted_date + 15;
        if v_cnt2 = 1 then
          insert into receipt_transactions (account_receivable_id, receipt_date, amount, receipt_method, bank_account_id, notes)
          values (v_pid, ln.posted_date, ln.amount, 'PIX', v_principal, 'Pix parcial ' || ln.counterparty || ' (conciliação)') returning id into v_rc;
          v_n_rc_pix := v_n_rc_pix + 1; v_n_partial := v_n_partial + 1;
          select array_agg(id) into v_cash from cash_transactions where reference_id = v_rc;
        end if;
      end if;
    end if;
    if coalesce(array_length(v_cash, 1), 0) > 0 then
      perform reconcile_link_existing(ln.id, v_cash, 'Pix de cliente casado com ' || array_length(v_cash, 1) || ' NF(s)');
      v_n_ln_pix := v_n_ln_pix + 1;
    end if;
  end loop;

  v_summary := jsonb_build_object(
    'clientes_criados', v_n_cli, 'ar_atualizadas', v_n_upd, 'ar_inseridas', v_n_ins,
    'recebimentos_monkey', v_n_rc_mk, 'ap_desagio', v_n_ap_fee, 'linhas_monkey_vinculadas', v_n_ln_mk,
    'monkey_nao_vinculado', (select coalesce(jsonb_agg(jsonb_build_object('nf', nf_key, 'banco', bank, 'data', op_date, 'liq', net)), '[]') from t_mk where not assigned),
    'recebimentos_pix', v_n_rc_pix, 'pix_parciais', v_n_partial, 'linhas_pix_vinculadas', v_n_ln_pix,
    'receita_competencia_mes', (select jsonb_agg(jsonb_build_object('mes', m, 'nf', n, 'valor', v) order by m) from (
        select to_char(a.competence_date,'YYYY-MM') m, count(*) n, round(sum(a.original_amount),2) v from accounts_receivable a join t_ar t on t.ar_id = a.id group by 1) z),
    'nf_em_aberto', (select coalesce(jsonb_agg(jsonb_build_object('nf', a.invoice_number, 'cliente', left(cl.name,22), 'emissao', a.issue_date, 'saldo', a.remaining_amount) order by a.issue_date), '[]')
        from accounts_receivable a join t_ar t on t.ar_id = a.id left join clients cl on cl.id = a.client_id where a.remaining_amount > 0.005),
    'ar_manuais_sem_nf', (select coalesce(jsonb_agg(jsonb_build_object('data', a.issue_date, 'valor', a.original_amount, 'saldo', a.remaining_amount, 'desc', left(a.description,40), 'status', a.status) order by a.issue_date), '[]')
        from accounts_receivable a where a.status <> 'Cancelado' and a.issue_date >= '2025-11-01' and a.id not in (select ar_id from t_ar)),
    'pix_cliente_sem_casar', (select coalesce(jsonb_agg(jsonb_build_object('data', l.posted_date, 'valor', l.amount, 'quem', left(l.counterparty,22)) order by l.posted_date), '[]')
        from bank_statement_lines l where l.bank_account_id = v_principal and l.status = 'pendente' and l.amount > 0
          and (l.counterparty ilike '%CMPC%' or l.counterparty ilike '%SIND DOS%' or l.counterparty ilike '%W RENTAL%' or l.counterparty ilike '%INSTITUTO%'
               or l.counterparty ilike '%PRIMEIRO MUNDO%' or l.counterparty ilike '%RSS3%' or l.counterparty ilike '%UNDIME%' or l.counterparty ilike '%IZYDROS%' or l.counterparty ilike '%IBIS%'))
  );
  if not p_commit then raise exception 'ROLLBACK_TEST %', v_summary::text; end if;
  return v_summary;
end $$;
