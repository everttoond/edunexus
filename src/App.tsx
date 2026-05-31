import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent, MouseEvent } from "react";
import type { ClickEventPayload, StatsResponse } from "./types";

const STORAGE_VISITOR_KEY = "edunexus_visitor_id";
const STORAGE_CONSENT_KEY = "edunexus_click_consent";

const fallbackStats: StatsResponse = {
  totalEvents: 0,
  pageViews: 0,
  totalClicks: 0,
  uniqueVisitors: 0,
  byTarget: {},
  recentEvents: [],
};

type GuideStep = 0 | 1 | 2 | 3 | 4;
type AdaptedContent = "infographic" | "summary";

const guideSteps: Array<{
  title: string;
  description: string;
  nextLabel: string;
}> = [
  {
    title: "1 - Interface do gestor",
    description: "Comece pela visão executiva, onde o decisor entende riscos, turmas e indicadores.",
    nextLabel: "Próximo",
  },
  {
    title: "2 - Insights de IA",
    description: "Depois, veja como a IA transforma os dados em recomendações pedagógicas acionáveis.",
    nextLabel: "Próximo",
  },
  {
    title: "3 - Interface do aluno",
    description: "Agora avance para a experiência do aluno, que mostra o impacto prático da adaptação.",
    nextLabel: "Abrir aluno",
  },
  {
    title: "4 - Adaptação infográfico",
    description: "O aluno pode escolher uma versão visual da aula, organizada em blocos conectados.",
    nextLabel: "Próximo",
  },
  {
    title: "5 - Adaptação resumo",
    description: "Por fim, ele acessa o resumo textual adaptado, com opção de copiar o conteúdo.",
    nextLabel: "Reiniciar guia",
  },
];

function getVisitorId() {
  const existing = window.localStorage.getItem(STORAGE_VISITOR_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(STORAGE_VISITOR_KEY, generated);
  return generated;
}

function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") || undefined,
    utmMedium: params.get("utm_medium") || undefined,
    utmCampaign: params.get("utm_campaign") || undefined,
  };
}

async function sendEvent(payload: ClickEventPayload) {
  const response = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Falha ao registrar clique");
  }

  return response.json();
}

async function fetchStats(): Promise<StatsResponse> {
  const response = await fetch("/api/stats");
  if (!response.ok) {
    throw new Error("Falha ao buscar estatisticas");
  }

  return response.json();
}

