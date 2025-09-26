-- Add yield_unit field to recipes table for unit of measurement
ALTER TABLE public.recipes 
ADD COLUMN yield_unit text DEFAULT 'unidade';