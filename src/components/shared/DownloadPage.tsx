import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getWeekStart, nextWeek, prevWeek, toISODate, formatWeekLabel } from '../../lib/dates';
import { startOfMonth, format } from 'date-fns';
import * as XLSX from 'xlsx';

type Group = { id: string; nama: string; kode: string };

type ReportType = 'jadwal' | 'absensi' | 'hasil-to';

export default function DownloadPage() {
  const { profile } = useAuth();
  const isStaff = profile?.role === 'staff';
  const [reportType, setReportType] = useState<ReportType>('absensi');
  const effectiveReportType: ReportType = isStaff ? 'absensi' : reportType;
  const [groups, setGroups] = useState<Group[]>([]);
  const [filterGroup, setFilterGroup] = useState('');
  const [loading, setLoading] = useState(false);

  // Jadwal params
  const [jadwalWeek, setJadwalWeek] = useState<Date>(() => getWeekStart());

  // Absensi params
  const [absenFrom, setAbsenFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [absenTo, setAbsenTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  // Hasil TO params
  const [toFrom, setToFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [toTo, setToTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [toType, setToType] = useState('');

  useEffect(() => {
    supabase.from('groups').select('id, nama, kode').order('nama').then(({ data }) => {
      setGroups((data ?? []) as Group[]);
    });
  }, []);

  async function downloadJadwal() {
    setLoading(true);
    const weekStartISO = toISODate(jadwalWeek);

    let q = supabase
      .from('schedules')
      .select('hari, jam_mulai, jam_selesai, materi, lokasi, week_start, groups!group_id(nama,kode), teacher:profiles!teacher_id(display_name)')
      .eq('week_start', weekStartISO)
      .order('hari')
      .order('jam_mulai');

    if (filterGroup) q = q.eq('group_id', filterGroup);

    const { data } = await q;
    const rows = data ?? [];

    const header = ['Hari', 'Grup', 'Jam Mulai', 'Jam Selesai', 'Materi', 'Pengajar', 'Lokasi'];
    const body = rows.map((r: any) => [
      r.hari,
      r.groups ? `[${r.groups.kode}] ${r.groups.nama}` : '-',
      r.jam_mulai?.substring(0, 5) ?? '-',
      r.jam_selesai?.substring(0, 5) ?? '-',
      r.materi ?? '-',
      r.teacher?.display_name ?? '-',
      r.lokasi ?? '-',
    ]);

    writeExcel([header, ...body], 'Jadwal', `Jadwal_${weekStartISO}.xlsx`);
    setLoading(false);
  }

  async function downloadAbsensi() {
    setLoading(true);

    // If group filter is set, first get schedule IDs for that group
    let scheduleIds: string[] | null = null;
    if (filterGroup) {
      const { data: scheds } = await supabase
        .from('schedules')
        .select('id')
        .eq('group_id', filterGroup);
      scheduleIds = (scheds ?? []).map((s: any) => s.id as string);
    }

    let q = supabase
      .from('attendance')
      .select(`
        session_date, status, person_role, checkin_at,
        schedule:schedules!schedule_id(hari, jam_mulai, jam_selesai, materi, groups!group_id(nama,kode)),
        person:profiles!person_id(display_name)
      `)
      .eq('person_role', 'student')
      .gte('session_date', absenFrom)
      .lte('session_date', absenTo)
      .order('session_date')
      .order('schedule_id');

    if (scheduleIds !== null) {
      if (scheduleIds.length === 0) {
        writeExcel([['Tidak ada data untuk grup ini.']], 'Absensi', `Absensi_${absenFrom}_sd_${absenTo}.xlsx`);
        setLoading(false);
        return;
      }
      q = q.in('schedule_id', scheduleIds);
    }

    const { data } = await q;
    const rows = (data ?? []) as any[];

    const header = ['Tanggal', 'Hari', 'Grup', 'Materi', 'Jam', 'Nama Siswa', 'Status', 'Check-in'];
    const body = rows.map((r: any) => {
      const dateLabel = new Date(r.session_date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      return [
        dateLabel,
        r.schedule?.hari ?? '-',
        r.schedule?.groups ? `[${r.schedule.groups.kode}] ${r.schedule.groups.nama}` : '-',
        r.schedule?.materi ?? '-',
        r.schedule?.jam_mulai?.substring(0, 5) ?? '-',
        r.person?.display_name ?? '-',
        (r.status ?? '-').toUpperCase(),
        r.checkin_at ? new Date(r.checkin_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
      ];
    });

    writeExcel([header, ...body], 'Absensi', `Absensi_${absenFrom}_sd_${absenTo}.xlsx`);
    setLoading(false);
  }

  async function downloadHasilTO() {
    setLoading(true);

    let q = supabase
      .from('tryout_results')
      .select('type, nama_to, tanggal_to, scores, total_score, student:profiles!student_id(display_name)')
      .gte('tanggal_to', toFrom)
      .lte('tanggal_to', toTo)
      .order('tanggal_to', { ascending: false });

    if (toType) q = q.eq('type', toType);

    const { data } = await q;
    const rows = (data ?? []) as any[];

    const header = ['Tanggal', 'Nama TO', 'Jenis', 'Siswa', 'Total', 'PU/Mat', 'PPU/Fis', 'PBM/Kim', 'PK/Bio', 'LBI/Geo', 'LBE/Sej', 'PM/Sos', 'Eko'];
    const body = rows.map((r: any) => {
      const dateLabel = new Date(r.tanggal_to + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      const s = r.scores ?? {};
      return [
        dateLabel, r.nama_to, r.type, r.student?.display_name ?? '-',
        typeof r.total_score === 'number' ? r.total_score.toFixed(2) : '-',
        s.pu ?? s.mat ?? '-', s.ppu ?? s.fis ?? '-', s.pbm ?? s.kim ?? '-',
        s.pk ?? s.bio ?? '-', s.lbi ?? s.geo ?? '-', s.lbe ?? s.sej ?? '-',
        s.pm ?? s.sos ?? '-', s.eko ?? '-',
      ];
    });

    writeExcel([header, ...body], 'Hasil TO', `HasilTO_${toFrom}_sd_${toTo}.xlsx`);
    setLoading(false);
  }

  function writeExcel(data: any[][], sheetName: string, filename: string) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  }

  function handleDownload() {
    if (effectiveReportType === 'jadwal') downloadJadwal();
    else if (effectiveReportType === 'absensi') downloadAbsensi();
    else downloadHasilTO();
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', margin: '0 0 24px', color: '#0D0D0D' }}>
        Download Laporan
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '560px' }}>

        {/* Report type selector */}
        <div style={card}>
          <label style={labelStyle}>Jenis Laporan</label>
          {isStaff ? (
            <div style={{ padding: '9px 12px', border: '1.5px solid #E2E1DC', borderRadius: '8px', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#0D0D0D', background: '#F9F9F7' }}>
              Rekap Absensi
            </div>
          ) : (
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value as ReportType)}
              style={selectStyle}
            >
              <option value="absensi">Rekap Absensi</option>
              <option value="jadwal">Jadwal Mingguan</option>
              <option value="hasil-to">Hasil Tryout</option>
            </select>
          )}
        </div>

        {/* Parameters */}
        <div style={card}>
          <p style={sectionLabel}>Parameter</p>

          {effectiveReportType === 'jadwal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Minggu</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => setJadwalWeek(prevWeek(jadwalWeek))} style={weekBtn}>&lt;</button>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: '#0D0D0D', minWidth: '160px', textAlign: 'center' }}>
                    {formatWeekLabel(jadwalWeek)}
                  </span>
                  <button onClick={() => setJadwalWeek(nextWeek(jadwalWeek))} style={weekBtn}>&gt;</button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Grup (opsional)</label>
                <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={selectStyle}>
                  <option value="">Semua Grup</option>
                  {groups.map(g => <option key={g.id} value={g.id}>[{g.kode}] {g.nama}</option>)}
                </select>
              </div>
            </div>
          )}

          {effectiveReportType === 'absensi' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Dari</label>
                  <input type="date" value={absenFrom} onChange={e => setAbsenFrom(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={labelStyle}>Sampai</label>
                  <input type="date" value={absenTo} onChange={e => setAbsenTo(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Grup (opsional)</label>
                <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={selectStyle}>
                  <option value="">Semua Grup</option>
                  {groups.map(g => <option key={g.id} value={g.id}>[{g.kode}] {g.nama}</option>)}
                </select>
              </div>
            </div>
          )}

          {effectiveReportType === 'hasil-to' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Dari</label>
                  <input type="date" value={toFrom} onChange={e => setToFrom(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={labelStyle}>Sampai</label>
                  <input type="date" value={toTo} onChange={e => setToTo(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Jenis TO (opsional)</label>
                <select value={toType} onChange={e => setToType(e.target.value)} style={selectStyle}>
                  <option value="">Semua Jenis</option>
                  <option value="SNBT">SNBT</option>
                  <option value="TKA">TKA</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '10px 14px' }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#9A3412', margin: 0 }}>
            File ini mungkin berisi data pribadi siswa. Mohon untuk tidak membagikan sembarangan.
          </p>
        </div>

        <button
          onClick={handleDownload}
          disabled={loading}
          style={{ padding: '12px 24px', background: loading ? '#6B7280' : '#0D5C3A', color: '#fff', border: 'none', borderRadius: '9px', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem' }}
        >
          {loading ? 'Menyiapkan...' : 'Download Excel'}
        </button>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E1DC', borderRadius: '10px', padding: '18px',
};
const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 700, color: '#666',
  margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: '0.82rem', fontWeight: 600, color: '#2E2E2E',
  display: 'block', marginBottom: '4px',
};
const inputStyle: React.CSSProperties = {
  padding: '9px 11px', border: '1.5px solid #E2E1DC', borderRadius: '8px',
  fontFamily: 'var(--font-body)', fontSize: '0.88rem', outline: 'none',
  color: '#0D0D0D', background: '#fff',
};
const selectStyle: React.CSSProperties = {
  padding: '9px 12px', border: '1.5px solid #E2E1DC', borderRadius: '8px',
  fontFamily: 'var(--font-body)', fontSize: '0.85rem', background: '#fff', color: '#0D0D0D',
  outline: 'none', cursor: 'pointer', width: '100%',
};
const weekBtn: React.CSSProperties = {
  padding: '6px 12px', background: '#F3F2EE', color: '#0D0D0D',
  border: '1px solid #E2E1DC', borderRadius: '6px', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem',
};
