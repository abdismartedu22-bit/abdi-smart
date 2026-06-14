const programs = [
  {
    tag: 'Privat',
    title: 'Les\nPrivat',
    desc: 'Sesi 1-on-1 eksklusif. Jadwal fleksibel, materi personal sesuai target dan kelemahan kamu.',
    features: ['Jadwal fleksibel', 'Materi personal', 'Latihan soal mingguan'],
    topColor: 'var(--color-yellow)',
    tagBg: 'var(--color-yellow)',
    tagText: 'var(--color-black)',
  },
  {
    tag: 'Grup',
    title: 'Les\nGrup',
    desc: 'Kelas kecil max. 8 siswa. Kompetitif, interaktif, lebih terjangkau tanpa mengorbankan kualitas.',
    features: ['Maks. 8 siswa', 'Simulasi ujian sesuai tingkatan kelas', 'Diskusi aktif'],
    topColor: 'var(--color-red)',
    tagBg: 'var(--color-red)',
    tagText: '#fff',
  },
  {
    tag: 'TPS',
    title: 'Intensif\n TKA &\nUTBK SNBT',
    desc: 'Fokus Tes Potensi Skolastik & Literasi lengkap.',
    features: ['Soal relevan', 'Analisis skor', 'Tryout berkala'],
    topColor: 'var(--color-navy)',
    tagBg: 'var(--color-navy)',
    tagText: '#fff',
  },
  {
    tag: 'Mapel',
    title: 'Mata\nPelajaran',
    desc: 'Pendalaman bidang studi sesuai jurusan impian: Matematika, Kimia, Fisika, Biologi, Ekonomi, Geografi, dan Sosiologi, Bahasa Indonesia, Bahasa Inggris.',
    features: ['IPA & IPS', 'Dari dasar', 'Sesuai kurikulum'],
    topColor: 'var(--color-black)',
    tagBg: 'var(--color-black)',
    tagText: '#fff',
  },
];

export default function Services() {
  return (
    <section id="program" style={{ background: 'var(--color-surface)', padding: '100px 0' }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '0 28px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '24px',
            marginBottom: '60px',
          }}
        >
          <div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: '0.7rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-red)',
                marginBottom: '12px',
              }}
            >
              Program Belajar
            </p>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
                letterSpacing: '-0.04em',
                lineHeight: 0.95,
                color: 'var(--color-black)',
              }}
            >
              Pilih yang
              <br />
              <span className="mark">cocok</span> untukmu.
            </h2>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.95rem',
              color: 'var(--color-gray)',
              maxWidth: '300px',
              lineHeight: 1.7,
            }}
          >
            Setiap program dirancang untuk memaksimalkan peluang lolos SNBP dan SNBT.
          </p>
        </div>

        {/* Card grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '14px',
          }}
        >
          {programs.map((p) => (
            <div
              key={p.tag}
              className="lift"
              style={{
                background: 'var(--color-white)',
                borderRadius: '20px',
                overflow: 'hidden',
                border: '1px solid var(--color-border)',
              }}
            >
              {/* Thick top color bar */}
              <div style={{ height: '8px', background: p.topColor }} />

              <div style={{ padding: '28px 24px 26px' }}>
                {/* Tag */}
                <span
                  style={{
                    display: 'inline-block',
                    background: p.tagBg,
                    color: p.tagText,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: '0.62rem',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    padding: '4px 11px',
                    borderRadius: '6px',
                    marginBottom: '18px',
                  }}
                >
                  {p.tag}
                </span>

                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: '1.9rem',
                    letterSpacing: '-0.04em',
                    lineHeight: 1.0,
                    color: 'var(--color-black)',
                    marginBottom: '14px',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {p.title}
                </h3>

                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.88rem',
                    color: 'var(--color-gray)',
                    lineHeight: 1.68,
                    marginBottom: '22px',
                  }}
                >
                  {p.desc}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {p.features.map((f) => (
                    <div
                      key={f}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '9px',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.83rem',
                        fontWeight: 500,
                        color: 'var(--color-gray-dark)',
                      }}
                    >
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: p.topColor,
                          flexShrink: 0,
                        }}
                      />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
