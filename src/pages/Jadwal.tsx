import { useState } from 'react';
import { jadwal, mingguIni, hariOrder, type Grup } from '../data/jadwal';

// Day of week map (JS getDay() returns 0=Sun ... 6=Sat)
const jsHariMap: Record<number, string> = {
  0: 'Minggu',
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};
const hariToday = jsHariMap[new Date().getDay()];

function GrupCard({ g, isActive }: { g: Grup; isActive: boolean }) {
  const sorted = [...g.sesi].sort(
    (a, b) => hariOrder.indexOf(a.hari) - hariOrder.indexOf(b.hari),
  );

  return (
    <div
      style={{
        borderRadius: '16px',
        overflow: 'hidden',
        border: isActive
          ? `2px solid ${g.warna}`
          : '2px solid #E2E1DC',
        transition: 'border-color 0.2s',
        background: '#fff',
      }}
    >
      {/* Group header */}
      <div
        style={{
          background: g.warna,
          color: g.warnaText,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Kode badge */}
          <span
            style={{
              background: 'rgba(255,255,255,0.18)',
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: '0.8rem',
              letterSpacing: '0.06em',
              padding: '4px 10px',
              borderRadius: '8px',
            }}
          >
            {g.kode}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: '1.1rem',
              letterSpacing: '-0.02em',
            }}
          >
            {g.nama}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.72rem',
            fontWeight: 500,
            opacity: 0.7,
            whiteSpace: 'nowrap',
          }}
        >
          {g.sesi.length} sesi/minggu
        </span>
      </div>

      {/* Sessions */}
      <div>
        {sorted.map((s, i) => {
          const isToday = s.hari === hariToday;
          return (
            <div
              key={i}
              style={{
                padding: '16px 20px',
                borderBottom: i < sorted.length - 1 ? '1px solid #F3F2EE' : 'none',
                background: isToday ? '#FFFDE6' : 'transparent',
                display: 'flex',
                gap: '14px',
                alignItems: 'flex-start',
              }}
            >
              {/* Day badge */}
              <div style={{ flexShrink: 0, paddingTop: '1px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    background: isToday ? g.warna : '#F3F2EE',
                    color: isToday ? g.warnaText : '#555',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: '0.65rem',
                    letterSpacing: '0.06em',
                    padding: '4px 9px',
                    borderRadius: '6px',
                    minWidth: '58px',
                    textAlign: 'center',
                  }}
                >
                  {s.hari}
                  {isToday && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.52rem',
                        letterSpacing: '0.08em',
                        opacity: 0.85,
                        marginTop: '1px',
                      }}
                    >
                      HARI INI
                    </span>
                  )}
                </span>
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    letterSpacing: '-0.01em',
                    color: '#0D0D0D',
                    marginBottom: '4px',
                    lineHeight: 1.2,
                  }}
                >
                  {s.materi}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.78rem',
                    color: '#888',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    {s.jam}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {s.lokasi}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {s.mentor}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Jadwal() {
  const [activeFilter, setActiveFilter] = useState<string>('semua');

  const filtered =
    activeFilter === 'semua'
      ? jadwal
      : jadwal.filter((g) => g.id === activeFilter);

  return (
    <div
      style={{
        minHeight: '100svh',
        background: '#F3F2EE',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Header */}
      <header
        style={{
          background: '#0F1F6B',
          color: '#fff',
          padding: '0',
        }}
      >
        <div
          style={{
            maxWidth: '640px',
            margin: '0 auto',
            padding: '20px 20px 0',
          }}
        >
          {/* Brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            <img
              src="/logo.png"
              alt="Abdi Smart"
              style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: '0.88rem',
                  letterSpacing: '-0.02em',
                }}
              >
                Abdi Smart Education
              </div>
              <div style={{ fontSize: '0.6rem', opacity: 0.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Jadwal Bimbel
              </div>
            </div>
          </div>

          {/* Week info */}
          <div
            style={{
              background: 'rgba(255,255,255,0.07)',
              borderRadius: '12px 12px 0 0',
              padding: '16px 18px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#FFE500',
                marginBottom: '4px',
              }}
            >
              Minggu Ini
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: '1.4rem',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              {mingguIni.mulai} &ndash; {mingguIni.selesai}
            </div>
          </div>
        </div>
      </header>

      {/* Filter tabs */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #E2E1DC',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: '640px',
            margin: '0 auto',
            padding: '0 20px',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '12px',
            paddingTop: '12px',
          }}
        >
          {/* All filter */}
          <button
            onClick={() => setActiveFilter('semua')}
            style={{
              flexShrink: 0,
              background: activeFilter === 'semua' ? '#0D0D0D' : '#F3F2EE',
              color: activeFilter === 'semua' ? '#fff' : '#555',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '0.78rem',
              padding: '7px 16px',
              borderRadius: '100px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            Semua Grup
          </button>

          {jadwal.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveFilter(g.id)}
              style={{
                flexShrink: 0,
                background: activeFilter === g.id ? g.warna : '#F3F2EE',
                color: activeFilter === g.id ? g.warnaText : '#555',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '7px 16px',
                borderRadius: '100px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {g.nama}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '20px 20px 48px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {filtered.map((g) => (
          <GrupCard
            key={g.id}
            g={g}
            isActive={activeFilter === g.id || activeFilter === 'semua'}
          />
        ))}

        {/* Info note */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E2E1DC',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0F1F6B"
            strokeWidth="2"
            style={{ flexShrink: 0, marginTop: '1px' }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.8rem',
              color: '#777',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Jadwal dapat berubah sewaktu-waktu. Jika ada perubahan, admin akan menginformasikan
            lewat grup WhatsApp masing-masing. Hubungi{' '}
            <a
              href="https://wa.me/6287848661688"
              style={{ color: '#0F1F6B', fontWeight: 600 }}
            >
              admin
            </a>{' '}
            jika ada pertanyaan.
          </p>
        </div>
      </main>

      {/* Footer */}
      <div
        style={{
          textAlign: 'center',
          padding: '16px',
          fontFamily: 'var(--font-body)',
          fontSize: '0.72rem',
          color: '#B0B0B0',
          borderTop: '1px solid #E2E1DC',
          background: '#fff',
        }}
      >
        Abdi Smart Education &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
}
