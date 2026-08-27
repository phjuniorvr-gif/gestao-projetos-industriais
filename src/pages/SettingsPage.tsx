import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { Button, Card, Checkbox, FormField, Input, Select } from '../components/ui';
import { getSettings as getStoredSettings, setSettings as persistSettings } from '../services/localSettings';
import { useAuth, useCategories, usePeople, usePerfil, useUsuarios } from '../hooks';
import { STATUS_LABEL, type Category, type Papel, type ProjectStatus } from '../types';

interface Settings {
  defaultUnit: string;
  dateFormat: 'dd/mm/aaaa' | 'aaaa-mm-dd';
  primaryColor: string;
  enabledCategories: Category[];
  enabledStatuses: ProjectStatus[];
  scheduleScale: 'mensal' | 'semanal';
}

const DEFAULT_SETTINGS: Settings = {
  defaultUnit: 'Matriz',
  dateFormat: 'dd/mm/aaaa',
  primaryColor: '#2563EB',
  enabledCategories: [],
  enabledStatuses: Object.keys(STATUS_LABEL) as ProjectStatus[],
  scheduleScale: 'mensal',
};

const UNIT_OPTIONS = ['Matriz', 'MEC', 'Feira', 'Amélia'];

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const { categories } = useCategories();
  const { people, createPerson, updatePerson } = usePeople();
  const [newPersonName, setNewPersonName] = useState('');

  const { session } = useAuth();
  const isAdmin = usePerfil();
  const { usuarios, createUsuario, updateUsuarioPapel } = useUsuarios(isAdmin === true);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserPapel, setNewUserPapel] = useState<Papel>('usuario');
  // Vincula o login à pessoa (responsável) correspondente na mesma criação — sem isso não teria
  // como a tela de Tarefas próximas saber de quem filtrar (pedido do usuário).
  const [newUserPersonId, setNewUserPersonId] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState('');

  async function handleCreateUser() {
    setCreateUserError('');
    if (!newUserEmail.trim() || !newUserPassword) {
      setCreateUserError('Preencha e-mail e senha.');
      return;
    }
    setCreatingUser(true);
    try {
      const created = await createUsuario(newUserEmail.trim(), newUserPassword, newUserPapel);
      if (newUserPersonId) await updatePerson(newUserPersonId, { userId: created.userId });
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserPapel('usuario');
      setNewUserPersonId('');
    } catch (err) {
      setCreateUserError(err instanceof Error ? err.message : 'Não foi possível criar o usuário.');
    } finally {
      setCreatingUser(false);
    }
  }

  useEffect(() => {
    setSettings(getStoredSettings(DEFAULT_SETTINGS));
  }, []);

  // Preferência recém-criada (nenhuma categoria salva ainda) começa com todas habilitadas.
  useEffect(() => {
    if (categories.length === 0) return;
    setSettings((current) =>
      current.enabledCategories.length === 0
        ? { ...current, enabledCategories: categories.map((c) => c.id) }
        : current,
    );
  }, [categories]);

  function toggleCategory(category: Category) {
    setSettings((current) => ({
      ...current,
      enabledCategories: current.enabledCategories.includes(category)
        ? current.enabledCategories.filter((c) => c !== category)
        : [...current.enabledCategories, category],
    }));
  }

  function toggleStatus(status: ProjectStatus) {
    setSettings((current) => ({
      ...current,
      enabledStatuses: current.enabledStatuses.includes(status)
        ? current.enabledStatuses.filter((s) => s !== status)
        : [...current.enabledStatuses, status],
    }));
  }

  function handleAddPerson() {
    const name = newPersonName.trim();
    if (!name) return;
    createPerson(name);
    setNewPersonName('');
  }

  function handleSave() {
    persistSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Preferências gerais do aplicativo (protótipo)" />

      <Card className="max-w-2xl space-y-5 p-6">
        <FormField label="Unidade padrão">
          <Select
            value={settings.defaultUnit}
            onChange={(e) => setSettings({ ...settings, defaultUnit: e.target.value })}
            className="w-full"
          >
            {UNIT_OPTIONS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Formato de data">
          <Select
            value={settings.dateFormat}
            onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value as Settings['dateFormat'] })}
            className="w-full"
          >
            <option value="dd/mm/aaaa">DD/MM/AAAA</option>
            <option value="aaaa-mm-dd">AAAA-MM-DD</option>
          </Select>
        </FormField>

        <FormField label="Cor principal">
          <input
            type="color"
            value={settings.primaryColor}
            onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
            className="h-9 w-16 cursor-pointer rounded border border-border bg-white"
          />
        </FormField>

        <FormField label="Escala padrão do cronograma">
          <Select
            value={settings.scheduleScale}
            onChange={(e) => setSettings({ ...settings, scheduleScale: e.target.value as Settings['scheduleScale'] })}
            className="w-full"
          >
            <option value="mensal">Mensal</option>
            <option value="semanal">Semanal</option>
          </Select>
        </FormField>

        <FormField label="Categorias disponíveis">
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => (
              <Checkbox
                key={c.id}
                label={c.label}
                checked={settings.enabledCategories.includes(c.id)}
                onChange={() => toggleCategory(c.id)}
              />
            ))}
          </div>
        </FormField>

        <FormField label="Status disponíveis">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <Checkbox
                key={value}
                label={label}
                checked={settings.enabledStatuses.includes(value as ProjectStatus)}
                onChange={() => toggleStatus(value as ProjectStatus)}
              />
            ))}
          </div>
        </FormField>

        <div className="flex items-center gap-3 border-t border-border pt-4">
          <Button variant="primary" onClick={handleSave}>
            Salvar preferências
          </Button>
          {saved && <span className="text-xs text-status-done">Salvo com sucesso.</span>}
        </div>
      </Card>

      <Card className="max-w-2xl space-y-4 p-6">
        <div>
          <p className="text-sm font-semibold text-text">Pessoas</p>
          <p className="mt-1 text-xs text-text-muted">
            Gerentes de projeto e responsáveis de tarefa. Renomeie erros de digitação ou desative quem saiu — o
            histórico continua vinculado.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddPerson();
            }}
            placeholder="Nome da nova pessoa"
            className="flex-1"
          />
          <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={handleAddPerson}>
            Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {people.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <Input
                defaultValue={p.name}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== p.name) updatePerson(p.id, { name: value });
                }}
                className="flex-1"
              />
              <Checkbox
                label="Ativo"
                checked={p.active}
                onChange={(e) => updatePerson(p.id, { active: e.target.checked })}
              />
            </div>
          ))}
          {people.length === 0 && <p className="text-sm text-text-muted">Nenhuma pessoa cadastrada ainda.</p>}
        </div>
      </Card>

      {isAdmin === true && (
        <Card className="max-w-2xl space-y-4 p-6">
          <div>
            <p className="text-sm font-semibold text-text">Usuários</p>
            <p className="mt-1 text-xs text-text-muted">
              Login e permissão de acesso ao sistema. Só administrador pode criar usuário ou trocar papel.
            </p>
          </div>

          <div className="space-y-2">
            {usuarios.map((u) => {
              const isSelf = u.userId === session?.user.id;
              return (
                <div key={u.userId} className="flex items-center gap-3">
                  <span className="flex-1 truncate text-sm text-text">{u.email}</span>
                  {isSelf ? (
                    <span className="text-xs font-medium text-text-muted" title="Você não pode trocar seu próprio papel por aqui.">
                      {u.papel === 'administrador' ? 'Administrador' : 'Usuário'}
                    </span>
                  ) : (
                    <Select
                      value={u.papel}
                      onChange={(e) => updateUsuarioPapel(u.userId, e.target.value as Papel)}
                      className="w-40"
                    >
                      <option value="usuario">Usuário</option>
                      <option value="administrador">Administrador</option>
                    </Select>
                  )}
                </div>
              );
            })}
            {usuarios.length === 0 && <p className="text-sm text-text-muted">Nenhum usuário cadastrado ainda.</p>}
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted2">Novo usuário</p>
            <div className="flex flex-wrap gap-2">
              <Input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="E-mail"
                className="flex-1 min-w-[180px]"
              />
              <Input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Senha"
                className="flex-1 min-w-[140px]"
              />
              <Select value={newUserPapel} onChange={(e) => setNewUserPapel(e.target.value as Papel)} className="w-40">
                <option value="usuario">Usuário</option>
                <option value="administrador">Administrador</option>
              </Select>
              <Select value={newUserPersonId} onChange={(e) => setNewUserPersonId(e.target.value)} className="w-48">
                <option value="">Pessoa vinculada: nenhuma</option>
                {people
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
              <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={handleCreateUser} disabled={creatingUser}>
                Criar
              </Button>
            </div>
            <p className="text-xs text-text-muted">
              A pessoa vinculada é quem esse login enxerga como "responsável" na tela de Tarefas dos próximos 15
              dias — sem vínculo, um usuário comum não vê nenhuma tarefa lá.
            </p>
            {createUserError && <p className="text-xs text-status-delayed">{createUserError}</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
