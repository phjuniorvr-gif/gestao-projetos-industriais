import type { Activity, ActivityTemplate, Project, Task } from '../types';
import { recomputeProject } from '../utils';

export const STANDARD_ACTIVITY_NAMES = [
  'Aquisição do equipamento',
  'Fabricação do equipamento',
  'Transporte do equipamento',
  'Preparação da área',
  'Instalação do equipamento',
  'Comissionamento',
  'Encerramento',
];

function task(
  id: string,
  rowNumber: number,
  activityId: string,
  name: string,
  category: Task['category'],
  predecessorRowNumbers: number[],
  plannedStart: string,
  plannedEnd: string,
  actualStart?: string,
  actualEnd?: string,
): Task {
  return {
    id,
    rowNumber,
    activityId,
    name,
    category,
    predecessorRowNumbers,
    plannedStart,
    plannedEnd,
    actualStart,
    actualEnd,
    status: 'planned',
  };
}

function activity(id: string, projectId: string, name: string, tasks: Task[]): Activity {
  return { id, projectId, name, tasks, status: 'planned' };
}

function project(base: Omit<Project, 'plannedStart' | 'plannedEnd' | 'progress' | 'status'>): Project {
  return recomputeProject({ ...base, progress: 0, status: 'planned' });
}

// ---------------------------------------------------------------------------
// P01 — Ampliação das Injetoras (Planejado — nada iniciado)
// ---------------------------------------------------------------------------
const p01 = project({
  id: 'p01',
  code: 'P01',
  name: 'Ampliação das Injetoras',
  description: 'Ampliação da linha de injetoras plásticas com nova infraestrutura predial.',
  unit: 'Matriz',
  sector: 'Produção',
  responsible: 'Márcia Souza',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  activities: [
    activity('p01-a1', 'p01', 'Aquisição do equipamento', [
      task('p01-t1', 1, 'p01-a1', 'Solicitar cotações', 'compras', [], '2026-08-26', '2026-09-05'),
      task('p01-t2', 2, 'p01-a1', 'Emitir pedido de compra', 'compras', [], '2026-09-06', '2026-09-20'),
    ]),
    activity('p01-a2', 'p01', 'Instalação do equipamento', [
      task('p01-t3', 3, 'p01-a2', 'Preparar infraestrutura', 'eletrica', [], '2026-11-01', '2026-11-20'),
      task('p01-t4', 4, 'p01-a2', 'Realizar testes funcionais', 'automacao', [], '2026-12-01', '2026-12-24'),
    ]),
  ],
});

// ---------------------------------------------------------------------------
// P02 — Reforma da Subestação (Em andamento, 40%)
// ---------------------------------------------------------------------------
const p02 = project({
  id: 'p02',
  code: 'P02',
  name: 'Reforma da Subestação',
  description: 'Reforma completa da subestação principal para aumento de capacidade.',
  unit: 'MEC',
  sector: 'Engenharia',
  responsible: 'Fernanda Alves',
  createdAt: '2026-06-20T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  activities: [
    activity('p02-a1', 'p02', 'Reforma elétrica', [
      task(
        'p02-t1',
        1,
        'p02-a1',
        'Levantar carga elétrica',
        'eletrica',
        [],
        '2026-07-07',
        '2026-07-20',
        '2026-07-09',
        '2026-07-18',
      ),
      task(
        'p02-t2',
        2,
        'p02-a1',
        'Preparar infraestrutura',
        'eletrica',
        [],
        '2026-07-21',
        '2026-08-05',
        '2026-07-21',
        '2026-08-02',
      ),
      task('p02-t3', 3, 'p02-a1', 'Instalar painel', 'eletrica', [2], '2026-08-06', '2026-08-25', '2026-08-06'),
      task('p02-t4', 4, 'p02-a1', 'Realizar interligações', 'eletrica', [], '2026-09-01', '2026-09-15'),
      task('p02-t5', 5, 'p02-a1', 'Executar testes elétricos', 'eletrica', [], '2026-09-16', '2026-10-05'),
    ]),
  ],
});