function App() {
  const [stats, setStats] = useState<StatsResponse>(fallbackStats);
  const [apiOnline, setApiOnline] = useState(true);
  const [consent, setConsent] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pageViewSent = useRef(false);

  const visitorId = useMemo(getVisitorId, []);
  const utms = useMemo(getUtmParams, []);

  const refreshStats = useCallback(async () => {
    try {
      const nextStats = await fetchStats();
      setStats(nextStats);
      setApiOnline(true);
    } catch {
      setApiOnline(false);
    }
  }, []);

  const track = useCallback(
    async (target: string, type: ClickEventPayload["type"] = "cta_click") => {
      if (!consent) return;

      try {
        const nextStats = await sendEvent({
          type,
          target,
          visitorId,
          page: window.location.pathname,
          referrer: document.referrer,
          ...utms,
        });
        setStats(nextStats);
        setApiOnline(true);
      } catch {
        setApiOnline(false);
      }
    },
    [consent, utms, visitorId],
  );

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (consent && !pageViewSent.current) {
      pageViewSent.current = true;
      track("login_page", "page_view");
    }
  }, [consent, track]);

  const acceptTracking = () => {
    window.localStorage.setItem(STORAGE_CONSENT_KEY, "accepted");
    setConsent(true);
  };

  const rejectTracking = () => {
    window.localStorage.setItem(STORAGE_CONSENT_KEY, "rejected");
    setConsent(false);
  };

  const handleLogin = async () => {
    await track("login_quero_testar");
    setIsLoggedIn(true);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  };

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      {isLoggedIn ? (
        <DemoPage
          apiOnline={apiOnline}
          refreshStats={refreshStats}
          stats={stats}
          track={track}
        />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}

      {false && !consent && (
        <div className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-3xl rounded-lg border border-white/15 bg-[#081225]/95 p-4 text-white shadow-soft backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm leading-6 text-slate-300">
              Usamos um contador anonimo para medir visitas e cliques desta validacao.
              Nao coletamos nome, telefone ou email.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={rejectTracking}
                className="min-h-10 rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200"
              >
                Recusar
              </button>
              <button
                type="button"
                onClick={acceptTracking}
                className="min-h-10 rounded-md bg-cobalt px-4 py-2 text-sm font-semibold text-white"
              >
                Aceitar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => Promise<void> }) {
  const [email, setEmail] = useState("aluno@edunexus.com");
  const [password, setPassword] = useState("edunexus");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    await onLogin();
    setIsSubmitting(false);
  };

  return (
    <section className="reference-login-shell">
      <div className="reference-login-frame">
        <img
          src="/assets/edunexus-login-reference.png"
          alt="Tela inicial EduNexus"
          className="reference-login-image"
          draggable={false}
        />
        <p className="reference-copyright-override">
          © 2026 EduNexus. Todos os direitos reservados.
        </p>
        <div className="mobile-login-content">
          <div>
            <div className="mobile-login-brand">
              <span className="mobile-login-mark" />
              <div>
                <p>EduNexus</p>
                <span>Conecta · Orquestra · Transforma</span>
              </div>
            </div>
            <p className="mt-8 inline-flex rounded-lg border border-cyan-400/60 bg-[#081225]/75 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white">
              MVP demonstrativo
            </p>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-normal text-white">
              Aprendizagem <span>adaptativa</span> para o ensino superior
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Acesse a simulacao da plataforma EduNexus com visao do gestor e jornada do aluno.
            </p>
          </div>
          <div className="mobile-login-panel">
            <h2>Bem-vindo ao EduNexus</h2>
            <p>Acesse uma simulacao de aula adaptativa sobre Andragogia no Ensino Superior.</p>
            <button
              type="button"
              onClick={() => onLogin()}
              disabled={isSubmitting}
              className="mt-6 min-h-14 w-full rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 px-5 text-base font-black text-white shadow-[0_18px_45px_rgba(37,99,235,0.32)]"
            >
              Quero testar
            </button>
          </div>
        </div>
        <form
          onSubmit={handleSubmit}
          className="reference-login-form"
          aria-label="Login demonstrativo EduNexus"
        >
          <label className="sr-only" htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="reference-hit-area reference-email-hit"
            placeholder="aluno@edunexus.com"
            autoComplete="email"
          />

          <label className="sr-only" htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="reference-hit-area reference-password-hit"
            placeholder="********"
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="reference-submit-hit"
            aria-label="Quero testar"
          />
        </form>
      </div>
    </section>
  );
}

function DemoPage({
  apiOnline,
  refreshStats,
  stats,
  track,
}: {
  apiOnline: boolean;
  refreshStats: () => Promise<void>;
  stats: StatsResponse;
  track: (target: string, type?: ClickEventPayload["type"]) => Promise<void>;
}) {
  const viewParam = new URLSearchParams(window.location.search).get("view");
  const [activeView, setActiveView] = useState<"manager" | "student">(
    viewParam === "student" ? "student" : "manager",
  );
  const [guideStep, setGuideStep] = useState<GuideStep>(0);
  const currentGuideStep = guideSteps[guideStep];

  const shareViewLink = (view: "manager" | "student") => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url.toString());
      return;
    }
    window.prompt("Copie este link para compartilhar:", url.toString());
  };

  const changeView = async (view: "manager" | "student") => {
    setActiveView(view);
    await track(view === "manager" ? "view_gestor" : "view_aluno");
  };

  const advanceGuide = async () => {
    const nextStep = (guideStep === 4 ? 0 : guideStep + 1) as GuideStep;
    setGuideStep(nextStep);
    setActiveView(nextStep <= 2 ? "manager" : "student");
    await track(`guia_etapa_${nextStep + 1}`);
  };

  return (
    <div
      className={`min-h-screen ${
        activeView === "manager" ? "bg-[#eef3f8] text-slate-950" : "bg-[#020617] text-white"
      }`}
    >
      {activeView === "manager" && (
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-cobalt">
              EduNexus Learning Room
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-normal md:text-4xl">
              Central de impacto pedagógico
            </h1>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1 sm:items-center sm:pb-0">
            <div className="grid min-w-max grid-cols-2 rounded-md border border-slate-200 bg-slate-100 p-1 sm:flex">
              <button
                type="button"
                onClick={() => changeView("manager")}
                className={`relative min-h-11 rounded px-4 text-sm font-bold transition ${
                  activeView === "manager"
                    ? "bg-white text-cobalt shadow-sm"
                    : "text-slate-600 hover:text-slate-950"
                }`}
              >
                {guideStep === 0 && <GuideMarker onActivate={advanceGuide} />}
                Visão do gestor
              </button>
              <button
                type="button"
                onClick={() => changeView("student")}
                className="relative min-h-11 rounded px-4 text-sm font-bold text-slate-600 transition hover:text-slate-950"
              >
                {guideStep === 2 && <GuideMarker onActivate={advanceGuide} />}
                Visão do aluno
              </button>
            </div>
            <button
              type="button"
              onClick={() => shareViewLink(activeView)}
              className="min-h-11 min-w-max rounded-md border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Copiar link {activeView === "manager" ? "gestor" : "aluno"}
            </button>
            <button
              type="button"
              onClick={() => track("gestor_gerar_relatorio_topo")}
              className="min-h-11 min-w-max rounded-md bg-cobalt px-4 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Gerar relatório
            </button>
          </div>
        </div>
      </header>
      )}

      {activeView === "manager" ? (
        <ManagerView
          apiOnline={apiOnline}
          guideStep={guideStep}
          onGuideNext={advanceGuide}
          refreshStats={refreshStats}
          stats={stats}
          track={track}
        />
      ) : (
        <StudentImpactView
          guideStep={guideStep}
          onGuideNext={advanceGuide}
          onGoManager={() => changeView("manager")}
          track={track}
          shareLink={() => shareViewLink("student")}
        />
      )}
      <GuidedTourPanel
        currentStep={guideStep}
        description={currentGuideStep.description}
        nextLabel={currentGuideStep.nextLabel}
        onNext={advanceGuide}
        title={currentGuideStep.title}
      />
    </div>
  );
}

function GuideMarker({ onActivate }: { onActivate: () => Promise<void> }) {
  const handleActivate = (event: MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void onActivate();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    void onActivate();
  };

  return (
    <span
      aria-label="Avançar etapa do guia"
      className="absolute left-1/2 top-0 z-20 h-9 w-9 -translate-x-1/2 -translate-y-[115%] cursor-pointer rounded-full border-2 border-cyan-300 bg-cyan-300/25 shadow-[0_0_28px_rgba(34,211,238,0.85)] outline-none transition hover:scale-110 focus-visible:ring-4 focus-visible:ring-cyan-300/45"
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      title="Avançar etapa"
    >
      <span className="absolute inset-0 rounded-full bg-cyan-300/40 animate-ping" />
    </span>
  );
}

function GuidedTourPanel({
  currentStep,
  description,
  nextLabel,
  onNext,
  title,
}: {
  currentStep: GuideStep;
  description: string;
  nextLabel: string;
  onNext: () => Promise<void>;
  title: string;
}) {
  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-4 text-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.22)] md:bottom-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-cyan-300 text-sm font-black text-slate-950">
              {currentStep + 1}
            </span>
            <h2 className="text-sm font-black uppercase tracking-[0.12em] text-slate-950">
              {title}
            </h2>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{description}</p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="min-h-11 shrink-0 rounded-md bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800"
        >
          {nextLabel}
        </button>
      </div>
    </aside>
  );
}

