-- Tamper-resistant evidence for assigned lead site visits.
CREATE TABLE public.site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.plot_leads(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters NUMERIC(10,2) NOT NULL,
  arrived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'verified', 'needs_review')),
  notes TEXT,
  correction_note TEXT,
  review_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.site_visit_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.site_visits(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  thumbnail_path TEXT,
  file_name TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_meters NUMERIC(10,2),
  exif_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX site_visits_lead_id_idx ON public.site_visits(lead_id);
CREATE INDEX site_visits_employee_id_idx ON public.site_visits(employee_id);
CREATE INDEX site_visits_status_idx ON public.site_visits(status);
CREATE INDEX site_visit_photos_visit_id_idx ON public.site_visit_photos(visit_id);

GRANT SELECT, INSERT, UPDATE ON public.site_visits TO authenticated;
GRANT SELECT, INSERT ON public.site_visit_photos TO authenticated;
GRANT ALL ON public.site_visits, public.site_visit_photos TO service_role;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_photos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_site_visit(_visit_id UUID, _viewer_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.site_visits visit
    WHERE visit.id = _visit_id AND (
      visit.employee_id = _viewer_id OR public.is_admin_or_super(_viewer_id)
      OR (public.has_role(_viewer_id, 'manager') AND public.is_manager_of(visit.employee_id, _viewer_id))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_start_site_visit(_lead_id UUID, _employee_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _employee_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.plot_leads lead
    WHERE lead.id = _lead_id
      AND COALESCE(lead.assigned_to, lead.created_by) = _employee_id
  )
$$;

CREATE POLICY "Employees and reviewers read site visits" ON public.site_visits
  FOR SELECT TO authenticated USING (public.can_view_site_visit(id, auth.uid()));
CREATE POLICY "Assigned employees start site visits" ON public.site_visits
  FOR INSERT TO authenticated WITH CHECK (
    public.can_start_site_visit(lead_id, employee_id)
    AND (SELECT project_id FROM public.plot_leads WHERE id = lead_id) = project_id
    AND (SELECT plot_id FROM public.plot_leads WHERE id = lead_id) = plot_id
  );
CREATE POLICY "Employees complete their active site visits" ON public.site_visits
  FOR UPDATE TO authenticated USING (employee_id = auth.uid() AND status = 'in_progress')
  WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Employees add correction notes" ON public.site_visits
  FOR UPDATE TO authenticated USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Admins review site visits" ON public.site_visits
  FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Employees and reviewers read visit photos" ON public.site_visit_photos
  FOR SELECT TO authenticated USING (public.can_view_site_visit(visit_id, auth.uid()));
CREATE POLICY "Employees add evidence to active visits" ON public.site_visit_photos
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.site_visits visit
    WHERE visit.id = visit_id AND visit.employee_id = auth.uid() AND visit.status = 'in_progress'
  ));

CREATE OR REPLACE FUNCTION public.enforce_site_visit_immutability()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_admin_or_super(auth.uid()) THEN
    IF NEW.lead_id <> OLD.lead_id OR NEW.employee_id <> OLD.employee_id OR NEW.project_id <> OLD.project_id
      OR NEW.plot_id <> OLD.plot_id OR NEW.latitude <> OLD.latitude OR NEW.longitude <> OLD.longitude
      OR NEW.accuracy_meters <> OLD.accuracy_meters OR NEW.arrived_at <> OLD.arrived_at THEN
      RAISE EXCEPTION 'Captured visit evidence cannot be changed';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.employee_id <> auth.uid() THEN RAISE EXCEPTION 'Not your site visit'; END IF;
  IF OLD.status = 'in_progress' THEN
    IF NEW.status NOT IN ('in_progress', 'submitted') OR NEW.review_note IS DISTINCT FROM OLD.review_note
      OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.correction_note IS DISTINCT FROM OLD.correction_note THEN
      RAISE EXCEPTION 'Invalid site visit update';
    END IF;
    IF NEW.status = 'submitted' AND NEW.completed_at IS NULL THEN RAISE EXCEPTION 'Completion time is required'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.correction_note IS DISTINCT FROM OLD.correction_note
    AND NEW.lead_id = OLD.lead_id AND NEW.employee_id = OLD.employee_id AND NEW.project_id = OLD.project_id
    AND NEW.plot_id = OLD.plot_id AND NEW.latitude = OLD.latitude AND NEW.longitude = OLD.longitude
    AND NEW.accuracy_meters = OLD.accuracy_meters AND NEW.arrived_at = OLD.arrived_at
    AND NEW.completed_at = OLD.completed_at AND NEW.status = OLD.status AND NEW.notes IS NOT DISTINCT FROM OLD.notes
    AND NEW.review_note IS NOT DISTINCT FROM OLD.review_note AND NEW.reviewed_by IS NOT DISTINCT FROM OLD.reviewed_by
    AND NEW.reviewed_at IS NOT DISTINCT FROM OLD.reviewed_at THEN RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Submitted site visit evidence cannot be changed';
END;
$$;
CREATE TRIGGER trg_site_visits_immutable BEFORE UPDATE ON public.site_visits
  FOR EACH ROW EXECUTE FUNCTION public.enforce_site_visit_immutability();

INSERT INTO storage.buckets (id, name, public) VALUES ('site-visit-proofs', 'site-visit-proofs', false)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Employees upload proof to their visit folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-visit-proofs' AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.site_visits visit
      WHERE visit.id::text = (storage.foldername(name))[2]
        AND visit.employee_id = auth.uid() AND visit.status = 'in_progress'));
CREATE POLICY "Visit participants read proof photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'site-visit-proofs' AND EXISTS (
    SELECT 1 FROM public.site_visit_photos photo
    WHERE photo.storage_path = name AND public.can_view_site_visit(photo.visit_id, auth.uid())
  ));
