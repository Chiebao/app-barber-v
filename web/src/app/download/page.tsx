import type { Metadata } from "next";

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
          <img src="/logo.png" alt="BarberPro" className="mx-auto w-20 h-20 rounded-2xl shadow-lg" />
          <h1 className="text-3xl font-bold text-white">BarberPro</h1>
          <p className="text-gray-400">
            Instale o app no seu celular em segundos
          </p>
        </div>

        {/* iPhone */}
        <div className="bg-dark-800/80 backdrop-blur-sm border border-dark-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍎</span>
            <h2 className="text-xl font-semibold text-white">iPhone (iOS)</h2>
          </div>

          <ol className="space-y-4 text-gray-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-500/20 text-brand-400 text-sm font-bold flex items-center justify-center">1</span>
              <span>
                Abra este site no <strong className="text-white">Safari</strong>{" "}
                (obrigatorio ser o Safari)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-500/20 text-brand-400 text-sm font-bold flex items-center justify-center">2</span>
              <span>
                Toque no botao{" "}
                <strong className="text-white">Compartilhar</strong>{" "}
                <span className="inline-block bg-dark-700 px-2 py-0.5 rounded text-xs">
                  ⬆️
                </span>{" "}
                na barra inferior
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-500/20 text-brand-400 text-sm font-bold flex items-center justify-center">3</span>
              <span>
                Role a lista e toque em{" "}
                <strong className="text-white">
                  Adicionar à Tela de Início
                </strong>{" "}
                <span className="inline-block bg-dark-700 px-2 py-0.5 rounded text-xs">
                  ➕
                </span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-500/20 text-brand-400 text-sm font-bold flex items-center justify-center">4</span>
              <span>
                Toque em{" "}
                <strong className="text-white">Adicionar</strong> no canto
                superior direito
              </span>
            </li>
          </ol>

          <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 text-sm text-brand-200">
            Pronto! O icone do BarberPro aparece na sua tela inicial, igualzinho
            um app da App Store.
          </div>
        </div>

        {/* Android */}
        <div className="bg-dark-800/80 backdrop-blur-sm border border-dark-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <h2 className="text-xl font-semibold text-white">Android</h2>
          </div>

          <ol className="space-y-4 text-gray-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-500/20 text-brand-400 text-sm font-bold flex items-center justify-center">1</span>
              <span>
                Abra este site no <strong className="text-white">Chrome</strong>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-500/20 text-brand-400 text-sm font-bold flex items-center justify-center">2</span>
              <span>
                Toque nos{" "}
                <strong className="text-white">três pontinhos</strong>{" "}
                <span className="inline-block bg-dark-700 px-2 py-0.5 rounded text-xs">
                  ⋮
                </span>{" "}
                no canto superior
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-500/20 text-brand-400 text-sm font-bold flex items-center justify-center">3</span>
              <span>
                Toque em{" "}
                <strong className="text-white">
                  Instalar aplicativo
                </strong>{" "}
                ou{" "}
                <strong className="text-white">
                  Adicionar a tela inicial
                </strong>
              </span>
            </li>
          </ol>

          <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 text-sm text-brand-200">
            O Chrome pode mostrar um banner automático &quot;Instalar
            BarberPro&quot; — basta tocar nele!
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          O BarberPro funciona como um app nativo, direto do navegador.
          <br />
          Sem ocupar espaco, sempre atualizado.
        </p>
      </div>
    </main>
  );
}
