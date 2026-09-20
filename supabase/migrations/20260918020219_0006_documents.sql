/*
# Documents and Storage Buckets

## Summary
Creates the document system using explicit FK tables (no polymorphic relations) and
sets up Supabase Storage buckets with appropriate access policies.

## New Tables (6 tables)

### documents
Central document metadata table. Each document is stored in Supabase Storage.
- `id` (uuid PK)
- `institution_id` (uuid FK → institutions)
- `category` (text: avatar/certificate/transcript/receipt/invoice/id_document/administrative/other)
- `name` (text), `storage_path` (text — path in Storage bucket)
- `mime_type` (text), `file_size` (bigint)
- `uploaded_by` (uuid FK → auth.users)
- `is_confidential` (boolean, default true)
- timestamps

### document_students (FK junction)
- `document_id` (FK → documents, PK part)
- `student_id` (FK → students, PK part)
- PK (document_id, student_id)

### document_teachers (FK junction)
- `document_id` + `teacher_id`, PK composite

### document_applicants (FK junction)
- `document_id` + `applicant_id`, PK composite

### document_classes (FK junction)
- `document_id` + `class_id`, PK composite

### document_institutions (FK junction)
- `document_id` + `institution_id`, PK composite

## Storage Buckets
1. `public-assets` — public read (logos, formation images)
2. `student-docs` — private (student certificates, transcripts, receipts)
3. `admin-docs` — private (administrative documents)
4. `avatars` — public read, owner write (profile photos)

## Security
- RLS on all 6 tables.
- Storage policies: private buckets require authenticated access + ownership/permission.
- Signed URLs must be generated server-side with service_role key.
*/

-- ============================================================
-- 1. documents
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  category        text NOT NULL DEFAULT 'other'
                  CHECK (category IN (
                    'avatar', 'certificate', 'transcript', 'receipt',
                    'invoice', 'id_document', 'administrative', 'other'
                  )),
  name            text NOT NULL,
  storage_path    text NOT NULL,
  mime_type       text,
  file_size       bigint,
  uploaded_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  is_confidential boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_documents_institution ON public.documents (institution_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents (category);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents (uploaded_by);

-- ============================================================
-- 2. document_students
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_students (
  document_id  uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_students_student ON public.document_students (student_id);

-- ============================================================
-- 3. document_teachers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_teachers (
  document_id  uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  teacher_id   uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_teachers_teacher ON public.document_teachers (teacher_id);

-- ============================================================
-- 4. document_applicants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_applicants (
  document_id   uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  applicant_id  uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_applicants_applicant ON public.document_applicants (applicant_id);

-- ============================================================
-- 5. document_classes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_classes (
  document_id  uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  class_id     uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_classes_class ON public.document_classes (class_id);

-- ============================================================
-- 6. document_institutions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_institutions (
  document_id     uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  institution_id  uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, institution_id)
);

-- ============================================================
-- 7. certificates (bonus — stored as documents + certificate metadata)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.certificates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id       uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  document_id     uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  certificate_number text NOT NULL,
  issue_date      date NOT NULL DEFAULT current_date,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'issued', 'validated', 'revoked')),
  qr_token        text UNIQUE,
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT certificates_unique_number UNIQUE (certificate_number)
);

CREATE TRIGGER trg_certificates_updated_at
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_certificates_student ON public.certificates (student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course ON public.certificates (course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON public.certificates (status);
CREATE INDEX IF NOT EXISTS idx_certificates_qr_token ON public.certificates (qr_token);

-- ============================================================
-- 8. Enable RLS
-- ============================================================
ALTER TABLE public.documents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_students       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_teachers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_applicants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_classes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_institutions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates            ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('public-assets', 'public-assets', true),
  ('student-docs', 'student-docs', false),
  ('admin-docs', 'admin-docs', false),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 10. STORAGE POLICIES
-- ============================================================

-- public-assets: anyone can read, authenticated can upload
DROP POLICY IF EXISTS "public_assets_read" ON storage.objects;
CREATE POLICY "public_assets_read" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'public-assets');

DROP POLICY IF EXISTS "public_assets_upload" ON storage.objects;
CREATE POLICY "public_assets_upload" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'public-assets');

DROP POLICY IF EXISTS "public_assets_update" ON storage.objects;
CREATE POLICY "public_assets_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'public-assets') WITH CHECK (bucket_id = 'public-assets');

-- student-docs: private — only authenticated with documents.view permission or owner
DROP POLICY IF EXISTS "student_docs_read" ON storage.objects;
CREATE POLICY "student_docs_read" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student-docs'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = auth.uid() AND p.code = 'documents.view'
      )
    )
  );

DROP POLICY IF EXISTS "student_docs_upload" ON storage.objects;
CREATE POLICY "student_docs_upload" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-docs'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = auth.uid() AND p.code = 'documents.create'
      )
    )
  );

DROP POLICY IF EXISTS "student_docs_delete" ON storage.objects;
CREATE POLICY "student_docs_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student-docs'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = auth.uid() AND p.code = 'documents.delete'
    )
  );

-- admin-docs: private — only authenticated with documents.view permission
DROP POLICY IF EXISTS "admin_docs_read" ON storage.objects;
CREATE POLICY "admin_docs_read" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'admin-docs'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = auth.uid() AND p.code = 'documents.view'
    )
  );

DROP POLICY IF EXISTS "admin_docs_upload" ON storage.objects;
CREATE POLICY "admin_docs_upload" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'admin-docs'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = auth.uid() AND p.code = 'documents.create'
    )
  );

DROP POLICY IF EXISTS "admin_docs_delete" ON storage.objects;
CREATE POLICY "admin_docs_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'admin-docs'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = auth.uid() AND p.code = 'documents.delete'
    )
  );

-- avatars: public read, owner can upload/update/delete
DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_upload" ON storage.objects;
CREATE POLICY "avatars_upload" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());
