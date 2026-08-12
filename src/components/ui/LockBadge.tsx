import { Lock } from 'lucide-react';

interface LockBadgeProps {
  reason?: string;
}

/**
 * Selo de campo/ação restrita a administrador (Fase 5) — cadeado com `title` explicando de quem
 * é a atribuição. Nunca esconde o campo, só sinaliza: spec explícita ("aparecem com cadeado,
 * desabilitados, com aviso... não simplesmente sumindo da tela"). Quem desabilita o controle é
 * quem chama (`disabled={isAdmin !== true}` no Input/Select/Button em si) — isto é só o aviso
 * visual ao lado, não some sozinho a interação.
 */
export function LockBadge({ reason = 'Somente administrador pode alterar isto.' }: LockBadgeProps) {
  return (
    <span title={reason} aria-label={reason} className="inline-flex shrink-0 items-center text-text-muted2">
      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}
