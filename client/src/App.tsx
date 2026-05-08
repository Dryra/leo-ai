import { AgentScene } from "./components/Scene/AgentScene";
import { ChatWindow } from "./components/Chat/ChatWindow";
import "./App.scss";
import { useState } from "react";
import type { FacialExpressionName } from "./constants/Expressions";
import { BackgroundAudioControls } from "./components/Audio/BackgroundAudioControls";
import { HintSection } from "./components/Layouts/HintSection";

import type { CSSProperties } from "react";
import { useAgentStore } from "./stores/agentStore";
import { STATE_VISUALS } from "./constants/stateVisuals";
import { playUiSound } from "./services/uiSounds";
import { NeuroModeToggle } from "./components/Chat/NeuroModeToggle";
import { useNeuroVoiceStore } from "./stores/neuroVoiceStore";

function App() {
  const [facialExpression, setFacialExpression] =
    useState<FacialExpressionName>("happy");
  const [isChatVisible, setIsChatVisible] = useState(true);
  const voiceState = useNeuroVoiceStore((state) => state.state);
  const neuroModeEnabled = useNeuroVoiceStore((state) => state.enabled);

  const label = {
    idle: "Standby",
    userSpeaking: "You're speaking",
    silence: "Listening",
    thinking: "Thinking",
    agentSpeaking: "Agent speaking",
  }[voiceState];

  const agentState = useAgentStore((state) => state.state);
  const uiColor = STATE_VISUALS[agentState].uiColor;

  function toggleChatWindow() {
    playUiSound("click");
    setIsChatVisible((visible) => !visible);
  }

  return (
    <main
      className="app"
      style={{ "--agent-ui-color": uiColor } as CSSProperties}
    >
      <section className="scene">
        <AgentScene facialExpression={facialExpression} />
      </section>
      <BackgroundAudioControls />
      <HintSection />
      <section className="panel">
        <div className="actionButtonContainer">
          {neuroModeEnabled && (
            <span
              className={
                isChatVisible
                  ? `neuroModeStatus ${voiceState}`
                  : `neuroModeStatus neuroModeStatusCollapsed ${voiceState}`
              }
            >
              {isChatVisible ? label : ""}
            </span>
          )}
          <NeuroModeToggle isChatVisible={isChatVisible} />
          <button
            className={isChatVisible ? "hideChatWindow" : "showChatWindow"}
            type="button"
            onClick={toggleChatWindow}
            aria-label={isChatVisible ? "Hide chat window" : "Show chat window"}
          />
        </div>

        <ChatWindow
          className={isChatVisible ? "is-visible" : "is-hidden"}
          setFacialExpression={setFacialExpression}
        />
      </section>
    </main>
  );
}

export default App;
