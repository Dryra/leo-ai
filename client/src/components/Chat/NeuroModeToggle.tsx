// client/src/components/Chat/NeuroModeToggle.tsx
import { prepareAudioPlayback } from "../../services/audio";
import { useNeuroVoiceStore } from "../../stores/neuroVoiceStore";
import "./neuro-mode-toggle.scss";

export function NeuroModeToggle({ isChatVisible }: NeuroModeToggleProps) {
  const enabled = useNeuroVoiceStore((state) => state.enabled);
  const setEnabled = useNeuroVoiceStore((state) => state.setEnabled);

  async function handleToggle() {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);

    if (!nextEnabled) return;

    try {
      await prepareAudioPlayback();
    } catch (error) {
      console.error("Could not prepare neuro mode audio playback.", error);
    }
  }

  return (
    <div
      className={isChatVisible ? "neuroMode" : "neuroMode neuroModeCollapsed"}
    >
      <button
        type="button"
        className={
          enabled ? "neuroModeButton neuroModeButtonOn" : "neuroModeButton"
        }
        onClick={handleToggle}
      ></button>
    </div>
  );
}

type NeuroModeToggleProps = {
  isChatVisible?: boolean;
};
