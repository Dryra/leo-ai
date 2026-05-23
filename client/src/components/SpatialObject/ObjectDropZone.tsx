// client/src/components/SpatialObject/ObjectDropZone.tsx
import { useRef, useState } from "react";
import { clearUploadedObject, uploadObject } from "../../services/api";
import { useAgentStore } from "../../stores/agentStore";

import "./spatial-object.scss";
import {
  useSpatialObjectStore,
  type SpatialObjectKind,
} from "../../stores/SpatialObjectStore";
import { useHintStore } from "../../stores/hintStore";
import {
  useWorkspaceStore,
  type WorkspaceObjectType,
} from "../../stores/workspaceStore";

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
  demoToken?: string | null;
};

function getKind(file: File): SpatialObjectKind {
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (file.type === "application/pdf") return "pdf";
  return "text";
}

export function ObjectDropZone({
  onAnalysisComplete,
  demoToken,
}: ObjectDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { setState } = useAgentStore();
  const { object, setObject, patchObject } = useSpatialObjectStore();
  const objects = useWorkspaceStore((state) => state.objects);
  const activeObjectId = useWorkspaceStore((state) => state.activeObjectId);
  const addObject = useWorkspaceStore((state) => state.addObject);
  const updateObject = useWorkspaceStore((state) => state.updateObject);
  const { setHint, clearHint } = useHintStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const uploadRunRef = useRef(0);
  const activeWorkspaceObject =
    objects.find((workspaceObject) => workspaceObject.id === activeObjectId) ??
    null;
  const displayedObjectName = activeWorkspaceObject?.fileName;

  async function handleFile(file: File) {
    uploadRunRef.current += 1;
    const uploadRun = uploadRunRef.current;
    const abortController = new AbortController();
    const kind = getKind(file);
    const objectId = crypto.randomUUID();
    const previewUrl = kind === "image" ? URL.createObjectURL(file) : undefined;

    uploadAbortControllerRef.current?.abort();
    uploadAbortControllerRef.current = abortController;

    setObject({
      id: objectId,
      kind,
      fileName: file.name,
      mimeType: file.type,
      previewUrl,
      status: "uploading",
    });
    addObject({
      id: objectId,
      fileName: file.name,
      type: getWorkspaceType(file),
      previewUrl,
      createdAt: Date.now(),
    });

    setHint(`Inspecting ${file.name}`);
    setState("inspecting");

    try {
      patchObject({ status: "thinking" });
      //setState("thinking");

      const result = await uploadObject(
        file,
        abortController.signal,
        demoToken,
      );

      if (uploadRun !== uploadRunRef.current) return;

      patchObject({
        status: "ready",
        detectedType: result.detectedType,
        summary: result.summary,
        suggestedActions: result.suggestedActions,
      });
      updateObject(objectId, {
        id: result.objectId,
        fileName: file.name,
        type: getWorkspaceType(file),
        previewUrl,
        summary: result.summary,
        createdAt: Date.now(),
      });
      await onAnalysisComplete?.(result);
      setHint(`Ready: ${file.name}`);
      setState("ready");
    } catch (error) {
      if (uploadRun !== uploadRunRef.current) return;

      console.error(error);
      patchObject({ status: "error" });
      setHint(`Could not inspect ${file.name}`);
      setState("idle");
    } finally {
      if (uploadAbortControllerRef.current === abortController) {
        uploadAbortControllerRef.current = null;
      }
    }
  }

  async function handleDelete() {
    uploadRunRef.current += 1;
    uploadAbortControllerRef.current?.abort();
    uploadAbortControllerRef.current = null;

    if (object?.previewUrl) {
      URL.revokeObjectURL(object.previewUrl);
    }

    setObject(null);
    clearHint();
    setState("idle");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      await clearUploadedObject();
    } catch (error) {
      console.error(error);
    }
  }

  function getWorkspaceType(file: File): WorkspaceObjectType {
    if (file.type.startsWith("image/")) return "image";
    if (file.type === "application/pdf") return "pdf";
    if (
      file.name.endsWith(".ts") ||
      file.name.endsWith(".tsx") ||
      file.name.endsWith(".js") ||
      file.name.endsWith(".json")
    ) {
      return "code";
    }

    if (file.type.startsWith("text/")) return "text";

    return "unknown";
  }

  return (
    <div
      className={[
        "objectDropZone",
        isDragging ? "isDragging" : "",
        displayedObjectName ? "hasObject" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="button"
      tabIndex={0}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        fileInputRef.current?.click();
      }}
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
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.json,.ts,.tsx,.js,.jsx,.scss,.css,.html"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <span className="objectDropZoneLabel">
        {displayedObjectName ?? "Drop object into workspace"}
      </span>
      {displayedObjectName && (
        <button
          aria-label="Delete uploaded object"
          className="objectDropZoneDelete"
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleDelete();
          }}
        />
      )}
    </div>
  );
}
