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
      accounts_payable: {
        Row: {
          account_id: string | null
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
          remaining_amount: number
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
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
          remaining_amount: number
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
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
          remaining_amount?: number
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
          received_amount: number | null
          remaining_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
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
          received_amount?: number | null
          remaining_amount: number
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
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
          received_amount?: number | null
          remaining_amount?: number
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
      cash_transactions: {
        Row: {
          account_id: string | null
          amount: number
          bank_account: string | null
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
          salary: number | null
          state: string | null
          status: string
          termination_date: string | null
          updated_at: string
          voter_registration: string | null
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
          salary?: number | null
          state?: string | null
          status?: string
          termination_date?: string | null
          updated_at?: string
          voter_registration?: string | null
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
          salary?: number | null
          state?: string | null
          status?: string
          termination_date?: string | null
          updated_at?: string
          voter_registration?: string | null
          zip_code?: string | null
        }
        Relationships: []
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
      invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          material_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          material_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
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
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          allowed_brands: string[] | null
          category: string
          code: string | null
          conversion_factor: number
          created_at: string | null
          description: string | null
          id: string
          material_type: string
          name: string
          price_per_purchase_unit: number
          purchase_unit: string
          supplier: string | null
          supplier_id: string | null
          unit_weight: number | null
          updated_at: string | null
          usage_unit: string
        }
        Insert: {
          allowed_brands?: string[] | null
          category?: string
          code?: string | null
          conversion_factor?: number
          created_at?: string | null
          description?: string | null
          id?: string
          material_type?: string
          name: string
          price_per_purchase_unit: number
          purchase_unit: string
          supplier?: string | null
          supplier_id?: string | null
          unit_weight?: number | null
          updated_at?: string | null
          usage_unit: string
        }
        Update: {
          allowed_brands?: string[] | null
          category?: string
          code?: string | null
          conversion_factor?: number
          created_at?: string | null
          description?: string | null
          id?: string
          material_type?: string
          name?: string
          price_per_purchase_unit?: number
          purchase_unit?: string
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
        ]
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
      proposals: {
        Row: {
          client_id: string
          created_at: string
          event_category: string | null
          event_date: string | null
          id: string
          notes: string | null
          number_of_people: number
          parent_proposal_id: string | null
          products_selected: boolean | null
          proposal_date: string
          proposal_number: string
          status: string
          target_weight_per_person: number
          total_amount: number
          total_target_weight: number | null
          total_weight: number
          updated_at: string
          version: number
        }
        Insert: {
          client_id: string
          created_at?: string
          event_category?: string | null
          event_date?: string | null
          id?: string
          notes?: string | null
          number_of_people: number
          parent_proposal_id?: string | null
          products_selected?: boolean | null
          proposal_date?: string
          proposal_number: string
          status?: string
          target_weight_per_person?: number
          total_amount?: number
          total_target_weight?: number | null
          total_weight?: number
          updated_at?: string
          version?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          event_category?: string | null
          event_date?: string | null
          id?: string
          notes?: string | null
          number_of_people?: number
          parent_proposal_id?: string | null
          products_selected?: boolean | null
          proposal_date?: string
          proposal_number?: string
          status?: string
          target_weight_per_person?: number
          total_amount?: number
          total_target_weight?: number | null
          total_weight?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_parent_proposal_id_fkey"
            columns: ["parent_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          purchase_order_id: string | null
          status: string
          stock_posted: boolean
          stock_posted_at: string | null
          supplier_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          purchase_order_id?: string | null
          status?: string
          stock_posted?: boolean
          stock_posted_at?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          purchase_order_id?: string | null
          status?: string
          stock_posted?: boolean
          stock_posted_at?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
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
        }
        Relationships: []
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
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          new_role: string | null
          old_role: string | null
          resource_id: string | null
          resource_type: string | null
          target_user_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          new_role?: string | null
          old_role?: string | null
          resource_id?: string | null
          resource_type?: string | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          new_role?: string | null
          old_role?: string | null
          resource_id?: string | null
          resource_type?: string | null
          target_user_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          average_price: number
          created_at: string
          current_quantity: number
          id: string
          last_movement_date: string | null
          material_id: string
          minimum_quantity: number
          total_value: number
          updated_at: string
        }
        Insert: {
          average_price?: number
          created_at?: string
          current_quantity?: number
          id?: string
          last_movement_date?: string | null
          material_id: string
          minimum_quantity?: number
          total_value?: number
          updated_at?: string
        }
        Update: {
          average_price?: number
          created_at?: string
          current_quantity?: number
          id?: string
          last_movement_date?: string | null
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
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          material_id: string
          movement_date: string
          movement_type: string
          notes: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          movement_date?: string
          movement_type: string
          notes?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          movement_date?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
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
        ]
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
            foreignKeyName: "supplier_products_supplier_id_fkey"
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
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      calculate_weighted_average_price: {
        Args: {
          p_material_id: string
          p_new_price: number
          p_new_quantity: number
        }
        Returns: number
      }
      check_rate_limit: {
        Args: { p_attempt_type: string; p_email: string; p_ip_address: string }
        Returns: Json
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
      get_masked_client_data: {
        Args: Record<PropertyKey, never>
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
        Args: Record<PropertyKey, never>
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
      has_financial_permission: {
        Args: {
          p_department?: string
          p_permission_type: string
          p_user_id: string
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
      is_admin_not_self: {
        Args: { _target_user_id: string; _user_id: string }
        Returns: boolean
      }
      is_admin_or_manager: {
        Args: { _user_id: string }
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
      log_pii_access: {
        Args: {
          p_access_type: string
          p_employee_id: string
          p_pii_fields: string[]
          p_table_name: string
        }
        Returns: undefined
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
      mask_cnpj_cpf: {
        Args: { cnpj_cpf_value: string }
        Returns: string
      }
      mask_cpf: {
        Args: { cpf_value: string }
        Returns: string
      }
      mask_email: {
        Args: { email_value: string }
        Returns: string
      }
      mask_phone: {
        Args: { phone_value: string }
        Returns: string
      }
      mask_rg: {
        Args: { rg_value: string }
        Returns: string
      }
      no_admin_exists: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user" | "financial"
      event_category:
        | "Coffee Break"
        | "Brunch"
        | "Coquetel"
        | "Almoco"
        | "Jantar"
        | "Festa Infantil"
        | "Casamento"
        | "Reuniao Corporativa"
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
