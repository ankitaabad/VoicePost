import type { ProjectData } from "@app/shared";

const PROJECTS_KEY = "voicepost-projects";
const LAST_PROJECT_KEY = "voicepost-last-id";
const LAST_SELECTION_KEY = "voicepost-last-selection";

export type LastSelection = {
  voice_id: string;
  bgm_track: string;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage unavailable — silently drop
  }
}

export function getProjects(): ProjectData[] {
  return readJson<ProjectData[]>(PROJECTS_KEY, []);
}

export function saveProject(project: ProjectData): void {
  const projects = getProjects();
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = project;
  } else {
    projects.unshift(project);
  }
  writeJson(PROJECTS_KEY, projects);
  setLastProjectId(project.id);
}

export function deleteProject(id: string): void {
  const projects = getProjects().filter((p) => p.id !== id);
  writeJson(PROJECTS_KEY, projects);
  if (getLastProjectId() === id) {
    localStorage.removeItem(LAST_PROJECT_KEY);
  }
}

export function getProject(id: string): ProjectData | null {
  return getProjects().find((p) => p.id === id) ?? null;
}

export function isProjectNameUnique(name: string, excludeId?: string): boolean {
  const trimmed = name.trim().toLowerCase();
  return !getProjects().some(
    (p) => p.name.trim().toLowerCase() === trimmed && p.id !== excludeId,
  );
}

export function getLastProjectId(): string | null {
  return localStorage.getItem(LAST_PROJECT_KEY);
}

export function setLastProjectId(id: string): void {
  localStorage.setItem(LAST_PROJECT_KEY, id);
}

export function getLastSelection(): LastSelection | null {
  return readJson<LastSelection | null>(LAST_SELECTION_KEY, null);
}

export function saveLastSelection(selection: LastSelection): void {
  writeJson(LAST_SELECTION_KEY, selection);
}
