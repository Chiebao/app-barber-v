# CLAUDE.md — BarberPro

> Documento de referencia do projeto. Contem arquitetura, modulos, tabelas, regras de negocio e padroes. Manter atualizado a cada nova feature.

---

## 1. Visao Geral

| Item | Detalhe |
|------|---------|
| **Nome** | BarberPro |
| **Tipo** | SaaS de agendamento online para barbearias — web + mobile |
| **Versao** | 1.0.0 |
| **Desenvolvedor** | Elias Henrique Dias Godoy |
| **Repositorio** | `https://github.com/eliashenr/app_barber.git` |
| **Producao Web** | Vercel — `https://barberpro-black.vercel.app` |
| **Banco** | Supabase (PostgreSQL gerenciado) |
| **Storage** | Supabase Storage (bucket `products`) |
| **Custo operacional** | R$ 0 (free tier Supabase + Vercel) |

---

## 2. Stack Tecnologica

### Web (Next.js)

| Componente | Tecnologia | Versao |
|------------|-----------|--------|
| Framework | Next.js (App Router) | 14.2 |
| Linguagem | TypeScript | 5.6 |
| ORM | Prisma Client | 5.22 |
| Autenticacao | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) | 9.0 / 2.4 |
| Validacao | Zod | 3.23 |
| Estilizacao | Tailwind CSS | 3.4 |
| Datas | date-fns + date-fns-tz | 4.1 / 3.2 |
| QR Code | qrcode.react | 4.2 |
| PDF | @react-pdf/renderer | 4.1 |
| Slug | slugify | 1.6 |
| Testes | Playwright | 1.58 |

### Mobile (Expo)

| Componente | Tecnologia | Versao |
|------------|-----------|--------|
| Framework | Expo | 54.0 |
| Runtime | React Native | 0.81 |
| React | React | 19.1 |
| Notificacoes | expo-notifications | 0.32 |
| Armazenamento seguro | expo-secure-store | 15.0 |
| Galeria/Camera | expo-image-picker | 17.0 |
| Gradientes | expo-linear-gradient | 15.0 |
| Clipboard | expo-clipboard | 8.0 |
| OTA Updates | expo-updates | 29.0 |
| Fonts | @expo-google-fonts/playfair-display | 0.4 |

### Infraestrutura

| Servico | Uso |
|---------|-----|
| **Vercel** | Deploy web (Next.js) + API Routes + Cron jobs |
| **Supabase** | PostgreSQL + Storage (imagens de servicos/produtos) |
| **WhatsApp Cloud API** | Notificacoes ao barbeiro + lembretes ao cliente |
| **Expo Push** | Push notifications no app mobile |
| **GitHub** | Repositorio + CI/CD (auto-deploy Vercel) |

---

## 3. Estrutura de Pastas

