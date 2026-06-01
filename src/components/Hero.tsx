export default function Hero() {
  return (
    <section
      style={{
        background: 'var(--color-white)',
        minHeight: '100svh',
        display: 'grid',
        placeItems: 'center',
        paddingTop: '70px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle dot-grid texture */}
      <div
        aria-hidden
        className="dot-grid"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.4,
          pointerEvents: 'none',
        }}
      />

      {/* Large yellow circle -- off-canvas right */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-5%',
          right: '-14%',
          width: '56vw',
          maxWidth: '680px',
          aspectRatio: '1',
          borderRadius: '50%',
          background: 'var(--color-yellow)',
          opacity: 0.22,
          pointerEvents: 'none',
        }}
      />
      {/* Red circle -- bottom left */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '-8%',
          left: '-8%',
          width: '34vw',
          maxWidth: '380px',
          aspectRatio: '1',
          borderRadius: '50%',
          background: 'var(--color-red)',
          opacity: 0.08,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: '1120px',
          width: '100%',
          margin: '0 auto',
          padding: '56px 28px',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '52px',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
        className="lg:grid-cols-[1fr_400px]"
      >
        {/* LEFT */}
        <div>
          {/* Tag row */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '32px' }}>
            <span
              className="pill"
              style={{ background: 'var(--color-red)', color: '#fff' }}
            >
              Bimbel Bali
            </span>
            <span
              className="pill"
              style={{ background: 'var(--color-navy)', color: '#fff' }}
            >
              SNBP &amp; SNBT
            </span>
          </div>

          {/* Main headline */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 'clamp(3.2rem, 8.5vw, 6.4rem)',
              letterSpacing: '-0.04em',
              lineHeight: 0.94,
              color: 'var(--color-black)',
              marginBottom: '28px',
            }}
          >
            Tembus PTN
            <br />
            impianmu
            <br />
            <span
              style={{
                fontStyle: 'italic',
                color: 'var(--color-red)',
              }}
            >
              tahun ini.
            </span>
          </h1>

          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.05rem',
              color: 'var(--color-gray)',
              lineHeight: 1.72,
              maxWidth: '440px',
              marginBottom: '40px',
              fontWeight: 400,
            }}
          >
            Les privat dan grup untuk persiapan SNBP, SNBT, TPS, dan Mapel. Mentor alumni PTN, 3 lokasi di Denpasar.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '52px' }}>
            <a
              href="https://wa.me/6287848661688"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--color-red)',
                color: '#fff',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.95rem',
                padding: '15px 30px',
                borderRadius: '100px',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(220,10,30,0.35)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Konsultasi Gratis
            </a>
            <a
              href="#program"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: '2px solid var(--color-border)',
                color: 'var(--color-gray-dark)',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: '0.95rem',
                padding: '15px 26px',
                borderRadius: '100px',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-black)';
                (e.currentTarget as HTMLElement).style.color = 'var(--color-black)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLElement).style.color = 'var(--color-gray-dark)';
              }}
            >
              Lihat Program
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          {/* Stats -- compact row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '28px',
              paddingTop: '24px',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            {[
              { n: '500+', l: 'Alumni PTN' },
              { n: '3', l: 'Cabang Bali' },
              { n: '98%', l: 'Kelulusan' },
            ].map((s) => (
              <div key={s.n}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: '1.9rem',
                    letterSpacing: '-0.03em',
                    color: 'var(--color-black)',
                    lineHeight: 1,
                  }}
                >
                  {s.n}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.78rem',
                    color: 'var(--color-gray)',
                    marginTop: '5px',
                    fontWeight: 500,
                  }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT -- logo display */}
        <div
          className="hidden lg:flex"
          style={{ justifyContent: 'center', alignItems: 'center', position: 'relative' }}
        >
          <div
            style={{
              position: 'relative',
              width: '380px',
              height: '380px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: '360px', height: '360px', overflow: 'hidden' }}>
              <img
                src="/logo.png"
                alt="Abdi Smart"
                style={{ width: '360px', height: '360px', objectFit: 'contain', transform: 'scale(1.45)', transformOrigin: 'center' }}
              />
            </div>

            {/* Floating chip -- top right */}
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '-24px',
                background: 'var(--color-white)',
                border: '1.5px solid var(--color-border)',
                borderRadius: '12px',
                padding: '10px 18px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.07)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--color-red)',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  color: 'var(--color-black)',
                  whiteSpace: 'nowrap',
                }}
              >
                Les Privat &amp; Grup
              </span>
            </div>

            {/* Floating chip -- bottom left */}
            <div
              style={{
                position: 'absolute',
                bottom: '28px',
                left: '-28px',
                background: 'var(--color-navy)',
                borderRadius: '12px',
                padding: '10px 18px',
                boxShadow: '0 6px 20px rgba(15,31,107,0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--color-yellow)',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                }}
              >
                TPS &amp; Mapel
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
