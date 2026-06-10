import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getWeekStart, nextWeek, prevWeek, toISODate, formatWeekLabel } from '../../lib/dates';
import { startOfMonth, format } from 'date-fns';
import * as XLSX from 'xlsx';

type Group = { id: string; nama: string; kode: string };
type ReportType = 'jadwal' | 'absensi' | 'hasil-to' | 'kelas' | 'gedung';
type Merge = { s: { r: number; c: number }; e: { r: number; c: number } };

const SNBT_FIELDS = [
  { key: 'pu',  label: 'PU' },
  { key: 'pk',  label: 'PK' },
  { key: 'ppu', label: 'PPU' },
  { key: 'pbm', label: 'PBM' },
  { key: 'lbi', label: 'LBI' },
  { key: 'lba', label: 'LBA' },
  { key: 'pm',  label: 'PNM' },
];

const TKA_FIELDS = [
  { key: 'ind',    label: 'BAHASA INDONESIA' },
  { key: 'matwa',  label: 'MATEMATIKA WAJIB' },
  { key: 'ing',    label: 'BAHASA INGGRIS' },
  { key: 'fis',    label: 'FISIKA' },
  { key: 'kim',    label: 'KIMIA' },
  { key: 'bio',    label: 'BIOLOGI' },
  { key: 'matlan', label: 'MATEMATIKA LANJUT' },
  { key: 'eko',    label: 'EKONOMI' },
  { key: 'sos',    label: 'SOSIOLOGI' },
  { key: 'sej',    label: 'SEJARAH' },
  { key: 'geo',    label: 'GEOGRAFI' },
  { key: 'indlan', label: 'BAHASA INDONESIA LANJUT' },
  { key: 'inglan', label: 'BAHASA INGGRIS LANJUT' },
];

const HARI_OFFSET: Record<string, number> = { Senin: 0, Selasa: 1, Rabu: 2, Kamis: 3, Jumat: 4, Sabtu: 5, Minggu: 6 };
const HARI_ABB: Record<string, string>   = { Senin: 'SN', Selasa: 'SL', Rabu: 'RB', Kamis: 'KM', Jumat: 'JM', Sabtu: 'SB', Minggu: 'MG' };
const HARI_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

