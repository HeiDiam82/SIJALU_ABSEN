-- Enable pgcrypto extension for bcrypt password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cleanup existing test data to allow running multiple times
DELETE FROM public.users WHERE email IN ('admin@sijalu.ac.id', 'dosen@sijalu.ac.id', 'mahasiswa@sijalu.ac.id');
DELETE FROM auth.users WHERE email IN ('admin@sijalu.ac.id', 'dosen@sijalu.ac.id', 'mahasiswa@sijalu.ac.id');
DELETE FROM public.course WHERE course_id = 'IF301';

DO $$
DECLARE
    v_admin_id UUID := gen_random_uuid();
    v_dosen_id UUID := gen_random_uuid();
    v_mhs_id UUID := gen_random_uuid();
    v_schedule_id UUID := gen_random_uuid();
BEGIN
    -- 1. Insert Admin to auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_admin_id,
        'authenticated',
        'authenticated',
        'admin@sijalu.ac.id',
        crypt('password123', gen_salt('bf', 10)),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"role":"admin","nama":"Admin SIJALU","id_admin":"ADM01"}',
        now(),
        now(),
        '',
        '',
        '',
        ''
    );

    -- 2. Insert Dosen to auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_dosen_id,
        'authenticated',
        'authenticated',
        'dosen@sijalu.ac.id',
        crypt('password123', gen_salt('bf', 10)),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"role":"dosen","nama":"Dr. Dosen Pengampu","nip":"1985031201","departemen":"Ilmu Komputer"}',
        now(),
        now(),
        '',
        '',
        '',
        ''
    );

    -- 3. Insert Mahasiswa to auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_mhs_id,
        'authenticated',
        'authenticated',
        'mahasiswa@sijalu.ac.id',
        crypt('password123', gen_salt('bf', 10)),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"role":"mahasiswa","nama":"Mahasiswa Rajin","nim":"24060120140001","prodi":"Informatika"}',
        now(),
        now(),
        '',
        '',
        '',
        ''
    );

    -- NOTE: The trigger `on_auth_user_created` will automatically copy these users
    -- into public.users and their respective role tables (public.admin, public.dosen, public.mahasiswa).

    -- 4. Seed Course (Mata Kuliah)
    INSERT INTO public.course (course_id, name, sks)
    VALUES ('IF301', 'Rekayasa Perangkat Lunak', 3)
    ON CONFLICT (course_id) DO NOTHING;

    -- 5. Seed Schedule (Jadwal Kuliah) linked to the seeded Dosen
    INSERT INTO public.schedule (schedule_id, course_id, id_user_dosen, hari, waktu_mulai, waktu_selesai, ruangan)
    VALUES (v_schedule_id, 'IF301', v_dosen_id, 'Senin', '08:00:00', '10:30:00', 'Ruang Multimedia')
    ON CONFLICT DO NOTHING;

END $$;
