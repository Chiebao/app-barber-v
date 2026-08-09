import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso — BarberPro",
  description: "Termos e condicoes de uso da plataforma BarberPro.",
};

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-dark-900 text-gray-300 px-4 py-12 sm:px-8">
      <article className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">
            Termos de Uso
          </h1>
          <p className="text-sm text-gray-500">
            Ultima atualizacao: 20 de maio de 2026
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            1. Aceitacao dos termos
          </h2>
          <p>
            Ao acessar ou utilizar o <strong className="text-white">BarberPro</strong>{" "}
            (aplicativo mobile e/ou site), voce concorda integralmente com estes
            Termos de Uso. Caso nao concorde, nao utilize a plataforma.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            2. Descricao do servico
          </h2>
          <p>
            O BarberPro e uma plataforma SaaS (Software como Servico) que
            oferece:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Sistema de agendamento online para barbearias</li>
            <li>Painel de gestao para barbeiros e donos de barbearia</li>
            <li>Pagina publica personalizavel para clientes agendarem</li>
            <li>Notificacoes via WhatsApp e push</li>
            <li>Relatorios financeiros e de atendimento</li>
            <li>Programa de fidelidade automatico</li>
            <li>Aplicativo mobile para gestao da barbearia</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            3. Cadastro e conta
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Para utilizar o BarberPro como barbeiro/dono, e necessario criar
              uma conta informando nome, telefone e senha.
            </li>
            <li>
              Voce e responsavel por manter a confidencialidade da sua senha e
              por todas as atividades realizadas em sua conta.
            </li>
            <li>
              Cada numero de telefone pode ser associado a apenas uma conta de
              proprietario.
            </li>
            <li>
              Voce deve fornecer informacoes verdadeiras e mante-las
              atualizadas.
            </li>
            <li>
              Voce pode excluir sua conta a qualquer momento pelo app ou painel
              web. A exclusao remove permanentemente seus dados conforme nossa{" "}
              <a href="/privacidade" className="text-brand-400 underline">
                Politica de Privacidade
              </a>
              .
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            4. Uso aceitavel
          </h2>
          <p>Ao utilizar o BarberPro, voce se compromete a:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Usar a plataforma apenas para fins legitimos de agendamento e gestao de barbearia</li>
            <li>Nao tentar acessar contas de outros usuarios</li>
            <li>Nao utilizar bots, scrapers ou ferramentas automatizadas sem autorizacao</li>
            <li>Nao realizar engenharia reversa do software</li>
            <li>Nao transmitir virus, malware ou conteudo malicioso</li>
            <li>Nao usar a plataforma para atividades ilegais</li>
            <li>Respeitar os direitos de propriedade intelectual</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            5. Agendamentos e pagamentos
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              O BarberPro facilita o agendamento entre clientes e barbearias,
              mas <strong className="text-gray-200">nao e parte</strong> da
              relacao comercial entre eles.
            </li>
            <li>
              Pagamentos por servicos prestados sao realizados diretamente entre
              o cliente e a barbearia. O BarberPro nao processa, retém ou
              intermedia valores.
            </li>
            <li>
              O recurso de Pix antecipado e uma facilitacao — a responsabilidade
              pela cobranca e da barbearia.
            </li>
            <li>
              Cancelamentos e politicas de no-show sao definidos pela barbearia,
              nao pelo BarberPro.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            6. Planos, assinatura e cancelamento
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              O BarberPro e oferecido as barbearias mediante{" "}
              <strong className="text-gray-200">assinatura</strong>, em planos com
              periodicidade mensal, semestral ou anual. Os valores e o que cada
              plano inclui sao apresentados no momento da contratacao.
            </li>
            <li>
              A assinatura da direito ao uso da plataforma durante a vigencia
              contratada, incluindo atualizacoes e correcoes lancadas no periodo.
            </li>
            <li>
              <strong className="text-gray-200">Cancelamento:</strong> voce pode
              cancelar quando quiser. O acesso permanece ativo ate o fim do periodo
              ja pago e nao ha multa por cancelamento.
            </li>
            <li>
              <strong className="text-gray-200">Reajuste:</strong> mudancas de preco
              nao afetam o periodo ja contratado e serao comunicadas com pelo menos
              30 dias de antecedencia antes da renovacao.
            </li>
            <li>
              <strong className="text-gray-200">Falta de pagamento:</strong> em caso
              de inadimplencia, o acesso ao painel pode ser suspenso apos aviso
              previo. Seus dados sao preservados por 60 dias para eventual
              reativacao ou exportacao.
            </li>
            <li>
              Periodos de teste ou uso gratuito, quando oferecidos, sao informados
              expressamente e nao geram obrigacao de contratacao.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            7. Dados dos clientes da barbearia
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Os dados dos clientes atendidos pela barbearia pertencem a relacao
              entre a barbearia e o cliente dela. Nos termos da LGPD, a{" "}
              <strong className="text-gray-200">barbearia e a controladora</strong>{" "}
              desses dados e o <strong className="text-gray-200">BarberPro e o
              operador</strong>, tratando-os apenas para operar a plataforma.
            </li>
            <li>
              A barbearia se compromete a coletar e usar os dados dos seus clientes
              de forma licita, informando-os quando necessario e atendendo pedidos
              de exclusao — o painel permite excluir os dados de um cliente a
              qualquer momento.
            </li>
            <li>
              O BarberPro nao comercializa, cede ou usa os dados de clientes de uma
              barbearia para qualquer finalidade alheia a prestacao do servico.
            </li>
            <li>
              Detalhes completos na{" "}
              <a href="/privacidade" className="text-brand-400 underline">
                Politica de Privacidade
              </a>
              .
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            8. Propriedade intelectual
          </h2>
          <p>
            O BarberPro, incluindo seu codigo-fonte, design, logotipo, textos e
            funcionalidades, e propriedade de Elias Henrique Dias Godoy. Todos
            os direitos sao reservados.
          </p>
          <p>
            O uso da plataforma nao concede ao usuario nenhum direito de
            propriedade sobre o software, marca ou conteudo do BarberPro.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            9. Disponibilidade do servico
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              O BarberPro se esforça para manter a plataforma disponivel 24/7,
              mas nao garante disponibilidade ininterrupta.
            </li>
            <li>
              Manutencoes programadas, atualizacoes e eventos fora do nosso
              controle podem causar indisponibilidade temporaria.
            </li>
            <li>
              O BarberPro nao se responsabiliza por perdas decorrentes de
              indisponibilidade do servico.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            10. Limitacao de responsabilidade
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              O BarberPro e fornecido &quot;como esta&quot; (as is), sem
              garantias expressas ou implicitas.
            </li>
            <li>
              Nao nos responsabilizamos por danos diretos, indiretos,
              incidentais ou consequenciais decorrentes do uso da plataforma.
            </li>
            <li>
              Nao somos responsaveis pela qualidade dos servicos prestados pelas
              barbearias cadastradas.
            </li>
            <li>
              Nossa responsabilidade total, em qualquer caso, esta limitada ao
              valor pago pelo usuario nos ultimos 12 meses (se aplicavel).
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            11. Rescisao
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Voce pode encerrar sua conta a qualquer momento, sem necessidade
              de justificativa.
            </li>
            <li>
              Reservamo-nos o direito de suspender ou encerrar contas que
              violem estes termos, sem aviso previo.
            </li>
            <li>
              Apos a rescisao, seus dados serao tratados conforme a{" "}
              <a href="/privacidade" className="text-brand-400 underline">
                Politica de Privacidade
              </a>
              .
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            12. Alteracoes nos termos
          </h2>
          <p>
            Estes termos podem ser atualizados a qualquer momento. Alteracoes
            significativas serao comunicadas pelo app ou site. O uso continuado
            apos alteracoes constitui aceitacao dos novos termos.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            13. Legislacao aplicavel
          </h2>
          <p>
            Estes termos sao regidos pelas leis da Republica Federativa do
            Brasil. Eventuais disputas serao resolvidas no foro da comarca de
            domicilio do usuario, conforme o Codigo de Defesa do Consumidor.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            14. Contato
          </h2>
          <p>Para duvidas sobre estes termos ou sobre sua assinatura:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong className="text-gray-200">WhatsApp:</strong>{" "}
              <a
                href="https://wa.me/5515997767794"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-400 underline"
              >
                (15) 99776-7794
              </a>{" "}
              — canal principal de atendimento
            </li>
            <li>Responsavel: Elias Henrique Dias Godoy</li>
          </ul>
        </section>

        <footer className="border-t border-gray-800 pt-6 text-sm text-gray-500">
          <p>
            Ao utilizar o BarberPro, voce declara que leu, compreendeu e
            concorda com estes Termos de Uso e com a{" "}
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
