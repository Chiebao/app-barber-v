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
| **Producao Web** | Vercel (projeto `barberpro`) — `https://barberpro-mauve.vercel.app` |
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
│       ├── layout.tsx                 # Root layout (fontes Manrope + Marcellus)
│       ├── page.tsx                   # Landing page de venda (era um redirect p/ /admin)
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
| Login por telefone + senha | JWT com expiracao de 7 dias (`auth.ts`) |
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
| `Shop` | Barbearia | id, name, slug (unique), openTime, closeTime, workDays, avgServiceTime, pixKey, logoUrl, colorTheme, bookingMode, **diasAbertos** (7/15/30, janela do link publico), **phone, address, neighborhood, city, state, zipCode** (todos opcionais), mpAccessToken/mpRefreshToken/mpUserId/mpConnectedAt, ownerId (FK) |
| `Barber` | Barbeiros da barbearia | id, name, phone, **email, imageUrl**, passwordHash, role, commission, active, isOwnerProfile, pushToken, shopId (FK) |
| `Service` | Servicos oferecidos | id, name, duration, price, category, imageUrl, active, shopId (FK) |
| `Client` | Clientes (por telefone) | id, name, phone (unique), notes, noShowCount |
| `Appointment` | Agendamentos | id, date, startTime, endTime, totalDuration, totalPrice, status, paymentMethod, paidAt, cancelledAt, cancelledBy, deferredPaymentDate, reminderSentAt, shopId, barberId, clientId (FKs) |
| `AppointmentService` | Relacao N:N agendamento-servico | id, appointmentId, serviceId (FKs) |
| `Rating` | Avaliacoes | id, score, comment, appointmentId (unique), clientId, shopId, barberId (FKs) |
| `LoyaltyCount` | Contagem fidelidade | id, count, shopId+clientId (unique compound), barberId |
| `Product` | Produtos da barbearia | id, name, price, **custo** (opcional), description, imageUrl, imageUrl2, active, shopId (FK) |
| `ComandaItem` | Produto vinculado a agendamento | id, quantity, price, **custo** (congelado na venda), appointmentId, productId (FKs) |
| `Expense` | Despesa da barbearia | id, descricao, valor, categoria, data, recorrente, origemId (auto-relacao), shopId (FK) |
| `BlockedSlot` | Horarios bloqueados | id, date, time (nullable = dia inteiro), barberId, shopId (FKs), unique(barberId+date+time) |
| `Waitlist` | Lista de espera | id, clientName, clientPhone, serviceIds, preferredDate, barberId, shopId (FKs) |
| `RecurringBlock` | Bloqueio semanal (almoco, folga) | id, horaInicio, horaFim, diasSemana, ativo, barberId, shopId (FKs) |
| `WorkDay` | Horario de UM dia da semana | id, dia, aberto, abre, fecha, almocoInicio, almocoFim, shopId (FK), unique(shopId+dia) |
| `RateLimit` | Tentativas por identidade (login, recuperacao) | chave (PK), tentativas, janelaAte, castigos, bloqueadoAte |
| `InboundMessage` | Mensagem que o cliente respondeu no WhatsApp | id, waMessageId (unique), texto, tipo, lida, respondidaEm, shopId (FK) |

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

### Horarios da agenda
- Os horarios oferecidos sao a REGUA (slotInterval) **mais** o fim de cada
  atendimento e de cada bloqueio — o "encaixe". Sem isso, um corte de 1h15
  as 10h com passo de 1h empurrava o proximo cliente para meio-dia e os 45
  min entre 11:15 e 12:00 nao eram oferecidos a ninguem
- Encaixe **sempre**, decisao do dono: prefere a agenda apertada e escolhe
  por dia se aceita. O preco e horario quebrado (11:15, 14:40)
- Bloqueio e **intervalo ocupado**, nao string comparada com o inicio da
  vaga. Filtrar por igualdade deixava passar o corte que ATRAVESSA o bloqueio
