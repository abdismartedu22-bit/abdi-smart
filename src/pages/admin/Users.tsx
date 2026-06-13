import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PasswordInput from '../../components/shared/PasswordInput';
import type { Role, Group } from '../../types';

const TINGKAT_KELAS_OPTIONS = ['1SD','2SD','3SD','4SD','5SD','6SD','7SMP','8SMP','9SMP','10SMA','11IPA','11IPS','12IPA','12IPS'];

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  is_active: boolean;
  nama: string | null;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  sekolah: string | null;
  jurusan: string | null;
  tingkat_kelas: string | null;
  groups?: { group_id: string; groups: { id: string; nama: string; kode: string } }[];
};

type Tab = 'users' | 'groups';

const PAGE_SIZE = 10;
const ROLES: Role[] = ['admin', 'staff', 'teacher', 'student'];
const roleLabel: Record<Role, string> = { admin: 'Admin', staff: 'Staff', teacher: 'Pengajar', student: 'Siswa' };
const roleBg: Record<Role, string> = { admin: '#DC0A1E', staff: '#1E4D8C', teacher: '#047857', student: '#4B5563' };

const WARNA_PRESETS = [
  { warna: '#EF4444', warna_text: '#fff', label: 'Merah' },
  { warna: '#3B82F6', warna_text: '#fff', label: 'Biru' },
  { warna: '#22C55E', warna_text: '#fff', label: 'Hijau' },
  { warna: '#EAB308', warna_text: '#000', label: 'Kuning' },
  { warna: '#8B5CF6', warna_text: '#fff', label: 'Ungu' },
  { warna: '#F97316', warna_text: '#fff', label: 'Oranye' },
  { warna: '#EC4899', warna_text: '#fff', label: 'Pink' },
  { warna: '#14B8A6', warna_text: '#fff', label: 'Teal' },
];

export default function AdminUsers() {
  const [tab, setTab] = useState<Tab>('users');

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 20px', color: '#0D0D0D' }}>
        Kelola User
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid #E2E1DC' }}>
        {(['users', 'groups'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: tab === t ? '#0D5C3A' : '#666',
              borderBottom: tab === t ? '2px solid #0D5C3A' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            {t === 'users' ? 'Siswa' : 'Grup'}
          </button>
        ))}
      </div>

      {tab === 'users' ? <UsersTab /> : <GroupsTab />}
    </div>
  );
}

/* ===================== USERS TAB ===================== */

