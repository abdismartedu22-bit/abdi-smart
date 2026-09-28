-- Supersedes migration-fix-realisasi-locked.sql (that one is already run,
-- and introduced an off-by-one; this replaces its function definition).
--
-- BUG in the previous version: COUNT(DISTINCT (a.schedule_id, a.session_date))
-- over a LEFT JOIN. For any schedule row of the group with no matching
-- terlaksana attendance (i.e. every session not held yet), the join yields
-- a.schedule_id = NULL and a.session_date = NULL, and the row value
-- (NULL, NULL) is NOT a SQL NULL, so COUNT counted it as one extra
-- "session". Result: the dashboard showed realisasi + 1 for every group
-- still in progress (11IPA272003: 7 vs 6, 9SMP27003: 19 vs 18).
--
-- Fix: count realized sessions in a subquery over an INNER join, so there
-- are no NULL rows to miscount.
--
-- This function is now also the single source of truth for the Kelas
-- download (DownloadPage.tsx downloadKelas), which used to recompute
-- realisasi / jumlah / hari / lokasi client-side from four separate
-- unpaginated queries (each silently capped at Supabase's 1000 rows).
-- Dashboard and download now read the exact same numbers from here.

DROP FUNCTION IF EXISTS public.get_groups_with_realisasi();

CREATE FUNCTION public.get_groups_with_realisasi()
RETURNS TABLE(
  id           uuid,
  nama         text,
  kode         text,
  warna        text,
  warna_text   text,
  paket        integer,
  realisasi    bigint,
  active       boolean,
  sekolah      text,
  jumlah_siswa bigint,
  lokasi       text,
  hari         text[]
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    g.id, g.nama, g.kode, g.warna, g.warna_text, g.paket,
    (
      SELECT COUNT(*)
      FROM (
        SELECT DISTINCT a.schedule_id, a.session_date
        FROM public.attendance a
        JOIN public.schedules s ON s.id = a.schedule_id
        WHERE s.group_id = g.id
          AND a.person_role = 'teacher'
          AND a.sesi_status = 'terlaksana'
      ) r
    ) AS realisasi,
    g.active,
    g.sekolah,
    (SELECT COUNT(*) FROM public.student_groups sg WHERE sg.group_id = g.id) AS jumlah_siswa,
    (
      SELECT s.lokasi FROM public.schedules s
      WHERE s.group_id = g.id AND s.lokasi IS NOT NULL
      ORDER BY s.week_start DESC
      LIMIT 1
    ) AS lokasi,
    ARRAY(SELECT DISTINCT s.hari FROM public.schedules s WHERE s.group_id = g.id) AS hari
  FROM public.groups g
  ORDER BY g.nama;
$$;
-- The function now returns more per-class detail (school, student count,
-- location, days), so only logged-in users may call it (not anon).
REVOKE EXECUTE ON FUNCTION public.get_groups_with_realisasi() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_groups_with_realisasi() TO authenticated;

-- Returns inactive groups too (see the `active` column) because the
-- student portal also shows groups that have since been deactivated;
-- dashboard and download filter on `active` themselves.
