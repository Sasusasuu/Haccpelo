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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action_type: string
          category: string
          created_at: string
          description: string
          employee_id: string | null
          employee_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          action_type: string
          category?: string
          created_at?: string
          description: string
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action_type?: string
          category?: string
          created_at?: string
          description?: string
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_logs: {
        Row: {
          created_at: string
          done_by: string
          done_date: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done_by: string
          done_date?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          done_by?: string
          done_date?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "cleaning_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_tasks: {
        Row: {
          created_at: string
          frequency: string
          id: string
          task_name: string
          updated_at: string
          user_id: string
          zone: string
        }
        Insert: {
          created_at?: string
          frequency?: string
          id?: string
          task_name: string
          updated_at?: string
          user_id: string
          zone: string
        }
        Update: {
          created_at?: string
          frequency?: string
          id?: string
          task_name?: string
          updated_at?: string
          user_id?: string
          zone?: string
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          color: string
          created_at: string
          id: string
          label: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          label: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          contract_hours: number | null
          created_at: string
          has_pin: boolean | null
          id: string
          is_manager: boolean
          meal_type: string | null
          name: string
          nfc_badge_id: string | null
          pin_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_hours?: number | null
          created_at?: string
          has_pin?: boolean | null
          id?: string
          is_manager?: boolean
          meal_type?: string | null
          name: string
          nfc_badge_id?: string | null
          pin_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_hours?: number | null
          created_at?: string
          has_pin?: boolean | null
          id?: string
          is_manager?: boolean
          meal_type?: string | null
          name?: string
          nfc_badge_id?: string | null
          pin_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      equipments: {
        Row: {
          created_at: string
          equipment_type: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment_type?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipment_type?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      memos: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      planning_slots: {
        Row: {
          created_at: string
          day_index: number
          employee_id: string
          end_time: string
          id: string
          role: string | null
          start_time: string
          user_id: string
          week_key: string
        }
        Insert: {
          created_at?: string
          day_index: number
          employee_id: string
          end_time: string
          id?: string
          role?: string | null
          start_time: string
          user_id: string
          week_key: string
        }
        Update: {
          created_at?: string
          day_index?: number
          employee_id?: string
          end_time?: string
          id?: string
          role?: string | null
          start_time?: string
          user_id?: string
          week_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_slots_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      product_catalog: {
        Row: {
          category: string
          created_at: string
          default_dlc_days: number
          id: string
          product_name: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          default_dlc_days?: number
          id?: string
          product_name: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          default_dlc_days?: number
          id?: string
          product_name?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          categorie: string
          created_at: string
          dlc: string
          fab: string | null
          id: string
          nom: string
          photo_url: string | null
          quantite: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categorie?: string
          created_at?: string
          dlc: string
          fab?: string | null
          id?: string
          nom: string
          photo_url?: string | null
          quantite?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categorie?: string
          created_at?: string
          dlc?: string
          fab?: string | null
          id?: string
          nom?: string
          photo_url?: string | null
          quantite?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          address: string | null
          cgu_accepted_at: string | null
          cgv_accepted_at: string | null
          city: string | null
          created_at: string
          email: string | null
          establishment_name: string
          has_manager_pin: boolean | null
          id: string
          legal_documents_version: string | null
          manager_name: string | null
          manager_pin_hash: string | null
          onboarding_completed: boolean
          phone: string | null
          planning_session_minutes: number
          postal_code: string | null
          privacy_policy_accepted_at: string | null
          siret: string | null
          subscription_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          cgu_accepted_at?: string | null
          cgv_accepted_at?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          establishment_name?: string
          has_manager_pin?: boolean | null
          id?: string
          legal_documents_version?: string | null
          manager_name?: string | null
          manager_pin_hash?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          planning_session_minutes?: number
          postal_code?: string | null
          privacy_policy_accepted_at?: string | null
          siret?: string | null
          subscription_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          cgu_accepted_at?: string | null
          cgv_accepted_at?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          establishment_name?: string
          has_manager_pin?: boolean | null
          id?: string
          legal_documents_version?: string | null
          manager_name?: string | null
          manager_pin_hash?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          planning_session_minutes?: number
          postal_code?: string | null
          privacy_policy_accepted_at?: string | null
          siret?: string | null
          subscription_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      temperature_logs: {
        Row: {
          created_at: string
          equipment_name: string
          id: string
          log_date: string
          period: string
          temperature: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment_name: string
          id?: string
          log_date?: string
          period: string
          temperature: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipment_name?: string
          id?: string
          log_date?: string
          period?: string
          temperature?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          arrival_ts: number | null
          created_at: string
          departure_ts: number | null
          employee_id: string
          id: string
          user_id: string
          work_date: string
        }
        Insert: {
          arrival_ts?: number | null
          created_at?: string
          departure_ts?: number | null
          employee_id: string
          id?: string
          user_id: string
          work_date: string
        }
        Update: {
          arrival_ts?: number | null
          created_at?: string
          departure_ts?: number | null
          employee_id?: string
          id?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      traceability_photos: {
        Row: {
          categorie: string
          created_at: string
          id: string
          photo_url: string
          product_id: string | null
          product_name: string
          user_id: string
        }
        Insert: {
          categorie?: string
          created_at?: string
          id?: string
          photo_url: string
          product_id?: string | null
          product_name: string
          user_id: string
        }
        Update: {
          categorie?: string
          created_at?: string
          id?: string
          photo_url?: string
          product_id?: string | null
          product_name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_audit_logs: { Args: never; Returns: undefined }
      cleanup_old_traceability_photos: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
