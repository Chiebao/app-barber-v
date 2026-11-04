"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPaletteById, paletteToVars } from "@/app/lib/palettes";
import { toast } from "@/app/lib/toast";
import BarberPageChat from "./_chat-page";
import PixAutomatico from "./_pix-automatico";
import { Alert, EmptyState, Field, GoldButton, HudCard, Icon, Input, SectionLabel, Skeleton, Spinner, StepPills, TextArea } from "@/app/components/hud";

/**
 * Id anonimo da sessao — sobrevive ao recarregar a aba, morre ao fechar.
 * Nao identifica ninguem, so evita contar a mesma visita duas vezes.
 */
function getSessionId(): string {
  try {
    const KEY = "bp_sid";
    let sid = sessionStorage.getItem(KEY);
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(KEY, sid);
    }
    return sid;
  } catch {
    return "anon";
  }
}

/** Registra um evento do funil. Silencioso: nunca atrapalha o agendamento. */
function track(shopId: string, type: "view" | "book") {
  try {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId, type, sessionId: getSessionId() }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}

function applyWebTheme(themeId: string) {
  const p = getPaletteById(themeId);
  const vars = paletteToVars(p);
  const style = vars.split(";").map((v) => v.trim()).filter(Boolean);
  const root = document.documentElement;
  style.forEach((declaration) => {
    const [prop, val] = declaration.split(":").map((s) => s.trim());
    if (prop && val) root.style.setProperty(prop, val);
  });
}

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  category: string;
  imageUrl?: string | null;
}

interface Barber {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface Shop {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  workDays: number[];
  avgServiceTime: number;
  /** Até quantos dias para frente o cliente enxerga. Opcional: servidor
   *  antigo não devolve o campo, e aí vale o 30 de sempre. */
  diasAbertos?: number;
  pixKey: string | null;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  colorTheme: string;
  bookingMode: string;
  avgRating: number | null;
  ratingCount: number;
  barbers: Barber[];
  services: Service[];
}

interface PendingRating {
  appointmentId: string;
  barberName: string;
  date: string;
  services: string[];
}

type Step =
  | "loading"
  | "name"
  | "phone"
  | "mode_select"
  | "rating"
  | "services"
  | "barber"
  | "date"
  | "time"
  | "confirm"
  | "booking"
  | "pix"
  | "pix_auto"
  | "pix_sent"
  | "done";

/**
 * Data local no formato YYYY-MM-DD.
 *
 * NÃO usar `toISOString()` aqui: ele converte para UTC, e às 22h de Brasília
 * já devolve o dia seguinte — a agenda passava a oferecer só a partir de
 * amanhã e o dia de hoje sumia da lista.
 */
function diaLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Quem já agendou NESTE aparelho. Fica no navegador do cliente, e não no IP:
 * o IP muda a cada rede e é o mesmo para todo mundo no Wi-Fi da barbearia ou
 * na mesma operadora, então mostraria o nome de um cliente para outro.
 */
const CHAVE_IDENTIDADE = "client_identity";

function identidadeSalva(): { name: string; phone: string } | null {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_IDENTIDADE) || "null");
    const name = typeof salvo?.name === "string" ? salvo.name.trim() : "";
    const phone = typeof salvo?.phone === "string" ? salvo.phone.replace(/\D/g, "") : "";
    if (!name || phone.length < 10 || phone.length > 11) return null;
    return { name, phone };
  } catch {
    return null;
  }
}