function ManagerView({
  apiOnline,
  guideStep,
  onGuideNext,
  refreshStats,
  stats,
  track,
}: {
  apiOnline: boolean;
  guideStep: GuideStep;
  onGuideNext: () => Promise<void>;
  refreshStats: () => Promise<void>;
  stats: StatsResponse;
  track: (target: string, type?: ClickEventPayload["type"]) => Promise<void>;
}) {
  const validationMetrics = [
    { label: "Clicks", value: stats.totalClicks },
    { label: "Visitas", value: stats.pageViews },
    { label: "Eventos", value: stats.totalEvents },
    { label: "Pessoas", value: stats.uniqueVisitors },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-5 md:px-8 md:py-8">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cobalt">
              Visão do gestor
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight tracking-normal text-slate-950 sm:text-3xl">
              Central de Impacto Pedagógico
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Painel para coordenadores, diretores e mantenedores testarem onde a
              plataforma reduz risco de evasão, acelera adaptações e mostra impacto real
              no acompanhamento dos alunos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => track("gestor_gerar_relatorio")}
            className="min-h-11 w-full rounded-md bg-cobalt px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 sm:w-auto"
          >
            Gerar relatório executivo
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <ExecutiveMetric
            label="Alunos em acompanhamento"
            value="1.248"
            detail="+18% nos últimos 30 dias"
            tone="blue"
          />
          <ExecutiveMetric
            label="Alunos em risco de evasão"
            value="14%"
            detail="32 alunos precisam de intervenção"
            tone="red"
          />
          <ExecutiveMetric
            label="Materiais adaptados"
            value="376"
            detail="+41% no mês"
            tone="green"
          />
          <ExecutiveMetric
            label="Tempo economizado pela equipe"
            value="82h"
            detail="Estimativa baseada nas adaptações geradas"
            tone="amber"
          />
          <ExecutiveMetric
            label="Interações com Edu AI"
            value="4.812"
            detail="Dúvidas, resumos e transposições"
            tone="purple"
          />
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">
              Alertas prioritários
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              Intervenções sugeridas antes da perda de engajamento
            </h3>
          </div>
          <span className="w-fit rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-700">
            3 ações recomendadas
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <PriorityAlert
            course="Pedagogia - 3º semestre"
            issue="32% sem acompanhamento recente"
            priority="Alta"
            action="Liberar resumo visual e quiz rápido"
            tone="red"
            track={track}
          />
          <PriorityAlert
            course="Engenharia de Produção - 5º semestre"
            issue="21% com baixa conclusão"
            priority="Média"
            action="Enviar reforço prático"
            tone="amber"
            track={track}
          />
          <PriorityAlert
            course="Administração - 2º semestre"
            issue="12% com pouca interação na Edu AI"
            priority="Baixa"
            action="Ativar perguntas guiadas"
            tone="green"
            track={track}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Mapa de risco
              </p>
              <h3 className="mt-2 text-xl font-black text-slate-950">
                Turmas que precisam de atenção
              </h3>
            </div>
            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
              Atualizado hoje
            </span>
          </div>

          <div className="mt-5 hidden overflow-hidden rounded-lg border border-slate-200 md:block">
            <div className="grid grid-cols-[1fr_90px_120px_1.2fr] bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <span>Curso</span>
              <span>Risco</span>
              <span>Status</span>
              <span>Ação sugerida</span>
            </div>
            <RiskTableRow course="Pedagogia" risk="32%" status="Atenção" action="Revisão adaptada antes da prova" tone="red" />
            <RiskTableRow course="Engenharia" risk="21%" status="Moderado" action="Resumo prático e quiz diagnóstico" tone="amber" />
            <RiskTableRow course="Administração" risk="12%" status="Estável" action="Manter monitoramento" tone="green" />
            <RiskTableRow course="Direito" risk="8%" status="Estável" action="Nenhuma ação urgente" tone="green" />
          </div>

          <div className="mt-5 grid gap-3 md:hidden">
            <RiskMobileCard course="Pedagogia" risk="32%" status="Atenção" action="Revisão adaptada antes da prova" tone="red" />
            <RiskMobileCard course="Engenharia" risk="21%" status="Moderado" action="Resumo prático e quiz diagnóstico" tone="amber" />
            <RiskMobileCard course="Administração" risk="12%" status="Estável" action="Manter monitoramento" tone="green" />
            <RiskMobileCard course="Direito" risk="8%" status="Estável" action="Nenhuma ação urgente" tone="green" />
          </div>
        </div>

        <div className="relative rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          {guideStep === 1 && <GuideMarker onActivate={onGuideNext} />}
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cobalt">
            Recomendações da IA
          </p>
          <h3 className="mt-2 text-xl font-black text-slate-950">
            Próximas ações por prioridade
          </h3>
          <div className="mt-5 grid gap-3">
            <AiRecommendation
              priority="Alta"
              action="Criar trilha curta para alunos abaixo de 40% de progresso"
              impact="Reduz abandono antes da avaliação"
              effort="15 min"
              tone="red"
            />
            <AiRecommendation
              priority="Média"
              action="Enviar resumo visual para a turma com maior queda de atenção"
              impact="Aumenta conclusão da aula"
              effort="10 min"
              tone="amber"
            />
            <AiRecommendation
              priority="Baixa"
              action="Ativar perguntas guiadas no fechamento do módulo"
              impact="Gera evidências para o professor"
              effort="5 min"
              tone="green"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-mint">
            Evidência de impacto
          </p>
          <h3 className="mt-2 text-xl font-black text-slate-950">
            O que o gestor consegue validar no teste
          </h3>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <ImpactEvidence
            title="Antes"
            items={["Aula linear", "Dúvidas dispersas", "Baixa visibilidade da evasão"]}
            tone="slate"
          />
          <ImpactEvidence
            title="Depois"
            items={["Resumo adaptado", "Quiz rápido", "Alertas por turma"]}
            tone="blue"
          />
          <ImpactEvidence
            title="Resultado"
            items={["+31% de conclusão", "82h economizadas", "Ações pedagógicas rastreáveis"]}
            tone="green"
          />
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Validação do MVP
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Métricas do link enviado para conhecidos. Esta área fica como apoio da
              validação comercial, sem competir com a visão pedagógica do gestor.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {validationMetrics.map((metric) => (
              <MvpMetric key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={refreshStats}
              className="min-h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-100"
            >
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => track("gestor_ver_relatorio_validacao")}
              className="min-h-10 rounded-md bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
            >
              Ver relatório de validação
            </button>
          </div>
        </div>
        {!apiOnline && (
          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
            API local offline. Rode npm run api ou npm start para atualizar os dados.
          </p>
        )}
      </div>
    </section>
  );
}

function ExecutiveMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "red" | "green" | "amber" | "purple";
}) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    red: "border-red-200 bg-red-50 text-red-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    purple: "border-violet-200 bg-violet-50 text-violet-700",
  };

  return (
    <article className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="min-h-10 text-sm font-black leading-5 text-slate-800">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-normal text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-bold leading-5">{detail}</p>
    </article>
  );
}

