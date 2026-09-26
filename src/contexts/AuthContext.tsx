import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  blockedReason: string | null;
  clearBlockedReason: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    const prof = data as Profile | null;

    // is_active has always been shown as a status badge but never actually
    // enforced -- Login.tsx never checked it, so a deactivated account
    // could still sign in. Block it here for every role.
    if (prof && prof.is_active === false) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setBlockedReason('Akun ini sudah non-aktif. Hubungi admin jika ini keliru.');
      setLoading(false);
      return;
    }

    // Students belong to one tahun pelajaran at a time -- once the active
    // year moves on, their account stops being usable until an admin
    // updates it. Skip the check entirely for other roles / untagged rows.
    if (prof?.role === 'student' && prof.tahun_pelajaran) {
      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'tahun_pelajaran_aktif')
        .maybeSingle();
      const activeYear = setting?.value ?? null;
      if (activeYear && prof.tahun_pelajaran !== activeYear) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setBlockedReason('Akun untuk tahun pelajaran ini sudah tidak aktif. Hubungi admin jika ini keliru.');
        setLoading(false);
        return;
      }
    }

    setProfile(prof);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfile(u.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, blockedReason,
      clearBlockedReason: () => setBlockedReason(null),
      refreshProfile, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
