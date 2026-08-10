# Especificação da refatoração — Gestão de Projetos Industriais

> **Como usar:** salve este arquivo em `referencia/` na raiz do projeto, junto com os três protótipos HTML.
> Depois, no Claude Code (com plan mode ligado), envie apenas:
>
> *"Leia `referencia/PROMPT-Claude-Code-Gestao-Projetos.md` por completo e siga como especificação. Comece pela FASE 0."*

---

Você é meu parceiro de desenvolvimento. Eu oriento em português; você constrói.

Vamos **refatorar um sistema já existente** de gestão de projetos industriais. O funcionamento está correto — o que vamos mudar é o **modelo de dados**, as **regras de derivação** e o **design** de duas telas: Projetos e Cronograma.

**Stack atual — mantenha, não migre:** Vite + React + TypeScript, Supabase (Postgres + Auth + RLS), deploy na Vercel. Confirme lendo `vite.config.ts`, `package.json` e `src/` antes de planejar. Se em algum ponto desta especificação houver referência a outra stack, prevalece o que está no repositório.

**CONSTRUA EM FASES.** Ao fim de cada fase, faça commit e ESPERE minha aprovação antes da próxima. Antes de qualquer código, me mostre o PLANO. Crie e mantenha um `CLAUDE.md` com estas regras.

Na pasta `referencia/` estão três arquivos HTML que são **protótipos visuais e funcionais** do resultado esperado:

- `Gestao-Projetos-Redesign.html` — tela de Projetos
- `Cronograma-Redesign.html` — tela de Cronograma
- `Gestao-Projetos-Mobile.html` — versão mobile

Eles não são para copiar como código — são a especificação de comportamento e de visual. **Abra e leia os três antes de planejar** e volte a consultá-los em cada fase.

---

## REGRA DE OURO DESTE PROJETO

**Nada que pode ser calculado deve ser campo digitado.**

Campo digitado desatualiza e vira mentira. Se um número pode ser derivado de outro dado que já existe, ele é derivado — em view, função ou no servidor — e nunca é coluna editável. Aplique isso em toda decisão de modelagem daqui pra frente.

---

## FASE 0 — Auditoria (não altere nada ainda)

Antes de mexer em qualquer coisa, faça um **commit do estado atual** e me devolva um relatório:

1. Estrutura das tabelas de projetos, atividades e tarefas — colunas, tipos, constraints e RLS.
2. Onde estão hoje: responsável, percentual de avanço, status, datas previstas e reais.
3. Que telas e componentes consomem esses campos (mapeie os arquivos em `src/`).
4. Como as rotas estão organizadas hoje (React Router? qual versão?).
5. Quantos registros existem em produção, para eu avaliar o risco da migração.
6. Um mapa do que vai quebrar em cada mudança das fases seguintes.

**Corrija ainda nesta fase:** abrir `/dashboard` ou `/cronograma` direto no navegador dá **404 na Vercel**. É SPA sem rewrite configurado — se o usuário der F5 numa rota interna, quebra. Crie um `vercel.json` na raiz:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Confirme também que `dist/` e `node_modules/` estão no `.gitignore`.

---

## FASE 1 — Design system

Crie um `design.md` na raiz e um arquivo de tokens (CSS variables ou config do Tailwind, conforme o que o projeto já usa) com exatamente isto:

### Cores

```css
/* neutros — 90% da interface */
--ink:#0f1720;  --ink2:#334155;  --mut:#64748b;  --mut2:#94a3b8;
--line:#e4e8ee; --line2:#eef1f5; --bg:#f6f7f9;   --card:#ffffff;

/* azul institucional — navegação, botões, seleção e foco */
--navy:#0d2a4f; --navy2:#17456f; --brand:#2563eb; --brand2:#60a5fa;

/* cor SÓ para status — não usar em mais nada */
--atras:#c2410c;  --atras-bg:#fff1e9;   /* atrasado */
--andam:#2563eb;                        /* em andamento */
--concl:#15803d;                        /* concluído */
--plan:#7c3aed;                         /* planejado */
--inic:#64748b;                         /* à iniciar */
```

### Regras de uso de cor — obrigatórias

