-- The landing page is available before sign-in, so it needs read access to
-- projects that are intended to be visible in the public showcase.
CREATE POLICY "Public read showcase projects" ON public.projects
  FOR SELECT TO anon
  USING (status <> 'archived');
