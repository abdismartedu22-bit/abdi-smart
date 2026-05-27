-- ================================================================
-- Abdi Smart -- Migration v2: Customer Feedback Round 1
-- 2026-05-27
--
-- Paste into: Supabase Dashboard > SQL Editor > New query > Run
-- Run blocks in order. Safe to run on existing data.
-- ================================================================


-- ----------------------------------------------------------------
-- BLOCK 1: Add columns to groups
-- ----------------------------------------------------------------

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS paket    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sekolah  text;


-- ----------------------------------------------------------------
-- BLOCK 2: Add columns to schedules
-- ----------------------------------------------------------------

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS ruangan     text,
  ADD COLUMN IF NOT EXISTS pertemuan_ke integer;


-- ----------------------------------------------------------------
-- BLOCK 3: Create gedung table (buildings + rooms)
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gedung (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       text        NOT NULL,
  ruangan    text        NOT NULL,
  kapasitas  integer,
  status     text        NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gedung ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gedung: select (authenticated)"
  ON public.gedung FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "gedung: insert (admin/staff)"
  ON public.gedung FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "gedung: update (admin/staff)"
  ON public.gedung FOR UPDATE
  USING (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "gedung: delete (admin)"
  ON public.gedung FOR DELETE
  USING (get_my_role() = 'admin');

-- Seed data from customer spreadsheet
INSERT INTO public.gedung (nama, ruangan, kapasitas, status) VALUES
  ('Badak Agung', 'A', 6,    'aktif'),
  ('Badak Agung', 'S', 8,    'aktif'),
  ('Badak Agung', 'E', 8,    'aktif'),
  ('Badak Agung', 'K', 4,    'aktif'),
  ('Trijata',     'A', 6,    'aktif'),
  ('Trijata',     'S', 8,    'aktif'),
  ('Trijata',     'E', 8,    'aktif'),
  ('Rumah Siswa', '-', NULL, 'aktif')
ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------
-- BLOCK 4: RPC -- groups with computed realisasi count
--   Used by AdminHome (sisa < 10 alert) and StudentHome (paket card)
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_groups_with_realisasi()
RETURNS TABLE(
  id         uuid,
  nama       text,
  kode       text,
  warna      text,
  warna_text text,
  paket      integer,
  realisasi  bigint,
  active     boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    g.id, g.nama, g.kode, g.warna, g.warna_text, g.paket,
    COUNT(DISTINCT a.schedule_id) AS realisasi,
    g.active
  FROM public.groups g
  LEFT JOIN public.schedules s ON s.group_id = g.id
  LEFT JOIN public.attendance a
    ON  a.schedule_id = s.id
    AND a.person_role = 'teacher'
    AND a.sesi_status = 'terlaksana'
    AND a.locked_at   IS NOT NULL
  WHERE g.active = true
  GROUP BY g.id, g.nama, g.kode, g.warna, g.warna_text, g.paket, g.active
  ORDER BY g.nama;
$$;


-- ----------------------------------------------------------------
-- BLOCK 5: RPC -- groups with no sessions in the last 7 days
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_inactive_groups()
RETURNS TABLE(
  id           uuid,
  nama         text,
  kode         text,
  warna        text,
  warna_text   text,
  last_session date
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    g.id, g.nama, g.kode, g.warna, g.warna_text,
    MAX(a.session_date)::date AS last_session
  FROM public.groups g
  LEFT JOIN public.schedules  s ON s.group_id   = g.id
  LEFT JOIN public.attendance a ON a.schedule_id = s.id
    AND a.person_role = 'teacher'
  WHERE g.active = true
  GROUP BY g.id, g.nama, g.kode, g.warna, g.warna_text
  HAVING MAX(a.session_date)::date < (CURRENT_DATE - INTERVAL '7 days')
      OR MAX(a.session_date) IS NULL
  ORDER BY last_session ASC NULLS FIRST;
$$;


-- ----------------------------------------------------------------
-- BLOCK 6: RPC -- TO leaderboard (bypasses RLS so students can see peers)
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_to_leaderboard(p_type text, p_nama_to text)
RETURNS TABLE(
  student_id   uuid,
  display_name text,
  total_score  numeric,
  scores       jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT tr.student_id, p.display_name, tr.total_score, tr.scores
  FROM   public.tryout_results tr
  JOIN   public.profiles p ON p.id = tr.student_id
  WHERE  tr.type    = p_type
    AND  tr.nama_to = p_nama_to
  ORDER  BY tr.total_score DESC NULLS LAST;
END;
$$;


-- ----------------------------------------------------------------
-- DONE. Verify:
--   Table Editor -> groups should have paket + sekolah columns
--   Table Editor -> schedules should have ruangan + pertemuan_ke columns
--   Table Editor -> gedung table exists with seed rows
--   Functions -> get_groups_with_realisasi, get_inactive_groups, get_to_leaderboard
-- ----------------------------------------------------------------
