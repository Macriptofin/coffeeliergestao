-- Corrigir last_movement_date para itens existentes sem data
UPDATE stock_items 
SET 
  last_movement_date = now(),
  updated_at = now()
WHERE last_movement_date IS NULL;