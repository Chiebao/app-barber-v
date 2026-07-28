# 05 — Jornadas e Fluxos

> Fluxos ponta a ponta extraídos do código. 🔴 = ponto de fricção · 🤝 = handoff entre atores.

---

## Jornada 1 — Onboarding do dono

```mermaid
flowchart TD
  A[Dono acessa /admin] --> B[Preenche nome, barbearia, telefone, senha]
  B --> C[Escolhe serviços/cortes + preços + horários + dias]
  C --> D[POST /api/auth/register]
  D --> E{Telefone já cadastrado?}
  E -->|Sim| F[🔴 Erro: telefone já cadastrado]
  E -->|Não| G[Cria Owner + Shop + Serviços + Barbeiro-dono]
  G --> H[Recebe token + link /slug + QR]
  H --> I[🤝 Compartilha link com clientes]
```
`[CONFIRMADO: admin/page.tsx, register/route.ts:30-79]`

---

## Jornada 2 — Cliente agenda (fluxo por etapas)

```mermaid
flowchart TD
  A[Cliente abre /slug] --> B[Nome] --> C[Telefone]
  C --> D{Tem avaliação pendente?}
  D -->|Sim| E[Tela de avaliação ⭐] --> F[Escolhe serviços]
  D -->|Não| F
  F --> G{Mais de 1 barbeiro?}
  G -->|Sim| H[Escolhe barbeiro] --> I[Escolhe data]
  G -->|Não| I
  I --> J[GET /slots: horários disponíveis]
  J --> K{Tem horário?}
  K -->|Não| L[🔴 Sem vaga → entra na lista de espera]
  K -->|Sim| M[Escolhe horário] --> N[Confirma]
  N --> O[POST /api/appointments]
  O --> P{Cliente com 2+ faltas e loja tem Pix?}
  P -->|Sim| Q[🔴 Exige pré-pagamento Pix]
  P -->|Não| R{Conflito de horário?}
  R -->|Sim| S[🔴 409: horário acabou de ser ocupado → recarrega slots]
  R -->|Não| T[Agendado ✅ + aviso de atraso]
  T --> U[🤝 WhatsApp/Push ao barbeiro]
```
`[CONFIRMADO: [slug]/page.tsx, appointments/route.ts, slots/route.ts]`

---

## Jornada 3 — Dia de trabalho do barbeiro

```mermaid
flowchart TD
  A[Login /admin] --> B[Painel: agenda do dia]
  B --> C{Ação no agendamento}
  C -->|Antes| D[🔔 Lembrar cliente via WhatsApp]
  C -->|Cliente veio| E[Confirmar pagamento]
  E --> F[Remove serviços / preço custom]
  F --> G[Escolhe forma: Pix/Dinheiro/Cartão/Adiado]
  G --> H[status = completed + fidelidade +1]
  C -->|Cliente faltou| I[Marcar 'não veio' → noShowCount+1]
  C -->|Cancelar| J[Modal cancelar]
  J --> K{Tem gente na waitlist?}
  K -->|Sim| L[🤝 Abre WhatsApp p/ avisar lista de espera]
  K -->|Não| M[Cancela]
```
`[CONFIRMADO: painel/page.tsx, finance/route.ts, cancel/route.ts]`

---

## Jornada 4 — Recuperação de senha

```mermaid
flowchart TD
  A[Esqueci a senha no login] --> B[Digita telefone]
  B --> C[Abre WhatsApp do suporte com mensagem pronta]
  C --> D[🤝 Mensagem chega no Elias]
  D --> E{Quem esqueceu?}
  E -->|Funcionário| F[Dono reseta no painel Barbeiros 🔑]
  E -->|Dono| G[Elias abre /admin/reset]
  G --> H[Senha-mestra + telefone + nova senha]
  H --> I[POST /api/admin/reset-password]
  I --> J[🤝 Elias responde a nova senha no WhatsApp]
```
`[CONFIRMADO: admin/page.tsx, admin/reset, add-barber PATCH — sessão]`
🔴 **Fricção:** o reset do **dono** depende de intervenção humana do Elias (não é self-service).

---

## Jornada 5 — Vaga aberta → lista de espera

```mermaid
flowchart TD
  A[Cliente cancela ou dono cancela] --> B[PATCH /cancel]
  B --> C[Busca até 3 da waitlist para a data]
  C --> D{WhatsApp API configurada?}
  D -->|Sim| E[Envia aviso automático]
  D -->|Não| F[🔴 Dono avisa manualmente pelo botão wa.me]
  E --> G[🤝 Cliente reabre o link e reagenda]
  F --> G
```
`[CONFIRMADO: cancel/route.ts, painel — sessão]`
🔴 **Fricção:** não há reserva automática da vaga — o cliente da fila precisa correr para reagendar antes de outro.

---

## Handoffs críticos (resumo)

| Handoff | De → Para | Canal | Risco |
|---------|-----------|-------|-------|
| Link de agendamento | Dono → Cliente | WhatsApp/QR | Baixo |
| Novo agendamento | Sistema → Barbeiro | WhatsApp/Push | **Médio** (API instável) |
| Vaga aberta | Sistema → Waitlist | WhatsApp | **Médio** (manual hoje) |
| Reset de senha do dono | Cliente → Elias → Cliente | WhatsApp | **Alto** (100% manual) |
