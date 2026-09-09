import type { Metadata } from "next";

/**
 * Instruções de exclusão de dados.
 *
 * Página separada da Política de Privacidade de propósito: a Meta exige uma
 * URL dedicada a isso e recusa quando ela repete a da política. E ela tem
 * razão — quem quer apagar os próprios dados não deveria precisar caçar a
 * informação dentro de um documento de onze seções.
 */

export const metadata: Metadata = {
  title: "Exclusão de dados — BarberPro",
  description: "Como pedir a exclusão dos seus dados do BarberPro.",
};

const SUPORTE = "5515997767794";

export default function ExclusaoDeDadosPage() {
  return (
    <main className="min-h-screen bg-dark-900 text-gray-300 px-4 py-12 sm:px-8">
      <article className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">
            Exclusão de dados
          </h1>
          <p className="text-sm text-gray-500">
            Como apagar seus dados do BarberPro
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            Se você e cliente de uma barbearia
          </h2>
          <p>
            Seus dados no BarberPro são o seu nome, telefone e o histórico dos
            atendimentos que você marcou. Quem responde por eles e a barbearia
            onde você se atende.
          </p>
          <p>Ha dois caminhos, e os dois funcionam:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">Peça à barbearia.</strong> Ela
              apaga na hora, pelo painel dela. É o caminho mais rápido.
            </li>
            <li>
              <strong className="text-white">Peca direto a nos</strong> pelo
              WhatsApp abaixo, informando o telefone que você usa para agendar.
              Confirmamos a identidade e apagamos em até 15 dias.
            </li>
          </ul>
          <p>
            Apagamos nome, telefone, histórico de agendamentos, avaliações e
            pontos de fidelidade.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            Se você e dono de barbearia
          </h2>
          <p>
            Peca a exclusão da conta pelo WhatsApp abaixo, com o telefone
            cadastrado. Apagamos a barbearia, os barbeiros, os serviços, os
            produtos e os agendamentos ligados a ela.
          </p>
          <p>
            A exclusão vale para todos: os clientes da sua barbearia deixam de
            ter histórico conosco.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            O que fica, e por que
          </h2>
          <p>
            Registros fiscais e financeiros de atendimentos já pagos podem
            precisar ser mantidos pelo prazo que a lei exige, mesmo depois do
            pedido. Nesse caso eles ficam desvinculados de você: sem nome, sem
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
            Detalhes sobre quais dados coletamos e por quanto tempo estão na{" "}
            <a href="/privacidade" className="text-brand-400 underline">
              Política de Privacidade
            </a>
            .
          </p>
        </footer>
      </article>
    </main>
  );
}
