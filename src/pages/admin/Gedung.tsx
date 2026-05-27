import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Gedung } from '../../types';

export default function AdminGedung() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [gedung, setGedung] = useState<Gedung[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Gedung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Gedung | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('gedung')
      .select('*')
      .order('nama')
      .order('ruangan');
    setGedung(data ?? []);
    setLoading(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    const { error } = await supabase.from('gedung').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { setDeleteError(error.message); return; }
    setDeleteTarget(null);
    load();
  }

  // Group by building name for display
  const grouped: Record<string, Gedung[]> = {};
  gedung.forEach(g => {
    if (!grouped[g.nama]) grouped[g.nama] = [];
    grouped[g.nama].push(g);
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>
          Gedung &amp; Ruangan
        </h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={btnPrimary}>
          + Tambah Ruangan
        </button>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : gedung.length === 0 ? (
        <p style={muted}>Belum ada data gedung.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {Object.entries(grouped).map(([bldg, rooms]) => (
            <div key={bldg}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: '0 0 10px', color: '#0F1F6B' }}>
                {bldg}
              </h2>
              <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
                {rooms.map((r, i) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px',
                      borderBottom: i < rooms.length - 1 ? '1px solid #E2E1DC' : 'none',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{
                      background: '#0F1F6B', color: '#FFE500',
                      padding: '3px 10px', borderRadius: '6px',
                      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.82rem',
                      letterSpacing: '0.05em', flexShrink: 0,
                    }}>
                      {r.ruangan}
                    </span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D' }}>
                        {r.kapasitas ? `Kapasitas ${r.kapasitas} orang` : 'Kapasitas tidak diatur'}
                      </span>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px',
                      fontSize: '0.72rem', fontWeight: 700,
                      background: r.status === 'aktif' ? '#DCFCE7' : '#F3F2EE',
                      color: r.status === 'aktif' ? '#15803D' : '#666',
                    }}>
                      {r.status.toUpperCase()}
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => { setEditing(r); setShowForm(true); }} style={btnEdit}>Edit</button>
                      {isAdmin && (
                        <button onClick={() => { setDeleteTarget(r); setDeleteError(''); }} style={btnDelete}>Hapus</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <GedungFormModal
          gedung={editing ?? undefined}
          onClose={() => setShowForm(false)}
          onDone={() => { setShowForm(false); load(); }}
        />
      )}

      {deleteTarget && (
        <div style={overlay}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: '0 0 10px', color: '#0D0D0D' }}>Hapus Ruangan?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 20px' }}>
              Ruangan <strong>{deleteTarget.nama} - {deleteTarget.ruangan}</strong> akan dihapus permanen.
            </p>
            {deleteError && <p style={errorText}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteTarget(null)} style={btnSecondary}>Batal</button>
              <button onClick={confirmDelete} disabled={deleting} style={{ ...btnPrimary, background: '#DC0A1E' }}>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GedungFormModal({ gedung, onClose, onDone }: { gedung?: Gedung; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    nama: gedung?.nama ?? '',
    ruangan: gedung?.ruangan ?? '',
    kapasitas: gedung?.kapasitas?.toString() ?? '',
    status: gedung?.status ?? 'aktif' as 'aktif' | 'nonaktif',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.nama || !form.ruangan) { setError('Nama gedung dan kode ruangan wajib diisi'); return; }
    setSubmitting(true);
    const payload = {
      nama: form.nama.trim(),
      ruangan: form.ruangan.trim().toUpperCase(),
      kapasitas: form.kapasitas ? parseInt(form.kapasitas) : null,
      status: form.status,
    };
    const { error: err } = gedung
      ? await supabase.from('gedung').update(payload).eq('id', gedung.id)
      : await supabase.from('gedung').insert(payload);
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    onDone();
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: 0 }}>
            {gedung ? 'Edit Ruangan' : 'Tambah Ruangan'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#666' }}>&#x2715;</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Nama Gedung">
            <input
              style={input}
              value={form.nama}
              onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
              placeholder="cth. Badak Agung"
              required
            />
          </Field>
          <Field label="Kode Ruangan">
            <input
              style={input}
              value={form.ruangan}
              onChange={e => setForm(f => ({ ...f, ruangan: e.target.value.toUpperCase().slice(0, 4) }))}
              placeholder="cth. A"
              maxLength={4}
              required
            />
          </Field>
          <Field label="Kapasitas (orang)">
            <input
              style={input}
              type="number"
              min="1"
              value={form.kapasitas}
              onChange={e => setForm(f => ({ ...f, kapasitas: e.target.value }))}
              placeholder="cth. 6"
            />
          </Field>
          <Field label="Status">
            <div style={{ display: 'flex', gap: '16px' }}>
              {(['aktif', 'nonaktif'] as const).map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                  <input type="radio" name="status" value={s} checked={form.status === s} onChange={() => setForm(f => ({ ...f, status: s }))} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </label>
              ))}
            </div>
          </Field>
          {error && <p style={errorText}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Batal</button>
            <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, color: '#2E2E2E' }}>{label}</label>
      {children}
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const errorText: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: '#DC0A1E', margin: 0 };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' };
const modal: React.CSSProperties = { background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' };
const input: React.CSSProperties = { padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '7px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', outline: 'none', color: '#0D0D0D', background: '#fff', width: '100%', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { flex: 1, padding: '10px 16px', background: '#0F1F6B', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
const btnSecondary: React.CSSProperties = { flex: 1, padding: '10px 16px', background: '#F3F2EE', color: '#2E2E2E', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' };
const btnEdit: React.CSSProperties = { padding: '5px 12px', background: '#E6EAF8', color: '#0F1F6B', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem' };
const btnDelete: React.CSSProperties = { padding: '5px 12px', background: '#FFF0F1', color: '#DC0A1E', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem' };