```
app_barber/
├── CLAUDE.md                          # Este documento
├── README.md                          # README do projeto
├── GUIA_COMPLETO.md                   # Guia original de setup e deploy
│
├── web/                               # Next.js 14 (App Router)
│   ├── package.json                   # barberpro-web
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── postcss.config.js
│   ├── .env.example                   # Variaveis de ambiente modelo
│   ├── prisma/
│   │   └── schema.prisma              # Schema do banco de dados
│   ├── public/
│   │   └── manifest.json              # PWA manifest
│   └── src/app/
│       ├── layout.tsx                 # Root layout (fonts Inter + Playfair)
│       ├── page.tsx                   # Landing page BarberPro
│       ├── globals.css                # Estilos globais + Tailwind
│       ├── lib/
│       │   ├── prisma.ts              # Singleton PrismaClient
│       │   ├── auth.ts                # JWT sign/verify + bcrypt hash/compare
│       │   ├── time-slots.ts          # Gerador de horarios disponiveis
│       │   ├── whatsapp.ts            # Envio de notificacoes WhatsApp Cloud API
│       │   └── palettes.ts            # Temas visuais (5 paletas: dark/light)
│       │
│       ├── [slug]/                    # Pagina publica da barbearia (SSR)
│       │   ├── layout.tsx             # Metadata OG dinâmica por barbearia
│       │   ├── page.tsx               # Fluxo de agendamento (steps ou chat)
│       │   ├── _chat-page.tsx         # Modo chat (agente IA) de agendamento
│       │   └── meus-agendamentos/
│       │       └── page.tsx           # Cliente ve/edita seus agendamentos
│       │
│       ├── admin/
│       │   ├── page.tsx               # Registro + Login do barbeiro/dono
│       │   └── painel/
│       │       └── page.tsx           # Painel completo do barbeiro (SPA)
│       │
│       └── api/                       # API Routes (Next.js)
│           ├── auth/
│           │   ├── register/route.ts  # POST — cadastro barbearia + dono + servicos
│           │   ├── login/route.ts     # POST — login (dono ou barbeiro)
│           │   └── add-barber/route.ts # POST/GET/PATCH — CRUD barbeiros
│           ├── appointments/
│           │   ├── route.ts           # POST — agendar / GET — listar por cliente
│           │   └── [id]/
│           │       ├── cancel/route.ts       # PATCH — cancelar agendamento
│           │       ├── no-show/route.ts      # PATCH — marcar falta
│           │       ├── rate/route.ts         # POST — avaliar atendimento
│           │       ├── edit/route.ts         # PATCH — editar servicos
│           │       └── confirm-payment/route.ts # PATCH — confirmar Pix
│           ├── shops/[slug]/
│           │   ├── route.ts           # GET — dados publicos da barbearia
│           │   ├── slots/route.ts     # GET — horarios disponiveis
│           │   └── reviews/route.ts   # GET — avaliacoes publicas
│           ├── waitlist/route.ts      # POST — cliente entra na fila de espera
│           ├── cron/route.ts          # GET — lembrete WhatsApp (Vercel Cron)
│           ├── og/route.tsx           # GET — OG image dinamica (Edge Runtime)
│           └── me/                    # Rotas autenticadas do barbeiro/dono
│               ├── appointments/route.ts  # GET — agenda do dia/periodo
│               ├── dashboard/route.ts     # GET — KPIs e metricas
│               ├── finance/route.ts       # PATCH — confirmar pagamento / GET — relatorio
│               ├── services/route.ts      # GET/POST/PATCH — CRUD servicos
│               ├── products/route.ts      # GET/POST/PATCH/PUT — produtos + comanda
│               ├── clients/route.ts       # GET — lista de clientes
│               ├── clients/[id]/route.ts  # PATCH — notas do cliente
│               ├── shop/route.ts          # GET/PATCH — config da barbearia
│               ├── loyalty/route.ts       # GET — programa de fidelidade
│               ├── blocked-slots/route.ts # GET/POST/DELETE — bloquear horarios
│               ├── waitlist/route.ts      # GET — lista de espera
│               ├── waitlist/[id]/route.ts # DELETE — remover da fila
│               ├── upload/route.ts        # POST — upload imagem (Supabase Storage)
│               ├── password/route.ts      # PATCH — trocar senha
│               ├── push-token/route.ts    # PATCH — salvar Expo Push Token
│               └── owner-barber/route.ts  # GET/POST — vincular perfil barbeiro ao dono
│
└── mobile/                            # React Native + Expo
    ├── package.json                   # barberpro-mobile
    ├── app.json                       # Config Expo (EAS Build, permissions)
    ├── eas.json                       # Perfis de build (dev/preview/production)
    ├── App.tsx                        # Entry point + navegacao
    ├── assets/                        # Icones, splash, background
    └── src/
        ├── components/                # Componentes reutilizaveis
        │   ├── AppAlert.tsx
        │   ├── AppButton.tsx
        │   ├── AppCard.tsx
        │   ├── AppInput.tsx
        │   ├── ScreenBackground.tsx
        │   ├── ScreenHeader.tsx
        │   ├── SectionHeader.tsx
        │   └── StatusBadge.tsx
        ├── context/
        │   └── ThemeContext.tsx        # Cores dinamicas por barbearia
        ├── screens/
        │   ├── LoginScreen.tsx
        │   ├── RegisterScreen.tsx
        │   ├── HomeScreen.tsx         # Menu principal (grid de funcionalidades)
        │   ├── DashboardScreen.tsx    # KPIs e metricas
        │   ├── FinanceScreen.tsx      # Relatorio financeiro
        │   ├── ClientsScreen.tsx      # Lista de clientes
        │   ├── ServicesScreen.tsx     # CRUD servicos
        │   ├── ProductsScreen.tsx     # CRUD produtos
        │   ├── BarbersScreen.tsx      # Gestao de barbeiros
        │   ├── AvailabilityScreen.tsx # Bloquear horarios
        │   ├── LoyaltyScreen.tsx      # Programa fidelidade
        │   └── SobreScreen.tsx        # Sobre o app
        ├── services/
        │   └── api.ts                 # HTTP client (fetch + token)
        └── utils/
            ├── colors.ts              # Paleta de cores
            ├── tokens.ts              # SecureStore para JWT
            ├── useColors.ts           # Hook de cores do tema
            └── useBackNavigation.ts   # Hook Android back button
```