- O bloqueio vale nos TRES lugares (`lib/bloqueios.ts`): lista do cliente,
  criacao do agendamento e painel. Ja custou caro ter isso espalhado
- `RecurringBlock` e avaliado na hora, **nao materializado**: bloqueio nao
  tem identidade a preservar, e gerar linhas todo dia custaria cron e limpeza

### Mensagem que o cliente responde
- Numero da Cloud API **nao tem caixa de entrada** em lugar nenhum. O que
  nao cai num webhook e DESCARTADO, nao fica "nao lido" — e os lembretes
  pedem "e so responder por aqui"
- A resposta automatica manda o cliente para o WhatsApp DA BARBEARIA: o
  numero e do BarberPro, e servir de intermediario entre barbeiro e cliente
  nao escala. A barbearia e descoberta pelo agendamento mais proximo
- Dentro da janela de 24h texto livre e **gratuito** — a auto-resposta nao
  custa mensagem paga nem precisa de modelo
- `waMessageId` e unico porque a Meta REENVIA o webhook sem 200 rapido.
  Sem a trava, o mesmo "oi" gera duas respostas
- Assinatura (`WHATSAPP_APP_SECRET`) importa mais que num webhook comum:
  este endpoint faz o app ENVIAR WhatsApp, entao corpo forjado vira
  mensagem para terceiro as nossas custas
- Passadas 24h o painel para de oferecer resposta e manda abrir o WhatsApp:
  a Meta so entrega modelo depois disso, e modelo nao serve para conversa

### Lista de espera
- A fila NAO vencia: cliente entrou dia 28 pedindo vaga PARA o dia 28, o
  dia passou e uma semana depois ela ainda estava la. O barbeiro e que
  teria de limpar a mao — e ninguem faz isso, entao a lista vira lixo
- Pior que a lista suja: o cliente pediu para ser avisado e nunca soube de
  nada. Do lado dele, a barbearia ignorou o pedido
- A borda e o dia de HOJE (`lt`, nao `lte`): quem pediu vaga para hoje
  ainda pode conseguir as 17h, e apagar de manha tiraria da fila quem
  ainda tinha chance
- Sem data preferida nao ha dia para vencer, entao vale a IDADE (30 dias)
- O aviso e tentado antes, mas a remocao acontece **de qualquer jeito**:
  segurar a linha ate a mensagem sair recriaria o problema — modelo nao
  aprovado ou numero invalido, e a fila cresce para sempre esperando um
  envio que nunca vem
- O dia e o da BARBEARIA (`agoraNaBarbearia`), nao o do servidor: as 21h de
  Brasilia o servidor em UTC ja virou o dia, e a espera de hoje seria
  apagada durante o expediente
- Quem pediu um barbeiro especifico nao era filtrado: `barberId` era gravado
  e IGNORADO na hora de avisar, entao quem esperava o Eduardo era chamado
  para o horario do colega — e chegava esperando ele
- `take: 3` sem `orderBy` pegava tres quaisquer: quem entrou hoje passava na
  frente de quem esperava desde segunda. Fila e por ordem de chegada
- O link da barbearia vai num BOTAO, nao no texto: a Meta recusa modelo cujo
  corpo TERMINA em variavel, e link no meio da frase e pior de tocar no
  celular. O valor do botao fica FORA de `variaveis` — essas vao inteiras
  para o componente `body`, e uma a mais faz a Meta recusar o envio
- Editar um modelo APROVADO na Meta manda ele para revisao de novo, e ate
  sair o que esta cadastrado la pode nao ser o que o codigo espera. Por isso
  `enviarModelo` tenta COM o botao e, se a Meta reclamar de parametro
  (132000), refaz SEM — a ordem de quem muda primeiro deixa de importar.
  So vale para o botao de link, e so nesse erro: token morto (401) ou modelo
  pausado nao melhoram tentando de novo
