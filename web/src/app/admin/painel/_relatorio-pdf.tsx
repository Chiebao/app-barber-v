/**
 * PDF do relatório financeiro do dono.
 *
 * Diferente do PDF do cliente, este documento sai da barbearia e vai para
 * outra pessoa — contador, sócio, o próprio dono no fim do ano. Então é
 * impresso em fundo claro, tem data de emissão, período explícito e uma
 * seção de conferência: quem recebe precisa conseguir bater os números sem
 * ligar perguntando o que cada coluna quer dizer.
 */

interface Resumo {
  totalAppointments: number;
  totalPaid: number;
  totalUnpaid: number;
  paidCount: number;
  unpaidCount: number;
  comandaTotal: number;
  totalRevenue: number;
  paymentCounts: Record<string, { count: number; total: number }>;
  barberBreakdown: { id: string; name: string; count: number; revenue: number; commission: number; commissionValue: number }[];
  avgRating: number | null;
}

interface Atendimento {
  id: string;
  date: string;
  startTime: string;
  totalPrice: number;
  paidAt: string | null;
  paymentMethod: string | null;
  deferredPaymentDate: string | null;
  barberName: string;
  client: { name: string; phone: string };
  comandaTotal: number;
}

const BRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const dataBR = (iso: string) => { const [a, m, d] = iso.split("-"); return `${d}/${m}/${a}`; };

const ROTULO: Record<string, string> = {
  pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão",
  adiado: "A receber", indefinido: "Não informado",
};

