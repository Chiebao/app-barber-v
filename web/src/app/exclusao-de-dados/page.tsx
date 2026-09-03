import type { Metadata } from "next";

/**
 * Instrucoes de exclusao de dados.
 *
 * Pagina separada da Politica de Privacidade de proposito: a Meta exige uma
 * URL dedicada a isso e recusa quando ela repete a da politica. E ela tem
 * razao — quem quer apagar os proprios dados nao deveria precisar caçar a
 * informacao dentro de um documento de onze secoes.
 */

export const metadata: Metadata = {
  title: "Exclusao de dados — BarberPro",
  description: "Como pedir a exclusao dos seus dados do BarberPro.",
};

const SUPORTE = "5515997767794";

export default function ExclusaoDeDadosPage() {
  return (
    <main className="min-h-screen bg-dark-900 text-gray-300 px-4 py-12 sm:px-8">
      <article className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">
            Exclusao de dados
          </h1>
          <p className="text-sm text-gray-500">
            Como apagar seus dados do BarberPro
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            Se voce e cliente de uma barbearia
          </h2>
          <p>
            Seus dados no BarberPro sao o seu nome, telefone e o historico dos
            atendimentos que voce marcou. Quem responde por eles e a barbearia
            onde voce se atende.
          </p>
          <p>Ha dois caminhos, e os dois funcionam:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">Peca a barbearia.</strong> Ela
              apaga na hora, pelo painel dela. E o caminho mais rapido.
            </li>
            <li>
              <strong className="text-white">Peca direto a nos</strong> pelo
              WhatsApp abaixo, informando o telefone que voce usa para agendar.
              Confirmamos a identidade e apagamos em ate 15 dias.
            </li>
          </ul>
          <p>
            Apagamos nome, telefone, historico de agendamentos, avaliacoes e
            pontos de fidelidade.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            Se voce e dono de barbearia
          </h2>
          <p>
            Peca a exclusao da conta pelo WhatsApp abaixo, com o telefone
            cadastrado. Apagamos a barbearia, os barbeiros, os servicos, os
            produtos e os agendamentos ligados a ela.
          </p>
          <p>
            A exclusao vale para todos: os clientes da sua barbearia deixam de
            ter historico conosco.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            O que fica, e por que
          </h2>
          <p>
            Registros fiscais e financeiros de atendimentos ja pagos podem
            precisar ser mantidos pelo prazo que a lei exige, mesmo depois do
            pedido. Nesse caso eles ficam desvinculados de voce: sem nome, sem
            telefone, apenas o valor e a data.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Como falar conosco</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-gray-200">WhatsApp:</strong>{" "}
              <a
                href={`https://wa.me/${SUPORTE}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-400 underline"
              >
                (15) 99776-7794
              </a>
            </li>
            <li>Encarregado (DPO): Elias Henrique Dias Godoy</li>
          </ul>
        </section>

        <footer className="border-t border-gray-800 pt-6 text-sm text-gray-500">
          <p>
            Detalhes sobre quais dados coletamos e por quanto tempo estao na{" "}
            <a href="/privacidade" className="text-brand-400 underline">
              Politica de Privacidade
            </a>
            .
          </p>
        </footer>
      </article>
    </main>
  );
}