- Entrar na fila agora AVISA o barbeiro (push web + Expo). Antes ninguem
  era avisado: o pedido so aparecia para quem abrisse a tela de espera de
  proposito, e pedido que ninguem ve e pedido perdido
- Avisar no cancelamento PELO BARBEIRO continua manual (`wa.me` no painel),
  de proposito — e o canal confiavel, igual ao botao "Lembrar"

### Landing page (a raiz do site)
- A raiz era `redirect("/admin")`: quem ouvia falar do app e ia olhar caia
  numa TELA DE SENHA, sem saber o que e nem quanto custa
- O botao vai para o WHATSAPP, nao para o cadastro: enquanto nao existir
  cobranca (B14), um "comece gratis" criaria conta que ninguem tem como
  cobrar nem desligar. Troca quando o billing existir; a pagina nao muda
- Abre pela folha de caderno rasurada porque quem le ainda nao esta
  comprando software — esta reconhecendo o proprio sabado. O produto so
  aparece depois disso
- A marca do BarberPro e o AMBAR do Tailwind (`brand-400/500`), nao o
  `#c9a96e` do `globals.css`: aquele e a paleta que cada barbearia escolhe
  (midnight_gold), e o `/admin` usa so as classes Tailwind
- Titulos em `font-display` (Marcellus). NAO e Playfair: o `layout.tsx`
  registra que o traco da Playfair some no escuro
- A Caveat (letra a mao) e carregada NA PAGINA, nao no layout — senao
  pesaria no painel e na tela de agendamento, que abrem toda hora
- Tem `openGraph` proprio apontando para `/api/og`: sem isso o link colado
  no WhatsApp aparece como URL crua, e o cartao e a primeira impressao de
  quem recebe a indicacao
- O "Entrar" no topo existe porque a raiz era o atalho de quem ja e
  cliente. Tirar sem deixar porta seria trocar um problema por outro
- Precos: R$ 79,90 mensal / R$ 59,90 semestral / R$ 49,90 anual

### Janela da agenda (ate onde o cliente enxerga)
- `Shop.diasAbertos` (7, 15 ou 30) e SO do link publico. No painel o
  barbeiro marca para quando quiser: ele esta com o cliente na frente
- Padrao 30 porque era o numero FIXO que estava no codigo — assim nenhuma
  barbearia existente muda de comportamento sozinha
- Conta HOJE inclusive: com 7, na segunda o limite e a segunda seguinte,
  que e como o barbeiro descreve ("travar por uma semana")
- A lista de datas na tela e CONVENIENCIA. A trava esta em `/slots` e no
  POST de `/api/appointments` — quem posta direto nunca viu lista nenhuma
- O dia e o da BARBEARIA: as 21h de Brasilia o servidor em UTC ja virou o
  dia, e o cliente perderia o ultimo dia durante o expediente
- Lista fechada de opcoes: 0 fecharia a agenda e 400 abriria o ano inteiro,
  os dois em silencio ate o cliente reclamar
- O seletor fica colado no LINK, nao em Configuracoes: e a tela que o dono
  abre quando vai mandar o link, e e nessa hora que ele pensa nisso
- Os DOIS modos (steps e chat) leem o mesmo campo — divergir daria agenda
  diferente conforme o modo escolhido

### Quando a internet cai
- O inimigo NAO e a Vercel cair — e a internet DA BARBEARIA cair, que
  acontece toda semana. Provedor tem 99,9%; wi-fi de barbearia nao tem
- O painel tratava falha de rede como dia vazio (`catch { setAppointments
  ([]) }`). O barbeiro nao via erro: via sabado livre, e descobria com a
  fila na porta. Mentir e pior que a queda
- A copia fica em `localStorage` (`lib/agenda-offline.ts`) e NAO no service
  worker, de proposito: o SW devolveria a resposta velha por baixo e a tela
  continuaria sem saber que e velha — trocaria uma mentira por outra. Na
  camada do app a tela sabe que e copia e diz de quando e