export async function gerarRelatorioPdf(opcoes: {
  nomeBarbearia: string;
  inicio: string;
  fim: string;
  barbeiroFiltrado: string | null;
  resumo: Resumo;
  atendimentos: Atendimento[];
}) {
  const { pdf, Document, Page, Text, View, StyleSheet } = await import("@react-pdf/renderer");

  const BRAND = "#8A6D2F";
  const INK = "#1A1A1F";
  const MUTED = "#6B6B75";
  const LINE = "#DFDCD4";
  const ROW_ALT = "#F7F5F0";
  const PAGE_BG = "#FFFFFF";
  const OK = "#1F7A46";
  const DEVE = "#A8600F";

  const { resumo, atendimentos } = opcoes;
  const emitido = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const totalComissoes = resumo.barberBreakdown.reduce((s, b) => s + b.commissionValue, 0);
  const devedores = atendimentos.filter((a) => !a.paidAt);

  const s = StyleSheet.create({
    page: { fontFamily: "Helvetica", fontSize: 9, backgroundColor: PAGE_BG, paddingBottom: 46, color: INK },

    faixa: { backgroundColor: INK, paddingVertical: 22, paddingHorizontal: 40 },
    loja: { fontSize: 17, color: "#FFFFFF", fontFamily: "Helvetica-Bold" },
    doc: { fontSize: 9, color: "#B8B4AC", marginTop: 3 },

    corpo: { paddingHorizontal: 40, paddingTop: 22 },

    secao: { fontSize: 8, fontFamily: "Helvetica-Bold", color: MUTED, letterSpacing: 1, marginBottom: 8, marginTop: 20 },

    heroLinha: { flexDirection: "row" as const, borderWidth: 1, borderColor: LINE, borderRadius: 4 },
    heroCel: { flex: 1, padding: 14, borderRightWidth: 1, borderRightColor: LINE },
    heroCelUlt: { flex: 1, padding: 14 },
    heroRot: { fontSize: 7.5, color: MUTED, marginBottom: 4 },
    heroVal: { fontSize: 16, fontFamily: "Helvetica-Bold" },
    heroSub: { fontSize: 7.5, color: MUTED, marginTop: 3 },

    linha: { flexDirection: "row" as const, paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: LINE },
    linhaAlt: { backgroundColor: ROW_ALT },
    cab: { flexDirection: "row" as const, paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: INK },
    cabTxt: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: INK, letterSpacing: 0.4 },

    total: { flexDirection: "row" as const, paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: INK, marginTop: 2 },
    totalTxt: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },

    rodape: {
      position: "absolute" as const, bottom: 18, left: 40, right: 40,
      flexDirection: "row" as const, justifyContent: "space-between" as const,
      borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 7,
    },
    rodapeTxt: { fontSize: 7, color: MUTED },

    nota: { fontSize: 7.5, color: MUTED, marginTop: 6, lineHeight: 1.4 },
  });

  const Col = ({ w, children, alinhar, negrito, cor }: {
    w: string | number; children: React.ReactNode;
    alinhar?: "left" | "right"; negrito?: boolean; cor?: string;
  }) => (
    <Text style={{
      width: w as never,
      textAlign: alinhar || "left",
      fontFamily: negrito ? "Helvetica-Bold" : "Helvetica",
      color: cor || INK,
      fontSize: 8.5,
    }}>
      {children}
    </Text>
  );

  const Doc = () => (
    <Document title={`Relatório ${opcoes.nomeBarbearia}`} author="BarberPro">
      <Page size="A4" style={s.page}>
        <View style={s.faixa} fixed>
          <Text style={s.loja}>{opcoes.nomeBarbearia}</Text>
          <Text style={s.doc}>
            Relatório financeiro · {dataBR(opcoes.inicio)} a {dataBR(opcoes.fim)}
            {opcoes.barbeiroFiltrado ? ` · ${opcoes.barbeiroFiltrado}` : ""}
          </Text>
        </View>

        <View style={s.corpo}>
          {/* Números de cima — o que entrou e o que falta */}
          <View style={s.heroLinha}>
            <View style={s.heroCel}>
              <Text style={s.heroRot}>ENTROU NO PERÍODO</Text>
              <Text style={[s.heroVal, { color: OK }]}>{BRL(resumo.totalRevenue)}</Text>
              <Text style={s.heroSub}>
                serviços {BRL(resumo.totalPaid)} + produtos {BRL(resumo.comandaTotal)}
              </Text>
            </View>
            <View style={s.heroCel}>
              <Text style={s.heroRot}>FALTA RECEBER</Text>
              <Text style={[s.heroVal, { color: resumo.totalUnpaid > 0 ? DEVE : MUTED }]}>
                {BRL(resumo.totalUnpaid)}
              </Text>
              <Text style={s.heroSub}>
                {resumo.unpaidCount} atendimento{resumo.unpaidCount !== 1 ? "s" : ""} em aberto
              </Text>
            </View>
            <View style={s.heroCelUlt}>
              <Text style={s.heroRot}>ATENDIMENTOS</Text>
              <Text style={s.heroVal}>{resumo.totalAppointments}</Text>
              <Text style={s.heroSub}>
                {resumo.paidCount} pago{resumo.paidCount !== 1 ? "s" : ""}
                {resumo.avgRating ? ` · nota ${resumo.avgRating}` : ""}
              </Text>
            </View>
          </View>

          {/* Como entrou — a seção que o contador usa para bater o caixa */}
          {Object.keys(resumo.paymentCounts).length > 0 && (
            <>
              <Text style={s.secao}>COMO ENTROU</Text>
              <View style={s.cab}>
                <Text style={[s.cabTxt, { width: "50%" }]}>FORMA DE PAGAMENTO</Text>
                <Text style={[s.cabTxt, { width: "20%", textAlign: "right" }]}>QTD</Text>
                <Text style={[s.cabTxt, { width: "30%", textAlign: "right" }]}>VALOR</Text>
              </View>
              {Object.entries(resumo.paymentCounts)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([m, d], i) => (
                  <View key={m} style={[s.linha, ...(i % 2 ? [s.linhaAlt] : [])]}>
                    <Col w="50%">{ROTULO[m] || m}</Col>
                    <Col w="20%" alinhar="right">{d.count}</Col>
                    <Col w="30%" alinhar="right">{BRL(d.total)}</Col>
                  </View>
                ))}
              <View style={s.total}>
                <Text style={[s.totalTxt, { width: "70%" }]}>Total recebido em serviços</Text>
                <Text style={[s.totalTxt, { width: "30%", textAlign: "right" }]}>{BRL(resumo.totalPaid)}</Text>
              </View>
              <Text style={s.nota}>
                Produtos vendidos na comanda ({BRL(resumo.comandaTotal)}) entram no total do
                período, mas não aparecem nesta tabela — ela mostra só a forma de pagamento
                registrada no atendimento.
              </Text>
            </>
          )}

          {/* Por barbeiro e comissão a pagar */}
          {resumo.barberBreakdown.length > 0 && (
            <>
              <Text style={s.secao}>POR PROFISSIONAL</Text>
              <View style={s.cab}>
                <Text style={[s.cabTxt, { width: "38%" }]}>NOME</Text>
                <Text style={[s.cabTxt, { width: "14%", textAlign: "right" }]}>ATEND.</Text>
                <Text style={[s.cabTxt, { width: "22%", textAlign: "right" }]}>FATUROU</Text>
                <Text style={[s.cabTxt, { width: "12%", textAlign: "right" }]}>%</Text>
                <Text style={[s.cabTxt, { width: "14%", textAlign: "right" }]}>COMISSÃO</Text>
              </View>
              {resumo.barberBreakdown.map((b, i) => (
                <View key={b.id} style={[s.linha, ...(i % 2 ? [s.linhaAlt] : [])]}>
                  <Col w="38%">{b.name}</Col>
                  <Col w="14%" alinhar="right">{b.count}</Col>
                  <Col w="22%" alinhar="right">{BRL(b.revenue)}</Col>
                  <Col w="12%" alinhar="right" cor={MUTED}>{b.commission > 0 ? `${b.commission}%` : "—"}</Col>
                  <Col w="14%" alinhar="right" negrito={b.commissionValue > 0}>
                    {b.commissionValue > 0 ? BRL(b.commissionValue) : "—"}
                  </Col>
                </View>
              ))}
              {totalComissoes > 0 && (
                <>
                  <View style={s.total}>
                    <Text style={[s.totalTxt, { width: "74%" }]}>Total de comissões a pagar</Text>
                    <Text style={[s.totalTxt, { width: "26%", textAlign: "right" }]}>{BRL(totalComissoes)}</Text>
                  </View>
                  <Text style={s.nota}>
                    A comissão incide apenas sobre atendimentos já pagos. Atendimento em aberto
                    não gera comissão até o dinheiro entrar.
                  </Text>
                </>
              )}
            </>
          )}

          {/* Quem deve — a página que ele leva para cobrar */}
          {devedores.length > 0 && (
            <>
              <Text style={s.secao}>EM ABERTO</Text>
              <View style={s.cab}>
                <Text style={[s.cabTxt, { width: "16%" }]}>DATA</Text>
                <Text style={[s.cabTxt, { width: "34%" }]}>CLIENTE</Text>
                <Text style={[s.cabTxt, { width: "24%" }]}>TELEFONE</Text>
                <Text style={[s.cabTxt, { width: "26%", textAlign: "right" }]}>VALOR</Text>
              </View>
              {devedores.map((a, i) => (
                <View key={a.id} style={[s.linha, ...(i % 2 ? [s.linhaAlt] : [])]}>
                  <Col w="16%">{dataBR(a.date)}</Col>
                  <Col w="34%">
                    {a.client.name}
                    {a.deferredPaymentDate ? ` (prometeu ${dataBR(a.deferredPaymentDate.slice(0, 10))})` : ""}
                  </Col>
                  <Col w="24%" cor={MUTED}>{a.client.phone}</Col>
                  <Col w="26%" alinhar="right" cor={DEVE} negrito>
                    {BRL(a.totalPrice + a.comandaTotal)}
                  </Col>
                </View>
              ))}
              <View style={s.total}>
                <Text style={[s.totalTxt, { width: "74%" }]}>Total em aberto no período</Text>
                <Text style={[s.totalTxt, { width: "26%", textAlign: "right", color: DEVE }]}>
                  {BRL(resumo.totalUnpaid)}
                </Text>
              </View>
            </>
          )}

          {/* Detalhe completo, para conferência linha a linha */}
          <Text style={s.secao} break={atendimentos.length > 18}>ATENDIMENTOS DO PERÍODO</Text>
          <View style={s.cab} fixed>
            <Text style={[s.cabTxt, { width: "13%" }]}>DATA</Text>
            <Text style={[s.cabTxt, { width: "9%" }]}>HORA</Text>
            <Text style={[s.cabTxt, { width: "28%" }]}>CLIENTE</Text>
            <Text style={[s.cabTxt, { width: "20%" }]}>PROFISSIONAL</Text>
            <Text style={[s.cabTxt, { width: "16%" }]}>PAGAMENTO</Text>
            <Text style={[s.cabTxt, { width: "14%", textAlign: "right" }]}>VALOR</Text>
          </View>
          {atendimentos.map((a, i) => (
            <View key={a.id} style={[s.linha, ...(i % 2 ? [s.linhaAlt] : [])]} wrap={false}>
              <Col w="13%">{dataBR(a.date)}</Col>
              <Col w="9%">{a.startTime}</Col>
              <Col w="28%">{a.client.name}</Col>
              <Col w="20%" cor={MUTED}>{a.barberName}</Col>
              <Col w="16%" cor={a.paidAt ? OK : DEVE}>
                {a.paidAt ? (ROTULO[a.paymentMethod || "indefinido"] || a.paymentMethod) : "em aberto"}
              </Col>
              <Col w="14%" alinhar="right" negrito>{BRL(a.totalPrice + a.comandaTotal)}</Col>
            </View>
          ))}
          <View style={s.total}>
            <Text style={[s.totalTxt, { width: "70%" }]}>
              Total do período (recebido + em aberto)
            </Text>
            <Text style={[s.totalTxt, { width: "30%", textAlign: "right" }]}>
              {BRL(resumo.totalRevenue + resumo.totalUnpaid)}
            </Text>
          </View>
        </View>

        <View style={s.rodape} fixed>
          <Text style={s.rodapeTxt}>
            Emitido em {emitido} · BarberPro
          </Text>
          <Text
            style={s.rodapeTxt}
            render={({ pageNumber, totalPages }) => `${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );

  const blob = await pdf(<Doc />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-${opcoes.nomeBarbearia.replace(/\s+/g, "-").toLowerCase()}-${opcoes.inicio}-a-${opcoes.fim}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
