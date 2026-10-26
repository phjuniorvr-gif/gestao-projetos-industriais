import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';

/**
 * Card de resumo (cabeçalho colorido + número grande + ícone) — nasceu em `UpcomingTasksPage.tsx`
 * (Fase 7+), extraído pra componente compartilhado quando a tela de Requisições pediu o mesmo
 * visual (sessão de 2026-10-26). `onClick` é opcional — card vira botão clicável (com anel de
 * destaque quando `active`) só quando passado; sem ele é só leitura.
 */
export function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const card = (
    <Card
      className={`overflow-hidden p-0 ${active ? 'ring-2 ring-offset-1' : ''}`}
      style={active ? ({ '--tw-ring-color': color } as CSSProperties) : undefined}
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: color }}>
        {label}
      </div>
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-2xl font-bold text-text">{value}</span>
        <Icon className="h-6 w-6" style={{ color }} />
      </div>
    </Card>
  );

  if (!onClick) return card;

  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="text-left transition-opacity hover:opacity-90">
      {card}
    </button>
  );
}
