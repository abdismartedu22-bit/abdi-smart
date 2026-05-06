const items = [
  {
    n: '01',
    title: 'Mentor Alumni PTN',
    desc: 'Diajar kakak-kakak yang lulus dari UI, UGM, ITB, dan PTN terkemuka lainnya.',
  },
  {
    n: '02',
    title: 'Kelas Kecil & Fokus',
    desc: 'Max. 8 siswa per kelas grup. Mentor fokus ke setiap siswa, bukan ceramah satu arah.',
  },
  {
    n: '03',
    title: 'Tryout Rutin & Analisis',
    desc: 'Simulasi UTBK berkala, laporan skor detail per sub-tes tiap minggu.',
  },
  {
    n: '04',
    title: 'Jadwal Fleksibel',
    desc: 'Pagi, siang, sore -- kami menyesuaikan dengan rutinitas sekolahmu.',
  },
  {
    n: '05',
    title: '3 Lokasi Strategis',
    desc: 'Badak Agung, Trijata, dan Mahendradata. Mudah dijangkau dari seluruh Denpasar.',
  },
  {
    n: '06',
    title: 'Progress Report',
    desc: 'Orang tua dan siswa terima laporan perkembangan belajar setiap minggu.',
  },
];

export default function WhyUs() {
  return (
    <section
      id="keunggulan"
      style={{
        background: 'var(--color-navy)',
        padding: '100px 0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Dot grid overlay */}
      <div
        aria-hidden
        className="dot-grid"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.12,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.25) 1px, transparent 1px)',
          pointerEvents: 'none',
        }}
      />

      {/* Yellow circle decoration */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '-15%',
          right: '-10%',
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          border: '60px solid rgba(255,229,0,0.08)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '0 28px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: '64px' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: '0.7rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--color-yellow)',
              marginBottom: '12px',
            }}
          >
            Keunggulan
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
              letterSpacing: '-0.04em',
              lineHeight: 0.95,
              color: '#fff',
              maxWidth: '580px',
            }}
          >
            Kenapa pilih{' '}
            <span
              style={{
                background: 'var(--color-yellow)',
                color: 'var(--color-black)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              Abdi Smart?
            </span>
          </h2>
        </div>

        {/* Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '2px',
            borderRadius: '20px',
            overflow: 'hidden',
          }}
        >
          {items.map((item) => (
            <div
              key={item.n}
              style={{
                background: 'rgba(255,255,255,0.04)',
                padding: '32px 28px',
                transition: 'background 0.2s',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,229,0,0.07)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: '2.8rem',
                  letterSpacing: '-0.04em',
                  color: 'var(--color-yellow)',
                  opacity: 0.9,
                  lineHeight: 1,
                  marginBottom: '20px',
                }}
              >
                {item.n}
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  letterSpacing: '-0.02em',
                  color: '#fff',
                  marginBottom: '10px',
                  lineHeight: 1.2,
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.88rem',
                  color: 'rgba(255,255,255,0.55)',
                  lineHeight: 1.65,
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
