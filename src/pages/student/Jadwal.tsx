import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { HARI, getWeekStart, getWeekDays, toISODate, formatDayLabel, fmtTime } from '../../lib/dates';
import WeekPicker from '../../components/shared/WeekPicker';
import GrupBadge from '../../components/shared/GrupBadge';

type ScheduleRow = {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string | null;
  lokasi: string | null;
  ruangan: string | null;
  pertemuan_ke: number | null;
  groups: { id: string; nama: string; kode: string; warna: string; warna_text: string };
  teacher: { id: string; display_name: string } | null;
};

function getTodayHari(): string {
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
}

export default function StudentJadwal() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart());
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
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

    const { data: sg } = await supabase
      .from('student_groups')
      .select('group_id')
      .eq('student_id', user!.id);

    const groupIds = (sg ?? []).map(x => x.group_id as string);

    if (groupIds.length === 0) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('schedules')
      .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, ruangan, pertemuan_ke, groups!group_id(id,nama,kode,warna,warna_text), teacher:profiles!teacher_id(id,display_name)')
      .in('group_id', groupIds)
      .eq('week_start', toISODate(weekStart))
      .order('jam_mulai');

    setSchedules((data ?? []) as unknown as ScheduleRow[]);
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
                    color: isToday ? '#0F1F6B' : '#0D0D0D',
                  }}>
                    {hari}
                  </h2>
                  {isToday && (
                    <span style={{
                      padding: '2px 9px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700,
                      background: '#FFE500', color: '#0F1F6B', letterSpacing: '0.04em',
                    }}>
                      HARI INI
                    </span>
                  )}
                  <span style={muted}>{formatDayLabel(weekDays[idx])}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {daySessions.map(s => (
                    <div key={s.id} style={{
                      background: '#fff',
                      border: isToday ? '1px solid #E2E1DC' : '1px solid #E2E1DC',
                      borderLeft: isToday ? '3px solid #FFE500' : '1px solid #E2E1DC',
                      borderRadius: '14px',
                      padding: isToday ? '14px 14px 14px 13px' : '14px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        <GrupBadge kode={s.groups.kode} warna={s.groups.warna} warna_text={s.groups.warna_text} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: '#0D0D0D', lineHeight: 1 }}>
                              {fmtTime(s.jam_mulai)}
                            </span>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#aaa' }}>
                              s/d {fmtTime(s.jam_selesai)}
                            </span>
                            {s.pertemuan_ke != null && (
                              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.72rem', color: '#888', marginLeft: 'auto' }}>
                                Pertemuan {s.pertemuan_ke}
                              </span>
                            )}
                          </div>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D', margin: '0 0 8px', fontWeight: 500 }}>
                            {s.materi ?? 'Materi belum diisi'}
                          </p>
                          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#999' }}>
                              {s.teacher?.display_name ?? 'Pengajar'}
                            </span>
                            {(s.lokasi || s.ruangan) && (
                              <span style={{
                                fontFamily: 'var(--font-body)', fontSize: '0.78rem',
                                color: '#0F1F6B', fontWeight: 600,
                              }}>
                                {[s.lokasi, s.ruangan].filter(Boolean).join(' / ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
