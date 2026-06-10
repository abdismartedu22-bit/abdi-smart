interface Props {
  nama: string;
  warna: string;
  warna_text: string;
}

export default function GrupBadge({ nama, warna, warna_text }: Props) {
  return (
    <span style={{
      background: warna,
      color: warna_text,
      padding: '2px 9px',
      borderRadius: '4px',
      fontSize: '0.7rem',
      fontWeight: 700,
      fontFamily: 'var(--font-body)',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      maxWidth: '160px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: 'inline-block',
    }}>
      {nama}
    </span>
  );
}
