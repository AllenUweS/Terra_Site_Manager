-- A single, auditable reward record for each approved plot conversion.
CREATE TABLE IF NOT EXISTS public.incentive_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incentive_grants_employee_id_idx ON public.incentive_grants(employee_id);
GRANT SELECT, INSERT ON public.incentive_grants TO authenticated;
GRANT ALL ON public.incentive_grants TO service_role;
ALTER TABLE public.incentive_grants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_employee_incentives(_employee_id UUID, _manager_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin_or_super(_manager_id)
    OR public.has_role(_manager_id, 'manager') AND public.is_manager_of(_employee_id, _manager_id)
$$;

CREATE POLICY "Admins and managers read relevant incentive grants" ON public.incentive_grants
  FOR SELECT TO authenticated USING (public.can_manage_employee_incentives(employee_id, auth.uid()));

CREATE POLICY "Admins and managers grant relevant incentives" ON public.incentive_grants
  FOR INSERT TO authenticated WITH CHECK (
    granted_by = auth.uid()
    AND public.can_manage_employee_incentives(employee_id, auth.uid())
  );