- Guarda nome e telefone de cliente, entao sai em TODOS os logouts
- A poda usa data real, nao comparacao de texto: `2026-08-31` < `2026-09-01`
  como string jogaria fora a agenda de ontem na virada do mes
- O resumo no WhatsApp do barbeiro (`lib/agenda-do-dia.ts`) e a camada de
  FORA do sistema: se as 10h nada carrega, a lista esta num app que nao e o
  nosso. So entre 06:00 e 10:00 — o agendador externo bate de hora em hora e
  sem janela o barbeiro recebe a agenda as 3 da manha
- A lista vai numa variavel so, separada por " · ": a Meta RECUSA parametro
  de modelo com quebra de linha. Por isso ela nao pode ser uma lista
- `agendaEnviadaEm` so e gravado quando a Meta confirma, e dia vazio nao
  gasta mensagem paga — nao ha agenda para proteger
- O que o cache NAO faz: aceitar agendamento novo. Gravar precisa do
  servidor. Ver quem vem salva o sabado; marcar, nao da

### Seguranca e limites
- O limitador do `middleware.ts` e um Map EM MEMORIA: em serverless cada
  instancia tem o seu, e o limite vira N x instancias. Ele continua como
  primeira barreira contra enxurrada burra, mas nao segura forca bruta
- `lib/limite.ts` conta no BANCO e por IDENTIDADE (telefone), nao por IP:
  quem ataca uma conta troca de IP de graca, mas nao troca o telefone do
  alvo. Castigo dobra a cada rodada, com teto — bloqueio fixo e facil de
  esperar, bloqueio eterno vira negacao de servico contra o dono
- Aplicado no login (5) e na recuperacao de senha (3, o premio e a conta)
- Acertar a senha LIMPA o historico: senao o dono que errou duas vezes hoje
  comeca amanha perto do bloqueio
- Editar servicos de um agendamento roda as MESMAS checagens da criacao
  quando ALONGA. So encurtar e livre — quem tira servico nao invade ninguem
- Barbeiro contratado so marca falta de quem ele atendeu: `Client` e global,
  entao a falta conta contra o cliente em todas as barbearias

### Datas
- Toda janela de dia usa `T00:00:00.000Z` / `T23:59:59.999Z`, EXPLICITO.
  Sem o Z, `new Date(d + "T00:00:00")` e meia-noite LOCAL DO SERVIDOR — o
  dado gravado dependia de onde o codigo rodava (UTC na Vercel, -03 na
  maquina do dev)
- `RecurringAppointment` usa meio-dia UTC (`dataDoDia`), que e ainda mais
  seguro: sobram 12h de folga para cada lado. Ambos caem dentro da janela
- NAO houve migracao de dados: producao sempre rodou em UTC, entao as linhas
  ja estavam certas. Reescrever data de agendamento existente seria mais
  risco que o problema

### Horario de trabalho por dia
- `WorkDay` guarda UM dia: aberto, abre, fecha, almoco (opcional). E da
  BARBEARIA, nao do barbeiro — decisao do dono. Barbeiro com horario proprio
  continua no bloqueio recorrente
- **Ausencia de linha = nao configurado**, e vale o openTime/closeTime/
  workDays da loja. Sem esse caminho de volta, migrar viraria requisito e
  toda barbearia existente amanheceria fechada
- O almoco sai de `lib/expediente.ts` como INTERVALO, do mesmo formato dos
  bloqueios — daqui para baixo ninguem sabe se veio da config ou de regra
- Almoco pela metade (so um lado) e IGNORADO: intervalo mal formado fecharia
  a agenda em silencio
- Fechar um dia guarda os horarios; reabrir nao faz digitar de novo
- O corte fixo NAO tem data, tem "toda quarta" — resolve por
  `expedientePorDia`, nao por `expedienteDe`. Era o unico caminho que ainda
  perguntava a hora a LOJA: quem abria 09:00 na quarta e 10:00 no resto
  levava "nao cabe no expediente (10:00-17:00)" marcando as 09:00
