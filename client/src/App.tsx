import { AgentScene } from "./components/Scene/AgentScene";
import { ChatWindow } from "./components/Chat/ChatWindow";
import "./App.scss";
import { useState } from "react";
import type { FacialExpressionName } from "./constants/Expressions";
import { BackgroundAudioControls } from "./components/Audio/BackgroundAudioControls";

function App() {
  const [facialExpression, setFacialExpression] =
    useState<FacialExpressionName>("happy");
  const [isChatVisible, setIsChatVisible] = useState(true);

  function toggleChatWindow() {
    setIsChatVisible((visible) => !visible);
  }

  return (
    <main className="app">
      <section className="scene">
        <AgentScene facialExpression={facialExpression} />
      </section>
      <BackgroundAudioControls />
      <section className="panel">
        <button
          className={isChatVisible ? "hideChatWindow" : "showChatWindow"}
          type="button"
          onClick={toggleChatWindow}
          aria-label={isChatVisible ? "Hide chat window" : "Show chat window"}
        />
        <ChatWindow
          className={isChatVisible ? "is-visible" : "is-hidden"}
          setFacialExpression={setFacialExpression}
        />
      </section>
    </main>
  );
}

export default App;
