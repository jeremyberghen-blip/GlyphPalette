import { useState } from "react";
import { useApp } from "../store";
import { projectFolderName } from "../lib/paths";

/** The project's name in the top bar: click to rename; hover for where it's saved. */
export default function ProjectTitle({ dirty }: { dirty: boolean }) {
  const projectName = useApp((s) => s.projectName);
  const filePath = useApp((s) => s.filePath);
  const [draft, setDraft] = useState<string | null>(null);

  if (draft !== null) {
    const commit = () => {
      useApp.getState().setProjectName(draft);
      setDraft(null);
    };
    return (
      <input
        className="w-44 rounded border border-[#4c9aff] bg-[#191a21] px-1.5 py-0.5 text-sm text-[#e2e4ee] outline-none"
        value={draft}
        autoFocus
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(null);
        }}
      />
    );
  }

  return (
    <button
      className="max-w-[16rem] shrink-0 truncate rounded px-1.5 py-0.5 text-left text-sm text-[#8a8ea6] hover:bg-[#262835] hover:text-[#e2e4ee]"
      title={`${filePath ?? "Not saved yet"}\nBuilds into ${projectFolderName(projectName)}/ · click to rename`}
      onClick={() => setDraft(projectName)}
    >
      {projectName}
      {dirty && <span className="ml-1 text-[#4c9aff]" title="Unsaved changes">•</span>}
    </button>
  );
}
