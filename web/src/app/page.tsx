import type { Metadata } from "next";
import Link from "next/link";
import { Caveat } from "next/font/google";

/**
 * Landing page do BarberPro.
 *
 * Antes daqui, a raiz do site era `redirect("/admin")`: quem ouvia falar do
 * app e ia olhar caía numa tela de senha, sem nenhuma explicação do que é
 * nem de quanto custa.
 *
 * A página abre pela folha de caderno porque é a coisa que o barbeiro
 * reconhece antes de qualquer argumento — ele não está comprando software,
 * está olhando o próprio sábado. O produto só aparece depois disso.
 *
 * O botão leva para o WhatsApp, não para o cadastro: é o atendimento
 * automático que mostra o app e explica como testar na barbearia.
 */

// A letra à mão é o conceito da página, não enfeite. Carregada AQUI e não no
// layout: assim ela não pesa no painel e na tela de agendamento, que são as
// que abrem toda hora.
const caveat = Caveat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mao",
  weight: ["500", "700"],
});

// Contato comercial, atendido pelo robô. NÃO é o NEXT_PUBLIC_SUPPORT_WHATSAPP:
// aquele é o suporte feito por uma pessoa ("Esqueci minha senha").
const ZAP = "5515996917520";
// O robô reconhece este texto: mudar aqui exige mudar lá.
const CONVITE = "Oi! Quero saber mais sobre o BarberPro";
const linkZap = `https://wa.me/${ZAP}?text=${encodeURIComponent(CONVITE)}`;

const TITULO = "BarberPro — agenda, lembrete no WhatsApp e o lucro do mês";
const RESUMO =
  "Seu cliente marca sozinho por um link, o app lembra ele no WhatsApp e no " +
  "fim do mês mostra o que sobrou. A partir de R$ 29,90 por mês.";

// Sem isto o link colado no WhatsApp aparece como URL crua. O cartão é a
// primeira impressão de quem recebe a indicação de um amigo.
export const metadata: Metadata = {
  title: TITULO,
  description: RESUMO,
  openGraph: {
    title: TITULO,
    description: RESUMO,
    type: "website",
    locale: "pt_BR",
    siteName: "BarberPro",
    images: [{
      // `cta` e `assinatura` existem por causa daqui: o cartão padrão diz
      // "Agendar horário", que é o convite para o CLIENTE de uma barbearia.
      // Quem recebe este link é dono de barbearia, não cliente.
      // `logo` com endereço completo: quem desenha o cartão busca a imagem
      // pela internet, e caminho relativo não resolve lá dentro.
      url: `/api/og?cta=Ver+planos+e+preços&assinatura=&logo=${encodeURIComponent(
        `${(process.env.NEXT_PUBLIC_BASE_URL || "https://barberpro-mauve.vercel.app").replace(/\/+$/, "")}/logo.png`,
      )}`,
      width: 1200, height: 630, alt: "BarberPro",
    }],
  },
  twitter: { card: "summary_large_image", title: TITULO, description: RESUMO },
};

/** Uma linha da folha de caderno. */
function Linha({ hora, children }: { hora: string; children: React.ReactNode }) {
  return (
    <li className="grid h-8 grid-cols-[3.4rem_1fr] items-baseline gap-2 text-xl">
      <span className="tabular-nums text-[#4A4438]">{hora}</span>
      <span>{children}</span>
    </li>
  );
}

function Perda({ numero, texto }: { numero: string; texto: string }) {
  return (
    <div className="rounded border border-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] bg-hud-surface p-4">
      <b className="gold-text block font-display text-3xl leading-none tabular-nums">{numero}</b>
      <span className="mt-1.5 block text-[0.78rem] leading-snug text-hud-muted">{texto}</span>
    </div>
  );
}

function Atendimento({ hora, nome, servico, valor }: {
  hora: string; nome: string; servico: string; valor: string;
}) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
      <span className="text-sm font-bold tabular-nums text-hud-light">{hora}</span>
      <span>
        <span className="block text-sm font-semibold text-hud-text">{nome}</span>
        <span className="block text-xs text-hud-muted">{servico}</span>
      </span>
      <span className="text-[0.8125rem] font-bold tabular-nums text-hud-text">{valor}</span>
    </div>
  );
}

function Muda({ titulo, texto, antes }: { titulo: string; texto: string; antes: string }) {
  return (
    <div className="grid gap-1.5 bg-hud-bg p-[1.05rem]">
      <h3 className="text-[1.0625rem] font-bold leading-tight tracking-tight text-hud-text">{titulo}</h3>
      <p className="text-sm leading-relaxed text-hud-muted">{texto}</p>
      <p className="text-xs text-hud-faint">
        <b className="font-semibold text-hud-muted">Antes:</b> {antes}
      </p>
    </div>
  );
}

