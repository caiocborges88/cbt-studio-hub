import { createContext, useContext } from "react";
import type {
  ActivityType,
  Lesson,
  Profile,
  Session,
  Workspace,
} from "../shared/domain";
import type { Account } from "./lib/api";
export type View =
  | "home"
  | "library"
  | "create"
  | "groups"
  | "progress"
  | "challenges"
  | "settings"
  | "study";
export interface StudioContextValue {
  account: Account;
  workspace: Workspace;
  profile: Profile;
  view: View;
  go: (view: View) => void;
  notify: (message: string) => void;
  report: (error: unknown) => void;
  refresh: () => Promise<void>;
  run: <T = unknown>(
    action: string,
    input?: Record<string, unknown>,
    requestId?: string,
  ) => Promise<T>;
  start: (
    lesson: Lesson,
    mode: "trail" | "practice" | "challenge",
    options?: {
      size?: number;
      type?: ActivityType;
      difficulty?: string;
      challengeId?: string;
    },
  ) => Promise<void>;
  resume: (session: Session) => void;
}
export const StudioContext = createContext<StudioContextValue | null>(null);
export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) throw new Error("Contexto indisponível.");
  return context;
}
