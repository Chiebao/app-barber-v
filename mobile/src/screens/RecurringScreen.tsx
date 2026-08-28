import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useColors } from "../utils/useColors";
import { api } from "../services/api";
import { ScreenBackground, ScreenHeader, AppButton } from "../components";
import { fontSize, fontWeight, spacing, radius } from "../utils/tokens";

/**
 * Corte fixo — o cliente que vem toda semana no mesmo horário.
 *
 * O barbeiro cria UMA regra ("toda terça às 10h, até 31/12") e as ocorrências
 * nascem sozinhas conforme a agenda avança. Não existe "criar 52 agendamentos".
 */

interface Servico {
  id: string;
  name: string;
  duration: number;
  price: number;
  active: boolean;
}

interface CorteFixo {
  id: string;
  clientName: string;
  clientPhone: string;
  barberName: string;
  weekday: number;
  startTime: string;
  totalDuration: number;
  totalPrice: number;
  startDate: string;
  endDate: string;
  active: boolean;
  services: { id: string; name: string }[];
}

interface Props {
  token: string;
  onBack: () => void;
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_LONGOS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Data local YYYY-MM-DD. `toISOString()` converte para UTC e vira outro dia. */
function diaLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** "2026-12-31" → "31/12/2026" */
function paraBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

export default function RecurringScreen({ token, onBack }: Props) {
  const c = useColors();

  const [fixos, setFixos] = useState<CorteFixo[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [encerrando, setEncerrando] = useState<string | null>(null);

  const hoje = diaLocal(new Date());
  const daquiTresMeses = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return diaLocal(d);
  })();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [weekday, setWeekday] = useState(2);
  const [hora, setHora] = useState("10:00");
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(daquiTresMeses);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [r, s] = await Promise.all([api.getRecurring(token), api.getServices(token)]);
      setFixos(r.recurring || []);
      setServicos((s.services || []).filter((x: Servico) => x.active));
    } catch (e: unknown) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Não consegui carregar");
    }
    setCarregando(false);
  }, [token]);

  useEffect(() => { carregar(); }, [carregar]);

  const selecionados = servicos.filter((s) => escolhidos.includes(s.id));
  const duracao = selecionados.reduce((soma, s) => soma + s.duration, 0);
  const valor = selecionados.reduce((soma, s) => soma + s.price, 0);

  const podeSalvar =
    nome.trim().length >= 2 &&
    telefone.replace(/\D/g, "").length >= 8 &&
    escolhidos.length > 0 &&
    /^\d{2}:\d{2}$/.test(hora) &&
    /^\d{4}-\d{2}-\d{2}$/.test(de) &&
    /^\d{4}-\d{2}-\d{2}$/.test(ate) &&
    ate >= de;

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await api.addRecurring(token, {
        clientName: nome.trim(),
        clientPhone: telefone,
        serviceIds: escolhidos,
        weekday,
        startTime: hora,
        startDate: de,
        endDate: ate,
      });
      Alert.alert(
        "Corte fixo criado",
        r.ocorrenciasCriadas > 0
          ? `${r.ocorrenciasCriadas} já entraram na agenda.`
          : "Ele vai aparecer na agenda conforme as datas chegarem.",
      );
      setNome(""); setTelefone(""); setEscolhidos([]);
      carregar();
    } catch (e: unknown) {
      Alert.alert("Erro", e instanceof Error ? e.message : "Não consegui criar");
    }
    setSalvando(false);
  };

  const encerrar = (f: CorteFixo) => {
    Alert.alert(
      "Encerrar corte fixo",
      `Encerrar o corte de ${f.clientName}?\n\nOs cortes que já aconteceram continuam no histórico. Os futuros que ninguém tocou saem da agenda.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Encerrar",
          style: "destructive",
          onPress: async () => {
            setEncerrando(f.id);
            try {
              const r = await api.endRecurring(token, f.id);
              Alert.alert("Encerrado", `${r.ocorrenciasRemovidas} horário(s) liberado(s).`);
              carregar();
            } catch (e: unknown) {
              Alert.alert("Erro", e instanceof Error ? e.message : "Não consegui encerrar");
            }
            setEncerrando(null);
          },
        },
      ],
    );
  };

  const s = estilos(c);

  return (
    <ScreenBackground>
      <View style={s.container}>
        <ScreenHeader title="Corte fixo" onBack={onBack} />
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
            <View style={s.cartao}>
              <Text style={s.titulo}>Novo corte fixo</Text>
              <Text style={s.ajuda}>
                Um agendamento que se repete toda semana. Você cria uma vez e ele
                aparece sozinho na agenda até a data final.
              </Text>

              <TextInput
                style={s.input}
                placeholder="Nome do cliente *"
                placeholderTextColor={c.gray[500]}
                value={nome}
                onChangeText={setNome}
              />
              <TextInput
                style={s.input}
                placeholder="Telefone *"
                placeholderTextColor={c.gray[500]}
                keyboardType="phone-pad"
                value={telefone}
                onChangeText={setTelefone}
              />

              <Text style={s.rotulo}>Serviços *</Text>
              <View style={s.chips}>
                {servicos.map((sv) => {
                  const marcado = escolhidos.includes(sv.id);
                  return (
                    <TouchableOpacity
                      key={sv.id}
                      style={[s.chip, marcado && s.chipAtivo]}
                      onPress={() =>
                        setEscolhidos((prev) =>
                          marcado ? prev.filter((x) => x !== sv.id) : [...prev, sv.id],
                        )
                      }
                    >
                      <Text style={[s.chipTexto, marcado && s.chipTextoAtivo]}>{sv.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {escolhidos.length > 0 && (
                <Text style={s.ajuda}>{duracao} min · R$ {valor.toFixed(2)}</Text>
              )}

              <Text style={s.rotulo}>Dia da semana</Text>
              <View style={s.chips}>
                {DIAS.map((d, i) => (
                  <TouchableOpacity
                    key={d}
                    style={[s.chip, weekday === i && s.chipAtivo]}
                    onPress={() => setWeekday(i)}
                  >
                    <Text style={[s.chipTexto, weekday === i && s.chipTextoAtivo]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.rotulo}>Horário (HH:MM)</Text>
              <TextInput
                style={s.input}
                placeholder="10:00"
                placeholderTextColor={c.gray[500]}
                value={hora}
                onChangeText={setHora}
                maxLength={5}
              />

              <View style={s.linha}>
                <View style={s.meio}>
                  <Text style={s.rotulo}>De (AAAA-MM-DD)</Text>
                  <TextInput
                    style={s.input}
                    placeholderTextColor={c.gray[500]}
                    value={de}
                    onChangeText={setDe}
                    maxLength={10}
                  />
                </View>
                <View style={s.meio}>
                  <Text style={s.rotulo}>Até (AAAA-MM-DD)</Text>
                  <TextInput
                    style={s.input}
                    placeholderTextColor={c.gray[500]}
                    value={ate}
                    onChangeText={setAte}
                    maxLength={10}
                  />
                </View>
              </View>

              <AppButton
                title={salvando ? "Criando..." : "Criar corte fixo"}
                onPress={salvar}
                disabled={!podeSalvar || salvando}
              />
            </View>

            {carregando ? (
              <ActivityIndicator color={c.brand[500]} style={{ marginTop: spacing.lg }} />
            ) : fixos.length === 0 ? (
              <Text style={s.vazio}>Nenhum corte fixo cadastrado</Text>
            ) : (
              fixos.map((f) => (
                <View key={f.id} style={[s.cartao, !f.active && s.cartaoInativo]}>
                  <View style={s.linhaTopo}>
                    <View style={s.flex}>
                      <Text style={s.nome}>{f.clientName}</Text>
                      <Text style={s.quando}>
                        {DIAS_LONGOS[f.weekday]} às {f.startTime}
                      </Text>
                      <Text style={s.ajuda}>
                        {f.services.map((x) => x.name).join(", ")} · {f.totalDuration}min · R${" "}
                        {f.totalPrice.toFixed(2)}
                      </Text>
                      <Text style={s.ajuda}>
                        {paraBR(f.startDate)} até {paraBR(f.endDate)}
                      </Text>
                      {!f.active && <Text style={s.ajuda}>encerrado</Text>}
                    </View>
                    {f.active && (
                      <TouchableOpacity
                        style={s.botaoEncerrar}
                        onPress={() => encerrar(f)}
                        disabled={encerrando === f.id}
                      >
                        <Text style={s.botaoEncerrarTexto}>
                          {encerrando === f.id ? "…" : "Encerrar"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ScreenBackground>
  );
}

const estilos = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    conteudo: { padding: spacing.md, paddingBottom: spacing['3xl'], gap: spacing.md },
    cartao: {
      backgroundColor: c.dark[800],
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.gray[700],
      padding: spacing.md,
      gap: spacing.sm,
    },
    cartaoInativo: { opacity: 0.6 },
    titulo: { color: c.white, fontSize: fontSize.h3, fontWeight: fontWeight.semibold },
    ajuda: { color: c.gray[500], fontSize: fontSize.caption },
    rotulo: { color: c.gray[500], fontSize: fontSize.caption, marginTop: spacing.xs },
    input: {
      backgroundColor: c.dark[900],
      borderWidth: 1,
      borderColor: c.gray[700],
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: c.white,
      fontSize: fontSize.bodyLarge,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    chip: {
      borderWidth: 1,
      borderColor: c.gray[700],
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    chipAtivo: { borderColor: c.brand[500], backgroundColor: c.brand[500] + "1A" },
    chipTexto: { color: c.gray[500], fontSize: fontSize.body },
    chipTextoAtivo: { color: c.brand[500] },
    linha: { flexDirection: "row", gap: spacing.sm },
    meio: { flex: 1 },
    linhaTopo: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    nome: { color: c.white, fontSize: fontSize.bodyLarge, fontWeight: fontWeight.semibold },
    quando: { color: c.brand[500], fontSize: fontSize.body },
    vazio: { color: c.gray[500], textAlign: "center", paddingVertical: spacing.lg },
    botaoEncerrar: {
      borderWidth: 1,
      borderColor: c.gray[700],
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    botaoEncerrarTexto: { color: c.gray[500], fontSize: fontSize.caption },
  });
