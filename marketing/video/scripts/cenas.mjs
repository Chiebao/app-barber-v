// Roteiros de gravação: o que o "dedo" faz em cada cena.
// Cada toque fica registrado (lugar e hora) para a animação acompanhar.

export const CENAS = {
  // Amostra de estilo: o cliente agenda sozinho pelo link da barbearia.
  // Para na tela de confirmação — não cria agendamento de verdade.
  "cliente-agenda": {
    url: "/henrbarber",
    async roteiro({ pagina, toque, digita, espera, marca, esperaCortada }) {
      marca("nome");
      await digita(pagina.getByPlaceholder("Seu nome"), "Carlos", { atraso: 90 });
      await espera(250);
      await toque(pagina.getByRole("button", { name: /continuar/i }));
      await pagina.getByPlaceholder("(11) 99999-9999").waitFor();
      await espera(350);

      marca("telefone");
      await digita(pagina.getByPlaceholder("(11) 99999-9999"), "11900000000", { atraso: 55 });
      await espera(250);
      await toque(pagina.getByRole("button", { name: /continuar/i }));
      await esperaCortada(pagina.getByText("Etapas clássico").waitFor());
      await espera(500);
      await toque(pagina.getByText("Etapas clássico"));
      await esperaCortada(pagina.getByText("Fade", { exact: true }).waitFor());
      await espera(700);

      marca("servico");
      await toque(pagina.getByText("Fade", { exact: true }));
      await espera(450);
      await toque(pagina.getByText("Barba", { exact: true }));
      await espera(600);
      await toque(pagina.getByRole("button", { name: /^continuar/i }).last());
      await espera(900);

      marca("data");
      await toque(pagina.getByRole("button", { name: /de (janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/ }).nth(1));
      await esperaCortada(pagina.getByRole("button", { name: /^\d\d:\d\d$/ }).first().waitFor());
      await espera(900);

      marca("horario");
      await toque(pagina.getByRole("button", { name: /^\d\d:\d\d$/ }).nth(1));
      await espera(1400);
      marca("confirmar");
    },
  },
};