function PriorityAlert({
  course,
  issue,
  priority,
  action,
  tone,
  track,
}: {
  course: string;
  issue: string;
  priority: string;
  action: string;
  tone: "red" | "amber" | "green";
  track: (target: string, type?: ClickEventPayload["type"]) => Promise<void>;
}) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <article className="flex min-h-[250px] flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-base font-black leading-6 text-slate-950">{course}</h4>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${tones[tone]}`}>
          {priority}
        </span>
      </div>
      <p className="mt-4 text-2xl font-black text-slate-950">{issue}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Ação sugerida: <strong className="text-slate-900">{action}</strong>
      </p>
      <button
        type="button"
        onClick={() => track(`gestor_intervencao_${course.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`)}
        className="mt-auto min-h-10 rounded-md bg-cobalt px-4 text-sm font-black text-white transition hover:bg-blue-700"
      >
        Gerar intervenção
      </button>
    </article>
  );
}

function RiskTableRow({
  course,
  risk,
  status,
  action,
  tone,
}: {
  course: string;
  risk: string;
  status: string;
  action: string;
  tone: "red" | "amber" | "green";
}) {
  return (
    <div className="grid grid-cols-[1fr_90px_120px_1.2fr] border-t border-slate-200 px-4 py-4 text-sm text-slate-700">
      <span className="font-black text-slate-950">{course}</span>
      <span className="font-black">{risk}</span>
      <RiskBadge status={status} tone={tone} />
      <span>{action}</span>
    </div>
  );
}

function RiskMobileCard({
  course,
  risk,
  status,
  action,
  tone,
}: {
  course: string;
  risk: string;
  status: string;
  action: string;
  tone: "red" | "amber" | "green";
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-black text-slate-950">{course}</h4>
          <p className="mt-1 text-sm text-slate-600">{action}</p>
        </div>
        <span className="text-xl font-black text-slate-950">{risk}</span>
      </div>
      <div className="mt-3">
        <RiskBadge status={status} tone={tone} />
      </div>
    </article>
  );
}

function RiskBadge({ status, tone }: { status: string; tone: "red" | "amber" | "green" }) {
  const tones = {
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-emerald-100 text-emerald-700",
  };

  return (
    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${tones[tone]}`}>
      {status}
    </span>
  );
}

function AiRecommendation({
  priority,
  action,
  impact,
  effort,
  tone,
}: {
  priority: string;
  action: string;
  impact: string;
  effort: string;
  tone: "red" | "amber" | "green";
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <RiskBadge status={priority} tone={tone} />
          <h4 className="mt-3 text-base font-black leading-6 text-slate-950">{action}</h4>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 shadow-sm">
          {effort}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{impact}</p>
    </article>
  );
}

