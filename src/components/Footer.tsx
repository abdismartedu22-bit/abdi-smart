export default function Footer() {
  return (
    <footer
      style={{
        background: 'var(--color-black)',
        color: 'var(--color-white)',
        padding: '40px 0 28px',
      }}
    >
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '0 28px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            paddingBottom: '28px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/logo.png"
              alt="Abdi Smart"
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: '0.95rem',
                  letterSpacing: '-0.02em',
                  color: '#fff',
                }}
              >
                Abdi Smart Education
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.65rem',
                  color: 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Bimbel SNBP &amp; SNBT Bali
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            <a
              href="https://www.instagram.com/abdismart_official"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-body)',
                fontSize: '0.82rem',
                color: 'rgba(255,255,255,0.38)',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-yellow)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.38)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              @abdismart_official
            </a>
            <a
              href="https://wa.me/6287848661688"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.82rem',
                color: 'rgba(255,255,255,0.38)',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-yellow)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.38)')}
            >
              +62 878-4866-1688
            </a>
          </div>
        </div>

        <div
          style={{
            paddingTop: '20px',
            fontFamily: 'var(--font-body)',
            fontSize: '0.72rem',
            color: 'rgba(255,255,255,0.18)',
          }}
        >
          &copy; {new Date().getFullYear()} Abdi Smart Education. All rights reserved. &middot;{' '}
          <a href="https://www.builtbypolaris.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px', opacity: 0.6 }}>Website built by Polaris.</a>
        </div>
      </div>
    </footer>
  );
}
