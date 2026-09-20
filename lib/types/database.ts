export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      institutions: {
        Row: {
          id: string;
          name: string;
          code: string;
          address: string | null;
          phone: string | null;
          email: string | null;
          logo_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["institutions"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          institution_id: string | null;
          first_name: string;
          last_name: string;
          phone: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          institution_id?: string | null;
          first_name?: string;
          last_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      roles: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
      };
      permissions: {
        Row: {
          id: string;
          code: string;
          name: string;
          module: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          module: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["permissions"]["Insert"]>;
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
        };
        Insert: {
          role_id: string;
          permission_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["role_permissions"]["Insert"]>;
      };
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          institution_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
          institution_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
      };
      applicants: {
        Row: {
          id: string;
          institution_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          status: "new" | "reviewing" | "admitted" | "rejected" | "waitlisted";
          application_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          status?: string;
          application_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["applicants"]["Insert"]>;
      };
      students: {
        Row: {
          id: string;
          profile_id: string | null;
          institution_id: string;
          applicant_id: string | null;
          student_number: string;
          admission_date: string;
          status: "active" | "graduated" | "withdrawn" | "suspended" | "expelled";
          civility: string | null;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          birth_date: string | null;
          birth_place: string | null;
          gender: string | null;
          nationality: string | null;
          marital_status: string | null;
          address: string | null;
          emergency_contact_name: string | null;
          emergency_contact_relation: string | null;
          emergency_contact_phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          institution_id: string;
          applicant_id?: string | null;
          student_number: string;
          admission_date?: string;
          status?: string;
          civility?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          birth_date?: string | null;
          birth_place?: string | null;
          gender?: string | null;
          nationality?: string | null;
          marital_status?: string | null;
          address?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_relation?: string | null;
          emergency_contact_phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Insert"]>;
      };
      teachers: {
        Row: {
          id: string;
          profile_id: string | null;
          institution_id: string;
          teacher_number: string;
          specialization: string | null;
          status: "active" | "inactive" | "on_leave";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          institution_id: string;
          teacher_number: string;
          specialization?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["teachers"]["Insert"]>;
      };
      academic_years: {
        Row: {
          id: string;
          institution_id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          name: string;
          start_date: string;
          end_date: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["academic_years"]["Insert"]>;
      };
      terms: {
        Row: {
          id: string;
          academic_year_id: string;
          name: string;
          start_date: string;
          end_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          academic_year_id: string;
          name: string;
          start_date: string;
          end_date: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["terms"]["Insert"]>;
      };
      programs: {
        Row: {
          id: string;
          institution_id: string;
          name: string;
          code: string;
          description: string | null;
          duration_years: number;
          admission_requirements: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          name: string;
          code: string;
          description?: string | null;
          duration_years?: number;
          admission_requirements?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["programs"]["Insert"]>;
      };
      modules: {
        Row: {
          id: string;
          program_id: string;
          name: string;
          code: string;
          semester: number;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          name: string;
          code: string;
          semester?: number;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["modules"]["Insert"]>;
      };
      subjects: {
        Row: {
          id: string;
          module_id: string;
          name: string;
          code: string;
          hours_planned: number;
          coefficient: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          name: string;
          code: string;
          hours_planned?: number;
          coefficient?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subjects"]["Insert"]>;
      };
      courses: {
        Row: {
          id: string;
          institution_id: string;
          program_id: string;
          academic_year_id: string;
          name: string;
          tuition_fee: number;
          enrollment_fee: number;
          start_date: string | null;
          end_date: string | null;
          status: "planned" | "active" | "completed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          program_id: string;
          academic_year_id: string;
          name: string;
          tuition_fee?: number;
          enrollment_fee?: number;
          start_date?: string | null;
          end_date?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["courses"]["Insert"]>;
      };
      classes: {
        Row: {
          id: string;
          institution_id: string;
          course_id: string;
          academic_year_id: string;
          name: string;
          capacity: number;
          room: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          course_id: string;
          academic_year_id: string;
          name: string;
          capacity?: number;
          room?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["classes"]["Insert"]>;
      };
      enrollments: {
        Row: {
          id: string;
          student_id: string;
          course_id: string;
          class_id: string;
          academic_year_id: string;
          enrollment_date: string;
          status: "pending" | "active" | "completed" | "withdrawn" | "transferred";
          previous_enrollment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          course_id: string;
          class_id: string;
          academic_year_id: string;
          enrollment_date?: string;
          status?: string;
          previous_enrollment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["enrollments"]["Insert"]>;
      };
      class_transfers: {
        Row: {
          id: string;
          enrollment_id: string;
          student_id: string;
          from_class_id: string;
          to_class_id: string;
          academic_year_id: string;
          transfer_date: string;
          reason: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          enrollment_id: string;
          student_id: string;
          from_class_id: string;
          to_class_id: string;
          academic_year_id: string;
          transfer_date?: string;
          reason?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["class_transfers"]["Insert"]>;
      };
      schedules: {
        Row: {
          id: string;
          institution_id: string;
          class_id: string;
          subject_id: string;
          teacher_id: string | null;
          academic_year_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          room: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          class_id: string;
          subject_id: string;
          teacher_id?: string | null;
          academic_year_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          room?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["schedules"]["Insert"]>;
      };
      attendance: {
        Row: {
          id: string;
          schedule_id: string;
          student_id: string;
          academic_year_id: string;
          date: string;
          status: "present" | "absent" | "late" | "excused";
          note: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          student_id: string;
          academic_year_id: string;
          date: string;
          status?: string;
          note?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendance"]["Insert"]>;
      };
      assessments: {
        Row: {
          id: string;
          class_id: string;
          subject_id: string;
          academic_year_id: string;
          teacher_id: string | null;
          type: "exam" | "quiz" | "homework" | "project";
          title: string;
          max_score: number;
          coefficient: number;
          date: string;
          status: "draft" | "published" | "validated";
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          subject_id: string;
          academic_year_id: string;
          teacher_id?: string | null;
          type?: string;
          title: string;
          max_score?: number;
          coefficient?: number;
          date?: string;
          status?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["assessments"]["Insert"]>;
      };
      grades: {
        Row: {
          id: string;
          assessment_id: string;
          student_id: string;
          academic_year_id: string;
          teacher_id: string | null;
          score: number;
          status: "draft" | "submitted" | "validated";
          graded_by: string;
          validated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assessment_id: string;
          student_id: string;
          academic_year_id: string;
          teacher_id?: string | null;
          score: number;
          status?: string;
          graded_by: string;
          validated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["grades"]["Insert"]>;
      };
      payment_plans: {
        Row: {
          id: string;
          institution_id: string;
          student_id: string;
          course_id: string;
          academic_year_id: string;
          enrollment_id: string | null;
          total_amount: number;
          currency: "XOF" | "EUR";
          status: "pending" | "partially_paid" | "paid" | "overdue" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          student_id: string;
          course_id: string;
          academic_year_id: string;
          enrollment_id?: string | null;
          total_amount: number;
          currency?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_plans"]["Insert"]>;
      };
      installments: {
        Row: {
          id: string;
          payment_plan_id: string;
          student_id: string;
          academic_year_id: string;
          installment_number: number;
          label: string;
          amount_due: number;
          amount_paid: number;
          due_date: string;
          status: "pending" | "partially_paid" | "paid" | "overdue" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payment_plan_id: string;
          student_id: string;
          academic_year_id: string;
          installment_number: number;
          label: string;
          amount_due: number;
          amount_paid?: number;
          due_date: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["installments"]["Insert"]>;
      };
      payments: {
        Row: {
          id: string;
          installment_id: string;
          student_id: string;
          academic_year_id: string;
          amount: number;
          payment_date: string;
          method: "cash" | "bank_transfer" | "wave" | "orange_money" | "other";
          status: "pending" | "completed" | "failed" | "cancelled";
          collected_by: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          installment_id: string;
          student_id: string;
          academic_year_id: string;
          amount: number;
          payment_date?: string;
          method?: string;
          status?: string;
          collected_by?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
      payment_transactions: {
        Row: {
          id: string;
          payment_id: string;
          provider: "manual" | "wave" | "orange_money" | "stripe" | "bank";
          provider_transaction_id: string | null;
          provider_status: string | null;
          amount: number;
          currency: "XOF" | "EUR";
          webhook_received_at: string | null;
          signature_verified: boolean;
          raw_payload: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          provider?: string;
          provider_transaction_id?: string | null;
          provider_status?: string | null;
          amount: number;
          currency?: string;
          webhook_received_at?: string | null;
          signature_verified?: boolean;
          raw_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_transactions"]["Insert"]>;
      };
      refunds: {
        Row: {
          id: string;
          payment_id: string;
          student_id: string;
          amount: number;
          refund_date: string;
          reason: string | null;
          method: "cash" | "bank_transfer" | "wave" | "orange_money" | "other";
          status: "pending" | "completed" | "cancelled";
          processed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          student_id: string;
          amount: number;
          refund_date?: string;
          reason?: string | null;
          method?: string;
          status?: string;
          processed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["refunds"]["Insert"]>;
      };
      expenses: {
        Row: {
          id: string;
          institution_id: string;
          category: string;
          description: string | null;
          amount: number;
          currency: "XOF" | "EUR";
          expense_date: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          category: string;
          description?: string | null;
          amount: number;
          currency?: string;
          expense_date?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
      };
      documents: {
        Row: {
          id: string;
          institution_id: string;
          category: string;
          name: string;
          storage_path: string;
          mime_type: string | null;
          file_size: number | null;
          uploaded_by: string;
          is_confidential: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          category?: string;
          name: string;
          storage_path: string;
          mime_type?: string | null;
          file_size?: number | null;
          uploaded_by: string;
          is_confidential?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
      };
      document_students: {
        Row: { document_id: string; student_id: string };
        Insert: { document_id: string; student_id: string };
        Update: Partial<Database["public"]["Tables"]["document_students"]["Insert"]>;
      };
      document_teachers: {
        Row: { document_id: string; teacher_id: string };
        Insert: { document_id: string; teacher_id: string };
        Update: Partial<Database["public"]["Tables"]["document_teachers"]["Insert"]>;
      };
      document_applicants: {
        Row: { document_id: string; applicant_id: string };
        Insert: { document_id: string; applicant_id: string };
        Update: Partial<Database["public"]["Tables"]["document_applicants"]["Insert"]>;
      };
      document_classes: {
        Row: { document_id: string; class_id: string };
        Insert: { document_id: string; class_id: string };
        Update: Partial<Database["public"]["Tables"]["document_classes"]["Insert"]>;
      };
      document_institutions: {
        Row: { document_id: string; institution_id: string };
        Insert: { document_id: string; institution_id: string };
        Update: Partial<Database["public"]["Tables"]["document_institutions"]["Insert"]>;
      };
      certificates: {
        Row: {
          id: string;
          student_id: string;
          course_id: string;
          document_id: string | null;
          certificate_number: string;
          issue_date: string;
          status: "draft" | "issued" | "validated" | "revoked";
          qr_token: string | null;
          created_by: string;
          validated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          course_id: string;
          document_id?: string | null;
          certificate_number: string;
          issue_date?: string;
          status?: string;
          qr_token?: string | null;
          created_by: string;
          validated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["certificates"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          profile_id: string;
          institution_id: string;
          title: string;
          message: string | null;
          type: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          institution_id: string;
          title: string;
          message?: string | null;
          type?: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      settings: {
        Row: {
          id: string;
          institution_id: string;
          key: string;
          value: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          key: string;
          value?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          institution_id: string | null;
          user_id: string | null;
          action: string;
          table_name: string;
          record_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_permission: { Args: { p_code: string }; Returns: boolean };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      current_institution_id: { Args: Record<string, never>; Returns: string };
      current_student_id: { Args: Record<string, never>; Returns: string };
      current_teacher_id: { Args: Record<string, never>; Returns: string };
      current_academic_year_id: { Args: Record<string, never>; Returns: string };
      is_teacher_of_class: { Args: { p_class_id: string }; Returns: boolean };
      perform_class_transfer: {
        Args: { p_enrollment_id: string; p_to_class_id: string; p_reason?: string };
        Returns: string;
      };
      generate_student_number: { Args: { p_institution_id: string }; Returns: string };
      convert_applicant_to_student: { Args: { p_applicant_id: string }; Returns: string };
    };
    Enums: Record<string, never>;
  };
}
