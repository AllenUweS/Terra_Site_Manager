-- Allow employees to read their own incentive grants
CREATE POLICY "Employees read own incentive grants" ON public.incentive_grants
  FOR SELECT TO authenticated USING (employee_id = auth.uid());

-- Allow employees to read their own bookings (where they are the sales executive)
-- This is needed for the my-incentives page to show both granted and pending incentives
CREATE POLICY "Employees read own bookings" ON public.bookings
  FOR SELECT TO authenticated USING (sales_executive_id = auth.uid());
