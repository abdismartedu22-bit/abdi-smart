import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import PasswordInput from '../../components/shared/PasswordInput';
import type { Role, Group } from '../../types';

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  groups?: { group_id: string; groups: { id: string; nama: string; kode: string } }[];
};

type Tab = 'users' | 'groups';

const ROLES: Role[] = ['admin', 'staff', 'teacher', 'student'];
const roleLabel: Record<Role, string> = { admin: 'Admin', staff: 'Staff', teacher: 'Pengajar', student: 'Siswa' };
const roleBg: Record<Role, string> = { admin: '#DC0A1E', staff: '#0F1F6B', teacher: '#047857', student: '#4B5563' };

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
              color: tab === t ? '#0F1F6B' : '#666',
              borderBottom: tab === t ? '2px solid #0F1F6B' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            {t === 'users' ? 'Users' : 'Grup'}
          </button>
        ))}
      </div>

      {tab === 'users' ? <UsersTab /> : <GroupsTab />}
    </div>
  );
}

/* ===================== USERS TAB ===================== */

function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: u }, { data: g }] = await Promise.all([
      supabase.from('profiles')
        .select('id, username, display_name, role, student_groups(group_id, groups(id, nama, kode))')
        .order('role').order('display_name'),
      supabase.from('groups').select('*').eq('active', true).order('nama'),
    ]);
    setUsers((u ?? []) as UserRow[]);
    setGroups(g ?? []);
    setLoading(false);
  }

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search && !u.username.toLowerCase().includes(search.toLowerCase()) && !u.display_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari username / nama..."
            style={inputStyle}
          />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as Role | 'all')} style={selectStyle}>
            <option value="all">Semua role</option>
            {ROLES.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
          </select>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Tambah User</button>
      </div>

      {loading ? (
        <p style={mutedStyle}>Memuat...</p>
      ) : filtered.length === 0 ? (
        <p style={mutedStyle}>Tidak ada user.</p>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
          {filtered.map((u, i) => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
              borderBottom: i < filtered.length - 1 ? '1px solid #E2E1DC' : 'none',
              flexWrap: 'wrap',
            }}>
              <span style={{ ...roleBadgeStyle, background: roleBg[u.role] }}>{roleLabel[u.role]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', color: '#0D0D0D' }}>
                  {u.display_name}
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666' }}>
                  @{u.username}
                  {u.role === 'student' && u.groups && u.groups.length > 0 && (
                    <span> &middot; {u.groups.map(g => g.groups?.kode ?? '').join(', ')}</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button onClick={() => { setEditTarget(u); setShowEdit(true); }} style={btnEdit}>Edit</button>
                <button onClick={() => { setResetTarget(u); setShowResetPw(true); }} style={btnGhost}>Reset PW</button>
              </div>
            </div>
          ))}
        </div>
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
          onClose={() => setShowEdit(false)}
          onDone={() => { setShowEdit(false); load(); }}
        />
      )}
      {showResetPw && resetTarget && (
        <ResetPwModal
          user={resetTarget}
          onClose={() => setShowResetPw(false)}
        />
      )}
    </>
  );
}

/* ===================== CREATE USER MODAL ===================== */

