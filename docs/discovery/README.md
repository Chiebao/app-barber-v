# Discovery Reverso — BarberPro

Documentação de produto reconstruída a partir do código (discovery reverso), no nível que
um Product Owner sênior exigiria antes de assumir o produto.

> **Convenção:** cada afirmação é `[CONFIRMADO: arquivo]` (extraído do código) ou `[INFERIDO]`
> (interpretação). O que o código não responde está como **A VALIDAR** e listado em
> [13-perguntas-abertas](13-perguntas-abertas.md). Nenhuma métrica de uso/receita foi inventada.

---

## Sumário executivo (1 página)

**O que é.** BarberPro é um SaaS multi-tenant de agendamento para barbearias. Cada barbearia
tem um link próprio (`/slug`) onde o cliente marca horário pelo celular **sem instalar app**.
O dono/barbeiro gerencia agenda, pagamentos, clientes e equipe por um painel web (PWA) ou app
Android. Roda com **custo operacional R$ 0** (Supabase + Vercel free tier). `[CONFIRMADO: README.md, CLAUDE.md]`

**Para quem.** Donos de barbearias pequenas (1–5 barbeiros), seus barbeiros, e o cliente final.
Papéis reais no sistema: `owner`, `barber` e `client` (sem login, identificado por telefone).

**A dor que resolve.** Faltas (no-show), ausência de visão de faturamento e o dono como gargalo
do agendamento. O sistema ataca a falta com uma regra automática (2 faltas → pré-pagamento Pix),
dá dashboard financeiro ao dono e tira o dono do meio com o link público.

**Estado.** Em produção (`barberpro-mauve.vercel.app`) e em início de comercialização, com pelo
menos um cliente pagante real. Base funcional ampla (agendamento, painel, financeiro, fidelidade,
lista de espera, avaliações, notificações, PWA) validada por smoke test. `[CONFIRMADO: scripts/smoke.mjs]`

**Diferenciais.** Cliente sem app; marca própria por barbearia (slug, tema, logo); anti-no-show
automático; fidelidade e lista de espera embutidas; custo zero.

**Principais riscos.** (1) Lembrete automático frágil no free tier; (2) dinheiro em `Float`
(risco de relatório não bater); (3) privacidade do cliente (acesso só por telefone, sem
verificação); (4) isolamento multi-tenant depende de disciplina no código.

**Onde focar agora.** Confiança e higiene: dinheiro em `Decimal`, corrigir cálculo de limite
diário, fechar privacidade do cliente e resolver a confiabilidade do lembrete. Depois:
monetização (Pix real), analytics e canais (Google Play). Detalhe em [12-roadmap](12-roadmap-e-backlog.md).

**O que só o dono do produto responde.** Volume real de barbearias/clientes, modelo de cobrança,
postura LGPD e metas — ver [13-perguntas-abertas](13-perguntas-abertas.md) (itens 🔴 bloqueiam escala).

---

## Índice

| # | Artefato | O que responde |
|---|----------|----------------|
| 00 | [Visão de Produto](00-visao-produto.md) | Problema, público, proposta de valor, pitch |
| 01 | [Contexto e Problema](01-contexto-e-problema.md) | Dor original, baseline, por que construir |
| 02 | [Personas e Stakeholders](02-personas-e-stakeholders.md) | Quem usa, decide e é impactado |
| 03 | [Escopo e MVP](03-escopo-e-mvp.md) | Dentro/fora, MVP vs. evolução |
| 04 | [Mapa de Funcionalidades](04-mapa-de-funcionalidades.md) | Todas as features + status |
| 05 | [Jornadas e Fluxos](05-jornadas-e-fluxos.md) | Fluxos ponta a ponta (Mermaid) + fricções |
| 06 | [Regras de Negócio](06-regras-de-negocio.md) | RN-001..RN-046 com origem no código |
| 07 | [User Stories](07-user-stories.md) | Épicos, histórias e critérios (Gherkin) |
| 08 | [Modelo de Dados](08-modelo-de-dados.md) | ER (Mermaid), ciclo de vida, glossário |
| 09 | [Decisões Técnicas](09-decisoes-tecnicas.md) | ADR-001..ADR-012 |
| 10 | [Métricas e Sucesso](10-metricas-e-sucesso.md) | North Star, o que é medível vs. a instrumentar |
| 11 | [Riscos, Premissas e Dívidas](11-riscos-premissas-dividas.md) | CSD, riscos, débitos com impacto de produto |
| 12 | [Roadmap e Backlog](12-roadmap-e-backlog.md) | Backlog RICE + 3 horizontes |
| 13 | [Perguntas Abertas](13-perguntas-abertas.md) | O que só o dono do produto responde |
| 14 | [Storytelling](14-storytelling.md) | Narrativa STAR + 5 perguntas de entrevista |

---

## Como este documento foi produzido
Leitura de `README.md`, `CLAUDE.md`, `GUIA_COMPLETO.md`, `schema.prisma`, rotas em
`web/src/app/api/**`, páginas em `web/src/app/**` e o estado atual do repositório. Divergências
encontradas entre o `CLAUDE.md` e o código atual (ex.: JWT 7d vs. 30d, cron 1x/dia vs. 30min,
domínio, itens já entregues listados como pendentes) estão sinalizadas nos artefatos e devem
ser corrigidas no `CLAUDE.md` (item B11 do backlog).
