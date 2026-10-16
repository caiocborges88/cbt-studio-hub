import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHash, randomUUID } from "node:crypto";
import { firestoreDatabase } from "../functions/src/store";
import { execute, type Dependencies } from "../shared/service";
import type { Group, Lesson, Session, Workspace } from "../shared/domain";
import { examples } from "../shared/fixtures";
let app: ReturnType<typeof initializeApp>;
let deps: Dependencies;
beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw Error("Execute via npm run test:rules.");
  app = initializeApp({ projectId: "demo-cbt-studio" });
  deps = {
    db: firestoreDatabase,
    now: Date.now,
    id: randomUUID,
    token: () => randomUUID().replaceAll("-", "").repeat(2),
    hash: (s) => createHash("sha256").update(s).digest("hex"),
    aiDailyLimit: 3,
    ocrDailyPageLimit: 10,
  };
});
afterAll(async () => {
  await deleteApp(app);
});
const identity = { uid: "integration-admin", adult: true };
const run = <T = unknown>(
  action: string,
  input: Record<string, unknown> = {},
  requestId = randomUUID(),
) => execute(deps, identity, action, input, requestId) as Promise<T>;
describe("real Firestore transaction adapter", () => {
  it("runs group, lesson, session and response receipts against Firestore", async () => {
    const group = await run<Group>("createGroup", {
      title: "Integração",
      nickname: "Aluno adulto",
      stage: "superior",
    });
    const activities = examples("superior").filter((a) => a.type === "numeric");
    const lesson = await run<Lesson>("saveLesson", {
      groupId: group.id,
      title: "Porcentagem",
      subject: "Matemática",
      stage: "superior",
      activities,
      publish: true,
    });
    const session = await run<Session>("start", {
      groupId: group.id,
      lessonId: lesson.id,
      mode: "trail",
      size: 1,
    });
    const requestId = randomUUID();
    const input = {
      groupId: group.id,
      sessionId: session.id,
      activityId: session.activityIds[0],
      answer: "50",
    };
    await Promise.all([
      run("submit", input, requestId),
      run("submit", input, requestId),
    ]);
    await run("advance", { groupId: group.id, sessionId: session.id });
    const w = await run<Workspace>("workspace", { groupId: group.id });
    expect(w.sessions[0].finished).toBe(true);
    expect(w.sessions[0].attempts).toHaveLength(1);
    expect(w.sessions[0].attempts[0].points).toBe(100);
    const raw = await getFirestore()
      .doc("groups/" + group.id + "/sessions/" + session.id)
      .get();
    expect(raw.exists).toBe(true);
  }, 20000);
  it("rejects schema errors before committing a write", async () => {
    await expect(
      run("createGroup", { title: "", nickname: "A", stage: "superior" }),
    ).rejects.toThrow();
  });
});
