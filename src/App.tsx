import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  BookOpen,
  Compass,
  LayoutDashboard,
  Layers3,
  Users,
  BarChart3,
  Trophy,
  Settings,
  Plus,
  LogOut,
  Menu,
  X,
  Leaf,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import type {
  Group,
  Lesson,
  Profile,
  Session,
  Workspace,
} from "../shared/domain";
import { stageLabels, stages } from "../shared/domain";
import { StudioContext, type View, type StudioContextValue } from "./context";
import {
  call,
  demo,
  fetchGroups,
  fetchWorkspace,
  login,
  logout,
  observeAuth,
  redeem,
  resetPassword,
  type Account,
} from "./lib/api";
import { Home, Library, Settings as Preferences } from "./pages";
import { Creator } from "./Creator";
import { Groups, Challenges, Progress } from "./Community";
import { Study } from "./Study";
import { Mascot } from "./components/Mascot";

const navigation: {
  id: View;
  label: string;
  icon: typeof Compass;
  editor?: boolean;
}[] = [
  { id: "home", label: "Meu espaço", icon: LayoutDashboard },
  { id: "library", label: "Biblioteca", icon: BookOpen },
  { id: "challenges", label: "Desafios", icon: Trophy },
  { id: "progress", label: "Meu progresso", icon: BarChart3 },
  { id: "create", label: "Criar atividades", icon: Plus, editor: true },
  { id: "groups", label: "Meu grupo", icon: Users },
  { id: "settings", label: "Preferências", icon: Settings },
];
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <BookOpen size={23} strokeWidth={1.8} />
        <span>✦</span>
      </span>
      <span>
        cbt<span className="brand-studio">studio</span>
        <small>O CONHECIMENTO CONECTA.</small>
      </span>
    </div>
  );
}
export class App extends Component<{}, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <Brand />
        <h1>Precisamos recarregar este espaço.</h1>
        <p>Seus resultados já registrados foram preservados.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Recarregar
        </button>
      </div>
    ) : (
      <StudioApp />
    );
  }
}
function StudioApp() {
  const [account, setAccount] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [profileId, setProfileId] = useState("");
  const [view, setView] = useState<View>("home");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const report = useCallback(
    (error: unknown) =>
      setError(
        error instanceof Error
          ? error.message.replace(/^Firebase:\s*/, "")
          : "Não foi possível concluir. Tente novamente.",
      ),
    [],
  );
  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(
    () =>
      observeAuth((user) => {
        setAccount(user);
        setAuthReady(true);
        setGroups([]);
        setGroupId("");
        setWorkspace(null);
        setProfileId("");
        setView("home");
        setSidebar(false);
        setSessionId(null);
        setError("");
      }),
    [],
  );
  const loadGroups = useCallback(async () => {
    const items = await fetchGroups();
    setGroups(items);
    const stored = account
      ? localStorage.getItem("cbt-group-" + account.uid)
      : null;
    setGroupId((old) =>
      items.some((g) => g.id === old)
        ? old
        : items.find((g) => g.id === stored)?.id || items[0]?.id || "",
    );
  }, [account?.uid]);
  useEffect(() => {
    if (!account) return;
    setBusy(true);
    loadGroups()
      .catch(report)
      .finally(() => setBusy(false));
  }, [account, loadGroups, report]);
  const refresh = useCallback(async () => {
    if (groupId) {
      const result = await fetchWorkspace(groupId);
      setWorkspace(result);
    }
  }, [groupId]);
  useEffect(() => {
    if (!groupId || !account) return;
    localStorage.setItem("cbt-group-" + account.uid, groupId);
    let active = true;
    setWorkspace(null);
    setBusy(true);
    fetchWorkspace(groupId)
      .then((w) => {
        if (active) {
          setWorkspace(w);
          const saved = localStorage.getItem(
            "cbt-profile-" + account.uid + "-" + groupId,
          );
          setProfileId(
            w.profiles.some(
              (p) =>
                p.id === saved &&
                (p.ownerUid === account.uid || p.guardianUid === account.uid),
            )
              ? saved!
              : w.profile.id,
          );
        }
      })
      .catch((e) => {
        if (active) report(e);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [groupId, account?.uid, report]);
  const needsPolling =
    !!workspace &&
    (workspace.jobs.some(
      (j) => j.status === "queued" || j.status === "running",
    ) ||
      workspace.challenges.some((c) => c.status !== "closed"));
  useEffect(() => {
    if (!needsPolling) return;
    const timer = setInterval(() => {
      void refresh().catch(report);
    }, 5000);
    return () => clearInterval(timer);
  }, [needsPolling, refresh, report]);
  const run = useCallback(
    async <T,>(
      action: string,
      input: Record<string, unknown> = {},
      requestId?: string,
    ): Promise<T> => {
      const result = await call<T>(action, { ...input, groupId }, requestId);
      if (!["lesson", "session", "leaderboard", "file"].includes(action))
        await refresh();
      return result;
    },
    [groupId, refresh],
  );
  const go = useCallback((next: View) => {
    setView(next);
    setSidebar(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const resume = useCallback(
    (session: Session) => {
      setSessionId(session.id);
      go("study");
    },
    [go],
  );
  const profile =
    workspace?.profiles.find((p) => p.id === profileId) || workspace?.profile;
  const start = useCallback<StudioContextValue["start"]>(
    async (lesson, mode, options = {}) => {
      const input = Object.fromEntries(
        Object.entries({
          lessonId: lesson.id,
          profileId: profile?.id,
          mode,
          ...options,
        }).filter(([, v]) => v !== undefined),
      );
      const session = await run<Session>("start", input);
      resume(session);
    },
    [run, profile?.id, resume],
  );
  if (!authReady)
    return <div className="loading-panel">Abrindo seu espaço...</div>;
  if (!account) return <AuthPanel report={report} error={error} />;
  if (!groups.length || creatingGroup)
    return (
      <Onboarding
        account={account}
        groups={groups}
        close={() => setCreatingGroup(false)}
        onDone={async () => {
          setCreatingGroup(false);
          await loadGroups();
        }}
        report={report}
        error={error}
        busy={busy}
      />
    );
  if (!workspace || !profile)
    return (
      <div className="loading-panel">
        <Brand />
        <p>{error || "Preparando seu espaço..."}</p>
        {error && (
          <button
            className="button secondary"
            onClick={() => location.reload()}
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  const context: StudioContextValue = {
    account,
    workspace,
    profile,
    view,
    go,
    notify,
    report,
    refresh,
    run,
    start,
    resume,
  };
  const editor = account.adult && workspace.role !== "student";
  const chosenProfiles = workspace.profiles.filter(
    (p) => p.id === workspace.profile.id || p.guardianUid === account.uid,
  );
  return (
    <StudioContext.Provider value={context}>
      <div className={"app-shell theme-" + profile.theme}>
        <a className="skip-link" href="#main-content">
          Ir para o conteúdo
        </a>
        {sidebar && (
          <button
            className="sidebar-overlay"
            aria-label="Fechar navegação"
            onClick={() => setSidebar(false)}
          />
        )}
        <aside className={"sidebar " + (sidebar ? "open" : "")}>
          <a
            className="brand-link"
            href="#inicio"
            onClick={(e) => {
              e.preventDefault();
              go("home");
            }}
          >
            <Brand />
          </a>
          <div className="space-label">SEU UNIVERSO DE ESTUDO</div>
          <nav aria-label="Navegação principal">
            {navigation
              .filter((n) => !n.editor || editor)
              .map((n) => (
                <button
                  type="button"
                  key={n.id}
                  className={view === n.id ? "active" : ""}
                  onClick={() => go(n.id)}
                >
                  <n.icon size={20} strokeWidth={1.7} />
                  <span>{n.label}</span>
                  {view === n.id && <span className="nav-dot" />}
                </button>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="growth-note">
              <span className="stat-icon green">
                <Leaf size={22} />
              </span>
              <strong>Conhecimento floresce.</strong>
              <p>Um pouco de curiosidade todos os dias faz a diferença.</p>
            </div>
            <button
              className="logout-button"
              onClick={() => logout().catch(report)}
            >
              <LogOut size={17} />
              Sair do espaço
            </button>
            <span className="version-label">
              CBT STUDIO · APRENDER SEM LIMITES
            </span>
          </div>
        </aside>
        <div className="main-column">
          <header className="topbar">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir navegação"
              onClick={() => setSidebar(true)}
            >
              <Menu size={23} />
            </button>
            <div className="breadcrumb">
              Meu universo<span>/</span>
              <strong>
                {navigation.find((n) => n.id === view)?.label ||
                  "Sessão de estudo"}
              </strong>
            </div>
            <div className="topbar-right">
              {demo && (
                <span className="demo-label">
                  <span className="dot" />
                  Demonstração local
                </span>
              )}
              <div className="group-switch">
                <label className="sr-only" htmlFor="group-switch">
                  Selecionar grupo
                </label>
                <select
                  id="group-switch"
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    go("home");
                  }}
                >
                  {groups.map((g) => (
                    <option value={g.id} key={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
                {account.adult && (
                  <button
                    className="icon-button"
                    aria-label="Criar outro espaço"
                    onClick={() => setCreatingGroup(true)}
                  >
                    <Plus size={17} />
                  </button>
                )}
              </div>
              <span className="topbar-separator" />
              <span className="avatar-small">{profile.avatar}</span>
              <div className="profile-switch">
                <label className="sr-only" htmlFor="profile-switch">
                  Perfil de estudo
                </label>
                <select
                  id="profile-switch"
                  value={profile.id}
                  onChange={(e) => {
                    setProfileId(e.target.value);
                    localStorage.setItem(
                      "cbt-profile-" + account.uid + "-" + groupId,
                      e.target.value,
                    );
                    go("home");
                  }}
                >
                  {chosenProfiles.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.nickname}
                    </option>
                  ))}
                </select>
                <span>
                  {profile.stage === "superior"
                    ? "Conhecimento em movimento"
                    : "Uma descoberta de cada vez"}
                </span>
              </div>
            </div>
          </header>
          <main id="main-content" tabIndex={-1}>
            <div className="content-wrap">
              {error && (
                <div className="alert error" role="alert">
                  <AlertCircle size={19} />
                  <span className="grow">{error}</span>
                  <button
                    className="icon-button"
                    aria-label="Fechar mensagem de erro"
                    onClick={() => setError("")}
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
              {notice && (
                <div className="alert success" role="status">
                  <CheckCircle2 size={19} />
                  <span className="grow">{notice}</span>
                  <button
                    className="icon-button"
                    aria-label="Fechar notificação"
                    onClick={() => setNotice("")}
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
              {view === "home" ? (
                <Home />
              ) : view === "library" ? (
                <Library key={profile.id} />
              ) : view === "create" && editor ? (
                <Creator key={profile.id} />
              ) : view === "groups" ? (
                <Groups />
              ) : view === "progress" ? (
                <Progress key={profile.id} />
              ) : view === "challenges" ? (
                <Challenges />
              ) : view === "settings" ? (
                <Preferences key={profile.id} />
              ) : view === "study" && sessionId ? (
                <Study key={sessionId} sessionId={sessionId} />
              ) : (
                <Home />
              )}
              <footer className="footer">
                <span>
                  <Leaf size={13} />
                  Feito para cultivar conhecimento.
                </span>
                <span>Do fundamental à graduação. E além.</span>
              </footer>
            </div>
          </main>
        </div>
      </div>
    </StudioContext.Provider>
  );
}
function AuthPanel({
  report,
  error,
}: {
  report: (e: unknown) => void;
  error: string;
}) {
  const [mode, setMode] = useState<"login" | "register" | "invite">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [child, setChild] = useState(true);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  async function task(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div>
          <p className="eyebrow">A CURIOSIDADE NÃO TEM IDADE.</p>
          <h1>
            Um espaço.
            <br />
            Infinitas descobertas.
          </h1>
          <p>
            Textos que viram ideias. Ideias que viram desafios. Conhecimento que
            acompanha você.
          </p>
          <Mascot className="auth-mascot" />
        </div>
        <span>DO ENSINO FUNDAMENTAL À GRADUAÇÃO</span>
      </section>
      <section className="auth-form">
        <h2>
          {mode === "invite"
            ? "Seu grupo está esperando."
            : mode === "register"
              ? "Crie seu espaço."
              : "Bom ter você por aqui."}
        </h2>
        <p className="muted">
          {mode === "invite"
            ? "Cole o código recebido do responsável ou organizador."
            : "Entre como responsável, educador ou estudante adulto."}
        </p>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {info && (
          <div className="alert success" role="status">
            {info}
          </div>
        )}
        {mode === "invite" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task(async () => {
                if (!child) {
                  await login("email", email, password);
                }
                await redeem(code, child);
              });
            }}
          >
            <label>
              Código de convite
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={3}
                required
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={child}
                onChange={(e) => setChild(e.target.checked)}
              />
              Entrada infantil sem e-mail
            </label>
            {!child && (
              <>
                <label>
                  E-mail
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Senha
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
              </>
            )}
            <button className="button primary full-width" disabled={busy}>
              Aceitar convite
              <ArrowRight size={17} />
            </button>
          </form>
        ) : (
          <>
            <button
              className="button secondary full-width"
              disabled={busy}
              onClick={() => task(() => login("google"))}
            >
              Continuar com Google
            </button>
            <div className="divider">
              <span>ou use seu e-mail</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void task(() =>
                  login(
                    mode === "register" ? "register" : "email",
                    email,
                    password,
                  ),
                );
              }}
            >
              <label>
                E-mail
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                Senha
                <input
                  type="password"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button className="button primary full-width" disabled={busy}>
                {busy
                  ? "Entrando..."
                  : mode === "register"
                    ? "Criar conta"
                    : "Entrar no meu espaço"}
                <ArrowRight size={17} />
              </button>
            </form>
            <button
              className="text-button"
              disabled={busy || !email}
              onClick={() =>
                task(async () => {
                  await resetPassword(email);
                  setInfo(
                    "Se houver uma conta para esse e-mail, você receberá as instruções de recuperação.",
                  );
                })
              }
            >
              Esqueci minha senha
            </button>
          </>
        )}
        <div className="auth-links">
          <button
            className="text-button"
            onClick={() => setMode(mode === "register" ? "login" : "register")}
          >
            {mode === "register"
              ? "Já tenho uma conta"
              : "Criar conta de adulto"}
          </button>
          <button
            className="text-button"
            onClick={() => setMode(mode === "invite" ? "login" : "invite")}
          >
            {mode === "invite" ? "Voltar à entrada" : "Tenho um convite"}
          </button>
        </div>
      </section>
    </div>
  );
}
function Onboarding({
  account,
  groups,
  close,
  onDone,
  report,
  error,
  busy,
}: {
  account: Account;
  groups: Group[];
  close: () => void;
  onDone: () => Promise<void>;
  report: (e: unknown) => void;
  error: string;
  busy: boolean;
}) {
  const [title, setTitle] = useState("Meu espaço de aprendizagem");
  const [nickname, setNickname] = useState("");
  const [stage, setStage] = useState<Profile["stage"]>("fundamental-inicial");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  async function task(fn: () => Promise<unknown>) {
    setSaving(true);
    try {
      await fn();
      await onDone();
    } catch (e) {
      report(e);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="onboarding">
      <Brand />
      <section className="panel">
        <h1>
          {groups.length
            ? "Um novo espaço para aprender."
            : "Vamos preparar seu espaço."}
        </h1>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {busy ? (
          <p>Buscando seus grupos...</p>
        ) : (
          <>
            {account.adult && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void task(() =>
                    call("createGroup", { title, nickname, stage }),
                  );
                }}
              >
                <label>
                  Nome do espaço
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  Seu apelido
                  <input
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                  />
                </label>
                <label>
                  Etapa inicial de estudo
                  <select
                    value={stage}
                    onChange={(e) =>
                      setStage(e.target.value as Profile["stage"])
                    }
                  >
                    {stages.map((s) => (
                      <option key={s} value={s}>
                        {stageLabels[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="small muted">
                  Você poderá mudar a etapa e a aparência quando quiser.
                </p>
                <button className="button primary" disabled={saving}>
                  Criar espaço privado
                  <ArrowRight size={17} />
                </button>
              </form>
            )}
            <div className="divider">
              <span>ou participe de um grupo</span>
            </div>
            <label>
              Código de convite
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={2}
              />
            </label>
            <button
              className="button secondary"
              disabled={saving || !code.trim()}
              onClick={() => task(() => redeem(code, !account.adult))}
            >
              Aceitar convite
            </button>
          </>
        )}
        {groups.length > 0 && (
          <button className="text-button" onClick={close}>
            Voltar ao meu espaço
          </button>
        )}
        <button className="text-button" onClick={() => logout().catch(report)}>
          Sair
        </button>
      </section>
    </div>
  );
}
