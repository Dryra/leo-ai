import axios from "axios";
import { getSessionId } from "./session";
import type { AgentStep } from "../types/agentSteps";
import type { FacialExpressionName } from "../constants/Expressions";

const API_URL = import.meta.env.VITE_API_URL;
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL ?? "dryraa@gmail.com";
const CONTACT_LINKEDIN_URL = import.meta.env.VITE_CONTACT_LINKEDIN_URL ?? "";
const IS_DEV = import.meta.env.DEV;

export type ChatResponse = {
  reply: string;
  audio?: string;
  emotion?: FacialExpressionName;
  gesture?: "none" | "wink";
  steps?: AgentStep[];
};

export type VoiceResponse = {
  transcript: string;
  reply: string;
  audio?: string;
  emotion?: FacialExpressionName;
  gesture?: "none" | "wink";
  steps?: AgentStep[];
};

export type ContactLinks = {
  email: string;
  linkedinUrl?: string;
};

export class DemoAccessError extends Error {
  contact: ContactLinks;

  constructor() {
    super("Unauthorized. For demo access, please contact the developer.");
    this.name = "DemoAccessError";
    this.contact = {
      email: CONTACT_EMAIL,
      linkedinUrl: CONTACT_LINKEDIN_URL || "",
    };
  }
}

function getDemoTokenHeaders(demoToken: string | null | undefined) {
  if (!demoToken) {
    if (IS_DEV) return {};

    throw new DemoAccessError();
  }

  return {
    "x-demo-token": demoToken,
  };
}

export async function sendMessage(message: string, demoToken: string | null) {
  const response = await axios.post(
    `${API_URL}/api/ai/chat`,
    {
      message,
    },
    {
      headers: {
        ...getDemoTokenHeaders(demoToken),
        "x-session-id": getSessionId(),
      },
    },
  );

  return response.data as {
    text: string;
    audio: string;
    mimeType: string;
    emotion: "neutral" | "happy" | "sad" | "angry" | "bored";
    gesture: "none" | "wink";
    attachment?: {
      fileName: string;
      mimeType: string;
      data: string;
    };
  };
}

export async function generateSpeech(text: string, demoToken: string | null) {
  const response = await axios.post(
    `${API_URL}/api/ai/speech`,
    { text },
    {
      headers: {
        ...getDemoTokenHeaders(demoToken),
        "x-session-id": getSessionId(),
      },
    },
  );

  return response.data as {
    audio: string;
    mimeType: string;
  };
}

export async function sendVoiceMessage(
  audioBlob: Blob,
  demoToken: string | null,
) {
  const formData = new FormData();

  formData.append("audio", audioBlob, "voice.webm");

  const response = await axios.post(`${API_URL}/api/ai/voice`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...getDemoTokenHeaders(demoToken),
      "x-session-id": getSessionId(),
    },
  });

  return response.data as {
    transcript: string;
    reply: string;
    audio: string;
    mimeType: string;
    emotion: "neutral" | "happy" | "sad" | "angry" | "bored";
    gesture: "none" | "wink";
    attachment?: {
      fileName: string;
      mimeType: string;
      data: string;
    };
  };
}

export async function uploadObject(
  file: File,
  signal?: AbortSignal,
  demoToken?: string | null,
) {
  const formData = new FormData();
  formData.append("object", file);

  const response = await axios.post(`${API_URL}/api/ai/object`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...getDemoTokenHeaders(demoToken),
      "x-session-id": getSessionId(),
    },
    signal,
  });

  return response.data as {
    objectId: string;
    detectedType: string;
    summary: string;
    suggestedActions: string[];
    transcript: string;
    reply: string;
    audio: string;
    mimeType: string;
    emotion: "neutral" | "happy" | "sad" | "angry" | "bored";
  };
}

export async function clearUploadedObject() {
  await axios.delete(`${API_URL}/api/ai/object`, {
    headers: {
      "x-session-id": getSessionId(),
    },
  });
}
