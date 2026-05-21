import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate, fmtTime } from '../../lib/dates';
import GrupBadge from '../../components/shared/GrupBadge';

type Group = { id: string; nama: string; kode: string; warna: string; warna_text: string };
type NextSession = {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  lokasi: string | null;
  week_start: string;
  groups: Group;
  teacher: { display_name: string } | null;
};
type TOResult = {
  id: string;
  type: string;
  nama_to: string;
  tanggal_to: string;
  scores: Record<string, number>;
  total_score: number;
};

const HARI_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const TYPE_LABELS: Record<string, string> = {
  SNBT: 'SNBT', 'TKA-Saintek': 'TKA Saintek', 'TKA-Soshum': 'TKA Soshum',
};
const TYPE_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  SNBT: [{ key: 'pu', label: 'PU' }, { key: 'ppu', label: 'PPU' }, { key: 'pbm', label: 'PBM' }, { key: 'pk', label: 'PK' }, { key: 'lbi', label: 'LBI' }, { key: 'lbe', label: 'LBE' }, { key: 'pm', label: 'PM' }],
  'TKA-Saintek': [{ key: 'mat', label: 'Mat' }, { key: 'fis', label: 'Fis' }, { key: 'kim', label: 'Kim' }, { key: 'bio', label: 'Bio' }],
  'TKA-Soshum': [{ key: 'geo', label: 'Geo' }, { key: 'sej', label: 'Sej' }, { key: 'sos', label: 'Sos' }, { key: 'eko', label: 'Eko' }],
};
const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  SNBT: { bg: '#EFF6FF', color: '#1D4ED8' },
  'TKA-Saintek': { bg: '#F0FDF4', color: '#15803D' },
  'TKA-Soshum': { bg: '#FFF7ED', color: '#C2410C' },
};

