-- Simple approach to create enums and standards table
-- Drop existing types if they exist
DROP TYPE IF EXISTS public.event_category CASCADE;
DROP TYPE IF EXISTS public.product_category CASCADE;

-- Create new enums
CREATE TYPE public.event_category AS ENUM (
    'Coffee Break',
    'Brunch',
    'Coquetel',
    'Almoco',
    'Jantar',
    'Festa Infantil',
    'Casamento',
    'Reuniao Corporativa'
);

CREATE TYPE public.product_category AS ENUM (
    'Salgados',
    'Doces',  
    'Low Fat',
    'Bebidas',
    'Sobremesas',
    'Complementos'
);

-- Update table columns to use new enums (with default values to avoid conflicts)
DO $$
BEGIN
    -- Update proposals table
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'proposals' AND column_name = 'event_category') THEN
        ALTER TABLE public.proposals 
        ALTER COLUMN event_category TYPE public.event_category 
        USING 'Coffee Break'::public.event_category;
    END IF;
    
    -- Update products table  
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'products' AND column_name = 'category') THEN
        ALTER TABLE public.products 
        ALTER COLUMN category TYPE public.product_category 
        USING 'Salgados'::public.product_category;
    END IF;
END $$;

-- Create event category standards table
CREATE TABLE IF NOT EXISTS public.event_category_standards (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_category public.event_category NOT NULL,
    product_category public.product_category NOT NULL,
    recommended_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    min_percentage DECIMAL(5,2) DEFAULT 0,
    max_percentage DECIMAL(5,2) DEFAULT 100,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(event_category, product_category)
);

-- Enable RLS
ALTER TABLE public.event_category_standards ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone authenticated can view event_category_standards" 
ON public.event_category_standards 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins and managers can manage event_category_standards" 
ON public.event_category_standards 
FOR ALL
USING (is_admin_or_manager(auth.uid()))
WITH CHECK (is_admin_or_manager(auth.uid()));

-- Insert default standards (with ON CONFLICT to avoid duplicates)
INSERT INTO public.event_category_standards (event_category, product_category, recommended_percentage, min_percentage, max_percentage, notes) VALUES
-- Coffee Break standards
('Coffee Break', 'Salgados', 60.00, 50.00, 70.00, 'Foco em salgados leves e práticos'),
('Coffee Break', 'Doces', 30.00, 20.00, 40.00, 'Doces pequenos e individuais'),
('Coffee Break', 'Bebidas', 10.00, 5.00, 15.00, 'Café, chás e sucos'),

-- Brunch standards  
('Brunch', 'Salgados', 45.00, 35.00, 55.00, 'Mix de salgados e opções mais elaboradas'),
('Brunch', 'Doces', 35.00, 25.00, 45.00, 'Variedade de doces e sobremesas'), 
('Brunch', 'Low Fat', 15.00, 10.00, 25.00, 'Opções saudáveis'),
('Brunch', 'Bebidas', 5.00, 0.00, 10.00, 'Sucos naturais e bebidas leves'),

-- Coquetel standards
('Coquetel', 'Salgados', 70.00, 60.00, 80.00, 'Predominância de salgados sofisticados'),
('Coquetel', 'Doces', 20.00, 10.00, 30.00, 'Doces finos e pequenos'),
('Coquetel', 'Bebidas', 10.00, 5.00, 15.00, 'Bebidas especiais e coquetéis')
ON CONFLICT (event_category, product_category) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_event_category_standards_updated_at
    BEFORE UPDATE ON public.event_category_standards
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();