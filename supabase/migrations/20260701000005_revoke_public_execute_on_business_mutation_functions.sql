-- Correção da migration anterior (20260701000004): o ACL dessas funções
-- concedia EXECUTE ao pseudo-papel PUBLIC (aparece como "=X" no proacl), não
-- diretamente a `anon`. Como TODO papel (incluindo anon) é membro implícito
-- de PUBLIC, revogar só de `anon` não bastava — o acesso continuava valendo
-- via PUBLIC. Revoga de PUBLIC also, mantendo o GRANT explícito e separado
-- para `authenticated` (já presente no ACL, independente do de PUBLIC).
DO $$
DECLARE
  fn record;
  revoke_list text[] := ARRAY[
    'apply_global_discount_to_invoice','archive_composite_bom','archive_material','archive_recipe_bom',
    'consume_materials_for_production','convert_proposal_to_order','create_event_from_proposal',
    'create_event_notifications','execute_event_production','finalize_production_order',
    'finalize_proposal_fulfillment','generate_accounts_payable_from_invoice','generate_due_date_alerts',
    'generate_event_production','generate_production_from_proposal','import_taxonomy_from_csv',
    'merge_duplicate_materials','merge_materials','process_component_consumption','process_cost_adjustment',
    'process_finish_input','process_finish_input_with_bom_cost','process_inventory_adjustment',
    'process_order_component_consumption','process_order_finish_input','process_stock_entry_with_conversion',
    'produce_composite_product_with_correct_cost','produce_product','recalculate_material_average_price',
    'recalculate_product_stock_cost','recalculate_stock_total_values','recompute_all_pricing',
    'recompute_bank_balance','refresh_bom_costs_for_material','refresh_bom_weight_for_material',
    'refresh_material_pricing','refresh_overdue_status','reserve_materials_for_production',
    'rpc_inventory_add_materials','rpc_inventory_create_cycle','rpc_inventory_finalize',
    'rpc_inventory_update_status','sanitize_bom_for_material','save_material_mapping',
    'update_production_order_status','mark_bom_cost_alert_as_read','update_bank_account_balance',
    'diag_bom_migration_report','fix_corrupted_production_costs','run_bom_cleanup_playbook',
    'run_pricing_tests','test_bom_cleanup_and_migration','ops_archive_legacy_recipes',
    'finalize_legacy_recipes_to_bom',
    'calculate_bom_current_cost','calculate_composite_current_cost','calculate_weighted_average_price',
    'check_production_availability','compute_event_item_planned_qty','compute_product_pricing',
    'validate_material_units','suggest_material_matches','suggest_material_taxonomy_migration',
    'approve_proposal_as_client','create_portal_order','get_portal_catalog','get_portal_proposal',
    'get_portal_proposals','get_portal_settings','request_proposal_change',
    'audit_config_changes','audit_sensitive_access','audit_supplier_products_access','audit_user_role_changes',
    'auto_create_stock_item','auto_create_stock_item_on_update','calculate_stock_total_value',
    'enforce_is_sellable_from_type','enhanced_security_audit','fn_check_recipes_bom_output','fn_prevent_bom_cycles',
    'generate_employee_number','generate_material_code','generate_planning_run_code','generate_product_code',
    'generate_proposal_number','generate_purchase_order_number','generate_supplier_code','handle_new_user_role',
    'increment_material_match_count','increment_supplier_match_count','insert_cash_on_payment','insert_cash_on_receipt',
    'set_proposal_approved_at','set_updated_at','sync_recipe_archive_with_material','sync_user_profile_email',
    'trg_bank_initial_balance','trg_bom_weight_on_items','trg_bom_weight_on_recipe','trg_cascade_weight_on_material',
    'trg_material_pricing_refresh','trg_sync_bank_balance','trigger_client_security_monitoring',
    'trigger_refresh_bom_costs_on_material_price_change','trigger_refresh_bom_costs_on_stock_change',
    'trigger_security_monitoring','trigger_sync_stock_quantity','trigger_update_bom_costs_on_price_change',
    'trigger_update_weighted_average_on_purchase','update_bom_production_orders_updated_at',
    'update_payable_remaining_amount','update_receivable_remaining_amount','update_updated_at_column',
    'validate_composite_bom_no_intermediate','validate_material_category','validate_production_movement',
    'validate_recipes_bom_material_type','handle_invite_signup'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(revoke_list)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn.sig);
    -- garante authenticated explícito (idempotente; já deveria existir no ACL)
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
  END LOOP;
END $$;
