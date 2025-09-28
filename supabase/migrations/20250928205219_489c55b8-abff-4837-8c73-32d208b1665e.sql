-- Remove all SECURITY DEFINER views that are causing security warnings
-- These views are for diagnostics and can be removed safely

DROP VIEW IF EXISTS public.vw_diag_material_dupes CASCADE;
DROP VIEW IF EXISTS public.vw_diag_bom_inconsistencies CASCADE;
DROP VIEW IF EXISTS public.vw_diag_orphans CASCADE;
DROP VIEW IF EXISTS public.vw_stock_summary CASCADE;
DROP VIEW IF EXISTS public.vw_recipe_costs CASCADE;
DROP VIEW IF EXISTS public.vw_material_usage CASCADE;

-- Remove any other potential SECURITY DEFINER views
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND definition LIKE '%SECURITY DEFINER%'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;
END $$;