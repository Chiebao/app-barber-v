import type { Metadata } from "next";
import { Icon } from "@/app/components/hud";

export const metadata: Metadata = {
  title: "Baixar BarberPro",
  description: "Instale o BarberPro no seu celular como um aplicativo.",
};

export default function DownloadPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative z-10">
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-3">
          <img src="/logo-completo.webp" alt="BarberPro App" className="mx-auto h-40 w-auto" />
          <h1 className="text-3xl font-bold text-hud-text">BarberPro</h1>
          <p className="text-hud-muted">
            Instale o app no seu celular em segundos
          </p>
        </div>

        {/* iPhone */}
        <div className="bg-[color-mix(in_srgb,var(--hud-bg)_80%,transparent)] backdrop-blur-sm border border-hud-border rounded p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-hud-accent"><Icon nome="telefone" tamanho={24} /></span>
            <h2 className="font-display text-2xl leading-tight text-hud-text">iPhone (iOS)</h2>
          </div>

          <ol className="space-y-4 text-hud-soft">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] text-hud-light text-sm font-bold flex items-center justify-center">1</span>
              <span>
                Abra este site no <strong className="text-hud-text">Safari</strong>{" "}
                (obrigatorio ser o Safari)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] text-hud-light text-sm font-bold flex items-center justify-center">2</span>
              <span>
                Toque no botao{" "}
                <strong className="text-hud-text">Compartilhar</strong>{" "}
                <span className="inline-block bg-hud-surface px-2 py-0.5 rounded text-xs">
                  <Icon nome="enviar" tamanho={14} className="inline-block align-[-2px]" />
                </span>{" "}
                na barra inferior
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] text-hud-light text-sm font-bold flex items-center justify-center">3</span>
              <span>
                Role a lista e toque em{" "}
                <strong className="text-hud-text">
                  Adicionar à Tela de Início
                </strong>{" "}
                <span className="inline-block bg-hud-surface px-2 py-0.5 rounded text-xs">
                  <Icon nome="mais" tamanho={18} />
                </span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] text-hud-light text-sm font-bold flex items-center justify-center">4</span>
              <span>
                Toque em{" "}
                <strong className="text-hud-text">Adicionar</strong> no canto
                superior direito
              </span>
            </li>
          </ol>

          <div className="bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] rounded p-3 text-sm text-hud-light">
            Pronto! O icone do BarberPro aparece na sua tela inicial, igualzinho
            um app da App Store.
          </div>
        </div>

        {/* Android */}
        <div className="bg-[color-mix(in_srgb,var(--hud-bg)_80%,transparent)] backdrop-blur-sm border border-hud-border rounded p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-hud-accent"><Icon nome="telefone" tamanho={24} /></span>
            <h2 className="font-display text-2xl leading-tight text-hud-text">Android</h2>
          </div>

          <ol className="space-y-4 text-hud-soft">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] text-hud-light text-sm font-bold flex items-center justify-center">1</span>
              <span>
                Abra este site no <strong className="text-hud-text">Chrome</strong>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] text-hud-light text-sm font-bold flex items-center justify-center">2</span>
              <span>
                Toque nos{" "}
                <strong className="text-hud-text">três pontinhos</strong>{" "}
                <span className="inline-block bg-hud-surface px-2 py-0.5 rounded text-xs">
                  ⋮
                </span>{" "}
                no canto superior
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] text-hud-light text-sm font-bold flex items-center justify-center">3</span>
              <span>
                Toque em{" "}
                <strong className="text-hud-text">
                  Instalar aplicativo
                </strong>{" "}
                ou{" "}
                <strong className="text-hud-text">
                  Adicionar a tela inicial
                </strong>
              </span>
            </li>
          </ol>

          <div className="bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--hud-accent)_20%,transparent)] rounded p-3 text-sm text-hud-light">
            O Chrome pode mostrar um banner automático &quot;Instalar
            BarberPro&quot; — basta tocar nele!
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-hud-muted">
          O BarberPro funciona como um app nativo, direto do navegador.
          <br />
          Sem ocupar espaco, sempre atualizado.
        </p>
      </div>
    </main>
  );
}
