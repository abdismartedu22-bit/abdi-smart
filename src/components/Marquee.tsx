const items = [
  'SNBP 2025',
  'SNBT 2025',
  'Les Privat',
  'Les Grup',
  'TPS Intensif',
  'Mata Pelajaran',
  '3 Cabang Bali',
  'Alumni PTN',
  'Mentor Berpengalaman',
  'Tryout Rutin',
];

const Star = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ flexShrink: 0, opacity: 0.7 }}
  >
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  </svg>
);

export default function Marquee() {
  const doubled = [...items, ...items];

  return (
    <div
      style={{
        background: 'var(--color-navy)',
        color: '#fff',
        overflow: 'hidden',
        padding: '14px 0',
        borderTop: '3px solid var(--color-yellow)',
        borderBottom: '3px solid var(--color-yellow)',
      }}
      aria-hidden
    >
      <div className="marquee-track">
        {doubled.map((item, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '0.9rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              paddingRight: '32px',
            }}
          >
            <Star />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
