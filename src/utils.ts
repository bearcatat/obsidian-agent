import { App } from "obsidian";

// 全局App访问器
let globalApp: App | null = null;

export function setGlobalApp(app: App): void {
  globalApp = app;
}

export function getGlobalApp(): App {
  if (!globalApp) {
    throw new Error('Global app not set');
  }
  return globalApp;
}

export function clearGlobalApp(): void {
  globalApp = null;
}
