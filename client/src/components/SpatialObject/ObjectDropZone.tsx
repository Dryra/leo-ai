// client/src/components/SpatialObject/ObjectDropZone.tsx
import { useState } from "react";
import { uploadObject } from "../../services/api";
import { useAgentStore } from "../../stores/agentStore";

import "./spatial-object.scss";
import {
  useSpatialObjectStore,
  type SpatialObjectKind,
} from "../../stores/SpatialObjectStore";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

type ObjectAnalysisResult = {
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

type ObjectDropZoneProps = {
  onAnalysisComplete?: (result: ObjectAnalysisResult) => void | Promise<void>;
};

function getKind(file: File): SpatialObjectKind {
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (file.type === "application/pdf") return "pdf";
  return "text";
}

export function ObjectDropZone({ onAnalysisComplete }: ObjectDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { setState } = useAgentStore();
  const { setObject, patchObject } = useSpatialObjectStore();

  async function handleFile(file: File) {
    const kind = getKind(file);
    const previewUrl = kind === "image" ? URL.createObjectURL(file) : undefined;

    setObject({
      id: crypto.randomUUID(),
      kind,
      fileName: file.name,
      mimeType: file.type,
      previewUrl,
      status: "uploading",
    });

    setState("inspecting");

    try {
      patchObject({ status: "thinking" });
      //setState("thinking");

      const result = await uploadObject(file);

      patchObject({
        status: "ready",
        detectedType: result.detectedType,
        summary: result.summary,
        suggestedActions: result.suggestedActions,
      });
      await onAnalysisComplete?.(result);
      setState("ready");
    } catch (error) {
      console.error(error);
      patchObject({ status: "error" });
      setState("idle");
    }
  }

  return (
    <label
      className={isDragging ? "objectDropZone isDragging" : "objectDropZone"}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void handleFile(file);
      }}
    >
      <input
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.json,.ts,.tsx,.js,.jsx,.scss,.css,.html"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <span>Drop object into workspace</span>
    </label>
  );
}