function ImpactEvidence({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "slate" | "blue" | "green";
}) {
  const tones = {
    slate: "border-slate-200 bg-slate-50",
    blue: "border-blue-200 bg-blue-50",
    green: "border-emerald-200 bg-emerald-50",
  };

  return (
    <article className={`rounded-lg border p-4 ${tones[tone]}`}>
      <h4 className="text-lg font-black text-slate-950">{title}</h4>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cobalt" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function MvpMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[90px] rounded-md border border-slate-200 bg-white px-3 py-2 text-center">
      <p className="text-lg font-black text-slate-950">{value.toLocaleString("pt-BR")}</p>
      <p className="text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}

function LegacyManagerView({
  apiOnline,
  refreshStats,
  stats,
  track,
}: {
  apiOnline: boolean;
  refreshStats: () => Promise<void>;
  stats: StatsResponse;
  track: (target: string, type?: ClickEventPayload["type"]) => Promise<void>;
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-7 md:px-8">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">
                Visão do gestor
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-normal">
                Painel para coordenador, mantenedora ou diretor acadêmico
              </h2>
              <p className="mt-3 max-w-3xl leading-7 text-slate-600">
                A simulação mostra onde a plataforma entrega valor para gestão:
                engajamento, risco de evasão, necessidade de adaptação e impacto por
                turma antes da avaliação.
              </p>
            </div>
            <button
              type="button"
              onClick={() => track("gestor_ver_relatorio")}
              className="min-h-11 rounded-md bg-cobalt px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Gerar relatório
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardMetric label="Alunos ativos" value="1.248" detail="+18% em 30 dias" tone="blue" />
            <DashboardMetric label="Risco pedagógico" value="14%" detail="-9 pts após adaptação" tone="amber" />
            <DashboardMetric label="Conclusão da aula" value="76%" detail="+31% vs aula padrão" tone="green" />
            <DashboardMetric label="Uso da Edu AI" value="4.8k" detail="interações na semana" tone="purple" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-[#101827] p-6 text-white shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">
            Validação do MVP
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <DarkMetric label="Cliques" value={stats.totalClicks} />
            <DarkMetric label="Visitas" value={stats.pageViews} />
            <DarkMetric label="Eventos" value={stats.totalEvents} />
            <DarkMetric label="Pessoas" value={stats.uniqueVisitors} />
          </div>
          {!apiOnline && (
            <p className="mt-4 rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
              API local offline. Rode npm run api ou npm start.
            </p>
          )}
          <button
            type="button"
            onClick={refreshStats}
            className="mt-5 min-h-10 w-full rounded-md border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
          >
            Atualizar sinais
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold">Mapa de risco por turma</h3>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              prioridade média
            </span>
          </div>
          <div className="mt-5 space-y-5">
            <RiskRow course="Pedagogia - 3º semestre" risk={32} status="Atenção" />
            <RiskRow course="Engenharia de Produção - 5º semestre" risk={21} status="Monitorar" />
            <RiskRow course="Administração - 2º semestre" risk={12} status="Estável" />
            <RiskRow course="Direito - 1º semestre" risk={8} status="Estável" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">Recomendações da Edu AI para gestão</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <RecommendationCard
              title="Intervenção antes da prova"
              text="Enviar trilha curta para alunos com menos de 40% de progresso na aula de Andragogia."
            />
            <RecommendationCard
              title="Adaptação por perfil"
              text="Ativar modo TDAH e modo visual para a turma com maior abandono no meio da aula."
            />
            <RecommendationCard
              title="Monitoramento docente"
              text="Professor recebe uma lista de dúvidas recorrentes e pontos com maior queda de atenção."
            />
            <RecommendationCard
              title="Evidência de impacto"
              text="Comparar conclusão, retenção e quiz antes/depois da transposição adaptativa."
            />
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">O que o gestor valida nesta simulação</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <ValidationCard title="Valor institucional" text="Redução de evasão, aumento de engajamento e apoio documentado à permanência estudantil." />
          <ValidationCard title="Valor pedagógico" text="Professor enxerga dificuldade real da turma e recomendações acionáveis, não apenas presença." />
          <ValidationCard title="Valor comercial" text="A instituição entende rapidamente se pagaria por painel, IA e relatórios de impacto." />
        </div>
      </div>
    </section>
  );
}

function StudentImpactView({
  guideStep,
  onGuideNext,
  onGoManager,
  track,
  shareLink,
}: {
  guideStep: GuideStep;
  onGuideNext: () => Promise<void>;
  onGoManager: () => void;
  track: (target: string, type?: ClickEventPayload["type"]) => Promise<void>;
  shareLink: () => void;
}) {
  const [activeContent, setActiveContent] = useState<AdaptedContent>("summary");

  useEffect(() => {
    if (guideStep === 3) setActiveContent("infographic");
    if (guideStep === 4) setActiveContent("summary");
  }, [guideStep]);

  const selectContent = async (content: AdaptedContent) => {
    setActiveContent(content);
    await track(content === "infographic" ? "aluno_abrir_infografico" : "aluno_abrir_resumo");
  };

  return (
    <section className="student-learning-shell min-h-screen overflow-hidden pb-28">
      <header className="relative z-10 border-b border-white/10 bg-[#050b1d]/92">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-3 md:px-0 md:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="student-logo-mark shrink-0" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="min-w-0">
              <p className="bg-gradient-to-r from-blue-500 to-cyan-300 bg-clip-text text-2xl font-black leading-none text-transparent md:text-3xl">
                EduNexus
              </p>
              <p className="mt-1 hidden text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 sm:block">
                Conecta · Dissemina · Transforma
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-bold text-slate-300 md:flex">
            <span>Meus Cursos</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-black text-white">Lucas Andrade</p>
              <p className="hidden text-xs text-slate-400 sm:block">Estudante</p>
            </div>
            <div className="h-10 w-10 rounded-full border border-cyan-300/40 bg-gradient-to-br from-amber-200 to-slate-700" />
            <button
              type="button"
              onClick={shareLink}
              className="hidden min-h-9 rounded-md border border-white/10 px-3 text-xs font-bold text-slate-300 transition hover:bg-white/10 lg:block"
            >
              Link
            </button>
          </div>
        </div>
      </header>

      <div className="student-network-bg" aria-hidden="true" />

      <main className="relative z-10 mx-auto grid max-w-[1180px] gap-6 px-4 py-6 lg:grid-cols-[1fr_270px] lg:px-0">
        <div className="min-w-0">
          <div className="text-sm text-slate-400">
            Meus Cursos <span className="mx-2 text-slate-600">›</span> Metodologias Ativas e
            Andragogia <span className="mx-2 text-slate-600">›</span> Módulo 1
          </div>

          <h1 className="mt-4 text-2xl font-black leading-tight tracking-normal text-white md:text-4xl">
            <span className="text-violet-400">Aula 1:</span> O impacto da{" "}
            <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
              Andragogia no Ensino Superior
            </span>
          </h1>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
            <span>Profª Dra. Camila Rezende</span>
            <span>Módulo 1 - Fundamentos da Andragogia</span>
            <span>28 min</span>
          </div>

          <div className="student-video-card mt-6">
            <div className="student-video-scene">
              <div className="professor-portrait">
                <div className="professor-head" />
                <div className="professor-body" />
                <div className="professor-arm professor-arm-left" />
                <div className="professor-arm professor-arm-right" />
              </div>
              <div className="lesson-board">
                <h2>Andragogia no Ensino Superior</h2>
                <ul>
                  <li>Autonomia</li>
                  <li>Experiência prévia</li>
                  <li>Aplicação prática</li>
                  <li>Motivação</li>
                  <li>Aprendizagem significativa</li>
                </ul>
              </div>
              <div className="video-brand">EduNexus</div>
            </div>

            <div className="px-4 pb-5 md:px-6">
              <div className="h-1 rounded-full bg-white/15">
                <div className="h-1 w-[24%] rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />
              </div>
              <div className="student-video-controls mt-4 flex items-center gap-4 text-white">
                <button
                  type="button"
                  onClick={() => track("aluno_play_video")}
                  className="text-xl"
                  aria-label="Reproduzir aula"
                >
                  ▶
                </button>
                <div className="h-1 min-w-[96px] flex-1 rounded-full bg-white/10 sm:max-w-[210px]">
                  <div className="h-1 w-2/3 rounded-full bg-violet-400" />
                </div>
                <span className="ml-auto text-sm text-slate-300">06:47 / 28:00</span>
              </div>
            </div>
          </div>

          <section className="mt-6">
            <h2 className="text-xl font-black text-white">Conteúdos adaptados</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <StudentAdaptedTab
                active={activeContent === "infographic"}
                guideActive={guideStep === 3}
                onGuideNext={onGuideNext}
                title="Infográfico"
                text="Visualize os principais conceitos desta aula."
                onClick={() => selectContent("infographic")}
              />
              <StudentAdaptedTab
                active={activeContent === "summary"}
                guideActive={guideStep === 4}
                onGuideNext={onGuideNext}
                title="Resumo do vídeo"
                text="Leia um resumo adaptado com o essencial da aula."
                onClick={() => selectContent("summary")}
              />
            </div>
          </section>

          <div className="mt-5 transition-all duration-300">
            {activeContent === "infographic" ? (
              <StudentInfographic />
            ) : (
              <StudentSummary track={track} />
            )}
          </div>
        </div>

        <aside className="space-y-5 lg:pt-[122px]">
          <div className="rounded-xl border border-white/15 bg-white/[0.055] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
            <h2 className="text-xl font-black text-white">Seu progresso</h2>
            <div className="mt-6 flex items-center gap-5">
              <div className="progress-ring" style={{ "--progress": "32%" } as CSSProperties}>
                <span>32%</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-300">do módulo concluído</p>
                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div className="h-2 w-[42%] rounded-full bg-cyan-400" />
                </div>
                <p className="mt-4 text-sm text-slate-400">4 de 12 aulas</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/[0.055] p-5">
            <h3 className="font-black text-white">Impacto simulado</h3>
            <div className="mt-4 space-y-4">
              <ProgressItem label="Atenção" value={68} />
              <ProgressItem label="Compreensão" value={74} />
              <ProgressItem label="Pronto para quiz" value={58} />
            </div>
          </div>

          <button
            type="button"
            onClick={onGoManager}
            className="hidden w-full rounded-md border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10 lg:block"
          >
            Voltar para gestor
          </button>
        </aside>
      </main>
    </section>
  );
}

function StudentAdaptedTab({
  active,
  guideActive,
  onGuideNext,
  onClick,
  text,
  title,
}: {
  active: boolean;
  guideActive: boolean;
  onGuideNext: () => Promise<void>;
  onClick: () => void;
  text: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-[104px] rounded-xl border p-4 text-left transition duration-300 ${
        active
          ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_28px_rgba(14,165,233,0.16)]"
          : "border-white/12 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.065]"
      }`}
    >
      {guideActive && <GuideMarker onActivate={onGuideNext} />}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-white">{title}</h3>
          <p className="mt-2 text-sm leading-5 text-slate-300">{text}</p>
        </div>
        <span
          className={`mt-1 h-3 w-3 rounded-full ${
            active ? "bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.9)]" : "bg-white/20"
          }`}
        />
      </div>
    </button>
  );
}

function StudentSummary({
  track,
}: {
  track: (target: string, type?: ClickEventPayload["type"]) => Promise<void>;
}) {
  return (
    <article className="rounded-xl border border-white/15 bg-white/[0.055] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-black text-white">Resumo do vídeo</h2>
        <button
          type="button"
          onClick={() => track("aluno_copiar_resumo")}
          className="min-h-10 rounded-md border border-white/15 px-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
        >
          Copiar resumo
        </button>
      </div>
      <p className="mt-4 text-base leading-8 text-slate-300">
        Esta aula apresenta o impacto da Andragogia no Ensino Superior, destacando
        como os princípios da aprendizagem de adultos transformam a experiência
        educacional. A andragogia valoriza a autonomia do estudante, reconhece a
        experiência prévia como recurso de aprendizagem e prioriza a aplicação prática
        do conhecimento. No ensino superior, essa abordagem torna as aulas mais
        significativas, melhora o engajamento e aproxima teoria e realidade
        profissional.
      </p>
    </article>
  );
}

function StudentInfographic() {
  const blocks = [
    {
      title: "Autonomia",
      text: "O adulto aprende melhor quando participa das decisões sobre seu aprendizado.",
    },
    {
      title: "Experiência prévia",
      text: "Vivências pessoais e profissionais ajudam a conectar teoria e prática.",
    },
    {
      title: "Aplicação prática",
      text: "O conteúdo precisa resolver problemas reais ou próximos da realidade do aluno.",
    },
    {
      title: "Motivação",
      text: "Adultos se engajam mais quando entendem a utilidade do que estão estudando.",
    },
    {
      title: "Ensino superior",
      text: "A andragogia torna a aula mais ativa, contextualizada e significativa.",
    },
  ];

  return (
    <article className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.055] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] md:p-6">
      <h2 className="text-xl font-black text-white">Infográfico da aula</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {blocks.map((block, index) => (
          <div key={block.title} className="relative">
            {index > 0 && (
              <span className="absolute -left-3 top-9 hidden h-px w-3 bg-cyan-300/50 md:block" />
            )}
            <div className="h-full rounded-xl border border-white/15 bg-slate-950/35 p-4">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-300 text-sm font-black text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 font-black text-white">{block.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{block.text}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function LegacyStudentLearningView({
  onGoManager,
  track,
  shareLink,
}: {
  onGoManager: () => void;
  track: (target: string, type?: ClickEventPayload["type"]) => Promise<void>;
  shareLink: () => void;
}) {
  return (
    <section className="student-learning-shell min-h-screen overflow-hidden">
      <header className="relative z-10 border-b border-white/10 bg-[#050b1d]/90">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6 md:py-5">
          <div className="flex items-center gap-3">
            <div className="student-logo-mark" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div>
              <p className="bg-gradient-to-r from-blue-500 to-cyan-300 bg-clip-text text-3xl font-black leading-none text-transparent">
                EduNexus
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                Conecta · Dissemina · Transforma
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-10 text-sm font-bold text-slate-200 lg:flex">
            <span>Início</span>
            <span>Meus Cursos</span>
            <span>Biblioteca</span>
            <span>Analytics</span>
            <button
              type="button"
              onClick={onGoManager}
              className="rounded-full border border-violet-400/70 px-3 py-1 text-violet-200"
            >
              Gestor
            </button>
            <button
              type="button"
              onClick={shareLink}
              className="rounded-full border border-cyan-400/70 px-3 py-1 text-cyan-200"
            >
              Copiar link aluno
            </button>
          </nav>

          <div className="flex w-full items-center justify-between gap-4 md:w-auto md:justify-end md:gap-5">
            <div className="flex gap-2 lg:hidden">
              <button
                type="button"
                onClick={onGoManager}
                className="min-h-10 rounded-full border border-violet-400/70 px-3 text-xs font-bold text-violet-200"
              >
                Gestor
              </button>
              <button
                type="button"
                onClick={shareLink}
                className="min-h-10 rounded-full border border-cyan-400/70 px-3 text-xs font-bold text-cyan-200"
              >
                Link aluno
              </button>
            </div>
            <button className="hidden text-2xl text-white md:block" type="button" aria-label="Buscar">
              ⌕
            </button>
            <button className="relative hidden text-xl text-white md:block" type="button" aria-label="Notificações">
              ◇
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-violet-500" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full border border-cyan-300/40 bg-gradient-to-br from-amber-200 to-slate-700" />
              <div className="hidden md:block">
                <p className="text-sm font-black text-white">Lucas Andrade</p>
                <p className="text-xs text-slate-400">Estudante</p>
              </div>
              <span className="text-slate-300">⌄</span>
            </div>
          </div>
        </div>
      </header>

      <div className="student-network-bg" aria-hidden="true" />

      <main className="relative z-10 mx-auto grid max-w-[1180px] gap-6 px-5 py-6 lg:grid-cols-[1fr_278px] lg:gap-8 lg:px-0">
        <div>
          <div className="text-sm text-slate-300">
            Meus Cursos <span className="mx-2 text-slate-500">›</span> Metodologias Ativas e
            Andragogia <span className="mx-2 text-slate-500">›</span> Módulo 1
          </div>

          <h1 className="mt-4 text-3xl font-black leading-tight tracking-normal md:text-4xl">
            <span className="text-violet-400">Aula 1:</span> O impacto da{" "}
            <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
              Andragogia no Ensino Superior
            </span>
          </h1>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
            <span>Profª Dra. Camila Rezende</span>
            <span>Módulo 1 - Fundamentos da Andragogia</span>
            <span>28 min</span>
          </div>

          <div className="student-video-card mt-6">
            <div className="student-video-scene">
              <div className="professor-portrait">
                <div className="professor-head" />
                <div className="professor-body" />
                <div className="professor-arm professor-arm-left" />
                <div className="professor-arm professor-arm-right" />
              </div>
              <div className="lesson-board">
                <h2>Andragogia no Ensino Superior</h2>
                <ul>
                  <li>Autonomia</li>
                  <li>Experiência prévia</li>
                  <li>Aplicação prática</li>
                  <li>Motivação</li>
                  <li>Aprendizagem significativa</li>
                </ul>
              </div>
              <div className="video-brand">EduNexus</div>
            </div>

            <div className="px-6 pb-5">
              <div className="h-1 rounded-full bg-white/15">
                <div className="h-1 w-[24%] rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" />
              </div>
              <div className="student-video-controls mt-4 flex items-center gap-5 text-white">
                <button
                  type="button"
                  onClick={() => track("aluno_play_video")}
                  className="text-xl"
                  aria-label="Reproduzir aula"
                >
                  ▶
                </button>
                <span className="text-lg">▮▮</span>
                <span className="text-lg">●</span>
                <div className="h-1 w-40 rounded-full bg-white/10">
                  <div className="h-1 w-2/3 rounded-full bg-violet-400" />
                </div>
                <span className="ml-auto text-sm text-slate-300">06:47 / 28:00</span>
                <span>⚙</span>
                <span>⛶</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="flex items-center gap-3 text-xl font-black">
              <span className="text-violet-400">✦</span>
              Conteúdos adaptados
            </h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <AdaptedContentOption
                active={false}
                icon="◎"
                title="Infográfico"
                text="Visualize os principais conceitos desta aula."
              />
              <AdaptedContentOption
                active
                icon="▤"
                title="Resumo do vídeo"
                text="Leia um resumo adaptado com o essencial da aula."
              />
            </div>
          </div>

          <article className="mt-5 rounded-xl border border-white/15 bg-white/[0.055] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-black text-white">Resumo do vídeo</h2>
              <button
                type="button"
                onClick={() => track("aluno_copiar_resumo")}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-slate-300"
              >
                Copiar resumo
              </button>
            </div>
            <p className="mt-4 text-base leading-8 text-slate-300">
              Esta aula apresenta o impacto da Andragogia no Ensino Superior,
              destacando como os princípios da aprendizagem de adultos transformam a
              experiência educacional. A andragogia valoriza a autonomia do estudante,
              reconhece a experiência prévia e prioriza recursos de aprendizagem com
              aplicação prática do conhecimento.
            </p>
          </article>
        </div>

        <aside className="space-y-5 pt-0 lg:pt-[128px]">
          <div className="rounded-xl border border-white/15 bg-white/[0.055] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
            <h2 className="text-xl font-black text-white">Seu progresso</h2>
            <div className="mt-7 flex items-center gap-5">
              <div className="progress-ring" style={{ "--progress": "32%" } as CSSProperties}>
                <span>32%</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-300">do módulo concluído</p>
                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div className="h-2 w-[42%] rounded-full bg-cyan-400" />
                </div>
                <p className="mt-4 text-sm text-slate-400">4 de 12 aulas</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/15 bg-white/[0.055] p-5">
            <h3 className="font-black text-white">Impacto simulado</h3>
            <div className="mt-4 space-y-4">
              <ProgressItem label="Atenção" value={68} />
              <ProgressItem label="Compreensão" value={74} />
              <ProgressItem label="Pronto para quiz" value={58} />
            </div>
          </div>
        </aside>
      </main>
    </section>
  );
}

function AdaptedContentOption({
  active,
  icon,
  text,
  title,
}: {
  active: boolean;
  icon: string;
  text: string;
  title: string;
}) {
  return (
    <article
      className={`flex min-h-[88px] items-center gap-5 rounded-xl border p-5 ${
        active
          ? "border-cyan-400 bg-cyan-400/5 shadow-[0_0_28px_rgba(14,165,233,0.12)]"
          : "border-white/15 bg-white/[0.045]"
      }`}
    >
      <span className="text-4xl text-violet-400">{icon}</span>
      <div>
        <h3 className="font-black text-white">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-slate-300">{text}</p>
      </div>
      <span className="ml-auto text-xl text-cyan-300">{active ? "●" : "›"}</span>
    </article>
  );
}

function LegacyStudentImpactView({
  track,
}: {
  track: (target: string, type?: ClickEventPayload["type"]) => Promise<void>;
}) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-7 md:px-8">
      <div className="grid gap-5 lg:grid-cols-[0.68fr_1.32fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-cobalt">
            Visão do aluno
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-normal">Lucas Andrade</h2>
          <p className="mt-2 leading-6 text-slate-600">
            Engenharia de Produção, perfil TDAH e visual. Objetivo: revisar conteúdo
            antes da avaliação em até 25 minutos por dia.
          </p>
          <div className="mt-6 space-y-4">
            <ProgressItem label="Atenção na aula" value={68} />
            <ProgressItem label="Compreensão estimada" value={74} />
            <ProgressItem label="Pronto para quiz" value={58} />
          </div>
          <button
            type="button"
            onClick={() => track("aluno_iniciar_aula_adaptada")}
            className="mt-6 min-h-12 w-full rounded-md bg-cobalt px-4 py-2 font-bold text-white transition hover:bg-blue-700"
          >
            Iniciar aula adaptada
          </button>
        </aside>

        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-[#101827] p-6 text-white shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">
                  Simulação de impacto
                </p>
                <h3 className="mt-2 text-2xl font-bold">A mesma aula em formatos diferentes</h3>
                <p className="mt-3 max-w-2xl leading-7 text-slate-300">
                  O aluno não vê um painel de gestão. Ele recebe uma aula organizada
                  para seu perfil, com blocos curtos, apoio visual, quiz e orientação
                  da Edu AI.
                </p>
              </div>
              <span className="rounded-full bg-mint px-3 py-1 text-sm font-bold text-slate-950">
                impacto esperado +31%
              </span>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <StudentCard
              title="Antes da adaptação"
              tone="muted"
              items={[
                "Videoaula linear de 18 minutos.",
                "Resumo genérico ao final.",
                "Aluno abandona no minuto 7.",
                "Dúvidas ficam invisíveis para o professor.",
              ]}
            />
            <StudentCard
              title="Depois com EduNexus"
              tone="active"
              items={[
                "Aula quebrada em blocos de 4 minutos.",
                "Mapa visual e resumo simplificado.",
                "Quiz rápido após cada bloco.",
                "Edu AI registra dúvidas e recomenda reforço.",
              ]}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold">Experiência adaptada exibida ao aluno</h3>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <AdaptationCard title="Modo TDAH" text="Conteúdo em ciclos curtos, foco único e reforço visual do próximo passo." />
              <AdaptationCard title="Modo visual" text="Mapa mental, indicadores de progresso e exemplos com hierarquia clara." />
              <AdaptationCard title="Edu AI" text="Explica a aula em linguagem simples e cria perguntas para revisão rápida." />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardMetric({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: "blue" | "amber" | "green" | "purple";
  value: string;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    purple: "bg-violet-50 text-violet-700 border-violet-100",
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="text-sm font-bold">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-normal">{value}</p>
      <p className="mt-2 text-sm font-semibold opacity-80">{detail}</p>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/8 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function RiskRow({ course, risk, status }: { course: string; risk: number; status: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="font-bold text-slate-800">{course}</p>
        <span className="text-sm font-bold text-slate-500">{status}</span>
      </div>
      <div className="mt-2 h-3 rounded-full bg-slate-100">
        <div
          className={`h-3 rounded-full ${risk > 25 ? "bg-amber-400" : "bg-mint"}`}
          style={{ width: `${risk}%` }}
        />
      </div>
      <p className="mt-1 text-sm text-slate-500">{risk}% dos alunos exigem acompanhamento.</p>
    </div>
  );
}

function RecommendationCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <h4 className="font-bold text-slate-900">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </article>
  );
}

function ProgressItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-bold text-slate-300">{label}</p>
        <span className="text-sm font-black text-cobalt">{value}%</span>
      </div>
      <div className="mt-2 h-3 rounded-full bg-white/10">
        <div className="h-3 rounded-full bg-cobalt" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function StudentCard({
  items,
  title,
  tone,
}: {
  items: string[];
  title: string;
  tone: "active" | "muted";
}) {
  return (
    <article
      className={`rounded-lg border p-5 shadow-sm ${
        tone === "active"
          ? "border-cyan-200 bg-cyan-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <h3 className="text-lg font-black">{title}</h3>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-6 text-slate-700">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cobalt" />
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

function AdaptationCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <h4 className="font-black text-slate-900">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </article>
  );
}

function LoginFeature({ title, text, icon }: { title: string; text: string; icon: string }) {
  return (
    <article className="min-h-[170px] rounded-xl border border-white/[0.12] bg-white/[0.045] p-5 text-center shadow-[0_12px_35px_rgba(0,0,0,0.18)] backdrop-blur">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-300/10 text-sm font-black text-cyan-300">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-extrabold leading-5 text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-2 text-3xl font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md bg-white/8 p-3 ring-1 ring-white/10">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-5 text-slate-300">{text}</p>
    </div>
  );
}

function ValidationCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 leading-6 text-slate-650">{text}</p>
    </article>
  );
}

export default App;
