import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  sendPasswordResetEmail,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFunctions,
  httpsCallable,
  connectFunctionsEmulator,
} from "firebase/functions";
import {
  getStorage,
  ref,
  uploadBytes,
  connectStorageEmulator,
} from "firebase/storage";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
import { execute, type Identity } from "../../shared/service";
import { MemoryDatabase } from "../../shared/memory";
import { demoSeed } from "../../shared/fixtures";
import type { Group, Workspace } from "../../shared/domain";

export type Account = Identity & { email?: string };
const env = import.meta.env;
export const demo = !env.VITE_FIREBASE_PROJECT_ID;
export const localKey = "cbt-studio-v2-demo";
let memory: MemoryDatabase | null = null;
if (demo) {
  let initial: Record<string, unknown> | undefined;
  try {
    initial = JSON.parse(localStorage.getItem(localKey) || "null") || undefined;
  } catch {
    /* A damaged local demo can be reset from settings. */
  }
  memory = new MemoryDatabase(initial || demoSeed(), (next) =>
    localStorage.setItem(localKey, JSON.stringify(next)),
  );
}
const app = !demo
  ? initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      appId: env.VITE_FIREBASE_APP_ID,
    })
  : null;
const auth = app ? getAuth(app) : null;
const functions = app
  ? getFunctions(app, env.VITE_FIREBASE_REGION || "southamerica-east1")
  : null;
const storage = app ? getStorage(app) : null;
if (app && env.VITE_USE_EMULATORS !== "true" && env.VITE_APPCHECK_SITE_KEY)
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
if (auth && functions && storage && env.VITE_USE_EMULATORS === "true") {
  if (!["localhost", "127.0.0.1"].includes(location.hostname))
    throw new Error("Emuladores só podem ser usados localmente.");
  connectAuthEmulator(auth, "http://127.0.0.1:9190", { disableWarnings: true });
  connectFunctionsEmulator(functions, "127.0.0.1", 5101);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
let account: Account | null = demo
  ? { uid: "demo-adult", adult: true, email: "Demonstração local" }
  : null;
const subscribers = new Set<(user: Account | null) => void>();
function notify() {
  for (const callback of subscribers) callback(account);
}
export function observeAuth(callback: (user: Account | null) => void) {
  subscribers.add(callback);
  if (auth) {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      account = user
        ? {
            uid: user.uid,
            adult: !user.isAnonymous,
            email: user.email || undefined,
          }
        : null;
      callback(account);
    });
    return () => {
      subscribers.delete(callback);
      unsubscribe();
    };
  }
  callback(account);
  return () => {
    subscribers.delete(callback);
  };
}
export async function login(
  method: "google" | "email" | "register",
  email = "",
  password = "",
) {
  if (!auth) {
    account = { uid: "demo-adult", adult: true, email: "Demonstração local" };
    notify();
    return;
  }
  if (method === "google")
    await signInWithPopup(auth, new GoogleAuthProvider());
  else if (method === "register")
    await createUserWithEmailAndPassword(auth, email, password);
  else await signInWithEmailAndPassword(auth, email, password);
}
export async function logout() {
  if (auth) await signOut(auth);
  else {
    account = null;
    notify();
  }
}
export async function resetPassword(email: string) {
  if (!auth)
    throw new Error(
      "Recuperação de senha está disponível com o Firebase configurado.",
    );
  await sendPasswordResetEmail(auth, email);
}
export async function call<T = unknown>(
  action: string,
  input: unknown = {},
  requestId: string = crypto.randomUUID(),
): Promise<T> {
  if (auth?.currentUser)
    account = {
      uid: auth.currentUser.uid,
      adult: !auth.currentUser.isAnonymous,
      email: auth.currentUser.email || undefined,
    };
  if (!account) throw new Error("Entre para continuar.");
  if (memory) {
    if (action === "enqueue" || action === "retryJob")
      throw new Error(
        "A demonstração não chama a IA. Conecte o Firebase e configure as cotas para importar PDFs escaneados, gerar ou sugerir correções.",
      );
    return (await execute(
      {
        db: memory,
        now: Date.now,
        id: () => crypto.randomUUID(),
        token: () =>
          [...crypto.getRandomValues(new Uint8Array(32))]
            .map((n) => n.toString(16).padStart(2, "0"))
            .join(""),
        hash: (value) => value.replace(/[^a-zA-Z0-9_-]/g, "_"),
        aiDailyLimit: 0,
        ocrDailyPageLimit: 0,
      },
      account,
      action,
      input,
      requestId,
    )) as T;
  }
  const result = await httpsCallable(
    functions!,
    "studio",
  )({ action, input, requestId });
  return result.data as T;
}
export async function redeem(code: string, child: boolean) {
  if (child && auth) {
    if (auth.currentUser && !auth.currentUser.isAnonymous) await signOut(auth);
    await signInAnonymously(auth);
    account = { uid: auth.currentUser!.uid, adult: false };
  } else if (child && demo)
    account = { uid: "demo-child-" + crypto.randomUUID(), adult: false };
  const result = await call<{ groupId: string }>("redeem", {
    code: code.trim(),
  });
  notify();
  return result;
}
export async function upload(
  groupId: string,
  kind: "materials" | "answers",
  file: File,
): Promise<string> {
  if (!storage || !account)
    throw new Error(
      "Upload privado disponível quando o Firebase estiver conectado. Para experimentar, use texto colado.",
    );
  const max = kind === "materials" ? 15 : 5;
  const allowed =
    kind === "materials"
      ? ["application/pdf"]
      : ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type) || file.size > max * 1024 * 1024)
    throw new Error("Formato inválido ou arquivo maior que " + max + " MB.");
  const path =
    "groups/" +
    groupId +
    "/" +
    kind +
    "/" +
    account.uid +
    "/" +
    crypto.randomUUID();
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  return path;
}
export const fetchGroups = () => call<Group[]>("groups");
export const fetchWorkspace = (groupId: string) =>
  call<Workspace>("workspace", { groupId });
export function resetDemo() {
  if (demo) {
    localStorage.removeItem(localKey);
    location.reload();
  }
}
export async function openPrivateFile(groupId: string, path: string) {
  const { url } = await call<{ url: string }>("file", { groupId, path });
  window.open(url, "_blank", "noopener,noreferrer");
}
