import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate, fmtTime } from '../../lib/dates';
import GrupBadge from '../../components/shared/GrupBadge';
import DashboardBanner from '../../components/shared/DashboardBanner';
import BannerManager from '../../components/shared/BannerManager';

type TodaySession = {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  groups: { id: string; nama: string; kode: string; warna: string; warna_text: string };
  teacher: { id: string; display_name: string };
};

type RecentUser = {
  id: string;
  display_name: string;
  role: string;
  created_at: string;
};

type GroupSisa = {
  id: string;
  nama: string;
  kode: string;
  warna: string;
  warna_text: string;
  paket: number;
  realisasi: number;
  wa_group_link?: string | null;
};

type InactiveGroup = {
  id: string;
  nama: string;
  kode: string;
  warna: string;
  warna_text: string;
  last_session: string | null;
};

const SESI_STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  terlaksana: { label: 'TERLAKSANA', bg: '#DCFCE7', color: '#15803D' },
  tidak:      { label: 'TIDAK',      bg: '#FEE2E2', color: '#DC0A1E' },
  ditunda:    { label: 'DITUNDA',    bg: '#FEF9C3', color: '#A16207' },
};

const ROLE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  admin:   { label: 'ADMIN', bg: '#DC0A1E', color: '#fff' },
  staff:   { label: 'STAFF', bg: '#1E4D8C', color: '#fff' },
  teacher: { label: 'PENGAJAR', bg: '#047857', color: '#fff' },
  student: { label: 'SISWA', bg: '#4B5563', color: '#fff' },
};

function getWeekStartISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

function getWeekEndISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

function getTodayHari(): string {
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
}