// ---------------------------------------------------------------------------
// P03 — Adequação NR-12 — Linha 3 (Atrasado, 50%)
// ---------------------------------------------------------------------------
const p03 = project({
  id: 'p03',
  code: 'P03',
  name: 'Adequação NR-12 — Linha 3',
  description: 'Adequação da linha 3 de produção aos requisitos de segurança da NR-12.',
  unit: 'Feira',
  sector: 'Segurança',
  responsible: 'Ricardo Santos',
  createdAt: '2026-04-25T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  activities: [
    activity('p03-a1', 'p03', 'Adequação NR-12', [
      task(
        'p03-t1',
        1,
        'p03-a1',
        'Levantar não conformidades',
        'seguranca',
        [],
        '2026-05-08',
        '2026-05-20',
        '2026-05-13',
        '2026-05-19',
      ),
      task(
        'p03-t2',
        2,
        'p03-a1',
        'Projetar dispositivos de proteção',
        'seguranca',
        [1],
        '2026-05-21',
        '2026-06-10',
        '2026-05-21',
        '2026-06-08',
      ),
      task(
        'p03-t3',
        3,
        'p03-a1',
        'Instalar dispositivos de proteção',
        'seguranca',
        [2],
        '2026-06-11',
        '2026-07-10',
        '2026-06-11',
      ),
      task('p03-t4', 4, 'p03-a1', 'Validar com equipe de segurança', 'seguranca', [3], '2026-07-11', '2026-07-27'),
    ]),
  ],
});

// ---------------------------------------------------------------------------
// P04 — Modernização da Automação — Linha 1 (Concluído, 100%)
// ---------------------------------------------------------------------------
const p04 = project({
  id: 'p04',
  code: 'P04',
  name: 'Modernização da Automação — Linha 1',
  description: 'Substituição do CLP legado e reprogramação da lógica de controle.',
  unit: 'Amélia',
  sector: 'Automação',
  responsible: 'João Pereira',
  createdAt: '2026-03-15T10:00:00.000Z',
  updatedAt: '2026-07-07T10:00:00.000Z',
  activities: [
    activity('p04-a1', 'p04', 'Comissionamento', [
      task(
        'p04-t1',
        1,
        'p04-a1',
        'Levantar requisitos funcionais',
        'automacao',
        [],
        '2026-04-08',
        '2026-04-20',
        '2026-04-10',
        '2026-04-18',
      ),
      task(
        'p04-t2',
        2,
        'p04-a1',
        'Desenvolver lógica de controle',
        'automacao',
        [],
        '2026-04-21',
        '2026-05-20',
        '2026-04-21',
        '2026-05-15',
      ),
      task(
        'p04-t3',
        3,
        'p04-a1',
        'Realizar testes funcionais',
        'automacao',
        [],
        '2026-05-21',
        '2026-06-20',
        '2026-05-21',
        '2026-06-18',
      ),
      task(
        'p04-t4',
        4,
        'p04-a1',
        'Comissionamento com produção',
        'automacao',
        [],
        '2026-06-21',
        '2026-07-07',
        '2026-06-21',
        '2026-07-07',
      ),
    ]),
  ],
});

