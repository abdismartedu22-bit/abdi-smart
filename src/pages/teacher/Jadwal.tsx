import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { HARI, getWeekStart, getWeekDays, toISODate, formatDayLabel, fmtTime, nowWITAMinutes } from '../../lib/dates';
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
  groups: { id: string; nama: string; kode: string; warna: string; warna_text: string; tipe: string };
};

export default function TeacherJadwal() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart());
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const weekDays = getWeekDays(weekStart);

  useEffect(() => {
    if (!user) return;
    load();
  }, [weekStart, user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('schedules')
      .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, ruangan, groups!group_id(id,nama,kode,warna,warna_text,tipe)')
      .eq('teacher_id', user!.id)
      .eq('week_start', toISODate(weekStart))
      .order('jam_mulai');
    setSchedules((data ?? []) as unknown as ScheduleRow[]);

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
    setCancelledIds(cancelled);
    setLoading(false);
  }

  const total = schedules.length;

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
      ) : (
        <>
          <p style={{ ...muted, marginBottom: '20px' }}>
            {total === 0 ? 'Tidak ada sesi minggu ini.' : `${total} sesi minggu ini.`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {HARI.map((hari, idx) => {
              const daySessions = schedules.filter(s => s.hari === hari);
              if (daySessions.length === 0) return null;
              return (
                <div key={hari}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', marginBottom: '8px' }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', margin: 0 }}>{hari}</h2>
                    <span style={muted}>{formatDayLabel(weekDays[idx])}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                      return (
                      <div key={s.id} style={{
                        ...card,
                        background: isCancelled ? '#FFF8F8' : isOnline ? '#F0F9FF' : '#fff',
                        border: isCancelled ? '1.5px solid #FECACA' : '1px solid #E2E1DC',
                        borderLeft: isCancelled ? '3px solid #DC0A1E' : isOnline ? '3px solid #0369A1' : undefined,
                        opacity: isCancelled ? 0.75 : 1,
                      }}>
                        <GrupBadge nama={s.groups.nama} warna={s.groups.warna} warna_text={s.groups.warna_text} />
                        {isOnline && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: 700, color: '#0369A1', background: '#E0F2FE', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.05em' }}>ONLINE</span>
                        )}
                        {isCancelled && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: 700, color: '#DC0A1E', background: '#FECACA', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.05em' }}>DIBATALKAN</span>
                        )}
                        <span style={bold}>{fmtTime(s.jam_mulai)} – {fmtTime(s.jam_selesai)}</span>
                        <span style={normal}>{s.materi ?? '–'}</span>
                        {isOnline && s.lokasi ? (
                          <a href={s.lokasi} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#0369A1', fontWeight: 700, textDecoration: 'none', background: '#E0F2FE', padding: '3px 10px', borderRadius: '5px' }}>
                            Gabung Meet
                          </a>
                        ) : (s.lokasi || s.ruangan) ? (
                          <span style={muted}>@ {[s.lokasi, s.ruangan].filter(Boolean).join(' / ')}</span>
                        ) : null}
                      </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {total > 0 && (
            <p style={{ ...muted, marginTop: '24px' }}>
              Perubahan jadwal: hubungi staff.
            </p>
          )}
        </>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '8px',
  padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
};
const muted: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#666', margin: 0 };
const bold: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 700, color: '#0D0D0D' };
const normal: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D' };
