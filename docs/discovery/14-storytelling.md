# 14 — Storytelling do Projeto (STAR)

> Narrativa para entrevistas/pitch. Baseada em evidências deste repositório. Onde há número,
> está marcado **A VALIDAR** (não inventar métricas).

---

## STAR

### Situação
Barbearias pequenas gerenciam agenda no WhatsApp e no caderno. Isso gera faltas (no-show),
zero visão de faturamento e sobrecarrega o dono, que vira gargalo — cada horário depende
dele responder mensagem. Não havia ferramenta que resolvesse isso **sem custo mensal** e
**sem obrigar o cliente a baixar app**.

### Tarefa
Construir, como desenvolvedor solo e com orçamento zero, um SaaS multi-tenant de agendamento
onde: o cliente marca pelo link em segundos (sem app), o dono controla agenda/financeiro/equipe,
e o sistema ataca ativamente a maior dor — as faltas.

### Ação
- Modelei um domínio multi-tenant (Owner → Shop → Barber, Client global por telefone) com
  13 entidades no Postgres/Prisma. `[08-modelo-de-dados]`
- Entreguei o fluxo de agendamento público por etapas com cálculo inteligente de horários
  (duração, conflito, dias, bloqueios, limite diário). `[slots/route.ts, appointments/route.ts]`
- Ataquei o no-show com uma regra automática: 2 faltas → pré-pagamento Pix. `[RN-011]`
- Adicionei retenção: fidelidade (10=1), lista de espera, avaliações, reagendamento. `[06-regras]`
- Fechei segurança para escalar: rate limiting, CORS, headers, isolamento multi-tenant
  (inclusive corrigindo um vazamento entre lojas no reset de barbeiro). `[middleware.ts, ADR-004]`
- Tornei o produto "app-like" via PWA com service worker network-first (deploy aparece na hora).
- Criei um smoke test de produção (9 checagens) para nunca mais subir deploy quebrado.
- Diante do free tier (cron 1x/dia) e da WhatsApp API instável, troquei a promessa frágil de
  lembrete automático por um caminho **confiável e zero-custo**: botão de lembrete manual via
  WhatsApp. Pragmatismo sobre perfeição.

### Resultado
- Produto **em produção técnica**, em **fase pré-lançamento** (0 clientes pagantes): estratégia
  de piloto com um amigo barbeiro para validar e depois escalar às lojas. `[CONFIRMADO: Elias, resposta P1]`
- Custo operacional **R$ 0** (Supabase + Vercel free tier). `[CONFIRMADO: CLAUDE.md:19]`
- Base funcional ampla (agendamento, painel, financeiro, fidelidade, waitlist, avaliações)
  validada por smoke test verde. `[scripts/smoke.mjs]`
- Números de adoção/retenção/faturamento: **A VALIDAR** (sem instrumentação — ver `10-metricas`).

---

## 5 perguntas prováveis de entrevista (e como responder)

**1. "Como você priorizou o que construir com recurso zero e sozinho?"**
> Foquei na dor que dava prejuízo direto — as faltas — e na remoção de atrito de adoção
> (cliente sem app). Depois camadas de retenção (fidelidade, waitlist). Uso RICE para ordenar
> conversa, mas quick wins de confiança (dinheiro correto, limite de agenda) vêm antes.
> Evidência: `12-roadmap` e a regra anti-no-show `RN-011`.

**2. "Conte uma decisão em que você escolheu o pragmático sobre o ideal."**
> O lembrete automático. O ideal era cron frequente + WhatsApp API. Mas o free tier limita
> cron a 1x/dia e a API estava instável. Em vez de prometer algo que falharia, entreguei um
> botão de lembrete manual via WhatsApp — confiável, zero custo, e que o barbeiro controla.
> Evidência: `ADR-008`, `ADR-009`, jornada 3.

**3. "Como você garante qualidade sem um time de QA?"**
> Criei um smoke test de produção sem dependências que valida os fluxos críticos em ~5s após
> cada deploy (barbearia carrega, horários, booking vivo, login, páginas). Roda com um comando.
> Evidência: `scripts/smoke.mjs`, 9/9 verde.

**4. "Qual risco de produto você identificou e como mitigou?"**
> Privacidade: o cliente acessa agendamentos só pelo telefone, sem verificação — risco LGPD.
> Mitigação proposta e priorizada: código de verificação por WhatsApp antes de listar (B2 no
> backlog). Também corrigi em código um vazamento multi-tenant real (dono editava barbeiro de
> outra loja por ID). Evidência: `11-riscos` R3/R4, `ADR-004`.

**5. "Se assumisse esse produto amanhã, o que faria primeiro?"**
> Três coisas: (1) migrar dinheiro de Float para Decimal — confiança no financeiro; (2) fechar
> a privacidade do cliente antes de escalar; (3) instrumentar analytics, porque hoje não
> medimos conversão nem retenção — decidimos no escuro. Só depois, monetização (Pix real) e
> canais (Google Play). Evidência: `10-metricas`, `12-roadmap` horizonte "Agora".

---

## Frase-síntese (para abrir o pitch)
> "Peguei a dor mais cara de uma barbearia — a cadeira vazia por falta — e transformei num
> produto que o cliente usa sem baixar nada e o dono opera de graça, com regras de negócio
> que atacam a falta em vez de só registrar a agenda."
