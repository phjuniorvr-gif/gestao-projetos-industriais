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

Linha de tabela: **34px de altura**. Esta régua **não foi aplicada retroativamente** nas tabelas atuais (`ProjectsPage`, `ActivitiesPage`, Gantt) porque essas telas são reescritas do zero nas Fases 3 e 4 do spec — aplicar agora seria refazer duas vezes o mesmo trabalho. Fica registrado aqui como requisito obrigatório para quando essas telas forem reconstruídas: densidade é requisito, não estética — cronograma com linha alta esconde o encadeamento.

## Componentes já padronizados nesta fase

`Button`, `Card`, `Input`, `Select`, `Textarea`, `Checkbox`, `Badge`/`StatusBadge`, `EmptyState`, `Skeleton`, `ConfirmDialog`, `FormField` (`src/components/ui/`) — cores, raio e foco herdados dos tokens acima. `Sidebar` (azul institucional, sem mudança de código, só de token). `PageHeader` (escala tipográfica). `TodayLine` do Gantt recebeu o azul de ação no lugar do laranja de atraso (a linha de "hoje" é azul por regra explícita do spec; o rótulo fixo e o botão "Ir para hoje" são entrega da Fase 4).

## Ainda não existem — entregas das Fases 3/4

Estes itens da lista "Componentes a padronizar" do spec são **comportamento novo**, não uma tela existente para restilizar — nascem já com os tokens acima quando forem construídos:

- **Mini-gantt** na coluna "Cronograma" da tabela de Projetos (Fase 3).
- **Menu de ações `⋯` sempre visível** (Fase 3), substituindo os ícones que hoje só aparecem no hover.
- **Painel lateral** de detalhe/edição (Fase 3) — painel, não modal; lista continua visível atrás, fecha com Esc.
- **Modal de replanejamento** com motivo obrigatório (Fase 2.5/4).
- **Toast com desfazer** de 6s (Fase 3, exclusão de projeto/atividade).
- **Tooltip** de barra do Gantt (Fase 4).