export default function AdminHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sessions: 0, teachers: 0, students: 0 });
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Record<string, string | null>>({});
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [sisaAlert, setSisaAlert] = useState<GroupSisa[]>([]);
  const [inactiveGroups, setInactiveGroups] = useState<InactiveGroup[]>([]);

  const dateLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const today = toISODate(new Date());
    const todayHari = getTodayHari();
    const weekStart = getWeekStartISO();
    const weekEnd = getWeekEndISO();

    const thirtyDaysAgo = toISODate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    const [sessionsRes, teachersRes, studentsRes, todaySchedRes, recentRes, groupsRes, inactiveRes, waLinksRes] = await Promise.all([
      supabase.from('schedules').select('id', { count: 'exact', head: true }).gte('week_start', weekStart).lte('week_start', weekEnd),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('schedules')
        .select('id, hari, jam_mulai, jam_selesai, materi, groups!group_id(id,nama,kode,warna,warna_text), teacher:profiles!teacher_id(id,display_name)')
        .eq('week_start', weekStart)
        .eq('hari', todayHari)
        .order('jam_mulai'),
      supabase.from('profiles')
        .select('id, display_name, role, created_at')
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.rpc('get_groups_with_realisasi'),
      supabase.rpc('get_inactive_groups'),
      supabase.from('groups').select('id, wa_group_link'),
    ]);

    setStats({
      sessions: sessionsRes.count ?? 0,
      teachers: teachersRes.count ?? 0,
      students: studentsRes.count ?? 0,
    });

    const sessions = ((todaySchedRes.data ?? []) as unknown as TodaySession[]);
    setTodaySessions(sessions);
    setRecentUsers((recentRes.data ?? []) as RecentUser[]);

    // Groups with sisa < 10 -- merge in wa_group_link
    const waMap: Record<string, string | null> = {};
    ((waLinksRes.data ?? []) as { id: string; wa_group_link: string | null }[]).forEach(r => { waMap[r.id] = r.wa_group_link; });
    const allGroups = (groupsRes.data ?? []) as GroupSisa[];
    setSisaAlert(
      allGroups
        .filter(g => g.paket != null && g.paket > 0 && (g.paket - g.realisasi) < 10)
        .map(g => ({ ...g, wa_group_link: waMap[g.id] ?? null }))
    );
    setInactiveGroups((inactiveRes.data ?? []) as InactiveGroup[]);

    if (sessions.length > 0) {
      const { data: att } = await supabase
        .from('attendance')
        .select('schedule_id, sesi_status')
        .in('schedule_id', sessions.map(s => s.id))
        .eq('session_date', today)
        .eq('person_role', 'teacher');

      const map: Record<string, string | null> = {};
      (att ?? []).forEach((a: any) => { map[a.schedule_id] = a.sesi_status; });
      setTodayAttendance(map);
    }

    setLoading(false);
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 4px', color: '#0D0D0D' }}>
          Selamat datang, {profile?.display_name ?? 'Admin'}!
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 }}>{dateLabel}</p>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <DashboardBanner />
          <BannerManager />

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
            {[
              { val: stats.sessions, label: 'Sesi minggu ini' },
              { val: stats.teachers, label: 'Pengajar aktif' },
              { val: stats.students, label: 'Siswa terdaftar' },
            ].map((s, i) => (
              <div key={i} style={statCard}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: '#0D5C3A', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Sisa < 10 alert */}
          {sisaAlert.length > 0 && (
            <div style={{ ...card, borderLeft: '3px solid #DC0A1E' }}>
              <p style={{ ...sectionLabel, color: '#DC0A1E' }}>Sisa Sesi &lt; 10 &mdash; Perlu Follow Up</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sisaAlert.map(g => {
                  const sisa = g.paket - g.realisasi;
                  return (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#FFF0F1', borderRadius: '7px', flexWrap: 'wrap' }}>
                      <GrupBadge kode={g.kode} warna={g.warna} warna_text={g.warna_text} />
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', color: '#0D0D0D', flex: 1 }}>{g.nama}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666' }}>{g.realisasi}/{g.paket} sesi</span>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: '#DC0A1E', color: '#fff' }}>
                        Sisa {sisa}
                      </span>
                      {g.wa_group_link && (
                        <a
                          href={g.wa_group_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ padding: '3px 10px', background: '#25D366', color: '#fff', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--font-body)', textDecoration: 'none', flexShrink: 0 }}
                        >
                          WA Grup
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inactive groups */}
          {inactiveGroups.length > 0 && (
            <div style={{ ...card, borderLeft: '3px solid #A16207' }}>
              <p style={{ ...sectionLabel, color: '#A16207' }}>Grup Tidak Les &gt;7 Hari</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {inactiveGroups.map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#FEFCE8', borderRadius: '7px', flexWrap: 'wrap' }}>
                    <GrupBadge kode={g.kode} warna={g.warna} warna_text={g.warna_text} />
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', color: '#0D0D0D', flex: 1 }}>{g.nama}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#A16207' }}>
                      {g.last_session
                        ? `Terakhir ${new Date(g.last_session + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
                        : 'Belum pernah les'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's sessions */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={sectionLabel}>Realisasi Hari Ini</p>
              <button onClick={() => navigate('/admin/realisasi')} style={linkBtn}>Lihat Semua</button>
            </div>
            {todaySessions.length === 0 ? (
              <p style={muted}>Tidak ada sesi hari ini.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {todaySessions.map(s => {
                  const sesiStatus = todayAttendance[s.id];
                  const statusInfo = sesiStatus ? SESI_STATUS_LABELS[sesiStatus] : null;
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#F9F9F7', borderRadius: '8px', flexWrap: 'wrap' }}>
                      <GrupBadge kode={s.groups.kode} warna={s.groups.warna} warna_text={s.groups.warna_text} />
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', color: '#0D0D0D' }}>{fmtTime(s.jam_mulai)}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#555', flex: 1 }}>{s.materi ?? 'tanpa materi'}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666' }}>{s.teacher.display_name}</span>
                      {statusInfo ? (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: statusInfo.bg, color: statusInfo.color }}>
                          {statusInfo.label}
                        </span>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#999' }}>BELUM</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent users (last 30 days) */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={sectionLabel}>User Terbaru (30 hari)</p>
              <button onClick={() => navigate('/admin/users')} style={linkBtn}>Kelola Users</button>
            </div>
            {recentUsers.length === 0 ? (
              <p style={muted}>Tidak ada user baru dalam 30 hari terakhir.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {recentUsers.map(u => {
                  const badge = ROLE_BADGE[u.role] ?? { label: u.role, bg: '#666', color: '#fff' };
                  const dl = new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                  return (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#F9F9F7', borderRadius: '7px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, background: badge.bg, color: badge.color, flexShrink: 0 }}>
                        {badge.label}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', color: '#0D0D0D', flex: 1 }}>{u.display_name}</span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888' }}>{dl}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const statCard: React.CSSProperties = { background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '18px' };
const sectionLabel: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700, color: '#666', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#0D5C3A', fontWeight: 600, padding: 0 };
