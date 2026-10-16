import { describe, it, expect } from "vitest";
import { execute, type Dependencies } from "../shared/service";
import { MemoryDatabase } from "../shared/memory";
import { demoSeed } from "../shared/fixtures";
import type { Session, Workspace, Challenge } from "../shared/domain";
function setup() {
  const db = new MemoryDatabase(demoSeed());
  const deps: Dependencies = {
    db,
    now: Date.now,
    id: () => crypto.randomUUID(),
    token: () => crypto.randomUUID().replaceAll("-", "").repeat(2),
    hash: (s) => s.replaceAll(":", "_"),
    aiDailyLimit: 3,
    ocrDailyPageLimit: 10,
  };
  const run = <T = unknown>(
    action: string,
    input: Record<string, unknown> = {},
  ) =>
    execute(
      deps,
      { uid: "demo-adult", adult: true },
      action,
      { groupId: "demo-group", ...input },
      crypto.randomUUID(),
    ) as Promise<T>;
  return { db, run };
}
describe("history and human assessment", () => {
  it("stores attempts separately so free retries do not grow a single Firestore document", async () => {
    const { db, run } = setup();
    const s = await run<Session>("start", {
      lessonId: "lesson_fundamental-inicial",
      mode: "trail",
    });
    for (let i = 0; i < 60; i++)
      await run("submit", {
        sessionId: s.id,
        activityId: s.activityIds[0],
        answer: 1,
      });
    expect(db.data["groups/demo-group/sessions/" + s.id]).not.toHaveProperty(
      "attempts",
    );
    expect(
      (await run<{ session: Session }>("session", { sessionId: s.id })).session
        .attempts,
    ).toHaveLength(60);
  });
  it("rejects a malformed oversized answer before recording it", async () => {
    const { run } = setup();
    const s = await run<Session>("start", {
      lessonId: "lesson_fundamental-inicial",
      mode: "trail",
    });
    await expect(
      run("submit", {
        sessionId: s.id,
        activityId: s.activityIds[0],
        answer: "x".repeat(1000),
      }),
    ).rejects.toThrow("alternativa válida");
    expect(
      (await run<{ session: Session }>("session", { sessionId: s.id })).session
        .attempts,
    ).toHaveLength(0);
  });
  it("persists manual assessment and returns the original question and criteria", async () => {
    const { run } = setup();
    const s = await run<Session>("start", {
      lessonId: "lesson_superior",
      mode: "practice",
      type: "open",
    });
    await run("submit", {
      sessionId: s.id,
      activityId: s.activityIds[0],
      answer: "As limitações devem ser consideradas na conclusão.",
    });
    const w = await run<Workspace>("workspace");
    const a = w.sessions[0].attempts[0];
    const context = await run<{ prompt: string; rubric: string }>(
      "reviewContext",
      { sessionId: s.id, attemptId: a.id },
    );
    expect(context.rubric).toContain("limitações");
    await run("confirmReview", {
      sessionId: s.id,
      attemptId: a.id,
      points: 85,
      feedback: "Boa justificativa; detalhe a amostra.",
    });
    const updated = await run<{ session: Session }>("session", {
      sessionId: s.id,
    });
    expect(updated.session.attempts[0]).toMatchObject({
      review: "confirmed",
      points: 85,
      feedback: "Boa justificativa; detalhe a amostra.",
    });
  });
  it("marks a closed live session as completed without losing its attempts", async () => {
    const { run } = setup();
    const c = await run<Challenge>("createChallenge", {
      title: "Sala",
      lessonId: "lesson_superior",
      kind: "live",
      deadline: Date.now() + 3600000,
    });
    await run("start", {
      lessonId: "lesson_superior",
      mode: "challenge",
      challengeId: c.id,
    });
    await run("controlChallenge", { challengeId: c.id, command: "close" });
    expect((await run<Workspace>("workspace")).sessions[0].finished).toBe(true);
  });
});
