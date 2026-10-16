import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { examples, exampleMaterial } from "../shared/fixtures";
import { type Job, type Session, type Attempt } from "../shared/domain";
vi.mock("../functions/src/ai.js", () => ({ generateJson: vi.fn() }));
vi.mock("firebase-functions/logger", () => ({ error: vi.fn() }));
import { error as logError } from "firebase-functions/logger";
import { generateJson } from "../functions/src/ai.js";
import { processJob } from "../functions/src/jobs";
const mocked = vi.mocked(generateJson);
let app: ReturnType<typeof initializeApp>;
beforeAll(() => {
  if (
    !process.env.FIRESTORE_EMULATOR_HOST ||
    !process.env.FIREBASE_STORAGE_EMULATOR_HOST
  )
    throw Error("Execute via emuladores.");
  app = initializeApp({
    projectId: "demo-cbt-studio",
    storageBucket: "demo-cbt-studio.appspot.com",
  });
});
afterAll(async () => {
  await deleteApp(app);
});
let groupId: string;
beforeEach(async () => {
  groupId = "jobs-" + crypto.randomUUID();
  mocked.mockReset();
  vi.mocked(logError).mockReset();
  process.env.OCR_DAILY_PAGE_LIMIT = "50";
  delete process.env.AI_ALLOWED_GROUP_IDS;
  const db = getFirestore();
  await db.doc("groups/" + groupId).set({ id: groupId, ownerUid: "adult" });
  await db
    .doc("groups/" + groupId + "/members/adult")
    .set({ id: "adult", active: true, provider: "adult", role: "admin" });
});
async function job(kind: Job["kind"], input: Record<string, unknown>) {
  const id = crypto.randomUUID();
  const ref = getFirestore().doc("groups/" + groupId + "/jobs/" + id);
  await ref.set({
    id,
    kind,
    input,
    status: "queued",
    progress: 0,
    message: "Queued",
    createdAt: Date.now(),
    tries: 0,
    requestedBy: "adult",
  } satisfies Job & { requestedBy: string });
  return ref;
}
async function material() {
  const m = exampleMaterial("superior");
  await getFirestore()
    .doc("groups/" + groupId + "/materials/" + m.id)
    .set(m);
  return m;
}
async function uploadPdf(pages: number, blank = false) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = pdf.addPage();
    if (!blank)
      page.drawText(
        "Page " +
          (i + 1) +
          ": Experimental evidence requires interpretation, comparison and consideration of limitations.",
        { x: 20, y: 700, size: 10, font },
      );
  }
  const path = "groups/" + groupId + "/materials/adult/source";
  await getStorage()
    .bucket()
    .file(path)
    .save(Buffer.from(await pdf.save()), { contentType: "application/pdf" });
  return path;
}
describe("asynchronous worker with provider mocked, real emulator persistence", () => {
  it("resumes bounded generation batches without repeating completed provider calls", async () => {
    const m = await material();
    const a = examples("superior")[0];
    const answers = (count: number) => ({
      activities: Array.from({ length: count }, () => a),
    });
    mocked
      .mockResolvedValueOnce(answers(4))
      .mockRejectedValueOnce(new Error("Interrupção temporária"));
    const ref = await job("generate", {
      title: "Pesquisa",
      subject: "Ciência",
      stage: "superior",
      difficulty: "pratica",
      objectives: "Interpretar evidências",
      count: 10,
      types: ["choice"],
      materialId: m.id,
      pageNumbers: [1],
    });
    await processJob(groupId, ref.id);
    expect((await ref.get()).data()?.status).toBe("failed");
    expect((await ref.collection("private").doc("batch_0").get()).exists).toBe(
      true,
    );
    expect((await ref.collection("private").doc("batch_1").get()).exists).toBe(
      false,
    );
    mocked.mockResolvedValueOnce(answers(4)).mockResolvedValueOnce(answers(2));
    await ref.update({ status: "queued" });
    await processJob(groupId, ref.id);
    expect(mocked).toHaveBeenCalledTimes(4);
    expect((await ref.get()).data()?.status).toBe("done");
    const lesson = (
      await getFirestore().doc(`groups/${groupId}/lessons/${ref.id}`).get()
    ).data();
    expect(lesson?.activityIds).toHaveLength(10);
    expect(lesson?.published).toBe(false);
  }, 30000);
  it("continues large generations after four provider batches per invocation", async () => {
    const m = await material();
    const a = examples("superior")[0];
    mocked.mockImplementation(async (_schema, prompt) => ({
      activities: Array.from(
        { length: Number(prompt.match(/Crie exatamente (\d+)/)?.[1]) },
        () => a,
      ),
    }));
    const ref = await job("generate", {
      title: "Pesquisa",
      subject: "Ciência",
      stage: "superior",
      difficulty: "pratica",
      objectives: "Interpretar evidências",
      count: 30,
      types: ["choice"],
      materialId: m.id,
      pageNumbers: [1],
    });
    await processJob(groupId, ref.id);
    expect((await ref.get()).data()?.status).toBe("queued");
    expect(mocked).toHaveBeenCalledTimes(4);
    await processJob(groupId, ref.id);
    expect((await ref.get()).data()?.status).toBe("done");
    expect(mocked).toHaveBeenCalledTimes(8);
    const lesson = (
      await getFirestore().doc(`groups/${groupId}/lessons/${ref.id}`).get()
    ).data();
    expect(lesson?.activityIds).toHaveLength(30);
  }, 30000);
  it("logs failure phases without logging provider payloads or student answers", async () => {
    const m = await material();
    mocked.mockRejectedValue(new Error("PRIVATE ANSWER AND CREDENTIAL"));
    const ref = await job("generate", {
      title: "Pesquisa",
      subject: "Ciência",
      stage: "superior",
      difficulty: "pratica",
      objectives: "Interpretar evidências",
      count: 1,
      types: ["choice"],
      materialId: m.id,
      pageNumbers: [1],
    });
    await processJob(groupId, ref.id);
    expect(logError).toHaveBeenCalledWith(
      "learning_job_failed",
      expect.objectContaining({ phase: "generation", kind: "generate" }),
    );
    expect(JSON.stringify(vi.mocked(logError).mock.calls)).not.toContain(
      "PRIVATE ANSWER",
    );
    expect((await ref.get()).data()?.status).toBe("failed");
  });
  it("blocks a queued job if its group was removed from the pilot", async () => {
    const ref = await job("generate", {});
    process.env.AI_ALLOWED_GROUP_IDS = "another-group";
    await processJob(groupId, ref.id);
    expect((await ref.get()).data()?.status).toBe("failed");
    expect(mocked).not.toHaveBeenCalled();
    delete process.env.AI_ALLOWED_GROUP_IDS;
  });
  it("claims a job once under duplicate events and leaves generated content as a draft", async () => {
    const m = await material();
    const a = examples("superior")[0];
    mocked.mockResolvedValue({ activities: [a] });
    const ref = await job("generate", {
      title: "Pesquisa",
      subject: "Ciência",
      stage: "superior",
      difficulty: "pratica",
      objectives: "Interpretar evidências",
      count: 1,
      types: ["choice"],
      materialId: m.id,
      pageNumbers: [1],
    });
    await Promise.all([
      processJob(groupId, ref.id),
      processJob(groupId, ref.id),
    ]);
    expect(mocked).toHaveBeenCalledTimes(1);
    expect((await ref.get()).data()?.status).toBe("done");
    const lesson = (
      await getFirestore()
        .doc("groups/" + groupId + "/lessons/" + ref.id)
        .get()
    ).data();
    expect(lesson?.published).toBe(false);
  }, 30000);
  it("rejects a fabricated reference instead of publishing it", async () => {
    const m = await material();
    mocked.mockResolvedValue({
      activities: [
        {
          ...examples("superior")[0],
          source: { materialId: m.id, page: 1, quote: "Fabricated citation" },
        },
      ],
    });
    const ref = await job("generate", {
      title: "Pesquisa",
      subject: "Ciência",
      stage: "superior",
      difficulty: "pratica",
      objectives: "Interpretar evidências",
      count: 1,
      types: ["choice"],
      materialId: m.id,
      pageNumbers: [1],
    });
    await processJob(groupId, ref.id);
    expect((await ref.get()).data()?.status).toBe("failed");
    expect(
      (
        await getFirestore()
          .doc("groups/" + groupId + "/lessons/" + ref.id)
          .get()
      ).exists,
    ).toBe(false);
  }, 30000);
  it("checkpoints and continues a long textual PDF without OCR calls", async () => {
    const path = await uploadPdf(9);
    const ref = await job("pdf", { storagePath: path, title: "Livro" });
    await processJob(groupId, ref.id);
    expect((await ref.get()).data()).toMatchObject({
      status: "queued",
      tries: 0,
    });
    expect((await ref.collection("pages").get()).size).toBe(8);
    await processJob(groupId, ref.id);
    expect((await ref.get()).data()?.status).toBe("done");
    const output = (
      await getFirestore()
        .doc("groups/" + groupId + "/materials/" + ref.id)
        .get()
    ).data();
    expect(output?.pages).toHaveLength(9);
    expect(output?.reviewed).toBe(false);
    expect(output?.pages[8].text).toContain("Page 9");
    expect(mocked).not.toHaveBeenCalled();
  }, 30000);
  it("resumes scanned pages from checkpoints and enforces page quotas", async () => {
    process.env.OCR_DAILY_PAGE_LIMIT = "1";
    const path = await uploadPdf(2, true);
    mocked.mockResolvedValue({
      text: "Texto reconhecido com uma fórmula que precisa de revisão: $x^2$.",
      chapter: "Capítulo",
      illegible: false,
      mathNeedsReview: true,
    });
    const ref = await job("pdf", { storagePath: path, title: "Escaneado" });
    await processJob(groupId, ref.id);
    expect((await ref.get()).data()?.status).toBe("failed");
    expect(mocked).toHaveBeenCalledTimes(1);
    process.env.OCR_DAILY_PAGE_LIMIT = "2";
    await ref.update({ status: "queued" });
    await processJob(groupId, ref.id);
    expect((await ref.get()).data()?.status).toBe("done");
    expect(mocked).toHaveBeenCalledTimes(2);
    const output = (
      await getFirestore()
        .doc("groups/" + groupId + "/materials/" + ref.id)
        .get()
    ).data();
    expect(
      output?.pages.every((p: { needsReview: boolean }) => p.needsReview),
    ).toBe(true);
  }, 30000);
  it("removes the daily OCR cap while preserving usage and page checkpoints", async () => {
    process.env.OCR_DAILY_PAGE_LIMIT = "-1";
    const path = await uploadPdf(2, true);
    mocked.mockResolvedValue({
      text: "Texto reconhecido nesta página para estudar.",
      chapter: "",
      illegible: false,
      mathNeedsReview: false,
    });
    const ref = await job("pdf", { storagePath: path, title: "Escaneado" });
    const usage = getFirestore().doc(
      `groups/${groupId}/usage/${new Date((await ref.get()).data()!.createdAt).toISOString().slice(0, 10)}`,
    );
    await usage.set({ calls: 1000, pages: 1000 });
    await processJob(groupId, ref.id);
    expect((await ref.get()).data()?.status).toBe("done");
    expect((await usage.get()).data()).toEqual({ calls: 1000, pages: 1002 });
    await ref.update({ status: "queued" });
    await processJob(groupId, ref.id);
    expect(mocked).toHaveBeenCalledTimes(2);
    expect((await usage.get()).data()?.pages).toBe(1002);
  }, 30000);
  it("adds a suggestion without assigning a grade or confirming a review", async () => {
    const activity = examples("superior").find((a) => a.type === "open")!;
    await getFirestore()
      .doc("groups/" + groupId + "/activities/" + activity.id)
      .set(activity);
    const session: Omit<Session, "attempts"> = {
      id: "session",
      ownerUid: "learner",
      profileId: "learner",
      lessonId: "lesson",
      mode: "practice",
      activityIds: [activity.id],
      current: 0,
      finished: false,
      createdAt: Date.now(),
    };
    const attempt: Attempt = {
      id: "attempt",
      activityId: activity.id,
      skill: activity.skill,
      answer: "As limitações afetam a validade da conclusão.",
      correct: null,
      points: 0,
      usedHint: false,
      tries: 1,
      review: "pending",
      feedback: activity.explanation,
      createdAt: Date.now(),
    };
    const sessionRef = getFirestore().doc(
      "groups/" + groupId + "/sessions/session",
    );
    await sessionRef.set(session);
    await sessionRef.collection("attempts").doc("attempt").set(attempt);
    mocked.mockResolvedValue({
      points: 80,
      feedback: "Considere também o tamanho da amostra.",
    });
    const ref = await job("suggest", {
      sessionId: "session",
      attemptId: "attempt",
    });
    await processJob(groupId, ref.id);
    expect(
      (await sessionRef.collection("attempts").doc("attempt").get()).data(),
    ).toMatchObject({
      points: 0,
      correct: null,
      review: "pending",
      suggestion: { points: 80 },
    });
  }, 30000);
});
