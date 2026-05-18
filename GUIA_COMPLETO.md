# BarberPro - Guia Completo

## Nome sugerido: **BarberPro**
Alternativas: AgendaBarber, CorteJa, MeuBarbeiro

---

## 1. Arquitetura do Sistema

```
┌─────────────────────┐     ┌──────────────────────┐
│   App Mobile (Expo) │     │  Web Cliente (Next.js)│
│   Area do Barbeiro  │     │  Agendamento publico  │
└────────┬────────────┘     └──────────┬───────────┘
         │                             │
         └──────────┬──────────────────┘
                    │
         ┌──────────▼──────────┐
         │  API (Next.js Routes)│
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  PostgreSQL (Supabase)│
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  WhatsApp Cloud API  │
         └─────────────────────┘
```

## 2. Stack Escolhida

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| App Barbeiro | React Native + Expo | SDK maduro, EAS Build, OTA updates |
| Web Cliente | Next.js 14 (App Router) | SSR, PWA, deploy Vercel gratis |
| Backend | Next.js API Routes | Mesmo deploy, zero custo extra |
| Banco | PostgreSQL + Prisma | Relacional para agendamentos |
| Hosting DB | Supabase (free tier) | 500MB gratis, PostgreSQL gerenciado |
| Auth | JWT + bcrypt | Simples, sem dependencia externa |
| WhatsApp | Cloud API (Meta) | Gratuito ate 1000 msgs/mes |
| PDF | @react-pdf/renderer | Gera no browser, zero custo servidor |

**Custo inicial: R$ 0**

## 3. Estrutura do Banco de Dados

### Tabelas:
- **barbers**: dados da barbearia, slug unico, horarios
- **services**: servicos oferecidos por cada barbeiro
- **clients**: clientes identificados por telefone
- **appointments**: agendamentos com data, horario, preco
- **appointment_services**: relacao N:N entre agendamento e servicos

Ver schema completo em: `web/prisma/schema.prisma`

## 4. Como Rodar Localmente

### Pre-requisitos
- Node.js 18+
- npm ou yarn
- Conta no Supabase (gratuita)

### Backend + Web

```bash
cd web
npm install

# Copiar e configurar variaveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais do Supabase

# Criar tabelas no banco
npx prisma db push

# Rodar em desenvolvimento
npm run dev
```

### App Mobile

```bash
cd mobile
npm install

# Editar src/services/api.ts com a URL do backend
# (use ngrok para testar local: npx ngrok http 3000)

npx expo start
```

## 5. Deploy Web (Vercel)

1. Criar conta em vercel.com
2. Conectar repositorio GitHub
3. Configurar variaveis de ambiente no painel Vercel:
   - DATABASE_URL
   - JWT_SECRET
   - WHATSAPP_API_TOKEN (opcional)
   - WHATSAPP_PHONE_ID (opcional)
   - NEXT_PUBLIC_BASE_URL (ex: https://barberpro.vercel.app)
4. Deploy automatico a cada push

## 6. Configurar WhatsApp Cloud API

1. Acessar developers.facebook.com
2. Criar App tipo "Business"
3. Adicionar produto "WhatsApp"
4. Em WhatsApp > API Setup:
   - Copiar "Temporary access token" -> WHATSAPP_API_TOKEN
   - Copiar "Phone number ID" -> WHATSAPP_PHONE_ID
5. Adicionar numero do barbeiro como destinatario de teste
6. Para producao: verificar empresa no Meta Business Suite

**Alternativa simples (sem API):** usar link wa.me para abrir WhatsApp
com mensagem pre-formatada (implementacao alternativa disponivel).

## 7. Publicar na Play Store (Android)

### Pre-requisitos
- Conta Google Play Developer ($25 taxa unica)
- EAS CLI instalado: `npm install -g eas-cli`

### Passos

```bash
cd mobile

# Login no Expo
npx eas login

# Configurar projeto
npx eas build:configure

# Build de producao
npx eas build --platform android --profile production

# Submeter para Play Store
npx eas submit --platform android
```

### No Google Play Console:
1. Criar app > preencher ficha da loja
2. Adicionar screenshots (min 2)
3. Classificacao de conteudo: preencher questionario
4. Preco: Gratuito
5. Publicar para revisao (1-3 dias uteis)

## 8. Publicar na Apple Store (iOS)

### Pre-requisitos
- Conta Apple Developer ($99/ano)
- Mac com Xcode (para screenshots)
- EAS CLI

### Passos

```bash
cd mobile

# Build iOS
npx eas build --platform ios --profile production

# Submeter
npx eas submit --platform ios
```

### No App Store Connect:
1. Criar app > preencher metadados
2. Adicionar screenshots para cada tamanho de tela
3. Preencher privacidade (dados coletados: nome, telefone, email)
4. Submeter para revisao (1-7 dias uteis)

## 9. Seguranca e LGPD

### Implementado:
- Senhas com bcrypt (12 rounds)
- JWT com expiracao de 30 dias
- Validacao de entrada com Zod
- Token armazenado com expo-secure-store (criptografado)
- HTTPS forcado na Vercel
- Prisma previne SQL injection

### Recomendacoes adicionais para producao:
- Adicionar rate limiting nas API routes
- Implementar CORS restritivo
- Adicionar pagina de Politica de Privacidade
- Permitir exclusao de dados do cliente (direito LGPD)
- Nao armazenar dados sensiveis desnecessarios

## 10. Modelo de Monetizacao (SaaS)

### Plano Gratuito (MVP)
- 1 barbeiro
- Ate 50 agendamentos/mes
- Link de agendamento
- Notificacao WhatsApp

### Plano Pro (R$ 29,90/mes)
- Agendamentos ilimitados
- Relatorios mensais
- Personalizacao do link (logo, cores)
- Lembretes automaticos para clientes
- Dashboard de metricas

### Plano Barbearia (R$ 79,90/mes)
- Multiplos barbeiros na mesma barbearia
- Agenda compartilhada
- Controle financeiro
- Comissao por barbeiro
- Exportacao de relatorios avancados

### Estrategia de crescimento:
1. Lancar gratuito para adocao
2. Converter com funcionalidades premium
3. Parcerias com distribuidores de produtos de barbeiro
4. Marketplace de produtos no app
