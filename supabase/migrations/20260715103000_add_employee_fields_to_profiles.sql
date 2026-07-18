ALTER TABLE public.profiles
ADD COLUMN job_title TEXT,
ADD COLUMN department TEXT,
ADD COLUMN joining_date DATE,
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