- A interface é **neutra**. Cor saturada só aparece em status e em alerta.
- O menu lateral é **azul-marinho escuro** (`--navy`), não azul vivo chapado.
- Existem **dois azuis com funções separadas**: o escuro é navegação, o vivo (`--brand`) é status "em andamento", ação e foco. Nunca troque um pelo outro.
- **Laranja é exceção.** É a única cor fora da família azul e existe só para atraso e alerta. Se tudo virar azul, o alerta some.
- **Proibido**: barra colorida decorativa no topo de card, listra lateral sem significado, quadrado colorido que não carrega informação, linha de destaque embaixo de título.

### Tipografia e espaçamento

- Fonte: **Inter** (texto) e **JetBrains Mono** (números, datas, códigos). Números sempre tabulares (`font-variant-numeric: tabular-nums`).
- Escala: título de tela 19–20px/700 · seção 13px/700 · corpo 13–14px · rótulo de coluna 10px/700 caixa alta com `letter-spacing:.06em` · metadado 11px.
- Raio de canto: 7px em controles, 10px em cards.
- Sombra: quase nenhuma. Separação por borda de 1px, não por sombra.
- Linha de tabela: **34px de altura**. Densidade é requisito, não estética — cronograma com linha alta esconde o encadeamento.

### Componentes a padronizar

Card, botão (primário/fantasma), select, chip de status, chip de filtro, tabela densa, mini-gantt, barra de avanço, menu de ações `⋯`, painel lateral, modal, toast com desfazer, tooltip.

**Ao final da fase**, aplique os tokens globalmente e me mostre uma tela antes/depois.

---

## FASE 2 — Modelo de dados e regras de derivação

Esta é a fase mais importante. Migre com cuidado e mantenha backup.

### 2.1 Responsabilidade: dois papéis, não um

| Nível | Campo | Quantos | Significado |
|---|---|---|---|
| Projeto | `gerente_id` | 1, obrigatório | quem **responde** pelo prazo |
| Tarefa | `responsavel_id` | 1, obrigatório | quem **executa** |

- A **equipe do projeto NÃO é campo**. É consulta: `select distinct responsavel_id from tarefas where projeto_id = $1`.
- **Não permita mais de um responsável por tarefa.** Se precisar registrar quem mais participou, crie um campo separado de colaboradores — mas mantenha um único responsável, que é quem responde se atrasar.
- Migração: hoje existe um único "responsável" no projeto. Copie-o para `gerente_id`. Projetos sem gerente devem virar pendência visível — chip laranja "sem gerente" na linha e entrada na lista de atenção —, não texto cinza que passa despercebido.

### 2.2 Avanço: 100% automático, em nenhum nível digitado

- **Tarefa é binária.** Ou tem `fim_real` preenchido (concluída, conta como trabalho entregue), ou não conta. Tarefa **não tem percentual**.
- **Atividade** = trabalho concluído ÷ trabalho total, **ponderado por duração em dias úteis**:

```
peso(tarefa)      = dias_uteis(inicio_previsto, fim_previsto)   -- mínimo 1
avanco(atividade) = Σ peso(tarefas concluídas) / Σ peso(todas as tarefas) × 100
```

- **Projeto** = mesma conta, somando as tarefas de todas as suas atividades.
- Atividade sem tarefa → 0% e o rótulo "sem tarefas" (não `—` repetido).

**Por que ponderado e não por contagem:** uma atividade com 2 de 5 tarefas concluídas parece 40%. Se essas duas somam 22 dos 114 dias úteis, o avanço real é 19%. Contagem simples mentiria em mais do dobro.

**Remova** a coluna de percentual de projeto, atividade e tarefa. Ela vira função/view.

> Isole o cálculo do peso numa única função `peso(tarefa)`. Se no futuro o peso mais fiel for custo ou homem-hora em vez de duração, muda-se uma função só.

### 2.3 Status: derivado das datas, nunca digitado

**Tarefa:**

```
tem fim_real                    → Concluído
hoje > fim_previsto             → Atrasado
tem inicio_real                 → Em andamento
resto                           → Planejado
```

**Atividade e projeto** agregam os filhos:

```
algum filho atrasado                        → Atrasado
todos concluídos                            → Concluído
algum em andamento ou concluído             → Em andamento
resto                                       → Planejado
```

