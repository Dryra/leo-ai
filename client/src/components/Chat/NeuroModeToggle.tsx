// client/src/components/Chat/NeuroModeToggle.tsx
import { useNeuroVoiceStore } from "../../stores/neuroVoiceStore";
import "./neuro-mode-toggle.scss";

export function NeuroModeToggle({ isChatVisible }: NeuroModeToggleProps) {
  const enabled = useNeuroVoiceStore((state) => state.enabled);
  const setEnabled = useNeuroVoiceStore((state) => state.setEnabled);

  return (
    <div
      className={isChatVisible ? "neuroMode" : "neuroMode neuroModeCollapsed"}
    >
      <button
        type="button"
        className={
          enabled ? "neuroModeButton neuroModeButtonOn" : "neuroModeButton"
        }
        onClick={() => setEnabled(!enabled)}
      ></button>
    </div>
  );
}

type NeuroModeToggleProps = {
  isChatVisible?: boolean;
};
