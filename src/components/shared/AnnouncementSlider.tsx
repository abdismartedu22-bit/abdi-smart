import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

type Announcement = { id: string; judul: string; isi: string };

export default function AnnouncementSlider() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    supabase
      .from('announcements')
      .select('id, judul, isi')
      .eq('is_active', true)
      .order('urutan')
      .limit(3)
      .then(({ data }) => { if (data && data.length > 0) setItems(data as Announcement[]); });
  }, []);

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

  return (
    <div style={{ background: '#0D5C3A', borderRadius: '12px', padding: '14px 18px', position: 'relative' }}>
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
  );
}
