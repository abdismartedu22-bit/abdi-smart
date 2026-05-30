import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Banner = { id: string; url: string; caption: string | null; display_order: number; active: boolean };

export default function BannerManager() {
  const { user } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Banner | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('dashboard_banners')
      .select('id, url, caption, display_order, active')
      .order('display_order');
    setBanners((data ?? []) as Banner[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    await supabase.from('dashboard_banners').delete().eq('id', id);
    load();
  }

  async function handleToggle(b: Banner) {
    await supabase.from('dashboard_banners').update({ active: !b.active }).eq('id', b.id);
    load();
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '18px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <p style={sectionLabel}>Slide Banner Dashboard</p>
        {banners.length < 3 && (
          <button onClick={() => { setEditTarget(null); setShowForm(true); }} style={addBtn}>+ Tambah</button>
        )}
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : banners.length === 0 ? (
        <p style={muted}>Belum ada banner. Tambah hingga 3 slide.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {banners.map((b, i) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: b.active ? '#F9F9F7' : '#F3F2EE', borderRadius: '7px', flexWrap: 'wrap' }}>
              <div style={{
                width: '64px', height: '36px', borderRadius: '5px', flexShrink: 0, overflow: 'hidden',
                background: '#E2E1DC', backgroundImage: `url(${b.url})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#0D0D0D', fontWeight: 600 }}>
                  Slide {i + 1}
                </div>
                {b.caption && (
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.73rem', color: '#666', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.caption}
                  </div>
                )}
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: b.active ? '#DCFCE7' : '#F3F2EE', color: b.active ? '#15803D' : '#888', flexShrink: 0 }}>
                {b.active ? 'Aktif' : 'Non-aktif'}
              </span>
              <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                <button onClick={() => handleToggle(b)} style={ghostBtn}>{b.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button onClick={() => { setEditTarget(b); setShowForm(true); }} style={ghostBtn}>Edit</button>
                <button onClick={() => handleDelete(b.id)} style={{ ...ghostBtn, color: '#DC0A1E', borderColor: '#FECACA' }}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <BannerForm
          banner={editTarget}
          userId={user?.id ?? ''}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function BannerForm({ banner, userId, onClose, onSaved }: { banner: Banner | null; userId: string; onClose: () => void; onSaved: () => void }) {
  const [url, setUrl] = useState(banner?.url ?? '');
  const [caption, setCaption] = useState(banner?.caption ?? '');
  const [order, setOrder] = useState(banner?.display_order?.toString() ?? '1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!url.trim()) { setError('URL gambar wajib diisi'); return; }
    setSaving(true);
    setError('');
    const payload = {
      url: url.trim(),
      caption: caption.trim() || null,
      display_order: parseInt(order) || 1,
      active: true,
    };
    const { error: err } = banner
      ? await supabase.from('dashboard_banners').update(payload).eq('id', banner.id)
      : await supabase.from('dashboard_banners').insert({ ...payload, created_by: userId });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: 0 }}>{banner ? 'Edit Banner' : 'Tambah Banner'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#666' }}>&#x2715;</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>URL Gambar</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
            {url && (
              <div style={{ marginTop: '6px', height: '80px', borderRadius: '6px', overflow: 'hidden', background: '#F3F2EE', backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            )}
          </div>
          <div>
            <label style={labelStyle}>Caption (opsional)</label>
            <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Teks di bawah gambar..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Urutan (1-3)</label>
            <input type="number" min="1" max="3" value={order} onChange={e => setOrder(e.target.value)} style={{ ...inputStyle, width: '80px' }} />
          </div>

          {error && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: '#DC0A1E', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button onClick={onClose} style={btnSecondary}>Batal</button>
            <button onClick={handleSave} disabled={saving} style={btnPrimary}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666', margin: 0 };
const sectionLabel: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700, color: '#666', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' };
const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, color: '#2E2E2E', display: 'block', marginBottom: '4px' };
const inputStyle: React.CSSProperties = { padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '8px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', outline: 'none', color: '#0D0D0D', background: '#fff', width: '100%', boxSizing: 'border-box' };
const addBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#0D5C3A', fontWeight: 600, padding: 0 };
const ghostBtn: React.CSSProperties = { padding: '4px 10px', background: 'none', color: '#666', border: '1px solid #E2E1DC', borderRadius: '5px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.75rem' };
const btnPrimary: React.CSSProperties = { flex: 1, padding: '10px', background: '#0D5C3A', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
const btnSecondary: React.CSSProperties = { flex: 1, padding: '10px', background: '#F3F2EE', color: '#2E2E2E', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
