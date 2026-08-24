import { useState, useEffect, FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { UploadModal } from '../staff/HasilTO';
import {
  Overlay, ModalHeader, Field, ToTabs,
  input, btnPrimary, btnSecondary, btnEdit, btnGhost, muted, errorText, confirmBox, confirmTitle,
  fmtDateTime, toLocalInputValue, fromLocalInputValue,
  SNBT_SUBJECTS, TKA_SUBJECTS,
} from './shared';
import type { ToPackage } from '../../types';

const KELAS_OPTIONS = ['6SD', '9SMP', '10', '11', '12IPA', '12IPS'];
type Merge = { s: { r: number; c: number }; e: { r: number; c: number } };

async function downloadPackage(pkg: ToPackage) {
  const { data } = await supabase
    .from('tryout_results')
    .select('student_id, scores, student:profiles!student_id(display_name)')
    .eq('type', pkg.type)
    .eq('kode_to', pkg.id);
  const rows = (data ?? []) as unknown as { student_id: string; scores: Record<string, unknown> | null; student: { display_name: string } | null }[];

  if (rows.length === 0) {
    alert('Belum ada hasil untuk paket ini.');
    return;
  }

  const subjects = pkg.type === 'SNBT' ? SNBT_SUBJECTS : TKA_SUBJECTS;
  const dateStr = pkg.tanggal_mulai.slice(0, 10);

  const headerRow0: any[] = ['Date', 'Tryout ID', 'Student ID', 'Nama'];
  const headerRow1: any[] = ['', '', '', ''];
  const merges: Merge[] = [];
  subjects.forEach((s, i) => {
    const startCol = 4 + i * 4;
    headerRow0.push(s.code, '', '', '');
    headerRow1.push('B', 'S', 'K', pkg.type === 'SNBT' ? 'SKOR' : 'N');
    merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + 3 } });
  });

  const dataRows = rows.map(r => {
    const sc = r.scores ?? {};
    const row: any[] = [dateStr, pkg.id, r.student_id, r.student?.display_name ?? '-'];
    subjects.forEach(s => {
      const key = s.code.toLowerCase();
      const b = sc[`${key}_b`], sVal = sc[`${key}_s`], k = sc[`${key}_k`], skor = sc[key];
      row.push(
        b !== undefined && b !== null ? b : '-',
        sVal !== undefined && sVal !== null ? sVal : '-',
        k !== undefined && k !== null ? k : '-',
        skor !== undefined && skor !== null && skor !== '' ? skor : '-',
      );
    });
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([headerRow0, headerRow1, ...dataRows]);
  ws['!merges'] = merges;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hasil TO');
  XLSX.writeFile(wb, `HasilTO_${pkg.nama.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
}

export default function ToPaketList() {
  const location = useLocation();
  const base = location.pathname.startsWith('/staff') ? '/staff/to' : '/admin/to';
  const [tab, setTab] = useState<'soal' | 'sertifikat'>('soal');
  const [packages, setPackages] = useState<ToPackage[]>([]);
  const [examCounts, setExamCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SNBT' | 'TKA'>('ALL');

  const [showUpload, setShowUpload] = useState(false);
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

  const filteredPackages = packages.filter(p => typeFilter === 'ALL' || p.type === typeFilter);

  const typeFilterPills = (
    <div style={{ display: 'flex', gap: '6px' }}>
      {(['ALL', 'SNBT', 'TKA'] as const).map(t => (
        <button
          key={t}
          onClick={() => setTypeFilter(t)}
          style={{
            padding: '7px 14px', borderRadius: '20px', cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.8rem',
            border: typeFilter === t ? '2px solid #0D5C3A' : '2px solid #E2E1DC',
            background: typeFilter === t ? '#D6EEE2' : '#F9F9F7',
            color: typeFilter === t ? '#0D5C3A' : '#888',
          }}
        >
          {t === 'ALL' ? 'Semua' : t}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 16px', color: '#0D0D0D' }}>Try Out</h1>

      <ToTabs
        tabs={[{ key: 'soal', label: 'Soal' }, { key: 'sertifikat', label: 'Sertifikat' }]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'soal' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            {typeFilterPills}
            <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Buat Paket TO</button>
          </div>

          {loading ? (
            <p style={muted}>Memuat...</p>
          ) : filteredPackages.length === 0 ? (
            <p style={muted}>Belum ada paket try out.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredPackages.map(pkg => (
                <div key={pkg.id} style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: '#0D0D0D' }}>{pkg.nama}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: pkg.type === 'TKA' ? '#EDE9FE' : '#DBEAFE', color: pkg.type === 'TKA' ? '#5B21B6' : '#1D4ED8' }}>
                        {pkg.type}
                      </span>
                    </div>
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
        </>
      )}

      {tab === 'sertifikat' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
            {typeFilterPills}
            <button onClick={() => setShowUpload(true)} style={btnPrimary}>+ Upload Skor SNBT</button>
          </div>
          <p style={{ ...muted, margin: '0 0 16px' }}>Pilih paket untuk melihat hasil per mata pelajaran.</p>

          {loading ? (
            <p style={muted}>Memuat...</p>
          ) : filteredPackages.length === 0 ? (
            <p style={muted}>Belum ada paket try out.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredPackages.map(pkg => (
                <div key={pkg.id} style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: '#0D0D0D' }}>{pkg.nama}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: pkg.type === 'TKA' ? '#EDE9FE' : '#DBEAFE', color: pkg.type === 'TKA' ? '#5B21B6' : '#1D4ED8' }}>
                        {pkg.type}
                      </span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', marginTop: '3px' }}>
                      {fmtDateTime(pkg.tanggal_mulai)} &mdash; {fmtDateTime(pkg.tanggal_selesai)}
                      {' · '}{examCounts[pkg.id] ?? 0} mata pelajaran
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => downloadPackage(pkg)} style={btnGhost}>Download</button>
                    <Link to={`${base}/paket/${pkg.id}`} style={{ ...btnGhost, textDecoration: 'none', display: 'inline-block', color: '#0D5C3A' }}>Lihat Hasil</Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showUpload && (
            <UploadModal onClose={() => setShowUpload(false)} onSaved={() => setShowUpload(false)} />
          )}
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
    type: pkg?.type ?? 'SNBT' as 'SNBT' | 'TKA',
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
      type: form.type,
      tanggal_mulai: fromLocalInputValue(form.tanggal_mulai),
      tanggal_selesai: fromLocalInputValue(form.tanggal_selesai),
      target_kelas: form.target_kelas.size > 0 ? Array.from(form.target_kelas) : null,
    };
    const { error: err } = pkg
      ? await supabase.from('to_packages').update(payload).eq('id', pkg.id)
      : await supabase.from('to_packages').insert({ ...payload, created_by: profile?.id });

    // Every exam in the package follows the package's window -- if
    // either date actually changed on this save, push it onto every
    // child exam unconditionally (not just clamping ones that would
    // otherwise fall out of range). Students already mid-attempt are
    // unaffected either way: their deadline_at is snapshotted once in
    // start_to_attempt and never re-derived from to_exams afterward.
    if (!err && pkg) {
      const oldStart = new Date(pkg.tanggal_mulai).getTime();
      const oldEnd = new Date(pkg.tanggal_selesai).getTime();
      const newStart = new Date(payload.tanggal_mulai).getTime();
      const newEnd = new Date(payload.tanggal_selesai).getTime();
      if (newStart !== oldStart || newEnd !== oldEnd) {
        await supabase.from('to_exams').update({
          tanggal_mulai: payload.tanggal_mulai,
          tanggal_selesai: payload.tanggal_selesai,
        }).eq('package_id', pkg.id);
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
          <Field label="Jenis TO">
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['SNBT', 'TKA'] as const).map(t => {
                const active = form.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    style={{
                      flex: 1, padding: '9px', borderRadius: '8px', cursor: 'pointer',
                      fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.85rem',
                      border: active ? '2px solid #0D5C3A' : '2px solid #E2E1DC',
                      background: active ? '#D6EEE2' : '#F9F9F7',
                      color: active ? '#0D5C3A' : '#888',
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
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
