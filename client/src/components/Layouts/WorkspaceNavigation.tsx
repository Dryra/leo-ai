import { useEffect } from "react";
import { useAgentStore } from "../../stores/agentStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import "./workspace-navigation.scss";

export function WorkspaceNavigation() {
  const objectCount = useWorkspaceStore((state) => state.objects.length);
  const nextObject = useWorkspaceStore((state) => state.nextObject);
  const previousObject = useWorkspaceStore((state) => state.previousObject);
  const agentState = useAgentStore((state) => state.state);
  const isSpeaking = useAgentStore((state) => state.isSpeaking);
  const isDisabled =
    isSpeaking || agentState === "speaking" || agentState === "inspecting";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isDisabled) return;
      if (event.key === "ArrowRight") nextObject();
      if (event.key === "ArrowLeft") previousObject();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDisabled, nextObject, previousObject]);

  if (objectCount <= 1) return null;

  return (
    <div className="workspaceNavigation">
      <button
        aria-label="Previous workspace object"
        className="workspaceNavigationButton"
        data-direction="previous"
        disabled={isDisabled}
        type="button"
        onClick={previousObject}
      >
        <span aria-hidden="true" className="workspaceNavigationArrow" />
      </button>
      <button
        aria-label="Next workspace object"
        className="workspaceNavigationButton"
        data-direction="next"
        disabled={isDisabled}
        type="button"
        onClick={nextObject}
      >
        <span aria-hidden="true" className="workspaceNavigationArrow" />
      </button>
    </div>
  );
}
