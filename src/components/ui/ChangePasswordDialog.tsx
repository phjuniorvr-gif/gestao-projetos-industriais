import { useState } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { FormField } from './FormField';
import { Input } from './Input';
import { useAuth } from '../../hooks';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Pedido do usuário: qualquer login (inclusive usuário comum restrito só a "/tarefas-proximas")
 * precisa conseguir trocar a própria senha. Sem senha atual — `supabase.auth.updateUser` já opera
 * sobre a sessão logada, mesmo padrão de "sem fricção" das outras ações do usuário comum. */
export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const { changePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!open) return null;

  function reset() {
    setPassword('');
    setConfirmPassword('');
    setError('');
    setDone(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    setError('');
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    try {
      const err = await changePassword(password);
      if (err) {
        setError(err);
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={handleClose}>
      <Card className="w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-text">Trocar senha</p>

        {done ? (
          <>
            <p className="mt-1.5 text-sm text-status-done">Senha alterada com sucesso.</p>
            <div className="mt-4 flex justify-end">
              <Button variant="primary" onClick={handleClose}>
                Fechar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 space-y-3">
              <FormField label="Nova senha">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                  autoFocus
                />
              </FormField>
              <FormField label="Confirmar nova senha" error={error}>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit();
                  }}
                  className="w-full"
                />
              </FormField>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                Trocar senha
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