function fmtTanggal(weekStart: string, hari: string) {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + (HARI_OFFSET[hari] ?? 0));
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtSessionDate(sessionDate: string) {
  return new Date(sessionDate + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DownloadPage() {
  const { profile } = useAuth();
  const isStaff = profile?.role === 'staff';
  const [reportType, setReportType] = useState<ReportType>('absensi');
  const effectiveReportType: ReportType = isStaff ? 'absensi' : reportType;
  const [groups, setGroups] = useState<Group[]>([]);
  const [filterGroup, setFilterGroup] = useState('');
  const [loading, setLoading] = useState(false);

  const [jadwalWeek, setJadwalWeek] = useState<Date>(() => getWeekStart());
  const [absenFrom, setAbsenFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [absenTo, setAbsenTo]     = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [toFrom, setToFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [toTo, setToTo]     = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [toType, setToType] = useState('');

  useEffect(() => {
    supabase.from('groups').select('id, nama, kode').order('nama').then(({ data }) => {
      setGroups((data ?? []) as Group[]);
    });
  }, []);

  // ── JADWAL ──────────────────────────────────────────────────────────────────
  async function downloadJadwal() {
    setLoading(true);
    const weekStartISO = toISODate(jadwalWeek);

    let q = supabase
      .from('schedules')
      .select('hari, jam_mulai, jam_selesai, materi, lokasi, ruangan, pertemuan_ke, week_start, groups!group_id(nama,kode), teacher:profiles!teacher_id(display_name)')
      .eq('week_start', weekStartISO)
      .order('hari')
      .order('jam_mulai');

    if (filterGroup) q = q.eq('group_id', filterGroup);

    const { data } = await q;
    const rows = (data ?? []) as any[];

    const header = ['No', 'Hari', 'Tanggal', 'Kode Kelas', 'Nama Kelas', 'Jam Mulai', 'Jam Selesai', 'Nama Pengajar', 'Mata Pelajaran', 'Pertemuan ke', 'Lokasi', 'Ruangan'];
    const body = rows.map((r: any, i: number) => [
      i + 1,
      r.hari ?? '-',
      fmtTanggal(r.week_start, r.hari),
      r.groups?.kode ?? '-',
      r.groups?.nama ?? '-',
      r.jam_mulai?.substring(0, 5) ?? '-',
      r.jam_selesai?.substring(0, 5) ?? '-',
      r.teacher?.display_name ?? '-',
      r.materi ?? '-',
      r.pertemuan_ke ?? '-',
      r.lokasi ?? '-',
      r.ruangan ?? '-',
    ]);

    writeExcel([header, ...body], 'INPUT JADWAL', `InputJadwal_${weekStartISO}.xlsx`);
    setLoading(false);
  }

  // ── REALISASI ────────────────────────────────────────────────────────────────
  async function downloadAbsensi() {
    setLoading(true);

    let scheduleIds: string[] | null = null;
    if (filterGroup) {
      const { data: scheds } = await supabase.from('schedules').select('id').eq('group_id', filterGroup);
      scheduleIds = (scheds ?? []).map((s: any) => s.id as string);
      if (scheduleIds.length === 0) {
        writeExcel([['Tidak ada data untuk grup ini.']], 'REALISASI', `Realisasi_${absenFrom}_sd_${absenTo}.xlsx`);
        setLoading(false);
        return;
      }
    }

    let q = supabase
      .from('attendance')
      .select(`
        schedule_id, session_date, status,
        schedule:schedules!schedule_id(hari, jam_mulai, jam_selesai, materi, lokasi, ruangan, pertemuan_ke, week_start, groups!group_id(nama,kode), teacher:profiles!teacher_id(display_name))
      `)
      .eq('person_role', 'student')
      .gte('session_date', absenFrom)
      .lte('session_date', absenTo)
      .order('session_date')
      .order('schedule_id');

    if (scheduleIds !== null) q = q.in('schedule_id', scheduleIds);

    const { data } = await q;
    const rows = (data ?? []) as any[];

    // Group by session (schedule_id + session_date), count total and hadir
    const sessionMap = new Map<string, { row: any; sched: any; total: number; hadir: number }>();
    for (const row of rows) {
      const key = `${row.schedule_id}__${row.session_date}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, { row, sched: row.schedule ?? {}, total: 0, hadir: 0 });
      }
      const entry = sessionMap.get(key)!;
      entry.total++;
      if (row.status === 'hadir') entry.hadir++;
    }

    const header = ['No', 'Hari', 'Tanggal', 'Kode Kelas', 'Nama Kelas', 'Jam Mulai', 'Jam Selesai', 'Nama Pengajar', 'Mata Pelajaran', 'Pertemuan ke', 'Lokasi', 'Ruangan', 'JUMSIS', 'JUMLAH HADIR'];
    let no = 1;
    const body: any[][] = [];
    for (const { row, sched, total, hadir } of sessionMap.values()) {
      const grp = sched.groups ?? {};
      body.push([
        no++,
        sched.hari ?? '-',
        fmtSessionDate(row.session_date),
        grp.kode ?? '-',
        grp.nama ?? '-',
        sched.jam_mulai?.substring(0, 5) ?? '-',
        sched.jam_selesai?.substring(0, 5) ?? '-',
        sched.teacher?.display_name ?? '-',
        sched.materi ?? '-',
        sched.pertemuan_ke ?? '-',
        sched.lokasi ?? '-',
        sched.ruangan ?? '-',
        total,
        hadir,
      ]);
    }

    writeExcel([header, ...body], 'REALISASI', `Realisasi_${absenFrom}_sd_${absenTo}.xlsx`);
    setLoading(false);
  }

  // ── HASIL TO ─────────────────────────────────────────────────────────────────
  async function downloadHasilTO() {
    setLoading(true);

    let q = supabase
      .from('tryout_results')
      .select('type, nama_to, tanggal_to, scores, total_score, student:profiles!student_id(display_name, username)')
      .gte('tanggal_to', toFrom)
      .lte('tanggal_to', toTo)
      .order('tanggal_to', { ascending: false });

    if (toType) q = q.eq('type', toType);

    const { data } = await q;
    const rows = (data ?? []) as any[];

    const snbtRows = rows.filter(r => r.type === 'SNBT');
    const tkaRows  = rows.filter(r => r.type === 'TKA');

    const wb = XLSX.utils.book_new();

    if (toType !== 'TKA') {
      const { sheetData, merges } = buildSnbtSheet(snbtRows);
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!merges'] = merges;
      XLSX.utils.book_append_sheet(wb, ws, 'TABEL TO SNBT');
    }

    if (toType !== 'SNBT') {
      const { sheetData, merges } = buildTkaSheet(tkaRows);
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!merges'] = merges;
      XLSX.utils.book_append_sheet(wb, ws, 'HASIL TO TKA');
    }

    XLSX.writeFile(wb, `HasilTO_${toFrom}_sd_${toTo}.xlsx`);
    setLoading(false);
  }

  function buildSnbtSheet(rows: any[]): { sheetData: any[][]; merges: Merge[] } {
    // Row 0: NIS, Nama, [subtest merged over B/S/K cols, SKOR col], ..., RATA-RATA
    // Row 1: "",  "",   [B, S, K, ""], ..., ""
    const headerRow0: any[] = ['NIS', 'Nama'];
    const headerRow1: any[] = ['', ''];
    const merges: Merge[] = [];

    SNBT_FIELDS.forEach((f, i) => {
      const startCol = 2 + i * 4;
      headerRow0.push(f.label, '', '', 'SKOR');
      headerRow1.push('B', 'S', 'K', '');
      merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + 2 } });
    });
    headerRow0.push('RATA-RATA');
    headerRow1.push('');

    const dataRows = rows.map(r => {
      const s = r.scores ?? {};
      const row: any[] = [r.student?.username ?? '-', r.student?.display_name ?? '-'];
      for (const f of SNBT_FIELDS) {
        const skor = s[f.key];
        const taken = skor !== undefined && skor !== null && skor !== '' && skor !== '-';
        row.push(
          taken ? (s[f.key + '_b'] ?? '-') : '-',
          taken ? (s[f.key + '_s'] ?? '-') : '-',
          taken ? (s[f.key + '_k'] ?? '-') : '-',
          taken ? Number(skor).toFixed(2) : '-',
        );
      }
      row.push(typeof r.total_score === 'number' ? r.total_score.toFixed(2) : '-');
      return row;
    });

    return { sheetData: [headerRow0, headerRow1, ...dataRows], merges };
  }

  function buildTkaSheet(rows: any[]): { sheetData: any[][]; merges: Merge[] } {
    // Row 0: ID, NIS, NAMA, [subject merged over B/S/K/N cols], ...
    // Row 1: "",  "",  "",  [B, S, K, N], ...
    const headerRow0: any[] = ['ID', 'NIS', 'NAMA'];
    const headerRow1: any[] = ['', '', ''];
    const merges: Merge[] = [];

    TKA_FIELDS.forEach((f, i) => {
      const startCol = 3 + i * 4;
      headerRow0.push(f.label, '', '', '');
      headerRow1.push('B', 'S', 'K', 'N');
      merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + 3 } });
    });

    const dataRows = rows.map((r, idx) => {
      const s = r.scores ?? {};
      const row: any[] = [idx + 1, r.student?.username ?? '-', r.student?.display_name ?? '-'];
      for (const f of TKA_FIELDS) {
        const skor = s[f.key];
        const taken = skor !== undefined && skor !== null && skor !== '' && skor !== '-';
        row.push(
          taken ? (s[f.key + '_b'] ?? '-') : '-',
          taken ? (s[f.key + '_s'] ?? '-') : '-',
          taken ? (s[f.key + '_k'] ?? '-') : '-',
          taken ? Number(skor) : '-',
        );
      }
      return row;
    });

    return { sheetData: [headerRow0, headerRow1, ...dataRows], merges };
  }

  // ── KELAS ────────────────────────────────────────────────────────────────────
  async function downloadKelas() {
    setLoading(true);

    const [groupsRes, sgRes, schedRes, realisasiRes] = await Promise.all([
      supabase.from('groups').select('id, kode, nama, sekolah, paket').eq('active', true).order('kode'),
      supabase.from('student_groups').select('group_id'),
      supabase.from('schedules').select('group_id, hari, lokasi'),
      supabase.from('attendance')
        .select('schedule_id, session_date, schedule:schedules!schedule_id(group_id)')
        .eq('person_role', 'teacher')
        .eq('sesi_status', 'terlaksana'),
    ]);

    const allGroups    = (groupsRes.data ?? []) as any[];
    const allSG        = (sgRes.data ?? []) as any[];
    const allScheds    = (schedRes.data ?? []) as any[];
    const allRealisasi = (realisasiRes.data ?? []) as any[];

    const studentCount: Record<string, number> = {};
    for (const sg of allSG) studentCount[sg.group_id] = (studentCount[sg.group_id] ?? 0) + 1;

    const hariMap: Record<string, Set<string>> = {};
    const lokasiMap: Record<string, string> = {};
    for (const s of allScheds) {
      if (!hariMap[s.group_id]) hariMap[s.group_id] = new Set();
      hariMap[s.group_id].add(s.hari);
      if (s.lokasi && !lokasiMap[s.group_id]) lokasiMap[s.group_id] = s.lokasi;
    }

    const realisasiSet: Record<string, Set<string>> = {};
    for (const r of allRealisasi) {
      const gid = r.schedule?.group_id;
      if (!gid) continue;
      if (!realisasiSet[gid]) realisasiSet[gid] = new Set();
      realisasiSet[gid].add(`${r.schedule_id}__${r.session_date}`);
    }

    const header = ['', 'NAMA', 'Sekolah', 'Jumlah', 'Lokasi', 'Hari Belajar 1', 'Paket', 'REALISASI', 'SISA'];
    const body = allGroups.map((g: any) => {
      const jumlah    = studentCount[g.id] ?? 0;
      const lokasi    = lokasiMap[g.id] ?? '-';
      const hariSet   = hariMap[g.id] ?? new Set<string>();
      const hariBelajar = HARI_ORDER.filter(h => hariSet.has(h)).map(h => HARI_ABB[h]).join('-') || '-';
      const paket     = g.paket ?? 0;
      const realisasi = realisasiSet[g.id]?.size ?? 0;
      return [g.kode, g.nama, g.sekolah ?? '-', jumlah, lokasi, hariBelajar, paket, realisasi, paket - realisasi];
    });

    writeExcel([header, ...body], 'KELAS', `Kelas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    setLoading(false);
  }

  // ── GEDUNG ───────────────────────────────────────────────────────────────────
  async function downloadGedung() {
    setLoading(true);
    const { data } = await supabase.from('gedung').select('nama, ruangan, kapasitas, status').order('nama');
    const rows = (data ?? []) as any[];
    const header = ['No', 'Nama', 'Ruangan', 'Kapasitas', 'Status'];
    const body = rows.map((r: any, i: number) => [i + 1, r.nama, r.ruangan, r.kapasitas, r.status]);
    writeExcel([header, ...body], 'Gedung', `Gedung_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    setLoading(false);
  }

  function writeExcel(data: any[][], sheetName: string, filename: string) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  }

  function handleDownload() {
    if (effectiveReportType === 'jadwal')   downloadJadwal();
    else if (effectiveReportType === 'absensi')   downloadAbsensi();
    else if (effectiveReportType === 'hasil-to')  downloadHasilTO();
    else if (effectiveReportType === 'kelas')     downloadKelas();
    else                                           downloadGedung();
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
              Rekap Realisasi
            </div>
          ) : (
            <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} style={selectStyle}>
              <option value="absensi">Rekap Realisasi</option>
              <option value="jadwal">Input Jadwal</option>
              <option value="hasil-to">Hasil Tryout</option>
              <option value="kelas">Data Kelas</option>
              <option value="gedung">Data Gedung</option>
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
                  {groups.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
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
                  {groups.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
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

          {(effectiveReportType === 'kelas' || effectiveReportType === 'gedung') && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#666', margin: 0 }}>
              {effectiveReportType === 'kelas'
                ? 'Mengunduh semua kelas aktif beserta data realisasi dan sisa sesi.'
                : 'Mengunduh seluruh data gedung dan ruangan.'}
            </p>
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
