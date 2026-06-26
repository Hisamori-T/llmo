type Status = 'completed' | 'running' | 'failed' | 'pending';

interface StatusBadgeProps {
  status: Status | string;
  className?: string;
}

const statusConfig: Record<Status, { label: string; bg: string; dot: string; text: string }> = {
  completed: { label: '完了',   bg: '#E6F1E7', dot: '#3F8C5C', text: '#2E6B45' },
  running:   { label: '実行中', bg: '#FBF0D5', dot: '#C28A1E', text: '#9A7415' },
  failed:    { label: 'エラー', bg: '#FBE7E3', dot: '#CF4A41', text: '#CF4A41' },
  pending:   { label: '待機中', bg: '#F1EADC', dot: '#A39C8B', text: '#837D6F' },
};

const fallback = { label: '不明', bg: '#F1EADC', dot: '#A39C8B', text: '#837D6F' };

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status as Status] ?? { ...fallback, label: status };

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px 3px 8px',
        borderRadius: '5px',
        backgroundColor: config.bg,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: config.dot,
          flexShrink: 0,
        }}
      />
      <span style={{ fontWeight: 600, fontSize: '12px', color: config.text }}>{config.label}</span>
    </span>
  );
}