---

## 4. Modulos do Sistema

### 4.1 Autenticacao

| Funcionalidade | Descricao |
|----------------|-----------|
| Registro | Dono cadastra barbearia + servicos + horarios em uma unica tela |
| Login por telefone + senha | JWT com expiracao de 30 dias |
| Roles | `owner` (acesso total) e `barber` (ve apenas sua agenda) |
| Perfil owner-barber | Dono e automaticamente o primeiro barbeiro da barbearia |
| Troca de senha | Qualquer usuario autenticado pode alterar |
| Add barbeiro | Owner adiciona barbeiros com telefone + senha + comissao |

### 4.2 Agendamento Publico (Cliente)

| Funcionalidade | Descricao |
|----------------|-----------|
| Pagina publica | `/{slug}` — pagina da barbearia acessivel sem login |
| Dois modos | Steps (passo-a-passo) ou Chat (agente IA conversacional) |
| Fluxo | Nome → Telefone → Servicos → Barbeiro → Data → Horario → Confirmar |
| Horarios inteligentes | Calcula slots disponiveis considerando duracoes, conflitos e bloqueios |
| Anti no-show | Cliente com 2+ faltas obrigado a pagar via Pix antes de agendar |
| Avaliacao | Apos atendimento, cliente pode avaliar de 1-5 estrelas + comentario |
| Meus agendamentos | `/{slug}/meus-agendamentos` — cliente ve historico, cancela, edita servicos |
| Reagendar | Botao "Agendar novamente" com servicos do ultimo atendimento |
| Lista de espera | Se horario cheio, cliente entra na waitlist (notificado se abrir vaga) |
| QR Code | Painel gera QR code do link de agendamento |

### 4.3 Painel do Barbeiro/Dono

| Funcionalidade | Descricao |
|----------------|-----------|
| Dashboard | KPIs: agendamentos hoje, faturamento mes, ticket medio, taxa cancelamento |
| Comparativo | Crescimento vs mes anterior (receita e agendamentos) |
| Ranking barbeiros | Revenue share, comissoes, atendimentos por barbeiro |
| Horario de pico | Identifica hora com mais agendamentos no mes |
| Agenda | Lista de agendamentos por dia com status colorido |
| Confirmar pagamento | Marca como pago (Pix/Dinheiro/Cartao) com opcao de preco custom |
| Pagamento adiado | "Pagar depois" com data de promessa |
| Comanda | Adiciona produtos consumidos durante o atendimento |
| No-show | Marca falta do cliente (incrementa contador) |
| Cancelar | Cancela agendamento (notifica waitlist se houver) |
| Servicos | CRUD completo (nome, duracao, preco, categoria, foto) |
| Produtos | CRUD para produtos vendidos na barbearia (comanda) |
| Clientes | Lista com total de agendamentos, notas, faltas |
| Barbeiros | Adicionar/desativar, definir comissao (%) e role |
| Bloqueio de horarios | Bloquear horarios especificos ou dia inteiro por barbeiro |
| Fidelidade | Programa 10 cortes = 1 gratis (automatico) |
| Financeiro | Relatorio por periodo com filtro por barbeiro |
| Config barbearia | Horarios, dias, tempo medio, chave Pix, tema visual, modo booking |
| QR Code | Link compartilhavel + QR code da pagina de agendamento |

### 4.4 Notificacoes

