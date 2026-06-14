import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

type Tab = 'pengumuman' | 'testimoni';

const ALL_KELAS = ['1SD','2SD','3SD','4SD','5SD','6SD','7SMP','8SMP','9SMP','10SMA','11IPA','11IPS','12IPA','12IPS'];

type Announcement = { id: string; judul: string; isi: string; gambar_url: string | null; urutan: number; is_active: boolean; target_kelas: string[] | null };
type Testimonial = { id: string; nama: string; asal_sekolah: string | null; universitas: string | null; isi: string; gambar_url: string | null; urutan: number; is_active: boolean };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: 0, color: '#0D0D0D' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#888', lineHeight: 1 }}>&#x2715;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, color: '#555', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '7px', fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D', outline: 'none', background: '#fff' };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: '90px' };
const btnPrimary: React.CSSProperties = { padding: '9px 22px', background: '#0D5C3A', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem' };
const btnDanger: React.CSSProperties = { ...btnPrimary, background: '#DC0A1E' };
const btnSecondary: React.CSSProperties = { ...btnPrimary, background: '#F3F2EE', color: '#0D0D0D' };

/* ========================= PENGUMUMAN TAB ========================= */

function PengumumanTab() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({ judul: '', isi: '', gambar_url: '', is_active: true, target_kelas: null as string[] | null });
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('announcements').select('*').order('urutan');
    setItems((data ?? []) as Announcement[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function reorderItems(newItems: Announcement[]) {
    setItems(newItems);
    await Promise.all(newItems.map((item, idx) =>
      supabase.from('announcements').update({ urutan: idx }).eq('id', item.id)
    ));
  }

  function handleDragStart(idx: number) { dragIdx.current = idx; }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOver(idx); }
  function handleDragEnd() { dragIdx.current = null; setDragOver(null); }
  function handleDrop(idx: number) {
    const from = dragIdx.current;
    if (from === null || from === idx) { handleDragEnd(); return; }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    handleDragEnd();
    reorderItems(next);
  }

  function kelasCount(kelas: string, excludeId?: string): number {
    return items.filter(a =>
      a.is_active && a.id !== excludeId &&
      (a.target_kelas === null || a.target_kelas.includes(kelas))
    ).length;
  }

  function toggleKelas(k: string) {
    setForm(f => {
      const current = f.target_kelas ?? [];
      const next = current.includes(k) ? current.filter(x => x !== k) : [...current, k];
      return { ...f, target_kelas: next.length === 0 ? null : next };
    });
  }

  function openAdd() {
    setEditing(null);
    setForm({ judul: '', isi: '', gambar_url: '', is_active: true, target_kelas: null });
    setShowForm(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setForm({ judul: a.judul, isi: a.isi, gambar_url: a.gambar_url ?? '', is_active: a.is_active, target_kelas: a.target_kelas });
    setShowForm(true);
  }

  async function save() {
    if (!form.judul.trim() || !form.isi.trim()) return;
    setSaving(true);
    const payload = { judul: form.judul, isi: form.isi, gambar_url: form.gambar_url.trim() || null, is_active: form.is_active, target_kelas: form.target_kelas };
    if (editing) {
      await supabase.from('announcements').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('announcements').insert({ ...payload, urutan: items.length });
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function del(id: string) {
    if (!confirm('Hapus pengumuman ini?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    const next = items.filter(i => i.id !== id);
    await Promise.all(next.map((item, idx) =>
      supabase.from('announcements').update({ urutan: idx }).eq('id', item.id)
    ));
    load();
  }

  const activeCount = items.filter(i => i.is_active).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <p style={muted}>Maks 3 slot per kelas. Drag untuk ubah urutan.</p>
        <button onClick={openAdd} style={btnPrimary}>+ Tambah</button>
      </div>

      {loading ? <p style={muted}>Memuat...</p> : items.length === 0 ? (
        <div style={emptyCard}><p style={muted}>Belum ada pengumuman.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map((a, idx) => (
            <div
              key={a.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(idx)}
              style={{
                background: '#fff',
                border: dragOver === idx ? '2px solid #0D5C3A' : '1px solid #E2E1DC',
                borderRadius: '10px', padding: '12px 14px',
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                cursor: 'grab', opacity: dragIdx.current === idx ? 0.5 : 1,
                transition: 'border-color 0.15s',
              }}
            >
              {/* Position + drag handle */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0, paddingTop: '2px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 900, color: '#0D5C3A', lineHeight: 1 }}>{idx + 1}</span>
                <svg width="12" height="16" viewBox="0 0 12 16" fill="#ccc">
                  <circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/>
                  <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                  <circle cx="3" cy="13" r="1.5"/><circle cx="9" cy="13" r="1.5"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D' }}>{a.judul}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, background: a.is_active ? '#DCFCE7' : '#F3F2EE', color: a.is_active ? '#15803D' : '#888' }}>
                    {a.is_active ? 'AKTIF' : 'NONAKTIF'}
                  </span>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666', margin: 0, lineHeight: 1.5 }}>{a.isi}</p>
                {a.gambar_url && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#0D5C3A', margin: '4px 0 0' }}>Ada gambar</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                  {a.target_kelas === null ? (
                    <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, background: '#EFF6FF', color: '#1D4ED8' }}>Semua Kelas</span>
                  ) : a.target_kelas.map(k => (
                    <span key={k} style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, background: '#F3F2EE', color: '#555' }}>{k}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => openEdit(a)} style={{ ...btnSecondary, padding: '6px 12px', fontSize: '0.78rem' }}>Edit</button>
                <button onClick={() => del(a.id)} style={{ ...btnDanger, padding: '6px 12px', fontSize: '0.78rem' }}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Pengumuman' : 'Tambah Pengumuman'} onClose={() => setShowForm(false)}>
          <Field label="Judul">
            <input value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} style={inputStyle} placeholder="Judul pengumuman" />
          </Field>
          <Field label="Isi">
            <textarea value={form.isi} onChange={e => setForm(f => ({ ...f, isi: e.target.value }))} style={textareaStyle} placeholder="Isi pengumuman..." />
          </Field>
          <Field label="Gambar (opsional)">
            <input value={form.gambar_url} onChange={e => setForm(f => ({ ...f, gambar_url: e.target.value }))} style={inputStyle} placeholder="URL gambar atau link Google Drive" />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', margin: '4px 0 0' }}>
              Google Drive: buka file &rarr; Share &rarr; Anyone with link &rarr; copy link
            </p>
          </Field>
          <Field label="Status">
            <div style={{ display: 'flex', gap: '8px' }}>
              {[true, false].map(v => (
                <button key={String(v)} type="button" onClick={() => setForm(f => ({ ...f, is_active: v }))}
                  style={{ padding: '6px 16px', borderRadius: '20px', border: form.is_active === v ? (v ? '2px solid #86EFAC' : '2px solid #FCA5A5') : '2px solid #E2E1DC', cursor: 'pointer',
                    background: form.is_active === v ? (v ? '#DCFCE7' : '#FEE2E2') : '#F3F2EE',
                    color: form.is_active === v ? (v ? '#15803D' : '#DC0A1E') : '#999',
                    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.8rem' }}>
                  {v ? 'Aktif' : 'Nonaktif'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Target Kelas">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', border: form.target_kelas === null ? '1.5px solid #1D4ED8' : '1.5px solid #E2E1DC', background: form.target_kelas === null ? '#EFF6FF' : '#fafafa', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 700, color: form.target_kelas === null ? '#1D4ED8' : '#555' }}>
                <input type="checkbox" checked={form.target_kelas === null} onChange={() => setForm(f => ({ ...f, target_kelas: null }))} style={{ accentColor: '#1D4ED8' }} />
                Semua Kelas
              </label>
              {ALL_KELAS.map(k => {
                const count = kelasCount(k, editing?.id);
                const full = count >= 3;
                const checked = form.target_kelas?.includes(k) ?? false;
                const disabled = full && !checked;
                return (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', border: checked ? '1.5px solid #0D5C3A' : '1.5px solid #E2E1DC', background: checked ? '#DCFCE7' : '#fafafa', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: checked ? 700 : 400, color: checked ? '#15803D' : '#555' }}>
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleKelas(k)} style={{ accentColor: '#0D5C3A' }} />
                    {k} <span style={{ color: full && !checked ? '#DC0A1E' : '#999', fontSize: '0.72rem' }}>({count}/3)</span>
                  </label>
                );
              })}
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', margin: '5px 0 0' }}>
              Kelas dengan (3/3) tidak bisa dipilih lagi.
            </p>
          </Field>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
            <button onClick={() => setShowForm(false)} style={btnSecondary}>Batal</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ========================= TESTIMONI TAB ========================= */

function TestimoniTab() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState({ nama: '', asal_sekolah: '', universitas: '', isi: '', gambar_url: '', is_active: true });
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('testimonials').select('*').order('urutan');
    setItems((data ?? []) as Testimonial[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function reorderItems(newItems: Testimonial[]) {
    setItems(newItems);
    await Promise.all(newItems.map((item, idx) =>
      supabase.from('testimonials').update({ urutan: idx }).eq('id', item.id)
    ));
  }

  function handleDragStart(idx: number) { dragIdx.current = idx; }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOver(idx); }
  function handleDragEnd() { dragIdx.current = null; setDragOver(null); }
  function handleDrop(idx: number) {
    const from = dragIdx.current;
    if (from === null || from === idx) { handleDragEnd(); return; }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    handleDragEnd();
    reorderItems(next);
  }

  function openAdd() {
    setEditing(null);
    setForm({ nama: '', asal_sekolah: '', universitas: '', isi: '', gambar_url: '', is_active: true });
    setShowForm(true);
  }

  function openEdit(t: Testimonial) {
    setEditing(t);
    setForm({ nama: t.nama, asal_sekolah: t.asal_sekolah ?? '', universitas: t.universitas ?? '', isi: t.isi, gambar_url: t.gambar_url ?? '', is_active: t.is_active });
    setShowForm(true);
  }

  async function save() {
    if (!form.nama.trim() || !form.isi.trim()) return;
    setSaving(true);
    const payload = { nama: form.nama, asal_sekolah: form.asal_sekolah || null, universitas: form.universitas || null, isi: form.isi, gambar_url: form.gambar_url.trim() || null, is_active: form.is_active };
    if (editing) {
      await supabase.from('testimonials').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('testimonials').insert({ ...payload, urutan: items.length });
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function del(id: string) {
    if (!confirm('Hapus testimoni ini?')) return;
    await supabase.from('testimonials').delete().eq('id', id);
    const next = items.filter(i => i.id !== id);
    await Promise.all(next.map((item, idx) =>
      supabase.from('testimonials').update({ urutan: idx }).eq('id', item.id)
    ));
    load();
  }

  const activeCount = items.filter(i => i.is_active).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <p style={muted}>Tampil di halaman publik. Maks 10 aktif. Drag untuk ubah urutan.</p>
        <button onClick={openAdd} disabled={activeCount >= 10} style={btnPrimary}>+ Tambah</button>
      </div>

      {loading ? <p style={muted}>Memuat...</p> : items.length === 0 ? (
        <div style={emptyCard}><p style={muted}>Belum ada testimoni.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map((t, idx) => (
            <div
              key={t.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(idx)}
              style={{
                background: '#fff',
                border: dragOver === idx ? '2px solid #0D5C3A' : '1px solid #E2E1DC',
                borderRadius: '10px', padding: '12px 14px',
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                cursor: 'grab', opacity: dragIdx.current === idx ? 0.5 : 1,
                transition: 'border-color 0.15s',
              }}
            >
              {/* Position + drag handle */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0, paddingTop: '2px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 900, color: '#0D5C3A', lineHeight: 1 }}>{idx + 1}</span>
                <svg width="12" height="16" viewBox="0 0 12 16" fill="#ccc">
                  <circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/>
                  <circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>
                  <circle cx="3" cy="13" r="1.5"/><circle cx="9" cy="13" r="1.5"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D' }}>{t.nama}</span>
                  {(t.asal_sekolah || t.universitas) && (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888' }}>
                      {t.asal_sekolah}{t.asal_sekolah && t.universitas ? ' → ' : ''}{t.universitas && <span style={{ color: '#0D5C3A', fontWeight: 600 }}>{t.universitas}</span>}
                    </span>
                  )}
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, background: t.is_active ? '#DCFCE7' : '#F3F2EE', color: t.is_active ? '#15803D' : '#888' }}>
                    {t.is_active ? 'AKTIF' : 'NONAKTIF'}
                  </span>
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666', margin: 0, lineHeight: 1.5 }}>"{t.isi}"</p>
                {t.gambar_url && <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#0D5C3A', margin: '4px 0 0' }}>Ada foto</p>}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => openEdit(t)} style={{ ...btnSecondary, padding: '6px 12px', fontSize: '0.78rem' }}>Edit</button>
                <button onClick={() => del(t.id)} style={{ ...btnDanger, padding: '6px 12px', fontSize: '0.78rem' }}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Testimoni' : 'Tambah Testimoni'} onClose={() => setShowForm(false)}>
          <Field label="Nama Siswa">
            <input value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} style={inputStyle} placeholder="Nama lengkap" />
          </Field>
          <Field label="Asal Sekolah (opsional)">
            <input value={form.asal_sekolah} onChange={e => setForm(f => ({ ...f, asal_sekolah: e.target.value }))} style={inputStyle} placeholder="Contoh: SMAN 1 Denpasar" />
          </Field>
          <Field label="Diterima di (opsional)">
            <input value={form.universitas} onChange={e => setForm(f => ({ ...f, universitas: e.target.value }))} style={inputStyle} placeholder="Contoh: Univ. Udayana - Kedokteran" />
          </Field>
          <Field label="Isi Testimoni">
            <textarea value={form.isi} onChange={e => setForm(f => ({ ...f, isi: e.target.value }))} style={textareaStyle} placeholder="Kata-kata siswa tentang Abdi Smart..." />
          </Field>
          <Field label="Foto (opsional)">
            <input value={form.gambar_url} onChange={e => setForm(f => ({ ...f, gambar_url: e.target.value }))} style={inputStyle} placeholder="URL foto siswa" />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', margin: '4px 0 0' }}>
              Google Drive: buka file &rarr; Share &rarr; Anyone with link &rarr; copy link
            </p>
          </Field>
          <Field label="Status">
            <div style={{ display: 'flex', gap: '8px' }}>
              {[true, false].map(v => (
                <button key={String(v)} type="button" onClick={() => setForm(f => ({ ...f, is_active: v }))}
                  style={{ padding: '6px 16px', borderRadius: '20px', border: form.is_active === v ? (v ? '2px solid #86EFAC' : '2px solid #FCA5A5') : '2px solid #E2E1DC', cursor: 'pointer',
                    background: form.is_active === v ? (v ? '#DCFCE7' : '#FEE2E2') : '#F3F2EE',
                    color: form.is_active === v ? (v ? '#15803D' : '#DC0A1E') : '#999',
                    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.8rem' }}>
                  {v ? 'Aktif' : 'Nonaktif'}
                </button>
              ))}
            </div>
          </Field>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
            <button onClick={() => setShowForm(false)} style={btnSecondary}>Batal</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ========================= MAIN PAGE ========================= */

export default function AdminKonten() {
  const [tab, setTab] = useState<Tab>('pengumuman');

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 20px', color: '#0D0D0D' }}>Konten</h1>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid #E2E1DC' }}>
        {([['pengumuman', 'Pengumuman'], ['testimoni', 'Testimoni']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ padding: '8px 20px', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem', border: 'none', background: 'none', cursor: 'pointer', color: tab === t ? '#0D5C3A' : '#666', borderBottom: tab === t ? '2px solid #0D5C3A' : '2px solid transparent', marginBottom: '-2px' }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'pengumuman' ? <PengumumanTab /> : <TestimoniTab />}
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const emptyCard: React.CSSProperties = { background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
