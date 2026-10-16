import { z } from "zod";
import { dailyQuotaEnabled, dailyQuotaReached } from "./quota.js";
import {
  type Activity,
  type Answer,
  type Attempt,
  type Challenge,
  type Group,
  type Invite,
  type Job,
  type Lesson,
  type Material,
  type Member,
  type Profile,
  type Session,
  type Stage,
  type Workspace,
  decodeAnswer,
  defaultTheme,
  grade,
  publicActivity,
  ranked,
  solutionLabel,
  stages,
  types,
  validateActivity,
  normalize,
  parseNumber,
  canUploadAnswers,
} from "./domain.js";

export interface Store {
  get<T>(path: string): Promise<T | null>;
  list<T>(path: string): Promise<T[]>;
  set(path: string, value: unknown): void;
  delete(path: string): void;
}
export interface Database {
  atomic<T>(work: (store: Store) => Promise<T>): Promise<T>;
}
export interface Identity {
  uid: string;
  adult: boolean;
}
export interface Dependencies {
  db: Database;
  now: () => number;
  id: () => string;
  token: () => string;
  hash: (value: string) => string;
  aiDailyLimit: number;
  ocrDailyPageLimit: number;
  aiAllowedGroupIds?: string[];
}
export class AppError extends Error {
  constructor(
    public code:
      | "permission-denied"
      | "invalid-argument"
      | "not-found"
      | "failed-precondition"
      | "resource-exhausted"
      | "already-exists",
    message: string,
  ) {
    super(message);
  }
}
function fail(
  message: string,
  code: AppError["code"] = "invalid-argument",
): never {
  throw new AppError(code, message);
}
const ident = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const title = z.string().trim().min(1).max(180);
const answerSchema = z.union([
  z.string().max(16000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(100)).max(20),
  z.record(z.string().max(100), z.string().max(500)),
]);
const common = z.object({ groupId: ident });
const ref = (g: string, collection: string, id: string) =>
  "groups/" + g + "/" + collection + "/" + id;
