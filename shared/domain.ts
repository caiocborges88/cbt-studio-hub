import { z } from "zod";

export const stages = [
  "fundamental-inicial",
  "fundamental-final",
  "medio",
  "superior",
] as const;
export type Stage = (typeof stages)[number];
export const stageLabels: Record<Stage, string> = {
  "fundamental-inicial": "Fundamental · anos iniciais",
  "fundamental-final": "Fundamental · anos finais",
  medio: "Ensino médio",
  superior: "Ensino superior",
};
export type Theme = "playful" | "calm" | "academic";
export const types = [
  "choice",
  "boolean",
  "blank",
  "match",
  "order",
  "classify",
  "numeric",
  "open",
] as const;
export type ActivityType = (typeof types)[number];
export const typeLabels: Record<ActivityType, string> = {
  choice: "Múltipla escolha",
  boolean: "Verdadeiro ou falso",
  blank: "Complete a lacuna",
  match: "Associe os pares",
  order: "Coloque em ordem",
  classify: "Separe em grupos",
  numeric: "Resposta numérica",
  open: "Resposta aberta",
};
const text = z.string().trim().min(1).max(12000);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const baseSchema = z.object({
  id,
  version: z.number().int().positive().default(1),
  prompt: text,
  skill: z.string().min(1).max(160),
  stage: z.enum(stages),
  difficulty: z.enum(["introducao", "pratica", "aprofundamento"]),
  hint: text,
  explanation: text,
  source: z
    .object({
      materialId: id,
      page: z.number().int().positive(),
      quote: z.string().max(2000),
    })
    .optional(),
});
export const activitySchema = z.discriminatedUnion("type", [
  baseSchema.extend({
    type: z.literal("choice"),
    options: z.array(text).min(2).max(6),
    solution: z.number().int().nonnegative(),
  }),
  baseSchema.extend({ type: z.literal("boolean"), solution: z.boolean() }),
  baseSchema.extend({
    type: z.literal("blank"),
    bank: z.array(text).max(20).default([]),
    solution: z.array(text).min(1).max(10),
  }),
  baseSchema.extend({
    type: z.literal("match"),
    pairs: z
      .array(z.object({ id, left: text, right: text }))
      .min(2)
      .max(8),
  }),
  baseSchema.extend({
    type: z.literal("order"),
    items: z.array(z.object({ id, text })).min(2).max(10),
    solution: z.array(id).min(2).max(10),
  }),
  baseSchema.extend({
    type: z.literal("classify"),
    categories: z.array(text).min(2).max(6),
    items: z.array(z.object({ id, text })).min(2).max(12),
    solution: z.record(z.string(), z.string()),
  }),
  baseSchema.extend({
    type: z.literal("numeric"),
    solution: z.number().finite(),
    tolerance: z.number().min(0).max(1e10).default(0),
    unit: z.string().max(40).default(""),
    arithmetic: z
      .object({
        a: z.number().finite(),
        b: z.number().finite(),
        op: z.enum(["+", "-", "*", "/"]),
      })
      .optional(),
  }),
  baseSchema.extend({ type: z.literal("open"), rubric: text }),
]);
export type Activity = z.infer<typeof activitySchema>;
export interface PublicActivity {
  id: string;
  version: number;
  type: ActivityType;
  prompt: string;
  skill: string;
  stage: Stage;
  difficulty: "introducao" | "pratica" | "aprofundamento";
  source?: { materialId: string; page: number; quote: string };
  options?: string[];
  bank?: string[];
  pairs?: { id: string; left: string }[];
  rightOptions?: { id: string; text: string }[];
  items?: { id: string; text: string }[];
  categories?: string[];
  unit?: string;
}
export type Answer =
  string | number | boolean | string[] | Record<string, string>;
