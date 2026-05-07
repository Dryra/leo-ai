import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export async function sendMessage(message: string) {
  const response = await axios.post(`${API_URL}/api/ai/chat`, {
    message,
  });

  return response.data as {
    text: string;
    audio: string;
    mimeType: string;
    emotion: "neutral" | "happy" | "sad" | "angry" | "bored";
    attachment?: {
      fileName: string;
      mimeType: string;
      data: string;
    };
  };
}

export async function sendVoiceMessage(audioBlob: Blob) {
  const formData = new FormData();

  formData.append("audio", audioBlob, "voice.webm");

  const response = await axios.post(`${API_URL}/api/ai/voice`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data as {
    transcript: string;
    reply: string;
    audio: string;
    mimeType: string;
    emotion: "neutral" | "happy" | "sad" | "angry" | "bored";
    attachment?: {
      fileName: string;
      mimeType: string;
      data: string;
    };
  };
}

export async function uploadObject(file: File, signal?: AbortSignal) {
  const formData = new FormData();
  formData.append("object", file);

  const response = await axios.post(`${API_URL}/api/ai/object`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
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
  await axios.delete(`${API_URL}/api/ai/object`);
}