function getWeekStartISO(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

function getTodayHari(): string {
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
}

export default function StudentHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [attendance, setAttendance] = useState({ hadir: 0, absen: 0, izin: 0 });
  const [latestTO, setLatestTO] = useState<TOResult | null>(null);
  const [loading, setLoading] = useState(true);

  const dateLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const today = toISODate(new Date());
    const todayHari = getTodayHari();
    const todayHariIdx = HARI_ORDER.indexOf(todayHari);

    // Get student's groups
    const { data: sg } = await supabase
      .from('student_groups')
      .select('group_id, groups!group_id(id, nama, kode, warna, warna_text)')
      .eq('student_id', user!.id);

    const myGroups = ((sg ?? []).map(r => r.groups)).filter(Boolean) as Group[];
    setGroups(myGroups);
    const groupIds = myGroups.map(g => g.id);

    if (groupIds.length > 0) {
      // Next session: look in current week and next week
      const weekStart = getWeekStartISO();
      const { data: schedWeek } = await supabase
        .from('schedules')
        .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, week_start, groups!group_id(id,nama,kode,warna,warna_text), teacher:profiles!teacher_id(display_name)')
        .in('group_id', groupIds)
        .eq('week_start', weekStart)
        .order('jam_mulai');

      const weekSessions = (schedWeek ?? []) as NextSession[];
      let found: NextSession | null = null;

      // Find next session from today onwards (same week)
      for (const hari of HARI_ORDER.slice(todayHariIdx)) {
        const sessions = weekSessions.filter(s => s.hari === hari);
        if (sessions.length > 0) {
          // If today, pick the earliest session that hasn't ended yet (or just first)
          if (hari === todayHari) {
            const now = new Date();
            const upcoming = sessions.find(s => {
              const [h, m] = s.jam_selesai.split(':').map(Number);
              const end = new Date(); end.setHours(h, m, 0, 0);
              return now < end;
            });
            found = upcoming ?? sessions[0];
          } else {
            found = sessions[0];
          }
          if (found) break;
        }
      }

      // If nothing found this week, try next week
      if (!found) {
        const nextWeekStart = getWeekStartISO(new Date(new Date().setDate(new Date().getDate() + 7)));
        const { data: nextWeekData } = await supabase
          .from('schedules')
          .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, week_start, groups!group_id(id,nama,kode,warna,warna_text), teacher:profiles!teacher_id(display_name)')
          .in('group_id', groupIds)
          .eq('week_start', nextWeekStart)
          .order('jam_mulai')
          .limit(1);
        found = ((nextWeekData ?? []) as NextSession[])[0] ?? null;
      }

      setNextSession(found);

      // Attendance this month
      const monthStart = new Date(); monthStart.setDate(1);
      const { data: att } = await supabase
        .from('attendance')
        .select('status')
        .eq('person_id', user!.id)
        .eq('person_role', 'student')
        .gte('session_date', toISODate(monthStart))
        .lte('session_date', today)
        .not('status', 'is', null);

      const counts = { hadir: 0, absen: 0, izin: 0 };
      (att ?? []).forEach(a => {
        if (a.status === 'hadir') counts.hadir++;
        else if (a.status === 'absen') counts.absen++;
        else if (a.status === 'izin') counts.izin++;
      });
      setAttendance(counts);
    }

    // Latest TO
    const { data: to } = await supabase
      .from('tryout_results')
      .select('id, type, nama_to, tanggal_to, scores, total_score')
      .eq('student_id', user!.id)
      .order('tanggal_to', { ascending: false })
      .limit(1);
    setLatestTO(((to ?? []) as TOResult[])[0] ?? null);

    setLoading(false);
  }

  const totalSessions = attendance.hadir + attendance.absen + attendance.izin;
  const pctHadir = totalSessions > 0 ? Math.round((attendance.hadir / totalSessions) * 100) : null;
  const monthName = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 4px', color: '#0D0D0D' }}>
          Hai, {profile?.display_name ?? '...'}!
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 }}>
          {dateLabel}
          {groups.length > 0 && (
            <span> &mdash; {groups.map(g => `${g.nama} (${g.kode})`).join(', ')}</span>
          )}
        </p>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Attendance Card */}
          <div style={card}>
            <p style={sectionLabel}>Kehadiran &mdash; {monthName}</p>
            {totalSessions === 0 ? (
              <p style={muted}>Belum ada sesi tercatat bulan ini.</p>
            ) : (
              <>
                <div style={{ position: 'relative', height: '8px', background: '#F3F2EE', borderRadius: '99px', marginBottom: '10px', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pctHadir}%`, background: '#22C55E', borderRadius: '99px', transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
                    <span style={{ color: '#22C55E', fontWeight: 700 }}>{attendance.hadir}</span>
                    <span style={{ color: '#666' }}> hadir</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
                    <span style={{ color: '#DC0A1E', fontWeight: 700 }}>{attendance.absen}</span>
                    <span style={{ color: '#666' }}> absen</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem' }}>
                    <span style={{ color: '#A16207', fontWeight: 700 }}>{attendance.izin}</span>
                    <span style={{ color: '#666' }}> izin</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', marginLeft: 'auto' }}>
                    <span style={{ fontWeight: 700, color: '#0D0D0D' }}>{pctHadir}%</span>
                    <span style={{ color: '#666' }}> hadir</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Next Session Card */}
          <div style={card}>
            <p style={sectionLabel}>Sesi Berikutnya</p>
            {nextSession ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <GrupBadge kode={nextSession.groups.kode} warna={nextSession.groups.warna} warna_text={nextSession.groups.warna_text} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D' }}>
                    {nextSession.hari} &mdash; {fmtTime(nextSession.jam_mulai)}&ndash;{fmtTime(nextSession.jam_selesai)}
                  </div>
                  {nextSession.materi && (
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', marginTop: '2px' }}>
                      {nextSession.materi}
                    </div>
                  )}
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
                    {nextSession.teacher?.display_name ?? 'Pengajar'}{nextSession.lokasi ? ` @ ${nextSession.lokasi}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => navigate('/student/absen')}
                  style={{ padding: '7px 14px', background: '#0F1F6B', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.82rem', flexShrink: 0 }}
                >
                  Absen
                </button>
              </div>
            ) : (
              <p style={muted}>Tidak ada sesi berikutnya.</p>
            )}
          </div>

          {/* Latest TO Card */}
          <div style={card}>
            <p style={sectionLabel}>Hasil TO Terakhir</p>
            {latestTO ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', color: '#0D0D0D' }}>
                      {latestTO.nama_to}
                    </span>
                    {(() => {
                      const s = TYPE_STYLE[latestTO.type] ?? { bg: '#F3F2EE', color: '#666' };
                      return (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700, background: s.bg, color: s.color }}>
                          {TYPE_LABELS[latestTO.type] ?? latestTO.type}
                        </span>
                      );
                    })()}
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666', margin: '0 0 8px' }}>
                    {new Date(latestTO.tanggal_to + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {(TYPE_FIELDS[latestTO.type] ?? []).map(f => (
                      <div key={f.key} style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem' }}>
                        <span style={{ color: '#888' }}>{f.label} </span>
                        <span style={{ color: '#0D0D0D', fontWeight: 600 }}>{latestTO.scores?.[f.key] ?? '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: '#0F1F6B', lineHeight: 1 }}>
                    {typeof latestTO.total_score === 'number' ? latestTO.total_score.toFixed(2) : '-'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', marginTop: '2px' }}>total</div>
                  <button
                    onClick={() => navigate('/student/hasil-to')}
                    style={{ marginTop: '8px', padding: '5px 12px', background: 'none', color: '#0F1F6B', border: '1px solid #0F1F6B', borderRadius: '6px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.78rem' }}
                  >
                    Lihat Semua
                  </button>
                </div>
              </div>
            ) : (
              <p style={muted}>Belum ada hasil TO.</p>
            )}
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
  margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em',
};
