import { useEffect, useState } from 'react';
import { PageHeader } from '../components/layout';
import { Button, Card, Checkbox, FormField, Select } from '../components/ui';
import { getSettings as getStoredSettings, setSettings as persistSettings } from '../services/localSettings';
import { useCategories } from '../hooks';
import { STATUS_LABEL, type Category, type ProjectStatus } from '../types';

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
    </div>
  );
}