export type Role = "admin" | "educator" | "student";
export interface Profile {
  id: string;
  nickname: string;
  avatar: string;
  stage: Stage;
  theme: Theme;
  subject: string;
  child: boolean;
  ageBand?: "up-to-14" | "15-plus";
  guardianUid?: string;
  ownerUid?: string;
}
export interface Member {
  id: string;
  role: Role;
  profileId: string;
  active: boolean;
  provider: "adult" | "child";
}
export function canUploadAnswers(
  profile: Profile,
  adult: boolean,
  role: Role,
): boolean {
  if (adult && (role === "admin" || role === "educator")) return true;
  if (profile.ageBand === "up-to-14") return false;
  return profile.child ? profile.ageBand === "15-plus" : adult;
}
export interface Group {
  id: string;
  title: string;
  ownerUid: string;
  createdAt: number;
}
export interface Page {
  number: number;
  chapter: string;
  text: string;
  needsReview: boolean;
}
export interface Material {
  id: string;
  title: string;
  pages: Page[];
  reviewed: boolean;
  createdAt: number;
  storagePath?: string;
}
export interface Lesson {
  id: string;
  title: string;
  subject: string;
  stage: Stage;
  activityIds: string[];
  published: boolean;
  createdAt: number;
  materialId?: string;
  createdBy?: string;
}
export interface Attempt {
  id: string;
  activityId: string;
  skill: string;
  answer: Answer;
  correct: boolean | null;
  points: number;
  usedHint: boolean;
  tries: number;
  review: "none" | "pending" | "confirmed";
  feedback: string;
  photoPath?: string;
  createdAt: number;
  suggestion?: { points: number; feedback: string };
}
export interface Session {
  id: string;
  profileId: string;
  ownerUid: string;
  lessonId: string;
  mode: "trail" | "practice" | "challenge";
  activityIds: string[];
  current: number;
  attempts: Attempt[];
  finished: boolean;
  createdAt: number;
  challengeId?: string;
}
export interface Challenge {
  id: string;
  title: string;
  lessonId: string;
  activityIds: string[];
  kind: "async" | "live";
  status: "waiting" | "active" | "closed";
  current: number;
  deadline: number;
  createdBy: string;
  createdAt: number;
}
export interface Job {
  id: string;
  kind: "generate" | "pdf" | "suggest";
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  message: string;
  createdAt: number;
  input: Record<string, unknown>;
  resultId?: string;
  leaseUntil?: number;
  tries: number;
}
export interface Invite {
  id: string;
  nickname: string;
  role: "educator" | "student";
  profileId?: string;
  revoked: boolean;
  expiresAt: number;
  child: boolean;
  used: boolean;
}
export interface Workspace {
  group: Group;
  role: Role;
  profile: Profile;
  profiles: Profile[];
  lessons: Lesson[];
  materials: Material[];
  sessions: Session[];
  challenges: Challenge[];
  jobs: Job[];
  invites: Invite[];
}

