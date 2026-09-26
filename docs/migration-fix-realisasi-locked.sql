-- Fixes the "Sisa Sesi < 10" dashboard widget under-counting realisasi
-- compared to the Download export and the student's own portal.
--
-- Root cause: get_groups_with_realisasi() only counted an attendance row
-- as realized when locked_at IS NOT NULL. But locked_at is only ever set
-- by the teacher's own "Kunci Sesi" action (teacher/Realisasi.tsx) --
-- when admin/staff enters or corrects a session's status directly via
-- admin/Realisasi.tsx's edit modal, sesi_status is saved WITHOUT ever
-- setting locked_at. Every other consumer of this data (DownloadPage's
-- downloadKelas(), StudentHome.tsx's own "Terealisasi" stat) only checks
-- sesi_status = 'terlaksana' and never looks at locked_at, so any
-- admin-entered session was silently excluded from just this one widget.
--
-- Fix: drop the locked_at requirement entirely (locked_at still exists
-- and still tracks whether a teacher has locked their own row -- it's
-- just no longer a precondition for counting realisasi), and dedupe on
-- (schedule_id, session_date) to match downloadKelas()'s counting key
-- exactly instead of schedule_id alone.

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
    COUNT(DISTINCT (a.schedule_id, a.session_date)) AS realisasi,
    g.active
  FROM public.groups g
  LEFT JOIN public.schedules s ON s.group_id = g.id
  LEFT JOIN public.attendance a
    ON  a.schedule_id = s.id
    AND a.person_role = 'teacher'
    AND a.sesi_status = 'terlaksana'
  WHERE g.active = true
  GROUP BY g.id, g.nama, g.kode, g.warna, g.warna_text, g.paket, g.active
  ORDER BY g.nama;
$$;
