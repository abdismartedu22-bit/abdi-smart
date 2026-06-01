-- ================================================================
-- Abdi Smart -- Hasil TO Migration
-- Version: 2026-06-01
--
-- Changes:
--   1. Add kode_to column to tryout_results
--   2. Migrate TKA-Saintek / TKA-Soshum rows to unified TKA type
--   3. Tighten CHECK constraint to SNBT | TKA only
--   4. Create get_to_leaderboard RPC function
--
-- HOW TO RUN:
--   Supabase Dashboard > SQL Editor > New query > paste > Run
-- ================================================================


-- ----------------------------------------------------------------
-- STEP 1: Add kode_to column
-- ----------------------------------------------------------------

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

-- Drop old constraint (name may vary; find it with:
--   SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.tryout_results'::regclass AND contype = 'c';
-- then replace the name below if needed)

ALTER TABLE public.tryout_results
  DROP CONSTRAINT IF EXISTS tryout_results_type_check;

ALTER TABLE public.tryout_results
  ADD CONSTRAINT tryout_results_type_check
    CHECK (type IN ('SNBT', 'TKA'));


-- ----------------------------------------------------------------
-- STEP 4: Create get_to_leaderboard RPC
--
-- Returns all students ranked by total_score for a given
-- TO type + nama_to combination. Students not in the result
-- set (no submission) are excluded.
--
-- Params:
--   p_type    text  -- 'SNBT' or 'TKA'
--   p_nama_to text  -- exact nama_to value (e.g. 'TO Nasional 1')
--
-- Returns per row:
--   student_id   uuid
--   display_name text
--   total_score  numeric
--   rank         bigint
-- ----------------------------------------------------------------

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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_to_leaderboard(text, text)
  TO authenticated;
