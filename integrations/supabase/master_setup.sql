
-- ======================================================
-- CRISISLINK INDIA: MASTER INFRASTRUCTURE SETUP
-- ======================================================

-- 1. THE MASTER KEY: RPC for Administrative SQL Execution
CREATE OR REPLACE FUNCTION public.exec_sql(cmd text)
RETURNS void AS $$
BEGIN
    EXECUTE cmd;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;

-- 2. Schema Hardening: 2025 Capability Specification
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_center_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blood_group TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS feedback_status TEXT DEFAULT 'pending';

-- 3. Policy Reset for Unrestricted Control
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Global Unrestricted Access" ON public.profiles;
CREATE POLICY "Global Unrestricted Access" ON public.profiles FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Global Unrestricted Access" ON public.incidents;
CREATE POLICY "Global Unrestricted Access" ON public.incidents FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Global Unrestricted Access" ON public.volunteers;
CREATE POLICY "Global Unrestricted Access" ON public.volunteers FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. Permission Synchronization
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- 5. System Confirmation
DO $$ 
BEGIN 
    RAISE NOTICE 'CrisisLink Master Infrastructure Deployment: SUCCESS';
END $$;
