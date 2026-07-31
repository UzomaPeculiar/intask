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
      alumni_pro_subscriptions: {
        Row: {
          alumni_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          paystack_reference: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          alumni_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          paystack_reference?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          alumni_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          paystack_reference?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alumni_pro_subscriptions_alumni_id_fkey"
            columns: ["alumni_id"]
            isOneToOne: true
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alumni_pro_subscriptions_alumni_id_fkey"
            columns: ["alumni_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          id: string
          message: string
          proposed_rate: number | null
          status: Database["public"]["Enums"]["application_status"]
          student_id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          proposed_rate?: number | null
          status?: Database["public"]["Enums"]["application_status"]
          student_id: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          proposed_rate?: number | null
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
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at: string | null
          id: string
          is_default: boolean | null
          paystack_recipient_code: string | null
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          paystack_recipient_code?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string
          bank_name?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          paystack_recipient_code?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      company_subscriptions: {
        Row: {
          company_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          paystack_reference: string | null
          plan_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          paystack_reference?: string | null
          plan_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          paystack_reference?: string | null
          plan_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
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
      course_enrollments: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          course_id: string | null
          enrolled_at: string | null
          id: string
          paystack_reference: string | null
          progress: number | null
          student_id: string | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          course_id?: string | null
          enrolled_at?: string | null
          id?: string
          paystack_reference?: string | null
          progress?: number | null
          student_id?: string | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          course_id?: string | null
          enrolled_at?: string | null
          id?: string
          paystack_reference?: string | null
          progress?: number | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          content: string | null
          course_id: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          is_free_preview: boolean | null
          order_index: number | null
          title: string
          video_url: string | null
        }
        Insert: {
          content?: string | null
          course_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_free_preview?: boolean | null
          order_index?: number | null
          title: string
          video_url?: string | null
        }
        Update: {
          content?: string | null
          course_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_free_preview?: boolean | null
          order_index?: number | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          enrollment_id: string | null
          id: string
          lesson_id: string | null
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          enrollment_id?: string | null
          id?: string
          lesson_id?: string | null
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          enrollment_id?: string | null
          id?: string
          lesson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          created_at: string | null
          description: string
          duration_hours: number | null
          enrolled_count: number | null
          id: string
          instructor_id: string | null
          is_free: boolean | null
          level: string | null
          price: number
          status: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          duration_hours?: number | null
          enrolled_count?: number | null
          id?: string
          instructor_id?: string | null
          is_free?: boolean | null
          level?: string | null
          price?: number
          status?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          duration_hours?: number | null
          enrolled_count?: number | null
          id?: string
          instructor_id?: string | null
          is_free?: boolean | null
          level?: string | null
          price?: number
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string | null
          details: string | null
          id: string
          raised_by: string | null
          reason: string
          resolution: string | null
          status: string | null
          task_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: string
          raised_by?: string | null
          reason: string
          resolution?: string | null
          status?: string | null
          task_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: string
          raised_by?: string | null
          reason?: string
          resolution?: string | null
          status?: string | null
          task_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      internship_applications: {
        Row: {
          cover_letter: string | null
          created_at: string | null
          id: string
          internship_id: string | null
          resume_url: string | null
          status: string | null
          student_id: string | null
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string | null
          id?: string
          internship_id?: string | null
          resume_url?: string | null
          status?: string | null
          student_id?: string | null
        }
        Update: {
          cover_letter?: string | null
          created_at?: string | null
          id?: string
          internship_id?: string | null
          resume_url?: string | null
          status?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internship_applications_internship_id_fkey"
            columns: ["internship_id"]
            isOneToOne: false
            referencedRelation: "internships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internship_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internships: {
        Row: {
          company_name: string
          created_at: string | null
          deadline: string | null
          description: string
          duration: string
          id: string
          location: string
          paid: boolean | null
          poster_id: string | null
          requirements: string | null
          skills_needed: string[] | null
          status: string | null
          stipend: number | null
          stipend_negotiable: boolean | null
          title: string
          updated_at: string | null
          work_type: string | null
        }
        Insert: {
          company_name: string
          created_at?: string | null
          deadline?: string | null
          description: string
          duration: string
          id?: string
          location: string
          paid?: boolean | null
          poster_id?: string | null
          requirements?: string | null
          skills_needed?: string[] | null
          status?: string | null
          stipend?: number | null
          stipend_negotiable?: boolean | null
          title: string
          updated_at?: string | null
          work_type?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string | null
          deadline?: string | null
          description?: string
          duration?: string
          id?: string
          location?: string
          paid?: boolean | null
          poster_id?: string | null
          requirements?: string | null
          skills_needed?: string[] | null
          status?: string | null
          stipend?: number | null
          stipend_negotiable?: boolean | null
          title?: string
          updated_at?: string | null
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internships_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internships_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_bookings: {
        Row: {
          created_at: string | null
          id: string
          mentee_id: string | null
          mentor_id: string | null
          notes: string | null
          scheduled_at: string | null
          service_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentee_id?: string | null
          mentor_id?: string | null
          notes?: string | null
          scheduled_at?: string | null
          service_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mentee_id?: string | null
          mentor_id?: string | null
          notes?: string | null
          scheduled_at?: string | null
          service_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_bookings_mentee_id_fkey"
            columns: ["mentee_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_bookings_mentee_id_fkey"
            columns: ["mentee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_bookings_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_bookings_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "mentorship_services"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorship_services: {
        Row: {
          active: boolean | null
          category: string
          created_at: string | null
          description: string
          duration_minutes: number | null
          id: string
          mentor_id: string | null
          price: number
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category: string
          created_at?: string | null
          description: string
          duration_minutes?: number | null
          id?: string
          mentor_id?: string | null
          price: number
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string
          created_at?: string | null
          description?: string
          duration_minutes?: number | null
          id?: string
          mentor_id?: string | null
          price?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentorship_services_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorship_services_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      nigerian_banks: {
        Row: {
          active: boolean | null
          code: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          code: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
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
          is_admin: boolean | null
          location: string | null
          occupation: string | null
          onboarded: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_admin?: boolean | null
          location?: string | null
          occupation?: string | null
          onboarded?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_admin?: boolean | null
          location?: string | null
          occupation?: string | null
          onboarded?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      project_room_files: {
        Row: {
          created_at: string | null
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          room_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          room_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          room_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_room_files_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "project_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_room_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_room_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_room_members: {
        Row: {
          id: string
          joined_at: string | null
          role: string | null
          room_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          role?: string | null
          room_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          role?: string | null
          room_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "project_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_room_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_room_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_room_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          room_id: string | null
          sender_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          room_id?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          room_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "project_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_room_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_room_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_rooms: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          status: string | null
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string | null
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_rooms_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          details: string | null
          id: string
          reason: string
          reported_id: string | null
          reporter_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason: string
          reported_id?: string | null
          reporter_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string
          reported_id?: string | null
          reporter_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      saved_tasks: {
        Row: {
          created_at: string | null
          id: string
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_assessments: {
        Row: {
          created_at: string | null
          description: string
          id: string
          passing_score: number | null
          questions: Json
          skill: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          passing_score?: number | null
          questions: Json
          skill: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          passing_score?: number | null
          questions?: Json
          skill?: string
          title?: string
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          created_at: string
          department: string | null
          id_upload_path: string | null
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
          verification_status: string | null
          verified: boolean
          year_of_study: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          id_upload_path?: string | null
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
          verification_status?: string | null
          verified?: boolean
          year_of_study?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          id_upload_path?: string | null
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
          verification_status?: string | null
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
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          link: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          link?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
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
      student_skill_badges: {
        Row: {
          attempts: number | null
          earned_at: string | null
          id: string
          passed: boolean | null
          score: number
          skill: string
          user_id: string | null
        }
        Insert: {
          attempts?: number | null
          earned_at?: string | null
          id?: string
          passed?: boolean | null
          score: number
          skill: string
          user_id?: string | null
        }
        Update: {
          attempts?: number | null
          earned_at?: string | null
          id?: string
          passed?: boolean | null
          score?: number
          skill?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_skill_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_skill_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_cycle: string | null
          can_search_talent: boolean | null
          created_at: string | null
          description: string | null
          featured_posts: number | null
          id: string
          max_active_posts: number | null
          name: string
          price: number
          priority_support: boolean | null
        }
        Insert: {
          billing_cycle?: string | null
          can_search_talent?: boolean | null
          created_at?: string | null
          description?: string | null
          featured_posts?: number | null
          id?: string
          max_active_posts?: number | null
          name: string
          price: number
          priority_support?: boolean | null
        }
        Update: {
          billing_cycle?: string | null
          can_search_talent?: boolean | null
          created_at?: string | null
          description?: string | null
          featured_posts?: number | null
          id?: string
          max_active_posts?: number | null
          name?: string
          price?: number
          priority_support?: boolean | null
        }
        Relationships: []
      }
      talent_searches: {
        Row: {
          created_at: string | null
          filters: Json | null
          id: string
          query: string | null
          searcher_id: string | null
        }
        Insert: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          query?: string | null
          searcher_id?: string | null
        }
        Update: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          query?: string | null
          searcher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_searches_searcher_id_fkey"
            columns: ["searcher_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_searches_searcher_id_fkey"
            columns: ["searcher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_unlocks: {
        Row: {
          created_at: string | null
          id: string
          searcher_id: string | null
          student_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          searcher_id?: string | null
          student_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          searcher_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_unlocks_searcher_id_fkey"
            columns: ["searcher_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_unlocks_searcher_id_fkey"
            columns: ["searcher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_unlocks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_unlocks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_team_members: {
        Row: {
          created_at: string | null
          id: string
          payment_share: number | null
          role: string | null
          status: string | null
          student_id: string | null
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          payment_share?: number | null
          role?: string | null
          status?: string | null
          student_id?: string | null
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          payment_share?: number | null
          role?: string | null
          status?: string | null
          student_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_team_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_team_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_team_members_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
          featured: boolean | null
          featured_set_at: string | null
          featured_until: string | null
          id: string
          is_team_task: boolean | null
          matched_student_id: string | null
          poster_id: string
          revision_notes: string | null
          skills_needed: string[]
          status: Database["public"]["Enums"]["task_status"]
          team_members: Json | null
          team_size: number | null
          title: string
          updated_at: string
          view_count: number | null
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
          featured?: boolean | null
          featured_set_at?: string | null
          featured_until?: string | null
          id?: string
          is_team_task?: boolean | null
          matched_student_id?: string | null
          poster_id: string
          revision_notes?: string | null
          skills_needed?: string[]
          status?: Database["public"]["Enums"]["task_status"]
          team_members?: Json | null
          team_size?: number | null
          title: string
          updated_at?: string
          view_count?: number | null
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
          featured?: boolean | null
          featured_set_at?: string | null
          featured_until?: string | null
          id?: string
          is_team_task?: boolean | null
          matched_student_id?: string | null
          poster_id?: string
          revision_notes?: string | null
          skills_needed?: string[]
          status?: Database["public"]["Enums"]["task_status"]
          team_members?: Json | null
          team_size?: number | null
          title?: string
          updated_at?: string
          view_count?: number | null
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
      university_partnerships: {
        Row: {
          contact_email: string
          contact_name: string
          created_at: string | null
          id: string
          notes: string | null
          status: string | null
          students_count: number | null
          tasks_completed: number | null
          total_earned: number | null
          university_name: string
          updated_at: string | null
        }
        Insert: {
          contact_email: string
          contact_name: string
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          students_count?: number | null
          tasks_completed?: number | null
          total_earned?: number | null
          university_name: string
          updated_at?: string | null
        }
        Update: {
          contact_email?: string
          contact_name?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          students_count?: number | null
          tasks_completed?: number | null
          total_earned?: number | null
          university_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      wallet_funding: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          paystack_reference: string
          status: string | null
          updated_at: string | null
          user_id: string | null
          wallet_id: string | null
          webhook_processed: boolean | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          paystack_reference: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_id?: string | null
          webhook_processed?: boolean | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          paystack_reference?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_id?: string | null
          webhook_processed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_funding_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_funding_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_funding_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          paystack_reference: string | null
          reference: string | null
          status: string | null
          type: string
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          paystack_reference?: string | null
          reference?: string | null
          status?: string | null
          type: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          paystack_reference?: string | null
          reference?: string | null
          status?: string | null
          type?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          total_earned: number | null
          total_withdrawn: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          total_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          total_earned?: number | null
          total_withdrawn?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          account_name: string
          account_number: string
          amount: number
          bank_account_id: string | null
          bank_name: string
          created_at: string | null
          failure_reason: string | null
          fee: number | null
          id: string
          net_amount: number | null
          notes: string | null
          paystack_transfer_code: string | null
          processed_at: string | null
          recipient_code: string | null
          reference: string | null
          status: string | null
          user_id: string | null
          wallet_id: string | null
          webhook_processed: boolean | null
        }
        Insert: {
          account_name: string
          account_number: string
          amount: number
          bank_account_id?: string | null
          bank_name: string
          created_at?: string | null
          failure_reason?: string | null
          fee?: number | null
          id?: string
          net_amount?: number | null
          notes?: string | null
          paystack_transfer_code?: string | null
          processed_at?: string | null
          recipient_code?: string | null
          reference?: string | null
          status?: string | null
          user_id?: string | null
          wallet_id?: string | null
          webhook_processed?: boolean | null
        }
        Update: {
          account_name?: string
          account_number?: string
          amount?: number
          bank_account_id?: string | null
          bank_name?: string
          created_at?: string | null
          failure_reason?: string | null
          fee?: number | null
          id?: string
          net_amount?: number | null
          notes?: string | null
          paystack_transfer_code?: string | null
          processed_at?: string | null
          recipient_code?: string | null
          reference?: string | null
          status?: string | null
          user_id?: string | null
          wallet_id?: string | null
          webhook_processed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "my_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
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
      credit_wallet: {
        Args: {
          p_amount: number
          p_description: string
          p_reference?: string
          p_user_id: string
        }
        Returns: undefined
      }
      debit_wallet_atomic: {
        Args: {
          p_amount: number
          p_description: string
          p_reference: string
          p_user_id: string
        }
        Returns: Json
      }
      expire_old_tasks: { Args: never; Returns: undefined }
      get_task_applicant_count: { Args: { task_uuid: string }; Returns: number }
      increment_task_views: { Args: { task_uuid: string }; Returns: undefined }
      reverse_wallet_debit: {
        Args: {
          p_amount: number
          p_description: string
          p_reference: string
          p_user_id: string
        }
        Returns: undefined
      }
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
        | "expired"
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
        "expired",
      ],
      transaction_status: ["pending", "in_escrow", "released", "refunded"],
      user_role: ["student", "alumni", "company", "individual"],
      verification_method: ["email", "id_upload"],
      work_type: ["remote", "on_campus", "either"],
    },
  },
} as const
