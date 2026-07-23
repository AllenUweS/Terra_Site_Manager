-- Documents Management System
-- ------------------------------------------------------------------
-- A folder-based document management system where admins and managers
-- can organize company documents in a hierarchical folder structure.
-- Employees have read-only access.

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Folders table - hierarchical folder structure
CREATE TABLE IF NOT EXISTS public.document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.document_folders(parent_id);
CREATE INDEX ON public.document_folders(created_by);

-- Documents table - files stored in folders
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES public.document_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Storage path
  file_size BIGINT NOT NULL, -- Size in bytes
  mime_type TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.documents(folder_id);
CREATE INDEX ON public.documents(created_by);

-- Enable RLS
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Folders policies
CREATE POLICY "Authenticated read folders" ON public.document_folders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers create folders" ON public.document_folders
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers update folders" ON public.document_folders
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins delete folders" ON public.document_folders
  FOR DELETE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- Documents policies
CREATE POLICY "Authenticated read documents" ON public.documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and managers create documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins and managers update documents" ON public.documents
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins delete documents" ON public.documents
  FOR DELETE TO authenticated
  USING (public.is_admin_or_super(auth.uid()));

-- Storage policies for documents bucket
CREATE POLICY "Authenticated can view documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Admins and managers can upload documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Admins and managers can delete documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents' AND
    public.is_admin_or_super(auth.uid())
  );

CREATE POLICY "Admins and managers can update documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents' AND
    (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'))
  );

-- Triggers for updated_at
CREATE TRIGGER trg_document_folders_updated BEFORE UPDATE ON public.document_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create root folder for company documents
INSERT INTO public.document_folders (id, name, parent_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Company Documents', NULL)
ON CONFLICT (id) DO NOTHING;
