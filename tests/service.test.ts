import { beforeEach, describe, it, expect } from "vitest";
import { MemoryDatabase } from "../shared/memory";
import { execute, type Dependencies } from "../shared/service";
import { demoSeed, examples } from "../shared/fixtures";
import {
  type Challenge,
  type Group,
  type Invite,
  type Lesson,
  type Profile,
  type Session,
  type Workspace,
} from "../shared/domain";
let db: MemoryDatabase,
  deps: Dependencies,
  time = Date.now();
const adult = { uid: "demo-adult", adult: true };
const child = { uid: "child-user", adult: false };
const groupId = "demo-group";
const run = <T = unknown>(
  action: string,
  input: Record<string, unknown> = {},
  who = adult,
  requestId = crypto.randomUUID(),
) => execute(deps, who, action, { groupId, ...input }, requestId) as Promise<T>;
beforeEach(() => {
  time = Date.now();
  db = new MemoryDatabase(demoSeed());
  deps = {
    db,
    now: () => time,
    id: () => crypto.randomUUID(),
    token: () => crypto.randomUUID().replaceAll("-", "").repeat(2),
    hash: (s) => s.replace(/[^a-zA-Z0-9_-]/g, "_"),
    aiDailyLimit: 3,
    ocrDailyPageLimit: 10,
  };
});
async function childInvite() {
  return await run<Invite & { code: string }>("invite", {
    nickname: "Lia",
    role: "student",
    child: true,
    profileId: "demo-child",
  });
}
async function enroll() {
  const inv = await childInvite();
  await run("redeem", { code: inv.code }, child);
  return inv;
}
const lessonId = "lesson_fundamental-inicial";
describe("authorization and invitations", () => {
  it("only educators can confirm an age band, independently of school stage", async () => {
    const p = await run<Profile>("createProfile", {
      nickname: "Teste",
      stage: "superior",
    });
    expect(p.ageBand).toBe("up-to-14");
    await enroll();
    await expect(
      run(
        "setProfileAgeBand",
        { profileId: "demo-child", ageBand: "15-plus" },
        child,
      ),
    ).rejects.toThrow("educador");
    const w = await run<Workspace>("workspace", {}, child);
    await run(
      "updateProfile",
      {
        ...w.profile,
        profileId: w.profile.id,
        stage: "superior",
        ageBand: "15-plus",
      },
      child,
    );
    expect(
      (await run<Workspace>("workspace", {}, child)).profile.ageBand,
    ).not.toBe("15-plus");
    await run("setProfileAgeBand", {
      profileId: "demo-child",
      ageBand: "15-plus",
    });
    expect((await run<Workspace>("workspace", {}, child)).profile.ageBand).toBe(
      "15-plus",
    );
  });
  it("blocks child uploads through submit and lets an educator attach their own photo", async () => {
    await enroll();
    await run("setProfileAgeBand", {
      profileId: "demo-child",
      ageBand: "up-to-14",
    });
    const s = await run<Session>(
      "start",
      { lessonId, mode: "practice", type: "open" },
      child,
    );
    const input = {
      sessionId: s.id,
      activityId: s.activityIds[0],
      answer: "Minha resposta",
    };
    await expect(
      run(
        "submit",
        { ...input, photoPath: `groups/${groupId}/answers/${child.uid}/photo` },
        child,
      ),
    ).rejects.toThrow("responsável");
    await run("submit", input, child);
    const current = await run<{ session: Session }>(
      "session",
      { sessionId: s.id },
      child,
    );
    const attemptId = current.session.attempts[0].id;
    const photoPath = `groups/${groupId}/answers/${adult.uid}/photo`;
    await expect(
      run(
        "attachAnswerPhoto",
        { sessionId: s.id, attemptId, photoPath },
        child,
      ),
    ).rejects.toThrow("educador");
    await run("attachAnswerPhoto", { sessionId: s.id, attemptId, photoPath });
    expect(
      (await run<{ session: Session }>("session", { sessionId: s.id }, child))
        .session.attempts[0].photoPath,
    ).toBe(photoPath);
    await expect(
      run("file", { path: photoPath }, child),
    ).resolves.toBeDefined();
  });
  it("allows answer photos for a student confirmed as 15 or older", async () => {
    await enroll();
    await run("setProfileAgeBand", {
      profileId: "demo-child",
      ageBand: "15-plus",
    });
    const s = await run<Session>(
      "start",
      { lessonId, mode: "practice", type: "open" },
      child,
    );
    await expect(
      run(
        "submit",
        {
          sessionId: s.id,
          activityId: s.activityIds[0],
          answer: "",
          photoPath: `groups/${groupId}/answers/${child.uid}/photo`,
        },
        child,
      ),
    ).resolves.toBeDefined();
  });
  it("denies unaffiliated users and anonymous group creation", async () => {
    await expect(run("workspace", {}, child)).rejects.toThrow("acesso");
    await expect(
      run(
        "createGroup",
        { title: "X", nickname: "X", stage: "superior" },
        child,
      ),
    ).rejects.toThrow("adulto");
  });
  it("creates separate private spaces", async () => {
    const g = await run<Group>("createGroup", {
      title: "Graduação",
      nickname: "Caio",
      stage: "superior",
    });
    const w = await run<Workspace>("workspace", { groupId: g.id });
    expect(w.profile.theme).toBe("academic");
    expect(w.lessons).toHaveLength(0);
  });
  it("redeems once, blocks privilege escalation and invalidates access on revocation", async () => {
    const inv = await enroll();
    const w = await run<Workspace>("workspace", {}, child);
    expect(w.role).toBe("student");
    await expect(
      run("createProfile", { nickname: "X", stage: "superior" }, child),
    ).rejects.toThrow("educador");
    await expect(
      run("redeem", { code: inv.code }, { uid: "another-child", adult: false }),
    ).rejects.toThrow("usado");
    await run("revokeInvite", { inviteId: inv.id });
    await expect(run("workspace", {}, child)).rejects.toThrow("acesso");
  });
  it("reissuing an invitation invalidates the prior device", async () => {
    await enroll();
    await childInvite();
    await expect(run("workspace", {}, child)).rejects.toThrow("acesso");
  });
  it("prevents an adult session from redeeming a child invitation", async () => {
    const inv = await childInvite();
    await expect(run("redeem", { code: inv.code })).rejects.toThrow("código");
  });
  it("prevents cross-group reads even with a valid account", async () => {
    await expect(run("workspace", { groupId: "other-group" })).rejects.toThrow(
      "acesso",
    );
  });
  it("does not let a student read solutions through lesson editor", async () => {
    await enroll();
    await expect(run("lesson", { lessonId }, child)).rejects.toThrow(
      "educador",
    );
  });
});
describe("sessions, validation and immutable versions", () => {
  it("resumes a matching unfinished session and counts retries with hints", async () => {
    const s = await run<Session>("start", { lessonId, mode: "trail", size: 2 });
    expect(
      (await run<Session>("start", { lessonId, mode: "trail", size: 2 })).id,
    ).toBe(s.id);
    await run("hint", { sessionId: s.id });
    await run("submit", {
      sessionId: s.id,
      activityId: s.activityIds[0],
      answer: 1,
    });
    await run("submit", {
      sessionId: s.id,
      activityId: s.activityIds[0],
      answer: 0,
    });
    const result = await run<{ session: Session }>("session", {
      sessionId: s.id,
    });
    expect(result.session.attempts[1]).toMatchObject({
      correct: true,
      tries: 2,
      usedHint: true,
    });
    await run("advance", { sessionId: s.id });
    expect(
      (await run<{ current: number }>("session", { sessionId: s.id })).current,
    ).toBe(1);
  });
  it("does not accept skipped, duplicate-correct or foreign answers", async () => {
    const s = await run<Session>("start", { lessonId, mode: "trail", size: 2 });
    await expect(
      run("submit", {
        sessionId: s.id,
        activityId: s.activityIds[1],
        answer: 0,
      }),
    ).rejects.toThrow("mudou");
    await run("submit", {
      sessionId: s.id,
      activityId: s.activityIds[0],
      answer: 0,
    });
    await expect(
      run("submit", {
        sessionId: s.id,
        activityId: s.activityIds[0],
        answer: 0,
      }),
    ).rejects.toThrow("Avance");
    await enroll();
    await expect(run("session", { sessionId: s.id }, child)).rejects.toThrow(
      "outro",
    );
  });
  it("replays a lost response idempotently without duplicate attempts", async () => {
    const s = await run<Session>("start", { lessonId, mode: "trail" });
    const requestId = crypto.randomUUID();
    const data = { sessionId: s.id, activityId: s.activityIds[0], answer: 1 };
    await Promise.all([
      run("submit", data, adult, requestId),
      run("submit", data, adult, requestId),
    ]);
    expect(
      (await run<{ session: Session }>("session", { sessionId: s.id })).session
        .attempts,
    ).toHaveLength(1);
  });
  it("preserves theme changes and old activity snapshots", async () => {
    const s = await run<Session>("start", { lessonId, mode: "trail" });
    const old = await run<{ lesson: Lesson }>("lesson", { lessonId });
    await run("saveLesson", {
      id: lessonId,
      title: "Nova versão",
      subject: "Leitura",
      stage: "fundamental-inicial",
      activities: examples("fundamental-inicial"),
      publish: true,
      materialId: "material_fundamental-inicial",
    });
    expect(
      (await run<{ session: Session }>("session", { sessionId: s.id })).session
        .activityIds,
    ).toEqual(s.activityIds);
    expect(
      (await run<{ lesson: Lesson }>("lesson", { lessonId })).lesson
        .activityIds,
    ).not.toEqual(old.lesson.activityIds);
    const w = await run<Workspace>("workspace");
    await run("updateProfile", {
      ...w.profile,
      profileId: w.profile.id,
      theme: "academic",
    });
    expect((await run<Workspace>("workspace")).sessions[0].id).toBe(s.id);
  });
  it("requires review and valid source quotes", async () => {
    await expect(
      run("saveLesson", {
        title: "Fake",
        subject: "X",
        stage: "superior",
        activities: [
          {
            ...examples("superior")[0],
            source: {
              materialId: "material_superior",
              page: 1,
              quote: "INVENTADO",
            },
          },
        ],
        materialId: "material_superior",
        publish: true,
      }),
    ).rejects.toThrow("trecho");
    await expect(
      run("saveMaterial", {
        title: "Scan",
        pages: [{ number: 1, text: "", chapter: "", needsReview: true }],
        reviewed: true,
      }),
    ).rejects.toThrow("Revise");
  });
  it("filters practice formats and preserves stage-independent access", async () => {
    const s = await run<Session>("start", {
      lessonId: "lesson_superior",
      mode: "practice",
      type: "numeric",
      size: 5,
    });
    expect(s.activityIds).toEqual(["superior_numeric"]);
  });
});
describe("competition and quotas", () => {
  it("hides answers and rejects duplicates until challenge closure, then reveals explanations", async () => {
    await enroll();
    const c = await run<Challenge>("createChallenge", {
      title: "Desafio",
      lessonId,
      kind: "async",
      deadline: time + 3600000,
    });
    const s = await run<Session>(
      "start",
      { lessonId, mode: "challenge", challengeId: c.id },
      child,
    );
    await run(
      "submit",
      { sessionId: s.id, activityId: s.activityIds[0], answer: 0 },
      child,
    );
    const visible = await run<{ session: Session }>(
      "session",
      { sessionId: s.id },
      child,
    );
    expect(visible.session.attempts[0]).toMatchObject({
      correct: null,
      points: 0,
      feedback: "",
    });
    await expect(run("hint", { sessionId: s.id }, child)).rejects.toThrow(
      "indisponíveis",
    );
    expect(
      (
        await run<{ scores: unknown[] }>(
          "leaderboard",
          { challengeId: c.id },
          child,
        )
      ).scores,
    ).toHaveLength(0);
    await run("controlChallenge", { challengeId: c.id, command: "close" });
    expect(
      (await run<{ review: unknown[] }>("session", { sessionId: s.id }, child))
        .review,
    ).toHaveLength(8);
  });
  it("freezes activity ids even when the published lesson changes", async () => {
    const c = await run<Challenge>("createChallenge", {
      title: "Sala",
      lessonId,
      kind: "live",
      deadline: time + 3600000,
    });
    await run("saveLesson", {
      id: lessonId,
      title: "Alterada",
      subject: "Leitura",
      stage: "fundamental-inicial",
      activities: [examples("fundamental-inicial")[0]],
      publish: true,
    });
    const s = await run<Session>("start", {
      lessonId,
      mode: "challenge",
      challengeId: c.id,
    });
    expect(s.activityIds).toEqual(c.activityIds);
    await run("controlChallenge", { challengeId: c.id, command: "start" });
    await run("submit", {
      sessionId: s.id,
      activityId: s.activityIds[0],
      answer: 0,
    });
    await expect(
      run("submit", {
        sessionId: s.id,
        activityId: s.activityIds[0],
        answer: 0,
      }),
    ).rejects.toThrow("registrada");
    await run("controlChallenge", { challengeId: c.id, command: "next" });
    expect(
      (await run<{ current: number }>("session", { sessionId: s.id })).current,
    ).toBe(1);
  });
  it("rejects late entry and returns one participation per profile", async () => {
    const c = await run<Challenge>("createChallenge", {
      title: "Sala",
      lessonId,
      kind: "live",
      deadline: time + 3600000,
    });
    const s = await run<Session>("start", {
      lessonId,
      mode: "challenge",
      challengeId: c.id,
    });
    await run("controlChallenge", { challengeId: c.id, command: "start" });
    expect(
      (
        await run<Session>("start", {
          lessonId,
          mode: "challenge",
          challengeId: c.id,
        })
      ).id,
    ).toBe(s.id);
    await enroll();
    await expect(
      run("start", { lessonId, mode: "challenge", challengeId: c.id }, child),
    ).rejects.toThrow("começou");
    time += 3600001;
    await expect(
      run("submit", {
        sessionId: s.id,
        activityId: s.activityIds[0],
        answer: 0,
      }),
    ).rejects.toThrow("recebendo");
  });
  it("enforces atomic daily generation quotas", async () => {
    const input = {
      title: "Leitura",
      subject: "Ciências",
      stage: "superior",
      difficulty: "pratica",
      objectives: "Compreender o método científico",
      count: 3,
      types: ["choice"],
      materialId: "material_superior",
      pageNumbers: [1],
    };
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        run("enqueue", { kind: "generate", input }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(3);
  });
  it("restricts paid jobs to pilot groups even for administrators", async () => {
    const input = {
      storagePath: "groups/demo-group/materials/demo-adult/test.pdf",
      title: "Teste",
    };
    deps.aiAllowedGroupIds = [];
    await expect(run("enqueue", { kind: "pdf", input })).rejects.toThrow(
      "homologação",
    );
    deps.aiAllowedGroupIds = ["another-group"];
    await expect(run("enqueue", { kind: "pdf", input })).rejects.toThrow(
      "homologação",
    );
    deps.aiAllowedGroupIds = [groupId];
    const job = await run<{ id: string }>("enqueue", { kind: "pdf", input });
    deps.aiAllowedGroupIds = [];
    await expect(run("retryJob", { jobId: job.id })).rejects.toThrow(
      "homologação",
    );
  });
  it("rejects a photo path belonging to another user or group", async () => {
    const s = await run<Session>("start", {
      lessonId,
      mode: "practice",
      type: "open",
    });
    await expect(
      run("submit", {
        sessionId: s.id,
        activityId: s.activityIds[0],
        answer: "Resposta",
        photoPath: "groups/other/answers/demo-adult/x",
      }),
    ).rejects.toThrow("Anexo");
  });
});
