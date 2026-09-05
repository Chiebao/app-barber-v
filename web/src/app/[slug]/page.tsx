"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPaletteById, paletteToVars } from "@/app/lib/palettes";
import { toast } from "@/app/lib/toast";
import BarberPageChat from "./_chat-page";
import PixAutomatico from "./_pix-automatico";

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
        // Restore saved identity
        try {
          const saved = localStorage.getItem("client_identity");
          if (saved) {
            const { name, phone } = JSON.parse(saved);
            if (name) setClientName(name);
            if (phone) setClientPhone(phone);
          }
        } catch { /* ignore */ }
        setStep("name");
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

  const handleSubmitPhone = async () => {
    const phone = phoneInput.replace(/\D/g, "");
    if (phone.length < 10) return;
    setClientPhone(phone);

    try {
      const res = await fetch(`/api/appointments?phone=${phone}&shopId=${shop!.id}`);
      const data = await res.json();
      // Salva fidelidade
      if (typeof data.loyaltyCount === "number") setLoyaltyCount(data.loyaltyCount);
      if (typeof data.loyaltyProgress === "number") setLoyaltyProgress(data.loyaltyProgress);
      if (data.lastBooking) setLastBooking(data.lastBooking);
      if (data.pendingRating) {
        setPendingRating(data.pendingRating);
        setStep("rating");
        try { localStorage.setItem("client_identity", JSON.stringify({ name: clientName, phone })); } catch { /* ignore */ }
        return;
      }
    } catch { /* ignore */ }

    try { localStorage.setItem("client_identity", JSON.stringify({ name: clientName, phone })); } catch { /* ignore */ }
    setStep("mode_select");
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
      <div className="flex min-h-screen items-center justify-center bg-black">
        <p className="text-red-400">{loadError}</p>
      </div>
    );
  }

  // Modo efetivo: escolha do cliente sobrepõe configuração da barbearia
  const effectiveMode = clientMode ?? shop?.bookingMode ?? "steps";
  if (step !== "loading" && step !== "name" && step !== "phone" && step !== "mode_select" && step !== "rating" && effectiveMode === "agent" && shop) {
    return <BarberPageChat shop={shop} slug={slug} initialName={clientName} initialPhone={clientPhone} />;
  }

  return (
    <main className="min-h-screen bg-dark-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-dark-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {shop?.logoUrl ? (
            <img src={shop.logoUrl} alt={shop.name} className="w-10 h-10 rounded-full object-cover border border-brand-500/30" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-xl">✂️</div>
          )}
          <div>
            <p className="font-semibold text-brand-400 text-sm">{shop?.name || "..."}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500">{shop ? `${shop.openTime} – ${shop.closeTime}` : ""}</p>
              {shop?.avgRating && shop.ratingCount > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-amber-400 font-semibold">
                  ★ {shop.avgRating.toFixed(1)}
                  <span className="text-gray-600 font-normal">({shop.ratingCount})</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push(`/${slug}/meus-agendamentos`)}
          className="text-xs text-gray-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:text-white transition"
        >
          Meus agendamentos
        </button>
      </header>

      {/* Onde fica e como falar. So aparece se a barbearia preencheu —
          quem cadastrou antes desses campos existirem nao ve faixa vazia. */}
      {shop && (shop.address || shop.city || shop.phone) && (
        <div className="px-4 py-2.5 bg-dark-800/60 border-b border-gray-800 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
          {(shop.address || shop.city) && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                [shop.name, shop.address, shop.neighborhood, shop.city, shop.state].filter(Boolean).join(", ")
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-brand-400 transition"
            >
              <span>📍</span>
              <span>
                {[shop.address, shop.neighborhood].filter(Boolean).join(" - ")}
                {(shop.address || shop.neighborhood) && (shop.city || shop.state) ? " · " : ""}
                {[shop.city, shop.state].filter(Boolean).join("/")}
              </span>
            </a>
          )}
          {shop.phone && (
            <a href={`https://wa.me/55${shop.phone}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-brand-400 transition">
              <span>💬</span>
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

      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Loading */}
        {step === "loading" && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Step: Name */}
        {step === "name" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Bem-vindo! 👋</h2>
              <p className="text-gray-400 mt-1">Vamos agendar seu horário em <span className="text-brand-400">{shop?.name}</span></p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-gray-400">Qual é o seu nome completo?</label>
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmitName(); } }}
                placeholder="Seu nome..."
                className="w-full bg-dark-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors"
              />
              <button
                onClick={handleSubmitName}
                disabled={!nameInput.trim()}
                className="w-full bg-brand-500 hover:bg-brand-400 text-dark-900 font-semibold rounded-xl py-3 transition disabled:opacity-40 press-scale"
              >
                Continuar
              </button>
            </div>

            {/* Reviews */}
            {reviews.length > 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-gray-500 uppercase tracking-widest">O que dizem nossos clientes</p>
                {reviews.map((r) => (
                  <div key={r.id} className="bg-dark-900 border border-gray-800 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-sm font-semibold">
                          {r.clientName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{r.clientName}</p>
                          <p className="text-xs text-gray-500">com {r.barberName}</p>
                        </div>
                      </div>
                      <span className="text-amber-400 text-sm font-semibold">{"★".repeat(r.score)}{"☆".repeat(5 - r.score)}</span>
                    </div>
                    {r.comment && <p className="text-sm text-gray-400 leading-relaxed">&ldquo;{r.comment}&rdquo;</p>}
                    <p className="text-xs text-gray-600">{r.services.join(", ")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Phone */}
        {step === "phone" && (
          <div className="space-y-6">
            <div>
              <button onClick={() => setStep("name")} className="text-sm text-brand-400 mb-4 block">← Voltar</button>
              <h2 className="text-2xl font-semibold">Olá, {clientName.split(" ")[0]}!</h2>
              <p className="text-gray-400 mt-1">Informe seu telefone para continuar</p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-gray-400">Telefone com DDD</label>
              <input
                autoFocus
                value={phoneInput}
                onChange={(e) => handlePhoneInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmitPhone(); } }}
                placeholder="(11) 99999-9999"
                type="tel"
                className="w-full bg-dark-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors"
              />
              <button
                onClick={handleSubmitPhone}
                disabled={phoneInput.replace(/\D/g, "").length < 10}
                className="w-full bg-brand-500 hover:bg-brand-400 text-dark-900 font-semibold rounded-xl py-3 transition disabled:opacity-40 press-scale"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Step: Rating */}
        {step === "rating" && pendingRating && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Como foi sua visita?</h2>
              <p className="text-gray-400 mt-1">
                {pendingRating.services.join(", ")} com {pendingRating.barberName} — {formatDate(pendingRating.date)}
              </p>
            </div>
            <div className="bg-dark-900 border border-gray-700 rounded-2xl p-6 space-y-4">
              <div className="flex justify-center gap-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingScore(star)}
                    className={`text-4xl transition-all ${ratingScore >= star ? "text-yellow-400" : "text-gray-700"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <input
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Comentário (opcional)"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmitRating(); } }}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-400"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("mode_select")}
                className="flex-1 border border-gray-700 rounded-xl py-3 text-sm text-gray-400 hover:text-white transition"
              >
                Pular
              </button>
              <button
                onClick={handleSubmitRating}
                disabled={ratingScore === 0}
                className="flex-1 bg-brand-500 hover:bg-brand-400 text-dark-900 font-semibold rounded-xl py-3 text-sm transition disabled:opacity-40"
              >
                Avaliar e continuar
              </button>
            </div>
          </div>
        )}

        {/* Step: Mode Select */}
        {step === "mode_select" && shop && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Como prefere agendar?</h2>
              <p className="text-gray-400 mt-1">Escolha a forma que preferir — você pode mudar sempre que quiser.</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => { setClientMode("steps"); setStep("services"); }}
                className="w-full text-left bg-dark-900 border-2 border-gray-700 hover:border-brand-400 rounded-2xl p-5 transition group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">📋</span>
                  <div>
                    <p className="font-semibold text-white text-lg group-hover:text-brand-400 transition">Etapas clássico</p>
                    <p className="text-gray-500 text-sm mt-0.5">Escolha serviço, barbeiro, data e hora passo a passo</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => { setClientMode("agent"); setStep("services"); }}
                className="w-full text-left bg-dark-900 border-2 border-gray-700 hover:border-brand-400 rounded-2xl p-5 transition group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-4xl">🤖</span>
                  <div>
                    <p className="font-semibold text-white text-lg group-hover:text-brand-400 transition">Chatbot IA</p>
                    <p className="text-gray-500 text-sm mt-0.5">Converse naturalmente e deixe a IA montar seu agendamento</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step: Services */}
        {step === "services" && shop && (
          <div className="space-y-5">
            {/* Banner de fidelidade — só aparece quando o cliente tem histórico */}
            {loyaltyCount > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-400">
                    {loyaltyProgress === 0 && loyaltyCount > 0
                      ? `Parabéns! Você atingiu ${loyaltyCount} cortes! 🎉`
                      : `Faltam ${loyaltyTarget - loyaltyProgress} corte${loyaltyTarget - loyaltyProgress !== 1 ? "s" : ""} para o seu brinde!`}
                  </p>
                  <div className="mt-1.5 h-2 w-full rounded-full bg-amber-900/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-700"
                      style={{ width: `${(loyaltyProgress / loyaltyTarget) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-amber-500/80 mt-1">{loyaltyProgress}/{loyaltyTarget} cortes</p>
                </div>
              </div>
            )}
            {/* Card "Agendar novamente" — último agendamento do cliente */}
            {lastBooking && (
              <div className="rounded-2xl border border-brand-500/30 bg-brand-500/10 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔄</span>
                  <p className="text-sm font-semibold text-brand-400">Agendar novamente?</p>
                </div>
                <p className="text-sm text-gray-400">
                  {lastBooking.serviceNames.join(", ")} com {lastBooking.barberName} — R$ {lastBooking.totalPrice.toFixed(2)}
                </p>
                <button
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
                  className="w-full bg-brand-500 hover:bg-brand-400 text-dark-900 font-semibold rounded-xl py-2.5 text-sm transition press-scale"
                >
                  Repetir agendamento
                </button>
              </div>
            )}

            <div>
              <h2 className="text-2xl font-semibold">Escolha os serviços</h2>
              <p className="text-gray-400 mt-1">Selecione um ou mais serviços</p>
            </div>

            {/* Cards visuais — cortes e luzes (serviços principais com foto) */}
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
                            onClick={() => toggleService(service.id, service.category)}
                            className={`relative rounded-2xl overflow-hidden border-2 transition-all aspect-[4/3] ${
                              selected ? "border-brand-400" : "border-transparent"
                            }`}
                          >
                            {service.imageUrl ? (
                              <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center text-4xl">✂️</div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div
                              className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                selected ? "bg-brand-400 border-brand-400" : "bg-white/20 border-white/60"
                              }`}
                            >
                              {selected && <span className="text-black text-xs font-semibold">✓</span>}
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-2.5 text-left">
                              <p className="text-white font-semibold text-sm leading-tight">{service.name}</p>
                              <div className="flex justify-between text-xs text-gray-300 mt-0.5">
                                <span>R$ {service.price.toFixed(2)}</span>
                                <span>{service.duration}min</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Complementos — barba, sobrancelha, pezinho (checkbox simples) */}
                  {extraServices.length > 0 && (
                    <div className="space-y-2">
                      {cardServices.length > 0 && (
                        <p className="text-xs text-gray-500 uppercase tracking-widest mt-2">Complementos</p>
                      )}
                      {extraServices.map((service) => {
                        const selected = selectedServices.includes(service.id);
                        return (
                          <button
                            key={service.id}
                            onClick={() => toggleService(service.id, service.category)}
                            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all ${
                              selected
                                ? "border-brand-400 bg-brand-500/10"
                                : "border-gray-700 bg-dark-900 hover:border-gray-600"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                selected ? "bg-brand-400 border-brand-400" : "border-gray-600"
                              }`}>
                                {selected && <span className="text-black text-xs font-semibold">✓</span>}
                              </div>
                              <span className={`text-sm font-medium ${selected ? "text-white" : "text-gray-300"}`}>
                                {service.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              <span>{service.duration}min</span>
                              <span className="text-brand-400 font-semibold">R$ {service.price.toFixed(2)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
            <button
              onClick={handleSubmitServices}
              disabled={selectedServices.length === 0}
              className="w-full bg-brand-500 hover:bg-brand-400 text-dark-900 font-semibold rounded-xl py-3 transition disabled:opacity-40 press-scale"
            >
              {selectedServices.length > 0
                ? `Continuar · R$ ${totalPrice.toFixed(2)} · ${totalDuration}min`
                : "Selecione um serviço"}
            </button>
          </div>
        )}

        {/* Step: Barber */}
        {step === "barber" && shop && (
          <div className="space-y-5">
            <div>
              <button onClick={() => setStep("services")} className="text-sm text-brand-400 mb-4 block">← Voltar</button>
              <h2 className="text-2xl font-semibold">Escolha o profissional</h2>
              <p className="text-gray-400 mt-1">Com quem você prefere ser atendido?</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {shop.barbers.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSelectBarber(b)}
                  className="flex flex-col items-center gap-3 p-5 bg-dark-900 border border-gray-700 rounded-2xl hover:border-brand-400 hover:bg-brand-500/5 transition"
                >
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt={b.name} className="w-14 h-14 rounded-full object-cover border border-brand-500/30" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-2xl font-semibold">
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-semibold text-white">{b.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Date */}
        {step === "date" && (
          <div className="space-y-5">
            <div>
              <button onClick={() => setStep(shop!.barbers.length > 1 ? "barber" : "services")} className="text-sm text-brand-400 mb-4 block">← Voltar</button>
              <h2 className="text-2xl font-semibold">Escolha a data</h2>
              <p className="text-gray-400 mt-1">Quando você prefere vir?</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {getAvailableDates().map((date) => (
                <button
                  key={date}
                  onClick={() => handleSelectDate(date)}
                  className="flex flex-col items-center px-2 py-3 bg-dark-900 border border-gray-700 rounded-xl hover:border-brand-400 hover:bg-brand-500/5 transition"
                >
                  <span className="text-gray-400 text-xs">
                    {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" })}
                  </span>
                  <span className="font-semibold text-white text-lg">
                    {new Date(date + "T12:00:00").getDate()}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short" })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Time */}
        {step === "time" && (
          <div className="space-y-5">
            <div>
              <button onClick={() => setStep("date")} className="text-sm text-brand-400 mb-4 block">← Voltar</button>
              <h2 className="text-2xl font-semibold">Escolha o horário</h2>
              <p className="text-gray-400 mt-1">{formatDate(selectedDate)}</p>
            </div>
            {slotsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-6 space-y-3">
                  <p className="text-2xl">📅</p>
                  <p className="text-gray-400">{slotsMessage || "Nenhum horário disponível neste dia"}</p>
                  <button onClick={() => setStep("date")} className="text-brand-400 underline text-sm">
                    Escolher outra data
                  </button>
                </div>
                <div className="border border-brand-500/30 bg-brand-500/5 rounded-2xl p-5 space-y-3">
                  {waitlistJoined ? (
                    <div className="text-center space-y-2">
                      <p className="text-2xl">✅</p>
                      <p className="text-white font-semibold">Você está na lista de espera!</p>
                      <p className="text-sm text-gray-400">Te avisamos pelo WhatsApp se abrir um horário neste dia.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-brand-400">Entrar na lista de espera</p>
                      <p className="text-xs text-gray-400">Se alguém cancelar, você recebe um WhatsApp automaticamente.</p>
                      <button
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
                        disabled={waitlistLoading}
                        className="w-full bg-brand-500 hover:bg-brand-400 text-dark-900 font-semibold rounded-xl py-3 transition disabled:opacity-50 press-scale"
                      >
                        {waitlistLoading ? "Aguarde..." : "🔔 Quero ser avisado"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {availableSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => handleSelectTime(time)}
                    className="py-3 bg-dark-900 border border-gray-700 rounded-xl text-sm font-medium text-white hover:border-brand-400 hover:bg-brand-500/5 transition"
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && shop && (
          <div className="space-y-5">
            <div>
              <button onClick={() => setStep("time")} className="text-sm text-brand-400 mb-4 block">← Voltar</button>
              <h2 className="text-2xl font-semibold">Confirmar agendamento</h2>
              <p className="text-gray-400 mt-1">Revise os detalhes abaixo</p>
            </div>
            <div className="bg-dark-900 border border-gray-700 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Cliente</span>
                <span className="font-medium">{clientName}</span>
              </div>
              {selectedBarber && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Profissional</span>
                  <span className="font-medium">{selectedBarber.name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Serviços</span>
                <span className="font-medium text-right max-w-[60%]">
                  {shop.services.filter((s) => selectedServices.includes(s.id)).map((s) => s.name).join(", ")}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Data</span>
                <span className="font-medium">{formatDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Horário</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
              <div className="border-t border-gray-800 pt-3 flex justify-between">
                <span className="text-gray-400 text-sm">Total</span>
                <span className="font-semibold text-brand-400 text-lg">R$ {totalPrice.toFixed(2)}</span>
              </div>
            </div>
            {bookError && (
              <p className="text-red-400 text-sm text-center">{bookError}</p>
            )}
            <button
              onClick={handleBook}
              className="w-full bg-brand-500 hover:bg-brand-400 text-dark-900 font-semibold rounded-xl py-3 transition press-scale"
            >
              Confirmar agendamento
            </button>
          </div>
        )}

        {/* Step: Booking (loading) */}
        {step === "booking" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">Confirmando seu agendamento...</p>
          </div>
        )}

        {/* Step: Pix */}
        {step === "pix" && pixKey && shop && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold text-yellow-400">Pagamento antecipado</h2>
              <p className="text-gray-400 mt-1">Para confirmar seu horário, é necessário pagar 50% via Pix antecipado.</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between">
                <span className="text-yellow-400 font-semibold">Entrada via Pix (50%)</span>
                <span className="text-yellow-400 font-semibold text-lg">R$ {(totalPrice / 2).toFixed(2)}</span>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2">Chave Pix</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pixKey);
                    setPixCopied(true);
                    setTimeout(() => setPixCopied(false), 2000);
                  }}
                  className="w-full flex items-center justify-between bg-black/40 rounded-xl p-3 hover:bg-black/60 transition"
                >
                  <span className="text-white font-semibold break-all text-left">{pixKey}</span>
                  <span className="ml-3 shrink-0 text-sm font-semibold text-yellow-400">
                    {pixCopied ? "✓ Copiado!" : "📋 Copiar"}
                  </span>
                </button>
              </div>
              <p className="text-xs text-gray-400">Após o pagamento, envie o comprovante via WhatsApp para a barbearia.</p>
            </div>
            <button
              onClick={handlePixConfirm}
              disabled={pixSending}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-xl py-3 transition disabled:opacity-50"
            >
              {pixSending ? "Aguarde..." : "✓ Já enviei o comprovante"}
            </button>
            <button
              onClick={resetFlow}
              className="w-full border border-gray-700 text-gray-400 rounded-xl py-3 text-sm hover:text-white transition"
            >
              Voltar ao início
            </button>
          </div>
        )}

        {/* Step: Pix automático (Mercado Pago) — confirma sozinho */}
        {step === "pix_auto" && pixAuto && (
          <PixAutomatico
            pix={pixAuto}
            appointmentId={pixAptId}
            phone={clientPhone}
            onConfirmado={() => setStep("done")}
            onVoltar={resetFlow}
          />
        )}

        {/* Step: Pix enviado — aguardando confirmação do barbeiro */}
        {step === "pix_sent" && (
          <div className="space-y-5 text-center">
            <div className="py-6">
              <div className="text-6xl mb-4">⏳</div>
              <h2 className="text-2xl font-semibold text-yellow-400">Aguardando confirmação</h2>
              <p className="text-gray-400 mt-2">
                Seu agendamento foi registrado e o barbeiro foi avisado. Assim que ele confirmar o Pix, seu horário está garantido.
              </p>
              <div className="mt-4 rounded-2xl border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 text-left flex items-start gap-3">
                <span className="text-lg mt-0.5">⏳</span>
                <p className="text-sm text-yellow-300 leading-snug">
                  O horário fica reservado para você enquanto o barbeiro confirma.
                  <span className="block text-yellow-200/70 text-xs mt-1">
                    Se ele não confirmar em até 6 horas de expediente, o horário volta a ficar disponível — nesse caso, fale com a barbearia.
                  </span>
                </p>
              </div>
            </div>
            {bookingResult && (
              <div className="bg-dark-900 border border-gray-700 rounded-2xl p-5 text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Data</span>
                  <span className="font-medium">{formatDate(bookingResult.date)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Horário</span>
                  <span className="font-medium">{bookingResult.startTime}</span>
                </div>
              </div>
            )}
            <button
              onClick={resetFlow}
              className="w-full border border-gray-700 text-gray-400 rounded-xl py-3 text-sm hover:text-white transition"
            >
              Voltar ao início
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && bookingResult && (
          <div className="space-y-5 text-center">
            <div className="py-6">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-semibold text-white">Agendado!</h2>
              <p className="text-gray-400 mt-2">
                Até {formatDate(bookingResult.date)} às {bookingResult.startTime}. Nos vemos lá! 💈
              </p>
            </div>
            <div className="bg-dark-900 border border-gray-700 rounded-2xl p-5 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Barbearia</span>
                <span className="font-medium">{shop?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Data</span>
                <span className="font-medium">{formatDate(bookingResult.date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Horário</span>
                <span className="font-medium">{bookingResult.startTime}</span>
              </div>
            </div>
            {/* Aviso de possível atraso — gestão de expectativa */}
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 flex items-start gap-3 text-left">
              <span className="text-xl mt-0.5">⏱️</span>
              <p className="text-sm text-amber-300 leading-snug">
                Um pedido: pode haver um atraso de até <span className="font-semibold">15 minutos</span> no seu horário.
                <span className="block text-amber-200/70 font-normal text-xs mt-1">
                  É que cada cliente merece o tempo certo na cadeira — inclusive você. Agradecemos a compreensão e a paciência! 🙏
                </span>
              </p>
            </div>
            {/* Lembrete de próximo corte */}
            <div className="rounded-2xl border border-brand-500/25 bg-brand-500/10 px-4 py-3 flex items-start gap-3">
              <span className="text-xl mt-0.5">🗓️</span>
              <p className="text-sm text-brand-400 font-medium leading-snug">
                Não se esqueça de deixar o próximo corte agendado!<br />
                <span className="text-gray-400 font-normal text-xs">Volte aqui quando quiser marcar seu próximo horário.</span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={resetFlow}
                className="flex-1 border border-gray-700 text-gray-400 rounded-xl py-3 text-sm hover:text-white transition"
              >
                Novo agendamento
              </button>
              <button
                onClick={() => router.push(`/${slug}/meus-agendamentos`)}
                className="flex-1 bg-brand-500 text-dark-900 font-semibold rounded-xl py-3 text-sm hover:bg-brand-400 transition"
              >
                Meus agendamentos
              </button>
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