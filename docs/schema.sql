-- ================================================================
-- Abdi Smart Internal System -- Supabase Schema
-- Version: 1.0 | 2026-05-20
--
-- HOW TO RUN:
--   Supabase Dashboard > SQL Editor > New query > paste > Run
--
-- Run in this order. If anything fails, fix it before continuing.
-- ================================================================


-- ----------------------------------------------------------------
-- STEP 1: Tables
-- profiles must come first -- get_my_role() references it
-- ----------------------------------------------------------------

-- profiles: linked 1:1 to auth.users, auto-created by trigger below
CREATE TABLE public.profiles (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username       text        NOT NULL UNIQUE,
  display_name   text        NOT NULL,
  role           text        NOT NULL CHECK (role IN ('admin', 'staff', 'teacher', 'student')),
  email          text        UNIQUE,
  nama           text,
  tempat_lahir   text,
  tanggal_lahir  date,
  sekolah        text,
  jurusan        text,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Migration (run if table already exists):
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- groups: flexible size, admin/staff create on demand
CREATE TABLE public.groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        text        NOT NULL,
  kode        text        NOT NULL,
  warna       text        NOT NULL DEFAULT '#1E3A5F',
  warna_text  text        NOT NULL DEFAULT '#FFFFFF',
  tipe        text        NOT NULL DEFAULT 'reguler' CHECK (tipe IN ('reguler', 'privat')),
  active      boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- student_groups: many-to-many students <-> groups
CREATE TABLE public.student_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL REFERENCES public.groups(id)   ON DELETE CASCADE,
  enrolled_at date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (student_id, group_id)
);

