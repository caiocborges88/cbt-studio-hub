import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Layers3,
  Trophy,
  Target,
  Sparkles,
  CheckCircle2,
  Clock3,
  Play,
  ChevronRight,
  Plus,
  Search,
  Settings2,
  GraduationCap,
  Leaf,
} from "lucide-react";
import {
  type ActivityType,
  type Lesson,
  stageLabels,
  stages,
  typeLabels,
  type Profile,
} from "../shared/domain";
import { scoreSession } from "../shared/service";
import { useStudio } from "./context";
import { Mascot } from "./components/Mascot";
import { demo, resetDemo } from "./lib/api";
export function LessonCard({
  lesson,
  index = 0,
}: {
  lesson: Lesson;
  index?: number;
}) {
  const { start, report } = useStudio();
  const color = ["sage", "sand", "lavender", "blue"][index % 4];
  return (
    <article className={"lesson-card " + color}>
      <div className="lesson-art">
        <span className="subject-symbol">
          {index % 4 === 0 ? (
            <Leaf />
          ) : index % 4 === 1 ? (
            <BookOpen />
          ) : index % 4 === 2 ? (
            <Compass />
          ) : (
            <GraduationCap />
          )}
        </span>
        <span className="lesson-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="art-line" />
        <div className="art-circle" />
      </div>
      <div className="lesson-body">
        <span className="eyebrow">{lesson.subject}</span>
        <h3>{lesson.title}</h3>
        <p className="small muted">{stageLabels[lesson.stage]}</p>
        <div className="card-bottom">
          <span>
            <Layers3 size={15} />
            {lesson.activityIds.length} atividades
          </span>
          <button
            type="button"
            className="round-button"
            aria-label={"Estudar " + lesson.title}
            onClick={() => start(lesson, "trail").catch(report)}
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}
export function Home() {
  const { workspace: w, profile, go, start, resume, report } = useStudio();
  const sessions = w.sessions.filter(
    (s) => s.profileId === profile.id && s.mode !== "challenge",
  );
  const finished = sessions.filter((s) => s.finished);
  const answers = sessions.flatMap((s) => s.attempts);
  const own = w.lessons.filter((l) => l.published && l.stage === profile.stage);
  const lessons = own.length ? own : w.lessons.filter((l) => l.published);
  const pending = sessions.find((s) => !s.finished);
  const unique = new Set(
    answers.filter((a) => a.correct).map((a) => a.activityId),
  ).size;
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">UM POUCO A CADA DIA</p>
          <h1>
            {profile.theme === "academic"
              ? "Seu próximo passo começa aqui."
              : "Olá, " + profile.nickname + "!"}{" "}
            <span className="wave">
              {profile.theme === "academic" ? "" : "✦"}
            </span>
          </h1>
          <p>
            Explore ideias, pratique no seu ritmo e descubra até onde você pode
            ir.
          </p>
        </div>
        <span className="date-label">
          {new Intl.DateTimeFormat("pt-BR", {
            day: "numeric",
            month: "long",
          }).format(new Date())}
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="pill">
            <span className="dot" /> SEU ESPAÇO PARA APRENDER
          </span>
          <h2>
            {profile.theme === "playful" ? (
              <>
                Grandes descobertas.
                <br />
                <em>Um passo de cada vez.</em>
              </>
            ) : profile.theme === "academic" ? (
              <>
                Conhecimento que se conecta.
                <br />
                <em>Aprendizagem que avança.</em>
              </>
            ) : (
              <>
                Explore. Entenda.
                <br />
                <em>Vá um pouco além.</em>
              </>
            )}
          </h2>
          <p>
            Transforme a leitura em descobertas e os desafios em conhecimento.
            Sua próxima jornada está esperando.
          </p>
          <button
            className="button primary"
            onClick={() => {
              if (pending) resume(pending);
              else if (lessons[0]) start(lessons[0], "trail").catch(report);
              else go("create");
            }}
          >
            {pending ? "Continuar de onde parei" : "Começar uma jornada"}
            <ArrowRight size={18} />
          </button>
          <span className="hero-note">
            <Clock3 size={14} /> No seu tempo. Do seu jeito.
          </span>
        </div>
        {profile.theme === "playful" ? (
          <Mascot className="hero-mascot" />
        ) : (
          <div className="academic-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-book">
              <BookOpen size={72} strokeWidth={1} />
            </div>
            <span className="orbit-star">✦</span>
            <span className="orbit-label">CURIOSIDADE EM MOVIMENTO</span>
          </div>
        )}
      </section>
      <div className="stats-grid">
        {[
          {
            label: "Jornadas concluídas",
            value: finished.length,
            icon: Compass,
            color: "green",
          },
          {
            label: "Conceitos praticados",
            value: new Set(answers.map((a) => a.activityId)).size,
            icon: Layers3,
            color: "gold",
          },
          {
            label: "Descobertas consolidadas",
            value: unique,
            icon: Target,
            color: "purple",
          },
          {
            label: "Conquistas pessoais",
            value: [finished.length >= 1, unique >= 5, unique >= 20].filter(
              Boolean,
            ).length,
            icon: Trophy,
            color: "blue",
          },
        ].map((item) => (
          <article className="stat-card" key={item.label}>
            <span className={"stat-icon " + item.color}>
              <item.icon size={21} />
            </span>
            <div>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">SIGA SUA CURIOSIDADE</p>
          <h2>Suas próximas descobertas</h2>
        </div>
        <button className="text-button" onClick={() => go("library")}>
          Ver biblioteca
          <ArrowRight size={16} />
        </button>
      </div>
      {lessons.length ? (
        <div className="lesson-grid">
          {lessons.slice(0, 3).map((l, i) => (
            <LessonCard key={l.id} lesson={l} index={i} />
          ))}
        </div>
      ) : (
        <Empty
          title="Sua biblioteca começa com uma ideia"
          text="Adicione um texto, importe um PDF ou crie exercícios para começar."
          action={() => go("create")}
          actionLabel="Criar atividades"
        />
      )}
      <div className="bottom-grid">
        <section className="panel journey-panel">
          <div className="section-heading compact">
            <h3>Seu caminho até aqui</h3>
            <Compass size={20} />
          </div>
          {sessions.length ? (
            <div className="timeline">
              {sessions
                .slice(-3)
                .reverse()
                .map((s) => (
                  <button
                    className="timeline-item"
                    key={s.id}
                    onClick={() => resume(s)}
                  >
                    <span
                      className={
                        s.finished ? "timeline-dot done" : "timeline-dot"
                      }
                    >
                      {s.finished ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <Play size={16} />
                      )}
                    </span>
                    <span className="grow">
                      <strong>
                        {w.lessons.find((l) => l.id === s.lessonId)?.title ||
                          "Sessão de estudo"}
                      </strong>
                      <span className="small muted">
                        {s.finished
                          ? "Concluída · " +
                            scoreSession(s) +
                            " pontos pessoais"
                          : s.current +
                            " de " +
                            s.activityIds.length +
                            " atividades · continuar"}
                      </span>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
            </div>
          ) : (
            <p className="muted">
              Cada descoberta conta. Comece uma jornada para acompanhar seu
              progresso aqui.
            </p>
          )}
        </section>
        <section className="small-banner">
          <span className="stat-icon gold">
            <Sparkles size={24} />
          </span>
          <h3>Aprender também é experimentar.</h3>
          <p>
            Associe ideias, organize sequências e resolva problemas com
            diferentes atividades.
          </p>
          <button className="text-button" onClick={() => go("library")}>
            Explorar minijogos
            <ArrowRight size={16} />
          </button>
        </section>
      </div>
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
  actionLabel,
}: {
  title: string;
  text: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="empty-state">
      <BookOpen size={36} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button primary" onClick={action}>
          {actionLabel}
          <Plus size={16} />
        </button>
      )}
    </div>
  );
}
export function Library() {
  const { workspace: w, profile, start, report } = useStudio();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>(profile.stage);
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [size, setSize] = useState(5);
  const [practice, setPractice] = useState(false);
  const lessons = w.lessons.filter(
    (l) =>
      l.published &&
      (!stage || l.stage === stage) &&
      (!search ||
        (l.title + " " + l.subject)
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase())),
  );
  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="CONHECIMENTO PARA EXPLORAR"
        title="Biblioteca"
        text="Escolha seu próximo assunto. O nível é uma referência, nunca uma barreira."
      />
      <div className="toolbar panel">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Buscar na biblioteca"
            placeholder="Buscar assunto ou trilha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="sr-only" htmlFor="stage-filter">
          Etapa de ensino
        </label>
        <select
          id="stage-filter"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="">Todas as etapas</option>
          {stages.map((s) => (
            <option key={s} value={s}>
              {stageLabels[s]}
            </option>
          ))}
        </select>
        <button
          className={"button " + (practice ? "primary" : "secondary")}
          onClick={() => setPractice(!practice)}
        >
          <Settings2 size={16} />
          {practice ? "Prática livre ativada" : "Configurar prática"}
        </button>
      </div>
      {practice && (
        <div className="panel filter-grid">
          <label>
            Formato
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Todos os formatos</option>
              {Object.entries(typeLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dificuldade
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="introducao">Introdução</option>
              <option value="pratica">Prática</option>
              <option value="aprofundamento">Aprofundamento</option>
            </select>
          </label>
          <label>
            Atividades por sessão
            <input
              type="number"
              min={1}
              max={100}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </label>
        </div>
      )}
      <div className="section-heading">
        <h2>
          {lessons.length}{" "}
          {lessons.length === 1 ? "trilha disponível" : "trilhas disponíveis"}
        </h2>
        <span className="muted small">
          Seu progresso acompanha você em todos os modos.
        </span>
      </div>
      {lessons.length ? (
        <div className="lesson-grid">
          {lessons.map((l, i) => (
            <div key={l.id}>
              <LessonCard lesson={l} index={i} />
              {practice && (
                <button
                  className="button secondary full-width practice-button"
                  onClick={() =>
                    start(l, "practice", {
                      size,
                      type: (type as ActivityType) || undefined,
                      difficulty: difficulty || undefined,
                    }).catch(report)
                  }
                >
                  <Play size={16} />
                  Praticar com estes filtros
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Nenhuma trilha encontrada"
          text="Experimente outra busca ou etapa de ensino."
        />
      )}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
export function Settings() {
  const { workspace: w, profile, run, report, notify } = useStudio();
  const [form, setForm] = useState({ ...profile });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await run("updateProfile", { ...form, profileId: profile.id });
      notify("Preferências atualizadas. Seu progresso foi preservado.");
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <PageHeading
        eyebrow="DO SEU JEITO"
        title="Perfil e preferências"
        text="A aparência e a etapa de estudo podem mudar. O que você aprendeu continua com você."
      />
      <section className="panel form-panel">
        <div className="form-grid">
          <label>
            Como quer ser chamado?
            <input
              value={form.nickname}
              maxLength={80}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
            />
          </label>
          <label>
            Avatar
            <select
              value={form.avatar}
              onChange={(e) => setForm({ ...form, avatar: e.target.value })}
            >
              {["🌿", "🦊", "🦉", "🚀", "📚", "🔬", "🎨", "🌻"].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Etapa de estudo
            <select
              value={form.stage}
              onChange={(e) =>
                setForm({ ...form, stage: e.target.value as Profile["stage"] })
              }
            >
              {stages.map((s) => (
                <option key={s} value={s}>
                  {stageLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Disciplina de interesse
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Ex.: matemática, literatura, biologia"
            />
          </label>
        </div>
        <h3>Como você prefere aprender?</h3>
        <div className="theme-options">
          {[
            {
              id: "playful",
              title: "Lúdica",
              text: "Mascote, descobertas e um mapa de aventuras.",
              icon: Sparkles,
            },
            {
              id: "calm",
              title: "Discreta",
              text: "Trilhas e metas em um espaço tranquilo.",
              icon: Leaf,
            },
            {
              id: "academic",
              title: "Acadêmica",
              text: "Conteúdos e progresso com foco no estudo.",
              icon: GraduationCap,
            },
          ].map((t) => (
            <button
              type="button"
              key={t.id}
              aria-pressed={form.theme === t.id}
              className={
                "theme-option " + (form.theme === t.id ? "selected" : "")
              }
              onClick={() =>
                setForm({ ...form, theme: t.id as Profile["theme"] })
              }
            >
              <t.icon size={26} />
              <strong>{t.title}</strong>
              <span>{t.text}</span>
            </button>
          ))}
        </div>
        <button className="button primary" disabled={busy} onClick={save}>
          {busy ? "Salvando..." : "Salvar preferências"}
          <CheckCircle2 size={17} />
        </button>
      </section>
      <p className="muted small">
        Espaço: {w.group.title}. As preferências são individuais, sem limite
        máximo de idade.
      </p>
      {demo && (
        <section className="panel">
          <h3>Demonstração local</h3>
          <p>
            Os exemplos e resultados desta demonstração ficam somente neste
            navegador. A IA, uploads privados e participantes em outros
            dispositivos precisam do Firebase configurado.
          </p>
          <button
            className="button secondary"
            onClick={() => {
              if (confirm("Apagar os dados da demonstração neste navegador?"))
                resetDemo();
            }}
          >
            Reiniciar demonstração
          </button>
        </section>
      )}
    </div>
  );
}
