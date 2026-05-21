interface Props {
  kode: string;
  warna: string;
  warna_text: string;
}

export default function GrupBadge({ kode, warna, warna_text }: Props) {
  return (
    <span style={{
      background: warna,
      color: warna_text,
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '0.7rem',
      fontWeight: 700,
      fontFamily: 'var(--font-body)',
      letterSpacing: '0.05em',
      flexShrink: 0,
    }}>
      {kode}
    </span>
  );
}