export default function BarberPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [shop, setShop] = useState<Shop | null>(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState<Step>("loading");

  // Form data
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  // Mensagem do servidor quando não há horário: distingue "hoje já acabou"
  // de "dia cheio". Sem ela as duas situações mostram o mesmo vazio.
  const [slotsMessage, setSlotsMessage] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Rating
  const [pendingRating, setPendingRating] = useState<PendingRating | null>(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");

  // Último agendamento (para "Agendar novamente")
  const [lastBooking, setLastBooking] = useState<{
    barberId: string; barberName: string;
    serviceIds: string[]; serviceNames: string[]; totalPrice: number;
  } | null>(null);

  // Modo escolhido pelo cliente (sobrepõe configuração da barbearia)
  const [clientMode, setClientMode] = useState<"steps" | "agent" | null>(null);

  // Fidelidade do cliente
  const [loyaltyCount, setLoyaltyCount] = useState(0);
  const [loyaltyProgress, setLoyaltyProgress] = useState(0);
  const [loyaltyTarget] = useState(10);

  // Reviews
  const [reviews, setReviews] = useState<{ id: string; score: number; comment: string | null; clientName: string; barberName: string; services: string[]; createdAt: string }[]>([]);

  // Waitlist
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // Results
  const [pixKey, setPixKey] = useState<string | null>(null);
  // Cobranca gerada pelo Mercado Pago (quando a barbearia conectou a conta)
  const [pixAuto, setPixAuto] = useState<{
    copiaECola: string; qrCodeBase64: string | null; valor: number;
  } | null>(null);
  const [pixAptId, setPixAptId] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixSending, setPixSending] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    shopName: string;
    date: string;
    startTime: string;
    services: string[];
    totalPrice: number;
  } | null>(null);
  const [bookError, setBookError] = useState("");

  // Load shop
  useEffect(() => {
    fetch(`/api/shops/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Barbearia não encontrada");
        return r.json();
      })
      .then((data) => {
        setShop(data.shop);
        if (data.shop?.id) track(data.shop.id, "view");
        // Aplicar tema da barbearia via CSS variables
        if (data.shop?.colorTheme) {
          applyWebTheme(data.shop.colorTheme);
        }
        // Quem já agendou neste aparelho não digita nome e telefone de novo:
        // vai direto para a escolha do modo, com "Não é você?" para trocar.
        // Antes o nome e o telefone eram lidos aqui, mas os campos começavam
        // vazios e a tela pedia tudo outra vez.
        const lembrado = identidadeSalva();
        if (lembrado) {
          setNameInput(lembrado.name);
          setPhoneInput(formatPhone(lembrado.phone));
          setClientName(lembrado.name);
          entrarComo(data.shop.id, lembrado.name, lembrado.phone);
        } else {
          setStep("name");
        }
      })
      .catch((e) => setLoadError(e.message));

    fetch(`/api/shops/${slug}/reviews`)
      .then((r) => r.json())
      .then((data) => { if (data.reviews) setReviews(data.reviews.slice(0, 5)); })
      .catch(() => {});
  }, [slug]);

  const totalPrice = shop
    ? shop.services.filter((s) => selectedServices.includes(s.id)).reduce((sum, s) => sum + s.price, 0)
    : 0;

  const totalDuration = shop
    ? shop.services.filter((s) => selectedServices.includes(s.id)).reduce((sum, s) => sum + s.duration, 0)
    : 0;

  const selectedBarber = shop?.barbers.find((b) => b.id === selectedBarberId);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  };

  const formatPhone = (digits: string) => {
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    setPhoneInput(formatPhone(digits));
  };

  const handleSubmitName = () => {
    const name = nameInput.trim();
    if (!name) return;
    setClientName(name);
    setStep("phone");
  };

  /** Segue com este nome e telefone: fidelidade, avaliação pendente e modo. */
  const entrarComo = async (shopId: string, name: string, phone: string) => {
    setClientPhone(phone);
    try { localStorage.setItem(CHAVE_IDENTIDADE, JSON.stringify({ name, phone })); } catch { /* ignore */ }

    try {
      const res = await fetch(`/api/appointments?phone=${phone}&shopId=${shopId}`);
      const data = await res.json();
      // Salva fidelidade
      if (typeof data.loyaltyCount === "number") setLoyaltyCount(data.loyaltyCount);
      if (typeof data.loyaltyProgress === "number") setLoyaltyProgress(data.loyaltyProgress);
      if (data.lastBooking) setLastBooking(data.lastBooking);
      if (data.pendingRating) {
        setPendingRating(data.pendingRating);
        setStep("rating");
        return;
      }
    } catch { /* ignore */ }

    setStep("mode_select");
  };

  const handleSubmitPhone = async () => {
    const phone = phoneInput.replace(/\D/g, "");
    if (phone.length < 10) return;
    await entrarComo(shop!.id, clientName, phone);
  };

  /**
   * "Não é você?": aparelho emprestado, ou a esposa agendando no celular do
   * marido. Apaga o que estava salvo e volta para o começo.
   */
  const trocarDeCliente = () => {
    try { localStorage.removeItem(CHAVE_IDENTIDADE); } catch { /* ignore */ }
    setClientName("");
    setClientPhone("");
    setNameInput("");
    setPhoneInput("");
    setLastBooking(null);
    setPendingRating(null);
    setLoyaltyCount(0);
    setLoyaltyProgress(0);
    setStep("name");
  };

  const handleSubmitRating = async () => {
    if (ratingScore === 0) return;
    try {
      await fetch(`/api/appointments/${pendingRating!.appointmentId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: ratingScore, comment: ratingComment, clientPhone: clientPhone.replace(/\D/g, "") }),
      });
    } catch { /* ignore */ }
    setStep("mode_select");
  };

  const toggleService = (id: string, category: string) => {
    setSelectedServices((prev) => {
      if (category === "corte") {
        const corteIds = shop?.services.filter((s) => s.category === "corte").map((s) => s.id) || [];
        const withoutCorte = prev.filter((s) => !corteIds.includes(s));
        return prev.includes(id) ? withoutCorte : [...withoutCorte, id];
      }
      return prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
    });
  };

  const handleSubmitServices = () => {
    if (selectedServices.length === 0) return;
    if (shop!.barbers.length > 1) {
      setStep("barber");
    } else {
      setSelectedBarberId(shop!.barbers[0]?.id || "");
      setStep("date");
    }
  };

  const handleSelectBarber = (b: Barber) => {
    setSelectedBarberId(b.id);
    setStep("date");
  };

  const getAvailableDates = () => {
    if (!shop) return [];
    const dates: string[] = [];
    const today = new Date();
    // Até onde o dono abriu a agenda. O `?? 30` cobre a resposta de uma
    // versão anterior do servidor, e 30 era o número fixo que estava aqui.
    const janela = shop.diasAbertos ?? 30;
    // `<=` porque a janela conta HOJE inclusive: com 7, na segunda o
    // último dia é a segunda seguinte, que é como o barbeiro descreve.
    for (let i = 0; i <= janela; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      if (shop.workDays.includes(d.getDay())) {
        dates.push(diaLocal(d));
      }
    }
    return dates;
  };

  const handleSelectDate = async (date: string) => {
    setSelectedDate(date);
    setSlotsLoading(true);
    setStep("time");

    try {
      const barberId = selectedBarberId || shop!.barbers[0]?.id;
      const res = await fetch(`/api/shops/${slug}/slots?date=${date}&duration=${totalDuration}&barberId=${barberId}`);
      const data = await res.json();
      // O corte do que já passou é do SERVIDOR (ver /api/shops/[slug]/slots).
      // Filtrar de novo aqui usaria o relógio de quem está olhando, que pode
      // estar em outro fuso — e foi o que fazia a agenda de hoje vir vazia.
      setAvailableSlots(data.slots || []);
      setSlotsMessage(data.message || "");
    } catch { /* ignore */ }

    setSlotsLoading(false);
  };

  const handleSelectTime = (time: string) => {
    setSelectedTime(time);
    setStep("confirm");
  };

  const bookingLock = useRef(false);

  const handleBook = async () => {
    // Trava contra duplo-clique / duplo-submit
    if (bookingLock.current) return;
    bookingLock.current = true;
    setBookError("");
    setStep("booking");
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: shop!.id,
          barberId: selectedBarberId || shop!.barbers[0]?.id,
          clientName,
          clientPhone: clientPhone.replace(/\D/g, ""),
          serviceIds: selectedServices,
          date: selectedDate,
          startTime: selectedTime,
        }),
      });

      if (res.status === 402) {
        const err = await res.json();
        setPixKey(err.pixKey);
        setStep("pix");
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        const msg = res.status === 409
          ? "Ops! Esse horário acabou de ser ocupado. Escolha outro."
          : (err.error || "Erro ao agendar. Tente novamente.");
        setBookError(msg);
        toast.error(msg);
        setStep(res.status === 409 ? "time" : "confirm");
        if (res.status === 409 && selectedDate) handleSelectDate(selectedDate);
        return;
      }

      const data = await res.json();
      setBookingResult(data.appointment);
      if (shop?.id) track(shop.id, "book");

      // Cliente com histórico de falta em barbearia com Mercado Pago:
      // mostramos o QR e a tela se confirma sozinha quando o Pix cai.
      if (data.pixPayment) {
        setPixAuto(data.pixPayment);
        setPixAptId(data.appointment?.id || null);
        setStep("pix_auto");
        return;
      }
      setStep("done");
    } catch {
      setBookError("Erro ao agendar. Tente novamente.");
      setStep("confirm");
    } finally {
      bookingLock.current = false;
    }
  };

  const handlePixConfirm = async () => {
    setPixSending(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: shop!.id,
          barberId: selectedBarberId || shop!.barbers[0]?.id,
          clientName,
          clientPhone: clientPhone.replace(/\D/g, ""),
          serviceIds: selectedServices,
          date: selectedDate,
          startTime: selectedTime,
          pendingPayment: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBookingResult(data.appointment);
        setStep("pix_sent");
      } else if (res.status === 409) {
        // Alguém pegou o horário enquanto o cliente pagava
        toast.error(data.error || "Esse horário acabou de ser ocupado.");
        setBookError(data.error || "Esse horário acabou de ser ocupado.");
        setPixKey(null);
        setStep("time");
        if (selectedDate) handleSelectDate(selectedDate);
      } else {
        toast.error(data.error || "Erro ao registrar. Tente novamente.");
      }
    } catch { toast.error("Erro de conexão. Tente novamente."); }
    setPixSending(false);
  };

  const resetFlow = () => {
    setStep("services");
    setSelectedServices([]);
    setSelectedDate("");
    setSelectedTime("");
    setSelectedBarberId("");
    setRatingScore(0);
    setRatingComment("");
    setPendingRating(null);
    setPixKey(null);
    setBookingResult(null);
    setBookError("");
    setPixSending(false);
  };

  if (loadError) {
    return (
      <main className="hud-bg flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <EmptyState
            erro
            titulo={loadError === "Barbearia não encontrada" ? "Barbearia não encontrada" : "Não foi possível abrir"}
            texto={loadError === "Barbearia não encontrada"
              ? "Confira o link com a barbearia. Ele pode ter mudado."
              : loadError}
            acao={{ rotulo: "Tentar de novo", onClick: () => window.location.reload() }}
          />
        </div>
      </main>
    );
  }

  // Modo efetivo: escolha do cliente sobrepõe configuração da barbearia
  const effectiveMode = clientMode ?? shop?.bookingMode ?? "steps";
  if (step !== "loading" && step !== "name" && step !== "phone" && step !== "mode_select" && step !== "rating" && effectiveMode === "agent" && shop) {
    return <BarberPageChat shop={shop} slug={slug} initialName={clientName} initialPhone={clientPhone} />;
  }

  // Passos do fluxo clássico, na ordem REAL do código. Profissional só conta
  // quando há mais de um barbeiro — com um só, a etapa é pulada.
  const etapas: { chave: Step[]; rotulo: string }[] = [
    { chave: ["name", "phone"], rotulo: "Identificação" },
    { chave: ["services"], rotulo: "Serviços" },
    ...(shop && shop.barbers.length > 1 ? [{ chave: ["barber"] as Step[], rotulo: "Profissional" }] : []),
    { chave: ["date"], rotulo: "Data" },
    { chave: ["time"], rotulo: "Horário" },
    { chave: ["confirm"], rotulo: "Confirmar" },
  ];
  const etapaAtual = etapas.findIndex((e) => e.chave.includes(step));
  const pills = etapaAtual >= 0 ? <StepPills atual={etapaAtual + 1} total={etapas.length} rotulo={etapas[etapaAtual].rotulo} /> : null;

  const voltar = (para: Step) => (
    <button
      type="button"
      onClick={() => setStep(para)}
      className="hud-focus -ml-2 mb-3 inline-flex min-h-[44px] items-center gap-1 rounded px-2 text-sm font-semibold text-hud-light"
    >
      <Icon nome="voltar" tamanho={18} /> Voltar
    </button>
  );

  const titulo = (texto: React.ReactNode, sub?: React.ReactNode) => (
    <div>
      <h2 className="font-display text-[28px] leading-tight text-hud-text">{texto}</h2>
      {sub && <p className="mt-1 text-sm text-hud-muted">{sub}</p>}
    </div>
  );

  const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  // Manhã / tarde / noite é só apresentação da MESMA lista de horários.
  const periodos = [
    { rotulo: "Manhã", horarios: availableSlots.filter((t) => Number(t.slice(0, 2)) < 12) },
    { rotulo: "Tarde", horarios: availableSlots.filter((t) => Number(t.slice(0, 2)) >= 12 && Number(t.slice(0, 2)) < 18) },
    { rotulo: "Noite", horarios: availableSlots.filter((t) => Number(t.slice(0, 2)) >= 18) },
  ].filter((p) => p.horarios.length > 0);

  const linhaTicket = (rotulo: string, valor: React.ReactNode) => (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-hud-muted">{rotulo}</span>
      <span className="text-right font-semibold text-hud-text">{valor}</span>
    </div>
  );

  return (
    <main className="hud-bg min-h-screen">
      {/* Cabeçalho da barbearia */}
      <header className="sticky top-0 z-20 border-b border-hud-border bg-[color-mix(in_srgb,var(--hud-bg)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            {shop?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full border border-hud-accent object-cover" />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hud-accent text-hud-accent bg-[color-mix(in_srgb,var(--hud-accent)_12%,transparent)]">
                <Icon nome="tesoura" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-lg leading-tight text-hud-text">{shop?.name || "…"}</p>
              <div className="flex items-center gap-2 text-xs text-hud-muted">
                {shop && (
                  <span className="inline-flex items-center gap-1">
                    <Icon nome="relogio" tamanho={13} /> {shop.openTime} – {shop.closeTime}
                  </span>
                )}
                {shop?.avgRating && shop.ratingCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-hud-light">
                    <Icon nome="estrela" tamanho={13} /> {shop.avgRating.toFixed(1)}
                    <span className="font-normal text-hud-muted">({shop.ratingCount})</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <GoldButton variante="neutro" compacto onClick={() => router.push(`/${slug}/meus-agendamentos`)} className="shrink-0 !px-3 text-xs">
            Meus agendamentos
          </GoldButton>
        </div>

        {/* Onde fica e como falar. So aparece se a barbearia preencheu. */}
        {shop && (shop.address || shop.city || shop.phone) && (
          <div className="mx-auto flex max-w-lg flex-wrap items-center gap-x-4 px-4 pb-1.5 text-xs text-hud-muted">
            {(shop.address || shop.city) && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  [shop.name, shop.address, shop.neighborhood, shop.city, shop.state].filter(Boolean).join(", ")
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hud-focus inline-flex min-h-[36px] items-center gap-1.5 rounded hover:text-hud-light"
              >
                <Icon nome="local" tamanho={14} />
                <span>
                  {[shop.address, shop.neighborhood].filter(Boolean).join(" - ")}
                  {(shop.address || shop.neighborhood) && (shop.city || shop.state) ? " · " : ""}
                  {[shop.city, shop.state].filter(Boolean).join("/")}
                </span>
              </a>
            )}
            {shop.phone && (
              <a href={`https://wa.me/55${shop.phone}`} target="_blank" rel="noopener noreferrer" className="hud-focus inline-flex min-h-[36px] items-center gap-1.5 rounded hover:text-hud-light">
                <Icon nome="mensagem" tamanho={14} />
                <span>
                  {shop.phone.length === 11
                    ? `(${shop.phone.slice(0, 2)}) ${shop.phone.slice(2, 7)}-${shop.phone.slice(7)}`
                    : shop.phone.length === 10
                      ? `(${shop.phone.slice(0, 2)}) ${shop.phone.slice(2, 6)}-${shop.phone.slice(6)}`
                      : shop.phone}
                </span>
              </a>
            )}
          </div>
        )}
      </header>

      <div className={`mx-auto max-w-lg px-4 pt-6 ${step === "services" ? "pb-36" : "pb-12"}`}>
        {pills && <div className="mb-6">{pills}</div>}

        {/* Carregando */}
        {step === "loading" && (
          <div className="space-y-3 pt-4">
            <Skeleton altura={28} className="w-2/3" />
            <Skeleton altura={52} />
            <Skeleton altura={56} />
          </div>
        )}

        {/* Etapa: Nome */}
        {step === "name" && (
          <div className="space-y-6">
            {titulo("Bem-vindo!", <>Vamos agendar seu horário em <span className="font-semibold text-hud-light">{shop?.name}</span></>)}
            <div className="space-y-3">
              <Field label="Qual é o seu nome completo?">
                {(a) => (
                  <Input
                    {...a}
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmitName(); } }}
                    placeholder="Seu nome"
                    autoComplete="name"
                  />
                )}
              </Field>
              <GoldButton cheio onClick={handleSubmitName} disabled={!nameInput.trim()}>
                Continuar
              </GoldButton>
            </div>

            {/* Avaliações */}
            {reviews.length > 0 && (
              <div className="space-y-3 pt-2">
                <SectionLabel>O que dizem nossos clientes</SectionLabel>
                {reviews.map((r) => (
                  <HudCard key={r.id} className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-hud-light bg-[color-mix(in_srgb,var(--hud-accent)_14%,transparent)]">
                          {r.clientName.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-hud-text">{r.clientName}</p>
                          <p className="text-xs text-hud-muted">com {r.barberName}</p>
                        </div>
                      </div>
                      <span className="flex shrink-0 gap-0.5 text-hud-accent" aria-label={`${r.score} de 5 estrelas`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={n <= r.score ? "" : "opacity-25"}><Icon nome="estrela" tamanho={14} /></span>
                        ))}
                      </span>
                    </div>
                    {r.comment && <p className="text-sm leading-relaxed text-hud-soft">&ldquo;{r.comment}&rdquo;</p>}
                    <p className="text-xs text-hud-muted">{r.services.join(", ")}</p>
                  </HudCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Etapa: Telefone */}
        {step === "phone" && (
          <div className="space-y-6">
            <div>
              {voltar("name")}
              {titulo(<>Olá, {clientName.split(" ")[0]}!</>, "Informe seu telefone para continuar")}
            </div>
            <div className="space-y-3">
              <Field label="Telefone com DDD" dica="É por ele que você consulta e recebe os lembretes.">
                {(a) => (
                  <Input
                    {...a}
                    autoFocus
                    value={phoneInput}
                    onChange={(e) => handlePhoneInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmitPhone(); } }}
                    placeholder="(11) 99999-9999"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                )}
              </Field>
              <GoldButton cheio onClick={handleSubmitPhone} disabled={phoneInput.replace(/\D/g, "").length < 10}>
                Continuar
              </GoldButton>
            </div>
          </div>
        )}

        {/* Etapa: Avaliação */}
        {step === "rating" && pendingRating && (
          <div className="space-y-6">
            {titulo("Como foi sua visita?", <>{pendingRating.services.join(", ")} com {pendingRating.barberName} — {formatDate(pendingRating.date)}</>)}
            <HudCard variante="destaque" className="space-y-4 p-5">
              <div role="radiogroup" aria-label="Nota de 1 a 5" className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={ratingScore === star}
                    aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
                    onClick={() => setRatingScore(star)}
                    className={`hud-focus flex h-12 w-12 items-center justify-center rounded transition ${ratingScore >= star ? "text-hud-accent gold-glow" : "text-[var(--hud-track)]"}`}
                  >
                    <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-hud-muted" aria-live="polite">
                {ratingScore === 0 ? "Toque nas estrelas" : `${ratingScore} de 5`}
              </p>
              <Field label="Comentário (opcional)">
                {(a) => (
                  <TextArea
                    {...a}
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Conte como foi"
                  />
                )}
              </Field>
            </HudCard>
            <div className="flex gap-3">
              <GoldButton variante="neutro" className="flex-1" onClick={() => setStep("mode_select")}>Pular</GoldButton>
              <GoldButton className="flex-[2]" compacto onClick={handleSubmitRating} disabled={ratingScore === 0}>
                Avaliar e continuar
              </GoldButton>
            </div>
          </div>
        )}

        {/* Etapa: Modo */}
        {step === "mode_select" && shop && (
          <div className="space-y-6">
            {titulo("Como prefere agendar?", "Escolha a forma que preferir — você pode mudar sempre que quiser.")}
            <HudCard className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-hud-text">{clientName}</p>
                <p className="text-xs text-hud-muted tabular-nums">{formatPhone(clientPhone)}</p>
              </div>
              <button
                type="button"
                onClick={trocarDeCliente}
                className="hud-focus min-h-[44px] shrink-0 rounded px-2 text-sm font-semibold text-hud-light underline"
              >
                Não é você?
              </button>
            </HudCard>
            <div className="grid gap-3">
              {([
                { modo: "steps" as const, icone: "agenda" as const, nome: "Etapas clássico", desc: "Escolha serviço, barbeiro, data e hora passo a passo" },
                { modo: "agent" as const, icone: "mensagem" as const, nome: "Chatbot IA", desc: "Converse naturalmente e deixe a IA montar seu agendamento" },
              ]).map((m, i) => (
                <HudCard key={m.modo} variante={i === 0 ? "destaque" : "normal"} onClick={() => { setClientMode(m.modo); setStep("services"); }} className="p-5">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-hud-accent text-hud-accent bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)]">
                      <Icon nome={m.icone} tamanho={24} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-xl text-hud-text">{m.nome}</p>
                      <p className="mt-0.5 text-sm text-hud-muted">{m.desc}</p>
                    </div>
                    <span className="text-hud-muted"><Icon nome="avancar" /></span>
                  </div>
                </HudCard>
              ))}
            </div>
          </div>
        )}

        {/* Etapa: Serviços */}
        {step === "services" && shop && (
          <div className="space-y-5">
            {/* Fidelidade — só aparece quando o cliente tem histórico */}
            {loyaltyCount > 0 && (
              <HudCard variante="destaque" className="flex items-center gap-3 px-4 py-3">
                <span className="text-hud-accent"><Icon nome="presente" tamanho={26} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-hud-text">
                    {loyaltyProgress === 0 && loyaltyCount > 0
                      ? `Parabéns! Você atingiu ${loyaltyCount} cortes!`
                      : `Faltam ${loyaltyTarget - loyaltyProgress} corte${loyaltyTarget - loyaltyProgress !== 1 ? "s" : ""} para o seu brinde!`}
                  </p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-[3px] bg-[var(--hud-track)]">
                    <div className="h-full rounded-[3px] transition-all duration-700 motion-reduce:transition-none" style={{ width: `${(loyaltyProgress / loyaltyTarget) * 100}%`, background: "var(--hud-gradient-h)" }} />
                  </div>
                  <p className="mt-1 text-xs text-hud-muted">{loyaltyProgress}/{loyaltyTarget} cortes</p>
                </div>
              </HudCard>
            )}
            {/* "Agendar novamente" — último agendamento do cliente */}
            {lastBooking && (
              <HudCard className="space-y-3 p-4">
                <div className="flex items-center gap-2 text-hud-light">
                  <Icon nome="agenda" tamanho={18} />
                  <p className="text-sm font-bold">Agendar novamente?</p>
                </div>
                <p className="text-sm text-hud-soft">
                  {lastBooking.serviceNames.join(", ")} com {lastBooking.barberName} — {brl(lastBooking.totalPrice)}
                </p>
                <GoldButton
                  variante="secundario"
                  cheio
                  compacto
                  onClick={() => {
                    // Valida se os serviços e barbeiro ainda existem na barbearia
                    const validServiceIds = lastBooking.serviceIds.filter((id) => shop.services.some((s) => s.id === id));
                    const barberExists = shop.barbers.some((b) => b.id === lastBooking.barberId);
                    if (validServiceIds.length === 0) return;
                    setSelectedServices(validServiceIds);
                    if (barberExists) {
                      setSelectedBarberId(lastBooking.barberId);
                      setStep("date");
                    } else if (shop.barbers.length === 1) {
                      setSelectedBarberId(shop.barbers[0].id);
                      setStep("date");
                    } else {
                      setStep("barber");
                    }
                  }}
                >
                  Repetir agendamento
                </GoldButton>
              </HudCard>
            )}

            {titulo("Escolha os serviços", "Selecione um ou mais serviços")}

            {/* Cortes e luzes (principais, com foto) + complementos */}
            {(() => {
              const cardCategories = ["corte", "luzes"];
              const cardServices = shop.services.filter((s) => cardCategories.includes(s.category));
              const extraServices = shop.services.filter((s) => !cardCategories.includes(s.category));
              return (
                <>
                  {cardServices.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {cardServices.map((service) => {
                        const selected = selectedServices.includes(service.id);
                        return (
                          <button
                            key={service.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleService(service.id, service.category)}
                            className={`hud-card hud-focus relative aspect-[4/3] overflow-hidden text-left transition ${selected ? "hud-card-sel hud-corners" : "hover:border-hud-muted"}`}
                          >
                            {service.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={service.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            ) : (
                              <span className="absolute inset-0 flex items-center justify-center text-hud-accent opacity-60"><Icon nome="tesoura" tamanho={36} /></span>
                            )}
                            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                            <span className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 ${selected ? "gold-fill border-transparent" : "border-white/70 bg-black/30"}`}>
                              {selected && <Icon nome="check" tamanho={14} traco={3} />}
                            </span>
                            <span className="absolute inset-x-0 bottom-0 p-2.5">
                              <span className="block text-sm font-bold leading-tight text-white">{service.name}</span>
                              <span className="mt-0.5 flex justify-between text-xs text-white/80">
                                <span className="font-semibold">{brl(service.price)}</span>
                                <span>{service.duration} min</span>
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {extraServices.length > 0 && (
                    <div className="space-y-2">
                      {cardServices.length > 0 && <SectionLabel className="mt-2">Complementos</SectionLabel>}
                      {extraServices.map((service) => {
                        const selected = selectedServices.includes(service.id);
                        return (
                          <button
                            key={service.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleService(service.id, service.category)}
                            className={`hud-card hud-focus flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${selected ? "hud-card-sel" : "hover:border-hud-muted"}`}
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[3px] ${selected ? "gold-fill" : "border-[1.5px] border-[var(--hud-text-3)]"}`}>
                                {selected && <Icon nome="check" tamanho={14} traco={3.5} />}
                              </span>
                              <span className={`truncate text-sm font-semibold ${selected ? "text-hud-text" : "text-hud-soft"}`}>{service.name}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-3 text-xs text-hud-muted">
                              <span>{service.duration} min</span>
                              <span className="font-bold text-hud-light">{brl(service.price)}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}

            {/* Rodapé fixo: resumo + botão */}
            <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[var(--hud-bg)] via-[color-mix(in_srgb,var(--hud-bg)_92%,transparent)] to-transparent pb-[max(16px,env(safe-area-inset-bottom))] pt-8">
              <div className="mx-auto max-w-lg px-4">
                {selectedServices.length > 0 && (
                  <p className="mb-2 flex justify-between text-sm text-hud-muted">
                    <span>{selectedServices.length} serviço{selectedServices.length > 1 ? "s" : ""} · {totalDuration} min</span>
                    <span className="gold-text font-display text-xl tabular-nums">{brl(totalPrice)}</span>
                  </p>
                )}
                <GoldButton cheio onClick={handleSubmitServices} disabled={selectedServices.length === 0}>
                  {selectedServices.length > 0 ? "Continuar" : "Selecione um serviço"}
                </GoldButton>
              </div>
            </div>
          </div>
        )}

        {/* Etapa: Profissional */}
        {step === "barber" && shop && (
          <div className="space-y-5">
            <div>
              {voltar("services")}
              {titulo("Escolha o profissional", "Com quem você prefere ser atendido?")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {shop.barbers.map((b) => (
                <HudCard key={b.id} onClick={() => handleSelectBarber(b)} className="flex flex-col items-center gap-3 p-5" rotulo={`Agendar com ${b.name}`}>
                  {b.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.imageUrl} alt="" className="h-16 w-16 rounded-full border-2 border-hud-accent object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-hud-accent font-display text-2xl text-hud-light bg-[color-mix(in_srgb,var(--hud-accent)_12%,transparent)]">
                      {b.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-center font-semibold text-hud-text">{b.name}</span>
                </HudCard>
              ))}
            </div>
          </div>
        )}

        {/* Etapa: Data */}
        {step === "date" && (
          <div className="space-y-5">
            <div>
              {voltar(shop!.barbers.length > 1 ? "barber" : "services")}
              {titulo("Escolha a data", "Quando você prefere vir?")}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {getAvailableDates().map((date) => {
                const d = new Date(date + "T12:00:00");
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => handleSelectDate(date)}
                    aria-label={d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                    className="hud-card hud-focus flex min-h-[72px] flex-col items-center justify-center py-2.5 transition hover:border-hud-accent"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-hud-muted">{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
                    <span className="font-display text-2xl leading-tight text-hud-text tabular-nums">{d.getDate()}</span>
                    <span className="text-[11px] text-hud-muted">{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Etapa: Horário */}
        {step === "time" && (
          <div className="space-y-5">
            <div>
              {voltar("date")}
              {titulo("Escolha o horário", <span className="inline-block first-letter:uppercase">{formatDate(selectedDate)}</span>)}
            </div>
            {slotsLoading ? (
              <div className="flex justify-center py-12"><Spinner rotulo="Buscando horários…" /></div>
            ) : availableSlots.length === 0 ? (
              <div className="space-y-4">
                <EmptyState
                  icone="agenda"
                  titulo="Sem horários neste dia"
                  texto={slotsMessage || "Nenhum horário disponível neste dia."}
                  acao={{ rotulo: "Escolher outra data", onClick: () => setStep("date") }}
                />
                <HudCard variante="destaque" className="space-y-3 p-5">
                  {waitlistJoined ? (
                    <div className="space-y-1.5 text-center">
                      <span className="inline-flex text-hud-ok"><Icon nome="sucesso" tamanho={32} /></span>
                      <p className="font-display text-xl text-hud-text">Você está na lista de espera!</p>
                      <p className="text-sm text-hud-muted">Te avisamos pelo WhatsApp se abrir um horário neste dia.</p>
                    </div>
                  ) : (
                    <>
                      <p className="hud-eyebrow">Lista de espera</p>
                      <p className="text-sm text-hud-soft">Se alguém cancelar, você recebe um WhatsApp automaticamente.</p>
                      <GoldButton
                        cheio
                        carregando={waitlistLoading}
                        onClick={async () => {
                          setWaitlistLoading(true);
                          try {
                            await fetch("/api/waitlist", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                shopId: shop!.id,
                                clientName,
                                clientPhone,
                                barberId: selectedBarberId || null,
                                serviceIds: selectedServices,
                                preferredDate: selectedDate,
                              }),
                            });
                            setWaitlistJoined(true);
                          } catch { /* ignore */ }
                          setWaitlistLoading(false);
                        }}
                      >
                        <Icon nome="sino" tamanho={18} /> Quero ser avisado
                      </GoldButton>
                    </>
                  )}
                </HudCard>
              </div>
            ) : (
              <div className="space-y-5">
                {periodos.map((p) => (
                  <div key={p.rotulo} className="space-y-2">
                    <SectionLabel>{p.rotulo} · {p.horarios.length} horário{p.horarios.length > 1 ? "s" : ""}</SectionLabel>
                    <div className="grid grid-cols-4 gap-2">
                      {p.horarios.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => handleSelectTime(time)}
                          className="hud-card hud-focus min-h-[48px] text-sm font-bold text-hud-text tabular-nums transition hover:border-hud-accent hover:text-hud-light"
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Etapa: Confirmar (ticket) */}
        {step === "confirm" && shop && (
          <div className="space-y-5">
            <div>
              {voltar("time")}
              {titulo("Confirmar agendamento", "Revise os detalhes abaixo")}
            </div>
            <HudCard variante="destaque" className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-hud-light">
                <Icon nome="ticket" tamanho={18} />
                <span className="hud-eyebrow">Seu horário</span>
              </div>
              {linhaTicket("Cliente", clientName)}
              {selectedBarber && linhaTicket("Profissional", selectedBarber.name)}
              {linhaTicket("Serviços", <span className="max-w-[60%]">{shop.services.filter((s) => selectedServices.includes(s.id)).map((s) => s.name).join(", ")}</span>)}
              {linhaTicket("Data", <span className="inline-block first-letter:uppercase">{formatDate(selectedDate)}</span>)}
              {linhaTicket("Horário", selectedTime)}
              <div className="flex items-end justify-between border-t border-dashed border-hud-border pt-3">
                <span className="text-sm text-hud-muted">Total</span>
                <span className="gold-text gold-glow font-display text-3xl tabular-nums">{brl(totalPrice)}</span>
              </div>
            </HudCard>
            {bookError && <Alert tom="err">{bookError}</Alert>}
            <GoldButton cheio onClick={handleBook}>Confirmar agendamento</GoldButton>
          </div>
        )}

        {/* Agendando */}
        {step === "booking" && (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <Spinner tamanho={40} />
            <p className="text-hud-muted">Confirmando seu agendamento…</p>
          </div>
        )}

        {/* Pix manual */}
        {step === "pix" && pixKey && shop && (
          <div className="space-y-5">
            {titulo("Pagamento antecipado", "Para confirmar seu horário, é necessário pagar 50% via Pix antecipado.")}
            <HudCard variante="destaque" className="space-y-4 p-5">
              <div className="flex items-end justify-between gap-3">
                <span className="text-sm font-semibold text-hud-soft">Entrada via Pix (50%)</span>
                <span className="gold-text font-display text-3xl tabular-nums">{brl(totalPrice / 2)}</span>
              </div>
              <div>
                <p className="hud-label mb-1.5">Chave Pix</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(pixKey);
                    setPixCopied(true);
                    setTimeout(() => setPixCopied(false), 2000);
                  }}
                  className="hud-focus flex min-h-[52px] w-full items-center justify-between gap-3 rounded border border-hud-border px-3.5 text-left bg-[color-mix(in_srgb,var(--hud-bg)_70%,transparent)]"
                >
                  <span className="break-all font-semibold text-hud-text">{pixKey}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-hud-light" aria-live="polite">
                    <Icon nome={pixCopied ? "check" : "copiar"} tamanho={16} /> {pixCopied ? "Copiado!" : "Copiar"}
                  </span>
                </button>
              </div>
              <p className="text-xs text-hud-muted">Após o pagamento, envie o comprovante via WhatsApp para a barbearia.</p>
            </HudCard>
            <GoldButton cheio carregando={pixSending} onClick={handlePixConfirm}>
              Já enviei o comprovante
            </GoldButton>
            <GoldButton cheio variante="neutro" onClick={resetFlow}>Voltar ao início</GoldButton>
          </div>
        )}

        {/* Pix automático (Mercado Pago) — confirma sozinho */}
        {step === "pix_auto" && pixAuto && (
          <PixAutomatico
            pix={pixAuto}
            appointmentId={pixAptId}
            phone={clientPhone}
            onConfirmado={() => setStep("done")}
            onVoltar={resetFlow}
          />
        )}

        {/* Pix enviado — aguardando confirmação do barbeiro */}
        {step === "pix_sent" && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-hud-warn text-hud-warn bg-[color-mix(in_srgb,var(--hud-warn)_10%,transparent)]">
                <Icon nome="relogio" tamanho={38} />
              </span>
              <h2 className="font-display text-[28px] leading-tight text-hud-text">Aguardando confirmação</h2>
              <p className="text-sm text-hud-muted">
                Seu agendamento foi registrado e o barbeiro foi avisado. Assim que ele confirmar o Pix, seu horário está garantido.
              </p>
            </div>
            <Alert tom="warn" titulo="Horário reservado">
              O horário fica reservado para você enquanto o barbeiro confirma. Se ele não confirmar em até 6 horas de expediente, o horário volta a ficar disponível — nesse caso, fale com a barbearia.
            </Alert>
            {bookingResult && (
              <HudCard className="space-y-2 p-5">
                {linhaTicket("Data", <span className="inline-block first-letter:uppercase">{formatDate(bookingResult.date)}</span>)}
                {linhaTicket("Horário", bookingResult.startTime)}
              </HudCard>
            )}
            <GoldButton cheio variante="neutro" onClick={resetFlow}>Voltar ao início</GoldButton>
          </div>
        )}

        {/* Agendado! */}
        {step === "done" && bookingResult && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <span className="gold-fill gold-glow flex h-20 w-20 items-center justify-center rounded-full">
                <Icon nome="check" tamanho={40} traco={3} />
              </span>
              <h2 className="gold-text font-display text-4xl leading-tight">Agendado!</h2>
              <p className="text-sm text-hud-muted">
                Até <span className="inline-block first-letter:uppercase">{formatDate(bookingResult.date)}</span> às {bookingResult.startTime}. Nos vemos lá!
              </p>
            </div>
            <HudCard variante="destaque" className="space-y-2 p-5">
              {linhaTicket("Barbearia", shop?.name)}
              {linhaTicket("Data", <span className="inline-block first-letter:uppercase">{formatDate(bookingResult.date)}</span>)}
              {linhaTicket("Horário", bookingResult.startTime)}
            </HudCard>
            {/* Aviso de possível atraso — gestão de expectativa */}
            <Alert tom="warn" titulo="Um pedido">
              Pode haver um atraso de até <b>15 minutos</b> no seu horário. É que cada cliente merece o tempo certo na cadeira — inclusive você. Agradecemos a compreensão e a paciência!
            </Alert>
            {/* Lembrete de próximo corte */}
            <Alert tom="info" titulo="Próximo corte">
              Não se esqueça de deixar o próximo corte agendado! Volte aqui quando quiser marcar seu próximo horário.
            </Alert>
            <div className="flex gap-3">
              <GoldButton variante="neutro" className="flex-1" onClick={resetFlow}>Novo agendamento</GoldButton>
              <GoldButton variante="secundario" className="flex-1" onClick={() => router.push(`/${slug}/meus-agendamentos`)}>
                Meus agendamentos
              </GoldButton>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// INTERFACE CHAT (AGENTE): src/app/[slug]/_chat-page.tsx
// Ativa — o cliente escolhe entre "Etapas clássico" e "Chatbot IA" no passo `mode_select`.
// Recebe nome/telefone por prop para não perguntar de novo o que o cliente já informou.