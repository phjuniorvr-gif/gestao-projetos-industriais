# design.md

Sistema de design aplicado a partir da Fase 1 da refatoração. Espelha as regras de `referencia/PROMPT-Claude-Code-Gestao-Projetos.md`, adaptadas ao que o app já usa (Tailwind v4, tokens via `@theme` em `src/index.css`).

## Cores

Os nomes de token abaixo são os que já existiam no app antes da Fase 1 — só os **valores** foram trocados para bater com a paleta do spec, para não precisar renomear classes em ~40 arquivos. Onde o spec introduz uma cor sem equivalente anterior, o token é novo.

| Token (`--color-*` em `src/index.css`) | Classe Tailwind | Hex | Uso |
|---|---|---|---|
| `text` | `text-text` / `bg-text` | `#0f1720` | Texto principal (equivale ao `--ink` do spec) |
| `text-ink2` | `text-text-ink2` | `#334155` | Texto secundário de maior ênfase que `text-muted` |
| `text-muted` | `text-text-muted` | `#64748b` | Texto secundário — **único tom aprovado para texto legível de baixo destaque** |
| `text-muted2` | `text-text-muted2` | `#94a3b8` | **Só ícone, borda e placeholder — nunca texto legível** (ver regra de contraste abaixo) |
| `border` | `border-border` | `#e4e8ee` | Borda padrão |
| `border-2` | `border-border-2` | `#eef1f5` | Borda mais sutil (divisores internos) |
| `page` | `bg-page` | `#f6f7f9` | Fundo da página |
| `card` | `bg-card` | `#ffffff` | Fundo de card/painel |
| `sidebar` / `sidebar-dark` | `bg-sidebar` / `bg-sidebar-dark` | `#0d2a4f` / `#123a63` | Menu lateral — azul institucional escuro (`--navy`/`--navy2` do spec), não azul vivo |
| `action` | `bg-action` / `text-action` | `#2563eb` | Azul vivo — ação, foco, seleção e status "em andamento" (`--brand`) |
| `action-2` | `bg-action-2` | `#60a5fa` | Azul vivo claro (`--brand2`), para preenchimento/realce sutil |
| `status-delayed` | `bg-status-delayed` / `text-status-delayed` | `#c2410c` | **A única cor fora da família azul.** Serve tanto para status "Atrasado" quanto para alerta/erro genérico (validação, exclusão, campo obrigatório) — é assim que o spec define essa cor: "existe só para atraso e alerta" |
| `status-delayed-bg` | `bg-status-delayed-bg` | `#fff1e9` | Fundo do chip de atraso |
| `status-progress` | `bg-status-progress` | `#2563eb` | Status "Em andamento" — mesmo azul de `action`, de propósito (spec: nunca trocar os dois azuis entre si, mas "em andamento" É o azul vivo) |
| `status-done` | `bg-status-done` | `#15803d` | Status "Concluído" |
| `status-planned` | `bg-status-planned` | `#7c3aed` | Status "Planejado" |
| `status-idle` | `bg-status-idle` | `#a3a3a3` | Cinza neutro — hoje ainda ligado ao status "À iniciar", que sai do modelo na Fase 2 |

### Regras de uso — obrigatórias

- A interface é **neutra**. Cor saturada só aparece em status e alerta.
- **Dois azuis, funções separadas**: `sidebar`/`sidebar-dark` é navegação; `action` é ação/foco/seleção/"em andamento". Nunca um pelo outro.
- **Laranja (`status-delayed`) é a única exceção** à família azul — cobre atraso E alerta (erro de validação, exclusão, campo obrigatório). Não existe uma terceira cor "de perigo" separada.
- **Proibido**: barra colorida decorativa no topo de card, listra lateral sem significado, quadrado colorido que não carrega informação, linha de destaque embaixo de título, sombra decorativa (separação é por borda de 1px).
- **Regra de contraste do `text-muted2` (`#94a3b8`)**: contraste ~2,8:1 sobre branco, abaixo do mínimo de 4,5:1 do WCAG AA para texto pequeno. Uso permitido: **ícone, borda, placeholder**. Texto que precisa ser lido usa sempre `text-muted` (`#64748b`), que passa no contraste.

## Tipografia

- Fonte de texto: **Inter** (pesos 400/500/600/700/800, via `@fontsource/inter`, self-hosted).
- Fonte de números/datas/códigos: **JetBrains Mono** (pesos 400/500/600, via `@fontsource/jetbrains-mono`). Aplicar com `font-mono` + `tabular-nums` (utilitário nativo do Tailwind) em qualquer número, data ou código exibido.
- Escala:
  - Título de tela: `text-xl` (20px) / `font-bold` — `PageHeader.tsx`.
  - Subtítulo de tela: **13px** (`text-[13px]`) / `text-text-muted` — não usar 12px aqui; os 11px do spec são para rodapé/legenda, não para subtítulo.
  - Seção: 13px / 700.
  - Corpo: 13–14px.
  - Rótulo de coluna: 10px / 700, caixa alta, `letter-spacing:.06em`.
  - Metadado/rodapé/legenda: 11px.

## Raio e espaçamento

