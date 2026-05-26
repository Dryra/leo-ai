import { useCallback, useEffect, useRef, useState } from "react";
import {
  DemoAccessError,
  sendMessage,
  sendVoiceMessage,
} from "../../services/api";
import type { ContactLinks } from "../../services/api";
import { base64ToAudioUrl, playAudioWithVolume } from "../../services/audio";
import {
  useAgentStore,
  type AgentAttentionTarget,
} from "../../stores/agentStore";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";
import type { FacialExpressionName } from "../../constants/Expressions";
import { ObjectDropZone } from "../SpatialObject/ObjectDropZone";
import { useSpatialObjectStore } from "../../stores/SpatialObjectStore";
import { useNeuroVoiceStore } from "../../stores/neuroVoiceStore";
import { useAlwaysListening } from "../../hooks/useAlwaysLIstening";
import { WorkspaceNavigation } from "../Layouts/WorkspaceNavigation";
import {
  useWorkspaceStore,
  type WorkspaceObjectType,
} from "../../stores/workspaceStore";

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt: number;
  attachment?: ChatAttachment;
  contact?: ContactLinks;
  isPending?: boolean;
};

type ChatAttachment = {
  fileName: string;
  mimeType: string;
  data: string; // base64
};

type ChatError = {
  message: string;
  contact?: ContactLinks;
};

