-- ================================================================
-- Abdi Smart -- Quiz System Migration
-- Version: 2026-05-31
--
-- HOW TO RUN:
--   Supabase Dashboard > SQL Editor > New query > paste > Run
-- ================================================================


-- ----------------------------------------------------------------
-- STEP 1: Create quiz tables
-- ----------------------------------------------------------------

CREATE TABLE public.quizzes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor       integer     NOT NULL,
  judul       text        NOT NULL,
  deskripsi   text,
  created_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quiz_questions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id        uuid        NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  urutan         integer     NOT NULL DEFAULT 1,
  tipe           text        NOT NULL CHECK (tipe IN ('pilihan_ganda', 'isian_singkat', 'benar_salah', 'centang_semua')),
  pertanyaan     text        NOT NULL,
  opsi           text[],
  jawaban_benar  jsonb       NOT NULL,
  poin           numeric     NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quiz_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       uuid        NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  schedule_id   uuid        REFERENCES public.schedules(id) ON DELETE SET NULL,
  group_id      uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  session_date  date        NOT NULL,
  activated_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  activated_at  timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz
);

CREATE TABLE public.quiz_answers (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_session_id  uuid        NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  student_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id      uuid        NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  jawaban          jsonb,
  skor             numeric,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_session_id, student_id, question_id)
);


-- ----------------------------------------------------------------
-- STEP 2: Indexes
-- ----------------------------------------------------------------

CREATE INDEX quiz_questions_quiz_id_idx   ON public.quiz_questions(quiz_id);
CREATE INDEX quiz_sessions_group_id_idx   ON public.quiz_sessions(group_id);
CREATE INDEX quiz_sessions_quiz_id_idx    ON public.quiz_sessions(quiz_id);
CREATE INDEX quiz_sessions_date_idx       ON public.quiz_sessions(session_date);
CREATE INDEX quiz_answers_session_id_idx  ON public.quiz_answers(quiz_session_id);
CREATE INDEX quiz_answers_student_id_idx  ON public.quiz_answers(student_id);


-- ----------------------------------------------------------------
-- STEP 3: Enable RLS
-- ----------------------------------------------------------------

ALTER TABLE public.quizzes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers   ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------
-- STEP 4: RLS Policies
-- ----------------------------------------------------------------

-- ---- quizzes ----

CREATE POLICY "quizzes: select (authenticated)"
  ON public.quizzes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "quizzes: insert (admin)"
  ON public.quizzes FOR INSERT
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "quizzes: update (admin)"
  ON public.quizzes FOR UPDATE
  USING (get_my_role() = 'admin');

CREATE POLICY "quizzes: delete (admin)"
  ON public.quizzes FOR DELETE
  USING (get_my_role() = 'admin');


-- ---- quiz_questions ----

CREATE POLICY "quiz_questions: select (authenticated)"
  ON public.quiz_questions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "quiz_questions: insert (admin)"
  ON public.quiz_questions FOR INSERT
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "quiz_questions: update (admin)"
  ON public.quiz_questions FOR UPDATE
  USING (get_my_role() = 'admin');

CREATE POLICY "quiz_questions: delete (admin)"
  ON public.quiz_questions FOR DELETE
  USING (get_my_role() = 'admin');


-- ---- quiz_sessions ----

CREATE POLICY "quiz_sessions: select (authenticated)"
  ON public.quiz_sessions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "quiz_sessions: insert (teacher)"
  ON public.quiz_sessions FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'teacher'));

CREATE POLICY "quiz_sessions: update (teacher/admin)"
  ON public.quiz_sessions FOR UPDATE
  USING (get_my_role() IN ('admin', 'teacher'));

CREATE POLICY "quiz_sessions: delete (admin)"
  ON public.quiz_sessions FOR DELETE
  USING (get_my_role() = 'admin');


-- ---- quiz_answers ----

-- Students see only their own answers; admin/staff/teacher see all
CREATE POLICY "quiz_answers: select"
  ON public.quiz_answers FOR SELECT
  USING (
    student_id = auth.uid()
    OR get_my_role() IN ('admin', 'staff', 'teacher')
  );

-- Students insert their own answers only
CREATE POLICY "quiz_answers: insert (student)"
  ON public.quiz_answers FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND get_my_role() = 'student'
  );

-- Admin can update (manual correction if needed)
CREATE POLICY "quiz_answers: update (admin)"
  ON public.quiz_answers FOR UPDATE
  USING (get_my_role() = 'admin');

CREATE POLICY "quiz_answers: delete (admin)"
  ON public.quiz_answers FOR DELETE
  USING (get_my_role() = 'admin');