function UsersTab() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: u }, { data: g }] = await Promise.all([
      supabase.from('profiles')
        .select('*, student_groups(group_id, groups(id, nama, kode))')
        .order('role').order('display_name'),
      supabase.from('groups').select('*').order('nama'),
    ]);
    setUsers((u ?? []) as UserRow[]);
    setGroups(g ?? []);
    setLoading(false);
  }

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (activeFilter === 'active' && u.is_active === false) return false;
    if (activeFilter === 'inactive' && u.is_active !== false) return false;
    if (search && !u.username.toLowerCase().includes(search.toLowerCase()) && !u.display_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filter changes
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleRole = (v: Role | 'all') => { setRoleFilter(v); setPage(1); };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Cari username / nama..."
            style={inputStyle}
          />
          <select value={roleFilter} onChange={e => handleRole(e.target.value as Role | 'all')} style={selectStyle}>
            <option value="all">Semua role</option>
            {ROLES.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
          </select>
          <select value={activeFilter} onChange={e => { setActiveFilter(e.target.value as 'all' | 'active' | 'inactive'); setPage(1); }} style={selectStyle}>
            <option value="all">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Non-aktif</option>
          </select>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Tambah User</button>
      </div>

      {loading ? (
        <p style={mutedStyle}>Memuat...</p>
      ) : filtered.length === 0 ? (
        <p style={mutedStyle}>Tidak ada user.</p>
      ) : (
        <>
          <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
            {paginated.map((u, i) => {
              const isActive = u.is_active !== false;
              return (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                  borderBottom: i < paginated.length - 1 ? '1px solid #E2E1DC' : 'none',
                  flexWrap: 'wrap',
                }}>
                  <span title={isActive ? 'Aktif' : 'Non-aktif'} style={{
                    width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0,
                    background: isActive ? '#22C55E' : '#EAB308',
                    display: 'inline-block',
                  }} />
                  <span style={{ ...roleBadgeStyle, background: roleBg[u.role] }}>{roleLabel[u.role]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', color: '#0D0D0D' }}>
                      {u.display_name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666' }}>
                      @{u.username}
                      {u.role === 'student' && u.tingkat_kelas && (
                        <span> &middot; {u.tingkat_kelas}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => { setEditTarget(u); setShowEdit(true); }} style={btnEdit}>Edit</button>
                    {u.id !== me?.id && (
                      <button onClick={() => setDeleteTarget(u)} style={{ ...btnGhost, color: '#DC0A1E', borderColor: '#FECACA' }}>Hapus</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <PaginationBar page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} />
        </>
      )}

      {showCreate && (
        <CreateUserModal
          groups={groups}
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); load(); }}
        />
      )}
      {showEdit && editTarget && (
        <EditUserModal
          user={editTarget}
          groups={groups}
          isSelf={editTarget.id === me?.id}
          onClose={() => setShowEdit(false)}
          onDone={() => { setShowEdit(false); load(); }}
        />
      )}
      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDone={() => { setDeleteTarget(null); load(); }}
        />
      )}
    </>
  );
}

/* ===================== CREATE USER MODAL ===================== */

function CreateUserModal({ groups, onClose, onDone }: { groups: Group[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    display_name: '', nama: '', username: '', email: '', password: '',
    role: 'student' as Role,
    group_id: '',
    tempat_lahir: '', tanggal_lahir: '', sekolah: '', jurusan: '', tingkat_kelas: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.display_name || !form.username || !form.password) {
      setError('Nama, username, dan password wajib diisi');
      return;
    }
    if (form.role === 'student') {
      if (!form.group_id) { setError('Pilih grup untuk siswa'); return; }
      if (!form.nama) { setError('Nama lengkap wajib diisi untuk siswa'); return; }
      if (!form.tempat_lahir) { setError('Tempat lahir wajib diisi untuk siswa'); return; }
      if (!form.tanggal_lahir) { setError('Tanggal lahir wajib diisi untuk siswa'); return; }
      if (!form.sekolah) { setError('Sekolah wajib diisi untuk siswa'); return; }
      if (!form.jurusan) { setError('Jurusan wajib diisi untuk siswa'); return; }
      if (!form.tingkat_kelas) { setError('Tingkat kelas wajib diisi untuk siswa'); return; }
    }
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: form.email || `${form.username}@abdi-smart.internal`,
        password: form.password,
        username: form.username,
        display_name: form.display_name,
        role: form.role,
        group_ids: form.role === 'student' && form.group_id ? [form.group_id] : [],
      }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'Gagal membuat user'); setSubmitting(false); return; }

    // For students, update extra profile fields
    if (form.role === 'student' && json.user?.id) {
      const extras: Record<string, string | null> = {};
      if (form.nama) extras.nama = form.nama;
      if (form.tempat_lahir) extras.tempat_lahir = form.tempat_lahir;
      if (form.tanggal_lahir) extras.tanggal_lahir = form.tanggal_lahir;
      if (form.sekolah) extras.sekolah = form.sekolah;
      if (form.jurusan) extras.jurusan = form.jurusan;
      if (form.tingkat_kelas) extras.tingkat_kelas = form.tingkat_kelas;
      if (Object.keys(extras).length > 0) {
        await supabase.from('profiles').update(extras).eq('id', json.user.id);
      }
    }

    setSubmitting(false);
    onDone();
  }

  return (
    <Overlay>
      <Modal title="Tambah User Baru" onClose={onClose}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FieldRow label="Nama Panggilan (display name)">
            <input style={inputStyle} value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} required placeholder="cth. Budi" />
          </FieldRow>
          <FieldRow label="Username">
            <input style={inputStyle} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '_') }))} required />
          </FieldRow>
          <FieldRow label="Email (opsional, untuk reset password)">
            <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@domain.com" />
          </FieldRow>
          <FieldRow label="Password">
            <PasswordInput value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} required minLength={6} style={inputStyle} />
          </FieldRow>
          <FieldRow label="Role">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {ROLES.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                  <input type="radio" name="role" value={r} checked={form.role === r} onChange={() => setForm(f => ({ ...f, role: r, group_id: '' }))} />
                  {roleLabel[r]}
                </label>
              ))}
            </div>
          </FieldRow>
          {form.role === 'student' && (
            <>
              <FieldRow label="Grup">
                {groups.length === 0 ? (
                  <p style={{ ...errorStyle, color: '#A16207' }}>Belum ada grup. Buat grup terlebih dahulu di tab Grup.</p>
                ) : (
                  <GroupSelect groups={groups} value={form.group_id} onChange={id => setForm(f => ({ ...f, group_id: id }))} />
                )}
              </FieldRow>
              <FieldRow label="Nama Lengkap (sesuai NIS/NIK) *">
                <input style={inputStyle} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="cth. Budi Santoso" required />
              </FieldRow>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <FieldRow label="Tempat Lahir *">
                  <input style={inputStyle} value={form.tempat_lahir} onChange={e => setForm(f => ({ ...f, tempat_lahir: e.target.value }))} placeholder="cth. Denpasar" required />
                </FieldRow>
                <FieldRow label="Tanggal Lahir *">
                  <input style={inputStyle} type="date" value={form.tanggal_lahir} onChange={e => setForm(f => ({ ...f, tanggal_lahir: e.target.value }))} required />
                </FieldRow>
              </div>
              <FieldRow label="Sekolah *">
                <input style={inputStyle} value={form.sekolah} onChange={e => setForm(f => ({ ...f, sekolah: e.target.value }))} placeholder="cth. SMAN 1 Denpasar" required />
              </FieldRow>
              <FieldRow label="Jurusan *">
                <input style={inputStyle} value={form.jurusan} onChange={e => setForm(f => ({ ...f, jurusan: e.target.value }))} placeholder="cth. IPA / IPS" required />
              </FieldRow>
              <FieldRow label="Tingkat Kelas *">
                <select style={inputStyle} value={form.tingkat_kelas} onChange={e => setForm(f => ({ ...f, tingkat_kelas: e.target.value }))} required>
                  <option value="">-- Pilih tingkat kelas --</option>
                  {TINGKAT_KELAS_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </FieldRow>
            </>
          )}
          {error && <p style={errorStyle}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Batal</button>
            <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? 'Membuat...' : 'Buat User'}</button>
          </div>
        </form>
      </Modal>
    </Overlay>
  );
}

