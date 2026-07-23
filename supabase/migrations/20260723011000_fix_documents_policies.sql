  -- Fix Documents System Policies - Ensure is_manager function exists and update policies to use has_role
  -- --------------------------------------------------------------------------------------------------

  -- Define public.is_manager helper function so any policy or query referencing it will not throw ERROR 42883
  CREATE OR REPLACE FUNCTION public.is_manager(_user_id UUID)
  RETURNS BOOLEAN
  LANGUAGE SQL
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'manager'
    );
  $$;

  GRANT EXECUTE ON FUNCTION public.is_manager(UUID) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.is_manager(UUID) TO service_role;

  -- Drop existing policies
  DROP POLICY IF EXISTS "Admins and managers create folders" ON public.document_folders;
  DROP POLICY IF EXISTS "Admins and managers update folders" ON public.document_folders;
  DROP POLICY IF EXISTS "Admins and managers create documents" ON public.documents;
  DROP POLICY IF EXISTS "Admins and managers update documents" ON public.documents;
  DROP POLICY IF EXISTS "Admins and managers can upload documents" ON storage.objects;
  DROP POLICY IF EXISTS "Admins and managers can update documents" ON storage.objects;

  -- Recreate policies with has_role function

  CREATE POLICY "Admins and managers create folders" ON public.document_folders
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'));

  CREATE POLICY "Admins and managers update folders" ON public.document_folders
    FOR UPDATE TO authenticated
    USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'))
    WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'));

  CREATE POLICY "Admins and managers create documents" ON public.documents
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'));

  CREATE POLICY "Admins and managers update documents" ON public.documents
    FOR UPDATE TO authenticated
    USING (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'))
    WITH CHECK (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'));

  CREATE POLICY "Admins and managers can upload documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'documents' AND
      (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'))
    );

  CREATE POLICY "Admins and managers can update documents" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'documents' AND
      (public.is_admin_or_super(auth.uid()) OR public.has_role(auth.uid(), 'manager'))
    );
