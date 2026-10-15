"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/app/components/hud";
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
    "w-full rounded bg-hud-bg border border-hud-border px-4 py-3 text-hud-text placeholder:text-hud-faint focus:border-hud-accent focus:outline-none";

  return (
    <div className="space-y-6">
      {dialogoConfirmacao}

      <div className="hud-card p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-hud-text">Novo agendamento</h3>
          <p className="text-xs text-hud-muted mt-1">
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
          <label className="text-xs text-hud-muted mb-1 block">Serviços *</label>
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
                  className={`px-3 py-2 rounded text-sm border transition ${
                    marcado ? "border-hud-accent bg-[color-mix(in_srgb,var(--hud-accent)_10%,transparent)] text-hud-light" : "border-hud-border text-hud-muted"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
          {novo.serviceIds.length > 0 && (
            <p className="text-xs text-hud-muted mt-2">{duracao} min · R$ {valor.toFixed(2)}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Sem recorrência, "dia da semana" não localiza nada — o
              atendimento acontece numa data. */}
          {recorrente ? (
            <div>
              <label className="text-xs text-hud-muted mb-1 block">Dia da semana</label>
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
              <label className="text-xs text-hud-muted mb-1 block">Data *</label>
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
              <label className="text-xs text-hud-muted mb-1 block">Horário</label>
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
            <label className="text-xs text-hud-muted mb-1 block">Horário *</label>
            {novo.serviceIds.length === 0 || !dataAvulsa ? (
              <p className="text-xs text-hud-muted py-2">
                Escolha o serviço e a data para ver os horários livres.
              </p>
            ) : buscandoHorarios ? (
              <p className="text-xs text-hud-muted py-2">Procurando horários...</p>
            ) : horariosLivres && horariosLivres.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {horariosLivres.map((h) => (
                  <button
                    key={h}
                    onClick={() => setNovo((p) => ({ ...p, startTime: h }))}
                    className={
                      novo.startTime === h
                        ? "rounded gold-fill border border-hud-accent px-3 py-2 text-sm font-bold text-[var(--hud-on-accent)] tabular-nums"
                        : "rounded border border-hud-border px-3 py-2 text-sm font-semibold text-hud-soft hover:border-hud-accent hover:text-hud-light transition tabular-nums"
                    }
                  >
                    {h}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-hud-warn py-2">
                {motivoSemHorario || "Nenhum horário livre nesse dia"}
              </p>
            )}
          </div>
        )}

        <button
          onClick={() => setRecorrente((v) => !v)}
          aria-pressed={recorrente}
          className="flex w-full items-center justify-between gap-3 rounded border border-hud-border p-3 text-left hover:bg-white/5 transition"
        >
          <span className="text-sm font-semibold text-hud-text">
            Ativar recorrência
            <span className="block text-xs font-normal text-hud-muted mt-0.5">
              Repete toda semana, no mesmo dia e horário
            </span>
          </span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${recorrente ? "gold-fill" : "bg-[var(--hud-track)]"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full transition-all ${recorrente ? "left-6 bg-hud-bg" : "left-1 bg-[var(--hud-text-2)]"}`} />
          </span>
        </button>

        {recorrente && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-hud-muted mb-1 block">De</label>
              <input
                type="date" value={novo.startDate}
                onChange={(e) => setNovo((p) => ({ ...p, startDate: e.target.value }))}
                className={campo}
              />
            </div>
            <div>
              <label className="text-xs text-hud-muted mb-1 block">Até</label>
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
            <label className="text-xs text-hud-muted mb-1 block">Barbeiro</label>
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
          className="hud-focus hud-chamfer w-full gold-fill min-h-[56px] font-bold uppercase tracking-[0.1em] text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] hover:brightness-105 disabled:opacity-50 transition-all"
        >
          {salvando ? "Criando..." : recorrente ? "Criar corte fixo" : "Agendar"}
        </button>
      </div>

      {fixosLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-hud-accent border-t-transparent" />
        </div>
      ) : fixos.length === 0 ? (
        <p className="text-center text-hud-muted py-6">Nenhum corte fixo cadastrado</p>
      ) : (
        <div className="space-y-3">
          {fixos.map((f) => (
            <div
              key={f.id}
              className={`rounded border bg-hud-surface p-4 ${f.active ? "border-hud-border" : "border-hud-border opacity-60"}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-hud-accent"><Icon nome="agenda" tamanho={22} /></span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-hud-text">{f.clientName}</p>
                  <p className="text-sm text-hud-light">{DIAS[f.weekday]} às {f.startTime}</p>
                  <p className="text-xs text-hud-muted mt-1">
                    {f.services.map((s) => s.name).join(", ")} · {f.totalDuration}min · R$ {f.totalPrice.toFixed(2)}
                  </p>
                  <p className="text-xs text-hud-muted mt-1">
                    {f.startDate.split("-").reverse().join("/")} até {f.endDate.split("-").reverse().join("/")}
                    {ehDono ? " · " + f.barberName : ""}
                  </p>
                  {!f.active && <p className="text-xs text-hud-muted mt-1">encerrado</p>}
                </div>
                {f.active && (
                  <button
                    onClick={() => encerrar(f)}
                    disabled={encerrando === f.id}
                    title="Encerrar"
                    className="shrink-0 rounded border border-hud-border px-2.5 py-2 text-sm text-hud-muted hover:text-hud-err hover:border-[color-mix(in_srgb,var(--hud-err)_50%,transparent)] disabled:opacity-40 transition"
                  >
                    {encerrando === f.id ? "…" : <Icon nome="fechar" tamanho={16} />}
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
