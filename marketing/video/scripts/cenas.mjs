// Roteiros de gravação: o que o "dedo" faz em cada cena.
// Cada toque fica registrado (lugar e hora) para a animação acompanhar, e
// cada `marca` abre um trecho que a narração vai cobrir.

const rolarSuave = (pagina, y) => pagina.evaluate((y) => window.scrollBy({ top: y, behavior: "smooth" }), y);

export const CENAS = {
  // O cliente agenda sozinho pelo link da barbearia.
  // Para na tela de confirmação — não cria agendamento de verdade.
  "cliente-agenda": {
    url: "/henrbarber",
    async roteiro({ pagina, toque, digita, espera, marca, esperaCortada }) {
      marca("nome");
      await espera(500);
      await digita(pagina.getByPlaceholder("Seu nome"), "Carlos", { atraso: 110 });
      await espera(400);
      await toque(pagina.getByRole("button", { name: /continuar/i }));
      await pagina.getByPlaceholder("(11) 99999-9999").waitFor();
      await espera(400);

      marca("telefone");
      await digita(pagina.getByPlaceholder("(11) 99999-9999"), "11900000000", { atraso: 70 });
      await espera(400);
      await toque(pagina.getByRole("button", { name: /continuar/i }));
      await esperaCortada(pagina.getByText("Etapas clássico").waitFor());
      await espera(700);
      await toque(pagina.getByText("Etapas clássico"));
      // Espera as FOTOS também: carregando na frente da câmera parece defeito.
      await esperaCortada((async () => {
        await pagina.getByText("Fade", { exact: true }).waitFor();
        await pagina.waitForFunction(() => [...document.images].every((i) => i.complete));
      })());

      // A vitrine: fotos, preços e complementos antes de escolher.
      marca("servicos");
      await espera(900);
      await rolarSuave(pagina, 420);
      await espera(1300);
      await rolarSuave(pagina, -420);
      await espera(900);

      marca("escolhe");
      await toque(pagina.getByText("Fade", { exact: true }));
      await espera(700);
      await rolarSuave(pagina, 420);
      await espera(900);
      await toque(pagina.getByText("Barba", { exact: true }));
      await espera(1300); // o total aparece no rodapé
      await toque(pagina.getByRole("button", { name: /^continuar/i }).last());
      await espera(300);

      marca("data");
      await espera(1100);
      await toque(pagina.getByRole("button", { name: /de (janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/ }).nth(1));
      await esperaCortada(pagina.getByRole("button", { name: /^\d\d:\d\d$/ }).first().waitFor());

      marca("horario");
      await espera(1400);
      await toque(pagina.getByRole("button", { name: /^\d\d:\d\d$/ }).nth(1));
      await espera(300);

      marca("confirmar");
      await espera(2200);
    },
  },
};
