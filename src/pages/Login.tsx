import { useState, FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [showForgot, setShowForgot] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const { data: email, error: rpcErr } = await supabase.rpc(
        'get_email_by_username',
        { p_username: username.trim() }
      );

      if (rpcErr || !email) {
        setError('Username atau password salah');
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

      if (signInErr) {
        setError('Username atau password salah');
        return;
      }

      navigate('/dashboard', { replace: true });
    } catch {
      setError('Username atau password salah');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F3F2EE',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 4px 40px rgba(0,0,0,0.08)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px', gap: '12px' }}>
          <div style={{
            width: '56px', height: '56px',
            background: '#0F1F6B',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img src="/logo.png" alt="Abdi Smart" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1.1rem', letterSpacing: '-0.02em', color: '#0D0D0D' }}>
              Abdi Smart Education
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', marginTop: '2px' }}>
              Masuk ke Sistem
            </div>
          </div>
        </div>

        <div style={{ height: '1px', background: '#E2E1DC', marginBottom: '24px' }} />

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Username</label>
            <input
              type="text"
              placeholder="nama_pengguna"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoFocus
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ ...inputStyle, paddingRight: '44px', width: '100%', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#666',
                }}
              >
                {showPw ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: '#FFF0F1', border: '1px solid #FFC8CC',
              borderRadius: '8px', padding: '10px 12px',
              fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#DC0A1E',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '13px',
              background: submitting ? '#3a57b5' : '#0F1F6B',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              marginTop: '4px',
              transition: 'background 0.2s',
            }}
          >
            {submitting ? 'Masuk...' : 'Masuk'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={() => setShowForgot(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-body)', fontSize: '0.85rem',
              color: '#0F1F6B', textDecoration: 'underline',
            }}
          >
            Lupa password?
          </button>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [uname, setUname] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: email, error: rpcErr } = await supabase.rpc(
        'get_email_by_username',
        { p_username: uname.trim() }
      );

      if (rpcErr || !email) {
        setError('Tidak dapat mengirim link reset. Pastikan username benar atau hubungi admin.');
        return;
      }

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetErr) {
        setError('Gagal mengirim email. Coba lagi atau hubungi admin.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: '20px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '32px',
        width: '100%', maxWidth: '380px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: '0 0 8px', color: '#0D0D0D' }}>
          Lupa Password?
        </h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: '0 0 20px' }}>
          Masukkan username kamu untuk menerima link reset password.
        </p>

        {success ? (
          <div>
            <div style={{
              background: '#ECFDF5', border: '1px solid #6EE7B7',
              borderRadius: '8px', padding: '12px',
              fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#047857',
              marginBottom: '20px',
            }}>
              Link reset password sudah dikirim ke email kamu. Cek inbox (dan folder spam).
            </div>
            <button onClick={onClose} style={{ ...btnPrimary, width: '100%' }}>Tutup</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Username</label>
              <input
                type="text"
                value={uname}
                onChange={(e) => setUname(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
            </div>
            {error && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: '#DC0A1E', margin: 0 }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={onClose} style={btnSecondary}>Batal</button>
              <button type="submit" disabled={loading} style={btnPrimary}>
                {loading ? 'Mengirim...' : 'Kirim Link Reset'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#2E2E2E',
};

const inputStyle: React.CSSProperties = {
  padding: '11px 13px',
  border: '1.5px solid #E2E1DC',
  borderRadius: '8px',
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  outline: 'none',
  color: '#0D0D0D',
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box',
};

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '10px 16px',
  background: '#0F1F6B', color: '#fff',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
};

const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '10px 16px',
  background: '#F3F2EE', color: '#2E2E2E',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
};

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
