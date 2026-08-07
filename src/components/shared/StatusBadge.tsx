import { Badge } from '../ui';
import { STATUS_COLOR, STATUS_LABEL, type ProjectStatus } from '../../types';

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>;
}
