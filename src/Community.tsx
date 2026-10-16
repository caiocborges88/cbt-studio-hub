import { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Copy,
  ShieldCheck,
  Trophy,
  Play,
  ArrowRight,
  CheckCircle2,
  Clock3,
  BarChart3,
  Sparkles,
  X,
  Eye,
  RefreshCw,
} from "lucide-react";
import {
  type Challenge,
  type Invite,
  type Profile,
  type Stage,
  stages,
  stageLabels,
} from "../shared/domain";
import { scoreSession } from "../shared/service";
import { useStudio } from "./context";
import { PageHeading, Empty } from "./pages";
import { call, openPrivateFile, upload } from "./lib/api";
import { RichText } from "./components/RichText";
import { useModal } from "./components/useModal";
export function Groups() {
  const { workspace: w, account, run, report, notify } = useStudio();
  const [nickname, setNickname] = useState("");
  const [stage, setStage] = useState<Stage>("fundamental-inicial");
  const [ageBand, setAgeBand] =
    useState<NonNullable<Profile["ageBand"]>>("up-to-14");
  const [role, setRole] = useState("student");
  const [child, setChild] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
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
  const owned = w.profiles.filter(
    (p) => p.child && p.guardianUid === account.uid,
  );
  return (
    <div>
      <PageHeading
        eyebrow="APRENDER EM BOA COMPANHIA"
        title="Meu grupo"
        text="Um espaço privado para organizar materiais, acompanhar estudantes e compartilhar descobertas."
      />
      <section className="panel">
        <div className="section-heading compact">
          <div>
            <h2>{w.group.title}</h2>
            <span className="small muted">
              Seu papel:{" "}
              {w.role === "admin"
                ? "administrador"
                : w.role === "educator"
                  ? "educador"
                  : "estudante"}
            </span>
          </div>
          <span className="pill">
            <ShieldCheck size={15} />
            Grupo privado
          </span>
        </div>
        <div className="members-grid">
          {w.profiles.map((p) => (
            <div className="member-card" key={p.id}>
              <span className="profile-avatar">{p.avatar}</span>
              <div>
                <strong>{p.nickname}</strong>
                <p className="small muted">{stageLabels[p.stage]}</p>
                <span className="small">
                  {p.child
                    ? "Perfil sob responsabilidade de adulto"
                    : "Conta própria"}
                </span>
                {p.child && w.role !== "student" && (
                  <label className="small">
                    Faixa de idade
                    <select
                      aria-label={"Faixa de idade de " + p.nickname}
                      value={p.ageBand || "up-to-14"}
                      disabled={busy}
                      onChange={(e) =>
                        void task(async () => {
                          await run("setProfileAgeBand", {
                            profileId: p.id,
                            ageBand: e.target.value,
                          });
                          notify(
                            "Faixa de idade atualizada pelo responsável ou professor.",
                          );
                        })
                      }
                    >
                      <option value="up-to-14">
                        Até 14 anos · arquivos enviados por adulto
                      </option>
                      <option value="15-plus">15 anos ou mais</option>
                    </select>
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      {w.role !== "student" && (
        <>
          <div className="bottom-grid">
            <section className="panel">
              <h3>Adicionar perfil infantil</h3>
              <p className="small muted">
                O perfil fica sob sua responsabilidade e pode estudar neste
                dispositivo ou entrar por convite.
              </p>
              <label>
                Apelido
                <input
                  value={nickname}
                  maxLength={80}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </label>
              <label>
                Etapa
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as Stage)}
                >
                  {stages.map((s) => (
                    <option value={s} key={s}>
                      {stageLabels[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Faixa de idade do novo perfil
                <select
                  value={ageBand}
                  onChange={(e) =>
                    setAgeBand(
                      e.target.value as NonNullable<Profile["ageBand"]>,
                    )
                  }
                >
                  <option value="up-to-14">
                    Até 14 anos · arquivos enviados por adulto
                  </option>
                  <option value="15-plus">15 anos ou mais</option>
                </select>
              </label>
              <button
                className="button primary"
                disabled={busy || !nickname.trim()}
                onClick={() =>
                  task(async () => {
                    await run("createProfile", { nickname, stage, ageBand });
                    setNickname("");
                    notify(
                      "Perfil criado. Você pode selecioná-lo no topo da página.",
                    );
                  })
                }
              >
                <Plus size={16} />
                Criar perfil
              </button>
            </section>
            <section className="panel">
              <h3>Convidar para o grupo</h3>
              <label>
                Apelido do convidado
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={80}
                />
              </label>
              <label>
                Papel
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="student">Estudante</option>
                  {w.role === "admin" && (
                    <option value="educator">Educador</option>
                  )}
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={child}
                  disabled={role === "educator"}
                  onChange={(e) => setChild(e.target.checked)}
                />
                Entrar sem e-mail com perfil infantil
              </label>
              {child && role === "student" && (
                <label>
                  Perfil
                  <select
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {owned.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.nickname}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                className="button primary"
                disabled={busy || !nickname.trim() || (child && !profileId)}
                onClick={() =>
                  task(async () => {
                    const result = await run<Invite & { code: string }>(
                      "invite",
                      {
                        nickname,
                        role,
                        child: child && role === "student",
                        ...(child && profileId ? { profileId } : {}),
                      },
                    );
                    setCode(result.code);
                    notify(
                      "Convite criado. Copie o código antes de sair desta tela.",
                    );
                  })
                }
              >
                <Users size={16} />
                Gerar convite privado
              </button>
            </section>
          </div>
          {code && (
            <section className="panel invite-code">
              <div className="section-heading compact">
                <h3>Convite pronto · válido por 7 dias</h3>
                <button
                  className="icon-button"
                  aria-label="Fechar código de convite"
                  onClick={() => setCode("")}
                >
                  <X size={17} />
                </button>
              </div>
              <p className="small muted">
                Código de uso único. Envie diretamente à pessoa convidada; ela
                escolhe “Tenho um convite” na entrada.
              </p>
              <code>{code}</code>
              <button
                className="button secondary"
                onClick={() =>
                  navigator.clipboard
                    .writeText(code)
                    .then(() => notify("Código copiado."))
                    .catch(report)
                }
              >
                <Copy size={16} />
                Copiar código
              </button>
            </section>
          )}
          <section className="panel">
            <h3>Convites e acessos</h3>
            {!w.invites.length ? (
              <p className="muted">Nenhum convite criado.</p>
            ) : (
              w.invites.map((inv) => (
                <div className="list-row" key={inv.id}>
                  <div className="grow">
                    <strong>{inv.nickname}</strong>
                    <span className="small muted">
                      {inv.role === "educator" ? "Educador" : "Estudante"} ·{" "}
                      {inv.revoked
                        ? "Revogado"
                        : inv.used
                          ? "Aceito"
                          : inv.expiresAt < Date.now()
                            ? "Expirado"
                            : "Aguardando"}
                    </span>
                  </div>
                  {!inv.revoked && (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        task(async () => {
                          await run("revokeInvite", { inviteId: inv.id });
                          notify(
                            "Convite revogado e acesso vinculado desativado.",
                          );
                        })
                      }
                    >
                      Revogar acesso
                    </button>
                  )}
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
export function Challenges() {
  const { workspace: w, run, start, report, notify } = useStudio();
  const [title, setTitle] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [kind, setKind] = useState<"async" | "live">("async");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
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
  return (
    <div>
      <PageHeading
        eyebrow="DESAFIOS QUE CONECTAM"
        title="Desafios do grupo"
        text="Compartilhe o desafio. Cada acerto vale o mesmo, sem corrida contra o relógio."
      />
      {w.role !== "student" && (
        <details className="panel">
          <summary>
            <Plus size={17} /> Criar desafio
          </summary>
          <div className="form-grid">
            <label>
              Título
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Desafio de interpretação"
              />
            </label>
            <label>
              Trilha
              <select
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
              >
                <option value="">Selecione uma trilha publicada</option>
                {w.lessons
                  .filter((l) => l.published)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Formato
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "async" | "live")}
              >
                <option value="async">Cada um no seu horário</option>
                <option value="live">Sala ao vivo com organizador</option>
              </select>
            </label>
            <label>
              Encerramento
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
          </div>
          <button
            className="button primary"
            disabled={busy || !title || !lessonId || !deadline}
            onClick={() =>
              task(async () => {
                await run("createChallenge", {
                  title,
                  lessonId,
                  kind,
                  deadline: new Date(deadline).getTime(),
                });
                setTitle("");
                notify("Desafio criado para o grupo.");
              })
            }
          >
            <Trophy size={17} />
            Criar desafio
          </button>
        </details>
      )}
      {!w.challenges.length ? (
        <Empty
          title="Um novo desafio vem aí"
          text="O organizador pode criar um desafio por prazo ou uma sala ao vivo."
        />
      ) : (
        <div className="challenge-grid">
          {[...w.challenges].reverse().map((c) => (
            <article className="panel challenge-card" key={c.id}>
              <div className="section-heading compact">
                <span className="stat-icon gold">
                  <Trophy size={22} />
                </span>
                <span
                  className={"pill " + (c.status === "active" ? "live" : "")}
                >
                  {c.status === "closed"
                    ? "Encerrado"
                    : c.status === "waiting"
                      ? "Aguardando início"
                      : c.kind === "live"
                        ? "Ao vivo"
                        : "Aberto"}
                </span>
              </div>
              <h3>{c.title}</h3>
              <p className="muted">
                {w.lessons.find((l) => l.id === c.lessonId)?.title}
              </p>
              <p className="small muted">
                <Clock3 size={14} /> Até{" "}
                {new Date(c.deadline).toLocaleString("pt-BR")}
              </p>
              <div className="inline-actions">
                {c.status !== "closed" && (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => {
                      const l = w.lessons.find((l) => l.id === c.lessonId);
                      if (l)
                        start(l, "challenge", { challengeId: c.id }).catch(
                          report,
                        );
                    }}
                  >
                    <Play size={16} />
                    Participar
                  </button>
                )}
                <button
                  className="button secondary"
                  onClick={() => setSelected(c.id)}
                >
                  <Eye size={16} />
                  {c.status === "closed" ? "Ver resultados" : "Acompanhar sala"}
                </button>
              </div>
              {w.role !== "student" && c.status !== "closed" && (
                <div className="host-controls">
                  <span className="eyebrow">CONTROLES DO ORGANIZADOR</span>
                  <div className="inline-actions">
                    {c.kind === "live" && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          task(async () => {
                            await run("controlChallenge", {
                              challengeId: c.id,
                              command:
                                c.status === "waiting" ? "start" : "next",
                            });
                          })
                        }
                      >
                        {c.status === "waiting"
                          ? "Iniciar sala"
                          : "Próxima atividade"}
                        <ArrowRight size={16} />
                      </button>
                    )}
                    <button
                      className="text-button danger"
                      disabled={busy}
                      onClick={() =>
                        task(async () => {
                          await run("controlChallenge", {
                            challengeId: c.id,
                            command: "close",
                          });
                        })
                      }
                    >
                      Encerrar desafio
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {selected && (
        <Leaderboard challengeId={selected} close={() => setSelected(null)} />
      )}
    </div>
  );
}
export function Leaderboard({
  challengeId,
  close,
}: {
  challengeId: string;
  close: () => void;
}) {
  const modalRef = useModal(true, close);
  const { workspace: w, report } = useStudio();
  const [result, setResult] = useState<{
    participants: number;
    answered: number;
    scores: {
      profileId: string;
      nickname: string;
      points: number;
      rank: number;
    }[];
  } | null>(null);
  useEffect(() => {
    let active = true;
    const load = () =>
      call<typeof result>("leaderboard", { groupId: w.group.id, challengeId })
        .then((r) => {
          if (active) setResult(r);
        })
        .catch((e) => {
          if (active) report(e);
        });
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [challengeId, w.group.id, report]);
  return (
    <div className="modal-backdrop">
      <section
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-title"
        className="modal panel"
      >
        <div className="section-heading compact">
          <h2 id="leaderboard-title">Desafio do grupo</h2>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Fechar resultados"
          >
            <X size={20} />
          </button>
        </div>
        {result ? (
          <>
            <p>
              {result.participants} participantes
              {!result.scores.length
                ? " · " + result.answered + " responderam à rodada atual"
                : ""}
            </p>
            {result.scores.length ? (
              <ol className="ranking-list">
                {result.scores.map((s) => (
                  <li key={s.profileId}>
                    <span className="rank-number">{s.rank}º</span>
                    <strong className="grow">{s.nickname}</strong>
                    <span>{s.points} pontos</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">
                O placar e as explicações serão liberados no encerramento.
                Empates são mantidos.
              </p>
            )}
          </>
        ) : (
          <p>Carregando...</p>
        )}
      </section>
    </div>
  );
}
export function Progress() {
  const { workspace: w, profile, run, report, notify } = useStudio();
  const [selected, setSelected] = useState(profile.id);
  const [busy, setBusy] = useState(false);
  const sessions = w.sessions.filter((s) => s.profileId === selected);
  const attempts = sessions
    .filter(
      (s) =>
        s.mode !== "challenge" ||
        w.challenges.find((c) => c.id === s.challengeId)?.status === "closed",
    )
    .flatMap((s) => s.attempts);
  const skills = [...new Set(attempts.map((a) => a.skill))];
  const independent = attempts.filter(
    (a) => a.correct && !a.usedHint && a.tries === 1,
  ).length;
  const helped = attempts.filter(
    (a) => a.correct && (a.usedHint || a.tries > 1),
  ).length;
  const concepts = new Set(
    attempts.filter((a) => a.correct).map((a) => a.activityId),
  ).size;
  const pending = w.sessions.flatMap((s) =>
    s.attempts
      .filter((a) => a.review === "pending")
      .map((a) => ({ session: s, attempt: a })),
  );
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
  return (
    <div>
      <PageHeading
        eyebrow="CADA PASSO CONTA"
        title="Progresso e descobertas"
        text="Observe o que está se consolidando e o que merece uma nova visita."
      />
      <section className="panel">
        <label>
          Acompanhar perfil
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {w.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon green">
            <CheckCircle2 />
          </span>
          <div>
            <strong>{independent}</strong>
            <span>Acertos sem ajuda</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon gold">
            <Sparkles />
          </span>
          <div>
            <strong>{helped}</strong>
            <span>Acertos com apoio</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon purple">
            <BarChart3 />
          </span>
          <div>
            <strong>
              {attempts.filter((a) => !a.correct && a.review === "none").length}
            </strong>
            <span>Tentativas para revisar</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon blue">
            <Clock3 />
          </span>
          <div>
            <strong>{sessions.filter((s) => s.finished).length}</strong>
            <span>Sessões concluídas</span>
          </div>
        </div>
      </div>
      <section className="panel">
        <h3>Conquistas pessoais</h3>
        <div className="achievement-grid">
          {[
            {
              title: "Primeira jornada",
              text: "Concluir uma sessão de estudo.",
              earned: sessions.some((s) => s.finished),
            },
            {
              title: "Cinco descobertas",
              text: "Consolidar cinco atividades diferentes.",
              earned: concepts >= 5,
            },
            {
              title: "Conhecimento em expansão",
              text: "Consolidar vinte atividades diferentes.",
              earned: concepts >= 20,
            },
          ].map((badge) => (
            <div
              key={badge.title}
              className={"achievement " + (badge.earned ? "earned" : "")}
            >
              <Trophy size={25} />
              <strong>{badge.title}</strong>
              <span>{badge.text}</span>
              <small>{badge.earned ? "Conquistada" : "Em construção"}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h3>Habilidades em construção</h3>
        {skills.length ? (
          skills.map((skill) => {
            const list = attempts.filter((a) => a.skill === skill);
            const correct = list.filter((a) => a.correct).length;
            return (
              <div className="skill-row" key={skill}>
                <strong>{skill}</strong>
                <progress value={correct} max={list.length} />
                <span className="small muted">
                  {correct}/{list.length} tentativas corretas
                </span>
              </div>
            );
          })
        ) : (
          <p className="muted">
            Pratique uma atividade para começar a acompanhar suas habilidades.
          </p>
        )}
      </section>
      <section className="panel">
        <h3>Histórico de sessões</h3>
        {sessions.length ? (
          sessions
            .slice()
            .reverse()
            .map((s) => (
              <div className="list-row" key={s.id}>
                <div className="grow">
                  <strong>
                    {w.lessons.find((l) => l.id === s.lessonId)?.title ||
                      "Trilha anterior"}
                  </strong>
                  <span className="small muted">
                    {new Date(s.createdAt).toLocaleString("pt-BR")} ·{" "}
                    {s.mode === "challenge"
                      ? "Desafio"
                      : s.mode === "practice"
                        ? "Prática livre"
                        : "Jornada"}
                  </span>
                </div>
                <span className="pill">
                  {s.finished ? "Concluída" : "Em andamento"}
                </span>
                <span>
                  {s.mode === "challenge" &&
                  w.challenges.find((c) => c.id === s.challengeId)?.status !==
                    "closed"
                    ? "Aguardando encerramento"
                    : scoreSession(s) + " pontos"}
                </span>
              </div>
            ))
        ) : (
          <p className="muted">Seu histórico aparecerá aqui.</p>
        )}
      </section>
      {w.role !== "student" && (
        <section className="panel">
          <h3>Avaliações pendentes</h3>
          <p className="small muted">
            A IA sugere; o criador da atividade ou administrador confirma a
            avaliação.
          </p>
          {!pending.length ? (
            <p className="muted">
              Nenhuma resposta aberta aguardando avaliação.
            </p>
          ) : (
            pending.map(({ session, attempt: a }) => (
              <ReviewCard
                key={a.id}
                sessionId={session.id}
                attemptId={a.id}
                nickname={
                  w.profiles.find((p) => p.id === session.profileId)
                    ?.nickname || "Estudante"
                }
                answer={String(a.answer)}
                photo={a.photoPath}
                attachPhoto={(file) =>
                  task(async () => {
                    const photoPath = await upload(w.group.id, "answers", file);
                    await run("attachAnswerPhoto", {
                      sessionId: session.id,
                      attemptId: a.id,
                      photoPath,
                    });
                    notify(
                      "Foto anexada pelo responsável ou professor. Revise antes de avaliar.",
                    );
                  })
                }
                suggestion={a.suggestion}
                busy={busy}
                onPhoto={() => {
                  if (a.photoPath)
                    void openPrivateFile(w.group.id, a.photoPath).catch(report);
                }}
                suggest={() =>
                  task(async () => {
                    await run("enqueue", {
                      kind: "suggest",
                      input: { sessionId: session.id, attemptId: a.id },
                    });
                    notify(
                      "Sugestão solicitada. Confirme a avaliação quando estiver pronta.",
                    );
                  })
                }
                confirm={(points, feedback) =>
                  task(async () => {
                    await run("confirmReview", {
                      sessionId: session.id,
                      attemptId: a.id,
                      points,
                      feedback,
                    });
                    notify("Avaliação confirmada.");
                  })
                }
              />
            ))
          )}
        </section>
      )}
    </div>
  );
}
function ReviewCard({
  sessionId,
  attemptId,
  nickname,
  answer,
  photo,
  suggestion,
  busy,
  onPhoto,
  attachPhoto,
  suggest,
  confirm,
}: {
  sessionId: string;
  attemptId: string;
  nickname: string;
  answer: string;
  photo?: string;
  suggestion?: { points: number; feedback: string };
  busy: boolean;
  onPhoto: () => void;
  attachPhoto: (file: File) => void;
  suggest: () => void;
  confirm: (points: number, feedback: string) => void;
}) {
  const { workspace, report } = useStudio();
  const [context, setContext] = useState<{
    prompt: string;
    rubric: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    void call<{ prompt: string; rubric: string }>("reviewContext", {
      groupId: workspace.group.id,
      sessionId,
      attemptId,
    })
      .then((value) => {
        if (active) setContext(value);
      })
      .catch(report);
    return () => {
      active = false;
    };
  }, [workspace.group.id, sessionId, attemptId, report]);
  const [points, setPoints] = useState(suggestion?.points || 0);
  const [feedback, setFeedback] = useState(suggestion?.feedback || "");
  useEffect(() => {
    setPoints(suggestion?.points ?? 0);
    setFeedback(suggestion?.feedback ?? "");
  }, [suggestion?.points, suggestion?.feedback]);
  return (
    <article className="review-card">
      <h4>{nickname}</h4>
      {context && (
        <>
          <RichText>{context.prompt}</RichText>
          <details>
            <summary>Critérios de avaliação</summary>
            <RichText>{context.rubric}</RichText>
          </details>
        </>
      )}
      <p className="answer-quote">{answer || "Resposta em foto"}</p>
      {photo && (
        <button className="text-button" onClick={onPhoto}>
          <Eye size={16} />
          Ver foto privada
        </button>
      )}
      {!photo && (
        <label className="button secondary file-label">
          Anexar foto como responsável ou professor
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) attachPhoto(file);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {suggestion && (
        <p className="small muted">
          Sugestão de IA · revise antes de confirmar.
        </p>
      )}
      <div className="form-grid">
        <label>
          Pontos (0 a 100)
          <input
            type="number"
            min={0}
            max={100}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
          />
        </label>
        <label>
          Feedback
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </label>
      </div>
      <div className="inline-actions">
        <button
          className="button secondary"
          disabled={busy || !workspace.ai?.available}
          onClick={suggest}
        >
          <Sparkles size={16} />
          Pedir sugestão à IA
        </button>
        <button
          className="button primary"
          disabled={busy || !feedback.trim()}
          onClick={() => confirm(points, feedback)}
        >
          <CheckCircle2 size={16} />
          Confirmar avaliação
        </button>
      </div>
      {!workspace.ai?.available && (
        <p className="small muted">
          A sugestão de IA está pausada. Você pode avaliar a resposta e
          confirmar manualmente.
        </p>
      )}
    </article>
  );
}
