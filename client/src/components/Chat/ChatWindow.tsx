import { useEffect, useRef, useState } from "react";
import { sendMessage, sendVoiceMessage } from "../../services/api";
import { base64ToAudioUrl, playAudioWithVolume } from "../../services/audio";
import { useAgentStore } from "../../stores/agentStore";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";
import type { FacialExpressionName } from "../../constants/Expressions";
import { ObjectDropZone } from "../SpatialObject/ObjectDropZone";
import { useSpatialObjectStore } from "../../stores/SpatialObjectStore";

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
};

export function ChatWindow({
  className = "",
  setFacialExpression,
}: ChatWindowProps) {
  const [, setTranscript] = useState("");
  const [, setReply] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const {
    state,
    setState,
    setSpeaking,
    setEmotion,
    setMouthOpen,
    setAfterSpeakingState,
  } = useAgentStore();
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

  const [message, setMessage] = useState("");
  const canSendMessage = message.trim().length > 0 && !loading;

  const isHoldingSpaceRef = useRef(false);
  const isProcessingVoiceRef = useRef(false);
  const hasSpaceRecordingStartedRef = useRef(false);
  const isStartingSpaceRecordingRef = useRef(false);
  const spaceHoldTimeoutRef = useRef<number | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = messagesContainerRef.current;

      if (!container) return;

      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [chatMessages, loading]);

  async function handleSend() {
    const userMessage = message.trim();

    if (!userMessage) return;

    const returnStateAfterSpeaking = getReturnStateAfterSpeaking();

    setChatMessages((messages) => [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
      },
    ]);
    setMessage("");
    setState("thinking");
    setFacialExpression("thinking");
    setLoading(true);

    try {
      const result = await sendMessage(userMessage);
      setReply(result.text);
      setEmotion(result.emotion);
      setFacialExpression(result.emotion);
      setChatMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content: result.text,
        },
      ]);

      const audioUrl = base64ToAudioUrl(result.audio, result.mimeType);

      if (returnStateAfterSpeaking) {
        setAfterSpeakingState(returnStateAfterSpeaking);
      }
      setSpeaking(true);
      await playAudioWithVolume(audioUrl, (volume) => {
        setMouthOpen(volume);
      });

      setMouthOpen(0);
      setSpeaking(false);
      URL.revokeObjectURL(audioUrl);
    } catch (err) {
      console.error(err);
      setError("Something went wrong with the text request.");
      setSpeaking(false);
      setMouthOpen(0);
      setState(returnStateAfterSpeaking ?? "idle");
    } finally {
      setLoading(false);
    }
  }

  function getReturnStateAfterSpeaking() {
    const currentObject = useSpatialObjectStore.getState().object;

    if (!currentObject || currentObject.status === "error") return null;
    if (currentObject.status === "ready") return "ready";

    return "inspecting";
  }

  async function processVoiceMessage(audioBlob: Blob) {
    const returnStateAfterSpeaking = getReturnStateAfterSpeaking();

    setState("thinking");
    setFacialExpression("thinking");

    const result = await sendVoiceMessage(audioBlob);

    setTranscript(result.transcript);
    setReply(result.reply);
    setEmotion(result.emotion);
    setFacialExpression(result.emotion);
    setChatMessages((messages) => [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: result.transcript,
      },
      {
        id: crypto.randomUUID(),
        role: "agent",
        content: result.reply,
      },
    ]);

    const audioUrl = base64ToAudioUrl(result.audio, result.mimeType);

    if (returnStateAfterSpeaking) {
      setAfterSpeakingState(returnStateAfterSpeaking);
    }
    setSpeaking(true);
    await playAudioWithVolume(audioUrl, (volume) => {
      setMouthOpen(volume);
    });

    setMouthOpen(0);
    setSpeaking(false);
    URL.revokeObjectURL(audioUrl);
  }

  async function handleVoiceClick() {
    setError("");

    try {
      if (!isRecording) {
        setTranscript("");
        setReply("");
        setState("listening");
        setFacialExpression("listening");
        await startRecording();
        return;
      }
      setFacialExpression("listening");

      const audioBlob = await stopRecording();
      await processVoiceMessage(audioBlob);
    } catch (err) {
      console.error(err);
      setError("Something went wrong with the voice request.");
      setSpeaking(false);
      setState("idle");
    }
  }

  useEffect(() => {
    async function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      if (event.repeat) return;
      if (isHoldingSpaceRef.current) return;
      if (isProcessingVoiceRef.current) return;

      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTyping) return;

      event.preventDefault();

      isHoldingSpaceRef.current = true;
      hasSpaceRecordingStartedRef.current = false;
      setError("");

      spaceHoldTimeoutRef.current = setTimeout(async () => {
        if (!isHoldingSpaceRef.current || isProcessingVoiceRef.current) return;

        try {
          setTranscript("");
          setReply("");
          setState("listening");
          setFacialExpression("listening");

          isStartingSpaceRecordingRef.current = true;
          await startRecording();
          isStartingSpaceRecordingRef.current = false;
          hasSpaceRecordingStartedRef.current = true;

          if (!isHoldingSpaceRef.current) {
            isProcessingVoiceRef.current = true;
            const audioBlob = await stopRecording();
            await processVoiceMessage(audioBlob);
            isProcessingVoiceRef.current = false;
            hasSpaceRecordingStartedRef.current = false;
          }
        } catch (err) {
          console.error(err);
          isHoldingSpaceRef.current = false;
          isStartingSpaceRecordingRef.current = false;
          isProcessingVoiceRef.current = false;
          hasSpaceRecordingStartedRef.current = false;
          setError("Could not start recording.");
          setState("idle");
        }
      }, 1000);
    }

    async function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      if (!isHoldingSpaceRef.current) return;

      event.preventDefault();

      isHoldingSpaceRef.current = false;

      if (spaceHoldTimeoutRef.current !== null) {
        window.clearTimeout(spaceHoldTimeoutRef.current);
        spaceHoldTimeoutRef.current = null;
      }

      if (!hasSpaceRecordingStartedRef.current) {
        if (!isStartingSpaceRecordingRef.current) {
          setState("idle");
        }
        return;
      }

      try {
        isProcessingVoiceRef.current = true;

        const audioBlob = await stopRecording();
        await processVoiceMessage(audioBlob);
      } catch (err) {
        console.error(err);
        setError("Something went wrong with the voice request.");
        setSpeaking(false);
        setMouthOpen(0);
        setState("idle");
      } finally {
        isProcessingVoiceRef.current = false;
        hasSpaceRecordingStartedRef.current = false;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      if (spaceHoldTimeoutRef.current !== null) {
        window.clearTimeout(spaceHoldTimeoutRef.current);
      }

      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    startRecording,
    stopRecording,
    setState,
    setSpeaking,
    setMouthOpen,
    setFacialExpression,
  ]);

  return (
    <div className={["chat-window", className].filter(Boolean).join(" ")}>
      <div className="chatHeader">
        <h2>LEO AI</h2>

        <p>State: {state}</p>
      </div>
      <div className="messagesContainer" ref={messagesContainerRef}>
        {chatMessages.map((chatMessage) => (
          <div
            className={
              chatMessage.role === "user" ? "userMessage" : "agentMessage"
            }
            key={chatMessage.id}
          >
            <div
              className={
                chatMessage.role === "user" ? "senderUser" : "senderAgent"
              }
            >
              <strong>{chatMessage.role === "user" ? "You:" : "Leo:"}</strong>
            </div>
            <div
              className={
                chatMessage.role === "user" ? "message user" : "message agent"
              }
            >
              <p>{chatMessage.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="agentMessage">
            <div className="senderAgent">
              <strong>Leo:</strong>
            </div>
            <div className="message agent">
              <p>Thinking...</p>
            </div>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="bottom-row">
        <p className="recondingHint">Hold Space bar to start recording.</p>
        <div className="input-row">
          <input
            name="chat"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;

              e.preventDefault();
              void handleSend();
            }}
            placeholder="Ask something..."
          />

          <button disabled={!canSendMessage} onClick={handleSend}>
            Send
          </button>
        </div>
      </div>

      <button
        className={isRecording ? "record-button recording" : "record-button"}
        onClick={handleVoiceClick}
      >
        {isRecording ? "Stop Recording" : "Start Voice Chat"}
      </button>
      <ObjectDropZone
        onAnalysisComplete={async (result) => {
          setReply(result.reply);
          setEmotion(result.emotion);
          setFacialExpression(result.emotion);
          setChatMessages((messages) => [
            ...messages,
            {
              id: crypto.randomUUID(),
              role: "agent",
              content: result.reply,
            },
          ]);

          const audioUrl = base64ToAudioUrl(result.audio, result.mimeType);

          setAfterSpeakingState("ready");
          setSpeaking(true);
          await playAudioWithVolume(audioUrl, (volume) => {
            setMouthOpen(volume);
          });

          setMouthOpen(0);
          setSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        }}
      />
    </div>
  );
}

type ChatWindowProps = {
  className?: string;
  setFacialExpression: (expression: FacialExpressionName) => void;
};
