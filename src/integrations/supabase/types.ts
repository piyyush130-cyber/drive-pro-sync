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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          admin_notes: string | null
          created_at: string
          deleted_at: string | null
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
          school_id: string
          status: Database["public"]["Enums"]["booking_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          deleted_at?: string | null
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
          school_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          deleted_at?: string | null
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
          school_id?: string
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
            foreignKeyName: "bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string
          status: Database["public"]["Enums"]["cancel_status"]
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          reason?: string | null
          resolved_at?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["cancel_status"]
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          resolved_at?: string | null
          school_id?: string
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
          {
            foreignKeyName: "cancellation_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string
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
          school_id: string
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
          school_id?: string
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
          {
            foreignKeyName: "instructor_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string
          start_time: string | null
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          instructor_id: string
          reason?: string | null
          school_id: string
          start_time?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          instructor_id?: string
          reason?: string | null
          school_id?: string
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
          {
            foreignKeyName: "instructor_blocked_times_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          school_id: string
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
          school_id: string
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
          school_id?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "instructor_invite_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          active: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          invite_code_used: string | null
          notes: string | null
          phone: string | null
          profile_id: string | null
          school_id: string
          status: Database["public"]["Enums"]["instructor_status"]
          updated_at: string
          weekly_availability: Json
        }
        Insert: {
          active?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          invite_code_used?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["instructor_status"]
          updated_at?: string
          weekly_availability?: Json
        }
        Update: {
          active?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          invite_code_used?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["instructor_status"]
          updated_at?: string
          weekly_availability?: Json
        }
        Relationships: [
          {
            foreignKeyName: "instructors_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_invitations: {
        Row: {
          booked_at: string | null
          booking_id: string | null
          created_at: string
          id: string
          reminder_sent_at: string | null
          school_id: string
          sent_at: string
          status: Database["public"]["Enums"]["invitation_status"]
          student_id: string
          token: string
        }
        Insert: {
          booked_at?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          reminder_sent_at?: string | null
          school_id: string
          sent_at?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          student_id: string
          token?: string
        }
        Update: {
          booked_at?: string | null
          booking_id?: string | null
          created_at?: string
          id?: string
          reminder_sent_at?: string | null
          school_id?: string
          sent_at?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          student_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_invitations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_invitations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          instructor_id: string
          next_focus: string | null
          practiced_skills: string | null
          road_test_readiness:
            | Database["public"]["Enums"]["road_test_readiness"]
            | null
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          instructor_id: string
          next_focus?: string | null
          practiced_skills?: string | null
          road_test_readiness?:
            | Database["public"]["Enums"]["road_test_readiness"]
            | null
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          instructor_id?: string
          next_focus?: string | null
          practiced_skills?: string | null
          road_test_readiness?:
            | Database["public"]["Enums"]["road_test_readiness"]
            | null
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
          school_id: string
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
          school_id: string
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
          school_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_owners: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      policy_acceptances: {
        Row: {
          accepted_at: string
          id: string
          policy_type: Database["public"]["Enums"]["policy_type"]
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          policy_type: Database["public"]["Enums"]["policy_type"]
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          id?: string
          policy_type?: Database["public"]["Enums"]["policy_type"]
          user_id?: string
          version?: string
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
      school_billing: {
        Row: {
          billing_interval:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          billing_status: Database["public"]["Enums"]["billing_status"]
          grace_period_ends_at: string | null
          plan: Database["public"]["Enums"]["plan_key"] | null
          school_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_interval?:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          billing_status?: Database["public"]["Enums"]["billing_status"]
          grace_period_ends_at?: string | null
          plan?: Database["public"]["Enums"]["plan_key"] | null
          school_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          billing_status?: Database["public"]["Enums"]["billing_status"]
          grace_period_ends_at?: string | null
          plan?: Database["public"]["Enums"]["plan_key"] | null
          school_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_billing_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          auto_assign_instructor: boolean
          auto_invitations_enabled: boolean
          booking_paused: boolean
          cancellation_fee_cents: number
          cancellation_notice_hours: number
          cancellation_policy: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          default_buffer_minutes: number
          default_duration_minutes: number
          deposit_cents: number
          deposit_required: boolean
          logo_url: string | null
          onboarding_complete: boolean
          province: string | null
          require_approval: boolean
          school_id: string
          school_name: string
          service_area: string | null
          updated_at: string
        }
        Insert: {
          auto_assign_instructor?: boolean
          auto_invitations_enabled?: boolean
          booking_paused?: boolean
          cancellation_fee_cents?: number
          cancellation_notice_hours?: number
          cancellation_policy?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          default_buffer_minutes?: number
          default_duration_minutes?: number
          deposit_cents?: number
          deposit_required?: boolean
          logo_url?: string | null
          onboarding_complete?: boolean
          province?: string | null
          require_approval?: boolean
          school_id: string
          school_name?: string
          service_area?: string | null
          updated_at?: string
        }
        Update: {
          auto_assign_instructor?: boolean
          auto_invitations_enabled?: boolean
          booking_paused?: boolean
          cancellation_fee_cents?: number
          cancellation_notice_hours?: number
          cancellation_policy?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          default_buffer_minutes?: number
          default_duration_minutes?: number
          deposit_cents?: number
          deposit_required?: boolean
          logo_url?: string | null
          onboarding_complete?: boolean
          province?: string | null
          require_approval?: boolean
          school_id?: string
          school_name?: string
          service_area?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      student_login_links: {
        Row: {
          contact_method: string
          created_at: string
          expires_at: string
          id: string
          school_id: string
          student_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          contact_method: string
          created_at?: string
          expires_at: string
          id?: string
          school_id: string
          student_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          contact_method?: string
          created_at?: string
          expires_at?: string
          id?: string
          school_id?: string
          student_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_login_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_login_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_progress: {
        Row: {
          general_notes: string | null
          id: string
          road_test_ready: boolean
          school_id: string
          skills: Json
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          general_notes?: string | null
          id?: string
          road_test_ready?: boolean
          school_id: string
          skills?: Json
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          general_notes?: string | null
          id?: string
          road_test_ready?: boolean
          school_id?: string
          skills?: Json
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_used_at: string
          revoked_at: string | null
          school_id: string
          student_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string
          revoked_at?: string | null
          school_id: string
          student_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string
          revoked_at?: string | null
          school_id?: string
          student_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          incident_notes: string | null
          lessons_purchased: number
          notes: string | null
          phone: string | null
          pickup_address: string | null
          profile_id: string | null
          road_test_notes: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          incident_notes?: string | null
          lessons_purchased?: number
          notes?: string | null
          phone?: string | null
          pickup_address?: string | null
          profile_id?: string | null
          road_test_notes?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          incident_notes?: string | null
          lessons_purchased?: number
          notes?: string | null
          phone?: string | null
          pickup_address?: string | null
          profile_id?: string | null
          road_test_notes?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
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
      has_role_in_school: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _school_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_owner: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "instructor" | "student"
      billing_interval: "monthly" | "annual"
      billing_status:
        | "trialing"
        | "active"
        | "past_due"
        | "grace_period"
        | "locked"
        | "free_forever"
        | "suspended"
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
      invitation_status: "sent" | "reminded" | "booked" | "expired"
      payment_method: "cash" | "etransfer" | "card" | "other"
      payment_status: "unpaid" | "deposit_paid" | "paid" | "refunded"
      plan_key: "starter" | "professional" | "enterprise"
      policy_type: "terms_of_service" | "privacy_policy"
      road_test_readiness: "not_ready" | "improving" | "almost_ready" | "ready"
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
      billing_interval: ["monthly", "annual"],
      billing_status: [
        "trialing",
        "active",
        "past_due",
        "grace_period",
        "locked",
        "free_forever",
        "suspended",
      ],
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
      invitation_status: ["sent", "reminded", "booked", "expired"],
      payment_method: ["cash", "etransfer", "card", "other"],
      payment_status: ["unpaid", "deposit_paid", "paid", "refunded"],
      plan_key: ["starter", "professional", "enterprise"],
      policy_type: ["terms_of_service", "privacy_policy"],
      road_test_readiness: ["not_ready", "improving", "almost_ready", "ready"],
    },
  },
} as const
