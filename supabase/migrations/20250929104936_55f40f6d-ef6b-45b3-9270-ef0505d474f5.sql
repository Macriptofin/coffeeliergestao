-- Adicionar coluna notes à tabela recipe_bom_items se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recipe_bom_items' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.recipe_bom_items 
        ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Verificar se outras colunas necessárias existem e adicionar se não existirem
DO $$ 
BEGIN
    -- Adicionar is_packaging se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recipe_bom_items' 
        AND column_name = 'is_packaging'
    ) THEN
        ALTER TABLE public.recipe_bom_items 
        ADD COLUMN is_packaging BOOLEAN DEFAULT false;
    END IF;
    
    -- Adicionar waste_percent se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'recipe_bom_items' 
        AND column_name = 'waste_percent'
    ) THEN
        ALTER TABLE public.recipe_bom_items 
        ADD COLUMN waste_percent NUMERIC DEFAULT 0;
    END IF;
END $$;