| Funcionalidade | Descricao |
|----------------|-----------|
| WhatsApp barbeiro | Novo agendamento, cancelamento, pagamento Pix pendente |
| WhatsApp lembrete | Cron (Vercel) envia lembrete 1h antes ao cliente |
| WhatsApp waitlist | Quando horario abre, notifica clientes da fila de espera |
| Push notification | Expo Push para barbeiro/dono no app mobile |

### 4.5 Temas e Personalizacao

| Funcionalidade | Descricao |
|----------------|-----------|
| 5 paletas | Midnight Gold, Selva Esmeralda, Ametista Real, Pergaminho Quente, Pedra Limpa |
| Dark + Light | 3 temas dark, 2 temas light |
| CSS Variables | Tema aplicado via variaveis CSS dinamicas |
| Por barbearia | Cada shop salva seu `colorTheme` no banco |

### 4.6 SEO e Social

| Funcionalidade | Descricao |
|----------------|-----------|
| OG Image | Gerada dinamicamente (Edge Runtime) com nome da barbearia |
| Metadata SSR | Titulo, descricao e OG tags por barbearia |
| PWA | Manifest + theme-color + standalone mode |

---

## 5. Banco de Dados (Prisma)

### 5.1 Tabelas

| Tabela | Descricao | Campos principais |
|--------|-----------|-------------------|
| `Owner` | Dono da barbearia | id, name, phone (unique), passwordHash |
| `Shop` | Barbearia | id, name, slug (unique), openTime, closeTime, workDays, avgServiceTime, pixKey, colorTheme, bookingMode, ownerId (FK) |
| `Barber` | Barbeiros da barbearia | id, name, phone, passwordHash, role, commission, active, isOwnerProfile, pushToken, shopId (FK) |
| `Service` | Servicos oferecidos | id, name, duration, price, category, imageUrl, active, shopId (FK) |
| `Client` | Clientes (por telefone) | id, name, phone (unique), notes, noShowCount |
| `Appointment` | Agendamentos | id, date, startTime, endTime, totalDuration, totalPrice, status, paymentMethod, paidAt, cancelledAt, cancelledBy, deferredPaymentDate, reminderSentAt, shopId, barberId, clientId (FKs) |
| `AppointmentService` | Relacao N:N agendamento-servico | id, appointmentId, serviceId (FKs) |
| `Rating` | Avaliacoes | id, score, comment, appointmentId (unique), clientId, shopId, barberId (FKs) |
| `LoyaltyCount` | Contagem fidelidade | id, count, shopId+clientId (unique compound), barberId |
| `Product` | Produtos da barbearia | id, name, price, description, imageUrl, imageUrl2, active, shopId (FK) |
| `ComandaItem` | Produto vinculado a agendamento | id, quantity, price, appointmentId, productId (FKs) |
| `BlockedSlot` | Horarios bloqueados | id, date, time (nullable = dia inteiro), barberId, shopId (FKs), unique(barberId+date+time) |
| `Waitlist` | Lista de espera | id, clientName, clientPhone, serviceIds, preferredDate, barberId, shopId (FKs) |

### 5.2 Convencoes

| Aspecto | Padrao |
|---------|--------|
| IDs | UUID (`@default(cuid())`) |
| Timestamps | `DateTime @default(now())` |
| Monetarios | `Float` (Prisma) |
| Soft delete | `active Boolean @default(true)` (barbers, services, products) |
| Cascade | `onDelete: Cascade` para filhos (appointment_services, comanda_items) |
| Unique compounds | `@@unique([shopId, clientId])` em LoyaltyCount, `@@unique([barberId, date, time])` em BlockedSlot |

---

## 6. Regras de Negocio

### Agendamentos
- Conflito de horario por barbeiro → **recusado** (verifica sobreposicao de startTime/endTime)
- Dia fora dos `workDays` → **recusado**
- Agenda cheia (slots >= maxSlots) → **recusado**
- Horario bloqueado pelo barbeiro → **removido dos slots disponiveis**
- Cliente com 2+ no-shows e barbearia tem Pix → **exige pre-pagamento**
- Confirmacao de Pix pelo barbeiro → zera contador de no-shows do cliente

