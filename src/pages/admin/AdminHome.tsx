import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate, fmtTime } from '../../lib/dates';
import GrupBadge from '../../components/shared/GrupBadge';

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

const SESI_STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  terlaksana: { label: 'TERLAKSANA', bg: '#DCFCE7', color: '#15803D' },
  tidak:      { label: 'TIDAK',      bg: '#FEE2E2', color: '#DC0A1E' },
  ditunda:    { label: 'DITUNDA',    bg: '#FEF9C3', color: '#A16207' },
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

  const dateLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const today = toISODate(new Date());
    const todayHari = getTodayHari();
    const weekStart = getWeekStartISO();
    const weekEnd = getWeekEndISO();

    const [sessionsRes, teachersRes, studentsRes, todaySchedRes, recentRes] = await Promise.all([
      supabase.from('schedules').select('id', { count: 'exact', head: true }).gte('week_start', weekStart).lte('week_start', weekEnd),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('schedules')
        .select('id, hari, jam_mulai, jam_selesai, materi, groups!group_id(id,nama,kode,warna,warna_text), teacher:profiles!teacher_id(id,display_name)')
        .eq('week_start', weekStart)
        .eq('hari', todayHari)
        .order('jam_mulai'),
      supabase.from('profiles').select('id, display_name, role, created_at').order('created_at', { ascending: false }).limit(5),
    ]);

    setStats({
      sessions: sessionsRes.count ?? 0,
      teachers: teachersRes.count ?? 0,
      students: studentsRes.count ?? 0,
    });

    const sessions = ((todaySchedRes.data ?? []) as unknown as TodaySession[]);
    setTodaySessions(sessions);
    setRecentUsers((recentRes.data ?? []) as RecentUser[]);

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

  const ROLE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    admin:   { label: 'ADMIN', bg: '#DC0A1E', color: '#fff' },
    staff:   { label: 'STAFF', bg: '#0F1F6B', color: '#fff' },
    teacher: { label: 'PENGAJAR', bg: '#047857', color: '#fff' },
    student: { label: 'SISWA', bg: '#4B5563', color: '#fff' },
  };

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

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
            {[
              { val: stats.sessions, label: 'Sesi minggu ini' },
              { val: stats.teachers, label: 'Pengajar aktif' },
              { val: stats.students, label: 'Siswa terdaftar' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '16px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: '#0F1F6B', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>{s.label}</div>
              </div>
            ))}
          </div>

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

          {/* Recent users */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={sectionLabel}>User Terbaru</p>
              <button onClick={() => navigate('/admin/users')} style={linkBtn}>Kelola Users</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentUsers.map(u => {
                const badge = ROLE_BADGE[u.role] ?? { label: u.role, bg: '#666', color: '#fff' };
                const dateLabel = new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#F9F9F7', borderRadius: '7px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 700, background: badge.bg, color: badge.color, flexShrink: 0 }}>
                      {badge.label}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', color: '#0D0D0D', flex: 1 }}>{u.display_name}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888' }}>{dateLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 };
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '18px',
};
const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700, color: '#666',
  margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em',
};
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#0F1F6B', fontWeight: 600, padding: 0,
};