- O almoco tambem vale para o corte fixo, e por INTERVALO: o corte que
  atravessa a parada invade tanto quanto o que comeca dentro dela
- `shop.workDays` E sincronizado pelo PUT do expediente, entao o dia da
  semana ja estava certo — o que ninguem atualizava era a HORA
- O bloqueio recorrente de almoco do dono foi CONVERTIDO em almoco do dia
  (script em scratchpad, regra desligada e nao apagada)

### Comanda
- Produto entra pelo menu de 3 pontinhos do proprio atendimento. NAO e PDV:
  abrir outra tela na hora de receber e o caminho para o barbeiro desistir
- O que foi lancado aparece NO CARD e entra no valor a receber — produto que
  so existe dentro do modal e produto esquecido
- Quantidade zero REMOVE o item (linha de zero virava venda vazia no relatorio)
- O cliente ve os produtos e o total real na tela dele e no PDF: `totalPrice`
  e so servico, e usar aquele numero no recibo mostraria menos do que ele pagou

### Agendamento pelo painel
- Rota SEPARADA da publica (`/api/me/agendamentos`): a publica carrega regra
  que existe para desconhecido na internet — pre-pagamento Pix apos 2 faltas,
  aviso ao barbeiro, contagem de conversao. Nada disso faz sentido com o
  cliente parado na frente dele
- Um sinalizador na rota publica seria pior: endpoint publico que muda de
  regra conforme campo do corpo e onde buraco de autorizacao nasce
- O que NAO muda: conflito e bloqueio valem igual, mesma transacao
  Serializable. O barbeiro pode furar a fila, nao a fisica
- Barbeiro contratado so agenda para si; o dono escolhe o barbeiro

### Despesas e lucro
- Lucro do mes = **entrou − comissoes − despesas**. So conta atendimento PAGO
  (o que foi feito e nao recebido e fiado, e ja aparece em "A receber")
- `Appointment.totalPrice` e **so servico** — produto vive em `ComandaItem`.
  Somar so o totalPrice esconderia toda a venda de produto
- Comissao incide **sobre servico**, nao sobre produto
- `Product.custo` e opcional; `ComandaItem.custo` e congelado na venda, para
  mudar o preco do fornecedor hoje nao reescrever a margem de meses fechados
- A margem de produto e **informativa** e NAO entra na conta do lucro: a
  compra do produto ja foi lancada como despesa, e descontar o custo de novo
  tiraria a mesma compra duas vezes
- Categorias sao lista fechada (`aluguel`, `contas`, `produtos`, `equipe`,
  `manutencao`, `outros`) — com campo livre viram tres nomes para a mesma coisa
- Despesa `recorrente` e o MOLDE; o cron diario cria a copia do mes com
  `origemId` apontando de volta. Idempotente: a existencia da copia naquele
  mes e a condicao de parada
- Despesa e assunto do dono: barbeiro recebe 401 em `/api/me/despesas` e
  `/api/me/resultado`

### Comanda
- Barbeiro adiciona produtos durante o atendimento
- Total da comanda somado ao relatorio financeiro

### Notificacoes
- WhatsApp disparado de forma fire-and-forget (`.catch(console.error)`)
- Push via Expo Push API (batch de tokens)
- Lembrete via Vercel Cron **1x/dia** (`0 11 * * *` — limite do free tier), buscando quem tem
  horario ~1h a frente. Cobertura parcial: o caminho confiavel e o botao **"Lembrar"** no painel,
  que abre o WhatsApp do cliente com mensagem pronta
- Cron protegido por `CRON_SECRET` (header `Authorization: Bearer`)
- `reminderSentAt` so e gravado quando a API do WhatsApp confirma o envio

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
| GET/POST | `/api/webhooks/whatsapp` | Verificacao da Meta / mensagem recebida do cliente |

### Autenticadas (JWT obrigatorio)

