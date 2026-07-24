"use client";

import { useState } from "react";
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
    <main className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-5">
        <div className="text-center space-y-1">
          <div className="text-4xl">🔐</div>
          <h1 className="text-xl font-bold text-white">Reset de Senha (Admin)</h1>
          <p className="text-sm text-gray-500">Uso interno — redefine a senha de qualquer conta pelo telefone.</p>
        </div>

        <div className="bg-dark-800 border border-gray-700 rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Senha-mestra</label>
            <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Sua senha-mestra"
              className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-600 focus:border-brand-400 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Telefone da pessoa (que veio no WhatsApp)</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex: 15997767794"
              className="w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-600 focus:border-brand-400 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Nova senha</label>
            <div className="flex gap-2">
              <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
                className="flex-1 rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-600 focus:border-brand-400 focus:outline-none" />
              <button onClick={genPassword} title="Gerar senha" className="shrink-0 rounded-xl border border-gray-700 px-4 text-gray-300 hover:text-brand-400 hover:border-brand-400/50 transition">🎲</button>
            </div>
          </div>
          <button onClick={handleReset} disabled={loading}
            className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all">
            {loading ? "Redefinindo..." : "Redefinir senha"}
          </button>
        </div>

        {result && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 space-y-3 text-center">
            <p className="text-green-400 font-semibold">
              ✅ Senha de {result.name || "conta"} ({result.role}) redefinida!
            </p>
            <p className="text-sm text-gray-300">Nova senha: <span className="font-mono font-bold text-white">{newPassword}</span></p>
            <button onClick={copyMessage}
              className="w-full rounded-xl bg-green-500 py-2.5 text-sm font-semibold text-white hover:bg-green-600 transition">
              📋 Copiar mensagem pro WhatsApp
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
