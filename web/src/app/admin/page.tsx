"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/app/components/hud";
import { useRouter } from "next/navigation";
import { toast } from "@/app/lib/toast";
import { Modal } from "@/app/lib/modal";

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
  const [result, setResult] = useState<{ link: string; shopName: string; recoveryCode?: string } | null>(null);

  // Register
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("20:00");
  const [workDays, setWorkDays] = useState([1, 2, 3, 4, 5, 6]);
  const [aceitouTermos, setAceitouTermos] = useState(false);
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

  // Esqueci senha — self-service com codigo de recuperacao,
  // com o WhatsApp do suporte como saida caso a pessoa nao tenha o codigo.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [recovering, setRecovering] = useState(false);
  // Fluxo por codigo no WhatsApp: "telefone" -> pede o codigo, "codigo" -> troca a senha
  const [forgotEtapa, setForgotEtapa] = useState<"telefone" | "código">("telefone");
  const [forgotOtp, setForgotOtp] = useState("");
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [usarCodigoRecuperacao, setUsarCodigoRecuperacao] = useState(false);
  // null = ainda descobrindo. Saber disso ANTES de abrir o modal evita
  // oferecer um envio por WhatsApp que ja sabemos que vai falhar.
  const [canalWhatsApp, setCanalWhatsApp] = useState<boolean | null>(null);
  const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "";

  // Quem ja esta logado nao pode cair no formulario de login.
  //
  // No iPhone o gesto de voltar pela borda leva o painel de volta para ca, e
  // como esta tela nao olhava o token, o barbeiro achava que tinha caido a
  // sessao e digitava a senha de novo — sendo que o token nunca saiu do
  // localStorage. Aqui devolvemos ele para o painel antes de pintar a tela.
  const [checandoSessao, setChecandoSessao] = useState(true);
  useEffect(() => {
    const t = localStorage.getItem("admin_token");
    if (!t) { setChecandoSessao(false); return; }
    try {
      // Le o exp sem validar assinatura: e so para evitar o vai-e-volta de
      // mandar para o painel um token que ja sabemos estar vencido.
      const payload = JSON.parse(atob(t.split(".")[1] || ""));
      if (payload?.exp && payload.exp * 1000 > Date.now()) {
        router.replace("/admin/painel");
        return;
      }
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      localStorage.removeItem("admin_token_renewed_at");
    } catch {
      localStorage.removeItem("admin_token");
    }
    setChecandoSessao(false);
  }, [router]);

  useEffect(() => {
    fetch("/api/auth/forgot")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCanalWhatsApp(d?.canal === "whatsapp"))
      .catch(() => setCanalWhatsApp(false));
  }, []);

  /** Abre no caminho que realmente funciona hoje. */
  const openForgot = () => {
    setForgotPhone(loginPhone);
    setForgotEtapa("telefone");
    setUsarCodigoRecuperacao(canalWhatsApp === false);
    setForgotOpen(true);
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setForgotPhone(""); setForgotCode(""); setForgotNewPassword("");
    setForgotOtp(""); setForgotEtapa("telefone"); setUsarCodigoRecuperacao(false);
  };

  /** Passo 1: pede o codigo de 6 digitos no WhatsApp. */
  const pedirCodigo = async () => {
    const tel = forgotPhone.replace(/\D/g, "");
    if (tel.length < 10) { toast.error("Informe seu telefone de cadastro"); return; }
    setEnviandoCodigo(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: tel }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || "Não foi possível enviar"); return; }
      if (d.canal === "indisponivel") {
        toast.error("Envio por WhatsApp indisponivel. Use o código de recuperacao.");
        setUsarCodigoRecuperacao(true);
        return;
      }
      toast.success("Se houver conta com esse telefone, o código chegou no WhatsApp");
      setForgotEtapa("código");
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setEnviandoCodigo(false);
    }
  };

  /** Passo 2: confere o codigo do WhatsApp e grava a senha nova. */
  const trocarSenhaComCodigo = async () => {
    const tel = forgotPhone.replace(/\D/g, "");
    if (forgotOtp.trim().length < 4) { toast.error("Digite o código recebido"); return; }
    if (forgotNewPassword.length < 6) { toast.error("A nova senha precisa ter no mínimo 6 caracteres"); return; }
    setRecovering(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: tel, code: forgotOtp.trim(), newPassword: forgotNewPassword }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success("Senha alterada! Entre com a nova senha.");
        setLoginPhone(tel); setLoginPassword("");
        closeForgot();
      } else {
        toast.error(d.error || "Não foi possível redefinir");
      }
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setRecovering(false);
    }
  };

  const handleRecover = async () => {
    const cleanPhone = forgotPhone.replace(/\D/g, "");
    if (cleanPhone.length < 10) { toast.error("Informe seu telefone de cadastro"); return; }
    if (forgotCode.trim().length < 6) { toast.error("Informe o código de recuperação"); return; }
    if (forgotNewPassword.length < 6) { toast.error("A nova senha precisa ter no mínimo 6 caracteres"); return; }

    setRecovering(true);
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, code: forgotCode, newPassword: forgotNewPassword }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success("Senha alterada! Entre com a nova senha.");
        setLoginPhone(cleanPhone);
        setLoginPassword("");
        closeForgot();
      } else {
        toast.error(d.error || "Não foi possível redefinir");
      }
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setRecovering(false);
    }
  };

  const handleAskSupport = () => {
    const cleanPhone = forgotPhone.replace(/\D/g, "");
    if (!SUPPORT_WHATSAPP) { toast.error("Suporte indisponível no momento."); return; }
    const msg = encodeURIComponent(
      `Olá! Esqueci minha senha do BarberPro e não tenho o código de recuperação.` +
      (cleanPhone.length >= 10 ? ` Meu telefone de cadastro é ${cleanPhone}.` : "") +
      ` Podem me ajudar?`
    );
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${msg}`, "_blank");
  };

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

    if (services.length === 0) { toast.error("Selecione pelo menos um serviço!"); return; }
    if (!name || !shopName || !phone || password.length < 6) { toast.error("Preencha todos os campos!"); return; }
    if (!aceitouTermos) { toast.error("Aceite os Termos de Uso para continuar"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: name, shopName,
          phone: phone.replace(/\D/g, ""),
          password, openTime, closeTime, workDays, avgServiceTime: 30, services,
          aceitouTermos,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_user", JSON.stringify({ ...data.user, shopName: data.shop.name, shopSlug: data.shop.slug, role: data.role }));
      // Mostra a tela de boas-vindas com o link e o codigo de recuperacao
      // antes de entrar no painel — o codigo so aparece aqui, uma unica vez.
      setResult({ link: data.shop.link, shopName: data.shop.name, recoveryCode: data.recoveryCode });
      setStep("done");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
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
      toast.error(e instanceof Error ? e.message : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  // Enquanto decide se manda para o painel, nao pinta o formulario:
  // o flash do login e justamente o que faz o barbeiro achar que deslogou.
  if (checandoSessao) {
    return (
      <main className="min-h-screen hud-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-hud-accent border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (step === "done" && result) {
    return (
      <main className="min-h-screen hud-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full animate-slide-up text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-[color-mix(in_srgb,var(--hud-ok)_20%,transparent)] flex items-center justify-center">
            <span className="text-4xl text-hud-ok">✓</span>
          </div>
          <h1 className="gold-text font-display text-4xl leading-tight">{result.shopName}</h1>
          <p className="text-hud-muted">Sua barbearia esta pronta!</p>
          <div className="hud-card p-4 space-y-3">
            <p className="text-sm text-hud-muted">Seu link de agendamento:</p>
            <p className="text-hud-light font-mono text-sm break-all">{result.link}</p>
            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(result.link).then(() => toast.success("Link copiado!"))}
                className="flex-1 rounded border border-hud-border py-2 text-sm text-hud-soft hover:text-hud-text transition-colors"
              >
                Copiar Link
              </button>
              <a
                href={result.link}
                target="_blank"
                className="flex-1 rounded gold-fill py-2 text-sm font-semibold text-[var(--hud-on-accent)] text-center hover:brightness-105 transition-colors"
              >
                Abrir Link
              </a>
            </div>
          </div>
          <p className="text-xs text-hud-muted">
            Envie esse link para seus clientes via WhatsApp, Instagram ou Status!
          </p>

          {result.recoveryCode && (
            <div className="rounded bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] border-2 border-[color-mix(in_srgb,var(--hud-accent)_50%,transparent)] p-5 space-y-3 text-left">
              <div className="text-center">
                <p className="hud-eyebrow inline-flex items-center gap-1.5">
                  <Icon nome="cadeado" tamanho={14} /> Anote seu código de recuperação
                </p>
                <p className="text-xs text-hud-muted mt-1">
                  É com ele que você cria uma nova senha se esquecer a sua. Não mostraremos de novo.
                </p>
              </div>
              <p className="text-2xl font-mono font-semibold text-hud-text text-center tracking-wider select-all">
                {result.recoveryCode}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(result.recoveryCode!).then(() => toast.success("Código copiado — guarde em um lugar seguro"))}
                className="w-full rounded gold-fill min-h-[48px] text-sm font-bold hover:brightness-105 transition"
              >
                <Icon nome="copiar" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Copiar código
              </button>
            </div>
          )}

          <button
            onClick={() => router.push("/admin/painel")}
            className="hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 transition-all"
          >
            Já anotei — entrar no painel
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen hud-bg pb-12">
      <header className="bg-hud-surface border-b border-hud-border py-4 px-6 flex items-center justify-center">
        <img src="/logo-completo.webp" alt="BarberPro App" className="h-28 w-auto object-contain" />
      </header>

      {/* Tabs */}
      <div className="flex border-b border-hud-border bg-hud-surface">
        <button
          onClick={() => setStep("register")}
          className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${step === "register" ? "border-hud-accent text-hud-light" : "border-transparent text-hud-muted"}`}
        >
          Cadastrar
        </button>
        <button
          onClick={() => setStep("login")}
          className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${step === "login" ? "border-hud-accent text-hud-light" : "border-transparent text-hud-muted"}`}
        >
          Entrar
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        {step === "login" && (
          <div className="animate-slide-up space-y-4">
            <h2 className="font-display text-[28px] leading-tight text-hud-text">Acesse sua conta</h2>
            <input type="tel" placeholder="Telefone" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)}
              className="w-full rounded bg-hud-surface border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />
            <input type="password" placeholder="Senha" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full rounded bg-hud-surface border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />
            <button onClick={handleLogin} disabled={loading}
              className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all press-scale">
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <button onClick={openForgot}
              className="hud-focus min-h-[44px] w-full text-center text-sm text-hud-muted hover:text-hud-light transition py-1">
              Esqueci minha senha
            </button>
          </div>
        )}

        {/* Modal: Esqueci senha — self-service com código de recuperação */}
        <Modal aberto={!!forgotOpen} onFechar={closeForgot}>{forgotOpen && (<>

              {/* ─── Caminho principal: código por WhatsApp ─── */}
              {!usarCodigoRecuperacao && forgotEtapa === "telefone" && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-hud-text">Esqueci minha senha</h3>
                    <p className="text-sm text-hud-muted mt-1">
                      Vamos enviar um código para o seu WhatsApp.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-hud-muted mb-1 block">Telefone de cadastro</label>
                    <input type="tel" value={forgotPhone} onChange={(e) => setForgotPhone(e.target.value)}
                      placeholder="(00) 00000-0000" autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") pedirCodigo(); }}
                      className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                  </div>
                  <button onClick={pedirCodigo} disabled={enviandoCodigo}
                    className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">
                    {enviandoCodigo ? "Enviando..." : "Enviar código no WhatsApp"}
                  </button>
                </>
              )}

              {!usarCodigoRecuperacao && forgotEtapa === "código" && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-hud-text">Digite o código</h3>
                    <p className="text-sm text-hud-muted mt-1">
                      Enviamos um código de 6 dígitos no WhatsApp do número informado. Ele vale por 10 minutos.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-hud-muted mb-1 block">Código recebido</label>
                      <input type="text" inputMode="numeric" value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000" autoFocus maxLength={6}
                        className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint text-center text-2xl font-mono tracking-[0.4em] focus:border-hud-accent focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-hud-muted mb-1 block">Nova senha</label>
                      <input type="password" value={forgotNewPassword} onChange={(e) => setForgotNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        onKeyDown={(e) => { if (e.key === "Enter") trocarSenhaComCodigo(); }}
                        className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                    </div>
                  </div>
                  <button onClick={trocarSenhaComCodigo} disabled={recovering}
                    className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">
                    {recovering ? "Alterando..." : "Alterar minha senha"}
                  </button>
                  <button onClick={() => { setForgotEtapa("telefone"); setForgotOtp(""); }}
                    className="w-full text-sm text-hud-muted hover:text-hud-text transition py-1">
                    Não recebi — enviar de novo
                  </button>
                  {/* Saida de emergencia: o codigo do WhatsApp pode simplesmente
                      nao chegar. Quem anotou o codigo de recuperacao resolve aqui
                      mesmo, sem depender de mensagem nenhuma. */}
                  <button onClick={() => { setUsarCodigoRecuperacao(true); setForgotOtp(""); }}
                    className="w-full rounded border border-[color-mix(in_srgb,var(--hud-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] py-2.5 text-sm font-semibold text-hud-light hover:bg-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition">
                    Não chegou? Use seu código de recuperação
                  </button>
                </>
              )}

              {/* ─── Plano B: código de recuperação guardado ─── */}
              {usarCodigoRecuperacao && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-hud-text">Usar código de recuperação</h3>
                    <p className="text-sm text-hud-muted mt-1">
                      Aquele código que você anotou quando criou a conta (formato BARB-XXXX-XXXX).
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-hud-muted mb-1 block">Telefone de cadastro</label>
                      <input type="tel" value={forgotPhone} onChange={(e) => setForgotPhone(e.target.value)} placeholder="(00) 00000-0000"
                        className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-hud-muted mb-1 block">Código de recuperação</label>
                      <input type="text" value={forgotCode} onChange={(e) => setForgotCode(e.target.value.toUpperCase())} placeholder="BARB-XXXX-XXXX"
                        autoCapitalize="characters" spellCheck={false}
                        className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint font-mono tracking-wider focus:border-hud-accent focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-hud-muted mb-1 block">Nova senha</label>
                      <input type="password" value={forgotNewPassword} onChange={(e) => setForgotNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
                        onKeyDown={(e) => { if (e.key === "Enter") handleRecover(); }}
                        className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
                    </div>
                  </div>
                  <button onClick={handleRecover} disabled={recovering}
                    className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">
                    {recovering ? "Alterando..." : "Alterar minha senha"}
                  </button>
                </>
              )}

              {/* ─── Alternativas ─── */}
              <div className="pt-3 border-t border-hud-border space-y-2">
                {!usarCodigoRecuperacao ? (
                  <button onClick={() => setUsarCodigoRecuperacao(true)}
                    className="w-full rounded border border-hud-border py-2.5 text-sm text-hud-muted hover:text-hud-text transition">
                    Não tenho acesso a esse WhatsApp
                  </button>
                ) : canalWhatsApp !== false ? (
                  <button onClick={() => { setUsarCodigoRecuperacao(false); setForgotEtapa("telefone"); }}
                    className="w-full rounded border border-hud-border py-2.5 text-sm text-hud-muted hover:text-hud-text transition">
                    Voltar para o código por WhatsApp
                  </button>
                ) : null}
                <button onClick={handleAskSupport}
                  className="hud-focus min-h-[44px] w-full rounded border border-[color-mix(in_srgb,var(--hud-ok)_30%,transparent)] py-2.5 text-sm text-hud-ok hover:bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] transition">
                  Falar com o suporte
                </button>
              </div>

              <button onClick={closeForgot} className="hud-focus min-h-[44px] w-full text-sm text-hud-muted hover:text-hud-soft transition py-1">
                Voltar ao login
              </button>
            </>)}</Modal>

        {step === "register" && (
          <div className="animate-slide-up space-y-5">
            <h2 className="font-display text-[28px] leading-tight text-hud-text">Cadastre sua barbearia</h2>

            {/* Dados basicos */}
            <div className="space-y-3">
              <input type="text" placeholder="Seu nome *" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded bg-hud-surface border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />
              <input type="text" placeholder="Nome da Barbearia *" value={shopName} onChange={(e) => setShopName(e.target.value)}
                className="w-full rounded bg-hud-surface border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />
              <input type="tel" placeholder="WhatsApp (com DDD) *" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded bg-hud-surface border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />
              <input type="password" placeholder="Senha (min 6 caracteres) *" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded bg-hud-surface border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />
            </div>

            {/* Horario */}
            <div>
              <p className="text-sm text-hud-muted mb-2">Horário de funcionamento</p>
              <div className="flex gap-3">
                <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)}
                  className="flex-1 rounded bg-hud-surface border border-hud-border px-4 py-3 text-hud-text focus:border-hud-accent focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />
                <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)}
                  className="flex-1 rounded bg-hud-surface border border-hud-border px-4 py-3 text-hud-text focus:border-hud-accent focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />
              </div>
            </div>

            {/* Dias */}
            <div>
              <p className="text-sm text-hud-muted mb-2">Dias de trabalho</p>
              <div className="flex gap-2">
                {DIAS.map((d) => (
                  <button key={d.value} onClick={() => toggleDay(d.value)}
                    className={`flex-1 py-2 rounded border text-sm font-medium transition-all ${workDays.includes(d.value)
                      ? "border-hud-accent bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] text-hud-light"
                      : "border-hud-border text-hud-muted"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cortes */}
            <div>
              <p className="text-sm text-hud-muted mb-2">Cortes disponíveis</p>
              <div className="grid grid-cols-2 gap-2">
                {CORTES.map((c) => (
                  <button key={c.name} onClick={() => toggleCut(c.name)}
                    className={`p-3 rounded border text-left transition-all ${selectedCuts.includes(c.name)
                      ? "border-hud-accent bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)]"
                      : "border-hud-border bg-hud-surface"}`}>
                    <p className={`font-medium text-sm ${selectedCuts.includes(c.name) ? "text-hud-light" : "text-hud-text"}`}>{c.name}</p>
                    <p className="text-xs text-hud-muted">{c.duration}min - R${c.price}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Extras */}
            <div className="space-y-3">
              <p className="text-sm text-hud-muted">Serviços extras</p>

              <div className="hud-card flex items-center justify-between p-3">
                <span className="text-hud-text">Faz barba?</span>
                <div className="flex items-center gap-3">
                  {fazBarba && <input type="number" value={precoBarba} onChange={(e) => setPrecoBarba(e.target.value)} placeholder="R$"
                    className="w-20 rounded bg-hud-bg border border-hud-border px-2 py-1 text-hud-text text-sm text-center focus:outline-none focus:border-hud-accent focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />}
                  <button onClick={() => setFazBarba(!fazBarba)}
                    className={`w-12 h-6 rounded-full transition-colors ${fazBarba ? "gold-fill" : "bg-[var(--hud-track)]"}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${fazBarba ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>

              <div className="hud-card flex items-center justify-between p-3">
                <span className="text-hud-text">Faz sobrancelha?</span>
                <div className="flex items-center gap-3">
                  {fazSobrancelha && <input type="number" value={precoSobrancelha} onChange={(e) => setPrecoSobrancelha(e.target.value)} placeholder="R$"
                    className="w-20 rounded bg-hud-bg border border-hud-border px-2 py-1 text-hud-text text-sm text-center focus:outline-none focus:border-hud-accent focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />}
                  <button onClick={() => setFazSobrancelha(!fazSobrancelha)}
                    className={`w-12 h-6 rounded-full transition-colors ${fazSobrancelha ? "gold-fill" : "bg-[var(--hud-track)]"}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${fazSobrancelha ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>

              <div className="hud-card flex items-center justify-between p-3">
                <span className="text-hud-text">Faz pezinho?</span>
                <div className="flex items-center gap-3">
                  {fazPezinho && <input type="number" value={precoPezinho} onChange={(e) => setPrecoPezinho(e.target.value)} placeholder="R$"
                    className="w-20 rounded bg-hud-bg border border-hud-border px-2 py-1 text-hud-text text-sm text-center focus:outline-none focus:border-hud-accent focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />}
                  <button onClick={() => setFazPezinho(!fazPezinho)}
                    className={`w-12 h-6 rounded-full transition-colors ${fazPezinho ? "gold-fill" : "bg-[var(--hud-track)]"}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${fazPezinho ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>

              <div className="hud-card flex items-center justify-between p-3">
                <span className="text-hud-text">Faz luzes?</span>
                <div className="flex items-center gap-3">
                  {fazLuzes && <input type="text" value={tipoLuzes} onChange={(e) => setTipoLuzes(e.target.value)} placeholder="Tipo"
                    className="w-24 rounded bg-hud-bg border border-hud-border px-2 py-1 text-hud-text text-sm text-center focus:outline-none focus:border-hud-accent focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />}
                  {fazLuzes && <input type="number" value={precoLuzes} onChange={(e) => setPrecoLuzes(e.target.value)} placeholder="R$"
                    className="w-20 rounded bg-hud-bg border border-hud-border px-2 py-1 text-hud-text text-sm text-center focus:outline-none focus:border-hud-accent focus:ring-1 focus:ring-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] transition-colors" />}
                  <button onClick={() => setFazLuzes(!fazLuzes)}
                    className={`w-12 h-6 rounded-full transition-colors ${fazLuzes ? "gold-fill" : "bg-[var(--hud-track)]"}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${fazLuzes ? "translate-x-6" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Aceite dos termos. Fica colado no botao de propria:
                consentimento que exige rolar para achar nao vale muito. */}
            <label className="hud-card flex items-start gap-3 p-4 cursor-pointer hover:border-[color-mix(in_srgb,var(--hud-accent)_50%,transparent)] transition">
              <input
                type="checkbox"
                checked={aceitouTermos}
                onChange={(e) => setAceitouTermos(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--hud-accent)] cursor-pointer"
              />
              <span className="text-sm text-hud-soft leading-relaxed">
                Li e aceito os{" "}
                <a href="/termos" target="_blank" rel="noopener noreferrer"
                  className="text-hud-light underline hover:text-hud-light"
                  onClick={(e) => e.stopPropagation()}>
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a href="/privacidade" target="_blank" rel="noopener noreferrer"
                  className="text-hud-light underline hover:text-hud-light"
                  onClick={(e) => e.stopPropagation()}>
                  Política de Privacidade
                </a>
                .
                <span className="block text-xs text-hud-muted mt-1.5">
                  Sua barbearia começa com 14 dias grátis. Não pedimos cartão agora.
                </span>
              </span>
            </label>

            <button onClick={handleRegister} disabled={loading || !aceitouTermos}
              className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all press-scale">
              {loading ? "Cadastrando..." : "Cadastrar Barbearia"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
