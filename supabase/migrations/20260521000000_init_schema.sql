-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('mahasiswa', 'dosen', 'admin');

-- Create attendance status enum
CREATE TYPE public.attendance_status AS ENUM ('Hadir', 'Izin', 'Sakit', 'Alpa');

-- 1. users table
CREATE TABLE public.users (
    id_user UUID PRIMARY KEY, -- Will map to auth.users.id
    nama VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role public.user_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. mahasiswa table
CREATE TABLE public.mahasiswa (
    id_user UUID PRIMARY KEY REFERENCES public.users(id_user) ON DELETE CASCADE,
    nim VARCHAR(20) UNIQUE NOT NULL,
    prodi VARCHAR(100) NOT NULL
);

-- 3. dosen table
CREATE TABLE public.dosen (
    id_user UUID PRIMARY KEY REFERENCES public.users(id_user) ON DELETE CASCADE,
    nip VARCHAR(20) UNIQUE NOT NULL,
    departemen VARCHAR(100) NOT NULL
);

-- 4. admin table
CREATE TABLE public.admin (
    id_user UUID PRIMARY KEY REFERENCES public.users(id_user) ON DELETE CASCADE,
    id_admin VARCHAR(20) UNIQUE NOT NULL
);

-- 5. course table
CREATE TABLE public.course (
    course_id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    sks SMALLINT NOT NULL
);

-- 6. schedule table
CREATE TABLE public.schedule (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR(20) NOT NULL REFERENCES public.course(course_id) ON DELETE CASCADE,
    id_user_dosen UUID NOT NULL REFERENCES public.dosen(id_user) ON DELETE CASCADE,
    hari VARCHAR(10) NOT NULL,
    waktu_mulai TIME NOT NULL,
    waktu_selesai TIME NOT NULL,
    ruangan VARCHAR(50) NOT NULL
);

-- 7. session table
CREATE TABLE public.session (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.schedule(schedule_id) ON DELETE CASCADE,
    id_user_dosen UUID NOT NULL REFERENCES public.dosen(id_user) ON DELETE CASCADE,
    qr_code_token TEXT NOT NULL,
    unique_code VARCHAR(10) NOT NULL,
    expiry_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. attendance table
CREATE TABLE public.attendance (
    attendance_id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.session(session_id) ON DELETE CASCADE,
    id_user_mahasiswa UUID NOT NULL REFERENCES public.mahasiswa(id_user) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status public.attendance_status NOT NULL DEFAULT 'Alpa',
    koordinat_gps POINT,
    UNIQUE (session_id, id_user_mahasiswa)
);

-- Realtime Setup: Enable realtime for attendance, session, and schedule tables
alter publication supabase_realtime add table public.attendance;
alter publication supabase_realtime add table public.session;

-- Set up Row Level Security (RLS) - disabled or open for simplicity of dev, or simple rules:
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mahasiswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dosen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Simple permissive policies for developer access
CREATE POLICY "Allow public read for users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert for users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for users" ON public.users FOR UPDATE USING (true);

CREATE POLICY "Allow public access for mahasiswa" ON public.mahasiswa FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for dosen" ON public.dosen FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for admin" ON public.admin FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for course" ON public.course FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for schedule" ON public.schedule FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for session" ON public.session FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

-- Trigger Function for Auth Synchronization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role public.user_role;
    v_nama text;
    v_nim_nip_admin text;
    v_extra text; -- prodi or departemen
BEGIN
    -- Extract role from metadata, default to 'mahasiswa' if not provided
    v_role := coalesce(new.raw_user_meta_data->>'role', 'mahasiswa')::public.user_role;
    v_nama := coalesce(new.raw_user_meta_data->>'nama', split_part(new.email, '@', 1));
    
    -- Insert into public.users
    INSERT INTO public.users (id_user, nama, email, role)
    VALUES (new.id, v_nama, new.email, v_role);
    
    -- Insert into role-specific profile tables
    IF v_role = 'mahasiswa' THEN
        v_nim_nip_admin := coalesce(new.raw_user_meta_data->>'nim', 'MHS-' || substring(new.id::text from 1 for 8));
        v_extra := coalesce(new.raw_user_meta_data->>'prodi', 'Informatika');
        INSERT INTO public.mahasiswa (id_user, nim, prodi)
        VALUES (new.id, v_nim_nip_admin, v_extra);
    ELSIF v_role = 'dosen' THEN
        v_nim_nip_admin := coalesce(new.raw_user_meta_data->>'nip', 'DOS-' || substring(new.id::text from 1 for 8));
        v_extra := coalesce(new.raw_user_meta_data->>'departemen', 'Teknologi Informasi');
        INSERT INTO public.dosen (id_user, nip, departemen)
        VALUES (new.id, v_nim_nip_admin, v_extra);
    ELSIF v_role = 'admin' THEN
        v_nim_nip_admin := coalesce(new.raw_user_meta_data->>'id_admin', 'ADM-' || substring(new.id::text from 1 for 8));
        INSERT INTO public.admin (id_user, id_admin)
        VALUES (new.id, v_nim_nip_admin);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the sync function on auth user created
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
