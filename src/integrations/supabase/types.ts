export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_time_restrictions: {
        Row: {
          allowed_days: number[]
          allowed_end_hour: number
          allowed_start_hour: number
          created_at: string | null
          id: string
          is_active: boolean | null
          operation_type: string
        }
        Insert: {
          allowed_days?: number[]
          allowed_end_hour?: number
          allowed_start_hour?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          operation_type: string
        }
        Update: {
          allowed_days?: number[]
          allowed_end_hour?: number
          allowed_start_hour?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          operation_type?: string
        }
        Relationships: []
      }
      account_lockouts: {
        Row: {
          created_at: string
          failed_attempts: number
          id: string
          lock_reason: string
          locked_at: string
          locked_until: string
          unlock_method: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          user_email: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          id?: string
          lock_reason?: string
          locked_at?: string
          locked_until: string
          unlock_method?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_email: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          id?: string
          lock_reason?: string
          locked_at?: string
          locked_until?: string
          unlock_method?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_email?: string
        }
        Relationships: []
      }
      accounts_payable: {
        Row: {
          account_id: string | null
          bank_account_id: string | null
          cost_center_id: string | null
          created_at: string
          description: string
          discount_amount: number | null
          document_number: string | null
          due_date: string
          id: string
          interest_amount: number | null
          invoice_number: string | null
          issue_date: string
          notes: string | null
          original_amount: number
          paid_amount: number | null
          payment_date: string | null
          remaining_amount: number
          source_id: string | null
          source_type: string | null
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          bank_account_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description: string
          discount_amount?: number | null
          document_number?: string | null
          due_date: string
          id?: string
          interest_amount?: number | null
          invoice_number?: string | null
          issue_date: string
          notes?: string | null
          original_amount: number
          paid_amount?: number | null
          payment_date?: string | null
          remaining_amount: number
          source_id?: string | null
          source_type?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          bank_account_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string
          discount_amount?: number | null
          document_number?: string | null
          due_date?: string
          id?: string
          interest_amount?: number | null
          invoice_number?: string | null
          issue_date?: string
          notes?: string | null
          original_amount?: number
          paid_amount?: number | null
          payment_date?: string | null
          remaining_amount?: number
          source_id?: string | null
          source_type?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          account_id: string | null
          bank_account_id: string | null
          client_id: string | null
          cost_center_id: string | null
          created_at: string
          description: string
          discount_amount: number | null
          document_number: string | null
          due_date: string
          id: string
          interest_amount: number | null
          invoice_number: string | null
          issue_date: string
          notes: string | null
          original_amount: number
          proposal_id: string | null
          receipt_date: string | null
          received_amount: number | null
          remaining_amount: number
          source_id: string | null
          source_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          bank_account_id?: string | null
          client_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description: string
          discount_amount?: number | null
          document_number?: string | null
          due_date: string
          id?: string
          interest_amount?: number | null
          invoice_number?: string | null
          issue_date: string
          notes?: string | null
          original_amount: number
          proposal_id?: string | null
          receipt_date?: string | null
          received_amount?: number | null
          remaining_amount: number
          source_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          bank_account_id?: string | null
          client_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string
          discount_amount?: number | null
          document_number?: string | null
          due_date?: string
          id?: string
          interest_amount?: number | null
          invoice_number?: string | null
          issue_date?: string
          notes?: string | null
          original_amount?: number
          proposal_id?: string | null
          receipt_date?: string | null
          received_amount?: number | null
          remaining_amount?: number
          source_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      app_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          flag_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      auth_attempts: {
        Row: {
          attempt_type: string
          created_at: string
          email: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          attempt_type: string
          created_at?: string
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          attempt_type?: string
          created_at?: string
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          agency_number: string | null
          bank_name: string
          created_at: string
          current_balance: number
          id: string
          initial_balance: number
          is_active: boolean
          is_default: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          agency_number?: string | null
          bank_name: string
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_active?: boolean
          is_default?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          agency_number?: string | null
          bank_name?: string
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_active?: boolean
          is_default?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bank_reconciliations: {
        Row: {
          bank_account_id: string
          created_at: string
          difference: number
          id: string
          notes: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          reconciliation_date: string
          statement_balance: number
          status: string
          system_balance: number
        }
        Insert: {
          bank_account_id: string
          created_at?: string
          difference?: number
          id?: string
          notes?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_date: string
          statement_balance: number
          status?: string
          system_balance: number
        }
        Update: {
          bank_account_id?: string
          created_at?: string
          difference?: number
          id?: string
          notes?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          reconciliation_date?: string
          statement_balance?: number
          status?: string
          system_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_cost_alerts: {
        Row: {
          alert_type: string
          bom_id: string
          bom_type: string
          change_percent: number | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          new_cost: number | null
          old_cost: number | null
          read_at: string | null
          read_by: string | null
          severity: string
          threshold_percent: number | null
          triggered_by_material_id: string | null
        }
        Insert: {
          alert_type: string
          bom_id: string
          bom_type: string
          change_percent?: number | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          new_cost?: number | null
          old_cost?: number | null
          read_at?: string | null
          read_by?: string | null
          severity: string
          threshold_percent?: number | null
          triggered_by_material_id?: string | null
        }
        Update: {
          alert_type?: string
          bom_id?: string
          bom_type?: string
          change_percent?: number | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          new_cost?: number | null
          old_cost?: number | null
          read_at?: string | null
          read_by?: string | null
          severity?: string
          threshold_percent?: number | null
          triggered_by_material_id?: string | null
        }
        Relationships: []
      }
      bom_cost_history: {
        Row: {
          bom_id: string
          bom_type: string
          change_reason: string | null
          cost_change_absolute: number | null
          cost_change_percent: number | null
          created_at: string
          created_by: string | null
          id: string
          new_total_cost: number | null
          old_total_cost: number | null
          triggered_by_material_id: string | null
        }
        Insert: {
          bom_id: string
          bom_type: string
          change_reason?: string | null
          cost_change_absolute?: number | null
          cost_change_percent?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          new_total_cost?: number | null
          old_total_cost?: number | null
          triggered_by_material_id?: string | null
        }
        Update: {
          bom_id?: string
          bom_type?: string
          change_reason?: string | null
          cost_change_absolute?: number | null
          cost_change_percent?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          new_total_cost?: number | null
          old_total_cost?: number | null
          triggered_by_material_id?: string | null
        }
        Relationships: []
      }
      bom_production_consolidated_materials: {
        Row: {
          consumed_quantity: number | null
          created_at: string | null
          id: string
          is_consumed: boolean | null
          is_reserved: boolean | null
          material_id: string
          production_order_id: string
          reserved_quantity: number | null
          total_cost: number | null
          total_quantity: number
          unit: string
          used_in_boms: Json | null
        }
        Insert: {
          consumed_quantity?: number | null
          created_at?: string | null
          id?: string
          is_consumed?: boolean | null
          is_reserved?: boolean | null
          material_id: string
          production_order_id: string
          reserved_quantity?: number | null
          total_cost?: number | null
          total_quantity: number
          unit: string
          used_in_boms?: Json | null
        }
        Update: {
          consumed_quantity?: number | null
          created_at?: string | null
          id?: string
          is_consumed?: boolean | null
          is_reserved?: boolean | null
          material_id?: string
          production_order_id?: string
          reserved_quantity?: number | null
          total_cost?: number | null
          total_quantity?: number
          unit?: string
          used_in_boms?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_production_consolidated_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_production_consolidated_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "bom_production_consolidated_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "bom_production_consolidated_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "bom_production_consolidated_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "bom_production_consolidated_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "bom_production_consolidated_materials_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "bom_production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_production_order_items: {
        Row: {
          bom_id: string
          created_at: string | null
          id: string
          item_cost: number | null
          multiplier: number
          position: number
          production_order_id: string
          quantity: number
          total_yield_quantity: number
          yield_unit: string
        }
        Insert: {
          bom_id: string
          created_at?: string | null
          id?: string
          item_cost?: number | null
          multiplier?: number
          position?: number
          production_order_id: string
          quantity?: number
          total_yield_quantity: number
          yield_unit: string
        }
        Update: {
          bom_id?: string
          created_at?: string | null
          id?: string
          item_cost?: number | null
          multiplier?: number
          position?: number
          production_order_id?: string
          quantity?: number
          total_yield_quantity?: number
          yield_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_production_order_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "recipes_bom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_production_order_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "vw_diag_bom_inconsistencies"
            referencedColumns: ["bom_id"]
          },
          {
            foreignKeyName: "bom_production_order_items_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "bom_production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_production_orders: {
        Row: {
          completed_at: string | null
          cost_status: string | null
          created_at: string | null
          created_by: string | null
          id: string
          missing_cost_items: Json | null
          notes: string | null
          order_date: string
          order_name: string
          started_at: string | null
          status: string
          total_cost: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          cost_status?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          missing_cost_items?: Json | null
          notes?: string | null
          order_date: string
          order_name: string
          started_at?: string | null
          status?: string
          total_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          cost_status?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          missing_cost_items?: Json | null
          notes?: string | null
          order_date?: string
          order_name?: string
          started_at?: string | null
          status?: string
          total_cost?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bom_production_stock_movements: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          material_id: string
          movement_type: string
          notes: string | null
          production_order_id: string
          quantity: number
          reference_id: string | null
          reference_table: string | null
          unit: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          material_id: string
          movement_type: string
          notes?: string | null
          production_order_id: string
          quantity: number
          reference_id?: string | null
          reference_table?: string | null
          unit: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          material_id?: string
          movement_type?: string
          notes?: string | null
          production_order_id?: string
          quantity?: number
          reference_id?: string | null
          reference_table?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_production_stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_production_stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "bom_production_stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "bom_production_stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "bom_production_stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "bom_production_stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "bom_production_stock_movements_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "bom_production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          account_id: string | null
          amount: number
          bank_account: string | null
          bank_account_id: string | null
          category: string
          cost_center_id: string | null
          created_at: string
          description: string
          document_number: string | null
          id: string
          notes: string | null
          payment_method: string
          reference_id: string | null
          reference_type: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          bank_account?: string | null
          bank_account_id?: string | null
          category: string
          cost_center_id?: string | null
          created_at?: string
          description: string
          document_number?: string | null
          id?: string
          notes?: string | null
          payment_method: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          bank_account?: string | null
          bank_account_id?: string | null
          category?: string
          cost_center_id?: string | null
          created_at?: string
          description?: string
          document_number?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          level: number
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: number
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          client_id: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          client_id: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          client_id?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          department_id: string | null
          email: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          department_id?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          department_id?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "client_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      client_departments: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_departments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_rooms: {
        Row: {
          capacity: number | null
          client_id: string
          created_at: string
          floor: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          client_id: string
          created_at?: string
          floor?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          client_id?: string
          created_at?: string
          floor?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_rooms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_rooms_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "client_units"
            referencedColumns: ["id"]
          },
        ]
      }
      client_units: {
        Row: {
          address: string | null
          city: string | null
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_units_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          cnpj_cpf: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          status: string
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj_cpf?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj_cpf?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      composite_bom_items: {
        Row: {
          component_material_id: string
          composite_id: string
          id: string
          position: number
          quantity: number
          unit: string
        }
        Insert: {
          component_material_id: string
          composite_id: string
          id?: string
          position?: number
          quantity: number
          unit: string
        }
        Update: {
          component_material_id?: string
          composite_id?: string
          id?: string
          position?: number
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "composite_bom_items_component_material_id_fkey"
            columns: ["component_material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composite_bom_items_component_material_id_fkey"
            columns: ["component_material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "composite_bom_items_component_material_id_fkey"
            columns: ["component_material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "composite_bom_items_component_material_id_fkey"
            columns: ["component_material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "composite_bom_items_component_material_id_fkey"
            columns: ["component_material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "composite_bom_items_component_material_id_fkey"
            columns: ["component_material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "composite_bom_items_composite_id_fkey"
            columns: ["composite_id"]
            isOneToOne: false
            referencedRelation: "composites_bom"
            referencedColumns: ["id"]
          },
        ]
      }
      composites_bom: {
        Row: {
          cached_total_cost: number | null
          composite_material_id: string
          cost_last_calculated_at: string | null
          cost_status: string | null
          created_at: string | null
          id: string
          is_archived: boolean | null
          missing_cost_items: Json | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          cached_total_cost?: number | null
          composite_material_id: string
          cost_last_calculated_at?: string | null
          cost_status?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          missing_cost_items?: Json | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          cached_total_cost?: number | null
          composite_material_id?: string
          cost_last_calculated_at?: string | null
          cost_status?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          missing_cost_items?: Json | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "composites_bom_composite_material_id_fkey"
            columns: ["composite_material_id"]
            isOneToOne: true
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composites_bom_composite_material_id_fkey"
            columns: ["composite_material_id"]
            isOneToOne: true
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "composites_bom_composite_material_id_fkey"
            columns: ["composite_material_id"]
            isOneToOne: true
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "composites_bom_composite_material_id_fkey"
            columns: ["composite_material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "composites_bom_composite_material_id_fkey"
            columns: ["composite_material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "composites_bom_composite_material_id_fkey"
            columns: ["composite_material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
        ]
      }
      config_namespaces: {
        Row: {
          created_at: string | null
          id: string
          key: string
          label: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          label: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      config_options: {
        Row: {
          created_at: string | null
          default_value: Json | null
          description: string | null
          id: string
          key: string
          namespace_id: string
          value_type: string
        }
        Insert: {
          created_at?: string | null
          default_value?: Json | null
          description?: string | null
          id?: string
          key: string
          namespace_id: string
          value_type: string
        }
        Update: {
          created_at?: string | null
          default_value?: Json | null
          description?: string | null
          id?: string
          key?: string
          namespace_id?: string
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_options_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "config_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      config_values: {
        Row: {
          id: string
          key: string
          namespace_id: string
          updated_at: string | null
          updated_by: string | null
          value_jsonb: Json
        }
        Insert: {
          id?: string
          key: string
          namespace_id: string
          updated_at?: string | null
          updated_by?: string | null
          value_jsonb: Json
        }
        Update: {
          id?: string
          key?: string
          namespace_id?: string
          updated_at?: string | null
          updated_by?: string | null
          value_jsonb?: Json
        }
        Relationships: [
          {
            foreignKeyName: "config_values_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "config_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_profile_mix: {
        Row: {
          category_label: string
          created_at: string
          id: string
          percent: number
          profile_id: string
        }
        Insert: {
          category_label: string
          created_at?: string
          id?: string
          percent: number
          profile_id: string
        }
        Update: {
          category_label?: string
          created_at?: string
          id?: string
          percent?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumption_profile_mix_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "consumption_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_profiles: {
        Row: {
          created_at: string
          grams_per_person: number
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          grams_per_person?: number
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          grams_per_person?: number
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cost_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_reason: string
          adjustment_time: string
          cost_difference: number | null
          created_at: string
          current_quantity: number
          id: string
          material_id: string
          new_total_value: number | null
          new_unit_cost: number
          notes: string | null
          old_total_value: number | null
          old_unit_cost: number
          reference_document: string | null
          responsible_user_id: string | null
          updated_at: string
        }
        Insert: {
          adjustment_date?: string
          adjustment_reason: string
          adjustment_time?: string
          cost_difference?: number | null
          created_at?: string
          current_quantity: number
          id?: string
          material_id: string
          new_total_value?: number | null
          new_unit_cost: number
          notes?: string | null
          old_total_value?: number | null
          old_unit_cost: number
          reference_document?: string | null
          responsible_user_id?: string | null
          updated_at?: string
        }
        Update: {
          adjustment_date?: string
          adjustment_reason?: string
          adjustment_time?: string
          cost_difference?: number | null
          created_at?: string
          current_quantity?: number
          id?: string
          material_id?: string
          new_total_value?: number | null
          new_unit_cost?: number
          notes?: string | null
          old_total_value?: number | null
          old_unit_cost?: number
          reference_document?: string | null
          responsible_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_info: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          salary: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          salary?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          salary?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_salary_info_employee_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_info_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          account_type: string | null
          address: string | null
          bank_account: string | null
          bank_branch: string | null
          bank_name: string | null
          benefits: string[] | null
          birth_date: string | null
          city: string | null
          cpf: string | null
          created_at: string
          ctps_number: string | null
          ctps_series: string | null
          department: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_number: string
          employment_type: string
          full_name: string
          gender: string | null
          hire_date: string
          id: string
          marital_status: string | null
          military_service: string | null
          mobile_phone: string | null
          notes: string | null
          phone: string | null
          pis_pasep: string | null
          position: string
          rg: string | null
          state: string | null
          status: string
          termination_date: string | null
          updated_at: string
          voter_registration: string | null
          work_schedule_id: string | null
          zip_code: string | null
        }
        Insert: {
          account_type?: string | null
          address?: string | null
          bank_account?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          benefits?: string[] | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          ctps_number?: string | null
          ctps_series?: string | null
          department: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_number: string
          employment_type?: string
          full_name: string
          gender?: string | null
          hire_date: string
          id?: string
          marital_status?: string | null
          military_service?: string | null
          mobile_phone?: string | null
          notes?: string | null
          phone?: string | null
          pis_pasep?: string | null
          position: string
          rg?: string | null
          state?: string | null
          status?: string
          termination_date?: string | null
          updated_at?: string
          voter_registration?: string | null
          work_schedule_id?: string | null
          zip_code?: string | null
        }
        Update: {
          account_type?: string | null
          address?: string | null
          bank_account?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          benefits?: string[] | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          ctps_number?: string | null
          ctps_series?: string | null
          department?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_number?: string
          employment_type?: string
          full_name?: string
          gender?: string | null
          hire_date?: string
          id?: string
          marital_status?: string | null
          military_service?: string | null
          mobile_phone?: string | null
          notes?: string | null
          phone?: string | null
          pis_pasep?: string | null
          position?: string
          rg?: string | null
          state?: string | null
          status?: string
          termination_date?: string | null
          updated_at?: string
          voter_registration?: string | null
          work_schedule_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_work_schedule_id_fkey"
            columns: ["work_schedule_id"]
            isOneToOne: false
            referencedRelation: "work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attachments: {
        Row: {
          attachment_type: string
          description: string | null
          event_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          attachment_type: string
          description?: string | null
          event_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          attachment_type?: string
          description?: string | null
          event_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_category_standards: {
        Row: {
          created_at: string
          event_category: Database["public"]["Enums"]["event_category"]
          id: string
          max_percentage: number | null
          min_percentage: number | null
          notes: string | null
          product_category: Database["public"]["Enums"]["product_category"]
          recommended_percentage: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_category: Database["public"]["Enums"]["event_category"]
          id?: string
          max_percentage?: number | null
          min_percentage?: number | null
          notes?: string | null
          product_category: Database["public"]["Enums"]["product_category"]
          recommended_percentage?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_category?: Database["public"]["Enums"]["event_category"]
          id?: string
          max_percentage?: number | null
          min_percentage?: number | null
          notes?: string | null
          product_category?: Database["public"]["Enums"]["product_category"]
          recommended_percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_checklist: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          due_date: string
          event_id: string
          id: string
          is_completed: boolean
          notes: string | null
          priority_level: string
          responsible_person: string | null
          task_name: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          event_id: string
          id?: string
          is_completed?: boolean
          notes?: string | null
          priority_level?: string
          responsible_person?: string | null
          task_name: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          event_id?: string
          id?: string
          is_completed?: boolean
          notes?: string | null
          priority_level?: string
          responsible_person?: string | null
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checklist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_notifications: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_sent: boolean
          message: string
          notification_method: string
          notification_type: string
          sent_at: string | null
          trigger_date: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_sent?: boolean
          message: string
          notification_method?: string
          notification_type: string
          sent_at?: string | null
          trigger_date: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_sent?: boolean
          message?: string
          notification_method?: string
          notification_type?: string
          sent_at?: string | null
          trigger_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_production_order_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          material_id: string
          order_id: string
          planned_qty: number
          planned_unit: string
          position: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          material_id: string
          order_id: string
          planned_qty: number
          planned_unit: string
          position?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          material_id?: string
          order_id?: string
          planned_qty?: number
          planned_unit?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_production_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_production_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_production_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_production_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_production_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_production_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_production_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "event_production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      event_production_orders: {
        Row: {
          created_at: string
          event_table_id: string
          id: string
          notes: string | null
          order_code: string
          scheduled_end: string | null
          scheduled_start: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_table_id: string
          id?: string
          notes?: string | null
          order_code: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_table_id?: string
          id?: string
          notes?: string | null
          order_code?: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_production_orders_event_table_id_fkey"
            columns: ["event_table_id"]
            isOneToOne: false
            referencedRelation: "event_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sessions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          notes: string | null
          quantity: number
          session_date: string
          session_time: string | null
          session_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          quantity?: number
          session_date: string
          session_time?: string | null
          session_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          quantity?: number
          session_date?: string
          session_time?: string | null
          session_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_table_items: {
        Row: {
          category_label: string
          created_at: string
          event_table_id: string
          fixed_quantity: number | null
          id: string
          material_id: string
          position: number
          quantity_per_person: number | null
          source: string
          unit_override: string | null
        }
        Insert: {
          category_label: string
          created_at?: string
          event_table_id: string
          fixed_quantity?: number | null
          id?: string
          material_id: string
          position?: number
          quantity_per_person?: number | null
          source?: string
          unit_override?: string | null
        }
        Update: {
          category_label?: string
          created_at?: string
          event_table_id?: string
          fixed_quantity?: number | null
          id?: string
          material_id?: string
          position?: number
          quantity_per_person?: number | null
          source?: string
          unit_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_table_items_event_table_id_fkey"
            columns: ["event_table_id"]
            isOneToOne: false
            referencedRelation: "event_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_table_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_table_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_table_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_table_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_table_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_table_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
        ]
      }
      event_table_template_items: {
        Row: {
          category_label: string
          created_at: string
          fixed_quantity: number | null
          id: string
          material_id: string
          position: number
          quantity_per_person: number | null
          template_id: string
          unit_override: string | null
        }
        Insert: {
          category_label: string
          created_at?: string
          fixed_quantity?: number | null
          id?: string
          material_id: string
          position?: number
          quantity_per_person?: number | null
          template_id: string
          unit_override?: string | null
        }
        Update: {
          category_label?: string
          created_at?: string
          fixed_quantity?: number | null
          id?: string
          material_id?: string
          position?: number
          quantity_per_person?: number | null
          template_id?: string
          unit_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_table_template_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_table_template_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_table_template_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_table_template_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_table_template_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_table_template_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "event_table_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "event_table_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      event_table_templates: {
        Row: {
          created_at: string
          default_profile_id: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_profile_id?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_profile_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_table_templates_default_profile_id_fkey"
            columns: ["default_profile_id"]
            isOneToOne: false
            referencedRelation: "consumption_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tables: {
        Row: {
          attendees: number
          client_id: string | null
          client_name: string
          contact_id: string | null
          created_at: string
          date_end: string | null
          date_start: string
          department_id: string | null
          event_code: string
          id: string
          notes: string | null
          profile_id: string | null
          room_id: string | null
          status: string
          template_id: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          attendees: number
          client_id?: string | null
          client_name: string
          contact_id?: string | null
          created_at?: string
          date_end?: string | null
          date_start: string
          department_id?: string | null
          event_code: string
          id?: string
          notes?: string | null
          profile_id?: string | null
          room_id?: string | null
          status?: string
          template_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          attendees?: number
          client_id?: string | null
          client_name?: string
          contact_id?: string | null
          created_at?: string
          date_end?: string | null
          date_start?: string
          department_id?: string | null
          event_code?: string
          id?: string
          notes?: string | null
          profile_id?: string | null
          room_id?: string | null
          status?: string
          template_id?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tables_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tables_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "client_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tables_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "consumption_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tables_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "client_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tables_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "event_table_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tables_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "client_units"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_id: string
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          event_date: string
          event_duration: number | null
          event_name: string
          id: string
          proposal_id: string | null
          setup_notes: string | null
          setup_time: string | null
          special_requirements: string | null
          status: string
          total_amount: number
          total_people: number
          total_weight: number
          updated_at: string
          venue: string | null
        }
        Insert: {
          client_id: string
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          event_date: string
          event_duration?: number | null
          event_name: string
          id?: string
          proposal_id?: string | null
          setup_notes?: string | null
          setup_time?: string | null
          special_requirements?: string | null
          status?: string
          total_amount?: number
          total_people: number
          total_weight?: number
          updated_at?: string
          venue?: string | null
        }
        Update: {
          client_id?: string
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          event_date?: string
          event_duration?: number | null
          event_name?: string
          id?: string
          proposal_id?: string | null
          setup_notes?: string | null
          setup_time?: string | null
          special_requirements?: string | null
          status?: string
          total_amount?: number
          total_people?: number
          total_weight?: number
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_alerts: {
        Row: {
          alert_type: string
          created_at: string
          due_date: string | null
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          read_by: string | null
          reference_id: string
          reference_type: string
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          read_by?: string | null
          reference_id: string
          reference_type: string
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          due_date?: string | null
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          read_by?: string | null
          reference_id?: string
          reference_type?: string
          severity?: string
          title?: string
        }
        Relationships: []
      }
      financial_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          permission_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          permission_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          permission_type?: string
          user_id?: string
        }
        Relationships: []
      }
      hr_permissions: {
        Row: {
          created_at: string | null
          granted_by: string | null
          id: string
          permission_type: Database["public"]["Enums"]["hr_permission_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          permission_type: Database["public"]["Enums"]["hr_permission_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          permission_type?: Database["public"]["Enums"]["hr_permission_type"]
          user_id?: string
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_reason: string
          adjustment_time: string
          created_at: string
          cycle_id: string | null
          id: string
          is_draft: boolean
          material_id: string
          notes: string | null
          physical_quantity: number
          quantity_difference: number | null
          reference_document: string | null
          responsible_user_id: string | null
          system_quantity: number
          updated_at: string
        }
        Insert: {
          adjustment_date?: string
          adjustment_reason: string
          adjustment_time?: string
          created_at?: string
          cycle_id?: string | null
          id?: string
          is_draft?: boolean
          material_id: string
          notes?: string | null
          physical_quantity: number
          quantity_difference?: number | null
          reference_document?: string | null
          responsible_user_id?: string | null
          system_quantity?: number
          updated_at?: string
        }
        Update: {
          adjustment_date?: string
          adjustment_reason?: string
          adjustment_time?: string
          created_at?: string
          cycle_id?: string | null
          id?: string
          is_draft?: boolean
          material_id?: string
          notes?: string | null
          physical_quantity?: number
          quantity_difference?: number | null
          reference_document?: string | null
          responsible_user_id?: string | null
          system_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "inventory_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_cycles: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          final_price: number | null
          id: string
          invoice_id: string
          material_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          final_price?: number | null
          id?: string
          invoice_id: string
          material_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          final_price?: number | null
          id?: string
          invoice_id?: string
          material_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_items_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_items_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_items_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_items_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_material_matches: {
        Row: {
          created_at: string
          id: string
          invoice_item_name: string
          invoice_item_name_normalized: string
          last_matched_at: string
          match_count: number
          material_id: string
          supplier_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_item_name: string
          invoice_item_name_normalized: string
          last_matched_at?: string
          match_count?: number
          material_id: string
          supplier_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_item_name?: string
          invoice_item_name_normalized?: string
          last_matched_at?: string
          match_count?: number
          material_id?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_material_matches_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_material_matches_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_material_matches_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_material_matches_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_material_matches_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_material_matches_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_material_matches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_ocr_items: {
        Row: {
          conversion_factor: number | null
          converted_quantity: number | null
          converted_unit_price: number | null
          created_at: string | null
          id: string
          item_description: string
          launch_error: string | null
          launched_at: string | null
          match_confidence: number | null
          match_method: string | null
          matched_material_id: string | null
          quantity: number
          session_id: string
          status: string | null
          stock_movement_id: string | null
          suggested_material_id: string | null
          total_price: number
          unit: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          conversion_factor?: number | null
          converted_quantity?: number | null
          converted_unit_price?: number | null
          created_at?: string | null
          id?: string
          item_description: string
          launch_error?: string | null
          launched_at?: string | null
          match_confidence?: number | null
          match_method?: string | null
          matched_material_id?: string | null
          quantity: number
          session_id: string
          status?: string | null
          stock_movement_id?: string | null
          suggested_material_id?: string | null
          total_price: number
          unit?: string | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          conversion_factor?: number | null
          converted_quantity?: number | null
          converted_unit_price?: number | null
          created_at?: string | null
          id?: string
          item_description?: string
          launch_error?: string | null
          launched_at?: string | null
          match_confidence?: number | null
          match_method?: string | null
          matched_material_id?: string | null
          quantity?: number
          session_id?: string
          status?: string | null
          stock_movement_id?: string | null
          suggested_material_id?: string | null
          total_price?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_ocr_items_matched_material_id_fkey"
            columns: ["matched_material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_matched_material_id_fkey"
            columns: ["matched_material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_matched_material_id_fkey"
            columns: ["matched_material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_matched_material_id_fkey"
            columns: ["matched_material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_matched_material_id_fkey"
            columns: ["matched_material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_matched_material_id_fkey"
            columns: ["matched_material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "invoice_ocr_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_stock_movement_id_fkey"
            columns: ["stock_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_suggested_material_id_fkey"
            columns: ["suggested_material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_suggested_material_id_fkey"
            columns: ["suggested_material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_suggested_material_id_fkey"
            columns: ["suggested_material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_suggested_material_id_fkey"
            columns: ["suggested_material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_suggested_material_id_fkey"
            columns: ["suggested_material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "invoice_ocr_items_suggested_material_id_fkey"
            columns: ["suggested_material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
        ]
      }
      invoice_ocr_sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          extracted_data: Json | null
          extraction_error: string | null
          extraction_status: string | null
          id: string
          image_size_bytes: number | null
          image_url: string
          ocr_confidence: number | null
          ocr_processing_time_ms: number | null
          ocr_provider: string
          ocr_raw_text: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          extracted_data?: Json | null
          extraction_error?: string | null
          extraction_status?: string | null
          id?: string
          image_size_bytes?: number | null
          image_url: string
          ocr_confidence?: number | null
          ocr_processing_time_ms?: number | null
          ocr_provider?: string
          ocr_raw_text?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          extracted_data?: Json | null
          extraction_error?: string | null
          extraction_status?: string | null
          id?: string
          image_size_bytes?: number | null
          image_url?: string
          ocr_confidence?: number | null
          ocr_processing_time_ms?: number | null
          ocr_provider?: string
          ocr_raw_text?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      invoice_supplier_matches: {
        Row: {
          created_at: string
          id: string
          invoice_supplier_text: string
          invoice_supplier_text_normalized: string
          last_matched_at: string
          match_count: number
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_supplier_text: string
          invoice_supplier_text_normalized: string
          last_matched_at?: string
          match_count?: number
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_supplier_text?: string
          invoice_supplier_text_normalized?: string
          last_matched_at?: string
          match_count?: number
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_supplier_matches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_name_mappings: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          invoice_description: string
          last_used_at: string | null
          material_id: string
          supplier_name: string | null
          times_used: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_description: string
          last_used_at?: string | null
          material_id: string
          supplier_name?: string | null
          times_used?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_description?: string
          last_used_at?: string | null
          material_id?: string
          supplier_name?: string | null
          times_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_name_mappings_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_name_mappings_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_name_mappings_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_name_mappings_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_name_mappings_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_name_mappings_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
        ]
      }
      materials: {
        Row: {
          allowed_brands: string[] | null
          category: string
          category_term_id: string | null
          cfop_padrao: string | null
          code: string | null
          conversion_factor: number
          cost_price: number | null
          created_at: string | null
          cst_csosn: string | null
          density_g_per_ml: number | null
          description: string | null
          id: string
          is_archived: boolean | null
          is_sellable: boolean | null
          is_system_generated: boolean | null
          material_type: string
          name: string
          ncm: string | null
          origem: number | null
          price_per_purchase_unit: number
          purchase_unit: string
          subcategory: string | null
          subcategory_term_id: string | null
          supplier: string | null
          supplier_id: string | null
          unit_weight: number | null
          updated_at: string | null
          usage_unit: string
        }
        Insert: {
          allowed_brands?: string[] | null
          category?: string
          category_term_id?: string | null
          cfop_padrao?: string | null
          code?: string | null
          conversion_factor?: number
          cost_price?: number | null
          created_at?: string | null
          cst_csosn?: string | null
          density_g_per_ml?: number | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_sellable?: boolean | null
          is_system_generated?: boolean | null
          material_type?: string
          name: string
          ncm?: string | null
          origem?: number | null
          price_per_purchase_unit: number
          purchase_unit: string
          subcategory?: string | null
          subcategory_term_id?: string | null
          supplier?: string | null
          supplier_id?: string | null
          unit_weight?: number | null
          updated_at?: string | null
          usage_unit: string
        }
        Update: {
          allowed_brands?: string[] | null
          category?: string
          category_term_id?: string | null
          cfop_padrao?: string | null
          code?: string | null
          conversion_factor?: number
          cost_price?: number | null
          created_at?: string | null
          cst_csosn?: string | null
          density_g_per_ml?: number | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_sellable?: boolean | null
          is_system_generated?: boolean | null
          material_type?: string
          name?: string
          ncm?: string | null
          origem?: number | null
          price_per_purchase_unit?: number
          purchase_unit?: string
          subcategory?: string | null
          subcategory_term_id?: string | null
          supplier?: string | null
          supplier_id?: string | null
          unit_weight?: number | null
          updated_at?: string | null
          usage_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_category_term_id_fkey"
            columns: ["category_term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_subcategory_term_id_fkey"
            columns: ["subcategory_term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_settings: {
        Row: {
          backup_codes: string[] | null
          created_at: string
          disabled_at: string | null
          enabled_at: string | null
          id: string
          is_enabled: boolean
          last_used_at: string | null
          recovery_email: string | null
          totp_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_codes?: string[] | null
          created_at?: string
          disabled_at?: string | null
          enabled_at?: string | null
          id?: string
          is_enabled?: boolean
          last_used_at?: string | null
          recovery_email?: string | null
          totp_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_codes?: string[] | null
          created_at?: string
          disabled_at?: string | null
          enabled_at?: string | null
          id?: string
          is_enabled?: boolean
          last_used_at?: string | null
          recovery_email?: string | null
          totp_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ops_bom_audit_log: {
        Row: {
          action: string
          at: string | null
          created_at: string | null
          detail: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          at?: string | null
          created_at?: string | null
          detail?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          at?: string | null
          created_at?: string | null
          detail?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ops_config_audit_log: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          entity: string
          entity_id: string
          id: string
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity: string
          entity_id: string
          id?: string
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          entity?: string
          entity_id?: string
          id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          account_payable_id: string
          amount: number
          bank_account: string | null
          created_at: string
          document_number: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
        }
        Insert: {
          account_payable_id: string
          amount: number
          bank_account?: string | null
          created_at?: string
          document_number?: string | null
          id?: string
          notes?: string | null
          payment_date: string
          payment_method: string
        }
        Update: {
          account_payable_id?: string
          amount?: number
          bank_account?: string | null
          created_at?: string
          document_number?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_account_payable_id_fkey"
            columns: ["account_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
        ]
      }
      pii_access_anomalies: {
        Row: {
          anomaly_type: string
          created_at: string
          details: Json
          detection_time: string
          id: string
          investigated_at: string | null
          investigated_by: string | null
          investigation_notes: string | null
          ip_address: string | null
          is_investigated: boolean | null
          resource_count: number | null
          resource_type: string
          severity: string
          time_window_minutes: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          anomaly_type: string
          created_at?: string
          details?: Json
          detection_time?: string
          id?: string
          investigated_at?: string | null
          investigated_by?: string | null
          investigation_notes?: string | null
          ip_address?: string | null
          is_investigated?: boolean | null
          resource_count?: number | null
          resource_type: string
          severity?: string
          time_window_minutes?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          anomaly_type?: string
          created_at?: string
          details?: Json
          detection_time?: string
          id?: string
          investigated_at?: string | null
          investigated_by?: string | null
          investigation_notes?: string | null
          ip_address?: string | null
          is_investigated?: boolean | null
          resource_count?: number | null
          resource_type?: string
          severity?: string
          time_window_minutes?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pii_access_log: {
        Row: {
          access_type: string
          accessed_fields: Database["public"]["Enums"]["pii_field_type"][]
          accessed_record_id: string
          accessed_table: string
          created_at: string | null
          id: string
          ip_address: string | null
          justification: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          access_type: string
          accessed_fields: Database["public"]["Enums"]["pii_field_type"][]
          accessed_record_id: string
          accessed_table: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          justification?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          access_type?: string
          accessed_fields?: Database["public"]["Enums"]["pii_field_type"][]
          accessed_record_id?: string
          accessed_table?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          justification?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      production_stock_validations: {
        Row: {
          id: string
          missing_materials: Json | null
          production_order_id: string
          production_order_type: string
          validated_at: string
          validated_by: string | null
          validation_status: string
        }
        Insert: {
          id?: string
          missing_materials?: Json | null
          production_order_id: string
          production_order_type: string
          validated_at?: string
          validated_by?: string | null
          validation_status: string
        }
        Update: {
          id?: string
          missing_materials?: Json | null
          production_order_id?: string
          production_order_type?: string
          validated_at?: string
          validated_by?: string | null
          validation_status?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          code: string
          cost_price: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          profit_margin: number | null
          recipe_id: string | null
          selling_price: number
          unit_weight: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          profit_margin?: number | null
          recipe_id?: string | null
          selling_price?: number
          unit_weight?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          profit_margin?: number | null
          recipe_id?: string | null
          selling_price?: number
          unit_weight?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_categories: {
        Row: {
          category_label: string
          created_at: string | null
          id: string
          proposal_id: string
          sort_order: number | null
        }
        Insert: {
          category_label: string
          created_at?: string | null
          id?: string
          proposal_id: string
          sort_order?: number | null
        }
        Update: {
          category_label?: string
          created_at?: string | null
          id?: string
          proposal_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_categories_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_category_items: {
        Row: {
          category_id: string
          created_at: string | null
          fixed_qty: number | null
          id: string
          item_kind: string
          material_id: string
          qty_per_person: number | null
          unit_override: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          fixed_qty?: number | null
          id?: string
          item_kind: string
          material_id: string
          qty_per_person?: number | null
          unit_override?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          fixed_qty?: number | null
          id?: string
          item_kind?: string
          material_id?: string
          qty_per_person?: number | null
          unit_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_category_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "proposal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_category_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "proposal_category_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_category_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "proposal_category_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "proposal_category_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "proposal_category_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "proposal_category_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          proposal_id: string
          quantity: number
          total_price: number | null
          total_weight: number | null
          unit_price: number
          unit_weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          proposal_id: string
          quantity: number
          total_price?: number | null
          total_weight?: number | null
          unit_price: number
          unit_weight: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          proposal_id?: string
          quantity?: number
          total_price?: number | null
          total_weight?: number | null
          unit_price?: number
          unit_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_picklist_items: {
        Row: {
          created_at: string | null
          id: string
          item_kind: string
          material_id: string
          picklist_id: string
          planned_qty: number
          planned_unit: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_kind: string
          material_id: string
          picklist_id: string
          planned_qty: number
          planned_unit: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_kind?: string
          material_id?: string
          picklist_id?: string
          planned_qty?: number
          planned_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_picklist_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_picklist_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "proposal_picklist_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "proposal_picklist_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "proposal_picklist_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "proposal_picklist_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "proposal_picklist_items_picklist_id_fkey"
            columns: ["picklist_id"]
            isOneToOne: false
            referencedRelation: "proposal_picklists"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_picklists: {
        Row: {
          created_at: string | null
          fulfilled_at: string | null
          fulfilled_by: string | null
          id: string
          notes: string | null
          proposal_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          notes?: string | null
          proposal_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          notes?: string | null
          proposal_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_picklists_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          auto_generated_bom_order_id: string | null
          auto_generated_event_id: string | null
          auto_generated_event_table_id: string | null
          client_id: string
          contact_id: string | null
          created_at: string
          department_id: string | null
          event_category: string | null
          event_date: string | null
          id: string
          notes: string | null
          number_of_people: number
          parent_proposal_id: string | null
          products_selected: boolean | null
          proposal_date: string
          proposal_kind: string | null
          proposal_number: string
          room_id: string | null
          status: string
          target_weight_per_person: number
          total_amount: number
          total_target_weight: number | null
          total_weight: number
          unit_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          auto_generated_bom_order_id?: string | null
          auto_generated_event_id?: string | null
          auto_generated_event_table_id?: string | null
          client_id: string
          contact_id?: string | null
          created_at?: string
          department_id?: string | null
          event_category?: string | null
          event_date?: string | null
          id?: string
          notes?: string | null
          number_of_people: number
          parent_proposal_id?: string | null
          products_selected?: boolean | null
          proposal_date?: string
          proposal_kind?: string | null
          proposal_number: string
          room_id?: string | null
          status?: string
          target_weight_per_person?: number
          total_amount?: number
          total_target_weight?: number | null
          total_weight?: number
          unit_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          auto_generated_bom_order_id?: string | null
          auto_generated_event_id?: string | null
          auto_generated_event_table_id?: string | null
          client_id?: string
          contact_id?: string | null
          created_at?: string
          department_id?: string | null
          event_category?: string | null
          event_date?: string | null
          id?: string
          notes?: string | null
          number_of_people?: number
          parent_proposal_id?: string | null
          products_selected?: boolean | null
          proposal_date?: string
          proposal_kind?: string | null
          proposal_number?: string
          room_id?: string | null
          status?: string
          target_weight_per_person?: number
          total_amount?: number
          total_target_weight?: number | null
          total_weight?: number
          unit_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_auto_generated_bom_order_id_fkey"
            columns: ["auto_generated_bom_order_id"]
            isOneToOne: false
            referencedRelation: "bom_production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_auto_generated_event_id_fkey"
            columns: ["auto_generated_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_auto_generated_event_table_id_fkey"
            columns: ["auto_generated_event_table_id"]
            isOneToOne: false
            referencedRelation: "event_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "client_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_parent_proposal_id_fkey"
            columns: ["parent_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "client_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "client_units"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          accounts_payable_generated: boolean
          accounts_payable_id: string | null
          created_at: string
          discount_total: number | null
          discount_type: string | null
          due_date: string | null
          edit_approved_at: string | null
          edit_approved_by: string | null
          freight_amount: number | null
          freight_cost_center_id: string | null
          id: string
          invoice_date: string
          invoice_number: string
          items_locked: boolean
          notes: string | null
          payment_due_date: string | null
          payment_terms: string | null
          purchase_order_id: string | null
          status: string
          stock_posted: boolean
          stock_posted_at: string | null
          supplier_id: string | null
          total_amount: number
          updated_at: string
          workflow_status: string
        }
        Insert: {
          accounts_payable_generated?: boolean
          accounts_payable_id?: string | null
          created_at?: string
          discount_total?: number | null
          discount_type?: string | null
          due_date?: string | null
          edit_approved_at?: string | null
          edit_approved_by?: string | null
          freight_amount?: number | null
          freight_cost_center_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          items_locked?: boolean
          notes?: string | null
          payment_due_date?: string | null
          payment_terms?: string | null
          purchase_order_id?: string | null
          status?: string
          stock_posted?: boolean
          stock_posted_at?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
          workflow_status?: string
        }
        Update: {
          accounts_payable_generated?: boolean
          accounts_payable_id?: string | null
          created_at?: string
          discount_total?: number | null
          discount_type?: string | null
          due_date?: string | null
          edit_approved_at?: string | null
          edit_approved_by?: string | null
          freight_amount?: number | null
          freight_cost_center_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          items_locked?: boolean
          notes?: string | null
          payment_due_date?: string | null
          payment_terms?: string | null
          purchase_order_id?: string | null
          status?: string
          stock_posted?: boolean
          stock_posted_at?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
          workflow_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_accounts_payable_id_fkey"
            columns: ["accounts_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_freight_cost_center_id_fkey"
            columns: ["freight_cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          material_id: string
          notes: string | null
          position: number
          purchase_order_id: string
          quantity: number
          quantity_received: number | null
          total_price: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          notes?: string | null
          position?: number
          purchase_order_id: string
          quantity: number
          quantity_received?: number | null
          total_price: number
          unit: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          notes?: string | null
          position?: number
          purchase_order_id?: string
          quantity?: number
          quantity_received?: number | null
          total_price?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_order_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          status: string
          supplier_id: string | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          status?: string
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: string
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_items: {
        Row: {
          created_at: string
          estimated_total_price: number | null
          estimated_unit_price: number | null
          id: string
          material_id: string
          notes: string | null
          position: number
          quantity: number
          request_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          estimated_total_price?: number | null
          estimated_unit_price?: number | null
          id?: string
          material_id: string
          notes?: string | null
          position?: number
          quantity: number
          request_id: string
          unit: string
        }
        Update: {
          created_at?: string
          estimated_total_price?: number | null
          estimated_unit_price?: number | null
          id?: string
          material_id?: string
          notes?: string | null
          position?: number
          quantity?: number
          request_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_request_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_request_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_request_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_request_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          department: string
          id: string
          justification: string
          priority: string
          purchase_order_id: string | null
          rejection_reason: string | null
          request_number: string
          requested_by: string
          requirement_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department: string
          id?: string
          justification: string
          priority?: string
          purchase_order_id?: string | null
          rejection_reason?: string | null
          request_number: string
          requested_by: string
          requirement_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department?: string
          id?: string
          justification?: string
          priority?: string
          purchase_order_id?: string | null
          rejection_reason?: string | null
          request_number?: string
          requested_by?: string
          requirement_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "purchase_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requirements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          material_id: string
          notes: string | null
          priority: string
          required_date: string
          required_quantity: number
          required_unit: string
          source_id: string | null
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          material_id: string
          notes?: string | null
          priority?: string
          required_date: string
          required_quantity: number
          required_unit: string
          source_id?: string | null
          source_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          material_id?: string
          notes?: string | null
          priority?: string
          required_date?: string
          required_quantity?: number
          required_unit?: string
          source_id?: string | null
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requirements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requirements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_requirements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_requirements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_requirements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_requirements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
        ]
      }
      quote_request_suppliers: {
        Row: {
          id: string
          quote_request_id: string
          responded_at: string | null
          response_status: string
          sent_at: string
          supplier_id: string
        }
        Insert: {
          id?: string
          quote_request_id: string
          responded_at?: string | null
          response_status?: string
          sent_at?: string
          supplier_id: string
        }
        Update: {
          id?: string
          quote_request_id?: string
          responded_at?: string | null
          response_status?: string
          sent_at?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_request_suppliers_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_request_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          created_at: string
          created_by: string
          deadline_date: string
          delivery_location: string | null
          id: string
          payment_terms: string | null
          quote_number: string
          request_id: string | null
          special_conditions: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deadline_date: string
          delivery_location?: string | null
          id?: string
          payment_terms?: string | null
          quote_number: string
          request_id?: string | null
          special_conditions?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deadline_date?: string
          delivery_location?: string | null
          id?: string
          payment_terms?: string | null
          quote_number?: string
          request_id?: string | null
          special_conditions?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_transactions: {
        Row: {
          account_receivable_id: string
          amount: number
          bank_account: string | null
          created_at: string
          document_number: string | null
          id: string
          notes: string | null
          receipt_date: string
          receipt_method: string
        }
        Insert: {
          account_receivable_id: string
          amount: number
          bank_account?: string | null
          created_at?: string
          document_number?: string | null
          id?: string
          notes?: string | null
          receipt_date: string
          receipt_method: string
        }
        Update: {
          account_receivable_id?: string
          amount?: number
          bank_account?: string | null
          created_at?: string
          document_number?: string | null
          id?: string
          notes?: string | null
          receipt_date?: string
          receipt_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_transactions_account_receivable_id_fkey"
            columns: ["account_receivable_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_bom_items: {
        Row: {
          id: string
          is_packaging: boolean
          material_id: string
          notes: string | null
          position: number
          quantity: number
          recipe_id: string
          unit: string
          waste_percent: number
        }
        Insert: {
          id?: string
          is_packaging?: boolean
          material_id: string
          notes?: string | null
          position?: number
          quantity: number
          recipe_id: string
          unit: string
          waste_percent?: number
        }
        Update: {
          id?: string
          is_packaging?: boolean
          material_id?: string
          notes?: string | null
          position?: number
          quantity?: number
          recipe_id?: string
          unit?: string
          waste_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_bom_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_bom_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipe_bom_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipe_bom_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipe_bom_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipe_bom_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipe_bom_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes_bom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_bom_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "vw_diag_bom_inconsistencies"
            referencedColumns: ["bom_id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          created_at: string | null
          id: string
          material_id: string | null
          quantity: number
          recipe_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_id?: string | null
          quantity: number
          recipe_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          material_id?: string | null
          quantity?: number
          recipe_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          difficulty: string | null
          id: string
          instructions: string | null
          name: string
          preparation_time: number | null
          profit_margin: number | null
          suggested_price: number | null
          total_cost: number | null
          total_weight: number | null
          updated_at: string | null
          yield_amount: number
          yield_unit: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          instructions?: string | null
          name: string
          preparation_time?: number | null
          profit_margin?: number | null
          suggested_price?: number | null
          total_cost?: number | null
          total_weight?: number | null
          updated_at?: string | null
          yield_amount: number
          yield_unit?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          instructions?: string | null
          name?: string
          preparation_time?: number | null
          profit_margin?: number | null
          suggested_price?: number | null
          total_cost?: number | null
          total_weight?: number | null
          updated_at?: string | null
          yield_amount?: number
          yield_unit?: string | null
        }
        Relationships: []
      }
      recipes_bom: {
        Row: {
          cached_total_cost: number | null
          cached_unit_cost: number | null
          cost_last_calculated_at: string | null
          cost_status: string | null
          created_at: string | null
          finished_material_id: string
          id: string
          is_archived: boolean | null
          missing_cost_items: Json | null
          notes: string | null
          updated_at: string | null
          waste_percent: number
          yield_quantity: number
          yield_unit: string
        }
        Insert: {
          cached_total_cost?: number | null
          cached_unit_cost?: number | null
          cost_last_calculated_at?: string | null
          cost_status?: string | null
          created_at?: string | null
          finished_material_id: string
          id?: string
          is_archived?: boolean | null
          missing_cost_items?: Json | null
          notes?: string | null
          updated_at?: string | null
          waste_percent?: number
          yield_quantity: number
          yield_unit: string
        }
        Update: {
          cached_total_cost?: number | null
          cached_unit_cost?: number | null
          cost_last_calculated_at?: string | null
          cost_status?: string | null
          created_at?: string | null
          finished_material_id?: string
          id?: string
          is_archived?: boolean | null
          missing_cost_items?: Json | null
          notes?: string | null
          updated_at?: string | null
          waste_percent?: number
          yield_quantity?: number
          yield_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_bom_finished_material_id_fkey"
            columns: ["finished_material_id"]
            isOneToOne: true
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_bom_finished_material_id_fkey"
            columns: ["finished_material_id"]
            isOneToOne: true
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipes_bom_finished_material_id_fkey"
            columns: ["finished_material_id"]
            isOneToOne: true
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipes_bom_finished_material_id_fkey"
            columns: ["finished_material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipes_bom_finished_material_id_fkey"
            columns: ["finished_material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipes_bom_finished_material_id_fkey"
            columns: ["finished_material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          account_id: string | null
          amount: number
          bank_account_id: string | null
          category: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          description: string
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          last_execution: string | null
          next_execution: string
          notes: string | null
          start_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          bank_account_id?: string | null
          category: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          last_execution?: string | null
          next_execution: string
          notes?: string | null
          start_date: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          bank_account_id?: string | null
          category?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_execution?: string | null
          next_execution?: string
          notes?: string | null
          start_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          description: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          severity: string
          title: string
          user_id: string | null
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity: string
          title: string
          user_id?: string | null
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          anomaly_flags: string[] | null
          created_at: string
          details: Json | null
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          new_role: string | null
          old_role: string | null
          resource_id: string | null
          resource_type: string | null
          risk_score: number | null
          session_id: string | null
          target_user_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          anomaly_flags?: string[] | null
          created_at?: string
          details?: Json | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          new_role?: string | null
          old_role?: string | null
          resource_id?: string | null
          resource_type?: string | null
          risk_score?: number | null
          session_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          anomaly_flags?: string[] | null
          created_at?: string
          details?: Json | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          new_role?: string | null
          old_role?: string | null
          resource_id?: string | null
          resource_type?: string | null
          risk_score?: number | null
          session_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          average_price: number
          cost_last_updated_at: string | null
          cost_last_updated_by: string | null
          cost_source: Database["public"]["Enums"]["cost_source_type"] | null
          created_at: string
          current_quantity: number
          id: string
          last_movement_date: string | null
          manual_price: boolean | null
          material_id: string
          minimum_quantity: number
          total_value: number
          updated_at: string
        }
        Insert: {
          average_price?: number
          cost_last_updated_at?: string | null
          cost_last_updated_by?: string | null
          cost_source?: Database["public"]["Enums"]["cost_source_type"] | null
          created_at?: string
          current_quantity?: number
          id?: string
          last_movement_date?: string | null
          manual_price?: boolean | null
          material_id: string
          minimum_quantity?: number
          total_value?: number
          updated_at?: string
        }
        Update: {
          average_price?: number
          cost_last_updated_at?: string | null
          cost_last_updated_by?: string | null
          cost_source?: Database["public"]["Enums"]["cost_source_type"] | null
          created_at?: string
          current_quantity?: number
          id?: string
          last_movement_date?: string | null
          manual_price?: boolean | null
          material_id?: string
          minimum_quantity?: number
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_items_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_items_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_items_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_items_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string | null
          material_id: string
          movement_date: string
          movement_type: string
          notes: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          total_cost: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          material_id: string
          movement_date?: string
          movement_type: string
          notes?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          total_cost?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          material_id?: string
          movement_date?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          total_cost?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
        ]
      }
      stock_parameters: {
        Row: {
          abc_classification: string | null
          created_at: string
          id: string
          is_active: boolean
          lead_time_days: number
          material_id: string
          maximum_stock: number
          minimum_stock: number
          notes: string | null
          reorder_point: number
          review_period_days: number
          safety_stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          abc_classification?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          lead_time_days?: number
          material_id: string
          maximum_stock?: number
          minimum_stock?: number
          notes?: string | null
          reorder_point?: number
          review_period_days?: number
          safety_stock?: number
          unit: string
          updated_at?: string
        }
        Update: {
          abc_classification?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          lead_time_days?: number
          material_id?: string
          maximum_stock?: number
          minimum_stock?: number
          notes?: string | null
          reorder_point?: number
          review_period_days?: number
          safety_stock?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_parameters_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_parameters_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_parameters_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_parameters_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_parameters_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_parameters_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
        ]
      }
      stock_planning_results: {
        Row: {
          abc_classification: string | null
          created_at: string
          current_stock: number
          id: string
          material_id: string
          maximum_stock: number
          minimum_stock: number
          notes: string | null
          planning_run_id: string
          priority_level: string
          recommended_quantity: number
          reorder_point: number
          requirement_generated: boolean | null
          requirement_id: string | null
          safety_stock: number
          total_cost: number | null
          unit: string
          unit_cost: number | null
        }
        Insert: {
          abc_classification?: string | null
          created_at?: string
          current_stock?: number
          id?: string
          material_id: string
          maximum_stock?: number
          minimum_stock?: number
          notes?: string | null
          planning_run_id: string
          priority_level?: string
          recommended_quantity?: number
          reorder_point?: number
          requirement_generated?: boolean | null
          requirement_id?: string | null
          safety_stock?: number
          total_cost?: number | null
          unit: string
          unit_cost?: number | null
        }
        Update: {
          abc_classification?: string | null
          created_at?: string
          current_stock?: number
          id?: string
          material_id?: string
          maximum_stock?: number
          minimum_stock?: number
          notes?: string | null
          planning_run_id?: string
          priority_level?: string
          recommended_quantity?: number
          reorder_point?: number
          requirement_generated?: boolean | null
          requirement_id?: string | null
          safety_stock?: number
          total_cost?: number | null
          unit?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_planning_results_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_planning_results_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_planning_results_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_planning_results_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_planning_results_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_planning_results_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_planning_results_planning_run_id_fkey"
            columns: ["planning_run_id"]
            isOneToOne: false
            referencedRelation: "stock_planning_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_planning_results_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "purchase_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_planning_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          materials_analyzed: number | null
          notes: string | null
          planning_horizon_days: number
          requirements_generated: number | null
          run_by: string | null
          run_code: string
          run_date: string
          status: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          materials_analyzed?: number | null
          notes?: string | null
          planning_horizon_days?: number
          requirements_generated?: number | null
          run_by?: string | null
          run_code: string
          run_date?: string
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          materials_analyzed?: number | null
          notes?: string | null
          planning_horizon_days?: number
          requirements_generated?: number | null
          run_by?: string | null
          run_code?: string
          run_date?: string
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_products: {
        Row: {
          conversion_factor: number
          created_at: string
          id: string
          is_active: boolean
          last_price: number | null
          material_id: string
          supplier_id: string
          supplier_product_code: string | null
          supplier_product_name: string
          supplier_unit: string
          updated_at: string
        }
        Insert: {
          conversion_factor?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_price?: number | null
          material_id: string
          supplier_id: string
          supplier_product_code?: string | null
          supplier_product_name: string
          supplier_unit: string
          updated_at?: string
        }
        Update: {
          conversion_factor?: number
          created_at?: string
          id?: string
          is_active?: boolean
          last_price?: number | null
          material_id?: string
          supplier_id?: string
          supplier_product_code?: string | null
          supplier_product_name?: string
          supplier_unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "supplier_products_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "supplier_products_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "supplier_products_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "supplier_products_ingredient_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quote_items: {
        Row: {
          brand: string | null
          id: string
          material_id: string
          position: number
          quantity: number
          quote_id: string
          specifications: string | null
          total_price: number
          unit: string
          unit_price: number
        }
        Insert: {
          brand?: string | null
          id?: string
          material_id: string
          position?: number
          quantity: number
          quote_id: string
          specifications?: string | null
          total_price: number
          unit: string
          unit_price: number
        }
        Update: {
          brand?: string | null
          id?: string
          material_id?: string
          position?: number
          quantity?: number
          quote_id?: string
          specifications?: string | null
          total_price?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quote_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quote_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "supplier_quote_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "supplier_quote_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "supplier_quote_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "supplier_quote_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "supplier_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotes: {
        Row: {
          analyzed_at: string | null
          analyzed_by: string | null
          delivery_terms: string | null
          delivery_time_days: number | null
          id: string
          notes: string | null
          payment_terms: string | null
          quote_reference: string | null
          quote_request_id: string
          received_at: string
          status: string
          supplier_id: string
          total_amount: number | null
          valid_until: string
        }
        Insert: {
          analyzed_at?: string | null
          analyzed_by?: string | null
          delivery_terms?: string | null
          delivery_time_days?: number | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          quote_reference?: string | null
          quote_request_id: string
          received_at?: string
          status?: string
          supplier_id: string
          total_amount?: number | null
          valid_until: string
        }
        Update: {
          analyzed_at?: string | null
          analyzed_by?: string | null
          delivery_terms?: string | null
          delivery_time_days?: number | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          quote_reference?: string | null
          quote_request_id?: string
          received_at?: string
          status?: string
          supplier_id?: string
          total_amount?: number | null
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotes_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          cnpj_cpf: string | null
          code: string
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          main_category: string | null
          minimum_order_value: number | null
          notes: string | null
          payment_terms: number | null
          phone: string | null
          state: string | null
          status: string
          trade_name: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj_cpf?: string | null
          code: string
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          main_category?: string | null
          minimum_order_value?: number | null
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          state?: string | null
          status?: string
          trade_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj_cpf?: string | null
          code?: string
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          main_category?: string | null
          minimum_order_value?: number | null
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          state?: string | null
          status?: string
          trade_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      taxonomy_definitions: {
        Row: {
          created_at: string | null
          id: string
          key: string
          label: string
          module_key: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          label: string
          module_key: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          label?: string
          module_key?: string
        }
        Relationships: []
      }
      taxonomy_terms: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
          taxonomy_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
          taxonomy_id: string
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          taxonomy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "taxonomy_terms_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taxonomy_terms_taxonomy_id_fkey"
            columns: ["taxonomy_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      time_records: {
        Row: {
          created_at: string | null
          created_by: string | null
          employee_id: string
          id: string
          ip_address: string | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          record_date: string
          record_time: string
          record_type: string
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          id?: string
          ip_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          record_date: string
          record_time: string
          record_type: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          id?: string
          ip_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          record_date?: string
          record_time?: string
          record_type?: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          category: Database["public"]["Enums"]["permission_category"]
          created_at: string
          granted_by: string | null
          id: string
          subcategory: Database["public"]["Enums"]["permission_subcategory"]
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["permission_category"]
          created_at?: string
          granted_by?: string | null
          id?: string
          subcategory: Database["public"]["Enums"]["permission_subcategory"]
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["permission_category"]
          created_at?: string
          granted_by?: string | null
          id?: string
          subcategory?: Database["public"]["Enums"]["permission_subcategory"]
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          email_confirmed_at: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_confirmed_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_schedules: {
        Row: {
          created_at: string | null
          description: string | null
          end_time: string
          id: string
          is_active: boolean | null
          lunch_end: string | null
          lunch_start: string | null
          name: string
          start_time: string
          total_hours: number
          updated_at: string | null
          work_days: number[]
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          lunch_end?: string | null
          lunch_start?: string | null
          name: string
          start_time: string
          total_hours: number
          updated_at?: string | null
          work_days?: number[]
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          lunch_end?: string | null
          lunch_start?: string | null
          name?: string
          start_time?: string
          total_hours?: number
          updated_at?: string | null
          work_days?: number[]
        }
        Relationships: []
      }
    }
    Views: {
      vw_bom_cost_history_detailed: {
        Row: {
          bom_id: string | null
          bom_name: string | null
          bom_type: string | null
          change_reason: string | null
          cost_change_absolute: number | null
          cost_change_percent: number | null
          created_at: string | null
          created_by: string | null
          id: string | null
          new_total_cost: number | null
          old_total_cost: number | null
          triggered_by_material_id: string | null
          triggered_by_material_name: string | null
        }
        Insert: {
          bom_id?: string | null
          bom_name?: never
          bom_type?: string | null
          change_reason?: string | null
          cost_change_absolute?: number | null
          cost_change_percent?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          new_total_cost?: number | null
          old_total_cost?: number | null
          triggered_by_material_id?: string | null
          triggered_by_material_name?: never
        }
        Update: {
          bom_id?: string | null
          bom_name?: never
          bom_type?: string | null
          change_reason?: string | null
          cost_change_absolute?: number | null
          cost_change_percent?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          new_total_cost?: number | null
          old_total_cost?: number | null
          triggered_by_material_id?: string | null
          triggered_by_material_name?: never
        }
        Relationships: []
      }
      vw_cost_audit: {
        Row: {
          average_price: number | null
          category: string | null
          cfop_padrao: string | null
          cost_last_updated_at: string | null
          cost_last_updated_by_email: string | null
          cost_source: Database["public"]["Enums"]["cost_source_type"] | null
          cst_csosn: string | null
          current_quantity: number | null
          last_movement_at: string | null
          last_movement_type: string | null
          manual_price: boolean | null
          material_code: string | null
          material_created_at: string | null
          material_id: string | null
          material_name: string | null
          material_updated_at: string | null
          ncm: string | null
          origem: number | null
          subcategory: string | null
          total_value: number | null
        }
        Relationships: []
      }
      vw_diag_bom_inconsistencies: {
        Row: {
          bom_count_for_material: number | null
          bom_id: string | null
          estimated_cost: number | null
          finished_material_id: string | null
          finished_material_name: string | null
          item_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_bom_finished_material_id_fkey"
            columns: ["finished_material_id"]
            isOneToOne: true
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_bom_finished_material_id_fkey"
            columns: ["finished_material_id"]
            isOneToOne: true
            referencedRelation: "vw_cost_audit"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipes_bom_finished_material_id_fkey"
            columns: ["finished_material_id"]
            isOneToOne: true
            referencedRelation: "vw_proposal_breakdown"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipes_bom_finished_material_id_fkey"
            columns: ["finished_material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_below_min"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipes_bom_finished_material_id_fkey"
            columns: ["finished_material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_no_avg_price"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "recipes_bom_finished_material_id_fkey"
            columns: ["finished_material_id"]
            isOneToOne: true
            referencedRelation: "vw_stock_zero"
            referencedColumns: ["material_id"]
          },
        ]
      }
      vw_diag_material_dupes: {
        Row: {
          candidate_key: string | null
          categories: string[] | null
          duplicate_count: number | null
          has_references_flags: boolean[] | null
          has_stock_flags: boolean[] | null
          material_ids: string[] | null
        }
        Relationships: []
      }
      vw_diag_orphan_materials: {
        Row: {
          category: string | null
          id: string | null
          material_type: string | null
          name: string | null
          orphan_type: string | null
        }
        Relationships: []
      }
      vw_diag_orphans: {
        Row: {
          category: string | null
          id: string | null
          material_type: string | null
          name: string | null
          orphan_type: string | null
        }
        Relationships: []
      }
      vw_proposal_breakdown: {
        Row: {
          category_id: string | null
          category_label: string | null
          item_kind: string | null
          material_code: string | null
          material_id: string | null
          material_name: string | null
          material_type: string | null
          planned_qty: number | null
          planned_unit: string | null
          proposal_id: string | null
          proposal_item_id: string | null
          total_cost: number | null
          unit_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_categories_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_stock_below_min: {
        Row: {
          average_price: number | null
          category: string | null
          code: string | null
          current_quantity: number | null
          deficit_quantity: number | null
          estimated_cost: number | null
          material_id: string | null
          material_type: string | null
          minimum_quantity: number | null
          name: string | null
          subcategory: string | null
        }
        Relationships: []
      }
      vw_stock_no_avg_price: {
        Row: {
          category: string | null
          code: string | null
          current_quantity: number | null
          material_id: string | null
          material_type: string | null
          name: string | null
          price_per_purchase_unit: number | null
          subcategory: string | null
          total_value: number | null
        }
        Relationships: []
      }
      vw_stock_zero: {
        Row: {
          average_price: number | null
          category: string | null
          code: string | null
          current_quantity: number | null
          has_stock_record: boolean | null
          material_id: string | null
          material_type: string | null
          name: string | null
          subcategory: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      analyze_material_price_history: {
        Args: { p_material_id: string }
        Returns: Json
      }
      analyze_system_pricing_health: { Args: never; Returns: Json }
      apply_global_discount_to_invoice: {
        Args: {
          p_discount_total: number
          p_discount_type?: string
          p_invoice_id: string
        }
        Returns: undefined
      }
      archive_composite_bom: {
        Args: { p_bom_id: string; p_should_archive: boolean }
        Returns: Json
      }
      archive_material: { Args: { p_id: string }; Returns: undefined }
      archive_recipe_bom: {
        Args: { p_bom_id: string; p_should_archive: boolean }
        Returns: Json
      }
      assemble_composite: {
        Args: { p_material_id: string; p_quantity: number }
        Returns: Json
      }
      calculate_bom_cost_recursive: {
        Args: { p_material_id: string; p_material_type: string }
        Returns: number
      }
      calculate_bom_current_cost: {
        Args: { p_bom_id: string; p_bom_type: string }
        Returns: Json
      }
      calculate_composite_current_cost: {
        Args: { composite_material_id: string }
        Returns: number
      }
      calculate_weighted_average_price:
        | { Args: { p_material_id: string }; Returns: undefined }
        | {
            Args: {
              p_material_id: string
              p_new_price: number
              p_new_quantity: number
            }
            Returns: number
          }
      can_edit_invoice_items: {
        Args: { p_invoice_id: string; p_user_id: string }
        Returns: boolean
      }
      can_hard_delete_material: { Args: { p_id: string }; Returns: boolean }
      check_account_lockout: { Args: { p_email: string }; Returns: Json }
      check_production_availability: {
        Args: { p_bom_id: string; p_bom_type: string; p_multiplier?: number }
        Returns: Json
      }
      check_rate_limit: {
        Args: { p_attempt_type: string; p_email: string; p_ip_address: string }
        Returns: Json
      }
      compute_event_item_planned_qty: {
        Args: { p_event_table_id: string; p_item_id?: string }
        Returns: {
          material_id: string
          planned_qty: number
          planned_unit: string
        }[]
      }
      consume_materials_for_production: {
        Args: { p_production_order_id: string }
        Returns: undefined
      }
      create_account_lockout: {
        Args: {
          p_email: string
          p_failed_attempts?: number
          p_lockout_duration_minutes?: number
        }
        Returns: undefined
      }
      create_event_notifications: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      create_security_alert: {
        Args: {
          p_alert_type: string
          p_description: string
          p_ip_address?: string
          p_metadata?: Json
          p_severity: string
          p_title: string
        }
        Returns: string
      }
      detect_pii_anomaly: {
        Args: {
          p_access_count?: number
          p_resource_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      diag_bom_migration_report: { Args: never; Returns: Json }
      execute_event_production: {
        Args: { p_event_table_id: string }
        Returns: undefined
      }
      explode_event_requirements: {
        Args: { p_event_table_id: string; p_explode_components?: boolean }
        Returns: {
          material_id: string
          material_name: string
          material_type: string
          planned_qty: number
          planned_unit: string
          source_kind: string
        }[]
      }
      finalize_legacy_recipes_to_bom: {
        Args: { create_intermediates?: boolean; dry_run?: boolean }
        Returns: Json
      }
      finalize_proposal_fulfillment: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      fix_corrupted_production_costs: { Args: never; Returns: Json }
      generate_accounts_payable_from_invoice: {
        Args: {
          p_cost_center_id?: string
          p_due_date?: string
          p_invoice_id: string
        }
        Returns: string
      }
      generate_due_date_alerts: { Args: never; Returns: undefined }
      generate_event_production: {
        Args: { p_event_table_id: string; p_target_table?: string }
        Returns: string
      }
      generate_production_from_proposal: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      get_config: {
        Args: { p_key: string; p_namespace: string }
        Returns: Json
      }
      get_cost_source_summary: {
        Args: never
        Returns: {
          cost_source: Database["public"]["Enums"]["cost_source_type"]
          count: number
          material_type: string
        }[]
      }
      get_flag: { Args: { p_key: string }; Returns: boolean }
      get_masked_client_data: {
        Args: never
        Returns: {
          address: string
          city: string
          cnpj_cpf: string
          cnpj_cpf_display: string
          contact_person: string
          created_at: string
          email: string
          email_display: string
          id: string
          name: string
          notes: string
          phone: string
          phone_display: string
          state: string
          status: string
          updated_at: string
          zip_code: string
        }[]
      }
      get_masked_employee_data: {
        Args: never
        Returns: {
          account_type: string
          address: string
          bank_account: string
          bank_branch: string
          bank_name: string
          benefits: string[]
          birth_date: string
          city: string
          cpf: string
          cpf_display: string
          created_at: string
          ctps_number: string
          ctps_series: string
          department: string
          email: string
          emergency_contact_name: string
          emergency_contact_phone: string
          employee_number: string
          employment_type: string
          full_name: string
          gender: string
          hire_date: string
          id: string
          marital_status: string
          military_service: string
          mobile_phone: string
          notes: string
          phone: string
          pis_pasep: string
          position: string
          rg: string
          rg_display: string
          salary_amount: number
          state: string
          status: string
          termination_date: string
          updated_at: string
          voter_registration: string
          zip_code: string
        }[]
      }
      get_material_cost: { Args: { p_material_id: string }; Returns: number }
      get_secure_user_profiles: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          updated_at: string
          user_id: string
        }[]
      }
      get_security_summary: { Args: never; Returns: Json }
      get_user_email_safe: { Args: { p_user_id: string }; Returns: string }
      has_financial_permission: {
        Args: {
          p_department?: string
          p_permission_type: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_hr_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["hr_permission_type"]
          _user_id: string
        }
        Returns: boolean
      }
      has_permission: {
        Args: {
          p_category: Database["public"]["Enums"]["permission_category"]
          p_subcategory?: Database["public"]["Enums"]["permission_subcategory"]
          p_user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_taxonomy_from_csv: { Args: never; Returns: Json }
      is_admin_not_self: {
        Args: { _target_user_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
      is_flag_enabled: { Args: { p_flag_name: string }; Returns: boolean }
      is_within_allowed_time: {
        Args: { p_operation_type: string }
        Returns: boolean
      }
      log_auth_attempt: {
        Args: {
          p_attempt_type: string
          p_email: string
          p_failure_reason?: string
          p_ip_address: string
          p_success: boolean
          p_user_agent?: string
        }
        Returns: undefined
      }
      log_auth_attempt_secure: {
        Args: {
          p_attempt_type: string
          p_email: string
          p_failure_reason?: string
          p_ip_address?: string
          p_success: boolean
          p_user_agent?: string
        }
        Returns: string
      }
      log_pii_access: {
        Args: {
          p_access_type: string
          p_employee_id: string
          p_pii_fields: string[]
          p_table_name: string
        }
        Returns: undefined
      }
      log_pii_access_secure: {
        Args: {
          p_access_type: string
          p_fields: Database["public"]["Enums"]["pii_field_type"][]
          p_justification?: string
          p_record_id: string
          p_table_name: string
        }
        Returns: string
      }
      log_sensitive_data_access: {
        Args: {
          p_action: string
          p_details?: Json
          p_resource_id?: string
          p_resource_type: string
        }
        Returns: undefined
      }
      mark_bom_cost_alert_as_read: {
        Args: { p_alert_id: string }
        Returns: undefined
      }
      mask_cnpj_cpf: { Args: { cnpj_cpf_value: string }; Returns: string }
      mask_cpf: { Args: { cpf_value: string }; Returns: string }
      mask_email: { Args: { email_value: string }; Returns: string }
      mask_phone: { Args: { phone_value: string }; Returns: string }
      mask_rg: { Args: { rg_value: string }; Returns: string }
      merge_duplicate_materials: {
        Args: { p_duplicate_ids: string[]; p_target_id: string }
        Returns: Json
      }
      merge_materials: {
        Args: { dry_run?: boolean; dst: string; src: string }
        Returns: Json
      }
      no_admin_exists: { Args: never; Returns: boolean }
      normalize_text: { Args: { text_input: string }; Returns: string }
      ops_archive_legacy_recipes: {
        Args: { dry_run?: boolean }
        Returns: {
          affected_products: number
          backup_tables: string
          removed_ingredients: number
          removed_recipes: number
        }[]
      }
      process_component_consumption: {
        Args: {
          p_material_id: string
          p_movement_type: string
          p_quantity: number
          p_reference_material: string
          p_unit: string
        }
        Returns: undefined
      }
      process_cost_adjustment: {
        Args: {
          p_adjustment_reason: string
          p_material_id: string
          p_new_unit_cost: number
          p_notes?: string
          p_reference_document?: string
        }
        Returns: Json
      }
      process_finish_input: {
        Args: {
          p_material_id: string
          p_movement_type: string
          p_quantity: number
        }
        Returns: undefined
      }
      process_finish_input_with_bom_cost:
        | {
            Args: {
              p_material_id: string
              p_movement_type: string
              p_quantity: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_idempotency_key?: string
              p_material_id: string
              p_movement_type: string
              p_quantity: number
            }
            Returns: undefined
          }
      process_inventory_adjustment: {
        Args: {
          p_adjustment_reason: string
          p_material_id: string
          p_notes?: string
          p_physical_quantity: number
          p_reference_document?: string
        }
        Returns: string
      }
      process_order_component_consumption: {
        Args: {
          p_material_id: string
          p_production_order_id: string
          p_quantity: number
          p_unit: string
        }
        Returns: undefined
      }
      process_order_finish_input: {
        Args: {
          p_material_id: string
          p_production_order_id: string
          p_quantity: number
        }
        Returns: undefined
      }
      process_stock_entry_with_conversion:
        | {
            Args: {
              p_entry_unit: string
              p_invoice_number?: string
              p_material_id: string
              p_notes?: string
              p_quantity: number
              p_supplier_id?: string
              p_unit_price: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_material_id: string
              p_notes?: string
              p_quantity_purchased: number
              p_reference_id?: string
              p_reference_type?: string
              p_unit_price_purchase: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_idempotency_key?: string
              p_material_id: string
              p_notes?: string
              p_quantity_purchased: number
              p_reference_id: string
              p_reference_type: string
              p_unit_price_purchase: number
            }
            Returns: Json
          }
      produce_composite_product_with_correct_cost: {
        Args: {
          p_composite_material_id: string
          p_notes?: string
          p_quantity_produced: number
          p_reference_document?: string
          p_unit: string
        }
        Returns: string
      }
      produce_finished_product: {
        Args: { p_material_id: string; p_quantity: number }
        Returns: Json
      }
      produce_finished_product_with_correct_cost: {
        Args: { p_finished_material: string; p_output_qty: number }
        Returns: undefined
      }
      produce_finished_products_for_order: {
        Args: { p_production_order_id: string }
        Returns: undefined
      }
      produce_product: {
        Args: { p_material_id: string; p_output_qty: number }
        Returns: undefined
      }
      recalculate_material_average_price: {
        Args: { p_dry_run?: boolean; p_material_id: string }
        Returns: Json
      }
      recalculate_product_stock_cost: {
        Args: { p_material_id: string }
        Returns: Json
      }
      recalculate_stock_total_values: { Args: never; Returns: undefined }
      refresh_bom_costs_for_material: {
        Args: { p_material_id: string }
        Returns: Json
      }
      reserve_materials_for_production: {
        Args: { p_production_order_id: string }
        Returns: undefined
      }
      rpc_inventory_add_materials: {
        Args: { p_cycle_id: string; p_material_ids: string[] }
        Returns: number
      }
      rpc_inventory_create_cycle: {
        Args: { p_name: string; p_notes?: string }
        Returns: string
      }
      rpc_inventory_finalize: { Args: { p_cycle_id: string }; Returns: Json }
      rpc_inventory_update_status: {
        Args: { p_cycle_id: string; p_new_status: string }
        Returns: undefined
      }
      run_bom_cleanup_playbook: { Args: { confirm?: boolean }; Returns: Json }
      run_pricing_tests: {
        Args: never
        Returns: {
          details: string
          status: string
          test_name: string
        }[]
      }
      sanitize_bom_for_material: {
        Args: { finished_material: string }
        Returns: Json
      }
      sanitize_error_message: { Args: { error_msg: string }; Returns: string }
      save_material_mapping: {
        Args: {
          p_invoice_description: string
          p_material_id: string
          p_supplier_name?: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      suggest_material_matches: {
        Args: {
          p_item_description: string
          p_limit?: number
          p_supplier_name?: string
        }
        Returns: {
          confidence: number
          match_method: string
          material_code: string
          material_id: string
          material_name: string
          reason: string
        }[]
      }
      suggest_material_taxonomy_migration: {
        Args: never
        Returns: {
          confidence_score: number
          current_category: string
          current_subcategory: string
          material_id: string
          material_name: string
          suggested_category_id: string
          suggested_category_name: string
          suggested_subcategory_id: string
          suggested_subcategory_name: string
        }[]
      }
      test_bom_cleanup_and_migration: { Args: never; Returns: Json }
      trigger_refresh_bom_costs_on_material_price_change: {
        Args: { p_material_id: string }
        Returns: undefined
      }
      update_production_order_status: {
        Args: { p_new_status: string; p_production_order_id: string }
        Returns: undefined
      }
      validate_material_units: {
        Args: { p_material_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user" | "financial"
      cost_source_type: "purchase" | "production" | "manual"
      event_category:
        | "Coffee Break"
        | "Brunch"
        | "Coquetel"
        | "Almoco"
        | "Jantar"
        | "Festa Infantil"
        | "Casamento"
        | "Reuniao Corporativa"
      hr_permission_type:
        | "view_basic_info"
        | "view_personal_documents"
        | "view_financial_info"
        | "full_access"
      permission_category:
        | "estoque"
        | "compras"
        | "vendas"
        | "agenda"
        | "producao"
        | "fornecedores"
        | "financeiro"
        | "relatorios"
        | "usuarios"
      permission_subcategory:
        | "estoque_visualizar"
        | "estoque_criar"
        | "estoque_editar"
        | "estoque_excluir"
        | "estoque_movimentacoes"
        | "compras_visualizar"
        | "compras_criar"
        | "compras_editar"
        | "compras_excluir"
        | "compras_aprovar"
        | "vendas_visualizar"
        | "vendas_criar"
        | "vendas_editar"
        | "vendas_excluir"
        | "vendas_propostas"
        | "vendas_clientes"
        | "agenda_visualizar"
        | "agenda_criar"
        | "agenda_editar"
        | "agenda_excluir"
        | "agenda_eventos"
        | "producao_visualizar"
        | "producao_criar"
        | "producao_editar"
        | "producao_excluir"
        | "producao_receitas"
        | "producao_materiais"
        | "fornecedores_visualizar"
        | "fornecedores_criar"
        | "fornecedores_editar"
        | "fornecedores_excluir"
        | "fornecedores_produtos"
        | "financeiro_visualizar"
        | "financeiro_contas_pagar"
        | "financeiro_contas_receber"
        | "financeiro_fluxo_caixa"
        | "financeiro_relatorios"
        | "relatorios_visualizar"
        | "relatorios_financeiros"
        | "relatorios_operacionais"
        | "relatorios_exportar"
        | "usuarios_visualizar"
        | "usuarios_criar"
        | "usuarios_editar"
        | "usuarios_excluir"
        | "usuarios_permissoes"
      pii_field_type:
        | "email"
        | "phone"
        | "cpf"
        | "cnpj"
        | "rg"
        | "address"
        | "salary"
        | "bank_account"
        | "pis_pasep"
        | "ctps"
      product_category:
        | "Salgados"
        | "Doces"
        | "Low Fat"
        | "Bebidas"
        | "Sobremesas"
        | "Complementos"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "user", "financial"],
      cost_source_type: ["purchase", "production", "manual"],
      event_category: [
        "Coffee Break",
        "Brunch",
        "Coquetel",
        "Almoco",
        "Jantar",
        "Festa Infantil",
        "Casamento",
        "Reuniao Corporativa",
      ],
      hr_permission_type: [
        "view_basic_info",
        "view_personal_documents",
        "view_financial_info",
        "full_access",
      ],
      permission_category: [
        "estoque",
        "compras",
        "vendas",
        "agenda",
        "producao",
        "fornecedores",
        "financeiro",
        "relatorios",
        "usuarios",
      ],
      permission_subcategory: [
        "estoque_visualizar",
        "estoque_criar",
        "estoque_editar",
        "estoque_excluir",
        "estoque_movimentacoes",
        "compras_visualizar",
        "compras_criar",
        "compras_editar",
        "compras_excluir",
        "compras_aprovar",
        "vendas_visualizar",
        "vendas_criar",
        "vendas_editar",
        "vendas_excluir",
        "vendas_propostas",
        "vendas_clientes",
        "agenda_visualizar",
        "agenda_criar",
        "agenda_editar",
        "agenda_excluir",
        "agenda_eventos",
        "producao_visualizar",
        "producao_criar",
        "producao_editar",
        "producao_excluir",
        "producao_receitas",
        "producao_materiais",
        "fornecedores_visualizar",
        "fornecedores_criar",
        "fornecedores_editar",
        "fornecedores_excluir",
        "fornecedores_produtos",
        "financeiro_visualizar",
        "financeiro_contas_pagar",
        "financeiro_contas_receber",
        "financeiro_fluxo_caixa",
        "financeiro_relatorios",
        "relatorios_visualizar",
        "relatorios_financeiros",
        "relatorios_operacionais",
        "relatorios_exportar",
        "usuarios_visualizar",
        "usuarios_criar",
        "usuarios_editar",
        "usuarios_excluir",
        "usuarios_permissoes",
      ],
      pii_field_type: [
        "email",
        "phone",
        "cpf",
        "cnpj",
        "rg",
        "address",
        "salary",
        "bank_account",
        "pis_pasep",
        "ctps",
      ],
      product_category: [
        "Salgados",
        "Doces",
        "Low Fat",
        "Bebidas",
        "Sobremesas",
        "Complementos",
      ],
    },
  },
} as const
