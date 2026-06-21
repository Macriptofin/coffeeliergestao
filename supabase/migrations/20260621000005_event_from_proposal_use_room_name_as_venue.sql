-- A sala agora é por composição (proposal_compositions.room_id). O evento na agenda
-- deve usar o NOME DA SALA como venue (fallback no texto livre 'location'). Também
-- inclui o nome do evento (proposals.event_name) no event_name do momento.
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
  v_venue  text;
  v_label  text;
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
    -- Local = nome da sala (estrutura) com fallback no texto livre do momento
    v_venue := coalesce(
      (select name from public.client_rooms where id = v_comp.room_id),
      nullif(trim(coalesce(v_comp.location, '')), '')
    );
    -- Rótulo do evento: "<Nome do Evento> · <Momento> — Prop. N"
    v_label := coalesce(nullif(trim(v_prop.event_name), '') || ' · ', '')
               || coalesce(nullif(trim(v_comp.name), ''), 'Momento')
               || ' — Prop. ' || v_prop.proposal_number;

    insert into public.events (
      proposal_id, client_id, event_name, event_date, setup_time, venue,
      total_people, total_amount, event_duration, status
    ) values (
      p_proposal_id, v_prop.client_id,
      v_label,
      coalesce(v_comp.scheduled_date, v_prop.event_date),
      v_comp.scheduled_time,
      v_venue,
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
      coalesce(nullif(trim(v_prop.event_name), ''), 'Evento') || ' — Prop. ' || v_prop.proposal_number,
      v_prop.event_date, v_prop.number_of_people,
      coalesce(v_prop.total_amount, 0), 4, 'Agendado'
    ) returning id into v_eid;
    perform public.create_event_notifications(v_eid);
    v_count := 1;
  end if;

  return jsonb_build_object('status', 'success', 'events_created', v_count);
end;
$function$;