/* ===================== EDIT USER MODAL ===================== */

function EditUserModal({ user, groups, isSelf, onClose, onDone }: { user: UserRow; groups: Group[]; isSelf: boolean; onClose: () => void; onDone: () => void }) {
  const currentGroupId = (user.groups ?? [])[0]?.group_id ?? '';
  const [form, setForm] = useState({
    display_name: user.display_name,
    role: user.role,
    is_active: user.is_active !== false,
    group_id: currentGroupId,
    nama: user.nama ?? '',
    tempat_lahir: user.tempat_lahir ?? '',
    tanggal_lahir: user.tanggal_lahir ?? '',
    sekolah: user.sekolah ?? '',
    jurusan: user.jurusan ?? '',
    tingkat_kelas: user.tingkat_kelas ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset PW section
  const [showResetPw, setShowResetPw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetDone, setResetDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (form.role === 'student') {
      if (!form.nama) { setError('Nama lengkap wajib diisi'); return; }
      if (!form.tempat_lahir) { setError('Tempat lahir wajib diisi'); return; }
      if (!form.tanggal_lahir) { setError('Tanggal lahir wajib diisi'); return; }
      if (!form.sekolah) { setError('Sekolah wajib diisi'); return; }
      if (!form.jurusan) { setError('Jurusan wajib diisi'); return; }
      if (!form.tingkat_kelas) { setError('Tingkat kelas wajib diisi'); return; }
    }
    setSubmitting(true);

    const update: Record<string, unknown> = { display_name: form.display_name, role: form.role, is_active: form.is_active };
    if (form.role === 'student') {
      update.nama = form.nama || null;
      update.tempat_lahir = form.tempat_lahir || null;
      update.tanggal_lahir = form.tanggal_lahir || null;
      update.sekolah = form.sekolah || null;
      update.jurusan = form.jurusan || null;
      update.tingkat_kelas = form.tingkat_kelas || null;
    }

    const { error: profileErr } = await supabase.from('profiles').update(update).eq('id', user.id);
    if (profileErr) { setError(profileErr.message); setSubmitting(false); return; }

    if (form.role === 'student') {
      await supabase.from('student_groups').delete().eq('student_id', user.id);
      if (form.group_id) {
        await supabase.from('student_groups').insert({ student_id: user.id, group_id: form.group_id });
      }
    }

    setSubmitting(false);
    onDone();
  }

  async function handleResetPw(e: FormEvent) {
    e.preventDefault();
    setResetError('');
    if (newPw.length < 6) { setResetError('Minimal 6 karakter'); return; }
    setResetting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ user_id: user.id, new_password: newPw }),
    });
    const json = await res.json();
    setResetting(false);
    if (!res.ok) { setResetError(json.error ?? 'Gagal reset password'); return; }
    setResetDone(true);
    setNewPw('');
    setTimeout(() => { setResetDone(false); setShowResetPw(false); }, 2000);
  }

  return (
    <Overlay>
      <Modal title={`Edit: ${user.username}`} onClose={onClose}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FieldRow label="Nama Panggilan (display name)">
            <input style={inputStyle} value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} required />
          </FieldRow>
          <FieldRow label="Role">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {ROLES.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                  <input type="radio" name="role_edit" value={r} checked={form.role === r} onChange={() => setForm(f => ({ ...f, role: r, group_id: '' }))} />
                  {roleLabel[r]}
                </label>
              ))}
            </div>
          </FieldRow>
          {!isSelf && (
            <FieldRow label="Status">
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: true }))}
                  style={{
                    padding: '7px 20px', borderRadius: '20px', border: form.is_active ? '2px solid #86EFAC' : '2px solid #E2E1DC', cursor: 'pointer',
                    background: form.is_active ? '#DCFCE7' : '#F3F2EE', color: form.is_active ? '#15803D' : '#999',
                    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.82rem', transition: 'all 0.15s',
                  }}
                >
                  AKTIF
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: false }))}
                  style={{
                    padding: '7px 20px', borderRadius: '20px', border: !form.is_active ? '2px solid #FCA5A5' : '2px solid #E2E1DC', cursor: 'pointer',
                    background: !form.is_active ? '#FEE2E2' : '#F3F2EE', color: !form.is_active ? '#DC0A1E' : '#999',
                    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.82rem', transition: 'all 0.15s',
                  }}
                >
                  NON-AKTIF
                </button>
              </div>
            </FieldRow>
          )}
          {form.role === 'student' && (
            <>
              <FieldRow label="Grup">
                {groups.length === 0 ? (
                  <p style={{ ...errorStyle, color: '#A16207' }}>Belum ada grup aktif.</p>
                ) : (
                  <GroupSelect groups={groups} value={form.group_id} onChange={id => setForm(f => ({ ...f, group_id: id }))} />
                )}
              </FieldRow>
              <FieldRow label="Nama Lengkap (sesuai NIS/NIK) *">
                <input style={inputStyle} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="cth. Budi Santoso" required />
              </FieldRow>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <FieldRow label="Tempat Lahir *">
                  <input style={inputStyle} value={form.tempat_lahir} onChange={e => setForm(f => ({ ...f, tempat_lahir: e.target.value }))} placeholder="cth. Denpasar" required />
                </FieldRow>
                <FieldRow label="Tanggal Lahir *">
                  <input style={inputStyle} type="date" value={form.tanggal_lahir} onChange={e => setForm(f => ({ ...f, tanggal_lahir: e.target.value }))} required />
                </FieldRow>
              </div>
              <FieldRow label="Sekolah *">
                <input style={inputStyle} value={form.sekolah} onChange={e => setForm(f => ({ ...f, sekolah: e.target.value }))} placeholder="cth. SMAN 1 Denpasar" required />
              </FieldRow>
              <FieldRow label="Jurusan *">
                <input style={inputStyle} value={form.jurusan} onChange={e => setForm(f => ({ ...f, jurusan: e.target.value }))} placeholder="cth. IPA / IPS" required />
              </FieldRow>
              <FieldRow label="Tingkat Kelas *">
                <select style={inputStyle} value={form.tingkat_kelas} onChange={e => setForm(f => ({ ...f, tingkat_kelas: e.target.value }))} required>
                  <option value="">-- Pilih tingkat kelas --</option>
                  {TINGKAT_KELAS_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </FieldRow>
            </>
          )}
          {error && <p style={errorStyle}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Batal</button>
            <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>

        {/* Reset Password section */}
        <div style={{ marginTop: '20px', borderTop: '1px solid #E2E1DC', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={() => { setShowResetPw(v => !v); setResetError(''); setResetDone(false); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#0D5C3A', fontWeight: 600, padding: 0 }}
          >
            {showResetPw ? '▲ Tutup Reset Password' : '▼ Reset Password'}
          </button>
          {showResetPw && (
            <form onSubmit={handleResetPw} style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {resetDone ? (
                <p style={{ fontFamily: 'var(--font-body)', color: '#047857', fontSize: '0.85rem', margin: 0 }}>Password berhasil direset!</p>
              ) : (
                <>
                  <PasswordInput value={newPw} onChange={setNewPw} required minLength={6} style={inputStyle} />
                  {resetError && <p style={errorStyle}>{resetError}</p>}
                  <button type="submit" disabled={resetting} style={{ ...btnPrimary, flex: 'none' }}>
                    {resetting ? 'Mereset...' : 'Reset Password'}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </Modal>
    </Overlay>
  );
}

/* ===================== RESET PASSWORD MODAL ===================== */

function ResetPwModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [newPw, setNewPw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPw.length < 6) { setError('Minimal 6 karakter'); return; }
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ user_id: user.id, new_password: newPw }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(json.error ?? 'Gagal reset password'); return; }
    setDone(true);
    setTimeout(onClose, 1500);
  }

  return (
    <Overlay>
      <Modal title={`Reset Password: ${user.display_name}`} onClose={onClose}>
        {done ? (
          <p style={{ fontFamily: 'var(--font-body)', color: '#047857' }}>Password berhasil direset!</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FieldRow label="Password Baru">
              <PasswordInput value={newPw} onChange={setNewPw} required minLength={6} style={inputStyle} />
            </FieldRow>
            {error && <p style={errorStyle}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button type="button" onClick={onClose} style={btnSecondary}>Batal</button>
              <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? 'Mereset...' : 'Reset Password'}</button>
            </div>
          </form>
        )}
      </Modal>
    </Overlay>
  );
}

/* ===================== DELETE USER MODAL ===================== */

function DeleteUserModal({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDeactivate() {
    setDeleting(true);
    setError('');
    const { error: err } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', user.id);
    setDeleting(false);
    if (err) { setError(err.message); return; }
    onDone();
  }

  return (
    <Overlay>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: '0 0 10px', color: '#0D0D0D' }}>Nonaktifkan User?</h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 6px' }}>
          Akun <strong>{user.display_name}</strong> (@{user.username}) akan dinonaktifkan.
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#A16207', margin: '0 0 20px' }}>
          User tidak akan bisa login, namun data absensi dan riwayat tetap tersimpan. Akun bisa diaktifkan kembali melalui Edit User.
        </p>
        {error && <p style={{ ...errorStyle, marginBottom: '12px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={btnSecondary}>Batal</button>
          <button onClick={handleDeactivate} disabled={deleting} style={{ ...btnPrimary, background: '#DC0A1E' }}>
            {deleting ? 'Menonaktifkan...' : 'Nonaktifkan'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ===================== GROUPS TAB ===================== */

type GroupMember = { id: string; display_name: string; nama: string | null };

function GroupsTab() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Record<string, GroupMember[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Group | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterSekolah, setFilterSekolah] = useState('');
  const [filterTipe, setFilterTipe] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('groups').select('*').order('nama');
    setGroups(data ?? []);

    // Load all members per group
    const { data: sg } = await supabase
      .from('student_groups')
      .select('group_id, profiles!student_id(id, display_name, nama)')
      .order('group_id');

    const map: Record<string, GroupMember[]> = {};
    (sg ?? []).forEach((r: any) => {
      const gid = r.group_id;
      if (!map[gid]) map[gid] = [];
      if (r.profiles) map[gid].push(r.profiles as GroupMember);
    });
    setMembers(map);
    setLoading(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    const { error } = await supabase.from('groups').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { setDeleteError(error.message); return; }
    setDeleteTarget(null);
    load();
  }

  const sekolahOptions = Array.from(new Set(groups.map(g => g.sekolah).filter((s): s is string => !!s))).sort();

  const filtered = groups.filter(g => {
    if (search && !g.nama.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSekolah && g.sekolah !== filterSekolah) return false;
    if (filterTipe && g.tipe !== filterTipe) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari nama grup..."
            style={inputStyle}
          />
          <select value={filterSekolah} onChange={e => { setFilterSekolah(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="">Semua sekolah</option>
            {sekolahOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterTipe} onChange={e => { setFilterTipe(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="">Semua tipe</option>
            <option value="reguler">Reguler</option>
            <option value="privat">Privat</option>
          </select>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Tambah Grup</button>
      </div>

      {loading ? (
        <p style={mutedStyle}>Memuat...</p>
      ) : filtered.length === 0 ? (
        <p style={mutedStyle}>{groups.length === 0 ? 'Belum ada grup.' : 'Tidak ada grup yang cocok.'}</p>
      ) : (
        <>
          <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
            {paginated.map((g, i) => {
              const groupMembers = members[g.id] ?? [];
              const isExpanded = expanded[g.id] ?? false;
              return (
                <div key={g.id} style={{ borderBottom: i < paginated.length - 1 ? '1px solid #E2E1DC' : 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: g.warna, flexShrink: 0, display: 'inline-block' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', color: '#0D0D0D' }}>{g.nama}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666' }}>
                        {g.tipe}
                        {g.sekolah && <span> &middot; {g.sekolah}</span>}
                        <span> &middot; {groupMembers.length} siswa</span>
                      </div>
                    </div>
                    {g.paket != null && g.paket > 0 && (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#0D5C3A', flexShrink: 0 }}>
                        Paket {g.paket} sesi
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                      {groupMembers.length > 0 && (
                        <button
                          onClick={() => setExpanded(ex => ({ ...ex, [g.id]: !ex[g.id] }))}
                          style={{ ...btnGhost, fontSize: '0.75rem' }}
                        >
                          {isExpanded ? 'Tutup' : 'Anggota'}
                        </button>
                      )}
                      {g.wa_group_link && (
                        <a
                          href={g.wa_group_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Buka WA Grup"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: '#25D366', color: '#fff', borderRadius: '6px', flexShrink: 0, textDecoration: 'none' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </a>
                      )}
                      <button onClick={() => setEditTarget(g)} style={btnEdit}>Edit</button>
                      <button onClick={() => { setDeleteTarget(g); setDeleteError(''); }} style={{ ...btnGhost, color: '#DC0A1E' }}>Hapus</button>
                    </div>
                  </div>
                  {isExpanded && groupMembers.length > 0 && (
                    <div style={{ padding: '0 16px 12px 16px', background: '#F9F9F7' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {groupMembers.map((m, mi) => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', padding: '5px 8px', background: '#fff', borderRadius: '6px' }}>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#aaa', minWidth: '18px' }}>{mi + 1}.</span>
                            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.82rem', color: '#0D0D0D' }}>{m.display_name}</span>
                            {m.nama && <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666' }}>{m.nama}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <PaginationBar page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} />
        </>
      )}

      {showCreate && (
        <GroupFormModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); load(); }} />
      )}
      {editTarget && (
        <GroupFormModal group={editTarget} onClose={() => setEditTarget(null)} onDone={() => { setEditTarget(null); load(); }} />
      )}

      {deleteTarget && (
        <Overlay>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: '0 0 10px', color: '#0D0D0D' }}>Hapus Grup?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#666', margin: '0 0 20px' }}>
              Grup <strong>{deleteTarget.nama}</strong> akan dihapus permanen beserta semua data jadwal dan absensi yang terkait.
            </p>
            {deleteError && <p style={{ ...errorStyle, marginBottom: '12px' }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteTarget(null)} style={btnSecondary}>Batal</button>
              <button onClick={confirmDelete} disabled={deleting} style={{ ...btnPrimary, background: '#DC0A1E' }}>
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
}

/* ===================== GROUP FORM MODAL ===================== */

function GroupFormModal({ group, onClose, onDone }: { group?: Group; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    nama: group?.nama ?? '',
    kode: group?.kode ?? '',
    tipe: group?.tipe ?? 'reguler',
    warna: group?.warna ?? WARNA_PRESETS[0].warna,
    warna_text: group?.warna_text ?? WARNA_PRESETS[0].warna_text,
    paket: group?.paket?.toString() ?? '',
    sekolah: group?.sekolah ?? '',
    wa_group_link: group?.wa_group_link ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.nama) { setError('Nama grup wajib diisi'); return; }
    if (!form.paket) { setError('Jumlah tatap muka (paket) wajib diisi'); return; }
    setSubmitting(true);
    const derivedKode = group?.kode ?? (form.nama.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'GRUP');
    const payload = {
      nama: form.nama,
      kode: derivedKode,
      tipe: form.tipe,
      warna: form.warna,
      warna_text: form.warna_text,
      paket: form.paket ? parseInt(form.paket) : null,
      sekolah: form.sekolah || null,
      wa_group_link: form.wa_group_link || null,
    };
    const { error: err } = group
      ? await supabase.from('groups').update(payload).eq('id', group.id)
      : await supabase.from('groups').insert({ ...payload, active: true });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    onDone();
  }

  function selectPreset(preset: typeof WARNA_PRESETS[0]) {
    setForm(f => ({ ...f, warna: preset.warna, warna_text: preset.warna_text }));
  }

  return (
    <Overlay>
      <Modal title={group ? `Edit Grup: ${group.nama}` : 'Tambah Grup'} onClose={onClose}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FieldRow label="Nama Grup">
            <input style={inputStyle} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} required placeholder="cth. 12IPA26001" />
          </FieldRow>
          <FieldRow label="Sekolah Asal (opsional)">
            <input style={inputStyle} value={form.sekolah} onChange={e => setForm(f => ({ ...f, sekolah: e.target.value }))} placeholder="cth. SMAN 1 Denpasar" />
          </FieldRow>
          <FieldRow label="Paket (jumlah tatap muka) *">
            <input style={inputStyle} type="number" min="1" value={form.paket} onChange={e => setForm(f => ({ ...f, paket: e.target.value }))} placeholder="cth. 80" required />
          </FieldRow>
          <FieldRow label="Link Grup WhatsApp (opsional)">
            <input style={inputStyle} type="url" value={form.wa_group_link} onChange={e => setForm(f => ({ ...f, wa_group_link: e.target.value }))} placeholder="https://chat.whatsapp.com/..." />
          </FieldRow>
          <FieldRow label="Tipe">
            <div style={{ display: 'flex', gap: '16px' }}>
              {(['reguler', 'privat', 'online'] as const).map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                  <input type="radio" name="tipe" value={t} checked={form.tipe === t} onChange={() => setForm(f => ({ ...f, tipe: t }))} />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </label>
              ))}
            </div>
            {form.tipe === 'online' && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#0369A1', margin: '4px 0 0', background: '#E0F2FE', padding: '6px 10px', borderRadius: '6px' }}>
                Jadwal grup Online akan otomatis terlihat oleh semua siswa 12IPA dan 12IPS.
              </p>
            )}
          </FieldRow>
          <FieldRow label="Warna">
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {WARNA_PRESETS.map(p => (
                <button
                  key={p.warna}
                  type="button"
                  onClick={() => selectPreset(p)}
                  title={p.label}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: p.warna,
                    border: form.warna === p.warna ? '3px solid #0D0D0D' : '2px solid #E2E1DC',
                    cursor: 'pointer',
                  }}
                />
              ))}
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666' }}>Preview:</span>
              <span style={{
                padding: '2px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                fontFamily: 'var(--font-body)', background: form.warna, color: form.warna_text,
              }}>
                {form.nama || 'NAMA'}
              </span>
            </div>
          </FieldRow>
          {error && <p style={errorStyle}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Batal</button>
            <button type="submit" disabled={submitting} style={btnPrimary}>{submitting ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>
    </Overlay>
  );
}

function PaginationBar({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666' }}>
        {total} total &middot; Halaman {page} dari {totalPages}
      </span>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          style={{ ...btnGhost, opacity: page === 1 ? 0.4 : 1 }}
        >
          &larr; Prev
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          style={{ ...btnGhost, opacity: page === totalPages ? 0.4 : 1 }}
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

/* ===================== SEARCHABLE GROUP SELECT ===================== */

function GroupSelect({ groups, value, onChange }: { groups: Group[]; value: string; onChange: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const selected = groups.find(g => g.id === value);
  const filtered = groups.filter(g =>
    g.nama.toLowerCase().includes(search.toLowerCase()) ||
    g.kode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={open ? search : (selected ? selected.nama : '')}
        onChange={e => setSearch(e.target.value)}
        onFocus={() => { setOpen(true); setSearch(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Cari dan pilih grup..."
        style={inputStyle}
      />
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
          background: '#fff', border: '1px solid #E2E1DC', borderRadius: '7px',
          zIndex: 20, maxHeight: '200px', overflowY: 'auto',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666' }}>Tidak ditemukan</div>
          ) : filtered.map(g => (
            <div
              key={g.id}
              onMouseDown={() => onChange(g.id)}
              style={{
                padding: '9px 12px', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center',
                background: value === g.id ? '#F0F3FF' : 'transparent',
                fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D',
              }}
            >
              <span style={{ background: g.warna, color: g.warna_text, padding: '1px 6px', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 700, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nama}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== SHARED UI ===================== */

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', margin: 0, color: '#0D0D0D' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#666' }}>&#x2715;</button>
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 600, color: '#2E2E2E' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '7px',
  fontFamily: 'var(--font-body)', fontSize: '0.88rem', outline: 'none',
  color: '#0D0D0D', background: '#fff', width: '100%', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto' };

const mutedStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const errorStyle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.83rem', color: '#DC0A1E', margin: 0 };

const roleBadgeStyle: React.CSSProperties = {
  color: '#fff', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
  padding: '2px 7px', borderRadius: '4px', fontFamily: 'var(--font-body)', flexShrink: 0,
};

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '10px 16px', background: '#0D5C3A', color: '#fff',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
};

const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '10px 16px', background: '#F3F2EE', color: '#2E2E2E',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
};

const btnEdit: React.CSSProperties = {
  padding: '5px 12px', background: '#D6EEE2', color: '#0D5C3A',
  border: 'none', borderRadius: '6px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem',
};

const btnGhost: React.CSSProperties = {
  padding: '5px 12px', background: 'none', color: '#666',
  border: '1px solid #E2E1DC', borderRadius: '6px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem',
};