Remova a coluna `status` das três tabelas. Ela vira função. Valide na migração que o status derivado reproduz o status atual — **se divergir em algum registro, me mostre a lista antes de apagar a coluna**.

### 2.4 Datas de projeto e atividade: roll-up

Projeto e atividade **não têm datas próprias**. São calculadas:

```
inicio = min(inicio das tarefas)      fim = max(fim das tarefas)
```

Vale para previsto, real e linha de base. Remova as colunas de data de projeto e atividade.

### 2.5 Linha de base congelada

Três pares de datas na tarefa:

| Campo | O que é | Quem altera |
|---|---|---|
| `base_inicio` / `base_fim` | congelada na aprovação do cronograma | **só administrador**, com motivo |
| `previsto_inicio` / `previsto_fim` | replanejamento vigente | **só administrador**, com motivo |
| `real_inicio` / `real_fim` | execução | qualquer usuário |

- Toda alteração de previsto exige **motivo obrigatório** e grava em `replanejamentos (tarefa_id, quando, quem, de, para, motivo)`.
- A tela mostra selo `R1`, `R2`… ao lado da tarefa indicando quantas vezes a data já foi empurrada.
- No gráfico, a linha de base fica **tracejada** quando o previsto foi movido — assim se distingue "sempre foi essa data" de "essa data já foi empurrada".

**Sem isso o indicador de atraso não vale nada**, porque o atraso desaparece toda vez que alguém "ajusta" a data.

### 2.6 Calendário de dias úteis

- Toda duração, folga de dependência e cálculo de avanço previsto usa **dias úteis**, não dias corridos.
- Crie `feriados (data, unidade_id nullable)` — nulo = feriado nacional. Matriz, MEC e Feira podem ter feriados municipais diferentes.
- Funções no banco: `dias_uteis(a, b)` e `soma_dias_uteis(data, n, unidade)`.
- Exiba duração com sufixo `du` (ex.: `10du`).

### 2.7 Dependências — os quatro tipos

Tabela `dependencias (tarefa_id, predecessora_id, tipo, folga_du)` com `tipo in ('FS','SS','FF','SF')`.

| Tipo | Regra (em dias úteis) |
|---|---|
| **FS** Fim → Início | `inicio(suc) ≥ soma_du(fim(pred), 1 + folga)` |
| **SS** Início → Início | `inicio(suc) ≥ soma_du(inicio(pred), folga)` |
| **FF** Fim → Fim | `fim(suc) ≥ soma_du(fim(pred), folga)` |
| **SF** Início → Fim | `fim(suc) ≥ soma_du(inicio(pred), folga)` |

Travas obrigatórias:

- **Anti-ciclo**: a predecessora não pode depender, direta ou indiretamente, da tarefa atual. Valide no servidor, não só na tela.
- Predecessora só pode ser tarefa **do mesmo projeto**.
- Violação **não bloqueia o salvamento** — sinaliza. O cronograma real tem conflitos e o sistema precisa mostrá-los, não escondê-los.

### 2.8 Numeração

Só tarefa recebe número, sequencial dentro do projeto. Atividade e projeto não têm.

---

## FASE 3 — Tela de Projetos

Referência: `referencia/Gestao-Projetos-Redesign.html`.

### O que está errado hoje e precisa mudar

1. **Seis cards de KPI com o mesmo peso visual.** "Total: 8" grita tanto quanto "Atrasado: 3", e só um exige ação. Substitua por: **um número grande** (projetos atrasados, com o pior desvio em dias) + **uma barra empilhada** com a distribuição dos status.
2. **Quadrados coloridos que não informam nada** — remova. A faixa colorida no topo do card também.
3. **Legenda órfã** flutuando sem gráfico. Ou ela vira legenda de algo real, ou sai.
4. **Datas em texto corrido em corpo 10px.** Vire colunas alinhadas com cabeçalho.
5. **Ações escondidas no hover** com ícone de 12px — invisível no touch. Troque por menu `⋯` **sempre visível**.

### Como deve ficar

