interface ScoreBadgeProps {
  score: number;
  className?: string;
}

type Tier = 'high' | 'mid' | 'low';

function getTier(score: number): Tier {
  if (score >= 80) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}

const tierStyles: Record<Tier, { bg: string; color: string }> = {
  high: { bg: '#E6F1E7', color: '#3F8C5C' },
  mid:  { bg: '#FBF0D5', color: '#C28A1E' },
  low:  { bg: '#FBE7E3', color: '#CF4A41' },
};

export function ScoreBadge({ score, className = '' }: ScoreBadgeProps) {
  const tier = getTier(score);
  const { bg, color } = tierStyles[tier];

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '1px',
        padding: '3px 9px',
        borderRadius: '5px',
        backgroundColor: bg,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: '14px', color }}>{Math.round(score)}</span>
      <span style={{ fontWeight: 500, fontSize: '11px', color: '#A8A192' }}>/100</span>
    </span>
  );
}
