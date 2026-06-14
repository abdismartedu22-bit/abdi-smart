import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

type Announcement = { id: string; judul: string; isi: string; gambar_url: string | null; target_kelas: string[] | null };

function toDirectImg(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
  return url;
}

export default function AnnouncementSlider({ tingkatKelas }: { tingkatKelas?: string | null }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    supabase
      .from('announcements')
      .select('id, judul, isi, gambar_url, target_kelas')
      .eq('is_active', true)
      .order('urutan')
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const all = data as Announcement[];
        const filtered = tingkatKelas !== undefined
          ? all.filter(a => a.target_kelas === null || (Array.isArray(a.target_kelas) && a.target_kelas.includes(tingkatKelas ?? '')))
          : all;
        setItems(filtered.slice(0, 3));
      });
  }, [tingkatKelas]);

  const goTo = useCallback((idx: number) => {
    setCurrent(((idx % items.length) + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setCurrent(c => (c + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;

  const item = items[current];
  const imgSrc = item.gambar_url ? toDirectImg(item.gambar_url) : null;

  return (
    <div style={{ background: '#0D5C3A', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
      {imgSrc && (
        <img
          src={imgSrc}
          alt={item.judul}
          style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFE500" strokeWidth="2.2" style={{ marginTop: '2px', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', fontWeight: 700, color: '#FFE500', marginBottom: '3px' }}>
              {item.judul}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.55 }}>
              {item.isi}
            </div>
          </div>
        </div>
        {items.length > 1 && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '10px', justifyContent: 'flex-end' }}>
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                style={{
                  width: i === current ? '18px' : '6px',
                  height: '6px',
                  borderRadius: '99px',
                  background: i === current ? '#FFE500' : 'rgba(255,229,0,0.35)',
                  border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'all 0.3s',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
