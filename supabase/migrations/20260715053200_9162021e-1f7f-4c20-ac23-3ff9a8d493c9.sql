
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS layout_image_url TEXT;
ALTER TABLE public.plots ADD COLUMN IF NOT EXISTS layout_x NUMERIC;
ALTER TABLE public.plots ADD COLUMN IF NOT EXISTS layout_y NUMERIC;

CREATE TABLE public.project_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_documents TO authenticated;
GRANT ALL ON public.project_documents TO service_role;

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view project documents"
ON public.project_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert project documents"
ON public.project_documents FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins update project documents"
ON public.project_documents FOR UPDATE TO authenticated
USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins delete project documents"
ON public.project_documents FOR DELETE TO authenticated
USING (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER project_documents_set_updated_at
BEFORE UPDATE ON public.project_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for buckets project-documents (private) and project-layouts (public read)
CREATE POLICY "Layouts public read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'project-layouts');

CREATE POLICY "Admins upload layouts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-layouts' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins update layouts"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-layouts' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins delete layouts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-layouts' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Authenticated read documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'project-documents');

CREATE POLICY "Admins upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-documents' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins delete documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-documents' AND public.is_admin_or_super(auth.uid()));
