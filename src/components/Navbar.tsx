import { useState, useEffect } from 'react';

const links = [
  { label: 'Program', href: '#program' },
  { label: 'Keunggulan', href: '#keunggulan' },
  { label: 'Lokasi', href: '#lokasi' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: 'all 0.3s ease',
        background: scrolled ? 'rgba(255,255,255,0.96)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid #E2E1DC' : 'none',
      }}
    >
      <div
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '0 28px',
          height: '70px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="/logo.png"
            alt="Abdi Smart"
            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: '1rem',
              letterSpacing: '-0.03em',
              color: 'var(--color-black)',
            }}
          >
            Abdi Smart
          </span>
        </a>

        <nav className="hidden md:flex" style={{ alignItems: 'center', gap: '36px' }}>
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: '0.9rem',
                color: 'var(--color-gray-dark)',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-red)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-gray-dark)')}
            >
              {l.label}
            </a>
          ))}
          <a
            href="https://wa.me/6287848661688"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'var(--color-red)',
              color: '#fff',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '0.85rem',
              padding: '11px 24px',
              borderRadius: '100px',
              transition: 'background 0.2s, transform 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--color-red-dark)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--color-red)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            Daftar Sekarang
          </a>
        </nav>

        <button
          className="md:hidden"
          onClick={() => setOpen(!open)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
        >
          <div style={{ width: '22px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  display: 'block',
                  height: '2px',
                  background: 'var(--color-black)',
                  borderRadius: '2px',
                  transition: 'transform 0.25s, opacity 0.25s',
                  transform: i === 0 && open ? 'rotate(45deg) translateY(7px)' : i === 2 && open ? 'rotate(-45deg) translateY(-7px)' : 'none',
                  opacity: i === 1 && open ? 0 : 1,
                }}
              />
            ))}
          </div>
        </button>
      </div>

      <div
        style={{
          overflow: 'hidden',
          maxHeight: open ? '300px' : '0',
          transition: 'max-height 0.3s ease',
          background: 'rgba(255,255,255,0.98)',
          borderTop: open ? '1px solid #E2E1DC' : 'none',
        }}
      >
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '1.5rem',
                letterSpacing: '-0.02em',
                color: 'var(--color-black)',
              }}
            >
              {l.label}
            </a>
          ))}
          <a
            href="https://wa.me/6287848661688"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={{
              background: 'var(--color-red)',
              color: '#fff',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '0.9rem',
              padding: '14px',
              borderRadius: '100px',
              textAlign: 'center',
              marginTop: '4px',
            }}
          >
            Daftar Sekarang
          </a>
        </div>
      </div>
    </header>
  );
}