function CreateUserModal({ groups, onClose, onDone }: { groups: Group[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    display_name: '', username: '', email: '', password: '',
    role: 'student' as Role,
    group_id: '',
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
    if (form.role === 'student' && !form.group_id) {
      setError('Pilih grup untuk siswa');
      return;
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
    setSubmitting(false);
    if (!res.ok) { setError(json.error ?? 'Gagal membuat user'); return; }
    onDone();
  }

  return (
    <Overlay>
      <Modal title="Tambah User Baru" onClose={onClose}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FieldRow label="Nama Lengkap">
            <input style={inputStyle} value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} required />
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
            <FieldRow label="Grup">
              {groups.length === 0 ? (
                <p style={{ ...errorStyle, color: '#A16207' }}>Belum ada grup. Buat grup terlebih dahulu di tab Grup.</p>
              ) : (
                <GroupSelect groups={groups} value={form.group_id} onChange={id => setForm(f => ({ ...f, group_id: id }))} />
              )}
            </FieldRow>
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

function EditUserModal({ user, groups, onClose, onDone }: { user: UserRow; groups: Group[]; onClose: () => void; onDone: () => void }) {
  const currentGroupId = (user.groups ?? [])[0]?.group_id ?? '';
  const [form, setForm] = useState({
    display_name: user.display_name,
    role: user.role,
    group_id: currentGroupId,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const { error: profileErr } = await supabase.from('profiles')
      .update({ display_name: form.display_name, role: form.role })
      .eq('id', user.id);
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

  return (
    <Overlay>
      <Modal title={`Edit: ${user.username}`} onClose={onClose}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FieldRow label="Nama Lengkap">
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
          {form.role === 'student' && (
            <FieldRow label="Grup">
              {groups.length === 0 ? (
                <p style={{ ...errorStyle, color: '#A16207' }}>Belum ada grup aktif.</p>
              ) : (
                <GroupSelect groups={groups} value={form.group_id} onChange={id => setForm(f => ({ ...f, group_id: id }))} />
              )}
            </FieldRow>
          )}
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

/* ===================== GROUPS TAB ===================== */

function GroupsTab() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Group | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('groups').select('*').order('nama');
    setGroups(data ?? []);
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

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Tambah Grup</button>
      </div>

      {loading ? (
        <p style={mutedStyle}>Memuat...</p>
      ) : groups.length === 0 ? (
        <p style={mutedStyle}>Belum ada grup.</p>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', overflow: 'hidden' }}>
          {groups.map((g, i) => (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
              borderBottom: i < groups.length - 1 ? '1px solid #E2E1DC' : 'none',
            }}>
              <span style={{ background: g.warna, color: g.warna_text, padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-body)', letterSpacing: '0.05em' }}>
                {g.kode}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', color: '#0D0D0D' }}>{g.nama}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#666' }}>{g.tipe}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setEditTarget(g)} style={btnEdit}>Edit</button>
                <button onClick={() => { setDeleteTarget(g); setDeleteError(''); }} style={{ ...btnGhost, color: '#DC0A1E' }}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
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
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.nama || !form.kode) { setError('Nama dan kode wajib diisi'); return; }
    setSubmitting(true);
    const payload = { nama: form.nama, kode: form.kode.toUpperCase(), tipe: form.tipe, warna: form.warna, warna_text: form.warna_text };
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
            <input style={inputStyle} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} required placeholder="cth. Grup Merah" />
          </FieldRow>
          <FieldRow label="Kode (2-3 huruf)">
            <input style={inputStyle} value={form.kode} onChange={e => setForm(f => ({ ...f, kode: e.target.value.toUpperCase().slice(0, 4) }))} required placeholder="cth. GR" maxLength={4} />
          </FieldRow>
          <FieldRow label="Tipe">
            <div style={{ display: 'flex', gap: '16px' }}>
              {['reguler', 'privat'].map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem' }}>
                  <input type="radio" name="tipe" value={t} checked={form.tipe === t} onChange={() => setForm(f => ({ ...f, tipe: t as 'reguler' | 'privat' }))} />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </label>
              ))}
            </div>
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
                {form.kode || 'KODE'}
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
        value={open ? search : (selected ? `[${selected.kode}] ${selected.nama}` : '')}
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
              <span style={{ background: g.warna, color: g.warna_text, padding: '1px 6px', borderRadius: '3px', fontSize: '0.68rem', fontWeight: 700 }}>{g.kode}</span>
              {g.nama}
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
  flex: 1, padding: '10px 16px', background: '#0F1F6B', color: '#fff',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
};

const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '10px 16px', background: '#F3F2EE', color: '#2E2E2E',
  border: 'none', borderRadius: '8px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem',
};

const btnEdit: React.CSSProperties = {
  padding: '5px 12px', background: '#E6EAF8', color: '#0F1F6B',
  border: 'none', borderRadius: '6px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem',
};

const btnGhost: React.CSSProperties = {
  padding: '5px 12px', background: 'none', color: '#666',
  border: '1px solid #E2E1DC', borderRadius: '6px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem',
};
