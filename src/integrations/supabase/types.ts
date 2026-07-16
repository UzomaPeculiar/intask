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
      applications: {
        Row: {
          created_at: string
          id: string
          message: string
          status: Database["public"]["Enums"]["application_status"]
          student_id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          status?: Database["public"]["Enums"]["application_status"]
          student_id: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: Database["public"]["Enums"]["application_status"]
          student_id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profiles: {
        Row: {
          company_name: string
          created_at: string
          industry: string | null
          location: string | null
          updated_at: string
          user_id: string
          verified: boolean
          website: string | null
        }
        Insert: {
          company_name?: string
          created_at?: string
          industry?: string | null
          location?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
          website?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          industry?: string | null
          location?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          poster_id: string
          student_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          poster_id: string
          student_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          poster_id?: string
          student_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          file_url: string | null
          id: string
          read: boolean
          sender_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          file_url?: string | null
          id?: string
          read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          file_url?: string | null
          id?: string
          read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          onboarded: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          onboarded?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          onboarded?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          task_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          task_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          created_at: string
          department: string | null
          portfolio: Json
          rating_average: number
          rating_count: number
          skills: string[]
          tasks_completed: number
          university: string | null
          university_email: string | null
          updated_at: string
          user_id: string
          verification_doc_url: string | null
          verification_method:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verified: boolean
          year_of_study: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          portfolio?: Json
          rating_average?: number
          rating_count?: number
          skills?: string[]
          tasks_completed?: number
          university?: string | null
          university_email?: string | null
          updated_at?: string
          user_id: string
          verification_doc_url?: string | null
          verification_method?:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verified?: boolean
          year_of_study?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          portfolio?: Json
          rating_average?: number
          rating_count?: number
          skills?: string[]
          tasks_completed?: number
          university?: string | null
          university_email?: string | null
          updated_at?: string
          user_id?: string
          verification_doc_url?: string | null
          verification_method?:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verified?: boolean
          year_of_study?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          link: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          link?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          link?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          applicants_count: number
          budget: number
          budget_negotiable: boolean
          category: string
          created_at: string
          deadline: string | null
          delivery_approved_at: string | null
          delivery_message: string | null
          delivery_submitted_at: string | null
          delivery_url: string | null
          description: string
          id: string
          matched_student_id: string | null
          poster_id: string
          revision_notes: string | null
          skills_needed: string[]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        Insert: {
          applicants_count?: number
          budget?: number
          budget_negotiable?: boolean
          category: string
          created_at?: string
          deadline?: string | null
          delivery_approved_at?: string | null
          delivery_message?: string | null
          delivery_submitted_at?: string | null
          delivery_url?: string | null
          description: string
          id?: string
          matched_student_id?: string | null
          poster_id: string
          revision_notes?: string | null
          skills_needed?: string[]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          work_type?: Database["public"]["Enums"]["work_type"]
        }
        Update: {
          applicants_count?: number
          budget?: number
          budget_negotiable?: boolean
          category?: string
          created_at?: string
          deadline?: string | null
          delivery_approved_at?: string | null
          delivery_message?: string | null
          delivery_submitted_at?: string | null
          delivery_url?: string | null
          description?: string
          id?: string
          matched_student_id?: string | null
          poster_id?: string
          revision_notes?: string | null
          skills_needed?: string[]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          work_type?: Database["public"]["Enums"]["work_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tasks_matched_student_id_fkey"
            columns: ["matched_student_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_matched_student_id_fkey"
            columns: ["matched_student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          paystack_reference: string | null
          platform_fee: number
          poster_id: string
          status: Database["public"]["Enums"]["transaction_status"]
          student_id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          paystack_reference?: string | null
          platform_fee?: number
          poster_id: string
          status?: Database["public"]["Enums"]["transaction_status"]
          student_id: string
          task_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paystack_reference?: string | null
          platform_fee?: number
          poster_id?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          student_id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      my_profile: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          onboarded: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          onboarded?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          onboarded?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      my_student_profile: {
        Row: {
          created_at: string | null
          department: string | null
          portfolio: Json | null
          rating_average: number | null
          rating_count: number | null
          skills: string[] | null
          tasks_completed: number | null
          university: string | null
          university_email: string | null
          updated_at: string | null
          user_id: string | null
          verification_doc_url: string | null
          verification_method:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verified: boolean | null
          year_of_study: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          portfolio?: Json | null
          rating_average?: number | null
          rating_count?: number | null
          skills?: string[] | null
          tasks_completed?: number | null
          university?: string | null
          university_email?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_doc_url?: string | null
          verification_method?:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verified?: boolean | null
          year_of_study?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          portfolio?: Json | null
          rating_average?: number | null
          rating_count?: number | null
          skills?: string[] | null
          tasks_completed?: number | null
          university?: string | null
          university_email?: string | null
          updated_at?: string | null
          user_id?: string | null
          verification_doc_url?: string | null
          verification_method?:
            | Database["public"]["Enums"]["verification_method"]
            | null
          verified?: boolean | null
          year_of_study?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_task_applicant_count: { Args: { _task_id: string }; Returns: number }
    }
    Enums: {
      application_status: "pending" | "accepted" | "rejected" | "withdrawn"
      task_status:
        | "open"
        | "matched"
        | "in_progress"
        | "in_review"
        | "completed"
        | "disputed"
        | "cancelled"
      transaction_status: "pending" | "in_escrow" | "released" | "refunded"
      user_role: "student" | "alumni" | "company" | "individual"
      verification_method: "email" | "id_upload"
      work_type: "remote" | "on_campus" | "either"
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
      application_status: ["pending", "accepted", "rejected", "withdrawn"],
      task_status: [
        "open",
        "matched",
        "in_progress",
        "in_review",
        "completed",
        "disputed",
        "cancelled",
      ],
      transaction_status: ["pending", "in_escrow", "released", "refunded"],
      user_role: ["student", "alumni", "company", "individual"],
      verification_method: ["email", "id_upload"],
      work_type: ["remote", "on_campus", "either"],
    },
  },
} as const
