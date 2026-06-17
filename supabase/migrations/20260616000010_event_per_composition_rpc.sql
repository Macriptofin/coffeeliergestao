-- Fase 7: agenda por composição.
-- Remove o trigger quebrado (checava 'Aprovada' maiúsculo, nunca disparava) e a
-- função no-arg, e cria um RPC composition-aware que o frontend já chama no Aprovar.
DROP FUNCTION IF EXISTS public.create_event_from_proposal() CASCADE;

CREATE OR REPLACE FUNCTION public.create_event_from_proposal(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_prop   record;
  v_comp   record;
  v_people int;
  v_eid    uuid;
  v_count  int := 0;
begin
  select * into v_prop from public.proposals where id = p_proposal_id;
  if not found then
    raise exception 'Proposta % não encontrada', p_proposal_id;
  end if;

  -- Idempotência: regenera os eventos desta proposta
  delete from public.events where proposal_id = p_proposal_id;

  -- Um evento na agenda por COMPOSIÇÃO (momento), com data/hora/local próprios
  for v_comp in
    select * from public.proposal_compositions
    where proposal_id = p_proposal_id
    order by sort_order
  loop
    v_people := coalesce(v_comp.number_of_people, v_prop.number_of_people, 0);
    insert into public.events (
      proposal_id, client_id, event_name, event_date, setup_time, venue,
      total_people, total_amount, event_duration, status
    ) values (
      p_proposal_id, v_prop.client_id,
      coalesce(nullif(trim(v_comp.name), ''), 'Momento') || ' — Prop. ' || v_prop.proposal_number,
      coalesce(v_comp.scheduled_date, v_prop.event_date),
      v_comp.scheduled_time,
      v_comp.location,
      v_people,
      coalesce(v_comp.price_per_person, 0) * v_people,
      4,
      'Agendado'
    ) returning id into v_eid;

    perform public.create_event_notifications(v_eid);
    v_count := v_count + 1;
  end loop;

  -- Fallback: proposta sem composições -> 1 evento da proposta
  if v_count = 0 then
    insert into public.events (
      proposal_id, client_id, event_name, event_date,
      total_people, total_amount, event_duration, status
    ) values (
      p_proposal_id, v_prop.client_id,
      'Evento — Prop. ' || v_prop.proposal_number,
      v_prop.event_date, v_prop.number_of_people,
      coalesce(v_prop.total_amount, 0), 4, 'Agendado'
    ) returning id into v_eid;
    perform public.create_event_notifications(v_eid);
    v_count := 1;
  end if;

  return jsonb_build_object('status', 'success', 'events_created', v_count);
end;
$function$;
