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
 * O botão leva para o WhatsApp, não para o cadastro: enquanto não existir
 * cobrança no produto, um "comece grátis" criaria conta que ninguém tem
 * como cobrar nem desligar.
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

const ZAP = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "5515997767794").replace(/\D/g, "");
const CONVITE = "Oi! Quero saber mais sobre o BarberPro";
const linkZap = `https://wa.me/${ZAP}?text=${encodeURIComponent(CONVITE)}`;

const TITULO = "BarberPro — agenda, lembrete no WhatsApp e o lucro do mês";
const RESUMO =
  "Seu cliente marca sozinho por um link, o app lembra ele no WhatsApp e no " +
  "fim do mês mostra o que sobrou. A partir de R$ 49,90 por mês.";

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
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "BarberPro" }],
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
    <div className="rounded-xl border border-brand-500/20 bg-dark-800 p-4">
      <b className="block font-display text-3xl leading-none tabular-nums text-brand-400">{numero}</b>
      <span className="mt-1.5 block text-[0.78rem] leading-snug text-gray-400">{texto}</span>
    </div>
  );
}

function Atendimento({ hora, nome, servico, valor }: {
  hora: string; nome: string; servico: string; valor: string;
}) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
      <span className="text-sm font-bold tabular-nums text-brand-400">{hora}</span>
      <span>
        <span className="block text-sm font-semibold text-white">{nome}</span>
        <span className="block text-xs text-gray-400">{servico}</span>
      </span>
      <span className="text-[0.8125rem] font-bold tabular-nums text-white">{valor}</span>
    </div>
  );
}

