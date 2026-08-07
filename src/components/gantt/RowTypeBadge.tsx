type RowType = 'project' | 'activity' | 'task';

const ROW_TYPE_COLOR: Record<RowType, string> = {
  project: '#1D4ED8',
  activity: '#6D28D9',
  task: '#15803D',
};

const ROW_TYPE_LABEL: Record<RowType, string> = {
  project: 'PROJETO',
  activity: 'ATIVIDADE',
  task: 'TAREFA',
};

export function RowTypeBadge({ type }: { type: RowType }) {
  const color = ROW_TYPE_COLOR[type];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {ROW_TYPE_LABEL[type]}
    </span>
  );
}