-- schedules: one row per session per week
CREATE TABLE public.schedules (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid        NOT NULL REFERENCES public.groups(id),
  teacher_id  uuid        NOT NULL REFERENCES public.profiles(id),
  hari        text        NOT NULL CHECK (hari IN ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu')),
  jam_mulai   time        NOT NULL,
  jam_selesai time        NOT NULL,
  materi      text,
  lokasi      text,
  week_start  date        NOT NULL,
  created_by  uuid        REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- attendance: unified table for both student and teacher rows
--   person_role = 'student' -> status: hadir|absen|izin
--   person_role = 'teacher' -> status: hadir|tidak_hadir, sesi_status: terlaksana|tidak|ditunda
CREATE TABLE public.attendance (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id   uuid        NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  session_date  date        NOT NULL,
  person_id     uuid        NOT NULL REFERENCES public.profiles(id),
  person_role   text        NOT NULL CHECK (person_role IN ('student', 'teacher')),
  checkin_at    timestamptz,
  status        text        CHECK (status IN ('hadir', 'absen', 'izin', 'tidak_hadir')),
  note          text,
  sesi_status   text        CHECK (sesi_status IN ('terlaksana', 'tidak', 'ditunda')),
  catatan_admin text,
  verified_by   uuid        REFERENCES public.profiles(id),
  verified_at   timestamptz,
  locked_at     timestamptz,
  locked_by     uuid        REFERENCES public.profiles(id),
  UNIQUE (schedule_id, session_date, person_id)
);

-- tryout_results: TO scores per student
CREATE TABLE public.tryout_results (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid        NOT NULL REFERENCES public.profiles(id),
  type        text        NOT NULL CHECK (type IN ('SNBT', 'TKA')),
  nama_to     text        NOT NULL,
  kode_to     text,
  tanggal_to  date,
  scores      jsonb,
  total_score numeric,
  entered_by  uuid        REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ----------------------------------------------------------------
-- STEP 2: Helper functions
-- Defined after profiles exists. SECURITY DEFINER bypasses RLS.
-- ----------------------------------------------------------------

-- Role helper used by all RLS policies (prevents recursion)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Username -> email resolver (callable unauthenticated)
-- Used by login page and forgot-password flow.
-- Only exposes the email field, nothing else.
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE lower(username) = lower(p_username)
$$;


-- ----------------------------------------------------------------
-- STEP 3: Trigger -- auto-create profiles row on new auth user
-- The Edge Function passes username, display_name, role in metadata.
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username',     split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role',         'student'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ----------------------------------------------------------------
-- STEP 4: Enable Row-Level Security on all tables
-- ----------------------------------------------------------------

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tryout_results ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------
-- STEP 5: RLS Policies
-- ----------------------------------------------------------------

-- ---- profiles ----

CREATE POLICY "profiles: select"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id                          -- own row (any role)
    OR get_my_role() IN ('admin', 'staff')   -- admin/staff see everyone
    OR (get_my_role() = 'teacher' AND role = 'student')  -- teacher sees students
  );

-- Non-admin can update own row, but cannot change their role
CREATE POLICY "profiles: update own (role locked)"
  ON public.profiles FOR UPDATE
  USING  (auth.uid() = id AND get_my_role() != 'admin')
  WITH CHECK (auth.uid() = id AND role = get_my_role());

-- Admin can update any row (including changing roles)
CREATE POLICY "profiles: admin update any"
  ON public.profiles FOR UPDATE
  USING (get_my_role() = 'admin');

CREATE POLICY "profiles: admin delete"
  ON public.profiles FOR DELETE
  USING (get_my_role() = 'admin');

-- No direct INSERT allowed -- the trigger (SECURITY DEFINER) handles it


-- ---- groups ----

CREATE POLICY "groups: select (authenticated)"
  ON public.groups FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "groups: insert (admin/staff)"
  ON public.groups FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "groups: update (admin/staff)"
  ON public.groups FOR UPDATE
  USING (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "groups: delete (admin)"
  ON public.groups FOR DELETE
  USING (get_my_role() = 'admin');


-- ---- student_groups ----

CREATE POLICY "student_groups: select"
  ON public.student_groups FOR SELECT
  USING (
    student_id = auth.uid()                      -- own memberships
    OR get_my_role() IN ('admin', 'staff', 'teacher')
  );

CREATE POLICY "student_groups: insert (admin/staff)"
  ON public.student_groups FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "student_groups: update (admin/staff)"
  ON public.student_groups FOR UPDATE
  USING (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "student_groups: delete (admin/staff)"
  ON public.student_groups FOR DELETE
  USING (get_my_role() IN ('admin', 'staff'));


-- ---- schedules ----

CREATE POLICY "schedules: select (authenticated)"
  ON public.schedules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "schedules: insert (admin/staff)"
  ON public.schedules FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "schedules: update (admin/staff)"
  ON public.schedules FOR UPDATE
  USING (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "schedules: delete (admin)"
  ON public.schedules FOR DELETE
  USING (get_my_role() = 'admin');


-- ---- attendance ----

CREATE POLICY "attendance: select"
  ON public.attendance FOR SELECT
  USING (
    get_my_role() IN ('admin', 'staff')
    OR person_id = auth.uid()
    OR (
      get_my_role() = 'teacher'
      AND schedule_id IN (SELECT id FROM public.schedules WHERE teacher_id = auth.uid())
    )
  );

-- Student self check-in: own row, correct session, within 15-min window
CREATE POLICY "attendance: student self check-in"
  ON public.attendance FOR INSERT
  WITH CHECK (
    get_my_role() = 'student'
    AND person_id   = auth.uid()
    AND person_role = 'student'
    AND locked_at IS NULL
    AND session_date = (NOW() AT TIME ZONE 'Asia/Makassar')::date
    AND EXISTS (
      SELECT 1
      FROM   public.schedules s
      JOIN   public.student_groups sg ON sg.group_id = s.group_id
      WHERE  s.id            = schedule_id
        AND  sg.student_id   = auth.uid()
        AND  (NOW() AT TIME ZONE 'Asia/Makassar')::time
             BETWEEN s.jam_mulai AND (s.jam_mulai + INTERVAL '15 minutes')
    )
  );

-- Teacher self check-in: own row, own session, session day only
CREATE POLICY "attendance: teacher self check-in"
  ON public.attendance FOR INSERT
  WITH CHECK (
    get_my_role() = 'teacher'
    AND person_id   = auth.uid()
    AND person_role = 'teacher'
    AND locked_at IS NULL
    AND session_date = (NOW() AT TIME ZONE 'Asia/Makassar')::date
    AND EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = schedule_id AND s.teacher_id = auth.uid()
    )
  );

-- Teacher inserts rows for students who never self-checked-in
-- (used when teacher does verification and a student has no row yet)
CREATE POLICY "attendance: teacher insert student rows"
  ON public.attendance FOR INSERT
  WITH CHECK (
    get_my_role() = 'teacher'
    AND person_role = 'student'
    AND locked_at IS NULL
    AND schedule_id IN (SELECT id FROM public.schedules WHERE teacher_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM   public.student_groups sg
      JOIN   public.schedules s ON s.id = schedule_id
      WHERE  s.group_id    = sg.group_id
        AND  sg.student_id = person_id
    )
  );

-- Admin/staff can insert any attendance row (e.g. data corrections)
CREATE POLICY "attendance: admin/staff insert"
  ON public.attendance FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'staff'));

-- Teacher updates rows in own sessions while unlocked
CREATE POLICY "attendance: teacher update own sessions"
  ON public.attendance FOR UPDATE
  USING (
    get_my_role() = 'teacher'
    AND locked_at IS NULL
    AND schedule_id IN (SELECT id FROM public.schedules WHERE teacher_id = auth.uid())
  );

-- Admin can update any row (overrides after lock)
CREATE POLICY "attendance: admin update any"
  ON public.attendance FOR UPDATE
  USING (get_my_role() = 'admin');

CREATE POLICY "attendance: admin delete"
  ON public.attendance FOR DELETE
  USING (get_my_role() = 'admin');


-- ---- tryout_results ----

CREATE POLICY "tryout_results: select"
  ON public.tryout_results FOR SELECT
  USING (
    student_id = auth.uid()
    OR get_my_role() IN ('admin', 'staff')
  );

CREATE POLICY "tryout_results: insert (admin/staff)"
  ON public.tryout_results FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "tryout_results: update (admin/staff)"
  ON public.tryout_results FOR UPDATE
  USING (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "tryout_results: delete (admin)"
  ON public.tryout_results FOR DELETE
  USING (get_my_role() = 'admin');


-- ----------------------------------------------------------------
-- STEP 6: Auto-lock cron job (23:59 WITA = 15:59 UTC)
--
-- BEFORE running this block:
--   Dashboard > Database > Extensions > search "pg_cron" > Enable
--
-- This runs every night and:
--   - Marks absent students (no row or no checkin_at) as 'absen'
--   - Sets teacher sesi_status to 'terlaksana' if not set
--   - Locks all session rows for that day
-- ----------------------------------------------------------------

SELECT cron.schedule(
  'auto-lock-attendance',
  '59 15 * * *',
  $$
  UPDATE public.attendance
  SET
    status = CASE
      WHEN person_role = 'student' AND checkin_at IS NULL             THEN 'absen'
      WHEN person_role = 'student' AND checkin_at IS NOT NULL
           AND (status IS NULL OR status = '')                        THEN 'hadir'
      ELSE status
    END,
    sesi_status = CASE
      WHEN person_role = 'teacher'
           AND (sesi_status IS NULL OR sesi_status = '')              THEN 'terlaksana'
      ELSE sesi_status
    END,
    locked_at  = NOW(),
    locked_by  = NULL
  WHERE locked_at IS NULL
    AND session_date = (NOW() AT TIME ZONE 'Asia/Makassar')::date;
  $$
);


-- ----------------------------------------------------------------
-- STEP 7: Seed data -- initial groups
-- ----------------------------------------------------------------

INSERT INTO public.groups (nama, kode, warna, warna_text, tipe) VALUES
  ('Grup Merah',  'GR', '#DC2626', '#FFFFFF', 'reguler'),
  ('Grup Biru',   'GB', '#2563EB', '#FFFFFF', 'reguler'),
  ('Grup Hijau',  'GH', '#16A34A', '#FFFFFF', 'reguler'),
  ('Grup Kuning', 'GK', '#CA8A04', '#000000', 'reguler');


-- ----------------------------------------------------------------
-- DONE. Verify in Supabase:
--   Table Editor  -> should show 6 tables
--   Auth > Settings -> disable sign-ups + email confirmation
--   Database > Extensions -> confirm pg_cron is enabled
-- ----------------------------------------------------------------
