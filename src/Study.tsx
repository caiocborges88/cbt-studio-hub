import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
  Trophy,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import {
  type Answer,
  type Challenge,
  type PublicActivity,
  type Session,
  typeLabels,
  canUploadAnswers,
} from "../shared/domain";
import { scoreSession } from "../shared/service";
import { useStudio } from "./context";
import { call, upload, openPrivateFile } from "./lib/api";
import { ActivityInput, emptyAnswer } from "./components/ActivityInput";
import { RichText, ReadAloud } from "./components/RichText";
import { useModal } from "./components/useModal";
interface SessionView {
  session: Session;
  activity: PublicActivity | null;
  current: number;
  challenge: Challenge | null;
  closed: boolean;
  review: { id: string; solution: string; explanation: string }[];
}
export function Study({ sessionId }: { sessionId: string }) {
  const { workspace: w, go, report, refresh, profile, account } = useStudio();
  const [data, setData] = useState<SessionView | null>(null);
  const [answer, setAnswer] = useState<Answer>("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [showMaterial, setShowMaterial] = useState(false);
  const [materialPage, setMaterialPage] = useState(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPath, setPhotoPath] = useState<string | undefined>();
  const [result, setResult] = useState<{
    correct: boolean | null;
    explanation: string;
    solution: string;
    pending: boolean;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const readingRef = useModal(showMaterial, () => setShowMaterial(false));
  const requestId = useRef<string | null>(null);
  const activityId = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const result = await call<SessionView>("session", {
      groupId: w.group.id,
      sessionId,
    });
    setData(result);
    setLoading(false);
  }, [w.group.id, sessionId]);
  useEffect(() => {
    let active = true;
    call<SessionView>("session", { groupId: w.group.id, sessionId })
      .then((r) => {
        if (active) {
          setData(r);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          report(e);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [load, report, w.group.id, sessionId]);
  useEffect(() => {
    if (!data?.challenge || data.closed) return;
    const timer = setInterval(() => {
      void load().catch(report);
    }, 3000);
    return () => clearInterval(timer);
  }, [data?.challenge?.id, data?.closed, load, report]);
  useEffect(() => {
    const a = data?.activity;
    if (a && activityId.current !== a.id) {
      activityId.current = a.id;
      const previous = data?.session.attempts
        .filter((v) => v.activityId === a.id)
        .at(-1);
      setAnswer(previous?.answer ?? emptyAnswer(a));
      setHint("");
      setPhoto(null);
      setPhotoPath(undefined);
      setResult(null);
      setRetrying(false);
      requestId.current = null;
    }
  }, [data?.activity?.id]);
  if (loading)
    return <div className="loading-panel">Préparando sua sessão...</div>;
  if (!data)
    return (
      <div className="panel">
        <h2>Não foi possível abrir a sessão.</h2>
        <button className="button secondary" onClick={() => go("home")}>
          Voltar ao início
        </button>
      </div>
    );
  const { session, activity: a, challenge, current, closed, review } = data;
  const lesson = w.lessons.find((l) => l.id === session.lessonId);
  const material = w.materials.find((m) => m.id === lesson?.materialId);
  const currentAttempts = a
    ? session.attempts.filter((v) => v.activityId === a.id)
    : [];
  const last = currentAttempts.at(-1);
  const alreadySubmitted = !!last && !retrying;
  const finished =
    closed ||
    (!challenge && session.finished) ||
    (challenge?.kind === "async" && session.finished);
  const effectiveResult =
    result ||
    (!challenge && last
      ? {
          correct: last.correct,
          explanation: last.feedback,
          solution: "",
          pending: last.review === "pending",
        }
      : null);
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!a) return;
    await task(async () => {
      const path =
        photoPath ||
        (photo ? await upload(w.group.id, "answers", photo) : undefined);
      if (path) setPhotoPath(path);
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const response = await call<{
        correct: boolean | null;
        explanation: string;
        solution: string;
        pending: boolean;
      }>(
        "submit",
        {
          groupId: w.group.id,
          sessionId,
          activityId: a.id,
          answer,
          ...(path ? { photoPath: path } : {}),
        },
        requestId.current,
      );
      requestId.current = null;
      setRetrying(false);
      if (!challenge) setResult(response);
      await load();
      await refresh();
    });
  }
  const hasAnswer =
    a?.type === "order" ||
    (typeof answer === "string"
      ? answer.trim().length > 0
      : typeof answer === "object"
        ? Object.keys(answer).length > 0
        : true) ||
    !!photo;
  if (finished)
    return (
      <div className="study-shell">
        <section className="panel completion">
          <span className="completion-icon">
            <Trophy size={38} />
          </span>
          <p className="eyebrow">MAIS UM PASSO NA SUA JORNADA</p>
          <h1>
            {challenge && !closed
              ? "Participação registrada."
              : "Você chegou até aqui!"}
          </h1>
          <p>
            {challenge && !closed
              ? "Os resultados serão liberados quando o desafio encerrar."
              : "Cada atividade é uma oportunidade de construir conhecimento."}
          </p>
          {(!challenge || closed) && (
            <strong className="completion-score">
              {scoreSession(session)} <span>pontos pessoais</span>
            </strong>
          )}
          <div className="inline-actions centered">
            <button className="button primary" onClick={() => go("library")}>
              Explorar outras trilhas
              <ArrowRight size={17} />
            </button>
            <button className="button secondary" onClick={() => go("progress")}>
              Ver meu progresso
            </button>
          </div>
        </section>
        {review.length > 0 && (
          <section className="panel">
            <h3>Revisite suas descobertas</h3>
            {review.map((r, i) => (
              <details key={r.id}>
                <summary>Atividade {i + 1} · solução e explicação</summary>
                <RichText>{r.solution}</RichText>
                <RichText>{r.explanation}</RichText>
              </details>
            ))}
          </section>
        )}
      </div>
    );
  return (
    <div className="study-shell">
      <div className="study-top">
        <button
          className="text-button"
          onClick={() => go(challenge ? "challenges" : "home")}
        >
          <ArrowLeft size={17} />
          Sair e continuar depois
        </button>
        <span className="pill">
          {challenge
            ? challenge.kind === "live"
              ? "Sala ao vivo"
              : "Desafio privado"
            : "No seu ritmo"}
        </span>
      </div>
      <div className="study-heading">
        <div>
          <p className="eyebrow">{lesson?.subject || "SESSÃO DE ESTUDO"}</p>
          <h2>{lesson?.title || "Sua jornada"}</h2>
        </div>
        <span className="muted small">
          Atividade {Math.min(current + 1, session.activityIds.length)} de{" "}
          {session.activityIds.length}
        </span>
      </div>
      <progress
        className="session-progress"
        max={session.activityIds.length}
        value={current}
      />
      {profile.theme === "playful" && !challenge && (
        <ol className="journey-map" aria-label="Mapa de descobertas da sessão">
          {session.activityIds.map((id, i) => (
            <li
              key={id}
              aria-current={i === current ? "step" : undefined}
              className={
                i < current ? "complete" : i === current ? "current" : "locked"
              }
            >
              <span>{i < current ? <CheckCircle2 size={19} /> : i + 1}</span>
              <small>
                {i < current
                  ? "Descoberta"
                  : i === current
                    ? "Você está aqui"
                    : "Próximo passo"}
              </small>
            </li>
          ))}
        </ol>
      )}
      {!a ? (
        <section className="panel waiting">
          <ClockIcon />
          <h2>
            {challenge?.status === "waiting"
              ? "Sua sala está pronta."
              : "Aguardando o próximo passo."}
          </h2>
          <p>O organizador controla o início e o avanço das atividades.</p>
          <button
            className="button secondary"
            onClick={() => load().catch(report)}
          >
            <RefreshCw size={16} />
            Atualizar sala
          </button>
        </section>
      ) : (
        <section className="panel question-panel">
          <div className="section-heading compact">
            <span className="activity-type">
              <span className="stat-icon green">
                <BookOpen size={18} />
              </span>
              {typeLabels[a.type]}
            </span>
            <ReadAloud text={a.prompt} />
          </div>
          <div className="question-prompt">
            <RichText>{a.prompt}</RichText>
          </div>
          {a.source && (
            <span className="source-badge">
              Material de estudo · página {a.source.page}
            </span>
          )}
          <ActivityInput
            key={a.id}
            activity={a}
            answer={answer}
            onChange={(value) => {
              setAnswer(value);
              requestId.current = null;
            }}
            disabled={busy || alreadySubmitted}
            onPhoto={
              a.type === "open" &&
              canUploadAnswers(profile, account.adult, w.role)
                ? (file) => {
                    setPhoto(file);
                    setPhotoPath(undefined);
                    requestId.current = null;
                  }
                : undefined
            }
          />
          {a.type === "open" &&
            !canUploadAnswers(profile, account.adult, w.role) && (
              <p className="small muted">
                Neste perfil, arquivos devem ser enviados pelo responsável ou
                professor, pelo acompanhamento das respostas.
              </p>
            )}
          {photo && <p className="small muted">Anexo: {photo.name}</p>}
          {hint && (
            <div className="hint-box">
              <Lightbulb size={19} />
              <RichText>{hint}</RichText>
            </div>
          )}
          {alreadySubmitted &&
            (!challenge && effectiveResult ? (
              <div
                className={
                  "answer-feedback " +
                  (effectiveResult.correct
                    ? "correct"
                    : effectiveResult.pending
                      ? "pending"
                      : "try-again")
                }
                role="status"
              >
                <strong>
                  {effectiveResult.correct ? (
                    <>
                      <CheckCircle2 size={19} />
                      Você acertou!
                    </>
                  ) : effectiveResult.pending ? (
                    "Resposta recebida para avaliação."
                  ) : (
                    "Uma nova oportunidade de entender."
                  )}
                </strong>
                <RichText>{effectiveResult.explanation}</RichText>
                {effectiveResult.solution && !effectiveResult.pending && (
                  <details>
                    <summary>Conferir resposta</summary>
                    <RichText>{effectiveResult.solution}</RichText>
                  </details>
                )}
              </div>
            ) : (
              <div className="hint-box" role="status">
                <CheckCircle2 size={20} />
                Resposta registrada.{" "}
                {challenge?.kind === "live"
                  ? "Aguarde o organizador avançar."
                  : "Continue para a próxima atividade."}
              </div>
            ))}
          <div className="question-actions">
            <div className="inline-actions">
              {!challenge && !alreadySubmitted && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    task(async () => {
                      const result = await call<{ hint: string }>("hint", {
                        groupId: w.group.id,
                        sessionId,
                      });
                      setHint(result.hint);
                    })
                  }
                >
                  <Lightbulb size={17} />
                  Preciso de uma dica
                </button>
              )}
              {material && (
                <button
                  className="text-button"
                  onClick={() => {
                    const sourceIndex = material.pages.findIndex(
                      (p) => p.number === a.source?.page,
                    );
                    setMaterialPage(sourceIndex >= 0 ? sourceIndex : 0);
                    setShowMaterial(true);
                  }}
                >
                  <BookOpen size={17} />
                  Consultar material
                </button>
              )}
            </div>
            {!alreadySubmitted ? (
              <button
                className="button primary"
                disabled={busy || !hasAnswer}
                onClick={submit}
              >
                {busy ? "Registrando..." : "Confirmar resposta"}
                <CheckCircle2 size={17} />
              </button>
            ) : !challenge ? (
              <div className="inline-actions">
                {last?.correct === false && last.review === "none" && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      setRetrying(true);
                      setResult(null);
                      requestId.current = null;
                    }}
                  >
                    Tentar novamente
                    <RefreshCw size={16} />
                  </button>
                )}
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    task(async () => {
                      await call("advance", { groupId: w.group.id, sessionId });
                      await load();
                      await refresh();
                    })
                  }
                >
                  Continuar
                  <ArrowRight size={17} />
                </button>
              </div>
            ) : challenge.kind === "async" ? (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => load().catch(report)}
              >
                Próxima atividade
                <ArrowRight size={17} />
              </button>
            ) : null}
          </div>
        </section>
      )}
      {profile.theme === "playful" && (
        <p className="study-encouragement">
          ✦ Entender leva prática. Cada tentativa conta.
        </p>
      )}
      {showMaterial && material && (
        <div className="modal-backdrop">
          <section
            ref={readingRef}
            tabIndex={-1}
            className="modal reading-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reading-title"
          >
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">MATERIAL DE ESTUDO</p>
                <h2 id="reading-title">{material.title}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Fechar material"
                onClick={() => setShowMaterial(false)}
              >
                <X size={22} />
              </button>
            </div>
            <div className="reading-toolbar">
              <button
                className="icon-button"
                aria-label="Página anterior"
                disabled={materialPage === 0}
                onClick={() => setMaterialPage(materialPage - 1)}
              >
                <ChevronLeft size={20} />
              </button>
              <label>
                Página
                <select
                  value={materialPage}
                  onChange={(e) => setMaterialPage(Number(e.target.value))}
                >
                  {material.pages.map((p, i) => (
                    <option key={p.number} value={i}>
                      {p.number}
                      {p.chapter ? " · " + p.chapter : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="icon-button"
                aria-label="Próxima página"
                disabled={materialPage === material.pages.length - 1}
                onClick={() => setMaterialPage(materialPage + 1)}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <ReadAloud text={material.pages[materialPage].text} />
            <div className="reading-content">
              <RichText>{material.pages[materialPage].text}</RichText>
            </div>
            {material.storagePath && (
              <button
                className="text-button"
                onClick={() =>
                  openPrivateFile(w.group.id, material.storagePath!).catch(
                    report,
                  )
                }
              >
                Abrir PDF original em nova aba
                <ArrowRight size={16} />
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function ClockIcon() {
  return (
    <div className="completion-icon">
      <RefreshCw size={34} />
    </div>
  );
}
