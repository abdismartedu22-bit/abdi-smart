import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toISODate, fmtTime } from '../../lib/dates';
import GrupBadge from '../../components/shared/GrupBadge';
import DashboardBanner from '../../components/shared/DashboardBanner';

type Group = { id: string; nama: string; kode: string; warna: string; warna_text: string; paket: number | null };
type NextSession = {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  lokasi: string | null;
  ruangan: string | null;
  week_start: string;
  groups: Omit<Group, 'paket'>;
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
  SNBT: 'SNBT', TKA: 'TKA', 'TKA-Saintek': 'TKA', 'TKA-Soshum': 'TKA',
};
const TYPE_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  SNBT: [{ key: 'pu', label: 'PU' }, { key: 'ppu', label: 'PPU' }, { key: 'pbm', label: 'PBM' }, { key: 'pk', label: 'PK' }, { key: 'lbi', label: 'LBI' }, { key: 'lbe', label: 'LBE' }, { key: 'pm', label: 'PM' }],
  TKA: [{ key: 'mat', label: 'Mat' }, { key: 'fis', label: 'Fis' }, { key: 'kim', label: 'Kim' }, { key: 'bio', label: 'Bio' }, { key: 'geo', label: 'Geo' }, { key: 'sej', label: 'Sej' }, { key: 'sos', label: 'Sos' }, { key: 'eko', label: 'Eko' }],
  'TKA-Saintek': [{ key: 'mat', label: 'Mat' }, { key: 'fis', label: 'Fis' }, { key: 'kim', label: 'Kim' }, { key: 'bio', label: 'Bio' }],
  'TKA-Soshum': [{ key: 'geo', label: 'Geo' }, { key: 'sej', label: 'Sej' }, { key: 'sos', label: 'Sos' }, { key: 'eko', label: 'Eko' }],
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
  const [realisasiByGroup, setRealisasiByGroup] = useState<Record<string, number>>({});
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [attendance, setAttendance] = useState({ hadir: 0, tidak_hadir: 0 });
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

    const { data: sg } = await supabase
      .from('student_groups')
      .select('group_id, groups!group_id(id, nama, kode, warna, warna_text, paket)')
      .eq('student_id', user!.id);

    const myGroups = ((sg ?? []).map(r => r.groups)).filter(Boolean) as unknown as Group[];
    setGroups(myGroups);
    const groupIds = myGroups.map(g => g.id);

    if (groupIds.length > 0) {
      // Compute realisasi per group
      const { data: allSchedules } = await supabase
        .from('schedules')
        .select('id, group_id')
        .in('group_id', groupIds);

      const schedsByGroup: Record<string, string[]> = {};
      (allSchedules ?? []).forEach((s: any) => {
        if (!schedsByGroup[s.group_id]) schedsByGroup[s.group_id] = [];
        schedsByGroup[s.group_id].push(s.id);
      });

      const allSchedIds = (allSchedules ?? []).map((s: any) => s.id);
      if (allSchedIds.length > 0) {
        const { data: realisedRows } = await supabase
          .from('attendance')
          .select('schedule_id')
          .eq('person_role', 'teacher')
          .eq('sesi_status', 'terlaksana')
          .in('schedule_id', allSchedIds);

        const realisedSet = new Set((realisedRows ?? []).map((r: any) => r.schedule_id));
        const rMap: Record<string, number> = {};
        Object.entries(schedsByGroup).forEach(([gid, sids]) => {
          rMap[gid] = sids.filter(sid => realisedSet.has(sid)).length;
        });
        setRealisasiByGroup(rMap);
      }

      // Next session
      const weekStart = getWeekStartISO();
      const { data: schedWeek } = await supabase
        .from('schedules')
        .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, ruangan, week_start, groups!group_id(id,nama,kode,warna,warna_text), teacher:profiles!teacher_id(display_name)')
        .in('group_id', groupIds)
        .eq('week_start', weekStart)
        .order('jam_mulai');

      const weekSessions = (schedWeek ?? []) as unknown as NextSession[];
      let found: NextSession | null = null;

      for (const hari of HARI_ORDER.slice(todayHariIdx)) {
        const sessions = weekSessions.filter(s => s.hari === hari);
        if (sessions.length > 0) {
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

      if (!found) {
        const nextWeekStart = getWeekStartISO(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
        const { data: nextWeekData } = await supabase
          .from('schedules')
          .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, ruangan, week_start, groups!group_id(id,nama,kode,warna,warna_text), teacher:profiles!teacher_id(display_name)')
          .in('group_id', groupIds)
          .eq('week_start', nextWeekStart)
          .order('jam_mulai')
          .limit(1);
        found = ((nextWeekData ?? []) as unknown as NextSession[])[0] ?? null;
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

      const counts = { hadir: 0, tidak_hadir: 0 };
      (att ?? []).forEach(a => {
        if (a.status === 'hadir') counts.hadir++;
        else counts.tidak_hadir++;
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

  const totalSessions = attendance.hadir + attendance.tidak_hadir;
  const pctHadir = totalSessions > 0 ? Math.round((attendance.hadir / totalSessions) * 100) : null;
  const monthName = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const firstName = profile?.display_name?.split(' ')[0] ?? '...';

  return (
    <div style={{ maxWidth: '640px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', margin: '0 0 4px', color: '#0D0D0D', letterSpacing: '-0.02em' }}>
          Hai, {firstName}!
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#888', margin: 0 }}>{dateLabel}</p>
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <DashboardBanner />

          {/* Paket card per group */}
          {groups.map(g => {
            const realisasi = realisasiByGroup[g.id] ?? 0;
            const paket = g.paket ?? 0;
            const sisa = paket - realisasi;
            const pct = paket > 0 ? Math.round((realisasi / paket) * 100) : 0;
            return (
              <div key={g.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <GrupBadge kode={g.kode} warna={g.warna} warna_text={g.warna_text} />
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.88rem', color: '#0D0D0D' }}>{g.nama}</span>
                  <span style={chip}>Paket Bimbel</span>
                </div>
                {paket > 0 ? (
                  <>
                    <div style={{ position: 'relative', height: '8px', background: '#F3F2EE', borderRadius: '99px', marginBottom: '12px', overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute', left: 0, top: 0, height: '100%',
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, #FFE500, #22C55E)',
                        borderRadius: '99px',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0', flexWrap: 'wrap' }}>
                      <StatPill label="Dibeli" value={paket} color="#0D5C3A" />
                      <StatPill label="Terlaksana" value={realisasi} color="#22C55E" />
                      <StatPill label="Sisa" value={sisa} color={sisa < 10 ? '#DC0A1E' : '#A16207'} highlight={sisa < 10} />
                    </div>
                  </>
                ) : (
                  <p style={muted}>Paket belum diatur.</p>
                )}
              </div>
            );
          })}

          {/* Kehadiran */}
          <div style={card}>
            <p style={label}>Kehadiran &mdash; {monthName}</p>
            {totalSessions === 0 ? (
              <p style={muted}>Belum ada sesi bulan ini.</p>
            ) : (
              <>
                <div style={{ position: 'relative', height: '8px', background: '#F3F2EE', borderRadius: '99px', marginBottom: '12px', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, height: '100%',
                    width: `${pctHadir}%`,
                    background: pctHadir! >= 80 ? 'linear-gradient(90deg, #22C55E, #16A34A)' : 'linear-gradient(90deg, #FFE500, #EAB308)',
                    borderRadius: '99px',
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', gap: '0', flexWrap: 'wrap', alignItems: 'center' }}>
                  <StatPill label="Hadir" value={attendance.hadir} color="#15803D" />
                  <StatPill label="Tidak Hadir" value={attendance.tidak_hadir} color="#DC0A1E" />
                  <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: '#0D5C3A', lineHeight: 1 }}>
                    {pctHadir}%
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sesi Berikutnya */}
          <div style={{ ...card, borderLeft: nextSession ? '3px solid #FFE500' : '3px solid #E2E1DC' }}>
            <p style={label}>Sesi Berikutnya</p>
            {nextSession ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <GrupBadge kode={nextSession.groups.kode} warna={nextSession.groups.warna} warna_text={nextSession.groups.warna_text} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem', color: '#0D0D0D' }}>
                      {nextSession.hari} &nbsp;{fmtTime(nextSession.jam_mulai)}&ndash;{fmtTime(nextSession.jam_selesai)}
                    </div>
                    {nextSession.materi && (
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#444', marginTop: '2px' }}>
                        {nextSession.materi}
                      </div>
                    )}
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                      {nextSession.teacher?.display_name ?? 'Pengajar'}
                      {nextSession.lokasi ? ` @ ${nextSession.lokasi}` : ''}
                      {nextSession.ruangan ? ` / ${nextSession.ruangan}` : ''}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/student/absen')}
                  style={{
                    marginTop: '14px', width: '100%', padding: '10px', background: '#0D5C3A', color: '#fff',
                    border: 'none', borderRadius: '10px', cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem',
                    letterSpacing: '0.01em',
                  }}
                >
                  Absen Sekarang
                </button>
              </div>
            ) : (
              <p style={muted}>Tidak ada sesi berikutnya.</p>
            )}
          </div>

          {/* TO Terakhir */}
          <div style={card}>
            <p style={label}>Hasil TO Terakhir</p>
            {latestTO ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.92rem', color: '#0D0D0D', marginBottom: '2px' }}>
                      {latestTO.nama_to}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#888', marginBottom: '10px' }}>
                      {new Date(latestTO.tanggal_to + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      &nbsp;&middot;&nbsp;{TYPE_LABELS[latestTO.type] ?? latestTO.type}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {(TYPE_FIELDS[latestTO.type] ?? []).map(f => (
                        <div key={f.key} style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem' }}>
                          <span style={{ color: '#aaa' }}>{f.label}&nbsp;</span>
                          <span style={{ color: '#0D0D0D', fontWeight: 700 }}>{latestTO.scores?.[f.key] ?? '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: '#0D5C3A', lineHeight: 1 }}>
                      {typeof latestTO.total_score === 'number' ? latestTO.total_score.toFixed(0) : '-'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#aaa' }}>total</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/student/hasil-to')}
                  style={{
                    marginTop: '12px', width: '100%', padding: '9px', background: '#F3F2EE', color: '#0D5C3A',
                    border: 'none', borderRadius: '8px', cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.85rem',
                  }}
                >
                  Lihat Semua Hasil TO
                </button>
              </div>
            ) : (
              <p style={muted}>Belum ada hasil TO.</p>
            )}
          </div>

          {/* Buka TO Abdi Smart */}
          <a
            href="https://abdismart.web.id/toAS/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', background: '#0D5C3A', color: '#FFE500',
              borderRadius: '12px', textDecoration: 'none', gap: '10px',
            }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.92rem' }}>Kerjakan TO Online</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'rgba(255,229,0,0.7)', marginTop: '2px' }}>abdismart.web.id</div>
            </div>
            <span style={{ fontSize: '1.2rem', opacity: 0.7 }}>&#8599;</span>
          </a>

        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '8px 16px', marginRight: '4px', marginBottom: '4px',
      background: highlight ? '#FFF0F1' : '#F9F9F7',
      borderRadius: '10px', minWidth: '72px',
    }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color, lineHeight: 1, fontWeight: 900 }}>{value}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.7rem', color: '#888', marginTop: '2px' }}>{label}</span>
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#888', margin: 0 };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #EBEBEB', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
const label: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: 700, color: '#aaa', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' };
const chip: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.68rem', fontWeight: 700, color: '#0D5C3A', background: '#EEF1FF', padding: '2px 8px', borderRadius: '99px', letterSpacing: '0.04em' };
