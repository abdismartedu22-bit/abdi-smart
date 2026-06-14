import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { HARI, getWeekStart, getWeekDays, toISODate, formatDayLabel, fmtTime, nowWITAMinutes } from '../../lib/dates';
import WeekPicker from '../../components/shared/WeekPicker';
import GrupBadge from '../../components/shared/GrupBadge';

type ScheduleRow = {
  id: string;
  group_id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  lokasi: string | null;
  ruangan: string | null;
  pertemuan_ke: number | null;
  groups: { id: string; nama: string; kode: string; warna: string; warna_text: string; tipe: string };
  teacher: { id: string; display_name: string } | null;
};

function getTodayHari(): string {
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
}

export default function StudentJadwal() {
  const { user, profile } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart());
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [onlineTotalSesi, setOnlineTotalSesi] = useState<Record<string, number>>({});
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const weekDays = getWeekDays(weekStart);
  const todayHari = getTodayHari();
  const isThisWeek = toISODate(weekStart) === toISODate(getWeekStart());

  useEffect(() => {
    if (!user) return;
    load();
  }, [weekStart, user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);

    const is12SMA = ['12IPA', '12IPS'].includes(profile?.tingkat_kelas ?? '');

    const [{ data: sg }, onlineGroupsRes] = await Promise.all([
      supabase.from('student_groups').select('group_id').eq('student_id', user!.id),
      is12SMA
        ? supabase.from('groups').select('id').eq('tipe', 'online').eq('active', true)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const myGroupIds = (sg ?? []).map(x => x.group_id as string);
    const onlineGroupIds = (onlineGroupsRes.data ?? []).map((x: any) => x.id as string);
    const allGroupIds = [...new Set([...myGroupIds, ...onlineGroupIds])];

    if (allGroupIds.length === 0) {
      setSchedules([]);
      setOnlineTotalSesi({});
      setLoading(false);
      return;
    }

    const [{ data }, onlineSchedRes] = await Promise.all([
      supabase
        .from('schedules')
        .select('id, group_id, hari, jam_mulai, jam_selesai, materi, lokasi, ruangan, pertemuan_ke, groups!group_id(id,nama,kode,warna,warna_text,tipe), teacher:profiles!teacher_id(id,display_name)')
        .in('group_id', allGroupIds)
        .eq('week_start', toISODate(weekStart))
        .order('jam_mulai'),
      onlineGroupIds.length > 0
        ? supabase.from('schedules').select('id, group_id').in('group_id', onlineGroupIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const totals: Record<string, number> = {};
    const onlineSchedIds = (onlineSchedRes.data ?? []).map((r: any) => r.id as string);
    if (onlineSchedIds.length > 0) {
      const { data: cancelledData } = await supabase
        .from('attendance')
        .select('schedule_id')
        .in('schedule_id', onlineSchedIds)
        .eq('person_role', 'teacher')
        .eq('sesi_status', 'dibatalkan');
      const cancelledSet = new Set((cancelledData ?? []).map((r: any) => r.schedule_id as string));
      (onlineSchedRes.data ?? []).forEach((r: any) => {
        if (!cancelledSet.has(r.id)) totals[r.group_id] = (totals[r.group_id] ?? 0) + 1;
      });
    }

    const scheduleIds = (data ?? []).map((s: any) => s.id as string);
    let cancelled = new Set<string>();
    if (scheduleIds.length > 0) {
      const { data: cData } = await supabase
        .from('attendance')
        .select('schedule_id')
        .in('schedule_id', scheduleIds)
        .eq('person_role', 'teacher')
        .eq('sesi_status', 'dibatalkan');
      cancelled = new Set((cData ?? []).map((r: any) => r.schedule_id as string));
    }

    setSchedules((data ?? []) as unknown as ScheduleRow[]);
    setOnlineTotalSesi(totals);
    setCancelledIds(cancelled);
    setLoading(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: 0, color: '#0D0D0D' }}>
          Jadwal Saya
        </h1>
        <WeekPicker weekStart={weekStart} onChange={setWeekStart} />
      </div>

      {loading ? (
        <p style={muted}>Memuat...</p>
      ) : schedules.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '14px', padding: '40px', textAlign: 'center', border: '1px solid #E2E1DC' }}>
          <p style={{ fontFamily: 'var(--font-body)', color: '#888', margin: 0, fontSize: '0.9rem' }}>
            Tidak ada sesi minggu ini.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {HARI.map((hari, idx) => {
            const daySessions = schedules.filter(s => s.hari === hari);
            if (daySessions.length === 0) return null;
            const isToday = isThisWeek && hari === todayHari;
            return (
              <div key={hari}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                  <h2 style={{
                    fontFamily: 'var(--font-display)', fontSize: '1.05rem', margin: 0,
                    color: isToday ? '#0D5C3A' : '#0D0D0D',
                  }}>
                    {hari}
                  </h2>
                  {isToday && (
                    <span style={{
                      padding: '2px 9px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700,
                      background: '#FFE500', color: '#0D5C3A', letterSpacing: '0.04em',
                    }}>
                      HARI INI
                    </span>
                  )}
                  <span style={muted}>{formatDayLabel(weekDays[idx])}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[...daySessions].sort((a, b) => {
                    const nowMin = nowWITAMinutes();
                    const [ah, am] = a.jam_selesai.split(':').map(Number);
                    const [bh, bm] = b.jam_selesai.split(':').map(Number);
                    const aEnded = (ah * 60 + am) < nowMin;
                    const bEnded = (bh * 60 + bm) < nowMin;
                    if (aEnded !== bEnded) return aEnded ? 1 : -1;
                    const [as2, am2] = a.jam_mulai.split(':').map(Number);
                    const [bs2, bm2] = b.jam_mulai.split(':').map(Number);
                    return (as2 * 60 + am2) - (bs2 * 60 + bm2);
                  }).map(s => {
                    const isOnline = s.groups.tipe === 'online';
                    const isCancelled = cancelledIds.has(s.id);
                    const totalSesi = isOnline ? (onlineTotalSesi[s.group_id] ?? 0) : null;
                    return (
                    <div key={s.id} style={{
                      background: isCancelled ? '#FFF8F8' : isOnline ? '#F0F9FF' : '#fff',
                      border: isCancelled ? '1.5px solid #FECACA' : isOnline ? '1.5px solid #BAE6FD' : '1px solid #E2E1DC',
                      borderLeft: isCancelled ? '3px solid #DC0A1E' : isToday ? `3px solid ${isOnline ? '#0369A1' : '#FFE500'}` : isOnline ? '3px solid #0369A1' : '1px solid #E2E1DC',
                      borderRadius: '14px',
                      padding: (isToday || isOnline || isCancelled) ? '14px 14px 14px 13px' : '14px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                      opacity: isCancelled ? 0.75 : 1,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          <GrupBadge nama={s.groups.nama} warna={s.groups.warna} warna_text={s.groups.warna_text} />
                          {isOnline && (
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: 700, color: '#0369A1', background: '#E0F2FE', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.05em' }}>
                              ONLINE
                            </span>
                          )}
                          {isCancelled && (
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: 700, color: '#DC0A1E', background: '#FECACA', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.05em' }}>
                              DIBATALKAN
                            </span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: '#0D0D0D', lineHeight: 1 }}>
                              {fmtTime(s.jam_mulai)}
                            </span>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#aaa' }}>
                              s/d {fmtTime(s.jam_selesai)}
                            </span>
                            {s.pertemuan_ke != null && (
                              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: isOnline ? '#0369A1' : '#888', marginLeft: 'auto', fontWeight: isOnline ? 700 : 400 }}>
                                Sesi ke-{s.pertemuan_ke}
                                {isOnline && totalSesi != null && ` dari ${totalSesi} dijadwalkan`}
                              </span>
                            )}
                          </div>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D', margin: '0 0 8px', fontWeight: 500 }}>
                            {s.materi ?? 'Materi belum diisi'}
                          </p>
                          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#555' }}>
                              {s.teacher?.display_name ?? 'Pengajar'}
                            </span>
                            {isOnline && s.lokasi ? (
                              <a
                                href={s.lokasi}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#0369A1', fontWeight: 700, textDecoration: 'none', background: '#E0F2FE', padding: '3px 10px', borderRadius: '5px' }}
                              >
                                Gabung Meet
                              </a>
                            ) : (s.lokasi || s.ruangan) ? (
                              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#0D5C3A', fontWeight: 600 }}>
                                {[s.lokasi, s.ruangan].filter(Boolean).join(' / ')}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#999', margin: 0 };
