import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politica de Privacidade — BarberPro",
  description: "Saiba como o BarberPro coleta, usa e protege seus dados pessoais.",
};

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-dark-900 text-gray-300 px-4 py-12 sm:px-8">
      <article className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-white mb-2">
            Politica de Privacidade
          </h1>
          <p className="text-sm text-gray-500">
            Ultima atualizacao: 18 de maio de 2026
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            1. Quem somos
          </h2>
          <p>
            O <strong className="text-white">BarberPro</strong> e uma plataforma
            de agendamento online para barbearias, disponivel como aplicativo
            mobile e site. O responsavel pelo tratamento dos dados e Elias
            Henrique Dias Godoy, inscrito no CPF sob o numero informado ao
            titular mediante solicitacao.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            2. Dados que coletamos
          </h2>

          <h3 className="text-lg font-medium text-gray-200">
            2.1 Dados do barbeiro/dono (usuario cadastrado)
          </h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Nome completo</li>
            <li>Numero de telefone (usado como login)</li>
            <li>Senha (armazenada com hash bcrypt, nunca em texto plano)</li>
            <li>Chave Pix (opcional, para recebimento de pagamentos)</li>
            <li>Expo Push Token (para notificacoes no app)</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-200">
            2.2 Dados do cliente (quem agenda)
          </h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Nome</li>
            <li>Numero de telefone</li>
            <li>Historico de agendamentos (data, servico, barbeiro)</li>
            <li>Avaliacoes (nota e comentario, opcionais)</li>
            <li>Contagem de faltas (no-show)</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-200">
            2.3 Dados coletados automaticamente
          </h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Endereco IP (logs do servidor)</li>
            <li>User-Agent do navegador/app</li>
            <li>Data e hora de acesso</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            3. Finalidade do tratamento
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong className="text-gray-200">Prestacao do servico:</strong>{" "}
              agendamentos, notificacoes, programa de fidelidade, relatorios
              financeiros.
            </li>
            <li>
              <strong className="text-gray-200">Comunicacao:</strong>{" "}
              lembretes de agendamento via WhatsApp, notificacoes push.
            </li>
            <li>
              <strong className="text-gray-200">Seguranca:</strong>{" "}
              autenticacao, prevencao de fraude, controle de no-show.
            </li>
            <li>
              <strong className="text-gray-200">Melhoria do servico:</strong>{" "}
              analise agregada de uso (sem identificacao individual).
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            4. Base legal (LGPD)
          </h2>
          <p>
            O tratamento dos dados pessoais se fundamenta nas seguintes bases
            legais previstas na Lei 13.709/2018 (LGPD):
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong className="text-gray-200">
                Execucao de contrato (Art. 7, V):
              </strong>{" "}
              dados necessarios para prestar o servico de agendamento.
            </li>
            <li>
              <strong className="text-gray-200">
                Consentimento (Art. 7, I):
              </strong>{" "}
              envio de notificacoes WhatsApp e push.
            </li>
            <li>
              <strong className="text-gray-200">
                Interesse legitimo (Art. 7, IX):
              </strong>{" "}
              prevencao de fraude e seguranca da plataforma.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            5. Compartilhamento de dados
          </h2>
          <p>Seus dados podem ser compartilhados com:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong className="text-gray-200">Supabase:</strong> hospedagem
              do banco de dados (PostgreSQL gerenciado).
            </li>
            <li>
              <strong className="text-gray-200">Vercel:</strong> hospedagem da
              aplicacao web e API.
            </li>
            <li>
              <strong className="text-gray-200">Meta (WhatsApp Cloud API):</strong>{" "}
              envio de notificacoes ao telefone cadastrado.
            </li>
            <li>
              <strong className="text-gray-200">Expo (Push Notifications):</strong>{" "}
              envio de notificacoes ao app mobile.
            </li>
          </ul>
          <p>
            <strong className="text-gray-200">
              Nao vendemos, alugamos ou compartilhamos seus dados com terceiros
              para fins de marketing.
            </strong>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            6. Retencao dos dados
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Dados de conta: mantidos enquanto a conta estiver ativa. Apos
              exclusao, removidos em ate 30 dias.
            </li>
            <li>
              Historico de agendamentos: mantido por 5 anos para fins fiscais e
              de auditoria.
            </li>
            <li>
              Logs de acesso: mantidos por 6 meses conforme Marco Civil da
              Internet.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            7. Seus direitos (LGPD Art. 18)
          </h2>
          <p>Voce tem direito a:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Confirmar a existencia de tratamento dos seus dados</li>
            <li>Acessar seus dados pessoais</li>
            <li>Corrigir dados incompletos ou desatualizados</li>
            <li>Solicitar a anonimizacao ou eliminacao de dados desnecessarios</li>
            <li>Solicitar a portabilidade dos dados</li>
            <li>Revogar o consentimento a qualquer momento</li>
            <li>
              <strong className="text-gray-200">
                Excluir sua conta e todos os dados associados
              </strong>{" "}
              diretamente pelo app ou painel web
            </li>
          </ul>
          <p>
            Para exercer seus direitos, entre em contato pelo e-mail:{" "}
            <a
              href="mailto:contato@barberpro.com.br"
              className="text-brand-400 underline"
            >
              contato@barberpro.com.br
            </a>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            8. Seguranca
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Senhas armazenadas com bcrypt (12 rounds de salt)</li>
            <li>Autenticacao via JWT com expiracao</li>
            <li>Comunicacao via HTTPS (TLS 1.3)</li>
            <li>Banco de dados com acesso restrito por credenciais</li>
            <li>Validacao de entrada com Zod para prevenir injecao</li>
            <li>Token JWT armazenado com criptografia no dispositivo (expo-secure-store)</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            9. Cookies
          </h2>
          <p>
            O BarberPro nao utiliza cookies de rastreamento. Utilizamos apenas
            armazenamento local (localStorage) para preferencias de interface e
            tokens de sessao.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            10. Alteracoes nesta politica
          </h2>
          <p>
            Esta politica pode ser atualizada periodicamente. Alteracoes
            significativas serao comunicadas por meio do app ou do site. A data
            de ultima atualizacao sera sempre indicada no topo desta pagina.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            11. Contato
          </h2>
          <p>
            Para duvidas, solicitacoes ou reclamacoes relacionadas a
            privacidade:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              E-mail:{" "}
              <a
                href="mailto:contato@barberpro.com.br"
                className="text-brand-400 underline"
              >
                contato@barberpro.com.br
              </a>
            </li>
            <li>Responsavel: Elias Henrique Dias Godoy</li>
          </ul>
        </section>

        <footer className="border-t border-gray-800 pt-6 text-sm text-gray-500">
          <p>
            Se nao concordar com esta politica, voce pode solicitar a exclusao
            da sua conta a qualquer momento pelo app ou pelo painel web.
          </p>
        </footer>
      </article>
    </main>
  );
}
