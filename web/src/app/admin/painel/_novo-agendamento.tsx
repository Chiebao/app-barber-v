"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/app/lib/toast";
import { useConfirmacao } from "@/app/lib/modal";

/**
 * Novo agendamento — avulso ou recorrente, pelo mesmo formulário.
 *
 * Extraído do painel porque era o maior bloco de um arquivo de 2.870 linhas, e
 * porque TODO o estado que ele usa só existe aqui: dez `useState` que viviam no
 * topo do componente e não diziam respeito a mais nada. Enquanto moravam lá,
 * qualquer mudança na agenda ou no financeiro passava por eles.
 *
 * O toggle decide se o agendamento acontece uma vez ou toda semana, e as duas
 * pontas vão para rotas diferentes: a recorrência materializa ocorrências
 * futuras, o avulso cria UM atendimento e pronto.
 */

type CorteFixo = {
  id: string;
  clientName: string;
  clientPhone: string;
  barberId: string;
  barberName: string;
  weekday: number;
  startTime: string;
  totalDuration: number;
  totalPrice: number;
  startDate: string;
  endDate: string;
  active: boolean;
  services: { id: string; name: string }[];
};

interface Servico {
  id: string;
  name: string;
  duration: number;
  price: number;
  active: boolean;
}

interface Barbeiro {
  id: string;
  name: string;
  active: boolean;
}

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function NovoAgendamento({
  token,
  services,
  barbers,
  ehDono,
  onCriado,
  onUnauthorized,
}: {
  token: string | null;
  services: Servico[];
  barbers: Barbeiro[];
  ehDono: boolean;
  /** Recarrega a agenda do painel: o atendimento novo precisa aparecer nela. */
  onCriado: () => void;
  onUnauthorized: () => void;
}) {
  const [confirmar, dialogoConfirmacao] = useConfirmacao();

  const [fixos, setFixos] = useState<CorteFixo[]>([]);
  const [fixosLoading, setFixosLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [encerrando, setEncerrando] = useState<string | null>(null);

  // O formulário é o mesmo para os dois casos; o toggle decide qual.
  const [recorrente, setRecorrente] = useState(false);
  const [dataAvulsa, setDataAvulsa] = useState("");
  const [novo, setNovo] = useState({
    clientName: "", clientPhone: "", barberId: "", serviceIds: [] as string[],
    weekday: 2, startTime: "10:00", startDate: "", endDate: "",
  });

  // Horários que a agenda realmente tem naquele dia, para o barbeiro tocar em
  // vez de rolar um seletor de relógio até um horário que talvez esteja
  // ocupado. Vêm da mesma conta que o cliente vê.
  const [horariosLivres, setHorariosLivres] = useState<string[] | null>(null);
  const [motivoSemHorario, setMotivoSemHorario] = useState<string | null>(null);
  const [buscandoHorarios, setBuscandoHorarios] = useState(false);

  const auth = useCallback(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token],
  );

  const buscarFixos = useCallback(async () => {
    if (!token) return;
    setFixosLoading(true);
    try {
      const res = await fetch("/api/me/recurring", { headers: auth() });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      setFixos(data.recurring || []);
    } catch {
      /* silencioso: a tela mostra a lista vazia */
    } finally {
      setFixosLoading(false);
    }
  }, [token, auth, onUnauthorized]);

  useEffect(() => { buscarFixos(); }, [buscarFixos]);

  // A lista depende da duração: trocar de serviço muda o que cabe onde, e um
  // horário válido para 30 min pode não ser para 1h15.
  useEffect(() => {
    const duracao = services
      .filter((x) => novo.serviceIds.includes(x.id))
      .reduce((soma, x) => soma + x.duration, 0);

    if (!token || recorrente || !dataAvulsa || duracao === 0) {
      setHorariosLivres(null);
      setMotivoSemHorario(null);
      return;
    }

    let cancelado = false;
    setBuscandoHorarios(true);
    const bid = novo.barberId || "";
    fetch(`/api/me/agendamentos?date=${dataAvulsa}&duration=${duracao}${bid ? `&barberId=${bid}` : ""}`, {
      headers: auth(),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelado) return;
        setHorariosLivres(d?.slots ?? []);
        setMotivoSemHorario(d?.motivo ?? null);
      })
      .catch(() => { if (!cancelado) setHorariosLivres([]); })
      .finally(() => { if (!cancelado) setBuscandoHorarios(false); });

    return () => { cancelado = true; };
  }, [token, recorrente, dataAvulsa, novo.serviceIds, novo.barberId, services, auth]);

  const ativos = services.filter((s) => s.active);
  const escolhidos = ativos.filter((s) => novo.serviceIds.includes(s.id));
  const duracao = escolhidos.reduce((soma, s) => soma + s.duration, 0);
  const valor = escolhidos.reduce((soma, s) => soma + s.price, 0);

  const baseOk =
    novo.clientName.trim().length >= 2 &&
    novo.clientPhone.replace(/\D/g, "").length >= 8 &&
    novo.serviceIds.length > 0 &&
    !!novo.startTime;

  const podeSalvar = recorrente
    ? baseOk && !!novo.startDate && !!novo.endDate && novo.endDate >= novo.startDate
    // No avulso o horário sai da lista de livres, então não basta ter um
    // valor: ele precisa ter sido escolhido depois da data.
    : baseOk && !!dataAvulsa && (horariosLivres ?? []).includes(novo.startTime);

  async function salvar() {
    if (!token) return;
    setSalvando(true);
    try {
      // Duas rotas porque são dois assuntos: a recorrência materializa
      // ocorrências futuras, o avulso cria UM atendimento e pronto.
      const rota = recorrente ? "/api/me/recurring" : "/api/me/agendamentos";
      const corpo = recorrente
        ? { ...novo, barberId: novo.barberId || undefined }
        : {
            clientName: novo.clientName,
            clientPhone: novo.clientPhone,
            serviceIds: novo.serviceIds,
            date: dataAvulsa,
            startTime: novo.startTime,
            barberId: novo.barberId || undefined,
          };

      const res = await fetch(rota, { method: "POST", headers: auth(), body: JSON.stringify(corpo) });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Não consegui criar"); return; }

      toast.success(
        !recorrente
          ? "Agendamento criado"
          : data.ocorrenciasCriadas > 0
          ? `Corte fixo criado — ${data.ocorrenciasCriadas} já entraram na agenda`
          : "Corte fixo criado",
      );

      // Zera também o horário: ele saiu da lista de livres agora que está
      // ocupado, e deixar o valor antigo confundiria o próximo.
      setNovo((p) => ({
        ...p, clientName: "", clientPhone: "", serviceIds: [],
        startTime: recorrente ? p.startTime : "",
      }));
      buscarFixos();
      onCriado();
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSalvando(false);
    }
  }

  async function encerrar(f: CorteFixo) {
    const ok = await confirmar({
      titulo: `Encerrar o corte fixo de ${f.clientName}?`,
      texto:
        "Os cortes que já aconteceram continuam no histórico. " +
        "Os futuros que ninguém tocou saem da agenda.",
      acao: "Encerrar",
      perigo: true,
    });
    if (!ok || !token) return;

    setEncerrando(f.id);
    try {
      const res = await fetch("/api/me/recurring?id=" + f.id, { method: "DELETE", headers: auth() });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Não consegui encerrar"); return; }
      toast.success(`Encerrado — ${data.ocorrenciasRemovidas} horário(s) liberado(s)`);
      buscarFixos();
      onCriado();
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setEncerrando(null);
    }
  }

  const campo =
    "w-full rounded-xl bg-dark-900 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-400 focus:outline-none";

  return (
    <div className="space-y-6">
      {dialogoConfirmacao}

      <div className="rounded-xl bg-dark-800 border border-gray-700 p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-white">Novo agendamento</h3>
          <p className="text-xs text-gray-500 mt-1">
            {recorrente
              ? "Se repete toda semana. Você cria uma vez e ele aparece sozinho na agenda até a data final."
              : "Marque um cliente direto na sua agenda, sem ele precisar usar o link."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text" placeholder="Nome do cliente *" value={novo.clientName}
            onChange={(e) => setNovo((p) => ({ ...p, clientName: e.target.value }))}
            className={campo}
          />
          <input
            type="tel" placeholder="Telefone *" value={novo.clientPhone}
            onChange={(e) => setNovo((p) => ({ ...p, clientPhone: e.target.value }))}
            className={campo}
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Serviços *</label>
          <div className="flex gap-2 flex-wrap">
            {ativos.map((s) => {
              const marcado = novo.serviceIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() =>
                    setNovo((p) => ({
                      ...p,
                      serviceIds: marcado
                        ? p.serviceIds.filter((x) => x !== s.id)
                        : [...p.serviceIds, s.id],
                    }))
                  }
                  className={`px-3 py-2 rounded-lg text-sm border transition ${
                    marcado ? "border-brand-400 bg-brand-500/10 text-brand-400" : "border-gray-700 text-gray-400"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
          {novo.serviceIds.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">{duracao} min · R$ {valor.toFixed(2)}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Sem recorrência, "dia da semana" não localiza nada — o
              atendimento acontece numa data. */}
          {recorrente ? (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Dia da semana</label>
              <select
                value={novo.weekday}
                onChange={(e) => setNovo((p) => ({ ...p, weekday: Number(e.target.value) }))}
                className={campo}
              >
                {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Data *</label>
              <input
                type="date" value={dataAvulsa}
                onChange={(e) => {
                  setDataAvulsa(e.target.value);
                  // O horário escolhido pode não existir no dia novo.
                  setNovo((p) => ({ ...p, startTime: "" }));
                }}
                className={campo}
              />
            </div>
          )}

          {/* No corte fixo o horário é livre: a regra é "toda terça às 15h", e
              o dia certo pode estar ocupado hoje sem que isso invalide a regra.
              No avulso, oferecer o relógio inteiro é mandar o barbeiro
              adivinhar — ele rola até um horário e descobre no salvar que está
              ocupado. */}
          {recorrente && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Horário</label>
              <input
                type="time" value={novo.startTime}
                onChange={(e) => setNovo((p) => ({ ...p, startTime: e.target.value }))}
                className={campo}
              />
            </div>
          )}
        </div>

        {!recorrente && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Horário *</label>
            {novo.serviceIds.length === 0 || !dataAvulsa ? (
              <p className="text-xs text-gray-500 py-2">
                Escolha o serviço e a data para ver os horários livres.
              </p>
            ) : buscandoHorarios ? (
              <p className="text-xs text-gray-500 py-2">Procurando horários...</p>
            ) : horariosLivres && horariosLivres.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {horariosLivres.map((h) => (
                  <button
                    key={h}
                    onClick={() => setNovo((p) => ({ ...p, startTime: h }))}
                    className={
                      novo.startTime === h
                        ? "rounded-lg bg-brand-500 border border-brand-500 px-3 py-2 text-sm font-bold text-dark-900 tabular-nums"
                        : "rounded-lg border border-gray-700 px-3 py-2 text-sm font-semibold text-gray-300 hover:border-brand-400 hover:text-brand-400 transition tabular-nums"
                    }
                  >
                    {h}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-yellow-400 py-2">
                {motivoSemHorario || "Nenhum horário livre nesse dia"}
              </p>
            )}
          </div>
        )}

        <button
          onClick={() => setRecorrente((v) => !v)}
          aria-pressed={recorrente}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-700 p-3 text-left hover:bg-white/5 transition"
        >
          <span className="text-sm font-semibold text-white">
            Ativar recorrência
            <span className="block text-xs font-normal text-gray-500 mt-0.5">
              Repete toda semana, no mesmo dia e horário
            </span>
          </span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${recorrente ? "bg-brand-500" : "bg-gray-700"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full transition-all ${recorrente ? "left-6 bg-dark-900" : "left-1 bg-gray-400"}`} />
          </span>
        </button>

        {recorrente && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">De</label>
              <input
                type="date" value={novo.startDate}
                onChange={(e) => setNovo((p) => ({ ...p, startDate: e.target.value }))}
                className={campo}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Até</label>
              <input
                type="date" value={novo.endDate} min={novo.startDate || undefined}
                onChange={(e) => setNovo((p) => ({ ...p, endDate: e.target.value }))}
                className={campo}
              />
            </div>
          </div>
        )}

        {ehDono && barbers.length > 1 && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Barbeiro</label>
            <select
              value={novo.barberId}
              onChange={(e) => setNovo((p) => ({ ...p, barberId: e.target.value }))}
              className={campo}
            >
              <option value="">Eu mesmo</option>
              {barbers.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        <button
          onClick={salvar}
          disabled={!podeSalvar || salvando}
          className="w-full rounded-xl bg-brand-500 py-3 font-semibold text-dark-900 hover:bg-brand-400 disabled:opacity-50 transition-all"
        >
          {salvando ? "Criando..." : recorrente ? "Criar corte fixo" : "Agendar"}
        </button>
      </div>

      {fixosLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
        </div>
      ) : fixos.length === 0 ? (
        <p className="text-center text-gray-500 py-6">Nenhum corte fixo cadastrado</p>
      ) : (
        <div className="space-y-3">
          {fixos.map((f) => (
            <div
              key={f.id}
              className={`rounded-xl border bg-dark-800 p-4 ${f.active ? "border-gray-700" : "border-gray-800 opacity-60"}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔁</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white">{f.clientName}</p>
                  <p className="text-sm text-brand-400">{DIAS[f.weekday]} às {f.startTime}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {f.services.map((s) => s.name).join(", ")} · {f.totalDuration}min · R$ {f.totalPrice.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {f.startDate.split("-").reverse().join("/")} até {f.endDate.split("-").reverse().join("/")}
                    {ehDono ? " · " + f.barberName : ""}
                  </p>
                  {!f.active && <p className="text-xs text-gray-500 mt-1">encerrado</p>}
                </div>
                {f.active && (
                  <button
                    onClick={() => encerrar(f)}
                    disabled={encerrando === f.id}
                    title="Encerrar"
                    className="shrink-0 rounded-lg border border-gray-700 px-2.5 py-2 text-sm text-gray-400 hover:text-red-400 hover:border-red-500/50 disabled:opacity-40 transition"
                  >
                    {encerrando === f.id ? "…" : "⏹"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
