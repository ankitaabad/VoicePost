import { Navigate } from "react-router-dom";
import { useActiveProjectStore, useProjectsStore } from "../stores";
import { EmptyProjectsState } from "./studio/EmptyProjectsState";

export function AppRedirect() {
  const projects = useProjectsStore((s) => s.projects);
  const activeProjectId = useActiveProjectStore((s) => s.activeProjectId);
  const setActiveProject = useActiveProjectStore((s) => s.setActiveProject);

  if (activeProjectId && projects.some((p) => p.id === activeProjectId)) {
    return <Navigate to={`/app/${activeProjectId}`} replace />;
  }
  if (projects.length > 0) {
    const first = projects[0];
    setActiveProject(first.id, first.name);
    return <Navigate to={`/app/${first.id}`} replace />;
  }
  return <EmptyProjectsState />;
}