function Plano({ nome, obs, valor, destaque, fita }: {
  nome: string; obs: string; valor: string; destaque?: boolean; fita?: string;
}) {
  return (
    <div
      className={
        "grid grid-cols-[1fr_auto] items-center gap-3 rounded border p-[1.1rem] " +
        (destaque
          ? "border-hud-accent bg-gradient-to-b from-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] to-transparent hud-corners"
          : "border-white/10 bg-hud-surface")
      }
    >
      <div>
        {fita && (
          <span className="mb-1.5 inline-block rounded gold-fill px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-widest text-[var(--hud-on-accent)]">
            {fita}
          </span>
        )}
        <div className="text-[0.9375rem] font-bold text-hud-text">{nome}</div>
        <div className="mt-0.5 text-xs text-hud-muted">{obs}</div>
      </div>
      <div className="text-right">
        <b className="block font-display text-2xl leading-none tabular-nums text-hud-text">{valor}</b>
        <span className="text-[0.6875rem] text-hud-muted">por mês</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className={`${caveat.variable} hud-bg min-h-screen`}>
      {/* ─── topo ─── */}
      <header className="sticky top-0 z-20 border-b border-[color-mix(in_srgb,var(--hud-accent)_15%,transparent)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-[34rem] items-center justify-between gap-3 px-5 py-3">
          <span className="flex items-center gap-2.5 font-display text-xl tracking-tight text-hud-text">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-full border border-[color-mix(in_srgb,var(--hud-accent)_40%,transparent)] object-cover" />
            <span>Barber<span className="text-hud-light">Pro</span></span>
          </span>
          <div className="flex items-center gap-2">
            {/* Quem já é cliente tinha a raiz como atalho para o painel.
                Tirar isso sem deixar porta seria trocar um problema por outro. */}
            <Link
              href="/admin"
              className="hud-focus inline-flex min-h-[44px] items-center rounded px-2.5 text-[0.8125rem] font-semibold text-hud-muted transition hover:text-hud-text"
            >
              Entrar
            </Link>
            <a
              href={linkZap}
              className="hud-focus inline-flex min-h-[44px] items-center rounded gold-fill px-3.5 text-[0.8125rem] font-bold transition hover:brightness-105"
            >
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[34rem] px-5">
        {/* ─── herói: a folha ─── */}
        <section className="flex flex-col gap-6 pt-10">
          <div className="flex flex-col gap-3.5">
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-hud-light">
              Para barbearias
            </p>
            <h1 className="text-balance font-display text-[clamp(2.2rem,8.5vw,3.2rem)] leading-[1.06] tracking-tight text-hud-text">
              Sua agenda de sábado não cabe num caderno.
            </h1>
            <p className="text-[1.0625rem] leading-relaxed text-hud-muted">
              O BarberPro põe a agenda no celular, deixa o cliente marcar sozinho pelo
              link e avisa ele no WhatsApp. Você corta cabelo; o resto se resolve.
            </p>
          </div>

          {/* A folha é o produto que estamos substituindo. Ela abre a página
              porque é o que o barbeiro reconhece na hora. */}
          <div
            className="relative -rotate-[0.5deg] rounded-t-[3px] rounded-b-xl bg-[#EFE7D6] px-5 pb-7 pt-6 text-[#23201A] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent 0 1.9rem, #B9A98A 1.9rem 1.96rem, transparent 1.96rem 2rem)",
              backgroundPosition: "0 0.6rem",
            }}
            aria-label="Página de caderno de agendamentos, com rasuras"
          >
            {/* picotagem de folha arrancada */}
            <div
              className="absolute inset-x-0 top-0 h-[7px] rounded-t-[3px]"
              style={{
                background:
                  "repeating-linear-gradient(90deg, #EFE7D6 0 7px, #DCD0B8 7px 11px)",
              }}
              aria-hidden="true"
            />
            <div className="mb-2 flex items-baseline justify-between gap-3 border-b-2 border-[#23201A] pb-1.5 font-[family-name:var(--font-mao)]">
              <span className="text-2xl font-bold leading-none">Sábado, 14/09</span>
              <span className="text-[1.05rem] text-[#B4472F]">cheio!!</span>
            </div>
            <ul className="flex list-none flex-col p-0 font-[family-name:var(--font-mao)] font-medium">
              <Linha hora="09:00">Marcos — corte</Linha>
              <Linha hora="10:00">
                <span className="line-through decoration-[#B4472F] decoration-2 opacity-60">Tiago — barba</span>
                <span className="ml-2 text-[1.05rem] text-[#B4472F]">faltou</span>
              </Linha>
              <Linha hora="11:00">Rafa — corte + barba</Linha>
              <Linha hora="12:15"><span className="text-[#B4472F]">?????</span></Linha>
              <Linha hora="13:00">
                <span className="line-through decoration-[#B4472F] decoration-2 opacity-60">Léo</span>
                <span className="ml-2 text-[1.05rem] text-[#B4472F]">mudou p/ 15h</span>
              </Linha>
              <Linha hora="14:00">Dudu — corte</Linha>
              <Linha hora="15:00">Léo — corte</Linha>
              <Linha hora="16:00"><span className="text-[#B4472F]">quem era msm?</span></Linha>
            </ul>
          </div>

          <div className="border-l-2 border-[#B4472F] pl-4">
            <p className="text-[0.9375rem] text-hud-muted">
              <strong className="font-semibold text-hud-text">Você conhece essa folha.</strong>{" "}
              O Tiago faltou e ninguém pegou o horário. O Léo remarcou e virou rasura.
              Às 12h15 tinha 45 minutos livres que não foram oferecidos a ninguém,
              porque ninguém sabia que existiam.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Perda numero="45min" texto="vagos entre um corte e outro, todo dia" />
            <Perda numero="1" texto="falta sem aviso é a manhã inteira desfeita" />
            <Perda numero="∞" texto="&ldquo;tem horário hoje?&rdquo; no WhatsApp" />
            <Perda numero="0" texto="ideia de quanto sobrou no fim do mês" />
          </div>
        </section>

        {/* ─── a virada ─── */}
        <section className="flex flex-col gap-3.5 pt-16 text-center">
          <p className="text-2xl leading-none text-hud-light" aria-hidden="true">↓</p>
          <h2 className="text-balance font-display text-[clamp(1.65rem,5.5vw,2.2rem)] leading-tight tracking-tight text-hud-text">
            A mesma manhã, no BarberPro
          </h2>
          <p className="text-[1.0625rem] leading-relaxed text-hud-muted">
            Sem rasura, e com o buraco das 11:15 já oferecido pra quem quiser.
          </p>

          <div className="mt-4 rounded-[18px] border border-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] bg-gradient-to-b from-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] to-transparent p-2 text-left">
            <div className="rounded-[13px] bg-hud-surface px-3.5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <b className="text-[0.9375rem] text-hud-text">Sábado, 14/09</b>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--hud-ok)_40%,transparent)] bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] px-2 py-0.5 text-[0.625rem] font-bold tracking-wider text-hud-ok">
                  <i className="block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  ONLINE
                </span>
              </div>
              <div className="grid gap-1.5">
                <Atendimento hora="09:00" nome="Marcos Vinícius" servico="Corte" valor="R$ 40" />
                <Atendimento hora="10:00" nome="Rafael Lima" servico="Corte + Barba" valor="R$ 65" />
                <div className="grid grid-cols-[3.5rem_1fr] items-center gap-3 rounded border border-dashed border-[color-mix(in_srgb,var(--hud-accent)_50%,transparent)] gold-fill/[0.07] px-3 py-2.5">
                  <span className="text-sm font-bold tabular-nums text-hud-light">11:15</span>
                  <span className="text-sm font-bold text-hud-light">livre — encaixe</span>
                </div>
                <Atendimento hora="12:00" nome="Eduardo Reis" servico="Corte + Pomada" valor="R$ 72" />
                <Atendimento hora="15:00" nome="Léo Andrade" servico="Corte" valor="R$ 40" />
              </div>
            </div>
          </div>
        </section>

        {/* ─── o que muda ─── */}
        <section className="pt-16">
          <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-hud-light">
            O que muda na prática
          </p>
          <h2 className="text-balance font-display text-[clamp(1.65rem,5.5vw,2.2rem)] leading-tight tracking-tight text-hud-text">
            Seis coisas que param de ser problema seu
          </h2>

          <div className="mt-6 grid gap-px overflow-hidden rounded border border-[color-mix(in_srgb,var(--hud-accent)_15%,transparent)] bg-[color-mix(in_srgb,var(--hud-accent)_15%,transparent)]">
            <Muda
              titulo="O horário quebrado é oferecido"
              texto="Terminou um corte às 11:15? O próximo cliente vê 11:15, não meio-dia. Aqueles 45 minutos deixam de evaporar."
              antes="o buraco só existia se você lembrasse dele."
            />
            <Muda
              titulo="O cliente marca sozinho"
              texto="Você manda um link. Ele escolhe serviço, profissional e horário — e só aparecem os horários que realmente cabem."
              antes="&ldquo;tem horário hoje?&rdquo; onze vezes por dia."
            />
            <Muda
              titulo="Ele é lembrado no WhatsApp"
              texto="Mensagem automática antes do horário, pelo WhatsApp oficial da Meta. Quem esquece, esquece menos."
              antes="você mandava um por um, quando dava tempo."
            />
            <Muda
              titulo="Quem falta duas vezes paga antes"
              texto="Na terceira, o app pede Pix antecipado automaticamente. Você não precisa cobrar ninguém na cara."
              antes="ou você engolia, ou brigava."
            />
            <Muda
              titulo="Produto entra na comanda"
              texto="Vendeu pomada durante o corte? Lança ali no atendimento e já entra no valor a receber e no relatório."
              antes="anotado num papel que sumia."
            />
            <Muda
              titulo="Você vê o que sobrou"
              texto="Entrou, menos comissão, menos despesa. O lucro do mês numa tela — não uma conta de cabeça no domingo."
              antes="faturamento você sabia. Lucro, não."
            />
          </div>

          <p className="mt-4 text-[0.8125rem] leading-relaxed text-hud-muted">
            E se a internet da barbearia cair no sábado de manhã, a agenda do dia continua
            no seu celular — com o aviso de que é cópia e de quando ela é. O app não finge
            que o dia está vazio.
          </p>
        </section>

        {/* ─── demonstração ─── */}
        <section className="flex flex-col gap-3.5 pt-16">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-hud-light">
            Veja funcionando
          </p>
          <h2 className="text-balance font-display text-[clamp(1.65rem,5.5vw,2.2rem)] leading-tight tracking-tight text-hud-text">
            Toque numa barbearia de verdade
          </h2>
          <p className="text-[1.0625rem] leading-relaxed text-hud-muted">
            Esta é a HenrBarber, nossa barbearia de demonstração. É exatamente a tela que
            o seu cliente vê quando você manda o link.
          </p>
          <Link
            href="/henrbarber"
            className="w-full rounded border border-[color-mix(in_srgb,var(--hud-accent)_35%,transparent)] px-4 py-4 text-center font-semibold text-hud-light transition hover:border-hud-accent"
          >
            Abrir a demonstração →
          </Link>
        </section>

        {/* ─── preço ─── */}
        <section className="pt-16">
          <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-hud-light">
            Preço
          </p>
          <h2 className="text-balance font-display text-[clamp(1.65rem,5.5vw,2.2rem)] leading-tight tracking-tight text-hud-text">
            Uma assinatura por barbearia. Barbeiros à vontade.
          </h2>

          <div className="mt-6 grid gap-3">
            <Plano nome="Mensal" obs="Sem fidelidade, cancela quando quiser" valor="R$ 45,90" />
            <Plano nome="Trimestral" obs="R$ 119,70 a cada 3 meses" valor="R$ 39,90" />
            <Plano nome="Semestral" obs="R$ 209,40 a cada 6 meses" valor="R$ 34,90" />
            <Plano
              nome="Anual"
              obs="R$ 358,80 por ano · economiza R$ 192"
              valor="R$ 29,90"
              destaque
              fita="Mais escolhido"
            />
          </div>

          <p className="mt-4 text-[0.8125rem] leading-relaxed text-hud-muted">
            Um corte por mês já paga a mensalidade. Tudo incluso: agenda, link do cliente,
            lembretes no WhatsApp, comanda, fidelidade, relatório e quantos barbeiros você tiver.
          </p>
        </section>

        {/* ─── fechamento ─── */}
        <section className="mt-16 flex flex-col gap-4 border-t border-[color-mix(in_srgb,var(--hud-accent)_15%,transparent)] pt-16 text-center">
          <h2 className="text-balance font-display text-[clamp(1.65rem,5.5vw,2.2rem)] leading-tight tracking-tight text-hud-text">
            Quer ver na sua barbearia?
          </h2>
          <p className="text-[1.0625rem] leading-relaxed text-hud-muted">
            Chama no WhatsApp. O atendimento automático te mostra o app e explica como testar na
            sua barbearia.
          </p>
          <a
            href={linkZap}
            className="hud-focus hud-chamfer flex min-h-[56px] w-full items-center justify-center gold-fill px-4 text-center text-[15px] font-bold uppercase tracking-[0.1em] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition hover:brightness-105"
          >
            Falar no WhatsApp
          </a>
          <p className="text-[0.8125rem] text-hud-muted">Atendimento automático. Se ele não resolver, ele te manda o contato de uma pessoa.</p>
        </section>

        <footer className="py-12 text-center text-xs text-hud-faint">
          BarberPro · agendamento para barbearias
          <br />
          <Link href="/privacidade" className="text-hud-muted hover:text-hud-soft">Privacidade</Link>
          {" · "}
          <Link href="/termos" className="text-hud-muted hover:text-hud-soft">Termos</Link>
        </footer>
      </main>
    </div>
  );
}
