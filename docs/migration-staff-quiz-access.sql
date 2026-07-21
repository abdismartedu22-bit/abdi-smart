-- ================================================================
-- Abdi Smart -- Staff Quiz Access Migration
-- Version: 2026-07-21
--
-- Changes:
--   1. Allow staff to insert/update/delete quizzes
--   2. Allow staff to insert/update/delete quiz_questions
--
-- Context: staff now has access to the Quiz page (same page as
-- admin, at /staff/quiz) but the RLS policies from
-- migration-quiz.sql only allowed the admin role to write, so
-- staff writes were silently rejected by Postgres.
--
-- HOW TO RUN:
--   Supabase Dashboard > SQL Editor > New query > paste > Run
-- ================================================================


-- ---- quizzes ----

DROP POLICY IF EXISTS "quizzes: insert (admin)" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes: update (admin)" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes: delete (admin)" ON public.quizzes;

CREATE POLICY "quizzes: insert (admin/staff)"
  ON public.quizzes FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "quizzes: update (admin/staff)"
  ON public.quizzes FOR UPDATE
  USING (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "quizzes: delete (admin/staff)"
  ON public.quizzes FOR DELETE
  USING (get_my_role() IN ('admin', 'staff'));


-- ---- quiz_questions ----

DROP POLICY IF EXISTS "quiz_questions: insert (admin)" ON public.quiz_questions;
DROP POLICY IF EXISTS "quiz_questions: update (admin)" ON public.quiz_questions;
DROP POLICY IF EXISTS "quiz_questions: delete (admin)" ON public.quiz_questions;

CREATE POLICY "quiz_questions: insert (admin/staff)"
  ON public.quiz_questions FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "quiz_questions: update (admin/staff)"
  ON public.quiz_questions FOR UPDATE
  USING (get_my_role() IN ('admin', 'staff'));

CREATE POLICY "quiz_questions: delete (admin/staff)"
  ON public.quiz_questions FOR DELETE
  USING (get_my_role() IN ('admin', 'staff'));
