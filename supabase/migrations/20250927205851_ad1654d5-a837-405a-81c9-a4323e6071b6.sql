DO $$
DECLARE
  v_ts      text := to_char(now(), 'YYYYMMDD_HH24MI');
  v_schema  text := 'bk_' || v_ts;
  v_tbls    text[] := ARRAY[
    'event_production_order_items',
    'event_production_orders',
    'event_table_items',
    'event_tables',
    'composite_bom_items',
    'composites_bom',
    'recipe_bom_items',
    'recipes_bom'
  ];
  t text;
  v_exists boolean;
  v_count bigint;
BEGIN
  RAISE NOTICE '=== Iniciando snapshot em schema % ===', v_schema;
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema);

  FOREACH t IN ARRAY v_tbls LOOP
    SELECT to_regclass('public.'||t) IS NOT NULL INTO v_exists;
    IF v_exists THEN
      RAISE NOTICE 'Snapshot: copiando public.% ...', t;
      EXECUTE format('CREATE TABLE %I.%I AS TABLE public.%I WITH DATA', v_schema, t, t);
    ELSE
      RAISE NOTICE 'Snapshot: tabela public.% não existe, pulando.', t;
    END IF;
  END LOOP;

  RAISE NOTICE '=== Contagens antes da limpeza ===';
  FOREACH t IN ARRAY v_tbls LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO v_count;
      RAISE NOTICE 'public.%: %', t, v_count;
    END IF;
  END LOOP;

  RAISE NOTICE '=== Ativando modo manutenção (se aplicável) ===';
  IF to_regclass('public.app_settings') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.app_settings(key,value,updated_at)
      VALUES('maintenance_production','true',now())
      ON CONFLICT (key) DO UPDATE SET value='true', updated_at=excluded.updated_at;
      RAISE NOTICE 'maintenance_production=true';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Não foi possível ajustar app_settings; seguindo.';
    END;
  END IF;

  RAISE NOTICE '=== Limpando tabelas (ordem: itens -> cabeçalhos) ===';

  -- EVENT TABLES / ORDERS
  IF to_regclass('public.event_production_order_items') IS NOT NULL THEN
    TRUNCATE TABLE public.event_production_order_items RESTART IDENTITY CASCADE;
  END IF;
  IF to_regclass('public.event_production_orders') IS NOT NULL THEN
    TRUNCATE TABLE public.event_production_orders RESTART IDENTITY CASCADE;
  END IF;
  IF to_regclass('public.event_table_items') IS NOT NULL THEN
    TRUNCATE TABLE public.event_table_items RESTART IDENTITY CASCADE;
  END IF;
  IF to_regclass('public.event_tables') IS NOT NULL THEN
    TRUNCATE TABLE public.event_tables RESTART IDENTITY CASCADE;
  END IF;

  -- COMPOSITES (kits/mesas de catálogo)
  IF to_regclass('public.composite_bom_items') IS NOT NULL THEN
    TRUNCATE TABLE public.composite_bom_items RESTART IDENTITY CASCADE;
  END IF;
  IF to_regclass('public.composites_bom') IS NOT NULL THEN
    TRUNCATE TABLE public.composites_bom RESTART IDENTITY CASCADE;
  END IF;

  -- BOM (produtos acabados/intermediários)
  IF to_regclass('public.recipe_bom_items') IS NOT NULL THEN
    TRUNCATE TABLE public.recipe_bom_items RESTART IDENTITY CASCADE;
  END IF;
  IF to_regclass('public.recipes_bom') IS NOT NULL THEN
    TRUNCATE TABLE public.recipes_bom RESTART IDENTITY CASCADE;
  END IF;

  RAISE NOTICE '=== Contagens após a limpeza ===';
  FOREACH t IN ARRAY v_tbls LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO v_count;
      RAISE NOTICE 'public.%: %', t, v_count;
    END IF;
  END LOOP;

  RAISE NOTICE '=== Desativando modo manutenção (se aplicável) ===';
  IF to_regclass('public.app_settings') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.app_settings(key,value,updated_at)
      VALUES('maintenance_production','false',now())
      ON CONFLICT (key) DO UPDATE SET value='false', updated_at=excluded.updated_at;
      RAISE NOTICE 'maintenance_production=false';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Não foi possível ajustar app_settings; finalize manualmente se necessário.';
    END;
  END IF;

  RAISE NOTICE '=== Limpeza concluída com sucesso. Snapshot disponível em schema % ===', v_schema;

  -- Auditoria opcional
  IF to_regclass('public.ops_bom_audit_log') IS NOT NULL THEN
    INSERT INTO public.ops_bom_audit_log(at, action, detail)
    VALUES (now(), 'bom_cleanup',
            jsonb_build_object('snapshot_schema', v_schema,
                               'tables', array_to_string(v_tbls, ',')));
  END IF;

END$$;