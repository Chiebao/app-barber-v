"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CORTES = [
  { name: "Degrade", category: "corte", duration: 30, price: 35 },
  { name: "Americano", category: "corte", duration: 30, price: 35 },
  { name: "Fade", category: "corte", duration: 40, price: 40 },
  { name: "Social", category: "corte", duration: 25, price: 30 },
  { name: "Moicano", category: "corte", duration: 35, price: 38 },
  { name: "Disfarçado", category: "corte", duration: 30, price: 35 },
];

const DIAS = [
  { label: "Dom", value: 0 },
  { label: "Seg", value: 1 },
  { label: "Ter", value: 2 },
  { label: "Qua", value: 3 },
  { label: "Qui", value: 4 },
  { label: "Sex", value: 5 },
  { label: "Sab", value: 6 },
];

export default function AdminPage() {
  const router = useRouter();
  const [step, setStep] = useState<"register" | "login" | "done">("register");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ link: string; shopName: string } | null>(null);

  // Register
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("20:00");
  const [workDays, setWorkDays] = useState([1, 2, 3, 4, 5, 6]);
  const [selectedCuts, setSelectedCuts] = useState<string[]>([]);
  const [fazBarba, setFazBarba] = useState(false);
  const [precoBarba, setPrecoBarba] = useState("25");
  const [fazSobrancelha, setFazSobrancelha] = useState(false);
  const [precoSobrancelha, setPrecoSobrancelha] = useState("15");
  const [fazPezinho, setFazPezinho] = useState(false);
  const [precoPezinho, setPrecoPezinho] = useState("10");
  const [fazLuzes, setFazLuzes] = useState(false);
  const [tipoLuzes, setTipoLuzes] = useState("Platinado");
  const [precoLuzes, setPrecoLuzes] = useState("80");

  // Login
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const toggleDay = (d: number) =>
    setWorkDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort()));

  const toggleCut = (name: string) =>
    setSelectedCuts((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));

  const handleRegister = async () => {
    const services = [
      ...CORTES.filter((c) => selectedCuts.includes(c.name)),
      ...(fazBarba ? [{ name: "Barba", category: "barba", duration: 20, price: parseFloat(precoBarba) }] : []),
      ...(fazSobrancelha ? [{ name: "Sobrancelha", category: "sobrancelha", duration: 15, price: parseFloat(precoSobrancelha) }] : []),
      ...(fazPezinho ? [{ name: "Pezinho", category: "pezinho", duration: 10, price: parseFloat(precoPezinho) }] : []),
      ...(fazLuzes ? [{ name: tipoLuzes || "Luzes", category: "luzes", duration: 60, price: parseFloat(precoLuzes) }] : []),
    ];

    if (services.length === 0) { alert("Selecione pelo menos um servico!"); return; }
    if (!name || !shopName || !phone || password.length < 6) { alert("Preencha todos os campos!"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: name, shopName,
          phone: phone.replace(/\D/g, ""),
          password, openTime, closeTime, workDays, avgServiceTime: 30, services,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_user", JSON.stringify({ ...data.user, shopName: data.shop.name, shopSlug: data.shop.slug, role: data.role }));
      router.push("/admin/painel");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: loginPhone.replace(/\D/g, ""), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_user", JSON.stringify({ ...data.user, shopName: data.shop.name, shopSlug: data.shop.slug, role: data.role }));
      router.push("/admin/painel");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  if (step === "done" && result) {
    return (
      <main className="min-h-screen bg-dark-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full animate-slide-up text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-4xl text-green-400">✓</span>
          </div>
          <h1 className="text-3xl font-bold text-brand-400">{result.shopName}</h1>
          <p className="text-gray-400">Sua barbearia esta pronta!</p>
          <div className="rounded-xl bg-dark-800 border border-gray-700 p-4 space-y-3">
            <p className="text-sm text-gray-400">Seu link de agendamento:</p>
            <p className="text-brand-400 font-mono text-sm break-all">{result.link}</p>
            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(result.link).then(() => alert("Link copiado!"))}
                className="flex-1 rounded-lg border border-gray-700 py-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                Copiar Link
              </button>
              <a
                href={result.link}
                target="_blank"
                className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-semibold text-dark-900 text-center hover:bg-brand-400 transition-colors"
              >
                Abrir Link
              </a>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Envie esse link para seus clientes via WhatsApp, Instagram ou Status!
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-dark-900 pb-12">
      <header className="bg-dark-800 border-b border-gray-700">
        <img src="/banner.png" alt="BarberPro" className="w-full max-h-28 object-cover object-center" />
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 bg-dark-800">
        <button
          onClick={() => setStep("register")}
          className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${step === "register" ? "border-brand-400 text-brand-400" : "border-transparent text-gray-400"}`}
        >
          Cadastrar
        </button>
        <button
          onClick={() => setStep("login")}
          className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${step === "login" ? "border-brand-400 text-brand-400" : "border-transparent text-gray-400"}`}
        >
          Entrar
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        {step === "login" && (
          <div className="animate-slide-up space-y-4">
            <h2 className="text-lg font-semibold">Acesse sua conta</h2>
            <input type="tel" placeholder="Telefone" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)}
              className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors" />
            <input type="password" placeholder="Senha" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors" />
            <button onClick={handleLogin} disabled={loading}
              className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all press-scale">
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        )}

        {step === "register" && (
          <div className="animate-slide-up space-y-5">
            <h2 className="text-lg font-semibold">Cadastre sua barbearia</h2>

            {/* Dados basicos */}
            <div className="space-y-3">
              <input type="text" placeholder="Seu nome *" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors" />
              <input type="text" placeholder="Nome da Barbearia *" value={shopName} onChange={(e) => setShopName(e.target.value)}
                className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors" />
              <input type="tel" placeholder="WhatsApp (com DDD) *" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors" />
              <input type="password" placeholder="Senha (min 6 caracteres) *" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors" />
            </div>

            {/* Horario */}
            <div>
              <p className="text-sm text-gray-400 mb-2">Horario de funcionamento</p>
              <div className="flex gap-3">
                <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)}
                  className="flex-1 rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors" />
                <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)}
                  className="flex-1 rounded-xl bg-dark-800 border border-gray-700 px-4 py-3 text-white focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 transition-colors" />
              </div>
            </div>

            {/* Dias */}
            <div>
              <p className="text-sm text-gray-400 mb-2">Dias de trabalho</p>
              <div className="flex gap-2">
                {DIAS.map((d) => (
                  <button key={d.value} onClick={() => toggleDay(d.value)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${workDays.includes(d.value)
                      ? "border-brand-400 bg-brand-500/10 text-brand-400"
                      : "border-gray-700 text-gray-400"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cortes */}
            <div>
              <p className="text-sm text-gray-400 mb-2">Cortes disponiveis</p>
              <div className="grid grid-cols-2 gap-2">
                {CORTES.map((c) => (
                  <button key={c.name} onClick={() => toggleCut(c.name)}
                    className={`p-3 rounded-xl border text-left transition-all ${selectedCuts.includes(c.name)
                      ? "border-brand-400 bg-brand-500/10"
                      : "border-gray-700 bg-dark-800"}`}>
                    <p className={`font-medium text-sm ${selectedCuts.includes(c.name) ? "text-brand-400" : "text-white"}`}>{c.name}</p>
                    <p className="text-xs text-gray-400">{c.duration}min - R${c.price}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Extras */}
            <div className="space-y-3">
              <p className="text-sm text-gray-400">Servicos extras</p>

              <div className="flex items-center justify-between rounded-xl bg-dark-800 border border-gray-700 p-3">
                <span className="text-white">Faz barba?</span>
                <div className="flex items-center gap-3">
                  {fazBarba && <input type="number" value={precoBarba} onChange={(e) => setPrecoBarba(e.target.value)} placeholder="R$"
                    className="w-20 rounded-lg bg-dark-900 border border-gray-700 px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-500/20 transition-colors" />}
                  <button onClick={() => setFazBarba(!fazBarba)}
                    className={`w-12 h-6 rounded-full transition-colors ${fazBarba ? "bg-brand-500" : "bg-gray-700"}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${fazBarba ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-dark-800 border border-gray-700 p-3">
                <span className="text-white">Faz sobrancelha?</span>
                <div className="flex items-center gap-3">
                  {fazSobrancelha && <input type="number" value={precoSobrancelha} onChange={(e) => setPrecoSobrancelha(e.target.value)} placeholder="R$"
                    className="w-20 rounded-lg bg-dark-900 border border-gray-700 px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-500/20 transition-colors" />}
                  <button onClick={() => setFazSobrancelha(!fazSobrancelha)}
                    className={`w-12 h-6 rounded-full transition-colors ${fazSobrancelha ? "bg-brand-500" : "bg-gray-700"}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${fazSobrancelha ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-dark-800 border border-gray-700 p-3">
                <span className="text-white">Faz pezinho?</span>
                <div className="flex items-center gap-3">
                  {fazPezinho && <input type="number" value={precoPezinho} onChange={(e) => setPrecoPezinho(e.target.value)} placeholder="R$"
                    className="w-20 rounded-lg bg-dark-900 border border-gray-700 px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-500/20 transition-colors" />}
                  <button onClick={() => setFazPezinho(!fazPezinho)}
                    className={`w-12 h-6 rounded-full transition-colors ${fazPezinho ? "bg-brand-500" : "bg-gray-700"}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${fazPezinho ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-dark-800 border border-gray-700 p-3">
                <span className="text-white">Faz luzes?</span>
                <div className="flex items-center gap-3">
                  {fazLuzes && <input type="text" value={tipoLuzes} onChange={(e) => setTipoLuzes(e.target.value)} placeholder="Tipo"
                    className="w-24 rounded-lg bg-dark-900 border border-gray-700 px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-500/20 transition-colors" />}
                  {fazLuzes && <input type="number" value={precoLuzes} onChange={(e) => setPrecoLuzes(e.target.value)} placeholder="R$"
                    className="w-20 rounded-lg bg-dark-900 border border-gray-700 px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-500/20 transition-colors" />}
                  <button onClick={() => setFazLuzes(!fazLuzes)}
                    className={`w-12 h-6 rounded-full transition-colors ${fazLuzes ? "bg-brand-500" : "bg-gray-700"}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${fazLuzes ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            </div>

            <button onClick={handleRegister} disabled={loading}
              className="w-full rounded-xl bg-brand-500 py-3.5 font-bold text-dark-900 text-lg hover:bg-brand-400 disabled:opacity-50 transition-all press-scale">
              {loading ? "Cadastrando..." : "Cadastrar Barbearia"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
