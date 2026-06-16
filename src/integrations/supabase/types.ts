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
      bookings: {
        Row: {
          admin_notes: string | null
          created_at: string
          dropoff_address: string | null
          duration_minutes: number
          id: string
          instructor_id: string | null
          lesson_notes: string | null
          lesson_type_id: string | null
          notes: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_address: string | null
          price_cents: number
          scheduled_at: string
          status: Database["public"]["Enums"]["booking_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          dropoff_address?: string | null
          duration_minutes?: number
          id?: string
          instructor_id?: string | null
          lesson_notes?: string | null
          lesson_type_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_address?: string | null
          price_cents?: number
          scheduled_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          dropoff_address?: string | null
          duration_minutes?: number
          id?: string
          instructor_id?: string | null
          lesson_notes?: string | null
          lesson_type_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_address?: string | null
          price_cents?: number
          scheduled_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_lesson_type_id_fkey"
            columns: ["lesson_type_id"]
            isOneToOne: false
            referencedRelation: "lesson_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_requests: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          reason: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["cancel_status"]
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          reason?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["cancel_status"]
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["cancel_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_availability: {
        Row: {
          break_end: string | null
          break_start: string | null
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          instructor_id: string
          is_available: boolean
          max_lessons_per_day: number | null
          notes: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          instructor_id: string
          is_available?: boolean
          max_lessons_per_day?: number | null
          notes?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          instructor_id?: string
          is_available?: boolean
          max_lessons_per_day?: number | null
          notes?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_availability_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_blocked_times: {
        Row: {
          created_at: string
          date: string
          end_time: string | null
          id: string
          instructor_id: string
          reason: string | null
          start_time: string | null
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          instructor_id: string
          reason?: string | null
          start_time?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          instructor_id?: string
          reason?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_blocked_times_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      instructors: {
        Row: {
          active: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          invite_code_used: string | null
          notes: string | null
          phone: string | null
          profile_id: string | null
          status: Database["public"]["Enums"]["instructor_status"]
          updated_at: string
          weekly_availability: Json
        }
        Insert: {
          active?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          invite_code_used?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["instructor_status"]
          updated_at?: string
          weekly_availability?: Json
        }
        Update: {
          active?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          invite_code_used?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["instructor_status"]
          updated_at?: string
          weekly_availability?: Json
        }
        Relationships: []
      }
      lesson_types: {
        Row: {
          active: boolean
          buffer_minutes: number
          category: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price_cents: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          buffer_minutes?: number
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name: string
          price_cents?: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          buffer_minutes?: number
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price_cents?: number
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      school_settings: {
        Row: {
          cancellation_policy: string | null
          contact_email: string | null
          contact_phone: string | null
          default_buffer_minutes: number
          default_duration_minutes: number
          id: number
          logo_url: string | null
          require_approval: boolean
          school_name: string
          service_area: string | null
          updated_at: string
        }
        Insert: {
          cancellation_policy?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          default_buffer_minutes?: number
          default_duration_minutes?: number
          id?: number
          logo_url?: string | null
          require_approval?: boolean
          school_name?: string
          service_area?: string | null
          updated_at?: string
        }
        Update: {
          cancellation_policy?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          default_buffer_minutes?: number
          default_duration_minutes?: number
          id?: number
          logo_url?: string | null
          require_approval?: boolean
          school_name?: string
          service_area?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      student_progress: {
        Row: {
          general_notes: string | null
          id: string
          road_test_ready: boolean
          skills: Json
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          general_notes?: string | null
          id?: string
          road_test_ready?: boolean
          skills?: Json
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          general_notes?: string | null
          id?: string
          road_test_ready?: boolean
          skills?: Json
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          lessons_purchased: number
          notes: string | null
          phone: string | null
          pickup_address: string | null
          profile_id: string | null
          road_test_notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          lessons_purchased?: number
          notes?: string | null
          phone?: string | null
          pickup_address?: string | null
          profile_id?: string | null
          road_test_notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          lessons_purchased?: number
          notes?: string | null
          phone?: string | null
          pickup_address?: string | null
          profile_id?: string | null
          road_test_notes?: string | null
          updated_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "instructor" | "student"
      booking_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "rescheduled"
        | "cancelled"
        | "completed"
        | "no_show"
      cancel_status: "requested" | "approved" | "rejected"
      instructor_status:
        | "pending_approval"
        | "active"
        | "deactivated"
        | "rejected"
      payment_method: "cash" | "etransfer" | "card" | "other"
      payment_status: "unpaid" | "deposit_paid" | "paid" | "refunded"
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
      app_role: ["admin", "instructor", "student"],
      booking_status: [
        "pending",
        "confirmed",
        "declined",
        "rescheduled",
        "cancelled",
        "completed",
        "no_show",
      ],
      cancel_status: ["requested", "approved", "rejected"],
      instructor_status: [
        "pending_approval",
        "active",
        "deactivated",
        "rejected",
      ],
      payment_method: ["cash", "etransfer", "card", "other"],
      payment_status: ["unpaid", "deposit_paid", "paid", "refunded"],
    },
  },
} as const