// Format the timing
function formatMessageTime(createdAt: number, now: number) {
  const secondsAgo = Math.max(0, Math.floor((now - createdAt) / 1000));

  if (secondsAgo < 60) {
    if (secondsAgo <= 1) return "just now";

    return `${secondsAgo} seconds ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));
}

// Convert attachement to downloadable
function attachmentToDownloadUrl(attachment: ChatAttachment) {
  const binary = atob(attachment.data);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: attachment.mimeType });

  return URL.createObjectURL(blob);
}

function splitFileName(fileName: string) {
  const extensionStart = fileName.lastIndexOf(".");

  if (extensionStart <= 0 || extensionStart === fileName.length - 1) {
    return { name: fileName, extension: "" };
  }

  return {
    name: fileName.slice(0, extensionStart),
    extension: fileName.slice(extensionStart),
  };
}

export function ChatWindow({
  className = "",
  setFacialExpression,
}: ChatWindowProps) {
  const [, setTranscript] = useState("");
  const [, setReply] = useState("");
  const [error, setError] = useState<ChatError | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [now, setNow] = useState(Date.now());

  const state = useAgentStore((store) => store.state);
  const setState = useAgentStore((store) => store.setState);
  const addWorkspaceObject = useWorkspaceStore((store) => store.addObject);
  const isSpeaking = useAgentStore((store) => store.isSpeaking);
  const setSpeaking = useAgentStore((store) => store.setSpeaking);
  const setEmotion = useAgentStore((store) => store.setEmotion);
  const setMouthOpen = useAgentStore((store) => store.setMouthOpen);
  const triggerGesture = useAgentStore((store) => store.triggerGesture);
  const setAttentionTarget = useAgentStore((store) => store.setAttentionTarget);
  const clearAttentionTarget = useAgentStore(
    (store) => store.clearAttentionTarget,
  );

  const setAfterSpeakingState = useAgentStore(
    (store) => store.setAfterSpeakingState,
  );
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

  const [message, setMessage] = useState("");
  const controlsDisabled =
    isSpeaking || state === "speaking" || state === "inspecting";
  const canSendMessage =
    message.trim().length > 0 && !loading && !controlsDisabled;

  const isHoldingSpaceRef = useRef(false);
  const isProcessingVoiceRef = useRef(false);
  const hasSpaceRecordingStartedRef = useRef(false);
  const isStartingSpaceRecordingRef = useRef(false);
  const spaceHoldTimeoutRef = useRef<number | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const neuroEnabled = useNeuroVoiceStore((state) => state.enabled);
  const setNeuroState = useNeuroVoiceStore((state) => state.setState);

  const [demoToken, setDemoToken] = useState<string | null>(null);

  const attentionTimeoutRef = useRef<number | null>(null);
  const loadingRef = useRef(false);

  const handleNeuroUtterance = useCallback(
    async (audioBlob: Blob) => {
      await processVoiceMessage(audioBlob);
    },
    [processVoiceMessage],
  );

  useAlwaysListening({
    enabled: neuroEnabled && !isRecording && !loading,
    onUtterance: handleNeuroUtterance,
  });

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

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

  useEffect(() => {
    if (error) {
      const createdAt = Date.now();
      setFacialExpression("sad");

      setChatMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content: error.message,
          createdAt,
          contact: error.contact,
          isPending: false,
        },
      ]);
    }
  }, [error]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      setDemoToken(token);
      // clean up url
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  async function handleSend() {
    const userMessage = message.trim();

    if (!userMessage || !canSendMessage) return;

    const returnStateAfterSpeaking = getReturnStateAfterSpeaking();
    const pendingAgentMessageId = crypto.randomUUID();
    const createdAt = Date.now();

    setChatMessages((messages) => [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
        createdAt,
      },
      {
        id: pendingAgentMessageId,
        role: "agent",
        content: "Thinking...",
        createdAt,
        isPending: true,
      },
    ]);
    setMessage("");
    setState("thinking");
    setFacialExpression("thinking");
    setLoading(true);

    try {
      const result = await sendMessage(userMessage, demoToken);

      // Wirte the file result to the spatial display
      if (result.attachment) {
        displayAttachmentInWorkspace(result.attachment);
        setAfterSpeakingState("ready");
      } else if (returnStateAfterSpeaking) {
        setAfterSpeakingState(returnStateAfterSpeaking);
      }

      setReply(result.text);
      setEmotion(result.emotion);
      setFacialExpression(result.emotion);
      if (result.gesture !== "none") {
        triggerGesture(result.gesture);
      }
      setChatMessages((messages) =>
        messages.map((chatMessage) =>
          chatMessage.id === pendingAgentMessageId
            ? {
                ...chatMessage,
                content: result.text,
                attachment: result.attachment,
                isPending: false,
              }
            : chatMessage,
        ),
      );

      const audioUrl = base64ToAudioUrl(result.audio, result.mimeType);

      setSpeaking(true);
      await playAudioWithVolume(audioUrl, (volume) => {
        setMouthOpen(volume);
      });

      setMouthOpen(0);
      setSpeaking(false);
      URL.revokeObjectURL(audioUrl);
    } catch (err) {
      console.error(err);
      setError(getRequestError(err));
      setChatMessages((messages) =>
        messages.filter(
          (chatMessage) => chatMessage.id !== pendingAgentMessageId,
        ),
      );
      setSpeaking(false);
      setMouthOpen(0);
      setState(returnStateAfterSpeaking ?? "idle");
    } finally {
      setLoading(false);
    }
  }

  function displayAttachmentInWorkspace(attachment: ChatAttachment) {
    const blob = attachmentToBlob(attachment);
    const previewUrl = URL.createObjectURL(blob);
    const objectId = crypto.randomUUID();

    useSpatialObjectStore.getState().setObject({
      id: objectId,
      kind: getSpatialObjectKind(attachment.mimeType),
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      previewUrl,
      status: "ready",
    });
    addWorkspaceObject({
      id: objectId,
      fileName: attachment.fileName,
      type: getWorkspaceObjectType(attachment.mimeType, attachment.fileName),
      previewUrl,
      createdAt: Date.now(),
    });
  }

  function attachmentToBlob(attachment: ChatAttachment) {
    const binary = atob(attachment.data);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new Blob([bytes], { type: attachment.mimeType });
  }

  function getSpatialObjectKind(mimeType: string) {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType === "application/pdf") return "pdf";

    return "text";
  }

  function getWorkspaceObjectType(
    mimeType: string,
    fileName: string,
  ): WorkspaceObjectType {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType === "application/pdf") return "pdf";
    if (
      fileName.endsWith(".ts") ||
      fileName.endsWith(".tsx") ||
      fileName.endsWith(".js") ||
      fileName.endsWith(".jsx") ||
      fileName.endsWith(".json") ||
      fileName.endsWith(".css") ||
      fileName.endsWith(".scss") ||
      fileName.endsWith(".html")
    ) {
      return "code";
    }
    if (mimeType.startsWith("text/")) return "text";

    return "unknown";
  }

  function getReturnStateAfterSpeaking() {
    const currentObject = useSpatialObjectStore.getState().object;

    if (!currentObject || currentObject.status === "error") return null;
    if (currentObject.status === "ready") return "ready";

    return "inspecting";
  }

  async function processVoiceMessage(audioBlob: Blob) {
    const returnStateAfterSpeaking = getReturnStateAfterSpeaking();
    const pendingUserMessageId = crypto.randomUUID();
    const pendingAgentMessageId = crypto.randomUUID();
    const createdAt = Date.now();
    let audioUrl: string | null = null;

    setState("thinking");
    setFacialExpression("thinking");
    setChatMessages((messages) => [
      ...messages,
      {
        id: pendingUserMessageId,
        role: "user",
        content: "Voice message...",
        createdAt,
        isPending: true,
      },
      {
        id: pendingAgentMessageId,
        role: "agent",
        content: "Thinking...",
        createdAt,
        isPending: true,
      },
    ]);

    try {
      const result = await sendVoiceMessage(audioBlob, demoToken);

      if (result.attachment) {
        displayAttachmentInWorkspace(result.attachment);
        setAfterSpeakingState("ready");
      } else if (returnStateAfterSpeaking) {
        setAfterSpeakingState(returnStateAfterSpeaking);
      }

      setTranscript(result.transcript);
      //playUiSound("messagePop");
      setReply(result.reply);
      setEmotion(result.emotion);
      setFacialExpression(result.emotion);
      if (result.gesture !== "none") {
        triggerGesture(result.gesture);
      }
      setChatMessages((messages) =>
        messages.map((chatMessage) => {
          if (chatMessage.id === pendingUserMessageId) {
            return {
              ...chatMessage,
              content: result.transcript,
              isPending: false,
            };
          }

          if (chatMessage.id === pendingAgentMessageId) {
            return {
              ...chatMessage,
              content: result.reply,
              attachment: result.attachment,
              isPending: false,
            };
          }

          return chatMessage;
        }),
      );

      audioUrl = base64ToAudioUrl(result.audio, result.mimeType);

      setNeuroState("agentSpeaking");
      setSpeaking(true);

      await playAudioWithVolume(audioUrl, (volume) => {
        setMouthOpen(volume);
      });

      setMouthOpen(0);
      setSpeaking(false);
      setNeuroState("idle");
    } catch (error) {
      setChatMessages((messages) =>
        messages.filter(
          (chatMessage) =>
            chatMessage.id !== pendingUserMessageId &&
            chatMessage.id !== pendingAgentMessageId,
        ),
      );
      setMouthOpen(0);
      setSpeaking(false);
      setNeuroState("idle");
      throw error;
    } finally {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    }
  }

  async function handleVoiceClick() {
    if (controlsDisabled) return;

    setError(null);

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
      setError(getRequestError(err));
      setSpeaking(false);
      setState("idle");
    }
  }

  useEffect(() => {
    async function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      if (controlsDisabled) return;
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
      setError(null);

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
          setError({ message: "Could not start recording." });
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
        setError(getRequestError(err));
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
    controlsDisabled,
    startRecording,
    stopRecording,
    setState,
    setSpeaking,
    setMouthOpen,
    setFacialExpression,
  ]);

  function nudgeAttention(target: AgentAttentionTarget) {
    setAttentionTarget(target);

    if (attentionTimeoutRef.current !== null) {
      window.clearTimeout(attentionTimeoutRef.current);
    }

    attentionTimeoutRef.current = window.setTimeout(() => {
      clearAttentionTarget();
    }, 1200);
  }

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
              <strong>{chatMessage.role === "user" ? "You" : "Leo"}</strong>
              <time dateTime={new Date(chatMessage.createdAt).toISOString()}>
                {formatMessageTime(chatMessage.createdAt, now)}
              </time>
            </div>
            <div
              className={
                chatMessage.role === "user" ? "message user" : "message agent"
              }
            >
              <p>{chatMessage.content}</p>
              {chatMessage.attachment && (
                <ChatAttachmentLink attachment={chatMessage.attachment} />
              )}
              {chatMessage.contact && (
                <ContactActions contact={chatMessage.contact} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bottom-row">
        <div className="input-row">
          <input
            name="chat"
            onFocus={() => setAttentionTarget("chatInput")}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setAttentionTarget("chatInput");
              nudgeAttention("chatInput");
            }}
            onBlur={() => clearAttentionTarget()}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;

              e.preventDefault();
              void handleSend();
            }}
            placeholder="Ask something..."
          />

          <button
            disabled={!canSendMessage}
            className="sendTextChat"
            onMouseEnter={() => setAttentionTarget("sendButton")}
            onClick={() => {
              setAttentionTarget("sendButton");
              nudgeAttention("sendButton");

              void handleSend();
            }}
          ></button>
          <button
            className={
              isRecording ? "record-button recording" : "record-button"
            }
            disabled={controlsDisabled}
            onClick={() => {
              setAttentionTarget("voiceButton");
              nudgeAttention("voiceButton");
              void handleVoiceClick();
            }}
          ></button>
        </div>
      </div>

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
              createdAt: Date.now(),
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
        demoToken={demoToken}
      />
      <WorkspaceNavigation></WorkspaceNavigation>
    </div>
  );
}

function getRequestError(error: unknown): ChatError {
  if (error instanceof DemoAccessError) {
    return {
      message: error.message,
      contact: error.contact,
    };
  }

  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "error" in error.response.data &&
    typeof error.response.data.error === "string"
  ) {
    const contact =
      "contact" in error.response.data &&
      isContactLinks(error.response.data.contact)
        ? error.response.data.contact
        : undefined;

    return {
      message: error.response.data.error,
      contact,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  return {
    message: "Something went wrong with the text request.",
  };
}

function isContactLinks(value: unknown): value is ContactLinks {
  if (!value || typeof value !== "object") return false;

  const contact = value as Partial<ContactLinks>;

  return (
    typeof contact.email === "string" &&
    (!contact.linkedinUrl || typeof contact.linkedinUrl === "string")
  );
}

function ChatAttachmentLink({ attachment }: { attachment: ChatAttachment }) {
  const [url, setUrl] = useState("");
  const { name, extension } = splitFileName(attachment.fileName);

  useEffect(() => {
    const nextUrl = attachmentToDownloadUrl(attachment);
    setUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [attachment]);

  return (
    <a className="chatAttachment" href={url} download={attachment.fileName}>
      <span className="chatAttachmentPrefix">Download</span>
      <span className="chatAttachmentName">{name}</span>
      <span className="chatAttachmentExtension">{extension}</span>
    </a>
  );
}

function ContactActions({ contact }: { contact: ContactLinks }) {
  return (
    <div className="contactActions">
      <a href={`mailto:${contact.email}`}>Email</a>
      {contact.linkedinUrl && (
        <a href={contact.linkedinUrl} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
      )}
    </div>
  );
}

type ChatWindowProps = {
  className?: string;
  setFacialExpression: (expression: FacialExpressionName) => void;
};
