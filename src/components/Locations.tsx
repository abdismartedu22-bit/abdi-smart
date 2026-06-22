const branches = [
  {
    code: '01',
    name: 'Badak Agung',
    note: 'x Harka Coffee',
    city: 'Denpasar',
    mapsUrl: 'https://maps.app.goo.gl/xX5pa8A42c3XexKVA',
  },
  {
    code: '02',
    name: 'Trijata',
    note: 'Denpasar Utara',
    city: 'Denpasar',
    mapsUrl: 'https://maps.app.goo.gl/y53JviYgZH8fzU2u5',
  },
  {
    code: '03',
    name: 'Mahendradata',
    note: 'Denpasar Barat',
    city: 'Denpasar',
    mapsUrl: 'https://maps.app.goo.gl/XksdQXwHPWtp8uBL7',
  },
];

export default function Locations() {
  return (
    <section id="lokasi" style={{ background: 'var(--color-white)', padding: '100px 0' }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '0 28px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '24px',
            marginBottom: '56px',
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
              Cabang Kami
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
              3 lokasi di{' '}
              <span className="mark">Bali.</span>
            </h2>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.92rem',
              color: 'var(--color-gray)',
              maxWidth: '280px',
              lineHeight: 1.7,
            }}
          >
            Semua di Denpasar. Klik kartu untuk buka di Google Maps.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '14px',
          }}
        >
          {branches.map((b) => (
            <a
              key={b.code}
              href={b.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="lift"
              style={{
                display: 'block',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '20px',
                padding: '32px 28px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Large bg number */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  bottom: '-0.1em',
                  right: '-0.05em',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: '9rem',
                  letterSpacing: '-0.05em',
                  color: 'rgba(0,0,0,0.04)',
                  lineHeight: 1,
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              >
                {b.code}
              </div>

              {/* Yellow pin badge */}
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'var(--color-yellow)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.68rem',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--color-gray)',
                  marginBottom: '6px',
                }}
              >
                {b.city}
              </div>

              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: '1.8rem',
                  letterSpacing: '-0.04em',
                  color: 'var(--color-black)',
                  lineHeight: 1.05,
                  marginBottom: '4px',
                }}
              >
                {b.name}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.86rem',
                  color: 'var(--color-gray)',
                  marginBottom: '24px',
                }}
              >
                {b.note}
              </p>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  color: 'var(--color-navy)',
                }}
              >
                Buka di Maps
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