### Pagamentos
- Formas aceitas: `pix`, `dinheiro`, `cartao`, `adiado`
- Pagamento confirmado → status `completed` + `paidAt` registrado
- Pagamento adiado → salva `deferredPaymentDate`, nao confirma
- Barbeiro pode remover servicos ou definir preco custom ao confirmar
- A cada pagamento confirmado → incrementa fidelidade (+1)

### Fidelidade
- 10 atendimentos pagos = 1 recompensa
- Contagem por barbearia+cliente (unica)
- Progresso visivel ao cliente na pagina de agendamento

### Cancelamento
- Cliente pode cancelar pela pagina publica
- Barbeiro pode cancelar pelo painel (informa `cancelledBy`)
- Cancelamento → notifica barbeiro via WhatsApp + Push
- Cancelamento → notifica ate 3 clientes da waitlist para a mesma data

### No-Show
- Barbeiro marca falta → `noShowCount++` no cliente
- 2 faltas → obriga pre-pagamento Pix no proximo agendamento

### Comanda
- Barbeiro adiciona produtos durante o atendimento
- Total da comanda somado ao relatorio financeiro

### Notificacoes
- WhatsApp disparado de forma fire-and-forget (`.catch(console.error)`)
- Push via Expo Push API (batch de tokens)
- Lembrete via Vercel Cron a cada 30 minutos (1h antes do horario)

---

## 7. Rotas da API

### Publicas (sem autenticacao)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/auth/register` | Cadastro barbearia + dono |
| POST | `/api/auth/login` | Login (dono ou barbeiro) |
| GET | `/api/shops/[slug]` | Dados publicos da barbearia |
| GET | `/api/shops/[slug]/slots` | Horarios disponiveis |
| GET | `/api/shops/[slug]/reviews` | Avaliacoes publicas |
| POST | `/api/appointments` | Criar agendamento |
| GET | `/api/appointments?phone=&shopId=` | Listar agendamentos do cliente |
| PATCH | `/api/appointments/[id]/cancel` | Cancelar agendamento |
| PATCH | `/api/appointments/[id]/edit` | Editar servicos do agendamento |
| POST | `/api/appointments/[id]/rate` | Avaliar atendimento |
| POST | `/api/waitlist` | Entrar na lista de espera |
| GET | `/api/cron` | Enviar lembretes (Vercel Cron) |
| GET | `/api/og` | OG image dinamica |

### Autenticadas (JWT obrigatorio)

| Prefixo | Modulo |
|---------|--------|
| `/api/auth/add-barber` | CRUD barbeiros (owner only) |
| `/api/me/appointments` | Agenda do barbeiro/dono |
| `/api/me/dashboard` | KPIs e metricas (owner only) |
| `/api/me/finance` | Pagamentos + relatorio financeiro |
| `/api/me/services` | CRUD servicos (owner only para create/update) |
| `/api/me/products` | CRUD produtos + comanda |
| `/api/me/clients` | Lista de clientes (owner only) |
| `/api/me/clients/[id]` | Notas do cliente |
| `/api/me/shop` | Config da barbearia |
| `/api/me/loyalty` | Programa fidelidade |
| `/api/me/blocked-slots` | Bloqueio de horarios |
| `/api/me/waitlist` | Lista de espera |
| `/api/me/waitlist/[id]` | Remover da fila |
| `/api/me/upload` | Upload de imagem (Supabase Storage) |
| `/api/me/password` | Trocar senha |
| `/api/me/push-token` | Salvar Expo Push Token |
| `/api/me/owner-barber` | Vincular perfil barbeiro ao dono |
| `/api/appointments/[id]/no-show` | Marcar falta |
| `/api/appointments/[id]/confirm-payment` | Confirmar Pix pre-pago |

---

## 8. Status dos Modulos

### Completos

