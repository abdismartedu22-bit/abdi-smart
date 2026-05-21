import { formatWeekLabel, nextWeek, prevWeek } from '../../lib/dates';

interface Props {
  weekStart: Date;
  onChange: (date: Date) => void;
}

export default function WeekPicker({ weekStart, onChange }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <button onClick={() => onChange(prevWeek(weekStart))} style={btn}>{'‹'}</button>
      <span style={{
        fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 600,
        color: '#0D0D0D', minWidth: '200px', textAlign: 'center',
      }}>
        {formatWeekLabel(weekStart)}
      </span>
      <button onClick={() => onChange(nextWeek(weekStart))} style={btn}>{'›'}</button>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: '#fff',
  border: '1.5px solid #E2E1DC',
  borderRadius: '6px',
  cursor: 'pointer',
  padding: '5px 12px',
  fontFamily: 'var(--font-body)',
  fontSize: '1rem',
  color: '#0D0D0D',
  lineHeight: 1,
};