const stageSchema = z.enum(stages);
export const generateSchema = z.object({
  title,
  subject: title,
  stage: stageSchema,
  difficulty: z.enum(["introducao", "pratica", "aprofundamento"]),
  objectives: z.string().trim().min(3).max(2000),
  count: z.number().int().min(1).max(30),
  types: z.array(z.enum(types)).min(1).max(8),
  materialId: ident,
  pageNumbers: z.array(z.number().int().min(1)).min(1).max(20),
  lessonId: ident.optional(),
  replaceId: ident.optional(),
});
export function scoreSession(session: Session): number {
  const best = new Map<string, number>();
  for (const a of session.attempts)
    best.set(a.activityId, Math.max(best.get(a.activityId) || 0, a.points));
  return [...best.values()].reduce((n, p) => n + p, 0);
}
function redactAttempt(attempt: Attempt): Attempt {
  const { suggestion: _suggestion, ...visible } = attempt;
  return { ...visible, correct: null, points: 0, feedback: "" };
}
export async function execute(
  deps: Dependencies,
  auth: Identity,
  action: string,
  raw: unknown,
  requestId: string,
): Promise<unknown> {
  ident.parse(requestId);
  return deps.db.atomic(async (s) => {
    const now = deps.now();
    const receiptPath = "receipts/" + deps.hash(auth.uid + ":" + requestId);
    const mutation = ![
      "groups",
      "workspace",
      "lesson",
      "session",
      "leaderboard",
      "hint",
      "file",
      "reviewContext",
    ].includes(action);
    const fingerprint = deps.hash(
      JSON.stringify(raw, (_key, value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(
              Object.keys(value)
                .sort()
                .map((key) => [key, value[key]]),
            )
          : value,
      ) ?? "null",
    );
    type ReceiptScope = {
      groupId: string;
      role: Member["role"];
      profileId: string;
      provider: Member["provider"];
      adult: boolean;
    };
    if (mutation) {
      const old = await s.get<{
        action: string;
        result: unknown;
        fingerprint?: string;
        scope?: ReceiptScope;
        createdAt: number;
      }>(receiptPath);
      if (old) {
        if (old.action !== action || old.fingerprint !== fingerprint)
          fail("Identificador reutilizado. Envie uma nova solicitação.");
        if (!old.scope || old.createdAt < now - 7 * 86400000)
          fail(
            "Solicitação antiga. Envie uma nova solicitação.",
            "failed-precondition",
          );
        const member = await s.get<Member>(
          ref(old.scope.groupId, "members", auth.uid),
        );
        if (
          !member?.active ||
          member.role !== old.scope.role ||
          member.profileId !== old.scope.profileId ||
          member.provider !== old.scope.provider ||
          auth.adult !== old.scope.adult
        )
          fail(
            "Seu acesso mudou. Envie uma nova solicitação.",
            "permission-denied",
          );
        return old.result;
      }
    }
    const run = async (): Promise<unknown> => {
      if (action === "groups") {
        const memberships = await s.list<{ id: string }>(
          "users/" + auth.uid + "/groups",
        );
        const found: Group[] = [];
        for (const m of memberships) {
          const member = await s.get<Member>(ref(m.id, "members", auth.uid));
          const group = await s.get<Group>("groups/" + m.id);
          if (member?.active && group) found.push(group);
        }
        return found;
      }
      if (action === "createGroup") {
        if (!auth.adult)
          fail(
            "Entre com uma conta de adulto para criar um espaço.",
            "permission-denied",
          );
        const input = z
          .object({ title, nickname: title, stage: stageSchema })
          .parse(raw);
        const groupId = deps.id();
        const profileId = deps.id();
        const group: Group = {
          id: groupId,
          title: input.title,
          ownerUid: auth.uid,
          createdAt: now,
        };
        const profile: Profile = {
          id: profileId,
          nickname: input.nickname,
          stage: input.stage,
          theme: defaultTheme(input.stage),
          avatar: "🌿",
          subject: "",
          child: false,
          ageBand: "15-plus",
          ownerUid: auth.uid,
        };
        s.set("groups/" + groupId, group);
        s.set(ref(groupId, "profiles", profileId), profile);
        s.set(ref(groupId, "members", auth.uid), {
          id: auth.uid,
          profileId,
          role: "admin",
          active: true,
          provider: "adult",
        } satisfies Member);
        s.set("users/" + auth.uid + "/groups/" + groupId, { id: groupId });
        return group;
      }
      if (action === "redeem") {
        const { code } = z
          .object({ code: z.string().regex(/^[a-f0-9]{64}$/) })
          .parse(raw);
        const tokenPath = "inviteTokens/" + deps.hash(code);
        const pointer = await s.get<{ groupId: string; inviteId: string }>(
          tokenPath,
        );
        if (!pointer) fail("Convite inválido ou revogado.", "not-found");
        const inv = await s.get<Invite>(
          ref(pointer.groupId, "invites", pointer.inviteId),
        );
        if (!inv || inv.revoked || inv.used || inv.expiresAt < now)
          fail("Convite expirado, usado ou revogado.", "failed-precondition");
        if (inv.child === auth.adult)
          fail(
            inv.child
              ? "Use a entrada de estudante por código."
              : "Entre na sua conta antes de aceitar.",
            "permission-denied",
          );
        const current = await s.get<Member>(
          ref(pointer.groupId, "members", auth.uid),
        );
        if (current?.active)
          fail("Você já participa deste grupo.", "already-exists");
        let profileId = inv.profileId;
        if (inv.child) {
          if (!profileId) fail("Perfil infantil não encontrado.");
          const p = await s.get<Profile>(
            ref(pointer.groupId, "profiles", profileId),
          );
          if (!p) fail("Perfil não encontrado.", "not-found");
          s.set(ref(pointer.groupId, "profiles", profileId), {
            ...p,
            ownerUid: auth.uid,
          });
        } else {
          profileId = deps.id();
          s.set(ref(pointer.groupId, "profiles", profileId), {
            id: profileId,
            nickname: inv.nickname,
            avatar: "🌿",
            stage: "superior",
            theme: "academic",
            subject: "",
            child: false,
            ageBand: "15-plus",
            ownerUid: auth.uid,
          } satisfies Profile);
        }
        s.set(ref(pointer.groupId, "members", auth.uid), {
          id: auth.uid,
          role: inv.role,
          profileId: profileId!,
          active: true,
          provider: inv.child ? "child" : "adult",
        } satisfies Member);
        s.set(ref(pointer.groupId, "invites", inv.id), {
          ...inv,
          used: true,
          boundUid: auth.uid,
        });
        s.set("users/" + auth.uid + "/groups/" + pointer.groupId, {
          id: pointer.groupId,
        });
        return { groupId: pointer.groupId };
      }
      const { groupId } = common.parse(raw);
      const data = raw as Record<string, unknown>;
      const member = await s.get<Member>(ref(groupId, "members", auth.uid));
      if (!member?.active)
        fail("Você não tem acesso a este grupo.", "permission-denied");
      const isEditor =
        auth.adult && ["admin", "educator"].includes(member.role);
      const editor = () => {
        if (!isEditor)
          fail(
            "Esta ação exige um responsável ou educador.",
            "permission-denied",
          );
      };
      const profileFor = async (profileId?: string): Promise<Profile> => {
        const p = await s.get<Profile>(
          ref(groupId, "profiles", profileId || member.profileId),
        );
        if (!p || (p.id !== member.profileId && p.guardianUid !== auth.uid))
          fail(
            "Este perfil não está sob sua responsabilidade.",
            "permission-denied",
          );
        return p;
      };
      const hydrateSession = async (session: Session): Promise<Session> => ({
        ...session,
        attempts:
          session.attempts ||
          (
            await s.list<Attempt>(
              ref(groupId, "sessions", session.id) + "/attempts",
            )
          ).sort((a, b) => a.createdAt - b.createdAt || a.tries - b.tries),
      });
      const getSession = async (sessionId: string): Promise<Session | null> => {
        const session = await s.get<Session>(
          ref(groupId, "sessions", sessionId),
        );
        return session ? hydrateSession(session) : null;
      };
      const allSessions = async (): Promise<Session[]> =>
        Promise.all(
          (await s.list<Session>(ref(groupId, "sessions", ""))).map(
            hydrateSession,
          ),
        );
      const saveSession = (session: Session) => {
        const { attempts: _attempts, ...metadata } = session;
        s.set(ref(groupId, "sessions", session.id), metadata);
      };
      const sessionFor = async (sessionId: string) => {
        const session = await getSession(sessionId);
        if (!session) fail("Sessão não encontrada.", "not-found");
        if (session.ownerUid !== auth.uid)
          fail(
            "Esta sessão pertence a outro participante.",
            "permission-denied",
          );
        return session;
      };
      const challengeFor = async (session: Session) =>
        session.challengeId
          ? await s.get<Challenge>(
              ref(groupId, "challenges", session.challengeId),
            )
          : null;
      const getActivity = async (activityId: string): Promise<Activity> => {
        const a = await s.get<Activity>(ref(groupId, "activities", activityId));
        if (!a) fail("Atividade não encontrada.", "not-found");
        return a;
      };
      if (action === "workspace") {
        const group = await s.get<Group>("groups/" + groupId);
        if (!group) fail("Grupo não encontrado.", "not-found");
        const profile = await profileFor();
        const sessions = await allSessions();
        const challenges = await s.list<Challenge>(
          ref(groupId, "challenges", ""),
        );
        const filtered = sessions
          .filter((v) => isEditor || v.ownerUid === auth.uid)
          .map((session) => {
            const c = challenges.find((v) => v.id === session.challengeId);
            if (c && c.status !== "closed" && c.deadline > now)
              return {
                ...session,
                attempts: session.attempts.map(redactAttempt),
              };
            return c && (c.status === "closed" || c.deadline <= now)
              ? { ...session, finished: true }
              : session;
          });
        const lessons = await s.list<Lesson>(ref(groupId, "lessons", ""));
        const materials = await s.list<Material>(ref(groupId, "materials", ""));
        const publishedMaterials = new Set(
          lessons.filter((l) => l.published).map((l) => l.materialId),
        );
        return {
          ai: {
            available:
              dailyQuotaEnabled(deps.aiDailyLimit) &&
              (!deps.aiAllowedGroupIds ||
                deps.aiAllowedGroupIds.includes(groupId)),
            message:
              "IA pausada neste grupo. Você pode importar texto, criar atividades manualmente e usar exercícios de matemática.",
          },
          group,
          role: member.role,
          profile,
          profiles: isEditor
            ? await s.list<Profile>(ref(groupId, "profiles", ""))
            : [profile],
          lessons: lessons.filter((l) => isEditor || l.published),
          materials: materials.filter(
            (m) => isEditor || publishedMaterials.has(m.id),
          ),
          sessions: filtered,
          challenges: challenges.map((c) =>
            c.status !== "closed" && c.deadline <= now
              ? { ...c, status: "closed" }
              : c,
          ),
          jobs: isEditor ? await s.list<Job>(ref(groupId, "jobs", "")) : [],
          invites: isEditor
            ? await s.list<Invite>(ref(groupId, "invites", ""))
            : [],
        } satisfies Workspace;
      }
      if (action === "updateProfile") {
        const input = z
          .object({
            profileId: ident,
            nickname: title,
            avatar: z.string().min(1).max(10),
            stage: stageSchema,
            theme: z.enum(["playful", "calm", "academic"]),
            subject: z.string().max(160),
          })
          .parse(data);
        const old = await profileFor(input.profileId);
        const next = {
          ...old,
          nickname: input.nickname,
          avatar: input.avatar,
          stage: input.stage,
          theme: input.theme,
          subject: input.subject,
        };
        s.set(ref(groupId, "profiles", old.id), next);
        return next;
      }
      if (action === "createProfile") {
        editor();
        const input = z
          .object({
            nickname: title,
            stage: stageSchema,
            avatar: z.string().max(10).default("🦊"),
            ageBand: z.enum(["up-to-14", "15-plus"]).default("up-to-14"),
          })
          .parse(data);
        const profile: Profile = {
          id: deps.id(),
          nickname: input.nickname,
          stage: input.stage,
          theme: defaultTheme(input.stage),
          avatar: input.avatar,
          subject: "",
          child: true,
          ageBand: input.ageBand,
          guardianUid: auth.uid,
        };
        s.set(ref(groupId, "profiles", profile.id), profile);
        return profile;
      }
      if (action === "setProfileAgeBand") {
        editor();
        const input = z
          .object({
            profileId: ident,
            ageBand: z.enum(["up-to-14", "15-plus"]),
          })
          .parse(data);
        const profile = await s.get<Profile>(
          ref(groupId, "profiles", input.profileId),
        );
        if (!profile?.child)
          fail("Selecione um perfil sob responsabilidade de adulto.");
        s.set(ref(groupId, "profiles", profile.id), {
          ...profile,
          ageBand: input.ageBand,
        });
        return { ok: true };
      }
      if (action === "invite") {
        editor();
        const input = z
          .object({
            nickname: title,
            role: z.enum(["educator", "student"]),
            child: z.boolean(),
            profileId: ident.optional(),
          })
          .parse(data);
        if (input.role === "educator" && member.role !== "admin")
          fail(
            "Apenas o administrador convida educadores.",
            "permission-denied",
          );
        if (input.child) {
          if (input.role !== "student" || !input.profileId)
            fail("Selecione o perfil do estudante.");
          const p = await profileFor(input.profileId);
          if (!p.child) fail("Selecione um perfil infantil.");
        }
        if (input.child) {
          const prior = (
            await s.list<Invite & { boundUid?: string }>(
              ref(groupId, "invites", ""),
            )
          ).filter((v) => v.profileId === input.profileId && !v.revoked);
          for (const old of prior) {
            const bound = old.boundUid
              ? await s.get<Member>(ref(groupId, "members", old.boundUid))
              : null;
            s.set(ref(groupId, "invites", old.id), { ...old, revoked: true });
            if (bound)
              s.set(ref(groupId, "members", bound.id), {
                ...bound,
                active: false,
              });
          }
        }
        const code = deps.token();
        const invite: Invite = {
          id: deps.id(),
          nickname: input.nickname,
          role: input.role,
          child: input.child,
          revoked: false,
          used: false,
          expiresAt: now + 7 * 86400000,
          ...(input.profileId ? { profileId: input.profileId } : {}),
        };
        s.set(ref(groupId, "invites", invite.id), invite);
        s.set("inviteTokens/" + deps.hash(code), {
          groupId,
          inviteId: invite.id,
        });
        return { ...invite, code };
      }
      if (action === "revokeInvite") {
        editor();
        const inviteId = ident.parse(data.inviteId);
        const inv = await s.get<Invite & { boundUid?: string }>(
          ref(groupId, "invites", inviteId),
        );
        if (!inv) fail("Convite não encontrado.", "not-found");
        if (inv.role === "educator" && member.role !== "admin")
          fail(
            "Apenas o administrador revoga educadores.",
            "permission-denied",
          );
        if (inv.profileId) await profileFor(inv.profileId);
        s.set(ref(groupId, "invites", inviteId), { ...inv, revoked: true });
        if (inv.boundUid) {
          const m = await s.get<Member>(ref(groupId, "members", inv.boundUid));
          if (m)
            s.set(ref(groupId, "members", inv.boundUid), {
              ...m,
              active: false,
            });
        }
        return { ok: true };
      }
      if (action === "saveMaterial") {
        editor();
        const input = z
          .object({
            id: ident.optional(),
            title,
            pages: z
              .array(
                z.object({
                  number: z.number().int().positive(),
                  chapter: z.string().max(180),
                  text: z.string().max(40000),
                  needsReview: z.boolean(),
                }),
              )
              .min(1)
              .max(100),
            reviewed: z.boolean(),
          })
          .parse(data);
        if (
          new Set(input.pages.map((p) => p.number)).size !== input.pages.length
        )
          fail("Páginas duplicadas.");
        if (
          new TextEncoder().encode(JSON.stringify(input.pages)).length > 700000
        )
          fail("Divida este material em volumes menores.");
        if (
          input.reviewed &&
          input.pages.some((p) => !p.text.trim() || p.needsReview)
        )
          fail("Revise as páginas marcadas antes de confirmar.");
        const old = input.id
          ? await s.get<Material>(ref(groupId, "materials", input.id))
          : null;
        const material: Material = {
          ...old,
          id: input.id || deps.id(),
          title: input.title,
          pages: [...input.pages].sort((a, b) => a.number - b.number),
          reviewed: input.reviewed,
          createdAt: old?.createdAt || now,
        };
        s.set(ref(groupId, "materials", material.id), material);
        return material;
      }
      const verifySource = async (a: Activity, materialId?: string) => {
        if (!materialId) return;
        if (a.type === "numeric" && a.arithmetic && !a.source) return;
        const m = await s.get<Material>(ref(groupId, "materials", materialId));
        const page = m?.pages.find((p) => p.number === a.source?.page);
        if (
          !m?.reviewed ||
          !page ||
          page.needsReview ||
          a.source?.materialId !== materialId ||
          !a.source.quote.trim() ||
          !normalize(page.text).includes(normalize(a.source.quote))
        )
          fail(
            "A atividade precisa citar um trecho válido do material revisado.",
          );
      };
      if (action === "saveLesson") {
        editor();
        const input = z
          .object({
            id: ident.optional(),
            title,
            subject: title,
            stage: stageSchema,
            materialId: ident.optional(),
            activities: z.array(z.unknown()).min(1).max(100),
            publish: z.boolean(),
          })
          .parse(data);
        const old = input.id
          ? await s.get<Lesson>(ref(groupId, "lessons", input.id))
          : null;
        const activities: Activity[] = [];
        for (const candidate of input.activities) {
          const a = validateActivity(candidate);
          if (a.stage !== input.stage)
            fail("A etapa das atividades deve corresponder à trilha.");
          await verifySource(a, input.materialId);
          activities.push({
            ...a,
            id: deps.id(),
            version: a.version + (old?.published ? 1 : 0),
          });
        }
        const lesson: Lesson = {
          id:
            old?.published && !input.publish
              ? deps.id()
              : input.id || deps.id(),
          title: input.title,
          subject: input.subject,
          stage: input.stage,
          activityIds: activities.map((a) => a.id),
          published: input.publish,
          createdAt: old?.createdAt || now,
          createdBy: old?.createdBy || auth.uid,
          ...(input.materialId ? { materialId: input.materialId } : {}),
        };
        for (const a of activities) s.set(ref(groupId, "activities", a.id), a);
        s.set(ref(groupId, "lessons", lesson.id), lesson);
        return lesson;
      }
      if (action === "lesson") {
        editor();
        const lesson = await s.get<Lesson>(
          ref(groupId, "lessons", ident.parse(data.lessonId)),
        );
        if (!lesson) fail("Trilha não encontrada.", "not-found");
        const activities: Activity[] = [];
        for (const activityId of lesson.activityIds)
          activities.push(await getActivity(activityId));
        return { lesson, activities };
      }
      if (action === "start") {
        const input = z
          .object({
            lessonId: ident,
            profileId: ident.optional(),
            mode: z.enum(["trail", "practice", "challenge"]),
            size: z.number().int().min(1).max(100).default(5),
            type: z.enum(types).optional(),
            difficulty: z
              .enum(["introducao", "pratica", "aprofundamento"])
              .optional(),
            challengeId: ident.optional(),
          })
          .parse(data);
        const profile = await profileFor(input.profileId);
        const lesson = await s.get<Lesson>(
          ref(groupId, "lessons", input.lessonId),
        );
        if (!lesson || (!lesson.published && input.mode !== "challenge"))
          fail("Trilha não publicada.", "failed-precondition");
        let ids = [...lesson.activityIds];
        let challenge: Challenge | null = null;
        const sessionHistory = await allSessions();
        if (input.mode === "challenge") {
          if (!input.challengeId) fail("Escolha um desafio.");
          challenge = await s.get<Challenge>(
            ref(groupId, "challenges", input.challengeId),
          );
          if (
            !challenge ||
            challenge.lessonId !== lesson.id ||
            challenge.status === "closed" ||
            challenge.deadline <= now
          )
            fail("Este desafio já encerrou.", "failed-precondition");
          ids = [...challenge.activityIds];
          const existing = sessionHistory.find(
            (v) =>
              v.challengeId === challenge!.id && v.profileId === profile.id,
          );
          if (existing) {
            if (existing.ownerUid !== auth.uid)
              fail(
                "Este perfil já participa em outro dispositivo.",
                "already-exists",
              );
            return { ...existing, attempts: [] };
          }
          if (challenge.kind === "live" && challenge.status !== "waiting")
            fail("A sala já começou.", "failed-precondition");
        } else {
          if (input.type || input.difficulty) {
            const filtered: string[] = [];
            for (const id of ids) {
              const a = await getActivity(id);
              if (
                (!input.type || a.type === input.type) &&
                (!input.difficulty || a.difficulty === input.difficulty)
              )
                filtered.push(id);
            }
            ids = filtered;
          }
          const history = sessionHistory
            .filter((v) => v.profileId === profile.id && v.mode !== "challenge")
            .flatMap((v) => v.attempts);
          const hard = new Set(
            history
              .filter((v) => !v.correct || v.usedHint)
              .map((v) => v.activityId),
          );
          ids.sort((a, b) => Number(hard.has(b)) - Number(hard.has(a)));
          ids = ids.slice(0, input.size);
        }
        if (!ids.length)
          fail("Não há atividades com estes filtros.", "failed-precondition");
        if (!challenge) {
          const previous = sessionHistory.find(
            (v) =>
              !v.finished &&
              v.ownerUid === auth.uid &&
              v.profileId === profile.id &&
              v.lessonId === lesson.id &&
              v.mode === input.mode &&
              JSON.stringify(v.activityIds) === JSON.stringify(ids),
          );
          if (previous) return { ...previous, attempts: [] };
        }
        const session: Session = {
          id: deps.id(),
          profileId: profile.id,
          ownerUid: auth.uid,
          lessonId: lesson.id,
          mode: input.mode,
          activityIds: ids,
          current: 0,
          attempts: [],
          finished: false,
          createdAt: now,
          ...(challenge ? { challengeId: challenge.id } : {}),
        };
        saveSession(session);
        return session;
      }
      if (action === "session") {
        const session = await sessionFor(ident.parse(data.sessionId));
        const challenge = await challengeFor(session);
        const current =
          challenge?.kind === "live" ? challenge.current : session.current;
        const closed =
          !!challenge &&
          (challenge.status === "closed" || challenge.deadline <= now);
        const active = challenge
          ? challenge.status === "active" && !closed
          : !session.finished;
        const a =
          current < session.activityIds.length
            ? await getActivity(session.activityIds[current])
            : null;
        const visible =
          challenge && !closed
            ? {
                ...session,
                attempts: session.attempts.map(redactAttempt),
              }
            : session;
        let review: { id: string; solution: string; explanation: string }[] =
          [];
        if (closed || (!challenge && session.finished))
          for (const id of session.activityIds) {
            const item = await getActivity(id);
            review.push({
              id,
              solution: solutionLabel(item),
              explanation: item.explanation,
            });
          }
        return {
          session: visible,
          activity: a && active ? publicActivity(a) : null,
          current,
          challenge,
          closed,
          review,
        };
      }
      if (action === "hint") {
        const session = await sessionFor(ident.parse(data.sessionId));
        if (session.mode === "challenge" || session.finished)
          fail("Dicas indisponíveis nesta sessão.", "failed-precondition");
        const a = await getActivity(session.activityIds[session.current]);
        s.set(ref(groupId, "hints", session.id + "_" + a.id), { used: true });
        return { hint: a.hint };
      }
      if (action === "submit") {
        const input = z
          .object({
            sessionId: ident,
            activityId: ident,
            answer: answerSchema,
            photoPath: z.string().max(300).optional(),
          })
          .parse(data);
        const session = await sessionFor(input.sessionId);
        const challenge = await challengeFor(session);
        if (
          session.finished ||
          (challenge &&
            (challenge.status !== "active" || challenge.deadline <= now))
        )
          fail("A sessão não está recebendo respostas.", "failed-precondition");
        const index =
          challenge?.kind === "live" ? challenge.current : session.current;
        if (session.activityIds[index] !== input.activityId)
          fail("A atividade mudou. Atualize a sessão.", "failed-precondition");
        const a = await getActivity(input.activityId);
        const value = input.answer;
        if (
          a.type === "choice" &&
          (typeof value !== "number" ||
            !Number.isInteger(value) ||
            value < 0 ||
            value >= a.options.length)
        )
          fail("Escolha uma alternativa válida.");
        if (a.type === "boolean" && typeof value !== "boolean")
          fail("Escolha verdadeiro ou falso.");
        if (a.type === "numeric" && parseNumber(value) === null)
          fail("Digite um número válido, sem a unidade.");
        if (
          a.type === "blank" &&
          (typeof value !== "string" || !value.trim() || value.length > 200)
        )
          fail("Digite uma resposta curta para a lacuna.");
        const previous = session.attempts.filter((v) => v.activityId === a.id);
        if (challenge && previous.length)
          fail("A resposta já foi registrada.", "already-exists");
        if (
          !challenge &&
          previous.some((v) => v.correct === true || v.review !== "none")
        )
          fail("Avance para a próxima atividade.", "failed-precondition");
        if (
          a.type === "open" &&
          (typeof input.answer !== "string" ||
            (!input.answer.trim() && !input.photoPath))
        )
          fail("Escreva uma resposta ou anexe uma foto.");
        if (
          input.photoPath &&
          !canUploadAnswers(
            await profileFor(session.profileId),
            auth.adult,
            member.role,
          )
        )
          fail(
            "Arquivos deste perfil devem ser enviados pelo responsável ou professor.",
            "permission-denied",
          );
        if (
          input.photoPath &&
          (!input.photoPath.startsWith(
            "groups/" + groupId + "/answers/" + auth.uid + "/",
          ) ||
            input.photoPath.includes(".."))
        )
          fail("Anexo inválido.");
        if (input.photoPath && a.type !== "open")
          fail("Este formato não aceita anexo.");
        const correct = grade(a, decodeAnswer(a, input.answer as Answer));
        const hint = await s.get<{ used: boolean }>(
          ref(groupId, "hints", session.id + "_" + a.id),
        );
        const attempt: Attempt = {
          id: deps.id(),
          activityId: a.id,
          skill: a.skill,
          answer: input.answer as Answer,
          correct,
          points: correct ? 100 : 0,
          usedHint: !!hint?.used,
          tries: previous.length + 1,
          review: correct === null ? "pending" : "none",
          feedback: a.explanation,
          createdAt: now,
          ...(input.photoPath ? { photoPath: input.photoPath } : {}),
        };
        const next = { ...session, attempts: [...session.attempts, attempt] };
        if (challenge?.kind === "async") {
          next.current++;
          next.finished = next.current >= next.activityIds.length;
        }
        s.set(
          ref(groupId, "sessions", session.id) + "/attempts/" + attempt.id,
          attempt,
        );
        saveSession(next);
        return challenge
          ? { received: true }
          : {
              received: true,
              correct,
              explanation: a.explanation,
              solution: solutionLabel(a),
              pending: correct === null,
            };
      }
      if (action === "advance") {
        const session = await sessionFor(ident.parse(data.sessionId));
        if (session.mode === "challenge" || session.finished)
          fail("Avanço indisponível.", "failed-precondition");
        const id = session.activityIds[session.current];
        if (!session.attempts.some((v) => v.activityId === id))
          fail("Responda antes de avançar.");
        const current = session.current + 1;
        const next = {
          ...session,
          current,
          finished: current >= session.activityIds.length,
        };
        saveSession(next);
        return { id: next.id, current: next.current, finished: next.finished };
      }
      if (action === "createChallenge") {
        editor();
        const input = z
          .object({
            title,
            lessonId: ident,
            kind: z.enum(["async", "live"]),
            deadline: z
              .number()
              .int()
              .min(now + 60000)
              .max(now + 90 * 86400000),
          })
          .parse(data);
        const lesson = await s.get<Lesson>(
          ref(groupId, "lessons", input.lessonId),
        );
        if (!lesson?.published)
          fail("Publique a trilha primeiro.", "failed-precondition");
        if (lesson.activityIds.some((v) => !v)) fail("Trilha inválida.");
        // Open answers are supported, but points remain pending until human review.
        const challenge: Challenge = {
          id: deps.id(),
          title: input.title,
          lessonId: lesson.id,
          activityIds: [...lesson.activityIds],
          kind: input.kind,
          status: input.kind === "async" ? "active" : "waiting",
          current: 0,
          deadline: input.deadline,
          createdBy: auth.uid,
          createdAt: now,
        };
        s.set(ref(groupId, "challenges", challenge.id), challenge);
        return challenge;
      }
      if (action === "controlChallenge") {
        editor();
        const input = z
          .object({
            challengeId: ident,
            command: z.enum(["start", "next", "close"]),
          })
          .parse(data);
        const challenge = await s.get<Challenge>(
          ref(groupId, "challenges", input.challengeId),
        );
        if (!challenge) fail("Desafio não encontrado.", "not-found");
        if (challenge.createdBy !== auth.uid && member.role !== "admin")
          fail("Apenas o organizador controla a sala.", "permission-denied");
        if (challenge.status === "closed" || challenge.deadline <= now)
          fail("Desafio encerrado.", "failed-precondition");
        if (
          input.command === "start" &&
          (challenge.kind !== "live" || challenge.status !== "waiting")
        )
          fail("A sala não está aguardando início.");
        if (
          input.command === "next" &&
          (challenge.kind !== "live" || challenge.status !== "active")
        )
          fail("Inicie a sala primeiro.");
        const lesson = await s.get<Lesson>(
          ref(groupId, "lessons", challenge.lessonId),
        );
        if (!lesson) fail("Trilha não encontrada.");
        const next = { ...challenge };
        if (input.command === "start") next.status = "active";
        if (input.command === "next") {
          next.current++;
          if (next.current >= challenge.activityIds.length)
            next.status = "closed";
        }
        if (input.command === "close") next.status = "closed";
        s.set(ref(groupId, "challenges", next.id), next);
        return next;
      }
      if (action === "leaderboard") {
        const challenge = await s.get<Challenge>(
          ref(groupId, "challenges", ident.parse(data.challengeId)),
        );
        if (!challenge) fail("Desafio não encontrado.", "not-found");
        const sessions = (await allSessions()).filter(
          (v) => v.challengeId === challenge.id,
        );
        if (challenge.status !== "closed" && challenge.deadline > now)
          return {
            participants: sessions.length,
            answered: sessions.filter((v) =>
              v.attempts.some(
                (a) => a.activityId === v.activityIds[challenge.current],
              ),
            ).length,
            scores: [],
          };
        const profiles = await s.list<Profile>(ref(groupId, "profiles", ""));
        return {
          participants: sessions.length,
          answered: 0,
          scores: ranked(
            sessions.map((v) => ({
              profileId: v.profileId,
              nickname:
                profiles.find((p) => p.id === v.profileId)?.nickname ||
                "Estudante",
              points: scoreSession(v),
            })),
          ),
        };
      }
      if (action === "attachAnswerPhoto") {
        editor();
        const input = z
          .object({
            sessionId: ident,
            attemptId: ident,
            photoPath: z.string().max(300),
          })
          .parse(data);
        const session = await getSession(input.sessionId);
        const attempt = session?.attempts.find((a) => a.id === input.attemptId);
        if (!session || !attempt || attempt.review !== "pending")
          fail("Selecione uma resposta aberta aguardando avaliação.");
        if (
          (await getActivity(attempt.activityId)).type !== "open" ||
          attempt.photoPath
        )
          fail("Esta resposta não aceita um novo anexo.");
        if (
          !input.photoPath.startsWith(
            `groups/${groupId}/answers/${auth.uid}/`,
          ) ||
          input.photoPath.includes("..")
        )
          fail("Anexo privado.", "permission-denied");
        const { suggestion: _outdated, ...current } = attempt;
        s.set(
          ref(groupId, "sessions", session.id) + "/attempts/" + attempt.id,
          { ...current, photoPath: input.photoPath },
        );
        return { ok: true };
      }
      if (action === "confirmReview") {
        editor();
        const input = z
          .object({
            sessionId: ident,
            attemptId: ident,
            points: z.number().int().min(0).max(100),
            feedback: z.string().trim().min(1).max(3000),
          })
          .parse(data);
        const session = await getSession(input.sessionId);
        if (!session) fail("Sessão não encontrada.", "not-found");
        const a = session.attempts.find((a) => a.id === input.attemptId);
        if (!a || a.review === "none") fail("Resposta não requer correção.");
        if (session.ownerUid !== auth.uid && member.role !== "admin") {
          const lesson = await s.get<Lesson & { createdBy?: string }>(
            ref(groupId, "lessons", session.lessonId),
          );
          if (lesson?.createdBy !== auth.uid)
            fail(
              "A correção exige o criador ou administrador.",
              "permission-denied",
            );
        }
        s.set(ref(groupId, "sessions", session.id) + "/attempts/" + a.id, {
          ...a,
          points: input.points,
          correct: input.points === 100,
          review: "confirmed",
          feedback: input.feedback,
        });
        return { ok: true };
      }
      if (action === "reviewContext") {
        editor();
        const input = z
          .object({ sessionId: ident, attemptId: ident })
          .parse(data);
        const session = await getSession(input.sessionId);
        const attempt = session?.attempts.find((a) => a.id === input.attemptId);
        if (!attempt) fail("Resposta não encontrada.", "not-found");
        const activity = await getActivity(attempt.activityId);
        return {
          prompt: activity.prompt,
          rubric: activity.type === "open" ? activity.rubric : "",
          source: activity.source,
        };
      }
      if (action === "enqueue") {
        editor();
        if (deps.aiAllowedGroupIds && !deps.aiAllowedGroupIds.includes(groupId))
          fail(
            "A IA ainda não foi habilitada para este grupo na homologação.",
            "permission-denied",
          );
        const kind = z.enum(["generate", "pdf", "suggest"]).parse(data.kind);
        let input: Record<string, unknown>;
        if (kind === "generate") {
          input = generateSchema.parse(data.input);
          const m = await s.get<Material>(
            ref(groupId, "materials", String(input.materialId)),
          );
          if (
            !m?.reviewed ||
            (input.pageNumbers as number[]).some(
              (n) =>
                !m.pages.some(
                  (p) => p.number === n && !p.needsReview && p.text.trim(),
                ),
            )
          )
            fail(
              "Revise o material e selecione páginas legíveis.",
              "failed-precondition",
            );
          const selectedText = m.pages
            .filter((p) => (input.pageNumbers as number[]).includes(p.number))
            .map((p) => p.text)
            .join("\n");
          if (selectedText.length > 100000)
            fail("Selecione um trecho menor para esta geração.");
        } else if (kind === "pdf") {
          input = z
            .object({ storagePath: z.string().max(300), title })
            .parse(data.input);
          if (
            !String(input.storagePath).startsWith(
              "groups/" + groupId + "/materials/" + auth.uid + "/",
            ) ||
            String(input.storagePath).includes("..")
          )
            fail("Arquivo fora do grupo.");
        } else {
          input = z
            .object({ sessionId: ident, attemptId: ident })
            .parse(data.input);
          const session = await getSession(String(input.sessionId));
          if (
            !session?.attempts.some(
              (v) => v.id === input.attemptId && v.review === "pending",
            )
          )
            fail("Resposta pendente não encontrada.");
        }
        const limit = deps.aiDailyLimit;
        if (!dailyQuotaEnabled(limit))
          fail(
            "A cota de IA ainda não foi configurada pelo administrador.",
            "resource-exhausted",
          );
        const day = new Date(now).toISOString().slice(0, 10);
        const quotaPath = ref(groupId, "usage", day);
        const usage = (await s.get<{ calls: number; pages: number }>(
          quotaPath,
        )) || { calls: 0, pages: 0 };
        if (dailyQuotaReached(limit, usage.calls))
          fail("Cota diária de IA deste grupo atingida.", "resource-exhausted");
        const job: Job = {
          id: deps.id(),
          kind,
          input,
          status: "queued",
          progress: 0,
          message: "Na fila de processamento",
          createdAt: now,
          tries: 0,
        };
        s.set(quotaPath, { ...usage, calls: usage.calls + 1 });
        s.set(ref(groupId, "jobs", job.id), { ...job, requestedBy: auth.uid });
        return job;
      }
      if (action === "retryJob") {
        editor();
        if (deps.aiAllowedGroupIds && !deps.aiAllowedGroupIds.includes(groupId))
          fail(
            "A IA ainda não foi habilitada para este grupo na homologação.",
            "permission-denied",
          );
        const job = await s.get<Job>(
          ref(groupId, "jobs", ident.parse(data.jobId)),
        );
        if (
          !job ||
          !["failed", "running"].includes(job.status) ||
          (job.status === "running" && (job.leaseUntil || 0) > now)
        )
          fail("Esta tarefa não pode ser retomada agora.");
        if (job.tries >= 3)
          fail("Limite de três tentativas atingido. Revise o material.");
        // Retrying resumes completed chunks; provider calls may still be billed after an interrupted request.
        s.set(ref(groupId, "jobs", job.id), {
          ...job,
          status: "queued",
          message: "Retomada solicitada",
          leaseUntil: 0,
        });
        return { ok: true };
      }
      if (action === "file") {
        const path = z.string().max(400).parse(data.path);
        if (path.includes("..") || !path.startsWith("groups/" + groupId + "/"))
          fail("Arquivo inválido.");
        if (path.startsWith("groups/" + groupId + "/materials/")) {
          if (!isEditor) {
            const lessons = await s.list<Lesson>(ref(groupId, "lessons", ""));
            const mats = await s.list<Material>(ref(groupId, "materials", ""));
            if (
              !mats.some(
                (m) =>
                  m.storagePath === path &&
                  lessons.some((l) => l.published && l.materialId === m.id),
              )
            )
              fail("Material não publicado.", "permission-denied");
          }
        } else if (path.startsWith("groups/" + groupId + "/answers/")) {
          if (
            !isEditor &&
            !path.startsWith("groups/" + groupId + "/answers/" + auth.uid + "/")
          ) {
            const ownAttachment = (await allSessions()).some(
              (session) =>
                session.ownerUid === auth.uid &&
                session.attempts.some((attempt) => attempt.photoPath === path),
            );
            if (!ownAttachment) fail("Anexo privado.", "permission-denied");
          }
        } else fail("Arquivo inválido.");
        return { path };
      }
      fail("Operação desconhecida.");
    };
    const result = await run();
    if (mutation) {
      const groupId =
        action === "createGroup"
          ? (result as Group).id
          : action === "redeem"
            ? (result as { groupId: string }).groupId
            : common.parse(raw).groupId;
      const member = await s.get<Member>(ref(groupId, "members", auth.uid));
      if (!member) fail("Participação não encontrada.", "permission-denied");
      s.set(receiptPath, {
        action,
        fingerprint,
        scope: {
          groupId,
          role: member.role,
          profileId: member.profileId,
          provider: member.provider,
          adult: auth.adult,
        } satisfies ReceiptScope,
        result,
        createdAt: now,
        expiresAt: new Date(now + 7 * 86400000),
      });
    }
    return result;
  });
}
