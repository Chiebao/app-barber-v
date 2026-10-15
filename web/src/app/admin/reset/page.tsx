"use client";

import { useState } from "react";
import { Icon } from "@/app/components/hud";
import { toast } from "@/app/lib/toast";

export default function AdminResetPage() {
  const [secret, setSecret] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ name: string | null; role: string } | null>(null);

  const genPassword = () => {
    // Senha simples e fácil de ditar por WhatsApp (sem caracteres ambíguos)
    const chars = "abcdefghijkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 6; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setNewPassword(p);
  };

  const handleReset = async () => {
    if (!secret) { toast.error("Informe a senha-mestra"); return; }
    if (phone.replace(/\D/g, "").length < 10) { toast.error("Telefone inválido"); return; }
    if (newPassword.length < 6) { toast.error("Nova senha: mínimo 6 caracteres"); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, phone: phone.replace(/\D/g, ""), newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ name: data.name, role: data.role });
        toast.success("Senha redefinida!");
      } else {
        toast.error(data.error || "Erro ao redefinir");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = () => {
    const msg = `Prontinho! Sua senha do BarberPro foi redefinida.\n\nSenha nova: ${newPassword}\n\nEntre e troque por uma de sua preferência em Configurações. Qualquer coisa, é só chamar!`;
    navigator.clipboard.writeText(msg).then(() => toast.success("Mensagem copiada! Cole no WhatsApp."));
  };

  return (
    <main className="min-h-screen hud-bg flex items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-5">
        <div className="text-center space-y-1">
          <div className="text-4xl"><Icon nome="cadeado" tamanho={18} /></div>
          <h1 className="text-xl font-bold text-hud-text">Reset de Senha (Admin)</h1>
          <p className="text-sm text-hud-muted">Uso interno — redefine a senha de qualquer conta pelo telefone.</p>
        </div>

        <div className="hud-card p-5 space-y-4">
          <div>
            <label className="text-xs text-hud-muted mb-1 block">Senha-mestra</label>
            <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Sua senha-mestra"
              className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-hud-muted mb-1 block">Telefone da pessoa (que veio no WhatsApp)</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex: 15997767794"
              className="w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-hud-muted mb-1 block">Nova senha</label>
            <div className="flex gap-2">
              <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
                className="flex-1 rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none" />
              <button onClick={genPassword} title="Gerar senha" aria-label="Gerar senha" className="hud-focus shrink-0 min-h-[52px] rounded border border-hud-border px-4 text-hud-soft hover:text-hud-light hover:border-hud-accent transition"><Icon nome="cadeado" tamanho={18} /></button>
            </div>
          </div>
          <button onClick={handleReset} disabled={loading}
            className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all">
            {loading ? "Redefinindo..." : "Redefinir senha"}
          </button>
        </div>

        {result && (
          <div className="bg-[color-mix(in_srgb,var(--hud-ok)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-ok)_30%,transparent)] rounded p-5 space-y-3 text-center">
            <p className="text-hud-ok font-semibold">
              <Icon nome="sucesso" tamanho={18} className="mr-1.5 inline-block align-[-4px]" />Senha de {result.name || "conta"} ({result.role}) redefinida!
            </p>
            <p className="text-sm text-hud-soft">Nova senha: <span className="font-mono font-bold text-hud-text">{newPassword}</span></p>
            <button onClick={copyMessage}
              className="hud-focus min-h-[44px] w-full rounded bg-hud-ok py-2.5 text-sm font-semibold text-hud-text hover:brightness-110 transition">
              <Icon nome="copiar" tamanho={16} className="mr-1.5 inline-block align-[-3px]" />Copiar mensagem pro WhatsApp
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