export function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}
export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (
    typeof value !== "string" ||
    !/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())
  )
    return null;
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
export function validateActivity(input: unknown): Activity {
  const a = activitySchema.parse(input);
  const fail = (message: string) => {
    throw new Error(message);
  };
  if (
    a.type === "choice" &&
    (a.solution >= a.options.length ||
      new Set(a.options.map(normalize)).size !== a.options.length)
  )
    fail("Alternativas ou gabarito inválidos.");
  if (
    a.type === "blank" &&
    (a.prompt.match(/___/g)?.length !== 1 ||
      (a.bank.length > 0 &&
        a.solution.some((v) => !a.bank.map(normalize).includes(normalize(v)))))
  )
    fail("Use uma lacuna ___ e inclua as respostas aceitas no banco.");
  if (a.type === "order") {
    const ids = a.items.map((v) => v.id);
    if (
      new Set(ids).size !== ids.length ||
      a.solution.length !== ids.length ||
      new Set(a.solution).size !== ids.length ||
      a.solution.some((v) => !ids.includes(v))
    )
      fail("A ordem deve conter todos os itens uma vez.");
  }
  if (
    a.type === "match" &&
    (new Set(a.pairs.map((v) => v.id)).size !== a.pairs.length ||
      new Set(a.pairs.map((v) => normalize(v.right))).size !== a.pairs.length)
  )
    fail("Os pares devem ter identificadores e destinos únicos.");
  if (
    a.type === "classify" &&
    (new Set(a.items.map((v) => v.id)).size !== a.items.length ||
      new Set(a.categories.map(normalize)).size !== a.categories.length ||
      Object.keys(a.solution).length !== a.items.length ||
      a.items.some((v) => !a.categories.includes(a.solution[v.id])))
  )
    fail("Classifique cada item em uma categoria válida.");
  if (a.type === "numeric" && a.arithmetic) {
    const { a: x, b, op } = a.arithmetic;
    if (Math.abs(arithmetic(x, b, op) - a.solution) > 1e-9)
      fail("O gabarito não confere com a operação.");
  }
  return a;
}
export function arithmetic(
  a: number,
  b: number,
  op: "+" | "-" | "*" | "/",
): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || (op === "/" && b === 0))
    throw new Error("Operação inválida.");
  const n =
    op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b;
  if (!Number.isFinite(n)) throw new Error("Resultado inválido.");
  return n;
}
export function grade(a: Activity, answer: Answer): boolean | null {
  if (a.type === "open") return null;
  if (a.type === "numeric") {
    const n = parseNumber(answer);
    return (
      n !== null &&
      Math.abs(n - a.solution) <=
        a.tolerance +
          Number.EPSILON * Math.max(1, Math.abs(n), Math.abs(a.solution)) * 4
    );
  }
  if (a.type === "blank")
    return (
      typeof answer === "string" &&
      a.solution.some((s) => normalize(s) === normalize(answer))
    );
  if (a.type === "choice" || a.type === "boolean") return answer === a.solution;
  if (a.type === "order")
    return (
      Array.isArray(answer) &&
      answer.length === a.solution.length &&
      answer.every((v, i) => v === a.solution[i])
    );
  if (typeof answer !== "object" || Array.isArray(answer) || answer === null)
    return false;
  if (a.type === "match")
    return (
      Object.keys(answer).length === a.pairs.length &&
      a.pairs.every((p) => answer[p.id] === p.id)
    );
  return (
    Object.keys(answer).length === a.items.length &&
    a.items.every((p) => answer[p.id] === a.solution[p.id])
  );
}
function hashKey(value: string): string {
  let h = 2166136261;
  for (const c of value) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
function pairKey(a: Activity, right: string): string {
  return "r_" + hashKey(a.id + ":" + a.version + ":" + right);
}
export function publicActivity(a: Activity): PublicActivity {
  const {
    solution: _s,
    hint: _h,
    explanation: _e,
    rubric: _r,
    arithmetic: _a,
    pairs: _p,
    ...rest
  } = a as Activity & {
    solution?: unknown;
    rubric?: string;
    arithmetic?: unknown;
    pairs?: { id: string; left: string; right: string }[];
  };
  if (a.type !== "match") return rest as PublicActivity;
  // Right keys depend on the text, never the left identifier or pair position.
  const entries = a.pairs
    .map((p) => ({ id: pairKey(a, p.right), text: p.right }))
    .sort((x, y) => x.text.localeCompare(y.text, "pt-BR"));
  return {
    ...rest,
    pairs: a.pairs.map((p) => ({ id: p.id, left: p.left })),
    rightOptions: entries,
  } as PublicActivity;
}
export function decodeAnswer(a: Activity, answer: Answer): Answer {
  if (
    a.type !== "match" ||
    typeof answer !== "object" ||
    Array.isArray(answer) ||
    answer === null
  )
    return answer;
  return Object.fromEntries(
    Object.entries(answer).map(([left, right]) => [
      left,
      a.pairs.find((p) => pairKey(a, p.right) === right)?.id ?? "invalid",
    ]),
  );
}
export function solutionLabel(a: Activity): string {
  switch (a.type) {
    case "choice":
      return a.options[a.solution];
    case "boolean":
      return a.solution ? "Verdadeiro" : "Falso";
    case "blank":
      return a.solution.join(" / ");
    case "numeric":
      return String(a.solution) + (a.unit ? " " + a.unit : "");
    case "order":
      return a.solution
        .map((id) => a.items.find((i) => i.id === id)?.text)
        .join(" → ");
    case "match":
      return a.pairs.map((p) => p.left + " → " + p.right).join("; ");
    case "classify":
      return a.items.map((i) => i.text + " → " + a.solution[i.id]).join("; ");
    case "open":
      return a.rubric;
  }
}
export function defaultTheme(stage: Stage): Theme {
  return stage === "fundamental-inicial"
    ? "playful"
    : stage === "superior"
      ? "academic"
      : "calm";
}
export function ranked(
  scores: { profileId: string; nickname: string; points: number }[],
) {
  const sorted = [...scores].sort(
    (a, b) =>
      b.points - a.points || a.nickname.localeCompare(b.nickname, "pt-BR"),
  );
  return sorted.map((s, i) => ({
    ...s,
    rank:
      i && sorted[i - 1].points === s.points
        ? sorted.findIndex((v) => v.points === s.points) + 1
        : i + 1,
  }));
}
