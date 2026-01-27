-- =====================================================
-- FIX: Business Intelligence Data Exposed via Public Read Policies
-- Tables: invoice_material_matches, invoice_supplier_matches, event_sessions
-- =====================================================

-- 1. Fix invoice_material_matches - Drop permissive policy and create secure one
DROP POLICY IF EXISTS "Users can view invoice material matches" ON invoice_material_matches;
CREATE POLICY "Only authenticated users can view invoice material matches"
ON invoice_material_matches FOR SELECT
TO authenticated
USING (is_admin_or_manager(auth.uid()));

-- 2. Fix invoice_supplier_matches - Drop permissive policy and create secure one
DROP POLICY IF EXISTS "Users can view invoice supplier matches" ON invoice_supplier_matches;
CREATE POLICY "Only authenticated users can view invoice supplier matches"
ON invoice_supplier_matches FOR SELECT
TO authenticated
USING (is_admin_or_manager(auth.uid()));

-- 3. Fix event_sessions - Drop permissive policy and create secure one
DROP POLICY IF EXISTS "Usuários podem ver sessões de eventos" ON event_sessions;
CREATE POLICY "Only authenticated users can view event sessions"
ON event_sessions FOR SELECT
TO authenticated
USING (is_admin_or_manager(auth.uid()));