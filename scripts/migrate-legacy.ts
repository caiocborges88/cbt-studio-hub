import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import {
  stages,
  type Stage,
  type Activity,
  type Group,
  type Lesson,
  type Material,
  validateActivity,
} from "../shared/domain.js";

const args = process.argv.slice(2);
const option = (name: string) => args[args.indexOf(name) + 1];
if (
  !args.includes("--project") ||
  !args.includes("--group") ||
  !args.includes("--owner")
)
  throw new Error(
    "Use --project ID --group GROUP_ID --owner OWNER_UID [--stage ETAPA] [--apply]. Sem --apply a execução apenas lê.",
  );
const projectId = option("--project"),
  groupId = option("--group"),
  owner = option("--owner");
const stage = (
  args.includes("--stage") ? option("--stage") : "fundamental-inicial"
) as Stage;
if (!stages.includes(stage) || !/^[-\w]+$/.test(groupId))
  throw new Error("Etapa ou grupo inválido.");
const app =
  getApps()[0] ||
  initializeApp({
    projectId,
    ...(!process.env.FIRESTORE_EMULATOR_HOST
      ? { credential: applicationDefault() }
      : {}),
  });
if (app.options.projectId !== projectId)
  throw new Error(
    "A credencial inicializada aponta para outro projeto. Nenhuma alteração foi realizada.",
  );
const db = getFirestore(app);
const groupRef = db.doc("groups/" + groupId);
const group = (await groupRef.get()).data() as Group | undefined;
if (!group || group.ownerUid !== owner)
  throw new Error(
    "Crie o grupo privado no aplicativo e informe o UID do seu proprietário. Nenhuma alteração foi realizada.",
  );
const member = (await groupRef.collection("members").doc(owner).get()).data();
if (!member?.active || member.role !== "admin")
  throw new Error("O proprietário precisa ser administrador ativo.");
const tests = await db.collection("cbt_provas").get();
const rankings = await db.collection("cbt_rankings").get();
let migrated = 0,
  skipped = 0;
for (const snapshot of tests.docs) {
  const marker = groupRef.collection("migrationSources").doc(snapshot.id);
  if ((await marker.get()).exists) {
    skipped++;
    continue;
  }
  const original = snapshot.data();
  if (!Array.isArray(original.questions) || !original.questions.length) {
    skipped++;
    continue;
  }
  const hash = createHash("sha256")
    .update(snapshot.id)
    .digest("hex")
    .slice(0, 24);
  const materialId = "legacy_material_" + hash;
  const material: Material = {
    id: materialId,
    title: String(original.title || "Material importado"),
    reviewed: false,
    createdAt: Date.now(),
    pages: [
      {
        number: 1,
        chapter: "Material original",
        text: String(original.studyMaterial || "").slice(0, 40000),
        needsReview: true,
      },
    ],
  };
  const questions = original.questions.slice(0, 100);
  const activities: Activity[] = questions.map(
    (q: Record<string, unknown>, i: number) => {
      const base = {
        id: "legacy_" + hash + "_" + i,
        version: 1,
        prompt: String(q.q || "Revisar enunciado"),
        skill: "Revisão do material",
        stage,
        difficulty: "pratica",
        hint: "Consulte o material e procure as informações relacionadas.",
        explanation: String(
          q.gabarito || "Responsável: revise e complete a explicação.",
        ),
        source: { materialId, page: 1, quote: "" },
      };
      const options = Array.isArray(q.options) ? q.options.map(String) : [];
      if (
        options.length >= 2 &&
        options.length <= 6 &&
        Number.isInteger(q.answer) &&
        Number(q.answer) >= 0 &&
        Number(q.answer) < options.length &&
        new Set(options).size === options.length
      )
        return validateActivity({
          ...base,
          type: "choice",
          options,
          solution: Number(q.answer),
        });
      return validateActivity({
        ...base,
        type: "open",
        rubric: String(
          q.gabarito || "Revisar os critérios de avaliação do conteúdo.",
        ),
      });
    },
  );
  const lesson: Lesson = {
    id: "legacy_lesson_" + hash,
    title: material.title,
    subject: "Conteúdo importado",
    stage,
    activityIds: activities.map((a) => a.id),
    published: false,
    materialId,
    createdAt: Date.now(),
    createdBy: owner,
  };
  if (args.includes("--apply")) {
    // Never overwrite or delete the source collections; each test is an atomic, repeatable import.
    const batch = db.batch();
    batch.create(marker, {
      sourceId: snapshot.id,
      importedAt: Date.now(),
      original,
    });
    batch.create(groupRef.collection("materials").doc(material.id), material);
    batch.create(groupRef.collection("lessons").doc(lesson.id), lesson);
    for (const activity of activities)
      batch.create(
        groupRef.collection("activities").doc(activity.id),
        activity,
      );
    await batch.commit();
  }
  migrated++;
}
if (args.includes("--apply"))
  for (const ranking of rankings.docs) {
    const target = groupRef.collection("legacyRankings").doc(ranking.id);
    await db.runTransaction(async (tx) => {
      if (!(await tx.get(target)).exists)
        tx.create(target, {
          ...ranking.data(),
          archivedAt: Date.now(),
          sourceId: ranking.id,
        });
    });
  }
console.log(
  JSON.stringify(
    {
      mode: args.includes("--apply") ? "applied" : "dry-run",
      testsToImport: migrated,
      skipped,
      rankingsToArchive: rankings.size,
      originalCollectionsUnchanged: true,
    },
    null,
    2,
  ),
);