| Prefixo | Modulo |
|---------|--------|
| `/api/auth/add-barber` | CRUD barbeiros (owner only) |
| `/api/me/appointments` | Agenda do barbeiro/dono |
| `/api/me/dashboard` | KPIs e metricas (owner only) |
| `/api/me/finance` | Pagamentos + relatorio financeiro |
| `/api/me/services` | CRUD servicos + DELETE (owner only para create/update/delete) |
| `/api/me/products` | CRUD produtos + DELETE + comanda |
| `/api/me/clients` | Lista de clientes (owner only) |
| `/api/me/clients/[id]` | Notas do cliente |
| `/api/me/shop` | Config da barbearia |
| `/api/me/loyalty` | Programa fidelidade |
| `/api/me/despesas` | CRUD de despesas (owner only) |
| `/api/me/resultado` | Lucro do mes: entrou − comissoes − despesas (owner only) |
| `/api/me/blocked-slots` | Bloqueio de horarios |
| `/api/me/blocked-slots/recorrentes` | Bloqueio que se repete toda semana |
| `/api/me/agendamentos` | Agendamento criado pelo barbeiro, no balcao |
| `/api/me/mensagens` | Caixa de entrada: o que o cliente respondeu |
| `/api/me/expediente` | Horario de trabalho de cada dia da semana (owner only para gravar) |
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
| 28 | Logo proprio por barbearia (`Shop.logoUrl`) | ✅ | — | ✅ |
| 29 | Sistema de toast (substitui `alert()`) | ✅ | — | — |
| 30 | Rate limiting + CORS + security headers | ✅ | — | ✅ |
| 31 | Politica de privacidade + Termos (`/privacidade`, `/termos`) | ✅ | — | — |
| 32 | Reset de senha: super-admin (`/admin/reset`) + dono reseta barbeiro | ✅ | — | ✅ |
| 33 | Gate de privacidade em "Meus agendamentos" (nome + telefone) | ✅ | — | ✅ |
| 34 | Exclusao de dados do cliente (LGPD, escopada a loja) | ✅ | — | ✅ |
| 35 | Botao "Lembrar" cliente via WhatsApp (manual, confiavel) | ✅ | — | — |
| 36 | Toggle de lista de espera ao cancelar | ✅ | — | ✅ |
| 37 | Aviso de tolerancia de atraso (15 min) na confirmacao | ✅ | — | — |
| 38 | Smoke test de producao (`scripts/smoke.mjs`) | — | — | ✅ |
| 39 | Booking atomico (transacao Serializable anti double-booking) | — | — | ✅ |
| 40 | Service worker network-first (deploy aparece na hora) | ✅ | — | — |
| 41 | Editar e apagar servico no painel web (guarda de historico) | ✅ | ✅ | ✅ |
| 42 | Tela de produtos no painel web (CRUD + foto) | ✅ | ✅ | ✅ |
| 43 | Foto no servico e no produto (upload) | ✅ | ✅ | ✅ |
| 44 | Endereco e contato da barbearia (+ trocar o nome) | ✅ | — | ✅ |
| 45 | Foto e e-mail do barbeiro (dono gerencia o proprio perfil) | ✅ | — | ✅ |
| 46 | Sessao sobrevive ao gesto de voltar do iPhone | ✅ | — | — |
| 47 | Mensagens por modelo aprovado do WhatsApp (lembrete, vaga, codigo, cobranca) | — | — | ✅ |
| 48 | Confirmacoes em modal do app (fim do `confirm()` do navegador) | ✅ | — | — |
| 49 | Despesas + lucro do mes + custo/margem de produto | ✅ | — | ✅ |
| 50 | Encaixe: horario nasce onde o corte anterior termina | ✅ | — | ✅ |
| 51 | Bloqueio recorrente (almoco todo dia) | ✅ | — | ✅ |
| 52 | Regua do dia na agenda (altura = tempo) + intervalo ali mesmo | ✅ | — | — |
| 53 | Novo agendamento pelo painel (avulso ou recorrente, por toggle) | ✅ | — | ✅ |
| 54 | Resposta do cliente no WhatsApp: webhook, auto-resposta e caixa de entrada | ✅ | — | ✅ |
| 55 | Comanda no painel web (3 pontinhos > adicionar produto), visivel ao cliente | ✅ | ✅ | ✅ |
| 56 | Horario de trabalho por dia da semana, com almoco | ✅ | — | ✅ |
| 57 | Trava de forca bruta por identidade, gravada no banco | — | — | ✅ |
| 58 | Agenda do dia sobrevive sem internet (copia no aparelho + aviso) | ✅ | — | — |
| 59 | Resumo da agenda no WhatsApp do barbeiro, de manha | — | — | ✅ |
| 60 | Diagnostico do canal WhatsApp pelo login do dono | — | — | ✅ |
| 61 | Lista de espera expira sozinha e avisa o cliente | ✅ | — | ✅ |
| 62 | Barbeiro e avisado quando alguem entra na lista de espera | — | ✅ | ✅ |
| 63 | Janela da agenda no link publico (7, 15 ou 30 dias) | ✅ | — | ✅ |
| 64 | Landing page de venda na raiz do site | ✅ | — | — |

