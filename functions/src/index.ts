import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { z } from "zod";
import { execute, AppError } from "../../shared/service.js";
import { firestoreDatabase } from "./store.js";
import { processJob } from "./jobs.js";

initializeApp();
setGlobalOptions({ region: "southamerica-east1", maxInstances: 5 });
export const studio = onCall(
  {
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Entre para continuar.");
    try {
      const input = z
        .object({
          action: z.string().min(1).max(50),
          input: z.unknown(),
          requestId: z.string(),
        })
        .parse(request.data);
      if (Buffer.byteLength(JSON.stringify(request.data), "utf8") > 800000)
        throw new HttpsError(
          "invalid-argument",
          "Divida o conteúdo em partes menores.",
        );
      const result = await execute(
        {
          db: firestoreDatabase,
          now: Date.now,
          id: randomUUID,
          token: () => randomBytes(32).toString("hex"),
          hash: (value) => createHash("sha256").update(value).digest("hex"),
          aiDailyLimit: Number(process.env.AI_DAILY_LIMIT) || 0,
          ocrDailyPageLimit: Number(process.env.OCR_DAILY_PAGE_LIMIT) || 0,
          aiAllowedGroupIds:
            process.env.AI_ALLOWED_GROUP_IDS === undefined
              ? undefined
              : process.env.AI_ALLOWED_GROUP_IDS.split(",")
                  .map((id) => id.trim())
                  .filter(Boolean),
        },
        {
          uid: request.auth.uid,
          adult: request.auth.token.firebase?.sign_in_provider !== "anonymous",
        },
        input.action,
        input.input,
        input.requestId,
      );
      if (input.action === "file") {
        const { path } = result as { path: string };
        const file = getStorage().bucket().file(path);
        const [exists] = await file.exists();
        if (!exists)
          throw new HttpsError("not-found", "Arquivo não encontrado.");
        const [url] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 5 * 60000,
        });
        return { url };
      }
      return result;
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof AppError)
        throw new HttpsError(error.code, error.message);
      if (error instanceof z.ZodError)
        throw new HttpsError(
          "invalid-argument",
          "Revise os campos: " +
            error.issues
              .slice(0, 3)
              .map((v) => v.path.join(".") + " " + v.message)
              .join("; "),
        );
      throw new HttpsError(
        "internal",
        "Não foi possível concluir esta ação. Tente novamente.",
      );
    }
  },
);
export const learningJob = onDocumentWritten(
  {
    document: "groups/{groupId}/jobs/{jobId}",
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 540,
    memory: "1GiB",
    maxInstances: 3,
  },
  async (event) => {
    if (
      !event.data?.after.exists ||
      event.data.after.data()?.status !== "queued"
    )
      return;
    await processJob(event.params.groupId, event.params.jobId);
  },
);
