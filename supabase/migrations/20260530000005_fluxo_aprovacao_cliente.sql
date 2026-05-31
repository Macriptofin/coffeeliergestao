-- =====================================================
-- FLUXO DE APROVAÇÃO DO CLIENTE
-- Token público + funções SECURITY DEFINER
-- =====================================================

CREATE TABLE IF NOT EXISTS proposal_approval_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL DEFAULT now() + INTERVAL '30 days',
  used_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE proposal_approval_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_create" ON proposal_approval_tokens FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth_read"   ON proposal_approval_tokens FOR SELECT USING (auth.role() = 'authenticated');
CREATE INDEX IF NOT EXISTS idx_approval_tokens_token ON proposal_approval_tokens(token);

-- Buscar proposta pelo token (sem auth)
CREATE OR REPLACE FUNCTION get_proposal_by_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_proposal_id uuid; v_result jsonb;
BEGIN
  SELECT proposal_id INTO v_proposal_id FROM proposal_approval_tokens
  WHERE token = p_token AND expires_at > now() AND used_at IS NULL;
  IF v_proposal_id IS NULL THEN RETURN jsonb_build_object('error', 'Token inválido ou expirado'); END IF;
  SELECT jsonb_build_object(
    'id', p.id, 'proposal_number', p.proposal_number, 'event_category', p.event_category,
    'number_of_people', p.number_of_people, 'event_date', p.event_date,
    'total_amount', p.total_amount, 'target_weight_per_person', p.target_weight_per_person,
    'status', p.status, 'client_name', c.name, 'department_name', cd.name,
    'unit_name', cu.name, 'room_name', cr.name, 'contact_name', cc.name, 'contact_email', cc.email,
    'categories', (
      SELECT jsonb_agg(jsonb_build_object('category_label', pc.category_label, 'items', (
        SELECT jsonb_agg(jsonb_build_object('name', m.name, 'qty_per_person', pci.qty_per_person, 'fixed_qty', pci.fixed_qty, 'unit', m.usage_unit))
        FROM proposal_category_items pci JOIN materials m ON m.id = pci.material_id WHERE pci.category_id = pc.id
      )) ORDER BY pc.sort_order) FROM proposal_categories pc WHERE pc.proposal_id = p.id
    )
  ) INTO v_result
  FROM proposals p LEFT JOIN clients c ON c.id=p.client_id LEFT JOIN client_departments cd ON cd.id=p.department_id
  LEFT JOIN client_units cu ON cu.id=p.unit_id LEFT JOIN client_rooms cr ON cr.id=p.room_id LEFT JOIN client_contacts cc ON cc.id=p.contact_id
  WHERE p.id = v_proposal_id;
  RETURN v_result;
END; $$;

-- Aprovar proposta pelo token (sem auth)
CREATE OR REPLACE FUNCTION approve_proposal_by_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_proposal_id uuid; v_status text;
BEGIN
  SELECT proposal_id INTO v_proposal_id FROM proposal_approval_tokens
  WHERE token = p_token AND expires_at > now() AND used_at IS NULL;
  IF v_proposal_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Token inválido, expirado ou já utilizado'); END IF;
  SELECT status INTO v_status FROM proposals WHERE id = v_proposal_id;
  IF v_status = 'aprovada' THEN RETURN jsonb_build_object('success', true, 'message', 'Proposta já estava aprovada'); END IF;
  UPDATE proposal_approval_tokens SET used_at = now() WHERE token = p_token;
  UPDATE proposals SET status = 'aprovada' WHERE id = v_proposal_id;
  BEGIN PERFORM create_event_from_proposal(v_proposal_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM generate_production_from_proposal(v_proposal_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN jsonb_build_object('success', true, 'message', 'Proposta aprovada!', 'proposal_id', v_proposal_id);
END; $$;
