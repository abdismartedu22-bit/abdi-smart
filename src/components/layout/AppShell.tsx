import { useState, FormEvent } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Sidebar from './Sidebar';
import PasswordInput from '../shared/PasswordInput';
import type { Role } from '../../types';

const roleBadge: Record<Role, { label: string; bg: string; color: string }> = {
  admin:   { label: 'ADMIN',    bg: '#DC0A1E', color: '#fff' },
  staff:   { label: 'STAFF',    bg: '#0F1F6B', color: '#fff' },
  teacher: { label: 'PENGAJAR', bg: '#047857', color: '#fff' },
  student: { label: 'SISWA',    bg: '#4B5563', color: '#fff' },
};

export default function AppShell() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

  const role = profile?.role ?? 'student';
  const badge = roleBadge[role];

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F3F2EE' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          height: '64px',
          background: '#fff',
          borderBottom: '1px solid #E2E1DC',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: '16px',
          flexShrink: 0,
          zIndex: 30,
        }}>
          {/* Hamburger */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect y="4" width="22" height="2" rx="1" fill="#0D0D0D" />
              <rect y="10" width="22" height="2" rx="1" fill="#0D0D0D" />
              <rect y="16" width="22" height="2" rx="1" fill="#0D0D0D" />
            </svg>
          </button>

          <div style={{ flex: 1 }} />

          {/* Right side: badge + name + user menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
            <span style={{
              background: badge.bg,
              color: badge.color,
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '3px 8px',
              borderRadius: '4px',
              fontFamily: 'var(--font-body)',
            }}>
              {badge.label}
            </span>

            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.88rem',
                color: '#0D0D0D',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 2px',
              }}
            >
              {profile?.display_name ?? '...'}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginTop: '1px' }}>
                <path d="M3 5L7 9L11 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <>
                <div onClick={() => setUserMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: '#fff',
                  border: '1px solid #E2E1DC',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  minWidth: '180px',
                  zIndex: 20,
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => { setUserMenuOpen(false); setShowChangePw(true); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '11px 16px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.88rem',
                      color: '#0D0D0D',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F2EE')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    Ganti Password
                  </button>
                  <div style={{ height: '1px', background: '#E2E1DC' }} />
                  <button
                    onClick={() => { setUserMenuOpen(false); handleSignOut(); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '11px 16px',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.88rem',
                      color: '#DC0A1E',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FFF0F1')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    Keluar
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: '28px' }}>
          <Outlet />
        </main>
      </div>

      {/* Change password modal */}
      {showChangePw && (
        <ChangePwModal onClose={() => setShowChangePw(false)} />
      )}
    </div>
  );
}

function ChangePwModal({ onClose }: { onClose: () => void }) {
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPw.length < 8) { setError('Password minimal 8 karakter'); return; }
    if (newPw !== confirmPw) { setError('Password tidak cocok'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPw });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess(true);
    setTimeout(onClose, 1800);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '32px',
        width: '100%', maxWidth: '400px', margin: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', margin: '0 0 20px', color: '#0D0D0D' }}>
          Ganti Password
        </h2>

        {success ? (
          <p style={{ fontFamily: 'var(--font-body)', color: '#047857', fontSize: '0.9rem' }}>
            Password berhasil diubah!
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field label="Password Baru" value={newPw} onChange={setNewPw} />
            <Field label="Konfirmasi Password" value={confirmPw} onChange={setConfirmPw} />
            {error && <p style={{ fontFamily: 'var(--font-body)', color: '#DC0A1E', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button type="button" onClick={onClose} style={btnSecondary}>Batal</button>
              <button type="submit" disabled={loading} style={btnPrimary}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, color: '#2E2E2E' }}>{label}</label>
      <PasswordInput value={value} onChange={onChange} required style={inputStyle} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1.5px solid #E2E1DC',
  borderRadius: '8px',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  outline: 'none',
  color: '#0D0D0D',
  background: '#fff',
};

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '10px', background: '#0F1F6B', color: '#fff',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
};

const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '10px', background: '#F3F2EE', color: '#2E2E2E',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
};
