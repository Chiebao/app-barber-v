// VERSÃO CHAT (AGENTE IA) — Importada condicionalmente pela page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Service {
  id: string; name: string; duration: number; price: number;
  category: string; imageUrl?: string | null;
}
interface Barber { id: string; name: string; }
interface ChatShop {
  id: string; name: string; openTime: string; closeTime: string;
  workDays: number[]; avgServiceTime: number; pixKey: string | null;
  barbers: Barber[]; services: Service[];
  avgRating?: number | null; ratingCount?: number;
}
interface PendingRating {
  appointmentId: string; barberName: string; date: string; services: string[];
}
interface ChatMessage { id: number; from: "bot" | "user"; text: string; }

type ChatStep =
  | "name" | "phone" | "rating" | "services"
  | "barber" | "date" | "time" | "confirm" | "booking" | "pix" | "done";

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

export default function BarberPageChat({
  shop,
  slug,
  initialName = "",
  initialPhone = "",
}: {
  shop: ChatShop;
  slug: string;
  /** Nome/telefone já informados no fluxo anterior — evita perguntar de novo. */
  initialName?: string;
  initialPhone?: string;
}) {
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<ChatStep>("name");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pixCopied, setPixCopied] = useState(false);

  const [clientName, setClientName] = useState(initialName);
  const [clientPhone, setClientPhone] = useState(initialPhone);
  const [inputValue, setInputValue] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [pendingRating, setPendingRating] = useState<PendingRating | null>(null);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [pixKey, setPixKey] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<{
    shopName: string; date: string; startTime: string;
    services: string[]; totalPrice: number;
  } | null>(null);

  const msgIdRef = useRef(1);
  const addBot = (text: string) => {
    const id = msgIdRef.current++;
    setMessages((prev) => [...prev, { id, from: "bot", text }]);
  };
  const addUser = (text: string) => {
    const id = msgIdRef.current++;
    setMessages((prev) => [...prev, { id, from: "user", text }]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, step]);

  useEffect(() => {
    // 1) Usa o que veio do fluxo anterior; 2) senão, tenta o que ficou salvo no aparelho
    let name = initialName;
    let phone = initialPhone;
    if (!name || !phone) {
      try {
        const saved = localStorage.getItem("client_identity");
        if (saved) {
          const s = JSON.parse(saved);
          if (!name && s.name) name = s.name;
          if (!phone && s.phone) phone = String(s.phone).replace(/\D/g, "");
        }
      } catch { /* ignore */ }
    }

    const cleanPhone = String(phone || "").replace(/\D/g, "");

    // Já conhecemos o cliente → não perguntar nome/telefone de novo
    if (name && cleanPhone.length >= 10) {
      setClientName(name);
      setClientPhone(cleanPhone);
      addBot(`Olá de novo, ${name.split(" ")[0]}! 😊 Sou o assistente de *${shop.name}*.`);
      setTimeout(() => { addBot("Por qual serviço você está procurando?"); setStep("services"); }, 500);
      return;
    }

    // Cliente novo → fluxo completo
    addBot(`Olá! Sou o assistente virtual de *${shop.name}*. Qual é o seu nome completo?`);
    setStep("name");
  }, [shop, initialName, initialPhone]);

  const totalPrice = shop
    ? shop.services.filter((s) => selectedServices.includes(s.id)).reduce((sum, s) => sum + s.price, 0) : 0;
  const totalDuration = shop
    ? shop.services.filter((s) => selectedServices.includes(s.id)).reduce((sum, s) => sum + s.duration, 0) : 0;
  const selectedBarber = shop?.barbers.find((b) => b.id === selectedBarberId);

  const handleSubmitName = () => {
    const name = inputValue.trim();
    if (!name) return;
    setClientName(name); setInputValue(""); addUser(name);
    setTimeout(() => { addBot(`Como vai, ${name.split(" ")[0]}! 😊 Qual é o seu telefone com DDD?`); setStep("phone"); }, 400);
  };

  const handleSubmitPhone = async () => {
    const phone = inputValue.replace(/\D/g, "");
    if (phone.length < 10) return;
    setClientPhone(phone); setInputValue(""); addUser(formatPhone(phone));
    try {
      const res = await fetch(`/api/appointments?phone=${phone}&shopId=${shop!.id}`);
      const data = await res.json();
      if (data.pendingRating) {
        setPendingRating(data.pendingRating);
        setTimeout(() => { addBot(`Antes de continuar, como foi sua última visita com ${data.pendingRating.barberName}?`); setStep("rating"); }, 400);
        try { localStorage.setItem("client_identity", JSON.stringify({ name: clientName, phone })); } catch { /* ignore */ }
        return;
      }
    } catch { /* ignore */ }
    try { localStorage.setItem("client_identity", JSON.stringify({ name: clientName, phone })); } catch { /* ignore */ }
    goToServices();
  };

  const goToServices = () => {
    setTimeout(() => { addBot("Por qual serviço você está procurando?"); setStep("services"); }, 400);
  };

  const handleSubmitRating = async () => {
    if (ratingScore === 0) return;
    try {
      await fetch(`/api/appointments/${pendingRating!.appointmentId}/rate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: ratingScore, comment: ratingComment, clientPhone: clientPhone.replace(/\D/g, "") }),
      });
    } catch { /* ignore */ }
    addUser(`Avaliação: ${"⭐".repeat(ratingScore)}`);
    goToServices();
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
    const names = shop!.services.filter((s) => selectedServices.includes(s.id)).map((s) => s.name).join(", ");
    addUser(names);
    if (shop!.barbers.length > 1) {
      setTimeout(() => { addBot("Com qual profissional você prefere ser atendido?"); setStep("barber"); }, 400);
    } else {
      setSelectedBarberId(shop!.barbers[0]?.id || "");
      goToDate();
    }
  };

  const handleSelectBarber = (b: Barber) => { setSelectedBarberId(b.id); addUser(b.name); goToDate(); };

  /**
   * Voltar um passo na conversa.
   *
   * Um chat sugere que dá para corrigir o que você acabou de dizer — e até
   * agora não dava: escolheu a data errada e não tinha caminho de volta a
   * não ser recomeçar tudo. Identificação (nome, telefone) fica de fora
   * porque voltar ali não corrige nada, só apaga o que já foi confirmado.
   */
  const passoAnterior: Partial<Record<ChatStep, ChatStep>> = {
    barber: "services",
    date: (shop?.barbers.length ?? 0) > 1 ? "barber" : "services",
    time: "date",
    confirm: "time",
  };

  const voltarUmPasso = () => {
    const alvo = passoAnterior[step];
    if (!alvo) return;

    // Desfaz a escolha do passo que está sendo abandonado, senão ela fica
    // valendo por baixo e o resumo mostra o que o cliente já trocou
    if (step === "time") setSelectedTime("");
    if (step === "confirm") setSelectedTime("");
    if (step === "date") setSelectedDate("");
    if (step === "barber" && (shop?.barbers.length ?? 0) > 1) setSelectedBarberId("");

    const fala: Record<string, string> = {
      services: "Sem problema! Quais serviços você quer?",
      barber: "Claro! Com qual profissional você prefere?",
      date: "Tudo bem, vamos escolher outro dia.",
      time: "Beleza, escolhe outro horário.",
    };

    setStep(alvo);
    addBot(fala[alvo] || "Vamos voltar um passo.");
  };

  const goToDate = () => {
    setTimeout(() => { addBot("Quando você prefere vir?"); setStep("date"); }, 400);
  };

  const getAvailableDates = () => {
    if (!shop) return [];
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      if (shop.workDays.includes(d.getDay())) dates.push(diaLocal(d));
    }
    return dates;
  };

  const handleSelectDate = async (date: string) => {
    setSelectedDate(date); addUser(formatDate(date)); setSlotsLoading(true);
    try {
      const barberId = selectedBarberId || shop!.barbers[0]?.id;
      const res = await fetch(`/api/shops/${slug}/slots?date=${date}&duration=${totalDuration}&barberId=${barberId}`);
      const data = await res.json();
      let slots: string[] = data.slots || [];
      const todayStr = new Date().toISOString().split("T")[0];
      if (date === todayStr) {
        const now = new Date();
        const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        slots = slots.filter((s: string) => s > cur);
      }
      setAvailableSlots(slots);
    } catch { /* ignore */ }
    setSlotsLoading(false);
    setTimeout(() => { addBot("Que horário você prefere?"); setStep("time"); }, 400);
  };

  const handleSelectTime = (time: string) => {
    setSelectedTime(time); addUser(time);
    setTimeout(() => { addBot(`Perfeito! Aqui está o resumo do seu agendamento:`); setStep("confirm"); }, 400);
  };

  const handleBook = async () => {
    setStep("booking");
    try {
      const res = await fetch("/api/appointments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopId: shop!.id, barberId: selectedBarberId || shop!.barbers[0]?.id,
          clientName, clientPhone: clientPhone.replace(/\D/g, ""),
          serviceIds: selectedServices, date: selectedDate, startTime: selectedTime,
        }),
      });
      if (res.status === 402) {
        const err = await res.json(); setPixKey(err.pixKey);
        addBot("⚠️ Para confirmar seu horário, é necessário pagar 50% antecipado via Pix.");
        setStep("pix"); return;
      }
      if (!res.ok) {
        const err = await res.json();
        addBot(`❌ ${err.error || "Erro ao agendar. Tente novamente."}`);
        setStep("confirm"); return;
      }
      const data = await res.json();
      setBookingResult(data.appointment);
      addUser("Confirmar agendamento ✓");
      addBot(`✅ Agendamento confirmado! Até ${formatDate(data.appointment.date)} às ${data.appointment.startTime}. Nos vemos lá! 💈`);
      setStep("done");
    } catch { addBot("❌ Erro ao agendar. Tente novamente."); setStep("confirm"); }
  };

  const resetFlow = () => {
    setMessages([]); setStep("name");
    setSelectedServices([]); setSelectedDate(""); setSelectedTime(""); setSelectedBarberId("");
    setRatingScore(0); setRatingComment(""); setPendingRating(null);
    setPixKey(null); setBookingResult(null);
    setTimeout(() => { addBot(`Olá novamente! Por qual serviço você está procurando?`); setStep("services"); }, 100);
  };

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
    setInputValue(formatPhone(digits));
  };

  return (
    <main className="flex flex-col h-screen bg-black text-white">
      <header className="flex items-center justify-between px-4 py-3 bg-dark-800 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-xl">✂️</div>
          <div>
            <p className="font-semibold text-brand-400 text-sm">{shop.name}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500">{shop.openTime} – {shop.closeTime}</p>
              {shop.avgRating && shop.ratingCount && shop.ratingCount > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-amber-400 font-semibold">
                  ★ {shop.avgRating.toFixed(1)}
                  <span className="text-gray-600 font-normal">({shop.ratingCount})</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => router.push(`/${slug}/meus-agendamentos`)}
          className="text-xs text-gray-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:text-white transition">
          Meus agendamentos
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
            {msg.from === "bot" && (
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs mr-2 shrink-0 mt-1">✂️</div>
            )}
            <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              msg.from === "bot" ? "bg-blue-600 text-white rounded-tl-sm" : "bg-gray-700 text-white rounded-tr-sm"
            }`}
              dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*(.*?)\*/g, "<strong>$1</strong>") }}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-gray-800 bg-gray-950">
        {step === "name" && (
          <div className="p-3 flex gap-2">
            <input autoFocus value={inputValue} onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmitName(); } }}
              placeholder="Seu nome completo..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none text-sm" />
            <button onClick={handleSubmitName} disabled={!inputValue.trim()}
              className="bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold text-sm disabled:opacity-40 hover:bg-blue-500 transition">
              Enviar
            </button>
          </div>
        )}
        {step === "phone" && (
          <div className="p-3 flex gap-2">
            <input autoFocus value={inputValue} onChange={(e) => handlePhoneInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmitPhone(); } }}
              placeholder="(11) 99999-9999" type="tel"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none text-sm" />
            <button onClick={handleSubmitPhone} disabled={inputValue.replace(/\D/g, "").length < 10}
              className="bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold text-sm disabled:opacity-40 hover:bg-blue-500 transition">
              Enviar
            </button>
          </div>
        )}
        {step === "rating" && pendingRating && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-400 text-center">
              {pendingRating.services.join(", ")} com {pendingRating.barberName} — {formatDate(pendingRating.date)}
            </p>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRatingScore(star)}
                  className={`text-3xl transition-all ${ratingScore >= star ? "text-yellow-400" : "text-gray-600"}`}>★</button>
              ))}
            </div>
            <input value={ratingComment} onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Comentário (opcional)"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={() => { addUser("Pular avaliação"); goToServices(); }}
                className="flex-1 border border-gray-700 rounded-xl py-2.5 text-sm text-gray-400">Pular</button>
              <button onClick={handleSubmitRating} disabled={ratingScore === 0}
                className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40">Avaliar</button>
            </div>
          </div>
        )}
        {passoAnterior[step] && (
          <div className="px-4 pt-3">
            <button
              onClick={voltarUmPasso}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand-400 transition"
            >
              <span className="text-base">←</span> Voltar
            </button>
          </div>
        )}

        {step === "services" && shop && (
          <div className="pt-3 pb-3">
            <p className="text-xs text-gray-500 px-4 mb-2 tracking-widest">SELECIONE OS SERVIÇOS:</p>
            <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
              {shop.services.map((service) => {
                const selected = selectedServices.includes(service.id);
                return (
                  <button key={service.id} onClick={() => toggleService(service.id, service.category)}
                    className={`relative flex-shrink-0 w-44 h-36 rounded-2xl overflow-hidden border-2 transition-all ${selected ? "border-yellow-400" : "border-transparent"}`}>
                    {service.imageUrl
                      ? <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center text-4xl">✂️</div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selected ? "bg-yellow-400 border-yellow-400" : "bg-white/20 border-white/60"}`}>
                      {selected && <span className="text-black text-xs font-semibold">✓</span>}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2.5">
                      <p className="text-white font-semibold text-sm leading-tight">{service.name}</p>
                      <div className="flex justify-between text-xs text-gray-300 mt-0.5">
                        <span>R$ {service.price.toFixed(2)}</span>
                        <span>{service.duration}min</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              <div className="flex-shrink-0 w-2" />
            </div>
            {shop.services.length > 2 && (
              <p className="text-xs text-gray-600 text-right px-4 mt-1">ARRASTE PARA O LADO PARA VER MAIS →</p>
            )}
            <div className="px-4 mt-3">
              <button onClick={handleSubmitServices} disabled={selectedServices.length === 0}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-40 transition">
                {selectedServices.length > 0 ? `Enviar (R$ ${totalPrice.toFixed(2)} · ${totalDuration}min)` : "Enviar"}
              </button>
            </div>
          </div>
        )}
        {step === "barber" && shop && (
          <div className="pt-3 pb-3">
            <p className="text-xs text-gray-500 px-4 mb-2 tracking-widest">ESCOLHA O PROFISSIONAL:</p>
            <div className="flex gap-3 overflow-x-auto px-4 pb-2">
              {shop.barbers.map((b) => (
                <button key={b.id} onClick={() => handleSelectBarber(b)}
                  className="flex-shrink-0 flex flex-col items-center gap-2 p-4 bg-gray-800 rounded-2xl border border-gray-700 hover:border-brand-400 transition min-w-[100px]">
                  <div className="w-12 h-12 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-xl font-semibold">
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-white">{b.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === "date" && (
          <div className="pt-3 pb-3">
            <p className="text-xs text-gray-500 px-4 mb-2 tracking-widest">ESCOLHA A DATA:</p>
            <div className="flex gap-2 overflow-x-auto px-4 pb-2">
              {getAvailableDates().map((date) => (
                <button key={date} onClick={() => handleSelectDate(date)}
                  className="flex-shrink-0 flex flex-col items-center px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl hover:border-brand-400 hover:bg-brand-500/10 transition text-sm">
                  <span className="text-gray-400 text-xs">
                    {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" })}
                  </span>
                  <span className="font-semibold text-white">{new Date(date + "T12:00:00").getDate()}</span>
                  <span className="text-gray-400 text-xs">
                    {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short" })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === "time" && (
          <div className="p-4">
            {slotsLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-3">
                <p className="text-gray-400 text-sm mb-3">Nenhum horário disponível neste dia</p>
                <button onClick={voltarUmPasso}
                  className="text-brand-400 text-sm underline">Escolher outra data</button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                {availableSlots.map((time) => (
                  <button key={time} onClick={() => handleSelectTime(time)}
                    className="py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm font-medium text-white hover:border-brand-400 hover:bg-brand-500/10 transition">
                    {time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {step === "confirm" && shop && (
          <div className="p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 mb-3 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Cliente</span><span className="font-medium">{clientName}</span>
              </div>
              {selectedBarber && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Profissional</span><span className="font-medium">{selectedBarber.name}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Serviços</span>
                <span className="font-medium text-right">
                  {shop.services.filter((s) => selectedServices.includes(s.id)).map((s) => s.name).join(", ")}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Data</span><span className="font-medium">{formatDate(selectedDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Horário</span><span className="font-medium">{selectedTime}</span>
              </div>
              <div className="border-t border-gray-700 pt-2.5 flex justify-between">
                <span className="text-gray-400 text-sm">Total</span>
                <span className="font-semibold text-brand-400">R$ {totalPrice.toFixed(2)}</span>
              </div>
            </div>
            <button onClick={handleBook}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 font-semibold text-sm transition">
              Confirmar agendamento
            </button>
          </div>
        )}
        {step === "booking" && (
          <div className="p-4 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">Confirmando...</span>
          </div>
        )}
        {step === "pix" && pixKey && shop && (
          <div className="p-4 space-y-3">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-yellow-400 font-semibold">Entrada via Pix (50%)</span>
                <span className="text-yellow-400 font-semibold">R$ {(totalPrice / 2).toFixed(2)}</span>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Chave Pix</p>
                <button onClick={() => { navigator.clipboard.writeText(pixKey); setPixCopied(true); setTimeout(() => setPixCopied(false), 2000); }}
                  className="w-full flex items-center justify-between bg-gray-900 rounded-lg p-2 text-sm hover:bg-gray-800 transition">
                  <span className="text-white font-semibold break-all text-left">{pixKey}</span>
                  <span className="ml-2 shrink-0 text-xs font-semibold text-yellow-400">
                    {pixCopied ? "✓ Copiado!" : "📋 Copiar"}
                  </span>
                </button>
              </div>
              <p className="text-xs text-gray-400">Após o pagamento, envie o comprovante via WhatsApp para a barbearia.</p>
            </div>
            <button onClick={resetFlow}
              className="w-full border border-gray-700 text-gray-400 rounded-xl py-2.5 text-sm hover:text-white transition">
              Voltar ao início
            </button>
          </div>
        )}
        {step === "done" && (
          <div className="p-4 flex gap-2">
            <button onClick={resetFlow}
              className="flex-1 border border-gray-700 text-gray-400 rounded-xl py-2.5 text-sm hover:text-white transition">
              Novo agendamento
            </button>
            <button onClick={() => router.push(`/${slug}/meus-agendamentos`)}
              className="flex-1 bg-brand-500 text-dark-900 rounded-xl py-2.5 text-sm font-semibold hover:bg-brand-400 transition">
              Meus agendamentos
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
