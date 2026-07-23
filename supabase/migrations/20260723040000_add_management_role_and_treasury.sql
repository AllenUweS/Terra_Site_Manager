-- 1. Add 'management' role to public.app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'management';

-- 2. Update is_admin_or_super to include 'management' (using role::text to avoid PostgreSQL error 55P04)
CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','super_admin','management')) $$;

-- 3. Update get_primary_role (using role::text)
CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role::text 
    WHEN 'super_admin' THEN 1 
    WHEN 'admin' THEN 2 
    WHEN 'management' THEN 3 
    WHEN 'manager' THEN 4 
    ELSE 5 
  END LIMIT 1
$$;

-- 4. Create Inter-Project Transfers Table
CREATE TABLE IF NOT EXISTS public.project_fund_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    target_project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    transferred_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    purpose TEXT,
    repayment_due_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    repaid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_fund_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view transfers" ON public.project_fund_transfers;
CREATE POLICY "Authenticated users view transfers"
    ON public.project_fund_transfers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and management manage transfers" ON public.project_fund_transfers;
CREATE POLICY "Admins and management manage transfers"
    ON public.project_fund_transfers FOR ALL TO authenticated
    USING (public.is_admin_or_super(auth.uid()))
    WITH CHECK (public.is_admin_or_super(auth.uid()));

-- 5. Create Transfer Repayments Table
CREATE TABLE IF NOT EXISTS public.project_transfer_repayments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES public.project_fund_transfers(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    repaid_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_transfer_repayments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view repayments" ON public.project_transfer_repayments;
CREATE POLICY "Authenticated users view repayments"
    ON public.project_transfer_repayments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users insert repayments" ON public.project_transfer_repayments;
CREATE POLICY "Authenticated users insert repayments"
    ON public.project_transfer_repayments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users update repayments" ON public.project_transfer_repayments;
CREATE POLICY "Authenticated users update repayments"
    ON public.project_transfer_repayments FOR UPDATE TO authenticated USING (true);
