import { useState } from "react";
import {
  Plus,
  FileText,
  Upload,
  Sparkles,
  Calculator,
  CheckCircle2,
  Trash2,
  Eye,
  RefreshCw,
  Save,
  ArrowRight,
} from "lucide-react";
import {
  type Activity,
  type ActivityType,
  type Lesson,
  type Material,
  type Page,
  type Stage,
  types,
  typeLabels,
  stages,
  stageLabels,
  validateActivity,
  publicActivity,
  grade,
  decodeAnswer,
  solutionLabel,
  type Answer,
} from "../shared/domain";
import { mathActivities } from "../shared/math";
import { useStudio } from "./context";
import { PageHeading } from "./pages";
import { upload } from "./lib/api";
import { ActivityInput, emptyAnswer } from "./components/ActivityInput";
import { RichText } from "./components/RichText";
function template(type: ActivityType, stage: Stage): Activity {
  const base = {
    id: crypto.randomUUID(),
    version: 1,
    prompt: "Escreva o enunciado da atividade.",
    skill: "Compreensão",
    stage,
    difficulty: "pratica" as const,
    hint: "Adicione uma pista útil.",
    explanation: "Explique o raciocínio e a resposta.",
  };
  switch (type) {
    case "choice":
      return {
        ...base,
        type,
        options: ["Alternativa A", "Alternativa B", "Alternativa C"],
        solution: 0,
      };
    case "boolean":
      return { ...base, type, solution: true };
    case "blank":
      return {
        ...base,
        type,
        prompt: "Complete com a palavra ___.",
        bank: ["palavra", "outra"],
        solution: ["palavra"],
      };
    case "match":
      return {
        ...base,
        type,
        pairs: [
          { id: "a", left: "Conceito A", right: "Definição A" },
          { id: "b", left: "Conceito B", right: "Definição B" },
        ],
      };
    case "order":
      return {
        ...base,
        type,
        items: [
          { id: "b", text: "Segundo passo" },
          { id: "a", text: "Primeiro passo" },
        ],
        solution: ["a", "b"],
      };
    case "classify":
      return {
        ...base,
        type,
        categories: ["Grupo A", "Grupo B"],
        items: [
          { id: "a", text: "Item A" },
          { id: "b", text: "Item B" },
        ],
        solution: { a: "Grupo A", b: "Grupo B" },
      };
    case "numeric":
      return { ...base, type, solution: 0, tolerance: 0, unit: "" };
    case "open":
      return {
        ...base,
        type,
        rubric: "Descreva o que uma resposta fundamentada precisa demonstrar.",
      };
  }
}
function Preview({ activity }: { activity: Activity }) {
  const [answer, setAnswer] = useState<Answer>(
    emptyAnswer(publicActivity(activity)),
  );
  const [result, setResult] = useState<string>("");
  return (
    <div className="activity-preview">
      <span className="eyebrow">PRÉVIA DO ESTUDANTE</span>
      <RichText>{activity.prompt}</RichText>
      <ActivityInput
        activity={publicActivity(activity)}
        answer={answer}
        onChange={setAnswer}
      />
      <button
        className="button secondary"
        onClick={() => {
          const correct = grade(activity, decodeAnswer(activity, answer));
          setResult(
            correct === null
              ? "Requer avaliação humana."
              : correct
                ? "Resposta correta!"
                : "Tente novamente.",
          );
        }}
      >
        Conferir prévia
      </button>
      <p aria-live="polite">{result}</p>
    </div>
  );
}
function ActivityEditor({
  activity: a,
  onChange,
  remove,
  regenerate,
}: {
  activity: Activity;
  onChange: (a: Activity) => void;
  remove: () => void;
  regenerate?: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const edit = (fields: Record<string, unknown>) =>
    onChange({ ...a, ...fields } as Activity);
  return (
    <article className="panel activity-editor">
      <div className="section-heading compact">
        <span className="pill">{typeLabels[a.type]}</span>
        <div className="inline-actions">
          {regenerate && (
            <button
              className="icon-button"
              aria-label="Regenerar esta atividade"
              onClick={regenerate}
            >
              <RefreshCw size={17} />
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Experimentar atividade"
            onClick={() => setPreview(!preview)}
          >
            <Eye size={18} />
          </button>
          <button
            className="icon-button danger"
            aria-label="Excluir atividade"
            onClick={remove}
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>
      <label>
        Enunciado
        <textarea
          rows={3}
          value={a.prompt}
          onChange={(e) => edit({ prompt: e.target.value })}
        />
      </label>
      <div className="form-grid">
        <label>
          Habilidade
          <input
            value={a.skill}
            onChange={(e) => edit({ skill: e.target.value })}
          />
        </label>
        <label>
          Dificuldade
          <select
            value={a.difficulty}
            onChange={(e) => edit({ difficulty: e.target.value })}
          >
            <option value="introducao">Introdução</option>
            <option value="pratica">Prática</option>
            <option value="aprofundamento">Aprofundamento</option>
          </select>
        </label>
      </div>
      {a.type === "choice" && (
        <fieldset>
          <legend>Alternativas · marque a correta</legend>
          {a.options.map((o, i) => (
            <div className="option-edit" key={i}>
              <input
                type="radio"
                name={"correct-" + a.id}
                aria-label={"Alternativa correta " + (i + 1)}
                checked={a.solution === i}
                onChange={() => edit({ solution: i })}
              />
              <input
                aria-label={"Texto da alternativa " + (i + 1)}
                value={o}
                onChange={(e) =>
                  edit({
                    options: a.options.map((v, n) =>
                      n === i ? e.target.value : v,
                    ),
                  })
                }
              />
              <button
                className="icon-button"
                aria-label={"Remover alternativa " + (i + 1)}
                disabled={a.options.length <= 2}
                onClick={() =>
                  edit({
                    options: a.options.filter((_, n) => n !== i),
                    solution: 0,
                  })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            className="text-button"
            disabled={a.options.length >= 6}
            onClick={() =>
              edit({ options: [...a.options, "Nova alternativa"] })
            }
          >
            <Plus size={15} />
            Alternativa
          </button>
        </fieldset>
      )}
      {a.type === "boolean" && (
        <label>
          Resposta correta
          <select
            value={String(a.solution)}
            onChange={(e) => edit({ solution: e.target.value === "true" })}
          >
            <option value="true">Verdadeiro</option>
            <option value="false">Falso</option>
          </select>
        </label>
      )}
      {a.type === "blank" && (
        <div className="form-grid">
          <label>
            Banco de palavras · uma por linha
            <textarea
              value={a.bank.join("\n")}
              onChange={(e) => edit({ bank: e.target.value.split("\n") })}
            />
          </label>
          <label>
            Respostas aceitas · uma por linha
            <textarea
              value={a.solution.join("\n")}
              onChange={(e) => edit({ solution: e.target.value.split("\n") })}
            />
          </label>
        </div>
      )}
      {a.type === "numeric" && (
        <>
          <div className="form-grid three">
            <label>
              Resposta correta
              <input
                type="number"
                step="any"
                value={a.solution}
                onChange={(e) => edit({ solution: Number(e.target.value) })}
              />
            </label>
            <label>
              Tolerância absoluta
              <input
                type="number"
                min={0}
                step="any"
                value={a.tolerance}
                onChange={(e) => edit({ tolerance: Number(e.target.value) })}
              />
            </label>
            <label>
              Unidade
              <input
                value={a.unit}
                onChange={(e) => edit({ unit: e.target.value })}
              />
            </label>
          </div>
          {a.arithmetic && (
            <p className="small muted">
              Conferência aritmética: {a.arithmetic.a} {a.arithmetic.op}{" "}
              {a.arithmetic.b}. O gabarito precisa corresponder à operação.
            </p>
          )}
        </>
      )}
      {a.type === "open" && (
        <label>
          Critérios de avaliação
          <textarea
            rows={3}
            value={a.rubric}
            onChange={(e) => edit({ rubric: e.target.value })}
          />
        </label>
      )}
      {a.type === "match" && (
        <fieldset>
          <legend>Pares corretos</legend>
          {a.pairs.map((p, i) => (
            <div className="form-grid" key={p.id}>
              <label>
                Conceito {i + 1}
                <input
                  value={p.left}
                  onChange={(e) =>
                    edit({
                      pairs: a.pairs.map((v) =>
                        v.id === p.id ? { ...v, left: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Correspondência
                <input
                  value={p.right}
                  onChange={(e) =>
                    edit({
                      pairs: a.pairs.map((v) =>
                        v.id === p.id ? { ...v, right: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
            </div>
          ))}
          <button
            className="text-button"
            disabled={a.pairs.length >= 8}
            onClick={() =>
              edit({
                pairs: [
                  ...a.pairs,
                  {
                    id: crypto.randomUUID(),
                    left: "Novo conceito",
                    right: "Nova definição",
                  },
                ],
              })
            }
          >
            <Plus size={15} />
            Par
          </button>
        </fieldset>
      )}
      {a.type === "order" && (
        <fieldset>
          <legend>Itens e posições corretas</legend>
          {a.items.map((item) => (
            <div className="option-edit" key={item.id}>
              <input
                aria-label="Texto do item"
                value={item.text}
                onChange={(e) =>
                  edit({
                    items: a.items.map((v) =>
                      v.id === item.id ? { ...v, text: e.target.value } : v,
                    ),
                  })
                }
              />
              <select
                aria-label={"Posição correta de " + item.text}
                value={a.solution.indexOf(item.id)}
                onChange={(e) => {
                  const next = [...a.solution];
                  const old = next.indexOf(item.id),
                    target = Number(e.target.value);
                  [next[old], next[target]] = [next[target], next[old]];
                  edit({ solution: next });
                }}
              >
                {a.solution.map((_, i) => (
                  <option key={i} value={i}>
                    {i + 1}º
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            className="text-button"
            disabled={a.items.length >= 10}
            onClick={() => {
              const id = crypto.randomUUID();
              edit({
                items: [...a.items, { id, text: "Novo passo" }],
                solution: [...a.solution, id],
              });
            }}
          >
            <Plus size={15} />
            Item
          </button>
        </fieldset>
      )}
      {a.type === "classify" && (
        <fieldset>
          <legend>Categorias e classificação correta</legend>
          <label>
            Categorias · uma por linha
            <textarea
              value={a.categories.join("\n")}
              onChange={(e) => edit({ categories: e.target.value.split("\n") })}
            />
          </label>
          {a.items.map((item) => (
            <div className="option-edit" key={item.id}>
              <input
                aria-label="Texto para classificar"
                value={item.text}
                onChange={(e) =>
                  edit({
                    items: a.items.map((v) =>
                      v.id === item.id ? { ...v, text: e.target.value } : v,
                    ),
                  })
                }
              />
              <select
                aria-label={"Categoria de " + item.text}
                value={a.solution[item.id] || ""}
                onChange={(e) =>
                  edit({
                    solution: { ...a.solution, [item.id]: e.target.value },
                  })
                }
              >
                <option value="">Selecione</option>
                {a.categories.map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>
            </div>
          ))}
          <button
            className="text-button"
            disabled={a.items.length >= 12}
            onClick={() => {
              const id = crypto.randomUUID();
              edit({
                items: [...a.items, { id, text: "Novo item" }],
                solution: { ...a.solution, [id]: a.categories[0] },
              });
            }}
          >
            <Plus size={15} />
            Item
          </button>
        </fieldset>
      )}
      <div className="form-grid">
        <label>
          Dica
          <textarea
            value={a.hint}
            onChange={(e) => edit({ hint: e.target.value })}
          />
        </label>
        <label>
          Explicação
          <textarea
            value={a.explanation}
            onChange={(e) => edit({ explanation: e.target.value })}
          />
        </label>
      </div>
      {a.source && (
        <div className="form-grid">
          <label>
            Página de referência
            <input
              type="number"
              min={1}
              value={a.source.page}
              onChange={(e) =>
                edit({ source: { ...a.source, page: Number(e.target.value) } })
              }
            />
          </label>
          <label>
            Trecho literal do material
            <textarea
              value={a.source.quote}
              onChange={(e) =>
                edit({ source: { ...a.source, quote: e.target.value } })
              }
            />
          </label>
        </div>
      )}
      <details className="small">
        <summary>Conferir solução</summary>
        <RichText>{solutionLabel(a)}</RichText>
      </details>
      {preview && <Preview key={JSON.stringify(a)} activity={a} />}
    </article>
  );
}
export function Creator() {
  const { workspace: w, profile, run, report, notify } = useStudio();
  const [tab, setTab] = useState<"material" | "math" | "editor">("material");
  const [busy, setBusy] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const material = w.materials.find((m) => m.id === materialId);
  const [review, setReview] = useState<Material | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [lessonId, setLessonId] = useState<string | undefined>();
  const [lessonTitle, setLessonTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [stage, setStage] = useState<Stage>(profile.stage);
  const [objectives, setObjectives] = useState(
    "Compreender o material e aplicar os conceitos em situações novas.",
  );
  const [difficulty, setDifficulty] = useState("pratica");
  const [count, setCount] = useState(8);
  const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([
    "choice",
    "blank",
    "match",
    "order",
    "classify",
    "boolean",
  ]);
  const [pages, setPages] = useState<number[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [addType, setAddType] = useState<ActivityType>("choice");
  const [minimum, setMinimum] = useState(0);
  const [maximum, setMaximum] = useState(100);
  const [operations, setOperations] = useState<("+" | "-" | "*" | "/")[]>([
    "+",
    "-",
  ]);
  const [regroup, setRegroup] = useState(true);
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
  function chooseMaterial(id: string) {
    setMaterialId(id);
    const m = w.materials.find((v) => v.id === id);
    setPages(m?.pages.slice(0, 20).map((p) => p.number) || []);
  }
  async function openLesson(id: string) {
    await task(async () => {
      const result = await run<{ lesson: Lesson; activities: Activity[] }>(
        "lesson",
        { lessonId: id },
      );
      setLessonId(result.lesson.id);
      setLessonTitle(result.lesson.title);
      setSubject(result.lesson.subject);
      setStage(result.lesson.stage);
      chooseMaterial(result.lesson.materialId || "");
      setActivities(result.activities);
      setTab("editor");
    });
  }
  async function generate(replaceId?: string) {
    await task(async () => {
      if (!material?.reviewed)
        throw new Error("Selecione um material revisado.");
      await run("enqueue", {
        kind: "generate",
        input: {
          title: lessonTitle || material.title,
          subject: subject || "Estudo do material",
          stage,
          difficulty,
          objectives,
          count: replaceId ? 1 : count,
          types: replaceId
            ? [activities.find((a) => a.id === replaceId)!.type]
            : selectedTypes,
          materialId: material.id,
          pageNumbers: pages,
          ...(replaceId && lessonId ? { lessonId, replaceId } : {}),
        },
      });
      notify("Geração iniciada. Acompanhe o processamento abaixo.");
    });
  }
  function add() {
    let activity = template(addType, stage);
    if (material) {
      const p =
        material.pages.find((p) => pages.includes(p.number)) ||
        material.pages[0];
      activity = {
        ...activity,
        source: {
          materialId: material.id,
          page: p.number,
          quote: p.text.slice(0, 150),
        },
      };
    }
    setActivities([...activities, activity]);
    setTab("editor");
  }
  async function save(publish: boolean) {
    await task(async () => {
      const checked = activities.map((a) => validateActivity({ ...a, stage }));
      const lesson = await run<Lesson>("saveLesson", {
        ...(lessonId ? { id: lessonId } : {}),
        title: lessonTitle,
        subject,
        stage,
        activities: checked,
        publish,
        ...(materialId ? { materialId } : {}),
      });
      setLessonId(lesson.id);
      notify(publish ? "Trilha publicada para o grupo." : "Rascunho salvo.");
    });
  }
  return (
    <div>
      <PageHeading
        eyebrow="DA CURIOSIDADE AO CONHECIMENTO"
        title="Estúdio de atividades"
        text="Textos, livros, fórmulas e novas ideias. Você escolhe o conteúdo e a profundidade."
      />
      <div className="tabs">
        <button
          className={tab === "material" ? "active" : ""}
          onClick={() => setTab("material")}
        >
          <FileText size={17} />
          Materiais e IA
        </button>
        <button
          className={tab === "math" ? "active" : ""}
          onClick={() => setTab("math")}
        >
          <Calculator size={17} />
          Exercícios de matemática
        </button>
        <button
          className={tab === "editor" ? "active" : ""}
          onClick={() => setTab("editor")}
        >
          <Eye size={17} />
          Revisar atividades{" "}
          {activities.length > 0 && "(" + activities.length + ")"}
        </button>
      </div>
      <section className="panel">
        <div className="form-grid three">
          <label>
            Título da trilha
            <input
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="Ex.: Investigando o sistema solar"
            />
          </label>
          <label>
            Disciplina
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: Ciências, cálculo, literatura"
            />
          </label>
          <label>
            Etapa de ensino
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as Stage)}
            >
              {stages.map((s) => (
                <option key={s} value={s}>
                  {stageLabels[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Abrir trilha existente
          <select
            value={lessonId || ""}
            onChange={(e) => {
              if (e.target.value) void openLesson(e.target.value);
              else {
                setLessonId(undefined);
                setActivities([]);
                setLessonTitle("");
                setSubject("");
              }
            }}
          >
            <option value="">Nova trilha</option>
            {w.lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.published ? "Publicada" : "Rascunho"} · {l.title}
              </option>
            ))}
          </select>
        </label>
      </section>
      {tab === "material" && (
        <>
          <section className="panel">
            <h3>1. Escolha ou importe o material</h3>
            <label>
              Materiais do grupo
              <select
                value={materialId}
                onChange={(e) => chooseMaterial(e.target.value)}
              >
                <option value="">Selecione um material</option>
                {w.materials.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.reviewed ? "✓" : "Revisar"} · {m.title}
                  </option>
                ))}
              </select>
            </label>
            {material && (
              <div className="material-selection">
                <div className="section-heading compact">
                  <strong>{material.title}</strong>
                  <button
                    className="text-button"
                    onClick={() => setReview(structuredClone(material))}
                  >
                    Revisar páginas
                    <ArrowRight size={15} />
                  </button>
                </div>
                <div className="page-selector">
                  {material.pages.map((p) => (
                    <label className="check-label" key={p.number}>
                      <input
                        type="checkbox"
                        checked={pages.includes(p.number)}
                        onChange={(e) =>
                          setPages(
                            e.target.checked
                              ? [...pages, p.number]
                              : pages.filter((n) => n !== p.number),
                          )
                        }
                      />
                      Pág. {p.number}
                      {p.chapter ? " · " + p.chapter : ""}
                      {p.needsReview ? " · revisar" : ""}
                    </label>
                  ))}
                </div>
                <p className="small muted">
                  Selecione até 20 páginas por geração. Livros maiores podem ser
                  trabalhados por capítulos.
                </p>
              </div>
            )}
            <details>
              <summary>Adicionar novo material</summary>
              <label>
                Nome do material
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título do texto ou livro"
                />
              </label>
              <label>
                Texto
                <textarea
                  rows={7}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Cole o texto. Para separar páginas, use uma linha contendo ---PÁGINA---."
                />
              </label>
              <div className="inline-actions">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    task(async () => {
                      const m = await run<Material>("saveMaterial", {
                        title,
                        pages: text.split(/^---PÁGINA---$/m).map((t, i) => ({
                          number: i + 1,
                          chapter: "",
                          text: t.trim(),
                          needsReview: !t.trim(),
                        })),
                        reviewed: false,
                      });
                      setMaterialId(m.id);
                      setReview(m);
                      notify("Texto importado. Confira e confirme a revisão.");
                    })
                  }
                >
                  <Save size={16} />
                  Importar texto
                </button>
                <label className="button secondary file-label">
                  <Upload size={16} />
                  Importar PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        void task(async () => {
                          const storagePath = await upload(
                            w.group.id,
                            "materials",
                            file,
                          );
                          await run("enqueue", {
                            kind: "pdf",
                            input: {
                              storagePath,
                              title: title || file.name.replace(/\.pdf$/i, ""),
                            },
                          });
                          notify("PDF enviado para processamento.");
                        });
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </details>
          </section>
          {review && (
            <section className="panel">
              <h3>Revise o material: {review.title}</h3>
              <p className="muted">
                Confira o texto e as fórmulas. Corrija trechos incertos e
                desmarque a pendência de cada página.
              </p>
              {review.pages.map((p, i) => (
                <div className="page-review" key={p.number}>
                  <div className="form-grid">
                    <label>
                      Página {p.number} · capítulo
                      <input
                        value={p.chapter}
                        onChange={(e) =>
                          setReview({
                            ...review,
                            pages: review.pages.map((v, n) =>
                              n === i ? { ...v, chapter: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={p.needsReview}
                        onChange={(e) =>
                          setReview({
                            ...review,
                            pages: review.pages.map((v, n) =>
                              n === i
                                ? { ...v, needsReview: e.target.checked }
                                : v,
                            ),
                          })
                        }
                      />
                      Leitura ou fórmula precisa de correção
                    </label>
                  </div>
                  <textarea
                    aria-label={"Texto da página " + p.number}
                    rows={7}
                    value={p.text}
                    onChange={(e) =>
                      setReview({
                        ...review,
                        pages: review.pages.map((v, n) =>
                          n === i ? { ...v, text: e.target.value } : v,
                        ),
                      })
                    }
                  />
                  <details>
                    <summary>Conferir formatação e fórmulas</summary>
                    <RichText>{p.text}</RichText>
                  </details>
                </div>
              ))}
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  task(async () => {
                    await run("saveMaterial", { ...review, reviewed: true });
                    setPages(review.pages.slice(0, 20).map((p) => p.number));
                    setMaterialId(review.id);
                    setReview(null);
                    notify("Material revisado e pronto para gerar atividades.");
                  })
                }
              >
                <CheckCircle2 size={17} />
                Confirmar revisão do material
              </button>
            </section>
          )}
          <section className="panel">
            <h3>2. Defina a experiência de aprendizagem</h3>
            <label>
              Objetivos de aprendizagem
              <textarea
                rows={3}
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                Complexidade
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="introducao">Introdução</option>
                  <option value="pratica">Prática e aplicação</option>
                  <option value="aprofundamento">
                    Aprofundamento e análise
                  </option>
                </select>
              </label>
              <label>
                Quantidade de atividades
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </label>
            </div>
            <fieldset>
              <legend>Formatos permitidos</legend>
              <div className="check-grid">
                {types.map((t) => (
                  <label key={t} className="check-label">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(t)}
                      onChange={(e) =>
                        setSelectedTypes(
                          e.target.checked
                            ? [...selectedTypes, t]
                            : selectedTypes.filter((v) => v !== t),
                        )
                      }
                    />
                    {typeLabels[t]}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              className="button primary"
              disabled={
                busy ||
                !material?.reviewed ||
                !pages.length ||
                !selectedTypes.length
              }
              onClick={() => generate()}
            >
              <Sparkles size={17} />
              Gerar atividades para revisão
            </button>
          </section>
        </>
      )}
      {tab === "math" && (
        <section className="panel">
          <h3>Matemática com conferência automática</h3>
          <p className="muted">
            Gere operações sem usar IA ou consumir cotas. Para conteúdos
            avançados, crie atividades numéricas ou abertas no editor.
          </p>
          <div className="form-grid three">
            <label>
              Menor operando
              <input
                type="number"
                min={0}
                value={minimum}
                onChange={(e) => setMinimum(Number(e.target.value))}
              />
            </label>
            <label>
              Maior operando
              <input
                type="number"
                max={100000}
                value={maximum}
                onChange={(e) => setMaximum(Number(e.target.value))}
              />
            </label>
            <label>
              Quantidade
              <input
                type="number"
                min={1}
                max={30}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="check-grid">
            {(["+", "-", "*", "/"] as const).map((op) => (
              <label key={op} className="check-label">
                <input
                  type="checkbox"
                  checked={operations.includes(op)}
                  onChange={(e) =>
                    setOperations(
                      e.target.checked
                        ? [...operations, op]
                        : operations.filter((v) => v !== op),
                    )
                  }
                />
                {
                  {
                    "+": "Adição",
                    "-": "Subtração",
                    "*": "Multiplicação",
                    "/": "Divisão exata",
                  }[op]
                }
              </label>
            ))}
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={regroup}
              onChange={(e) => setRegroup(e.target.checked)}
            />
            Permitir reagrupamento em adição e subtração
          </label>
          <button
            className="button primary"
            onClick={() => {
              try {
                setActivities(
                  mathActivities(
                    {
                      count,
                      min: minimum,
                      max: maximum,
                      operations,
                      regroup,
                      stage,
                      difficulty: "pratica",
                    },
                    () => crypto.randomUUID(),
                  ),
                );
                setLessonId(undefined);
                setMaterialId("");
                setLessonTitle(lessonTitle || "Praticando matemática");
                setSubject(subject || "Matemática");
                setTab("editor");
              } catch (e) {
                report(e);
              }
            }}
          >
            <Calculator size={17} />
            Criar exercícios conferidos
          </button>
        </section>
      )}
      {tab === "editor" && (
        <>
          <div className="toolbar">
            <label>
              Adicionar formato
              <select
                value={addType}
                onChange={(e) => setAddType(e.target.value as ActivityType)}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {typeLabels[t]}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary" onClick={add}>
              <Plus size={17} />
              Adicionar atividade
            </button>
          </div>
          {activities.map((a, i) => (
            <ActivityEditor
              key={a.id}
              activity={a}
              onChange={(next) =>
                setActivities(activities.map((v, n) => (n === i ? next : v)))
              }
              remove={() => setActivities(activities.filter((_, n) => n !== i))}
              regenerate={
                lessonId && material ? () => generate(a.id) : undefined
              }
            />
          ))}
          {!activities.length && (
            <div className="empty-state">
              <Eye size={30} />
              <h3>Prepare sua primeira atividade</h3>
              <p>
                Adicione um formato, gere exercícios ou abra uma trilha
                existente.
              </p>
            </div>
          )}
          <div className="editor-footer">
            <span className="small muted">
              {activities.length} atividades · revise antes de publicar
            </span>
            <button
              className="button secondary"
              disabled={busy || !activities.length}
              onClick={() => save(false)}
            >
              <Save size={16} />
              Salvar rascunho
            </button>
            <button
              className="button primary"
              disabled={busy || !activities.length}
              onClick={() => save(true)}
            >
              <CheckCircle2 size={17} />
              Publicar trilha
            </button>
          </div>
        </>
      )}
      {w.jobs.length > 0 && (
        <section className="panel">
          <h3>Processamento</h3>
          {w.jobs
            .slice()
            .reverse()
            .map((job) => (
              <div className="job-row" key={job.id}>
                <div className="grow">
                  <strong>
                    {job.kind === "pdf"
                      ? "Importação de PDF"
                      : job.kind === "generate"
                        ? "Geração de atividades"
                        : "Sugestão de avaliação"}
                  </strong>
                  <p className="small muted">{job.message}</p>
                  <progress max={100} value={job.progress} />
                </div>
                {(job.status === "failed" ||
                  (job.status === "running" &&
                    (job.leaseUntil || Infinity) < Date.now())) && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      task(async () => {
                        await run("retryJob", { jobId: job.id });
                      })
                    }
                  >
                    <RefreshCw size={16} />
                    Retomar
                  </button>
                )}
                {job.status === "done" &&
                  job.resultId &&
                  job.kind !== "suggest" && (
                    <button
                      className="text-button"
                      onClick={() => {
                        if (job.kind === "generate")
                          void openLesson(job.resultId!);
                        else {
                          chooseMaterial(job.resultId!);
                          const m = w.materials.find(
                            (v) => v.id === job.resultId,
                          );
                          if (m) setReview(structuredClone(m));
                          setTab("material");
                        }
                      }}
                    >
                      Abrir revisão
                      <ArrowRight size={16} />
                    </button>
                  )}
              </div>
            ))}
        </section>
      )}
    </div>
  );
}
