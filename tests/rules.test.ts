import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-cbt-studio",
    firestore: {
      host: "127.0.0.1",
      port: 8180,
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
}, 30000);
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "groups/one/members/admin"), {
      id: "admin",
      active: true,
      provider: "adult",
      role: "admin",
    });
    await setDoc(doc(context.firestore(), "groups/one/members/student"), {
      id: "student",
      active: true,
      provider: "child",
      role: "student",
    });
    await setDoc(doc(context.firestore(), "groups/one/members/revoked"), {
      id: "revoked",
      active: false,
      provider: "child",
      role: "student",
    });
    await setDoc(doc(context.firestore(), "groups/one/activities/secret"), {
      solution: 2,
    });
  });
}, 30000);
afterAll(async () => {
  await env?.cleanup();
});
describe("Firestore: callable-only access", () => {
  it("denies unauthenticated and authenticated solution reads, including admins", async () => {
    for (const context of [
      env.unauthenticatedContext(),
      env.authenticatedContext("student"),
      env.authenticatedContext("admin"),
    ])
      await assertFails(
        getDoc(doc(context.firestore(), "groups/one/activities/secret")),
      );
  });
  it("denies client role escalation, fabricated scores, ownership changes and collection scans", async () => {
    const db = env.authenticatedContext("student").firestore();
    await assertFails(
      updateDoc(doc(db, "groups/one/members/student"), { role: "admin" }),
    );
    await assertFails(
      setDoc(doc(db, "groups/one/sessions/fake"), { points: 99999 }),
    );
    await assertFails(setDoc(doc(db, "groups/other"), { ownerUid: "student" }));
    await assertFails(getDocs(collection(db, "groups/one/activities")));
  });
  it("keeps old tests, rankings, receipts and invitation tokens private", async () => {
    const db = env.authenticatedContext("admin").firestore();
    for (const path of [
      "cbt_provas/old",
      "cbt_rankings/old",
      "receipts/one",
      "inviteTokens/one",
    ])
      await assertFails(getDoc(doc(db, path)));
  });
});
describe("Storage: immutable scoped uploads", () => {
  it("allows a PDF upload by an active educator in their own group and uid", async () => {
    const storage = env.authenticatedContext("admin").storage();
    await assertSucceeds(
      uploadBytes(
        ref(storage, "groups/one/materials/admin/pdf"),
        new Uint8Array([1, 2]),
        { contentType: "application/pdf" },
      ),
    );
  });
  it("denies PDF uploads by students, strangers, revoked members or into another uid", async () => {
    for (const uid of ["student", "stranger", "revoked"])
      await assertFails(
        uploadBytes(
          ref(
            env.authenticatedContext(uid).storage(),
            "groups/one/materials/" + uid + "/pdf",
          ),
          new Uint8Array([1]),
          { contentType: "application/pdf" },
        ),
      );
    await assertFails(
      uploadBytes(
        ref(
          env.authenticatedContext("admin").storage(),
          "groups/one/materials/student/pdf",
        ),
        new Uint8Array([1]),
        { contentType: "application/pdf" },
      ),
    );
  });
  it("denies cross-group uploads and unauthenticated uploads", async () => {
    await assertFails(
      uploadBytes(
        ref(
          env.authenticatedContext("admin").storage(),
          "groups/two/materials/admin/pdf",
        ),
        new Uint8Array([1]),
        { contentType: "application/pdf" },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(
          env.unauthenticatedContext().storage(),
          "groups/one/answers/student/photo",
        ),
        new Uint8Array([1]),
        { contentType: "image/jpeg" },
      ),
    );
  });
  it("allows own photo creation but rejects overwrite, raw reads, invalid MIME and oversized files", async () => {
    const storage = env.authenticatedContext("student").storage();
    const photo = ref(storage, "groups/one/answers/student/photo");
    await assertSucceeds(
      uploadBytes(photo, new Uint8Array([1]), { contentType: "image/png" }),
    );
    await assertFails(
      uploadBytes(photo, new Uint8Array([2]), { contentType: "image/png" }),
    );
    await assertFails(getBytes(photo));
    await assertFails(
      uploadBytes(
        ref(storage, "groups/one/answers/student/html"),
        new Uint8Array([1]),
        { contentType: "text/html" },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(storage, "groups/one/answers/student/huge"),
        new Uint8Array(5 * 1024 * 1024 + 1),
        { contentType: "image/jpeg" },
      ),
    );
  });
  it("denies photo uploads to someone else and access after membership revocation", async () => {
    await assertFails(
      uploadBytes(
        ref(
          env.authenticatedContext("student").storage(),
          "groups/one/answers/admin/photo",
        ),
        new Uint8Array([1]),
        { contentType: "image/jpeg" },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(
          env.authenticatedContext("revoked").storage(),
          "groups/one/answers/revoked/photo",
        ),
        new Uint8Array([1]),
        { contentType: "image/jpeg" },
      ),
    );
  });
});