function Muda({ titulo, texto, antes }: { titulo: string; texto: string; antes: string }) {
  return (
    <div className="grid gap-1.5 bg-dark-900 p-[1.05rem]">
      <h3 className="text-[1.0625rem] font-bold leading-tight tracking-tight text-white">{titulo}</h3>
      <p className="text-sm leading-relaxed text-gray-400">{texto}</p>
      <p className="text-xs text-gray-600">
        <b className="font-semibold text-gray-500">Antes:</b> {antes}
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
        "grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border p-[1.1rem] " +
        (destaque
          ? "border-brand-500 bg-gradient-to-b from-brand-500/10 to-brand-500/[0.02]"
          : "border-white/10 bg-dark-800")
      }
    >
      <div>
        {fita && (
          <span className="mb-1.5 inline-block rounded bg-brand-500 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-widest text-dark-900">
            {fita}
          </span>
        )}
        <div className="text-[0.9375rem] font-bold text-white">{nome}</div>
        <div className="mt-0.5 text-xs text-gray-400">{obs}</div>
      </div>
      <div className="text-right">
        <b className="block font-display text-2xl leading-none tabular-nums text-white">{valor}</b>
        <span className="text-[0.6875rem] text-gray-400">por mês</span>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className={`${caveat.variable} bg-dark-900`}>
      {/* ─── topo ─── */}
      <header className="sticky top-0 z-20 border-b border-brand-500/15 bg-dark-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-[34rem] items-center justify-between gap-3 px-5 py-3">
          <span className="font-display text-xl tracking-tight text-white">
            Barber<span className="text-brand-400">Pro</span>
          </span>
          <div className="flex items-center gap-2">
            {/* Quem já é cliente tinha a raiz como atalho para o painel.
                Tirar isso sem deixar porta seria trocar um problema por outro. */}
            <Link
              href="/admin"
              className="rounded-lg px-2.5 py-2 text-[0.8125rem] font-semibold text-gray-400 transition hover:text-white"
            >
              Entrar
            </Link>
            <a
              href={linkZap}
              className="rounded-lg bg-brand-500 px-3.5 py-2 text-[0.8125rem] font-semibold text-dark-900 transition hover:bg-brand-400"
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
            <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-brand-400">
              Para barbearias
            </p>
            <h1 className="text-balance font-display text-[clamp(2.2rem,8.5vw,3.2rem)] leading-[1.06] tracking-tight text-white">
              Sua agenda de sábado não cabe num caderno.
            </h1>
            <p className="text-[1.0625rem] leading-relaxed text-gray-400">
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
            <p className="text-[0.9375rem] text-gray-400">
              <strong className="font-semibold text-white">Você conhece essa folha.</strong>{" "}
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
          <p className="text-2xl leading-none text-brand-400" aria-hidden="true">↓</p>
          <h2 className="text-balance font-display text-[clamp(1.65rem,5.5vw,2.2rem)] leading-tight tracking-tight text-white">
            A mesma manhã, no BarberPro
          </h2>
          <p className="text-[1.0625rem] leading-relaxed text-gray-400">
            Sem rasura, e com o buraco das 11:15 já oferecido pra quem quiser.
          </p>

          <div className="mt-4 rounded-[18px] border border-brand-500/20 bg-gradient-to-b from-brand-500/10 to-transparent p-2 text-left">
            <div className="rounded-[13px] bg-dark-800 px-3.5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <b className="text-[0.9375rem] text-white">Sábado, 14/09</b>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[0.625rem] font-bold tracking-wider text-emerald-400">
                  <i className="block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  ONLINE
                </span>
              </div>
              <div className="grid gap-1.5">
                <Atendimento hora="09:00" nome="Marcos Vinícius" servico="Corte" valor="R$ 40" />
                <Atendimento hora="10:00" nome="Rafael Lima" servico="Corte + Barba" valor="R$ 65" />
                <div className="grid grid-cols-[3.5rem_1fr] items-center gap-3 rounded-xl border border-dashed border-brand-500/50 bg-brand-500/[0.07] px-3 py-2.5">
                  <span className="text-sm font-bold tabular-nums text-brand-400">11:15</span>
                  <span className="text-sm font-bold text-brand-400">livre — encaixe</span>
                </div>
                <Atendimento hora="12:00" nome="Eduardo Reis" servico="Corte + Pomada" valor="R$ 72" />
                <Atendimento hora="15:00" nome="Léo Andrade" servico="Corte" valor="R$ 40" />
              </div>
            </div>
          </div>
        </section>

        {/* ─── o que muda ─── */}
        <section className="pt-16">
          <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-brand-400">
            O que muda na prática
          </p>
          <h2 className="text-balance font-display text-[clamp(1.65rem,5.5vw,2.2rem)] leading-tight tracking-tight text-white">
            Seis coisas que param de ser problema seu
          </h2>

          <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-brand-500/15 bg-brand-500/15">
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

          <p className="mt-4 text-[0.8125rem] leading-relaxed text-gray-400">
            E se a internet da barbearia cair no sábado de manhã, a agenda do dia continua
            no seu celular — com o aviso de que é cópia e de quando ela é. O app não finge
            que o dia está vazio.
          </p>
        </section>

        {/* ─── demonstração ─── */}
        <section className="flex flex-col gap-3.5 pt-16">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-brand-400">
            Veja funcionando
          </p>
          <h2 className="text-balance font-display text-[clamp(1.65rem,5.5vw,2.2rem)] leading-tight tracking-tight text-white">
            Toque numa barbearia de verdade
          </h2>
          <p className="text-[1.0625rem] leading-relaxed text-gray-400">
            Esta é a HenrBarber, nossa barbearia de demonstração. É exatamente a tela que
            o seu cliente vê quando você manda o link.
          </p>
          <Link
            href="/henrbarber"
            className="w-full rounded-xl border border-brand-500/35 px-4 py-4 text-center font-semibold text-brand-400 transition hover:border-brand-500"
          >
            Abrir a demonstração →
          </Link>
        </section>

        {/* ─── preço ─── */}
        <section className="pt-16">
          <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-brand-400">
            Preço
          </p>
          <h2 className="text-balance font-display text-[clamp(1.65rem,5.5vw,2.2rem)] leading-tight tracking-tight text-white">
            Uma assinatura por barbearia. Barbeiros à vontade.
          </h2>

          <div className="mt-6 grid gap-3">
            <Plano nome="Mensal" obs="Sem fidelidade, cancela quando quiser" valor="R$ 79,90" />
            <Plano nome="Semestral" obs="R$ 359,40 a cada 6 meses" valor="R$ 59,90" />
            <Plano
              nome="Anual"
              obs="R$ 598,80 por ano · economiza R$ 360"
              valor="R$ 49,90"
              destaque
              fita="Mais escolhido"
            />
          </div>

          <p className="mt-4 text-[0.8125rem] leading-relaxed text-gray-400">
            Um corte por mês já paga a mensalidade. Tudo incluso: agenda, link do cliente,
            lembretes no WhatsApp, comanda, fidelidade, relatório e quantos barbeiros você tiver.
          </p>
        </section>

        {/* ─── fechamento ─── */}
        <section className="mt-16 flex flex-col gap-4 border-t border-brand-500/15 pt-16 text-center">
          <h2 className="text-balance font-display text-[clamp(1.65rem,5.5vw,2.2rem)] leading-tight tracking-tight text-white">
            Quer ver na sua barbearia?
          </h2>
          <p className="text-[1.0625rem] leading-relaxed text-gray-400">
            Me chama no WhatsApp. A gente conversa, eu monto sua barbearia no app com seus
            serviços e preços, e você já sai com o link pra mandar pros clientes.
          </p>
          <a
            href={linkZap}
            className="w-full rounded-xl bg-brand-500 px-4 py-4 text-center font-semibold text-dark-900 shadow-[0_8px_26px_-14px_rgba(232,150,10,0.9)] transition hover:bg-brand-400"
          >
            Falar no WhatsApp
          </a>
          <p className="text-[0.8125rem] text-gray-400">Respondo eu mesmo. Sem robô, sem formulário.</p>
        </section>

        <footer className="py-12 text-center text-xs text-gray-600">
          BarberPro · agendamento para barbearias
          <br />
          <Link href="/privacidade" className="text-gray-500 hover:text-gray-300">Privacidade</Link>
          {" · "}
          <Link href="/termos" className="text-gray-500 hover:text-gray-300">Termos</Link>
        </footer>
      </main>
    </div>
  );
}
