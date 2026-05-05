import { AgentScene } from "./components/Scene/AgentScene";
import { ChatWindow } from "./components/Chat/ChatWindow";
import "./App.scss";
import { useState } from "react";
import type { FacialExpressionName } from "./constants/Expressions";

function App() {
  const [facialExpression, setFacialExpression] =
    useState<FacialExpressionName>("happy");
  return (
    <main className="app">
      <section className="scene">
        <AgentScene facialExpression={facialExpression} />
      </section>

      <section className="panel">
        <ChatWindow setFacialExpression={setFacialExpression} />
      </section>
    </main>
  );
}

export default App;
