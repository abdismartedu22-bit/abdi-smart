import { useState, useEffect, FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Overlay, ModalHeader, Field,
  input, btnPrimary, btnSecondary, btnEdit, btnGhost, muted, errorText, confirmBox, confirmTitle,
  fmtDateTime, toLocalInputValue, fromLocalInputValue,
} from './shared';
import type { ToPackage } from '../../types';

const KELAS_OPTIONS = ['6SD', '9SMP', '10', '11', '12IPA', '12IPS'];

export default function ToPaketList() {
  const location = useLocation();
  const base = location.pathname.startsWith('/staff') ? '/staff/to' : '/admin/to';
  const [packages, setPackages] = useState<ToPackage[]>([]);
  const [examCounts, setExamCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [editPkg, setEditPkg] = useState<ToPackage | null>(null);
  const [deletePkg, setDeletePkg] = useState<ToPackage | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('to_packages').select('*').order('tanggal_mulai', { ascending: false });
    const pkgs = (data ?? []) as ToPackage[];
    setPackages(pkgs);
    if (pkgs.length > 0) {
      const { data: exams } = await supabase.from('to_exams').select('package_id');
      const counts: Record<string, number> = {};
      (exams ?? []).forEach((e: { package_id: string }) => { counts[e.package_id] = (counts[e.package_id] ?? 0) + 1; });
      setExamCounts(counts);
    }
    setLoading(false);
  }

  async function confirmDelete() {
    if (!deletePkg) return;
    setDeleting(true);
    await supabase.from('to_packages').delete().eq('id', deletePkg.id);
    setDeleting(false);
    setDeletePkg(null);
    load();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>Try Out &mdash; Paket</h1>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Buat Paket TO</button>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : packages.length === 0 ? (
        <p style={muted}>Belum ada paket try out.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {packages.map(pkg => (
            <div key={pkg.id} style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: '#0D0D0D' }}>{pkg.nama}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', marginTop: '3px' }}>
                  {fmtDateTime(pkg.tanggal_mulai)} &mdash; {fmtDateTime(pkg.tanggal_selesai)}
                  {' · '}{examCounts[pkg.id] ?? 0} ujian
                  {pkg.target_kelas && pkg.target_kelas.length > 0 && ` · ${pkg.target_kelas.join(', ')}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <Link to={`${base}/paket/${pkg.id}`} style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block' }}>Kelola Ujian</Link>
                <button onClick={() => setEditPkg(pkg)} style={btnEdit}>Edit</button>
                <button onClick={() => setDeletePkg(pkg)} style={{ ...btnGhost, color: '#DC0A1E' }}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showCreate || editPkg) && (
        <PaketFormModal
          pkg={editPkg ?? undefined}
          onClose={() => { setShowCreate(false); setEditPkg(null); }}
          onDone={() => { setShowCreate(false); setEditPkg(null); load(); }}
        />
      )}

      {deletePkg && (
        <Overlay>
          <div style={confirmBox}>
            <h2 style={confirmTitle}>Hapus Paket?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 20px' }}>
              Paket <strong>{deletePkg.nama}</strong> beserta semua ujian dan soal di dalamnya akan dihapus permanen.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeletePkg(null)} style={btnSecondary}>Batal</button>
              <button onClick={confirmDelete} disabled={deleting} style={{ ...btnPrimary, background: '#DC0A1E' }}>{deleting ? 'Menghapus...' : 'Hapus'}</button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function PaketFormModal({ pkg, onClose, onDone }: { pkg?: ToPackage; onClose: () => void; onDone: () => void }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    nama: pkg?.nama ?? '',
    deskripsi: pkg?.deskripsi ?? '',
    tanggal_mulai: toLocalInputValue(pkg?.tanggal_mulai ?? null),
    tanggal_selesai: toLocalInputValue(pkg?.tanggal_selesai ?? null),
    target_kelas: new Set(pkg?.target_kelas ?? []),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.nama.trim() || !form.tanggal_mulai || !form.tanggal_selesai) { setError('Nama dan tanggal wajib diisi'); return; }
    if (new Date(form.tanggal_selesai).getTime() <= new Date(form.tanggal_mulai).getTime()) {
      setError('Tanggal selesai harus setelah tanggal mulai');
      return;
    }

    setSubmitting(true);
    const payload = {
      nama: form.nama.trim(),
      deskripsi: form.deskripsi.trim() || null,
      tanggal_mulai: fromLocalInputValue(form.tanggal_mulai),
      tanggal_selesai: fromLocalInputValue(form.tanggal_selesai),
      target_kelas: form.target_kelas.size > 0 ? Array.from(form.target_kelas) : null,
    };
    const { error: err } = pkg
      ? await supabase.from('to_packages').update(payload).eq('id', pkg.id)
      : await supabase.from('to_packages').insert({ ...payload, created_by: profile?.id });

    // If the package's window was narrowed, clamp any exam that now
    // sticks out past the new range back inside it -- otherwise an
    // exam edited/created under the old, wider window silently keeps
    // dates outside its own package (the exact bug reported).
    if (!err && pkg) {
      const newStart = new Date(payload.tanggal_mulai).getTime();
      const newEnd = new Date(payload.tanggal_selesai).getTime();
      const { data: exams } = await supabase.from('to_exams').select('id, tanggal_mulai, tanggal_selesai').eq('package_id', pkg.id);
      for (const ex of exams ?? []) {
        const exStart = new Date(ex.tanggal_mulai).getTime();
        const exEnd = new Date(ex.tanggal_selesai).getTime();
        // Entirely outside the new range on one side (e.g. package
        // narrowed past the exam's whole old window) -- naive clamping
        // would collapse start===end, so fall back to the full new
        // package window instead of a zero-length exam.
        const noOverlap = exEnd <= newStart || exStart >= newEnd;
        const clampedStart = noOverlap ? newStart : Math.min(Math.max(exStart, newStart), newEnd);
        const clampedEnd = noOverlap ? newEnd : Math.max(Math.min(exEnd, newEnd), newStart);
        if (clampedStart !== exStart || clampedEnd !== exEnd) {
          await supabase.from('to_exams').update({
            tanggal_mulai: new Date(clampedStart).toISOString(),
            tanggal_selesai: new Date(clampedEnd).toISOString(),
          }).eq('id', ex.id);
        }
      }
    }

    setSubmitting(false);
    if (err) { setError(err.message); return; }
    onDone();
  }

  return (
    <Overlay>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <ModalHeader title={pkg ? 'Edit Paket TO' : 'Buat Paket TO'} onClose={onClose} />
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Nama Paket">
            <input style={input} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="cth. TO SNBT ke-5" required />
          </Field>
          <Field label="Deskripsi (opsional)">
            <input style={input} value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Tanggal Mulai">
              <input style={input} type="datetime-local" value={form.tanggal_mulai} onChange={e => setForm(f => ({ ...f, tanggal_mulai: e.target.value }))} required />
            </Field>
            <Field label="Tanggal Selesai">
              <input
                style={input} type="datetime-local" value={form.tanggal_selesai}
                min={form.tanggal_mulai || undefined}
                onChange={e => setForm(f => ({ ...f, tanggal_selesai: e.target.value }))} required
              />
            </Field>
          </div>
          <Field label="Target Kelas (kosongkan untuk semua)">
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {KELAS_OPTIONS.map(k => {
                const active = form.target_kelas.has(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm(f => { const n = new Set(f.target_kelas); active ? n.delete(k) : n.add(k); return { ...f, target_kelas: n }; })}
                    style={{
                      padding: '5px 12px', borderRadius: '16px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem',
                      border: active ? '2px solid #0D5C3A' : '2px solid #E2E1DC',
                      background: active ? '#D6EEE2' : '#F9F9F7',
                      color: active ? '#0D5C3A' : '#888',
                    }}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </Field>
          {error && <p style={errorText}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Batal</button>
            <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}