### Pendentes / Melhorias

| # | Modulo | Descricao | Complexidade |
|---|--------|-----------|-------------|
| 1 | **Billing / assinatura** | Planos (mensal/semestral/anual), cobranca e bloqueio por plano. Modelo comercial definido, **sem nada no codigo** | Alta |
| 2 | **Dinheiro em `Decimal`** | Valores monetarios sao `Float` — risco de divergencia de centavos no relatorio | Media |
| 3 | **Expiracao do pre-agendamento** | `pending_payment` sem confirmacao deve sumir em 12h e liberar a vaga | Baixa |
| 4 | **Preferencia sobre lista negra** | Cliente comum tem prioridade sobre `pending_payment` no mesmo horario | Media |
| 5 | **Verificacao por WhatsApp (OTP)** | Upgrade do gate de privacidade: codigo em vez de nome + telefone | Media |
| 6 | **Relatorio PDF do financeiro** | PDF do relatorio do dono (o PDF do cliente ja existe) | Media |
| 7 | **Notificacoes in-app** | Central de notificacoes no painel web | Media |
| 8 | **Multi-shop** | Dono gerencia multiplas barbearias | Alta |
| 9 | **Relatorio de comissoes** | Tela dedicada de comissoes por periodo | Baixa |
| 10 | **Agenda semanal visual** | Visualizacao semanal estilo Google Calendar | Alta |
| 11 | **Lembretes por SMS** | Alternativa paga e confiavel ao WhatsApp | Media |
| 12 | **Analytics de conversao** | Medir visitas do link → agendamento (nao ha instrumentacao) | Baixa |

> Discovery de produto completo (visao, personas, regras, roadmap RICE, riscos) em
> **`docs/discovery/`** — comecar pelo `README.md` ou pelo painel visual `painel-po.html`.

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
| web | smoke | `npm run smoke` | Smoke test contra producao (9 checagens, ~5s) — rodar apos cada deploy |
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
| `WHATSAPP_VERIFY_TOKEN` | Nao | Token do aperto de mao do webhook (voce inventa, e repete na Meta) |
| `WHATSAPP_APP_SECRET` | Nao | Segredo do app na Meta — confere a assinatura do webhook |
| `WHATSAPP_WABA_ID` | Nao | ID da conta do WhatsApp Business — usado para conferir os modelos aprovados em `/api/me/whatsapp-status` |
| `ADMIN_SECRET` | Nao | Senha-mestra da pagina `/admin/reset` (reset de senha super-admin) |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | Nao | WhatsApp do suporte (55+DDD+numero) para o fluxo "Esqueci minha senha" |

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
