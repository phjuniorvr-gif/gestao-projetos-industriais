import { Card } from '../ui';

interface StatusCardProps {
  label: string;
  value: number;
  color: string;
}

export function StatusCard({ label, value, color }: StatusCardProps) {
  return (
    <Card className="flex-1 overflow-hidden">
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
        </div>
        <div className="h-8 w-8 shrink-0 rounded-md" style={{ backgroundColor: color }} />
      </div>
    </Card>
  );
}
