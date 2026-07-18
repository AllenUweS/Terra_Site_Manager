ALTER TABLE public.profiles
ADD COLUMN manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.is_manager_of(_employee_id UUID, _manager_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = _employee_id AND manager_id = _manager_id
  )
$$;

-- Drop old policy
DROP POLICY IF EXISTS "Employees read own bookings" ON public.bookings;

-- Recreate policy to include team bookings
CREATE POLICY "Employees read own or team bookings" ON public.bookings FOR SELECT TO authenticated USING (
  created_by = auth.uid() 
  OR sales_executive_id = auth.uid()
  OR (created_by IS NOT NULL AND public.is_manager_of(created_by, auth.uid()))
  OR (sales_executive_id IS NOT NULL AND public.is_manager_of(sales_executive_id, auth.uid()))
);
