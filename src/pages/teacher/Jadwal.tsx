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
  groups: { id: string; nama: string; kode: string; warna: string; warna_text: string; tipe: string };
};

export default function TeacherJadwal() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart());
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
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
      .select('id, hari, jam_mulai, jam_selesai, materi, lokasi, groups!group_id(id,nama,kode,warna,warna_text,tipe)')
      .eq('teacher_id', user!.id)
      .eq('week_start', toISODate(weekStart))
      .order('jam_mulai');
    setSchedules((data ?? []) as unknown as ScheduleRow[]);
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
                    {daySessions.map(s => {
                      const isOnline = s.groups.tipe === 'online';
                      return (
                      <div key={s.id} style={{ ...card, borderLeft: isOnline ? '3px solid #0369A1' : undefined, background: isOnline ? '#F0F9FF' : '#fff' }}>
                        <GrupBadge nama={s.groups.nama} warna={s.groups.warna} warna_text={s.groups.warna_text} />
                        {isOnline && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', fontWeight: 700, color: '#0369A1', background: '#E0F2FE', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.05em' }}>ONLINE</span>
                        )}
                        <span style={bold}>{fmtTime(s.jam_mulai)} – {fmtTime(s.jam_selesai)}</span>
                        <span style={normal}>{s.materi ?? '–'}</span>
                        {s.lokasi && <span style={muted}>@ {s.lokasi}</span>}
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