| # | Modulo | Web | Mobile | API |
|---|--------|-----|--------|-----|
| 1 | Registro de barbearia | ✅ | ✅ | ✅ |
| 2 | Login (owner + barber) | ✅ | ✅ | ✅ |
| 3 | Agendamento publico (steps) | ✅ | — | ✅ |
| 4 | Agendamento publico (chat/agente) | ✅ | — | ✅ |
| 5 | Meus agendamentos (cliente) | ✅ | — | ✅ |
| 6 | Painel do barbeiro (agenda) | ✅ | ✅ | ✅ |
| 7 | Dashboard (KPIs) | ✅ | ✅ | ✅ |
| 8 | Financeiro (pagamentos + relatorio) | ✅ | ✅ | ✅ |
| 9 | CRUD servicos | ✅ | ✅ | ✅ |
| 10 | CRUD produtos + comanda | ✅ | ✅ | ✅ |
| 11 | Lista de clientes + notas | ✅ | ✅ | ✅ |
| 12 | Gestao de barbeiros | ✅ | ✅ | ✅ |
| 13 | Bloqueio de horarios | ✅ | ✅ | ✅ |
| 14 | Programa fidelidade | ✅ | ✅ | ✅ |
| 15 | Lista de espera (waitlist) | ✅ | — | ✅ |
| 16 | Avaliacoes e reviews | ✅ | — | ✅ |
| 17 | Anti no-show (pre-pagamento Pix) | ✅ | — | ✅ |
| 18 | Notificacao WhatsApp (barbeiro) | — | — | ✅ |
| 19 | Lembrete WhatsApp (cliente) | — | — | ✅ |
| 20 | Push notification (Expo) | — | ✅ | ✅ |
| 21 | Upload de imagens (Supabase Storage) | ✅ | ✅ | ✅ |
| 22 | OG Image dinamica | ✅ | — | ✅ |
| 23 | Temas visuais (5 paletas) | ✅ | ✅ | ✅ |
| 24 | PWA (manifest) | ✅ | — | — |
| 25 | QR Code compartilhavel | ✅ | — | — |
| 26 | Config barbearia (horarios, Pix, tema) | ✅ | — | ✅ |
| 27 | Troca de senha | — | — | ✅ |

### Pendentes / Melhorias

| # | Modulo | Descricao | Complexidade |
|---|--------|-----------|-------------|
| 1 | **Relatorio PDF** | Gerar PDF do relatorio financeiro para download | Media |
| 2 | **Notificacoes in-app** | Central de notificacoes no painel web | Media |
| 3 | **Rate limiting** | Proteger API routes contra abuso | Baixa |
| 4 | **CORS restritivo** | Configurar origens permitidas | Baixa |
| 5 | **Politica de privacidade** | Pagina LGPD obrigatoria para stores | Media |
| 6 | **Exclusao de dados (LGPD)** | Cliente pode solicitar remocao dos seus dados | Media |
| 7 | **Multi-shop** | Dono gerencia multiplas barbearias | Alta |
| 8 | **Relatorio de comissoes** | PDF/tela dedicada de comissoes por periodo | Baixa |
| 9 | **Agenda semanal visual** | Visualizacao semanal no estilo Google Calendar | Alta |
| 10 | **Lembretes por SMS** | Alternativa ao WhatsApp para clientes | Media |

---

## 9. Padroes de Codigo

### API Routes (Next.js App Router)

```typescript
// Padrao de rota com validacao Zod
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    // ... logica
    return NextResponse.json({ resultado });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "Dados invalidos", details: error.errors }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
```

### Autenticacao nas rotas

```typescript
const payload = verifyToken(req.headers.get("authorization")?.slice(7) || "");
if (!payload) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
// Owner-only:
if (payload.role !== "owner") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
```

### Prisma

```typescript
// Singleton para evitar conexoes duplicadas em dev
import { prisma } from "@/app/lib/prisma";

// Transacoes atomicas
await prisma.$transaction([
  prisma.appointment.update({ ... }),
  prisma.client.update({ ... }),
]);
```

### Mobile — Componentes

```typescript
// Todos os componentes base em src/components/
import { AppButton, AppCard, AppInput, ScreenHeader } from "../components";
```

### Temas

```typescript
// Aplicar tema via CSS variables
import { getPaletteById, paletteToVars } from "@/app/lib/palettes";
const p = getPaletteById(shop.colorTheme);
// Use vars: --brand-500, --dark-900, --dark-800, --text-primary, etc.
```

---

## 10. Como Iniciar o Projeto

