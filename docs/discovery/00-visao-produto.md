# 00 — Visão de Produto (Product Vision Board)

> Reconstruído por engenharia reversa do código. Cada afirmação é marcada como
> `[CONFIRMADO: arquivo]` (extraído do código) ou `[INFERIDO]` (interpretação de PO).
> Nada de métrica/usuário/receita inventado — o que não há está como **A VALIDAR**.

---

## Elevator pitch (3 linhas)

O BarberPro é um sistema de agendamento online para barbearias que funciona por um
link próprio de cada barbearia (`/nome-da-barbearia`), onde o cliente marca horário
pelo celular **sem instalar nada**. O dono gerencia agenda, pagamentos, clientes e
equipe por um painel web (instalável como app/PWA) ou pelo app Android. Roda com
**custo operacional zero** (Supabase + Vercel free tier). `[CONFIRMADO: README.md:3-5, CLAUDE.md:19]`

---

## O problema

Barbearias pequenas gerenciam agenda no WhatsApp/caderno, sofrem com faltas ("no-show"),
não têm visão de faturamento e dependem do dono responder mensagem a mensagem para marcar
horário. `[INFERIDO a partir das features que o código resolve: anti no-show, dashboard, link público]`

## Público-alvo

- **Primário:** donos de barbearias pequenas/médias (1 a 5 barbeiros). `[INFERIDO: modelo Owner→Shop→Barber, schema.prisma:12-73]`
- **Secundário:** barbeiros funcionários dessas barbearias (perfil `barber`). `[CONFIRMADO: schema.prisma:60]`
- **Usuário final:** o cliente da barbearia, que só acessa o link. `[CONFIRMADO: [slug]/page.tsx]`

## Proposta de valor

| Para quem | Valor entregue | Evidência |
|-----------|----------------|-----------|
| Dono | Agenda organizada + visão de faturamento + menos faltas, sem custo mensal | `[CONFIRMADO: me/dashboard, finance, appointments]` |
| Barbeiro | Vê a própria agenda e recebe aviso de novo agendamento | `[CONFIRMADO: login/route.ts:41-59, push]` |
| Cliente | Marca em segundos, pelo link, sem baixar app, e acompanha/cancela | `[CONFIRMADO: [slug]/page.tsx, meus-agendamentos]` |

## Diferenciais (o que o código realmente entrega)

1. **Cliente não instala app** — agendamento 100% via link/web. `[CONFIRMADO: README.md:5]`
2. **Multi-tenant com marca própria** — cada barbearia tem slug, tema (5 paletas) e logo. `[CONFIRMADO: schema.prisma:29,35, logoUrl]`
3. **Anti no-show automático** — 2 faltas obrigam pré-pagamento Pix. `[CONFIRMADO: appointments/route.ts:62-66]`
4. **Fidelidade embutida** — 10 atendimentos = 1 recompensa. `[CONFIRMADO: finance/route.ts:54-65]`
5. **Lista de espera** — vaga cancelada aciona aviso a quem esperava. `[CONFIRMADO: cancel/route.ts]`
6. **Custo zero de operação** — free tier. `[CONFIRMADO: CLAUDE.md:19]`

## Objetivos de negócio

- **Validar com um piloto** — construir para um amigo barbeiro e ajudá-lo a fidelizar clientes
  o mais rápido possível (0 clientes pagantes hoje). `[CONFIRMADO: Elias, resposta P1]`
- **Escalar e publicar nas lojas** (Google Play e Apple) após provar o modelo no piloto. `[CONFIRMADO: Elias, P1]`
- **Manter custo operacional em R$ 0** durante a validação. `[INFERIDO: sessão]`
- **Monetizar por assinatura mensal com planos** (quanto maior o compromisso, menor a mensalidade),
  estilo SaaS. Faixa preliminar em estudo: ~R$ 79,90 mensal / R$ 64,90 semestral / R$ 49,90 anual
  (por mês); evoluir funcionalidades por plano. `[CONFIRMADO: Elias, P2 — valores preliminares]`
- Meta numérica de aquisição/receita: **A VALIDAR** (P3).

## O que NÃO é (anti-visão)

- Não é marketplace de barbearias (não há busca/descoberta entre lojas). `[INFERIDO: acesso só por slug direto]`
- Não é gateway de pagamento (Pix é registro manual, sem checkout). `[CONFIRMADO: pixKey é texto; sessão]`
- Não é ERP de estoque (produtos existem para "comanda", sem controle de estoque). `[CONFIRMADO: schema Product/ComandaItem]`
