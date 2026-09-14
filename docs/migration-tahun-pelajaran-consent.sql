-- 1. Tahun Pelajaran (academic year) gating for students.
--
-- app_settings is a tiny global key/value config table -- today it only
-- holds 'tahun_pelajaran_aktif', the single year that counts as active.
-- Any student whose profiles.tahun_pelajaran doesn't match this value is
-- signed out on login (enforced client-side in AuthContext.tsx, not by
-- RLS -- see that file for why).
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text PRIMARY KEY,
  value       text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings: select (authenticated)" ON public.app_settings;
CREATE POLICY "app_settings: select (authenticated)"
  ON public.app_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "app_settings: insert (admin)" ON public.app_settings;
CREATE POLICY "app_settings: insert (admin)"
  ON public.app_settings FOR INSERT
  WITH CHECK (get_my_role() = 'admin');

DROP POLICY IF EXISTS "app_settings: update (admin)" ON public.app_settings;
CREATE POLICY "app_settings: update (admin)"
  ON public.app_settings FOR UPDATE
  USING (get_my_role() = 'admin');

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tahun_pelajaran text;

-- Seed the active year and backfill existing students so nobody gets
-- locked out the moment this ships.
INSERT INTO public.app_settings (key, value) VALUES ('tahun_pelajaran_aktif', '2026/2027')
  ON CONFLICT (key) DO NOTHING;

UPDATE public.profiles SET tahun_pelajaran = '2026/2027'
  WHERE role = 'student' AND tahun_pelajaran IS NULL;

-- 2. Login consent notice (anti-copying / sanksi notice).
-- NULL = not yet agreed -> modal shows every login. Once clicked, this is
-- stamped once and the modal never shows again for that account.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_at timestamptz;