// ---------------------------------------------------------------------------
// P05 — Implantação da Nova Linha (À iniciar) — estrutura do exemplo de cronograma do spec
// ---------------------------------------------------------------------------
const p05 = project({
  id: 'p05',
  code: 'P05',
  name: 'Implantação da Nova Linha',
  description: 'Implantação de uma nova linha produtiva completa.',
  unit: 'Matriz',
  sector: 'Produção',
  responsible: 'Carlos Henrique',
  createdAt: '2026-07-25T10:00:00.000Z',
  updatedAt: '2026-07-25T10:00:00.000Z',
  activities: [
    activity('p05-a1', 'p05', 'Aquisição do transportador', [
      task('p05-t1', 1, 'p05-a1', 'Solicitar cotações', 'compras', [], '2026-08-03', '2026-08-14'),
      task('p05-t2', 2, 'p05-a1', 'Equalizar propostas', 'compras', [1], '2026-08-15', '2026-08-28'),
      task('p05-t3', 3, 'p05-a1', 'Emitir pedido de compra', 'compras', [2], '2026-08-29', '2026-09-11'),
      task(
        'p05-t4',
        4,
        'p05-a1',
        'Validar documentação internacional',
        'importacao',
        [3],
        '2026-09-12',
        '2026-09-25',
      ),
      task('p05-t5', 5, 'p05-a1', 'Acompanhar desembaraço', 'importacao', [4], '2026-09-26', '2026-10-09'),
    ]),
    activity('p05-a2', 'p05', 'Instalação do transportador', [
      task('p05-t6', 6, 'p05-a2', 'Instalar infraestrutura elétrica', 'eletrica', [5], '2026-10-10', '2026-10-23'),
      task('p05-t7', 7, 'p05-a2', 'Realizar interligações', 'eletrica', [6], '2026-10-24', '2026-11-06'),
      task('p05-t8', 8, 'p05-a2', 'Programar CLP', 'automacao', [7], '2026-11-07', '2026-11-20'),
      task('p05-t9', 9, 'p05-a2', 'Realizar testes funcionais', 'automacao', [8], '2026-11-21', '2026-12-18'),
    ]),
  ],
});

export const SEED_PROJECTS: Project[] = [p01, p02, p03, p04, p05];

export const SEED_CATALOG: ActivityTemplate[] = [
  {
    id: 'cat-aquisicao-compras',
    name: 'Aquisição do equipamento',
    category: 'compras',
    active: true,
    tasks: [
      { id: 'ct-1', name: 'Elaborar requisição de compra' },
      { id: 'ct-2', name: 'Identificar fornecedores' },
      { id: 'ct-3', name: 'Solicitar cotações' },
      { id: 'ct-4', name: 'Equalizar propostas' },
      { id: 'ct-5', name: 'Negociar condições' },
      { id: 'ct-6', name: 'Emitir pedido de compra' },
      { id: 'ct-7', name: 'Acompanhar entrega' },
      { id: 'ct-8', name: 'Conferir recebimento' },
    ],
  },
  {
    id: 'cat-aquisicao-importacao',
    name: 'Aquisição do equipamento',
    category: 'importacao',
    active: true,
    tasks: [
      { id: 'ct-9', name: 'Confirmar especificação' },
      { id: 'ct-10', name: 'Solicitar proposta internacional' },
      { id: 'ct-11', name: 'Validar Incoterm' },
      { id: 'ct-12', name: 'Emitir pedido internacional' },
      { id: 'ct-13', name: 'Preparar documentação' },
      { id: 'ct-14', name: 'Programar embarque' },
      { id: 'ct-15', name: 'Acompanhar desembaraço' },
      { id: 'ct-16', name: 'Programar transporte nacional' },
      { id: 'ct-17', name: 'Receber material' },
    ],
  },
  {
    id: 'cat-instalacao-eletrica',
    name: 'Instalação do equipamento',
    category: 'eletrica',
    active: true,
    tasks: [
      { id: 'ct-18', name: 'Levantar carga elétrica' },
      { id: 'ct-19', name: 'Preparar infraestrutura' },
      { id: 'ct-20', name: 'Instalar eletrocalhas' },
      { id: 'ct-21', name: 'Lançar cabos' },
      { id: 'ct-22', name: 'Instalar painel' },
      { id: 'ct-23', name: 'Realizar interligações' },
      { id: 'ct-24', name: 'Executar testes elétricos' },
    ],
  },
  {
    id: 'cat-instalacao-automacao',
    name: 'Instalação do equipamento',
    category: 'automacao',
    active: true,
    tasks: [
      { id: 'ct-25', name: 'Levantar sinais' },
      { id: 'ct-26', name: 'Elaborar lista de I/O' },
      { id: 'ct-27', name: 'Programar CLP' },
      { id: 'ct-28', name: 'Configurar IHM' },
      { id: 'ct-29', name: 'Configurar rede industrial' },
      { id: 'ct-30', name: 'Realizar testes de comunicação' },
      { id: 'ct-31', name: 'Realizar testes funcionais' },
    ],
  },
];
