import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso — BarberPro",
  description: "Termos e condições de uso da plataforma BarberPro.",
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
            Versão 2.1 — em vigor desde 30 de agosto de 2026
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            1. Aceitação dos termos
          </h2>
          <p>
            Ao acessar ou utilizar o <strong className="text-white">BarberPro</strong>{" "}
            (aplicativo mobile e/ou site), você concorda integralmente com estes
            Termos de Uso. Caso não concorde, não utilize a plataforma.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            2. Descrição do serviço
          </h2>
          <p>
            O BarberPro é uma plataforma SaaS (Software como Serviço) que
            oferece:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Sistema de agendamento online para barbearias</li>
            <li>Painel de gestão para barbeiros e donos de barbearia</li>
            <li>Página pública personalizável para clientes agendarem</li>
            <li>Notificações via WhatsApp e push</li>
            <li>Relatórios financeiros e de atendimento</li>
            <li>Programa de fidelidade automático</li>
            <li>Aplicativo mobile para gestão da barbearia</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            3. Cadastro e conta
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Para utilizar o BarberPro como barbeiro/dono, é necessário criar
              uma conta informando nome, telefone e senha.
            </li>
            <li>
              Você e responsável por manter a confidencialidade da sua senha e
              por todas as atividades realizadas em sua conta.
            </li>
            <li>
              Cada número de telefone pode ser associado a apenas uma conta de
              proprietário.
            </li>
            <li>
              Você deve fornecer informações verdadeiras e mante-las
              atualizadas.
            </li>
            <li>
              Você pode excluir sua conta a qualquer momento pelo app ou painel
              web. A exclusão remove permanentemente seus dados conforme nossa{" "}
              <a href="/privacidade" className="text-brand-400 underline">
                Política de Privacidade
              </a>
              .
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            4. Uso aceitável
          </h2>
          <p>Ao utilizar o BarberPro, você se compromete a:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Usar a plataforma apenas para fins legitimos de agendamento e gestão de barbearia</li>
            <li>Não tentar acessar contas de outros usuários</li>
            <li>Não utilizar bots, scrapers ou ferramentas automatizadas sem autorização</li>
            <li>Não realizar engenharia reversa do software</li>
            <li>Não transmitir virus, malware ou conteúdo malicioso</li>
            <li>Não usar a plataforma para atividades ilegais</li>
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
              mas <strong className="text-gray-200">não é parte</strong> da
              relação comercial entre eles.
            </li>
            <li>
              Pagamentos por serviços prestados são realizados diretamente entre
              o cliente e a barbearia. O BarberPro não processa, retém ou
              intermedia valores.
            </li>
            <li>
              O recurso de Pix antecipado e uma facilitação — a responsabilidade
              pela cobranca e da barbearia.
            </li>
            <li>
              Cancelamentos e políticas de no-show são definidos pela barbearia,
              não pelo BarberPro.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            6. Planos, assinatura, teste gratis e inadimplência
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-gray-200">Teste gratis:</strong> toda barbearia
              nova comeca com <strong className="text-gray-200">14 dias de acesso
              completo e gratuito</strong>, sem necessidade de informar forma de
              pagamento. Não ha cobranca automática ao fim do teste: se você não
              contratar um plano, o acesso simplesmente deixa de aceitar novos
              agendamentos.
            </li>
            <li>
              <strong className="text-gray-200">Planos:</strong> mensal, semestral ou
              anual, com preço fixo por barbearia, independentemente da quantidade de
              barbeiros cadastrados. Os valores vigentes são exibidos no painel, na
              tela de assinatura, antes da contratação.
            </li>
            <li>
              <strong className="text-gray-200">Troca de plano:</strong> passa a valer
              a partir da próxima cobranca. O período já pago não e reprecificado,
              para nenhuma das partes.
            </li>
            <li>
              <strong className="text-gray-200">Cancelamento:</strong> pode ser feito a
              qualquer momento pelo painel, sem multa. O acesso permanece integral até
              o fim do período já pago — não ha corte imediato nem devolução
              proporcional do período em curso.
            </li>
            <li>
              <strong className="text-gray-200">Planos de compromisso pagos mensalmente:</strong>{" "}
              nos planos semestral e anual com pagamento mês a mês, o desconto e{" "}
              <strong className="text-gray-200">antecipado</strong>: você paga o preço reduzido
              desde a primeira cobranca, em contrapartida ao período contratado. Se a assinatura
              for cancelada ou bloqueada antes de completar esse período, fica em aberto a{" "}
              <strong className="text-gray-200">diferença entre o preço pago e o preço do plano
              mensal</strong>, multiplicada apenas pelos meses efetivamente utilizados.
            </li>
            <li>
              Essa diferença <strong className="text-gray-200">não e multa</strong> e não e cobrada
              de forma automática: corresponde exatamente ao desconto já usufruido e só e exigida
              caso você opte por reativar a assinatura, sendo somada a primeira cobranca da
              reativação. Se você nunca reativar, nada e cobrado.
            </li>
            <li>
              O valor em aberto e sempre exibido no painel, na tela de assinatura, e informado no
              momento do cancelamento. Trocar de plano encerra o compromisso anterior e reinicia a
              contagem.
            </li>
            <li>
              <strong className="text-gray-200">Reajuste:</strong> mudancas de preço não
              afetam o período já contratado e serão comunicadas com pelo menos 30 dias
              de antecedência da renovação.
            </li>
          </ul>

          <h3 className="text-lg font-semibold text-white pt-2">
            6.1. O que acontece se o pagamento atrasar
          </h3>
          <p className="text-sm text-gray-400">
            Descrevemos abaixo exatamente o comportamento do sistema, para que não haja
            surpresa:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-gray-200">Até 7 dias após o vencimento</strong>{" "}
              (carência): acesso permanece completo, com aviso no painel.
            </li>
            <li>
              <strong className="text-gray-200">Após a carência:</strong> o painel entra
              em <strong className="text-gray-200">modo somente leitura</strong>. Você
              continua vendo a agenda, o histórico e os relatórios, e continua podendo
              confirmar pagamentos já realizados — mas não cria nem edita serviços,
              produtos, barbeiros ou bloqueios de horário.
            </li>
            <li>
              A página pública de agendamento <strong className="text-gray-200">deixa
              de aceitar novos agendamentos</strong>. Os agendamentos já marcados não
              são cancelados e continuam visíveis para você e para os clientes.
            </li>
            <li>
              A mensagem exibida ao cliente final não menciona inadimplência nem
              assinatura: informa apenas que a barbearia não esta aceitando
              agendamentos online no momento.
            </li>
            <li>
              <strong className="text-gray-200">Regularizado o pagamento</strong>, o
              acesso e restabelecido imediatamente, sem taxa de reativação.
            </li>
            <li>
              Seus dados são preservados por <strong className="text-gray-200">60 dias
              </strong> a contar do bloqueio, para reativação ou exportação. Após esse
              prazo, podem ser excluidos definitivamente.
            </li>
          </ul>
        </section>


        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            7. Dados dos clientes da barbearia
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Os dados dos clientes atendidos pela barbearia pertencem a relação
              entre a barbearia e o cliente dela. Nos termos da LGPD, a{" "}
              <strong className="text-gray-200">barbearia e a controladora</strong>{" "}
              desses dados e o <strong className="text-gray-200">BarberPro e o
              operador</strong>, tratando-os apenas para operar a plataforma.
            </li>
            <li>
              A barbearia se compromete a coletar e usar os dados dos seus clientes
              de forma licita, informando-os quando necessário e atendendo pedidos
              de exclusão — o painel permite excluir os dados de um cliente a
              qualquer momento.
            </li>
            <li>
              <strong className="text-gray-200">Bloqueio de clientes:</strong> a
              plataforma permite que a barbearia impeca um telefone de agendar,
              opcionalmente com uma anotação interna do motivo. Essa decisão e da
              barbearia, que responde por ela como controladora dos dados. O bloqueio
              vale apenas para a barbearia que o aplicou, nunca para as demais, e o
              motivo anotado não e exibido ao cliente nem compartilhado com terceiros.
              A barbearia pode remover o bloqueio a qualquer momento.
            </li>
            <li>
              O BarberPro não comercializa, cede ou usa os dados de clientes de uma
              barbearia para qualquer finalidade alheia a prestação do serviço.
            </li>
            <li>
              Detalhes completos na{" "}
              <a href="/privacidade" className="text-brand-400 underline">
                Política de Privacidade
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
            O BarberPro, incluindo seu código-fonte, design, logotipo, textos e
            funcionalidades, e propriedade de Elias Henrique Dias Godoy. Todos
            os direitos são reservados.
          </p>
          <p>
            O uso da plataforma não concede ao usuário nenhum direito de
            propriedade sobre o software, marca ou conteúdo do BarberPro.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            9. Disponibilidade do serviço
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              O BarberPro se esforça para manter a plataforma disponível 24/7,
              mas não garante disponibilidade ininterrupta.
            </li>
            <li>
              Manutenções programadas, atualizações e eventos fora do nosso
              controle podem causar indisponibilidade temporária.
            </li>
            <li>
              O BarberPro não se responsabiliza por perdas decorrentes de
              indisponibilidade do serviço.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            10. Limitação de responsabilidade
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              O BarberPro e fornecido &quot;como esta&quot; (as is), sem
              garantias expressas ou implicitas.
            </li>
            <li>
              Não nos responsabilizamos por danos diretos, indiretos,
              incidentais ou consequenciais decorrentes do uso da plataforma.
            </li>
            <li>
              Não somos responsáveis pela qualidade dos serviços prestados pelas
              barbearias cadastradas.
            </li>
            <li>
              Nossa responsabilidade total, em qualquer caso, esta limitada ao
              valor pago pelo usuário nos ultimos 12 meses (se aplicável).
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            11. Rescisão
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Você pode encerrar sua conta a qualquer momento, sem necessidade
              de justificativa.
            </li>
            <li>
              Reservamo-nos o direito de suspender ou encerrar contas que
              violem estes termos, sem aviso previo.
            </li>
            <li>
              Após a rescisão, seus dados serão tratados conforme a{" "}
              <a href="/privacidade" className="text-brand-400 underline">
                Política de Privacidade
              </a>
              .
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            12. Alterações nos termos
          </h2>
          <p>
            Estes termos podem ser atualizados a qualquer momento. Alterações
            significativas serão comunicadas pelo app ou site. O uso continuado
            após alterações constitui aceitação dos novos termos.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            13. Legislação aplicável
          </h2>
          <p>
            Estes termos são regidos pelas leis da República Federativa do
            Brasil. Eventuais disputas serão resolvidas no foro da comarca de
            domicilio do usuário, conforme o Código de Defesa do Consumidor.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            14. Contato
          </h2>
          <p>Para dúvidas sobre estes termos ou sobre sua assinatura:</p>
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
            <li>Responsável: Elias Henrique Dias Godoy</li>
          </ul>
        </section>

        <footer className="border-t border-gray-800 pt-6 text-sm text-gray-500">
          <p>
            Ao utilizar o BarberPro, você declara que leu, compreendeu e
            concorda com estes Termos de Uso e com a{" "}
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
