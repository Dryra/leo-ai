// client/src/components/Chat/NeuroModeToggle.tsx
import { useNeuroVoiceStore } from "../../stores/neuroVoiceStore";
import "./neuro-mode-toggle.scss";

export function NeuroModeToggle() {
  const enabled = useNeuroVoiceStore((state) => state.enabled);
  const voiceState = useNeuroVoiceStore((state) => state.state);
  const setEnabled = useNeuroVoiceStore((state) => state.setEnabled);

  const label = {
    idle: "Listening",
    userSpeaking: "You're speaking",
    silence: "Listening",
    thinking: "Thinking",
    agentSpeaking: "Agent speaking",
  }[voiceState];

  return (
    <div className="neuroMode">
      <button
        type="button"
        className="neuroModeButton"
        onClick={() => setEnabled(!enabled)}
      >
        {enabled ? "Neuro On" : "Neuro Off"}
      </button>
      {enabled && <span>{label}</span>}
    </div>
  );
}
