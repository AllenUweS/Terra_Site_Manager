-- Managers need to see the profiles of the people who report to them so
-- the Leads CRM can group leads into "<Manager>'s Team". This mirrors the
-- is_manager_of-based policy already added for bookings.

CREATE POLICY "Managers read direct reports" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_manager_of(id, auth.uid()));
