export type Sesi = {
  hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu' | 'Minggu';
  jam: string;       // e.g. "16.00 – 17.30"
  materi: string;
  lokasi: string;
  mentor: string;
};

export type Grup = {
  id: string;
  nama: string;
  kode: string;      // short code shown on badge
  warna: string;     // CSS color for accent
  warnaText: string; // text color on top of warna
  sesi: Sesi[];
};

// ─── EDIT SCHEDULES HERE EACH WEEK ────────────────────────────────────────────
export const mingguIni = {
  mulai: '5 Mei 2026',
  selesai: '11 Mei 2026',
};

export const jadwal: Grup[] = [
  {
    id: 'merah',
    nama: 'Grup Merah',
    kode: 'GR',
    warna: '#DC0A1E',
    warnaText: '#fff',
    sesi: [
      {
        hari: 'Senin',
        jam: '15.30 – 17.00',
        materi: 'TPS – Penalaran Umum',
        lokasi: 'AS Badak Agung',
        mentor: 'Kak Rian',
      },
      {
        hari: 'Rabu',
        jam: '15.30 – 17.00',
        materi: 'TPS – Pengetahuan Kuantitatif',
        lokasi: 'AS Badak Agung',
        mentor: 'Kak Rian',
      },
      {
        hari: 'Jumat',
        jam: '15.30 – 17.00',
        materi: 'TPS – Literasi Bahasa Indonesia',
        lokasi: 'AS Badak Agung',
        mentor: 'Kak Sari',
      },
    ],
  },
  {
    id: 'biru',
    nama: 'Grup Biru',
    kode: 'GB',
    warna: '#0F1F6B',
    warnaText: '#fff',
    sesi: [
      {
        hari: 'Selasa',
        jam: '16.00 – 17.30',
        materi: 'Matematika – Turunan & Integral',
        lokasi: 'AS Trijata',
        mentor: 'Kak Dewa',
      },
      {
        hari: 'Kamis',
        jam: '16.00 – 17.30',
        materi: 'Fisika – Gelombang',
        lokasi: 'AS Trijata',
        mentor: 'Kak Dewa',
      },
      {
        hari: 'Sabtu',
        jam: '09.00 – 10.30',
        materi: 'Kimia – Reaksi Redoks',
        lokasi: 'AS Trijata',
        mentor: 'Kak Ayu',
      },
    ],
  },
  {
    id: 'hijau',
    nama: 'Grup Hijau',
    kode: 'GH',
    warna: '#1A6B3C',
    warnaText: '#fff',
    sesi: [
      {
        hari: 'Senin',
        jam: '17.00 – 18.30',
        materi: 'Ekonomi – Pasar & Harga',
        lokasi: 'AS Mahendradata',
        mentor: 'Kak Widi',
      },
      {
        hari: 'Rabu',
        jam: '17.00 – 18.30',
        materi: 'Geografi – Dinamika Atmosfer',
        lokasi: 'AS Mahendradata',
        mentor: 'Kak Widi',
      },
      {
        hari: 'Sabtu',
        jam: '10.30 – 12.00',
        materi: 'Sosiologi – Kelompok Sosial',
        lokasi: 'AS Mahendradata',
        mentor: 'Kak Tari',
      },
    ],
  },
  {
    id: 'kuning',
    nama: 'Grup Kuning',
    kode: 'GK',
    warna: '#B08800',
    warnaText: '#fff',
    sesi: [
      {
        hari: 'Selasa',
        jam: '14.00 – 15.30',
        materi: 'TPS – Penalaran Umum + Literasi',
        lokasi: 'AS Badak Agung',
        mentor: 'Kak Sari',
      },
      {
        hari: 'Kamis',
        jam: '14.00 – 15.30',
        materi: 'Bahasa Indonesia – Teks Argumentasi',
        lokasi: 'AS Badak Agung',
        mentor: 'Kak Sari',
      },
      {
        hari: 'Minggu',
        jam: '09.00 – 11.00',
        materi: 'Tryout UTBK – Full Simulasi',
        lokasi: 'AS Trijata',
        mentor: 'Tim AS',
      },
    ],
  },
];

// ─── HARI ORDER ────────────────────────────────────────────────────────────────
export const hariOrder: Sesi['hari'][] = [
  'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu',
];
