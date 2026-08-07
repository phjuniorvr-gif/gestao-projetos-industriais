import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Button, Card, FormField, Input } from '../components/ui';
import { useAuth } from '../hooks';

export function LoginPage() {
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) return <Navigate to="/projetos" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const message = await signIn(email, password);
    if (message) setError('E-mail ou senha inválidos.');
    setSubmitting(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <Card className="w-full max-w-sm space-y-6 p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold text-text">Gestão de Projetos</h1>
          <p className="text-sm text-text-muted">Entre com sua conta para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="E-mail" required>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
            />
          </FormField>

          <FormField label="Senha" required>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
            />
          </FormField>

          {error && <p className="text-xs text-status-delayed">{error}</p>}

          <Button type="submit" variant="primary" icon={<LogIn className="h-4 w-4" />} disabled={submitting} className="w-full justify-center">
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
