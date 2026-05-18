# BarberPro

Sistema de agendamento online para barbearias — web + mobile.

O barbeiro cadastra sua barbearia, personaliza o tema e compartilha o link com os clientes. Os clientes agendam pelo celular sem precisar baixar app. O barbeiro gerencia tudo pelo painel web ou pelo app mobile.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Web + API | Next.js 14 (App Router) + TypeScript |
| ORM | Prisma |
| Banco | PostgreSQL (Supabase) |
| Mobile | React Native + Expo 54 |
| Estilizacao | Tailwind CSS |
| Auth | JWT + bcrypt |
| Notificacoes | WhatsApp Cloud API + Expo Push |
| Deploy | Vercel (web) + EAS Build (mobile) |

## Como rodar

### Web

```bash
cd web
npm install
cp .env.example .env   # configure DATABASE_URL e JWT_SECRET
npx prisma db push
npm run dev
```

Acesse `http://localhost:3000/admin` para registrar uma barbearia.

### Mobile

```bash
cd mobile
npm install
npx expo start
```

## Variaveis de ambiente

Copie `web/.env.example` para `web/.env` e preencha:

| Variavel | Descricao |
|----------|-----------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `JWT_SECRET` | Segredo JWT (min 32 chars) |
| `NEXT_PUBLIC_BASE_URL` | URL base (ex: `http://localhost:3000`) |
| `WHATSAPP_API_TOKEN` | Token WhatsApp Cloud API (opcional) |
| `WHATSAPP_PHONE_ID` | Phone ID WhatsApp (opcional) |
| `SUPABASE_URL` | URL Supabase (opcional, para upload) |
| `SUPABASE_SERVICE_KEY` | Service key Supabase (opcional) |

## Funcionalidades

**Para o cliente:**
- Agendamento online pelo link da barbearia (sem app)
- Escolha de barbeiro, servico, data e horario
- Cancelamento e edicao de agendamentos
- Avaliacao do atendimento
- Programa de fidelidade (10 cortes = 1 gratis)
- Lista de espera quando agenda esta cheia

**Para o barbeiro/dono:**
- Dashboard com KPIs e comparativo mensal
- Agenda do dia com confirmacao de pagamento
- Comanda (produtos vendidos durante atendimento)
- Gestao de servicos, produtos e barbeiros
- Bloqueio de horarios e dias
- Relatorio financeiro por periodo
- Notificacoes via WhatsApp e Push
- QR Code do link de agendamento
- 5 temas visuais personalizaveis

## Estrutura

```
app_barber/
├── web/          # Next.js (frontend + API)
│   ├── src/app/
│   │   ├── [slug]/      # Pagina publica da barbearia
│   │   ├── admin/       # Registro + painel do barbeiro
│   │   ├── api/         # API Routes
│   │   └── lib/         # Auth, Prisma, WhatsApp, temas
│   └── prisma/          # Schema do banco
└── mobile/       # Expo (app do barbeiro)
    └── src/
        ├── screens/     # Telas do app
        ├── components/  # Componentes reutilizaveis
        └── services/    # API client
```

## Deploy

**Web (Vercel):**
1. Conecte o repositorio no Vercel
2. Configure variaveis de ambiente
3. Deploy automatico a cada push na `main`

**Mobile (EAS Build):**
```bash
cd mobile
npx eas build --platform android --profile production
npx eas submit --platform android
```

## Documentacao

Veja o [CLAUDE.md](CLAUDE.md) para documentacao tecnica completa: arquitetura, modulos, regras de negocio, padroes de codigo e rotas da API.

## Licenca

Projeto privado — todos os direitos reservados.