- **Faixa de saúde**: número de atrasados em destaque + barra empilhada clicável (filtra) + chips de status que são legenda e filtro ao mesmo tempo.
- **Botão "Limpar filtros"** que só aparece quando há filtro ativo e mostra a **quantidade** de filtros ligados (busca, unidade, ano, status).
- **Tabela** com colunas: Projeto (código + nome + unidade + gerente + avatares da equipe) · Status · Cronograma (mini-gantt no tempo, com marcador de hoje) · Avanço real x previsto · Desvio · Ações.
- **Avatares da equipe** derivados das tarefas; quem tem tarefa atrasada nesse projeto aparece destacado em laranja.
- **Ordenação padrão por criticidade**, não por ordem de cadastro.
- **Painéis laterais**: "Atenção nos próximos 30 dias" e "Carga por pessoa" — esta contando **tarefas por pessoa**, não projetos, que é a medida real de quem está afogado.

### Edição — três caminhos, três frequências

1. **Inline na lista**: o campo que muda toda semana (data de fim real da tarefa) editável direto, sem abrir tela.
2. **Painel lateral** ao clicar na linha: leitura por padrão, botão Editar. Painel, não modal — a lista continua visível atrás e fecha com Esc.
3. **Menu `⋯`**: Editar · Ver atividades · Duplicar · Mover para Excluídos.

**Exclusão não pergunta "tem certeza?".** Executa e mostra **Desfazer** por 6 segundos. Confirmação atrapalha todo mundo para prevenir o erro raro; desfazer não atrapalha ninguém. Como já existe a página "Excluídos", é **soft delete** — o texto do botão deve dizer "Mover para Excluídos", não "Excluir".

---

## FASE 4 — Tela de Cronograma

Referência: `referencia/Cronograma-Redesign.html`. É a tela mais complexa; trate como sub-fases.

### O que está errado hoje

1. Projeto, atividade e tarefa saem com **a mesma barra azul-clara** — a hierarquia some no gráfico.
2. A legenda promete "Previsto · Real · Dependência" e **nenhum dos três está desenhado**.
3. **Nenhuma dependência aparece** — que é o motivo de existir um Gantt em vez de uma lista.
4. A linha vertical de hoje **não tem rótulo** e ninguém sabe o que é.
5. Linhas de ~55px mostram 10 registros por tela.
6. A coluna Status repete a mesma palavra em todas as linhas — ruído puro.
7. Sem grade vertical, não dá para ler onde a barra começa.
8. A "visão completa" empurra o Gantt para uma faixa inútil no canto direito.

### Como deve ficar

**Barras por nível:**
- Projeto e atividade: barra-resumo escura (`--navy`), com pontas em cunha, e preenchimento claro mostrando o avanço derivado.
- Tarefa: barra sólida colorida pelo status, sem preenchimento de percentual (tarefa não tem percentual).
- Linha de base: barra fina cinza abaixo, tracejada quando o previsto foi replanejado.
- Excesso além do previsto: hachurado em laranja, continuando a barra.
- Marco: losango.

**Dependências:** setas ligando as tarefas, saindo e chegando no ponto correto conforme o tipo (FS/SS/FF/SF). Rótulo com o tipo e a folga quando não for `FS+0`. **Violada = seta laranja tracejada**, e o rodapé conta quantas existem.

**Eixo do tempo:** zoom Dia / Semana / Mês. Cabeçalho de dois níveis. Fim de semana sombreado nos zooms de dia e semana. Linha de **hoje em azul com etiqueta fixa** e botão "Ir para hoje".

**Painel esquerdo:**
- Modo compacto: Linha · Estrutura · Avanço.
- Modo completo (checkbox): + Categoria · Responsável · Base · Real · Duração.
- Datas em **intervalo numa coluna só** (`26/08/26 → 17/01/27`), não quatro colunas separadas.
- Na coluna Avanço, **tarefa mostra o status** (não "0%", que seria número falso); atividade e projeto mostram o percentual derivado com micro-barra.

> **Atenção a um bug do protótipo que você deve evitar:** a largura do painel esquerdo precisa ser **calculada somando as colunas**, nunca escrita à mão. Se divergir, as colunas vazam por cima do gráfico. Derive de uma lista de colunas única.

**Tooltip** na barra: base, previsto, real, avanço com a razão (`2/5 tarefas · 22/114du`), responsável, dependências com folga ou conflito, e dias além do previsto.

