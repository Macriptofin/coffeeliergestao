-- Fix critical security issue: Restrict supplier_products access to admin/manager roles only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Manage supplier_products (auth only)" ON public.supplier_products;

-- Create proper restrictive policies
CREATE POLICY "Only admins and managers can view supplier_products" 
ON public.supplier_products 
FOR SELECT 
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can insert supplier_products" 
ON public.supplier_products 
FOR INSERT 
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can update supplier_products" 
ON public.supplier_products 
FOR UPDATE 
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Only admins and managers can delete supplier_products" 
ON public.supplier_products 
FOR DELETE 
USING (is_admin_or_manager(auth.uid()));

-- Add audit logging for supplier data access
CREATE OR REPLACE FUNCTION public.audit_supplier_products_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access to supplier products for audit trail
  INSERT INTO public.security_audit_log (
    user_id, action, resource_type, resource_id, details
  ) VALUES (
    auth.uid(), 
    TG_OP || '_SUPPLIER_PRODUCT', 
    'supplier_products',
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'supplier_id', COALESCE(NEW.supplier_id, OLD.supplier_id),
      'material_id', COALESCE(NEW.material_id, OLD.material_id)
    )
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for supplier products audit
CREATE TRIGGER audit_supplier_products_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_products
  FOR EACH ROW EXECUTE FUNCTION public.audit_supplier_products_access();