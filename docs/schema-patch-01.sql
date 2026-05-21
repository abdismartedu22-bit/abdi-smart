-- ================================================================
-- Abdi Smart -- Schema Patch 01
-- Real email + username-to-email RPC + password reset redirect
--
-- Run this in Supabase SQL Editor (tables already exist)
-- ================================================================

-- Add real email column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text UNIQUE;

-- Update trigger to also store email (original trigger didn't have this column)
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
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- RPC: resolve email from username
-- Called UNAUTHENTICATED on the login page and forgot-password flow.
-- Only exposes email -- nothing else from the profiles row.
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT email
  FROM   public.profiles
  WHERE  lower(username) = lower(p_username)
$$;

-- ================================================================
-- AFTER running this SQL, also do in Supabase Dashboard:
--
--   Authentication > URL Configuration
--     Site URL:          https://your-vercel-domain.vercel.app
--     Redirect URLs:     https://your-vercel-domain.vercel.app/reset-password
--
--   Authentication > Sign In / Providers > Email (scroll down)
--     Confirm email:     OFF  (admin creates accounts, no confirmation needed)
--
--   Authentication > Policies
--     Allow new users to sign up:  OFF
-- ================================================================
