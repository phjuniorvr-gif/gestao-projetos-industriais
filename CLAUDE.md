# CLAUDE.md

Regras de processo para a refatoração em andamento neste repositório. Especificação completa em `referencia/PROMPT-Claude-Code-Gestao-Projetos.md`; protótipos visuais/funcionais em `referencia/*.html`.

## Regra de ouro

**Nada que pode ser calculado deve ser campo digitado.** Se um número ou data pode ser derivado de outro dado que já existe, ele é derivado — em view, função ou no servidor — e nunca é coluna editável. Aplicar isso em toda decisão de modelagem.

## Stack (manter, não migrar)

Vite + React + TypeScript, Supabase (Postgres + Auth + RLS), deploy na Vercel. Confirmar em `vite.config.ts`/`package.json`/`src/` antes de qualquer mudança — se a especificação mencionar outra stack, prevalece o que está no repositório.

## Como trabalhar

- **Construir em fases.** Uma fase por vez — não adiantar a fase seguinte.
- Antes de qualquer código, mostrar o **plano** e esperar aprovação.
- Commit ao fim de cada fase, mensagem clara (`feat/fix/refactor/chore`). **Não dar push sem revisão do usuário.**
- Explicar em português simples. Quando der erro, explicar antes de corrigir.
- Não alterar o que não foi pedido.
- Manter este arquivo e o `design.md` (a partir da Fase 1) atualizados a cada fase.
- Usar a versão mais recente de cada biblioteca; conferir documentação oficial antes de integrar.

## Roteiro das fases

0. Auditoria (concluída — ver commit de baseline).
1. Design system (`design.md` + tokens).
2. Modelo de dados e regras de derivação (responsabilidade, avanço, status, roll-up de datas, linha de base, calendário de dias úteis, dependências FS/SS/FF/SF, numeração).
3. Tela de Projetos.
4. Tela de Cronograma.
5. Permissões (RLS por perfil).
6. Mobile.
7. Validações, QA e fechamento.

## Decisões em aberto (levantadas na auditoria, a alinhar antes da fase correspondente)

- `useProjects.removeActivity()` hoje cascade-deleta as tarefas da atividade e renumera. A Fase 7 do spec pede o oposto: bloquear exclusão de atividade que tenha tarefas. Alinhar com o usuário antes de implementar a trava.
