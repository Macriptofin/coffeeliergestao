-- Advisor ERROR 1: vw_stock_available rodava com permissão do CRIADOR da view
-- (comportamento padrão de view no Postgres), não de quem consulta. Como
-- materials/stock_items já têm policy "Anyone authenticated can view",
-- rodar com a permissão de quem consulta é equivalente e mais seguro.
ALTER VIEW public.vw_stock_available SET (security_invoker = true);

-- Advisor ERROR 2: _backup_material_names é um backup manual (260 linhas,
-- id + name_original) feito antes da reclassificação em massa de materiais
-- (jun/2026). Não é referenciada em nenhuma função/view/trigger nem no app.
-- Estava em public com RLS desligado = legível por qualquer anon key.
-- Habilita RLS sem policies = acesso via API bloqueado para todos os papéis,
-- preservando os dados para referência histórica (consulta direta continua
-- possível via SQL/migrations).
ALTER TABLE public._backup_material_names ENABLE ROW LEVEL SECURITY;
