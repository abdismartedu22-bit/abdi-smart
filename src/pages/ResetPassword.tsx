import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PasswordInput from '../components/shared/PasswordInput';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the hash contains a valid token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    // Also handle the case where getSession returns a recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

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
    setTimeout(() => navigate('/login', { replace: true }), 2000);
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
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', margin: '0 0 8px', color: '#0D0D0D' }}>
          Reset Password
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: '0 0 24px' }}>
          Masukkan password baru untuk akunmu.
        </p>

        {success ? (
          <div style={{
            background: '#ECFDF5', border: '1px solid #6EE7B7',
            borderRadius: '8px', padding: '14px',
            fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#047857',
          }}>
            Password berhasil diubah! Mengalihkan ke halaman login...
          </div>
        ) : !ready ? (
          <div style={{ fontFamily: 'var(--font-body)', color: '#666', fontSize: '0.9rem' }}>
            Memverifikasi link reset...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Password Baru</label>
              <PasswordInput value={newPw} onChange={setNewPw} required minLength={8} autoFocus style={inputStyle} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Konfirmasi Password</label>
              <PasswordInput value={confirmPw} onChange={setConfirmPw} required style={inputStyle} />
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
              disabled={loading}
              style={{
                padding: '13px',
                background: loading ? '#3a57b5' : '#0D5C3A',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '4px',
              }}
            >
              {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
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
};
