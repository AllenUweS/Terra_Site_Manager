-- Plot Leads: multiple prospective buyers per plot
-- ------------------------------------------------------------------
-- A single available plot is usually shown to several interested
-- buyers before one of them actually books it. This adds a proper
-- lead pipeline underneath each plot: sales staff log every enquiry
-- (contact details, budget, how they found us, a scheduled site
-- visit / meeting), and an admin can later pick the winning lead and
-- either reserve the plot for them or convert them straight into a
-- booking. The booking, when created from a lead, keeps a reference
-- back to it so the funnel (lead -> reserved -> booked) is traceable.

CREATE TYPE public.lead_status AS ENUM (
  'new',
  'contacted',
  'meeting_scheduled',
  'negotiating',
  'converted',
  'dropped'
);

CREATE TABLE public.plot_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  source TEXT,
  budget NUMERIC(14,2),
  notes TEXT,
  meeting_date TIMESTAMPTZ,
  meeting_location TEXT,
  status public.lead_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.plot_leads(plot_id);
CREATE INDEX ON public.plot_leads(project_id);
CREATE INDEX ON public.plot_leads(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plot_leads TO authenticated;
GRANT ALL ON public.plot_leads TO service_role;
ALTER TABLE public.plot_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read leads" ON public.plot_leads
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated create leads" ON public.plot_leads
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners and admins update leads" ON public.plot_leads
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR assigned_to = auth.uid() OR public.is_admin_or_super(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR assigned_to = auth.uid() OR public.is_admin_or_super(auth.uid()));

CREATE POLICY "Admins delete leads" ON public.plot_leads
  FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER trg_plot_leads_updated BEFORE UPDATE ON public.plot_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Which lead (if any) a plot is currently being held/reserved for.
ALTER TABLE public.plots
  ADD COLUMN IF NOT EXISTS selected_lead_id UUID REFERENCES public.plot_leads(id) ON DELETE SET NULL;

-- Trace a booking back to the lead it was converted from, if any.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.plot_leads(id) ON DELETE SET NULL;
