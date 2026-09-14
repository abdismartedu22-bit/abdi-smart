-- Adds the 'grid_pernyataan' question type to Quiz (a table of multiple
-- true/false statements, same shape as Try Out's grid_pernyataan type),
-- alongside Quiz's existing types -- nothing existing is removed.

ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS grid_config jsonb;

-- The CHECK constraint on `tipe` was created inline (unnamed) in
-- migration-quiz.sql, so Postgres auto-named it quiz_questions_tipe_check.
-- Verify the name first if this fails:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'public.quiz_questions'::regclass AND contype = 'c';
ALTER TABLE public.quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_tipe_check;
ALTER TABLE public.quiz_questions ADD CONSTRAINT quiz_questions_tipe_check
  CHECK (tipe IN ('pilihan_ganda', 'isian_singkat', 'benar_salah', 'centang_semua', 'grid_pernyataan'));

-- Pembahasan (explanation shown to students on the review page), same as
-- Try Out's pembahasan_html -- replaces the old fixed gambar_url authoring
-- field, which is now redundant since the rich-text editor can insert
-- images inline. gambar_url itself is left in place for old rows.
ALTER TABLE public.quiz_questions ADD COLUMN IF NOT EXISTS pembahasan_html text;
