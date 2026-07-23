-- Migration: Add is_downloadable column to public.documents and project_documents tables
-- --------------------------------------------------------------------------------------

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS is_downloadable BOOLEAN NOT NULL DEFAULT true;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_documents') THEN
    ALTER TABLE public.project_documents ADD COLUMN IF NOT EXISTS is_downloadable BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;
