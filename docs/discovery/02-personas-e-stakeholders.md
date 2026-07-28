# 02 — Personas e Stakeholders

> Personas derivadas dos perfis e permissões existentes no código, não de pesquisa de campo.
> Perfis reais no sistema: `owner`, `barber` (via JWT) e o `Client` (sem login).
> `[CONFIRMADO: auth.ts:16-19, schema.prisma]`

---

## Persona 1 — Dono da Barbearia ("owner")

- **Quem é:** dono do negócio, também atende como barbeiro (é criado como o primeiro
  barbeiro da loja). `[CONFIRMADO: register/route.ts:56-63 (cria barber com isOwnerProfile)]`
- **Objetivos:** encher a agenda, reduzir faltas, saber quanto fatura, gerir equipe.
- **Dores:** buraco na agenda por falta; não saber o financeiro; perder tempo marcando horário.
- **Tarefas no sistema:** cadastrar barbearia e serviços, configurar horários/Pix/tema/logo,
  confirmar pagamentos, ver dashboard, gerir barbeiros/serviços/produtos, bloquear horários,
  resetar senha de funcionários. `[CONFIRMADO: admin/painel/page.tsx, me/*]`
- **Permissões:** acesso total (rotas `owner only`). `[CONFIRMADO: add-barber:18, dashboard, services]`

## Persona 2 — Barbeiro Funcionário ("barber")

- **Quem é:** profissional contratado, atende clientes na barbearia do dono.
- **Objetivos:** ver a própria agenda; receber aviso de novos agendamentos.
- **Dores:** não saber quem/quando vem; depender do dono para tudo.
- **Tarefas no sistema:** login, ver a própria agenda, confirmar pagamento dos próprios
  atendimentos. `[CONFIRMADO: finance/route.ts:96 (barber vê só barberId próprio)]`
- **Permissões:** restritas — **não** acessa dashboard, clientes, gestão de barbeiros.
  `[CONFIRMADO: rotas com "role !== owner" → 401]`
- **Comissão:** cada barbeiro tem `commission` (%) usada no relatório. `[CONFIRMADO: schema.prisma:63]`

## Persona 3 — Cliente da Barbearia (sem login)

- **Quem é:** pessoa que quer cortar o cabelo. Identificado apenas pelo **telefone**.
  `[CONFIRMADO: schema.prisma:110-113 (Client, phone unique)]`
- **Objetivos:** marcar rápido, escolher barbeiro/horário, não esquecer o horário.
- **Dores:** marcar por WhatsApp é lento; esquecer o horário; não saber preço.
- **Tarefas no sistema:** agendar pelo link, ver/cancelar/editar agendamentos, avaliar,
  entrar na lista de espera, acompanhar fidelidade. `[CONFIRMADO: [slug]/page.tsx, meus-agendamentos]`
- **Permissões:** nenhuma autenticação — acesso via slug + telefone. `[CONFIRMADO: appointments GET usa phone+shopId]`

## Persona 4 — Dono da Plataforma / Suporte (Elias)

- **Quem é:** desenvolvedor e operador do BarberPro; revende às barbearias.
  `[CONFIRMADO: CLAUDE.md:14]`
- **Tarefas:** operar deploys, resetar senha de donos que esqueceram (página `/admin/reset`
  protegida por senha-mestra `ADMIN_SECRET`), suporte via WhatsApp. `[CONFIRMADO: admin/reset/page.tsx]`
- **Permissões:** super-admin fora do fluxo normal (senha-mestra em env). `[CONFIRMADO: api/admin/reset-password]`

---

## Mapa de stakeholders

| Stakeholder | Papel | Interesse | Poder de decisão |
|-------------|-------|-----------|------------------|
| Elias (dono da plataforma) | Constrói, vende, opera | Produto vingar sem custo | **Decisor** `[CONFIRMADO: solo dev]` |
| Dono da barbearia (cliente pagante) | Usa e paga | Menos falta, mais controle | Influencia (feedback/churn) `[INFERIDO]` |
| Barbeiro funcionário | Usa a agenda | Praticidade | Baixo `[INFERIDO]` |
| Cliente final | Agenda | Rapidez e clareza | Indireto (adoção) `[INFERIDO]` |
| Supabase / Vercel / Meta (WhatsApp) | Fornecedores de infra | — | Restrição externa (limites de free tier / API) `[CONFIRMADO: CLAUDE.md:57-64]` |

## Observações de rigor

- Não há dados demográficos reais das personas (idade, volume de atendimento, tíquete).
  Tudo isso é **A VALIDAR** com o Elias e com os primeiros clientes.
- O relacionamento "dono ↔ funcionário" é 1 dono : N barbeiros por barbearia, mas hoje
  o foco declarado é barbearias de **2 a 5 barbeiros**. `[INFERIDO: sessão]`