```bash
# 1. Clone
git clone https://github.com/eliashenr/app_barber.git
cd app_barber

# 2. Web (porta 3000)
cd web
npm install
cp .env.example .env   # Configure DATABASE_URL, JWT_SECRET
npx prisma db push     # Cria tabelas no Supabase
npm run dev

# 3. Mobile
cd mobile
npm install
npx expo start         # Abre Expo Dev Tools
```

### Scripts

| Local | Script | Comando | Descricao |
|-------|--------|---------|-----------|
| web | dev | `npm run dev` | Next.js dev server (porta 3000) |
| web | build | `npm run build` | Build de producao (gera Prisma + build Next) |
| web | db:push | `npm run db:push` | Sincroniza schema Prisma com banco |
| web | db:migrate | `npm run db:migrate` | Cria migration Prisma |
| web | db:seed | `npm run db:seed` | Popula banco com dados de exemplo |
| web | test | `npm run test` | Roda testes Playwright |
| mobile | start | `npm start` | Expo dev server |
| mobile | android | `npm run android` | Abre no emulador Android |
| mobile | ios | `npm run ios` | Abre no simulador iOS |

---

## 11. Variaveis de Ambiente

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | Connection string PostgreSQL (Supabase) |
| `JWT_SECRET` | Sim | Segredo para assinar tokens JWT (min 32 chars) |
| `NEXT_PUBLIC_BASE_URL` | Sim | URL base da aplicacao (ex: `https://barberpro-black.vercel.app`) |
| `WHATSAPP_API_TOKEN` | Nao | Token da WhatsApp Cloud API (Meta) |
| `WHATSAPP_PHONE_ID` | Nao | Phone Number ID da WhatsApp Cloud API |
| `SUPABASE_URL` | Nao | URL do projeto Supabase (para upload de imagens) |
| `SUPABASE_SERVICE_KEY` | Nao | Service key do Supabase (para upload server-side) |
| `CRON_SECRET` | Nao | Segredo para autenticar chamadas do Vercel Cron |

---

## 12. O Que NAO Fazer

- **Nunca trocar Prisma** por outro ORM ou queries raw — toda a tipagem depende do Prisma
- **Nunca trocar Tailwind** por CSS puro — toda a UI web usa classes Tailwind
- **Nunca adicionar Express** — o backend sao API Routes do Next.js
- **Nunca commitar `.env`** — esta no `.gitignore`
- **Nunca expor `JWT_SECRET`** em codigo frontend ou logs
- **Nunca usar `...` ou codigo incompleto** — sempre entregar implementacao completa
- **Nunca reescrever arquivo inteiro** que esta funcionando — editar apenas o trecho necessario
- **Nunca fazer push sem commitar antes** — sempre commit + push automatico apos finalizar
- **Nunca mudar a estrutura de pastas** sem justificativa clara
- **Nunca remover validacao Zod** das rotas que ja tem — manter seguranca de entrada

---

## 13. Decisoes Tecnicas Relevantes

| Decisao | Motivo |
|---------|--------|
| Next.js App Router (nao Pages) | Padrao moderno, Server Components, melhor SEO |
| API Routes (nao backend separado) | Zero custo extra no deploy, mesmo repositorio |
| Prisma (nao Drizzle/raw SQL) | Type safety, migrations, facilidade de uso |
| Tailwind (nao CSS Modules) | Produtividade, design system built-in |
| JWT em header (nao cookie) | Compativel com app mobile, sem problemas CORS |
| expo-secure-store | Token JWT criptografado no dispositivo |
| WhatsApp Cloud API | Gratuito ate 1000 msgs/mes, oficial da Meta |
| Expo Push (nao Firebase) | Integrado ao Expo, zero configuracao extra |
| Slug unico por barbearia | URL amigavel `/{slug}` para compartilhar com clientes |
| Dois modos de booking | Steps para simplicidade, Chat para experiencia diferenciada |
| OG Image na Edge | Gerada dinamicamente por barbearia, sem custo de CDN |
| Paletas via CSS vars | Cada barbearia personaliza cores sem rebuild |
| Comanda (produtos no atendimento) | Barbeiro vende produtos durante o corte |
| Anti no-show com Pix | Reduz faltas, automatico apos 2 no-shows |
