import { AsyncLocalStorage } from "node:async_hooks";
import type SenseLogs from "senselogs";

export type ContextType = {
  logger: SenseLogs;
};

export const asyncLocalStorage = new AsyncLocalStorage<ContextType>();
