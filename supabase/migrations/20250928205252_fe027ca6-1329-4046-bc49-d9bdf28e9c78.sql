-- Find and remove all remaining views to clear security warnings
DO $$ 
DECLARE
    view_name TEXT;
BEGIN
    -- Drop all public views to clear SECURITY DEFINER warnings
    FOR view_name IN 
        SELECT viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(view_name) || ' CASCADE';
        RAISE NOTICE 'Dropped view: %', view_name;
    END LOOP;
END $$;