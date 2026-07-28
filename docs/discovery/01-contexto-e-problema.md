# 01 — Contexto e Problema

## A dor original

Barbearias pequenas operam a agenda de forma informal: mensagens de WhatsApp, ligações
e caderno. Isso gera três problemas que o código do BarberPro ataca diretamente:

1. **Faltas (no-show)** — cliente marca e não aparece, gerando buraco na agenda e prejuízo.
   → O sistema tem contador de faltas por cliente e força pré-pagamento após 2 faltas.
   `[CONFIRMADO: schema.prisma:115 (noShowCount), appointments/route.ts:62-66]`
2. **Falta de visão de faturamento** — o dono não sabe quanto faturou, ticket médio, ou qual
   barbeiro rende mais. → O sistema tem dashboard com KPIs e relatório financeiro por período.
   `[CONFIRMADO: me/dashboard/route.ts, me/finance/route.ts]`
3. **Dono como gargalo do agendamento** — cada horário depende de o dono responder.
   → O link público deixa o cliente se agendar sozinho. `[CONFIRMADO: [slug]/page.tsx]`

## Custo do problema

- Cada falta = uma cadeira ociosa que poderia estar faturando. Valor exato por barbearia: **A VALIDAR**.
- Tempo do dono gasto respondendo mensagens para marcar horário: **A VALIDAR**.
- Não há, no código, nenhuma métrica histórica que quantifique esse custo. **A VALIDAR**.

## O que existia antes (baseline)

`[INFERIDO — não há documento de pesquisa; deduzido das features]`

- Agenda no **WhatsApp / caderno / planilha**.
- Cobrança de sinal (quando existia) feita manualmente por Pix, sem controle.
- Fidelidade "de cabeça" ou cartão físico carimbado.
- Nenhum relatório — o faturamento era estimado.

## Por que construir em vez de comprar

`[INFERIDO a partir das decisões técnicas — CLAUDE.md:569-587]`

- **Custo:** concorrentes de mercado (ex.: agendadores SaaS) cobram mensalidade por
  profissional; o objetivo aqui foi **custo zero de operação** (free tier). `[CONFIRMADO: CLAUDE.md:19]`
- **Controle da marca:** cada barbearia com slug, tema e logo próprios — nível de
  personalização que produtos de prateleira não dão de graça. `[CONFIRMADO: colorTheme, logoUrl]`
- **Modelo de distribuição próprio:** o desenvolvedor é o dono da plataforma e revende
  a barbearias amigas. `[INFERIDO: sessão]`

## Contexto de negócio atual

- Produto **em produção** (`barberpro-mauve.vercel.app`) e **em início de comercialização**.
  `[INFERIDO: sessão]`
- Estratégia declarada: **focar no PWA sem gastos** antes de investir em lojas de apps
  (Google Play R$ 125 / Apple US$ 99/ano). `[INFERIDO: sessão]`
- Pelo menos **um cliente pagante real** já usando. `[INFERIDO: sessão]` — número total: **A VALIDAR**.

## Restrições conhecidas

- **Orçamento:** zero recorrente. `[INFERIDO: sessão]`
- **Time:** desenvolvedor solo (Elias). `[CONFIRMADO: CLAUDE.md:14]`
- **Free tier Vercel:** cron roda **1x/dia** (não permite intervalos curtos sem plano pago).
  `[CONFIRMADO: vercel.json ("0 11 * * *")]`