### Criação direto no cronograma (só administrador)

- Botão **`+`** que aparece no hover da linha: no projeto cria **atividade**, na atividade cria **tarefa**, já com o contexto preenchido.
- Botão **"＋ Novo item"** no topo para quando a linha não está à vista.
- **Atividade nasce sem datas** — elas vêm das tarefas. Não peça data na criação de atividade.

### Editor de predecessoras

Linha com: qual tarefa · qual tipo · folga em dias úteis · remover.

Ao escolher, mostre a **data sugerida pela regra** ("pela regra, o início deve ser a partir de 29/12/26") com botão **Aplicar**, que preenche mantendo a duração já definida. Se a data atual conflita com a regra, a faixa fica laranja e explica o conflito em vez de aceitar em silêncio.

O select de predecessoras **só lista tarefas que não dependem da atual** (anti-ciclo aplicado na própria interface).

---

## FASE 5 — Permissões

Dois perfis, com RLS no Supabase — não apenas escondendo botão na tela.

| Ação | Usuário | Administrador |
|---|---|---|
| Ver tudo | ✅ | ✅ |
| Informar `real_inicio` / `real_fim` | ✅ | ✅ |
| Criar/editar/excluir atividade e tarefa | ❌ | ✅ |
| Alterar previsto ou linha de base | ❌ | ✅ com motivo |
| Editar dependências | ❌ | ✅ |

Campos bloqueados aparecem com **cadeado**, desabilitados, com aviso explicando de quem é a atribuição — não simplesmente sumindo da tela.

---

## FASE 6 — Mobile

Referência: `referencia/Gestao-Projetos-Mobile.html`. **Não é o desktop encolhido.**

- Tabela vira **card**. Onze colunas não cabem num celular.
- Painel lateral vira **bottom sheet**.
- **Quatro abas**: Resumo · Projetos · Cronograma · Equipe.
- O **mini-gantt sobrevive** — é a informação mais densa por pixel e cabe em 22px de altura.
- Chips de status são legenda e filtro ao mesmo tempo; tocar em "Atrasado" leva direto à lista filtrada.
- Áreas de toque de no mínimo 44px.

---

## FASE 7 — Validações, QA e fechamento

### Travas obrigatórias (servidor, não só navegador)

- `fim_previsto ≥ inicio_previsto` — hoje é possível cadastrar projeto com início e fim no mesmo dia, o que zera a duração e quebra o cálculo de avanço previsto (divisão por zero).
- `fim_real ≥ inicio_real`.
- Gerente do projeto obrigatório.
- Responsável da tarefa obrigatório.
- Não excluir atividade que tenha tarefas.
- Não excluir tarefa que seja predecessora de outra — a mensagem deve dizer quantas dependem.
- Anti-ciclo em dependências.
- Motivo obrigatório ao alterar previsto ou base.

### QA

1. Rode a migração num branch do Supabase antes da produção.
2. Compare status e avanço derivados com os valores atuais — me mostre as divergências antes de remover as colunas.
3. Teste com dados extremos: projeto sem atividade, atividade sem tarefa, tarefa de 1 dia, cadeia de 5 dependências, tarefa com início = fim.
4. Auditoria de segurança: RLS em todas as tabelas, nenhum segredo no código, endpoints validando entrada, cadastro público desligado.
5. Confirme o rewrite de SPA na Vercel — `/cronograma` e `/dashboard` precisam funcionar em acesso direto e no F5.

---

## COMO TRABALHAR COMIGO

- Antes de construir qualquer coisa, me mostre o **PLANO** e espere aprovação.
- **Uma fase por vez.** Não adiante fase seguinte.
- Explique tudo em português simples. Quando der erro, explique antes de corrigir.
- Commit ao fim de cada fase, com mensagem clara (`feat/fix/refactor/chore`). **Não dê push sem eu revisar.**
- Não altere o que eu não pedi.
- Mantenha o `CLAUDE.md` e o `design.md` atualizados a cada fase.
- Use a versão mais recente de cada biblioteca; confira a documentação oficial atual antes de integrar.

**Comece pela FASE 0 — a auditoria. Não construa nada antes da minha aprovação.**
