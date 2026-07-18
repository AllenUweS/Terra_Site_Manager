
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'employee');
CREATE TYPE public.project_status AS ENUM ('upcoming', 'live', 'completed', 'archived');
CREATE TYPE public.plot_status AS ENUM ('available', 'pending', 'booked', 'reserved', 'sold', 'cancelled');
CREATE TYPE public.plot_facing AS ENUM ('north', 'south', 'east', 'west', 'north_east', 'north_west', 'south_east', 'south_west');
CREATE TYPE public.booking_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'on_hold');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin')) $$;

CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END LIMIT 1
$$;

-- Profile RLS
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- user_roles RLS
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Super admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- New user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  google_maps_link TEXT,
  cover_image_url TEXT,
  launch_date DATE,
  status public.project_status NOT NULL DEFAULT 'upcoming',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins update projects" ON public.projects FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Super admins delete projects" ON public.projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Plots
CREATE TABLE public.plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  plot_number TEXT NOT NULL,
  area_sqft NUMERIC(10,2) NOT NULL,
  dimensions TEXT,
  price NUMERIC(14,2) NOT NULL,
  facing public.plot_facing,
  corner_plot BOOLEAN NOT NULL DEFAULT false,
  road_width NUMERIC(6,2),
  status public.plot_status NOT NULL DEFAULT 'available',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, plot_number)
);
CREATE INDEX ON public.plots(project_id);
CREATE INDEX ON public.plots(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plots TO authenticated;
GRANT ALL ON public.plots TO service_role;
ALTER TABLE public.plots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read plots" ON public.plots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage plots insert" ON public.plots FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins manage plots update" ON public.plots FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins delete plots" ON public.plots FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  customer_address TEXT,
  aadhaar_number TEXT,
  pan_number TEXT,
  sales_executive_id UUID REFERENCES auth.users(id),
  total_price NUMERIC(14,2) NOT NULL,
  booking_amount NUMERIC(14,2) NOT NULL,
  advance_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_registration_date DATE,
  remarks TEXT,
  status public.booking_status NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.bookings(plot_id);
CREATE INDEX ON public.bookings(sales_executive_id);
CREATE INDEX ON public.bookings(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees read own bookings" ON public.bookings FOR SELECT TO authenticated USING (created_by = auth.uid() OR sales_executive_id = auth.uid());
CREATE POLICY "Admins read all bookings" ON public.bookings FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Auth create bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins update bookings" ON public.bookings FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "Admins delete bookings" ON public.bookings FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- Booking triggers: on insert, set plot to pending; on approve, set booked; on reject/cancel, set available
CREATE OR REPLACE FUNCTION public.sync_plot_from_booking()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.plots SET status = 'pending', updated_at = now() WHERE id = NEW.plot_id AND status = 'available';
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> NEW.status THEN
    IF NEW.status = 'approved' THEN
      UPDATE public.plots SET status = 'booked', updated_at = now() WHERE id = NEW.plot_id;
      NEW.approved_at = COALESCE(NEW.approved_at, now());
    ELSIF NEW.status IN ('rejected','cancelled') THEN
      UPDATE public.plots SET status = 'available', updated_at = now() WHERE id = NEW.plot_id;
    ELSIF NEW.status = 'on_hold' THEN
      UPDATE public.plots SET status = 'reserved', updated_at = now() WHERE id = NEW.plot_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_insert AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_plot_from_booking();
CREATE TRIGGER trg_booking_update BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_plot_from_booking();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_plots_updated BEFORE UPDATE ON public.plots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