- Controles (botão, input, select): **7px** — token `--radius-md: 7px` em `src/index.css`, herdado automaticamente por tudo que usa `rounded-md`.
- Cards: **10px** — token `--radius-xl: 10px`, herdado por tudo que usa `rounded-xl`.
- Foco: anel azul suave `focus:ring-[3px] focus:ring-action/[0.13]` + borda `focus:border-action` (Input, Select, Textarea).

## Sombra

Quase nenhuma. Separação por borda de 1px (`border-border`), não por sombra. `Card` não tem sombra; hover de card usa realce de borda (`hover:border-text-muted2`), não `shadow-md`.

## Densidade de tabela — regra para as Fases 3/4

Linha de tabela: **34px de altura** vale pra linha de **dado simples** — uma informação por coluna, sem gráfico embutido (ex.: lista de atividades do painel lateral, tabela do Gantt na Fase 4: densidade ali é requisito, não estética — cronograma com linha alta esconde o encadeamento).

**Correção feita na Fase 3, ao construir a tabela de Projetos de verdade**: a linha da tabela de Projetos embute mini-gantt de 2 trilhas (previsto/real) + bloco de avanço com barra e texto de delta — não cabe em 34px sem esvaziar a informação que a própria spec pede pra essa coluna. Régua real usada: **~64px** (altura do conteúdo, sem valor fixo forçado — cada linha cresce até caber Projeto/Cronograma/Avanço). 34px continua valendo como regra padrão pra qualquer linha sem visualização embutida; a tabela de Projetos é a exceção documentada, não a régua geral revogada.

## Componentes já padronizados nesta fase

`Button`, `Card`, `Input`, `Select`, `Textarea`, `Checkbox`, `Badge`/`StatusBadge`, `EmptyState`, `Skeleton`, `ConfirmDialog`, `FormField` (`src/components/ui/`) — cores, raio e foco herdados dos tokens acima. `Sidebar` (azul institucional, sem mudança de código, só de token). `PageHeader` (escala tipográfica). `TodayLine` do Gantt recebeu o azul de ação no lugar do laranja de atraso (a linha de "hoje" é azul por regra explícita do spec; o rótulo fixo e o botão "Ir para hoje" são entrega da Fase 4).

## Entregues na Fase 3

- **Mini-gantt** (`MiniGantt.tsx`) na coluna "Cronograma" da tabela de Projetos — autoescalado no período do próprio projeto, reusado também no painel lateral.
- **Menu de ações `⋯` sempre visível** (`ProjectActionsMenu.tsx`), substituindo os ícones que só apareciam no hover.
- **Painel lateral** de detalhe/edição (`ProjectDetailPanel.tsx`) — painel, não modal; lista continua visível atrás, fecha com Esc.
- **Toast com desfazer** de 6s (`useUndoToast`/`UndoToast.tsx`) — genérico, nasceu pra exclusão de projeto, pronto pra reusar sem alteração na exclusão de atividade (Fase 4/próxima, já prevista no CLAUDE.md).

## Entregues na Fase 2.5

- **Replanejamento com motivo obrigatório, sem modal** — os campos "Início/Fim previsto" e "Início/Fim linha de base" do `TaskPanel.tsx` viram rascunho comparado contra o valor salvo; qualquer mudança real revela inline (dentro do próprio painel lateral, sem overlay novo) uma textarea "Motivo do replanejamento" + botão "Confirmar alteração". A spec original imaginava modal; ficou inline porque o painel lateral (Fase 3) já é o lugar natural de edição de tarefa, e um modal-sobre-painel duplicaria a camada sem necessidade.
- **Selo `R{n}`** (fundo `bg-action/10`, texto `text-action`, pílula `rounded-full`) — conta quantas vezes o previsto já foi empurrado; aparece no cabeçalho do `TaskPanel` e ao lado do nome da tarefa em `GanttRow.tsx`.
- **Lista "Histórico de replanejamento"** no rodapé do `TaskPanel` (quando/quem/campo+data/de→para/motivo), visível só quando a tarefa já tem `R{n} > 0`.

## Entregues na Fase 2.7

- **Editor de predecessoras em linhas**, dentro do `TaskPanel.tsx` — cada dependência é uma linha (número da tarefa · tipo FS/SS/FF/SF · folga em dias úteis · remover), com "+ Adicionar predecessora" no fim. Substitui o campo de texto único (`TaskDependencyInput.tsx`, que só aceitava números separados por vírgula, sempre `FS+0`) — esse componente continua existindo só pro wizard de criação (`SelectedActivitiesList.tsx`).
- **Selo de conflito de dependência** — triângulo laranja (`AlertTriangle`, cor `text-status-delayed`) com texto no `TaskPanel` ("Previsto em conflito com a regra de alguma dependência") e só o ícone com `title` em `GanttRow.tsx`, ao lado do selo `R{n}`. Aparece quando `hasDependencyViolation` é `true` — sinaliza, não impede salvar.

## Ainda não existem — entregas de fases futuras

- **Barra tracejada de linha de base** no Gantt, quando previsto ≠ base (Fase 4 — desenho de timeline).
- **Tooltip** de barra do Gantt (Fase 4).
- **Setas de dependência no Gantt** (linha ligando predecessora↔sucessora, rótulo com tipo+folga, seta tracejada quando violada, contador no rodapé) e a **data sugerida pela regra com botão "Aplicar"** no editor de predecessoras — ambos Fase 4.
