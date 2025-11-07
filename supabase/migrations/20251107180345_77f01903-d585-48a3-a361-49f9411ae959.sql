-- Adicionar política de SELECT específica para eventos
-- Isso permite que admins e managers visualizem todos os eventos

-- Remover a política ALL atual que pode estar causando conflito
DROP POLICY IF EXISTS "Only admins and managers can manage events" ON public.events;

-- Criar política específica para SELECT (visualização)
CREATE POLICY "Admins and managers can view events"
ON public.events
FOR SELECT
TO authenticated
USING (is_admin_or_manager(auth.uid()));

-- Criar política específica para INSERT (criação)
CREATE POLICY "Admins and managers can create events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Criar política específica para UPDATE (edição)
CREATE POLICY "Admins and managers can update events"
ON public.events
FOR UPDATE
TO authenticated
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Criar política específica para DELETE (exclusão)
CREATE POLICY "Admins and managers can delete events"
ON public.events
FOR DELETE
TO authenticated
USING (is_admin_or_manager(auth.uid()));