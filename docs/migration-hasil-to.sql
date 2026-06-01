-- ================================================================
-- Abdi Smart -- Hasil TO Migration
-- Version: 2026-06-01
--
-- Changes:
--   1. Create tryout_results table (if not exists)
--   2. Migrate TKA-Saintek / TKA-Soshum rows to unified TKA type
--   3. Tighten CHECK constraint to SNBT | TKA only
--   4. Enable RLS + policies
--   5. Create get_to_leaderboard RPC function
--
-- HOW TO RUN:
--   Supabase Dashboard > SQL Editor > New query > paste > Run
-- ================================================================


-- ----------------------------------------------------------------
-- STEP 1: Create tryout_results (safe if already exists)
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tryout_results (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid        NOT NULL REFERENCES public.profiles(id),
  type        text        NOT NULL,
  nama_to     text        NOT NULL,
  kode_to     text,
  tanggal_to  date,
  scores      jsonb,
  total_score numeric,
  entered_by  uuid        REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Add kode_to if table already existed without it
ALTER TABLE public.tryout_results
  ADD COLUMN IF NOT EXISTS kode_to text;


-- ----------------------------------------------------------------
-- STEP 2: Migrate existing TKA sub-types to TKA
-- ----------------------------------------------------------------

UPDATE public.tryout_results
  SET type = 'TKA'
  WHERE type IN ('TKA-Saintek', 'TKA-Soshum');


-- ----------------------------------------------------------------
-- STEP 3: Replace CHECK constraint to only allow SNBT | TKA
-- ----------------------------------------------------------------

ALTER TABLE public.tryout_results
  DROP CONSTRAINT IF EXISTS tryout_results_type_check;

ALTER TABLE public.tryout_results
  ADD CONSTRAINT tryout_results_type_check
    CHECK (type IN ('SNBT', 'TKA'));


-- ----------------------------------------------------------------
-- STEP 4: Enable RLS + policies
-- ----------------------------------------------------------------

ALTER TABLE public.tryout_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first so this script is re-runnable
DROP POLICY IF EXISTS "tryout_results: select"          ON public.tryout_results;
DROP POLICY IF EXISTS "tryout_results: insert (admin/staff)" ON public.tryout_results;
DROP POLICY IF EXISTS "tryout_results: update (admin/staff)" ON public.tryout_results;
DROP POLICY IF EXISTS "tryout_results: delete (admin)"  ON public.tryout_results;

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
-- STEP 5: Create get_to_leaderboard RPC
--
-- Returns all students ranked by total_score for a given
-- TO type + nama_to combination.
--
-- Params:
--   p_type    text  -- 'SNBT' or 'TKA'
--   p_nama_to text  -- exact nama_to value
-- ----------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_to_leaderboard(text, text);

CREATE OR REPLACE FUNCTION public.get_to_leaderboard(
  p_type    text,
  p_nama_to text
)
RETURNS TABLE (
  student_id   uuid,
  display_name text,
  total_score  numeric,
  rank         bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    tr.student_id,
    p.display_name,
    tr.total_score,
    RANK() OVER (ORDER BY tr.total_score DESC NULLS LAST) AS rank
  FROM public.tryout_results tr
  JOIN public.profiles p ON p.id = tr.student_id
  WHERE tr.type    = p_type
    AND tr.nama_to = p_nama_to
    AND tr.total_score IS NOT NULL
  ORDER BY rank, p.display_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_to_leaderboard(text, text)
  TO authenticated;
