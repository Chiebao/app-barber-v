import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — BarberPro",
  description: "Saiba como o BarberPro coleta, usa e protege seus dados pessoais.",
};

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen hud-bg text-hud-soft px-4 py-12 sm:px-8">
      <article className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-hud-text mb-2">
            Política de Privacidade
          </h1>
          <p className="text-sm text-hud-muted">
            Versão 2.0 — em vigor desde 27 de agosto de 2026</p>
        </header>

        <section className="space-y-4">
          <h2 className="font-display text-2xl leading-tight text-hud-text">
            1. Quem somos
          </h2>
          <p>
            O <strong className="text-hud-text">BarberPro</strong> é uma plataforma
            de agendamento online para barbearias, disponível como site (web) e
            aplicativo mobile. A plataforma e desenvolvida e operada por Elias
            Henrique Dias Godoy, que se identifica ao titular mediante
            solicitação pelos canais da seção 11.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl leading-tight text-hud-text">
            2. Quem responde por quais dados
          </h2>
          <p>
            A LGPD separa dois papeis. No BarberPro eles funcionam assim:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-hud-soft">A barbearia é a controladora</strong>{" "}
              dos dados dos clientes dela. É a barbearia que decide atender aquele
              cliente, quais anotações registra e por quanto tempo mantém o
              histórico.
            </li>
            <li>
              <strong className="text-hud-soft">O BarberPro é o operador:</strong>{" "}
              tratamos esses dados em nome da barbearia, apenas para fazer a
              plataforma funcionar (agendar, notificar, gerar relatório). Não
              usamos os dados dos clientes de uma barbearia para nenhuma outra
              finalidade.
            </li>
            <li>
              <strong className="text-hud-soft">
                Quanto aos dados da própria conta
              </strong>{" "}
              do dono ou barbeiro (nome, telefone, senha), o BarberPro atua como
              controlador.
            </li>
          </ul>
          <p>
            Na prática: se você e cliente de uma barbearia e quer apagar seus
            dados, pode falar diretamente com a barbearia (que consegue excluir
            pelo painel) ou conosco pelos canais da seção 11.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl leading-tight text-hud-text">
            3. Dados que coletamos
          </h2>

          <h3 className="text-lg font-medium text-hud-soft">
            3.1 Dados do barbeiro/dono (usuário cadastrado)
          </h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Nome completo</li>
            <li>Número de telefone (usado como login)</li>
            <li>Senha (armazenada com hash bcrypt, nunca em texto plano)</li>
            <li>Chave Pix (opcional, para recebimento de pagamentos)</li>
            <li>Expo Push Token e inscrições de notificação do navegador (Web Push)</li>
            <li>E-mail e foto do profissional (opcionais, informados por você)</li>
            <li>Endereço, bairro, cidade, estado, CEP e telefone da barbearia (opcionais, exibidos publicamente no seu link de agendamento)</li>
            <li>Dados da assinatura: plano, datas de vigência e histórico de cobrancas</li>
            <li>Data e versão do aceite dos Termos de Uso</li>
          </ul>

          <h3 className="text-lg font-medium text-hud-soft">
            3.2 Dados do cliente (quem agenda)
          </h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Nome</li>
            <li>Número de telefone</li>
            <li>Histórico de agendamentos (data, serviço, barbeiro)</li>
            <li>Avaliações (nota e comentário, opcionais)</li>
            <li>Contagem de faltas (no-show)</li>
            <li>
              Registro de bloqueio, quando a barbearia impede aquele telefone de
              agendar — inclui o telefone, o nome e uma anotação interna de motivo,
              escrita pela barbearia e visível apenas para ela
            </li>
          </ul>

          <h3 className="text-lg font-medium text-hud-soft">
            3.3 Dados coletados automaticamente
          </h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Endereço IP (logs do servidor)</li>
            <li>User-Agent do navegador/app</li>
            <li>Data e hora de acesso</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl leading-tight text-hud-text">
            4. Finalidade do tratamento
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong className="text-hud-soft">Prestação do serviço:</strong>{" "}
              agendamentos, notificações, programa de fidelidade, relatórios
              financeiros.
            </li>
            <li>
              <strong className="text-hud-soft">Comunicação:</strong>{" "}
              lembretes de agendamento via WhatsApp, notificações push.
            </li>
            <li>
              <strong className="text-hud-soft">Segurança:</strong>{" "}
              autenticação, prevenção de fraude, controle de no-show.
            </li>
            <li>
              <strong className="text-hud-soft">Melhoria do serviço:</strong>{" "}
              análise agregada de uso (sem identificação individual).
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl leading-tight text-hud-text">
            5. Base legal (LGPD)
          </h2>
          <p>
            O tratamento dos dados pessoais se fundamenta nas seguintes bases
            legais previstas na Lei 13.709/2018 (LGPD):
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong className="text-hud-soft">
                Execução de contrato (Art. 7, V):
              </strong>{" "}
              dados necessários para prestar o serviço de agendamento.
            </li>
            <li>
              <strong className="text-hud-soft">
                Consentimento (Art. 7, I):
              </strong>{" "}
              envio de notificações WhatsApp e push.
            </li>
            <li>
              <strong className="text-hud-soft">
                Interesse legitimo (Art. 7, IX):
              </strong>{" "}
              prevenção de fraude e segurança da plataforma.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl leading-tight text-hud-text">
            6. Compartilhamento de dados
          </h2>
          <p>Seus dados podem ser compartilhados com:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong className="text-hud-soft">Supabase:</strong> hospedagem
              do banco de dados (PostgreSQL gerenciado).
            </li>
            <li>
              <strong className="text-hud-soft">Vercel:</strong> hospedagem da
              aplicação web e API.
            </li>
            <li>
              <strong className="text-hud-soft">Meta (WhatsApp Cloud API):</strong>{" "}
              envio de notificações ao telefone cadastrado.
            </li>
            <li>
              <strong className="text-hud-soft">Expo (Push Notifications):</strong>{" "}
              envio de notificações ao app mobile.
            </li>
            <li>
              <strong className="text-hud-soft">Mercado Pago:</strong> quando a
              barbearia ativa o Pix automático, geramos a cobranca na conta dela
              através do Mercado Pago. Para isso, enviamos o{" "}
              <strong className="text-hud-soft">nome do cliente</strong> e um
              identificador de e-mail técnico gerado pela plataforma, junto do valor
              e da referência do agendamento. O dinheiro vai direto para a conta da
              barbearia — o BarberPro não recebe nem retém o valor pago pelo cliente.
              O tratamento desses dados pelo Mercado Pago segue a política de
              privacidade da própria empresa.
            </li>
          </ul>
          <p>
            <strong className="text-hud-soft">
              Não vendemos, alugamos ou compartilhamos seus dados com terceiros
              para fins de marketing.
            </strong>
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl leading-tight text-hud-text">
            7. Retenção dos dados
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-hud-soft">Dados de conta:</strong> mantidos
              enquanto a conta estiver ativa. Ao excluir a conta, os dados são
              removidos <strong className="text-hud-soft">imediatamente</strong> do
              banco de dados.
            </li>
            <li>
              <strong className="text-hud-soft">Dados de cliente da barbearia:</strong>{" "}
              mantidos enquanto a barbearia mantiver o relacionamento. A barbearia
              pode excluir os dados de um cliente a qualquer momento pelo painel, e
              a remoção e imediata.
            </li>
            <li>
              <strong className="text-hud-soft">Cópias de segurança (backup):</strong>{" "}
              o banco de dados possui backup automático do provedor de hospedagem.
              Um dado excluido pode permanecer em backup por até 7 dias até o ciclo
              ser sobrescrito. Backups são usados apenas para recuperação de
              desastre, nunca para consulta.
            </li>
            <li>
              <strong className="text-hud-soft">Registros de acesso:</strong>{" "}
              mantidos pelo período de retenção dos nossos provedores de
              infraestrutura, utilizados apenas para segurança e diagnóstico.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl leading-tight text-hud-text">
            8. Seus direitos (LGPD Art. 18)
          </h2>
          <p>Você tem direito a:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Confirmar a existência de tratamento dos seus dados</li>
            <li>Acessar seus dados pessoais</li>
            <li>Corrigir dados incompletos ou desatualizados</li>
            <li>Solicitar a anonimização ou eliminação de dados desnecessários</li>
            <li>Solicitar a portabilidade dos dados</li>
            <li>Revogar o consentimento a qualquer momento</li>
            <li>
              <strong className="text-hud-soft">
                Excluir sua conta e todos os dados associados
              </strong>{" "}
              diretamente pelo app ou painel web
            </li>
          </ul>

          <h3 className="text-lg font-medium text-hud-soft">
            Como exercer seus direitos
          </h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-hud-soft">
                Se você e dono de barbearia ou barbeiro:
              </strong>{" "}
              use a opção de excluir conta no painel, ou fale conosco pelos canais
              da seção 12.
            </li>
            <li>
              <strong className="text-hud-soft">
                Se você e cliente de uma barbearia:
              </strong>{" "}
              peca diretamente a barbearia onde você se atende — ela consegue
              excluir seus dados pelo painel dela na hora. Se preferir, fale
              conosco e encaminhamos o pedido.
            </li>
          </ul>
          <p className="text-sm text-hud-muted">
            Respondemos as solicitações em até 15 dias.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl leading-tight text-hud-text">
            9. Segurança
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Senhas armazenadas com bcrypt (12 rounds de salt)</li>
            <li>Autenticação via JWT com expiração</li>
            <li>Comunicação via HTTPS (TLS 1.3)</li>
            <li>Banco de dados com acesso restrito por credenciais</li>
            <li>Validação de entrada com Zod para prevenir injeção</li>
            <li>Token JWT armazenado com criptografia no dispositivo (expo-secure-store)</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl leading-tight text-hud-text">
            10. Cookies
          </h2>
          <p>
            O BarberPro não utiliza cookies de rastreamento. Utilizamos apenas
            armazenamento local (localStorage) para preferencias de interface e
            tokens de sessão.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl leading-tight text-hud-text">
            11. Alterações nesta política
          </h2>
          <p>
            Esta política pode ser atualizada periodicamente. Alterações
            significativas serão comunicadas por meio do app ou do site. A data
            de última atualização será sempre indicada no topo desta página.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl leading-tight text-hud-text">
            12. Contato
          </h2>
          <p>
            Para dúvidas, solicitações ou reclamações relacionadas a privacidade,
            fale com o encarregado pelo tratamento de dados:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong className="text-hud-soft">WhatsApp:</strong>{" "}
              <a
                href="https://wa.me/5515997767794"
                target="_blank"
                rel="noopener noreferrer"
                className="text-hud-light underline"
              >
                (15) 99776-7794
              </a>{" "}
              — contato do encarregado
            </li>
            <li>Encarregado (DPO): Elias Henrique Dias Godoy</li>
          </ul>
        </section>

        <footer className="border-t border-hud-border pt-6 text-sm text-hud-muted">
          <p>
            Se não concordar com esta política, você pode solicitar a exclusão
            da sua conta a qualquer momento pelo app ou pelo painel web.
          </p>
        </footer>
      </article>
    </main>
  );
}
