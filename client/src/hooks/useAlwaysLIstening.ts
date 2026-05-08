// client/src/hooks/useAlwaysListening.ts
import { useEffect, useRef } from "react";
import { useAgentStore } from "../stores/agentStore";
import { useNeuroVoiceStore } from "../stores/neuroVoiceStore";
import { useSpatialObjectStore } from "../stores/SpatialObjectStore";

type Options = {
  enabled: boolean;
  onUtterance: (audioBlob: Blob) => Promise<void>;
  speechThreshold?: number;
  silenceThreshold?: number;
  silenceDurationMs?: number;
  minSpeechDurationMs?: number;
};

export function useAlwaysListening({
  enabled,
  onUtterance,
  speechThreshold = 0.08,
  silenceThreshold = 0.035,
  silenceDurationMs = 1000,
  minSpeechDurationMs = 500,
}: Options) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const onUtteranceRef = useRef(onUtterance);
  const startedAtRef = useRef(0);
  const silenceStartedAtRef = useRef<number | null>(null);
  const modeRef = useRef<"idle" | "recording" | "thinking" | "agentSpeaking">(
    "idle",
  );

  const setAgentState = useAgentStore((state) => state.setState);
  const setVoiceLevel = useAgentStore((state) => state.setVoiceLevel);
  const setNeuroState = useNeuroVoiceStore((state) => state.setState);
  const setAudioLevel = useNeuroVoiceStore((state) => state.setAudioLevel);

  useEffect(() => {
    onUtteranceRef.current = onUtterance;
  }, [onUtterance]);

  useEffect(() => {
    if (!enabled) return;

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let data: Uint8Array<ArrayBuffer>;
    let cancelled = false;

    async function start() {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      data = new Uint8Array(analyser.fftSize);

      modeRef.current = "idle";
      setNeuroState("idle");
      console.log("getReturnStateAfterSpeaking", getReturnStateAfterSpeaking());
      setAgentState(getReturnStateAfterSpeaking() ?? "idle");
      tick();
    }

    function getLevel() {
      if (!analyser || !data) return 0;

      analyser.getByteTimeDomainData(data);

      let sum = 0;
      for (const value of data) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }

      return Math.sqrt(sum / data.length);
    }

    function beginRecording() {
      const stream = streamRef.current;
      if (!stream) return;

      chunksRef.current = [];
      startedAtRef.current = performance.now();
      silenceStartedAtRef.current = null;

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const duration = performance.now() - startedAtRef.current;

        if (duration < minSpeechDurationMs) {
          modeRef.current = "idle";
          setNeuroState("idle");
          setAgentState(getReturnStateAfterSpeaking() ?? "idle");
          return;
        }

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });

        modeRef.current = "thinking";
        setNeuroState("thinking");
        setAgentState("thinking");

        try {
          await onUtteranceRef.current(blob);
        } catch (error) {
          console.error("Could not process neuro voice utterance.", error);
        }

        modeRef.current = "idle";
        setNeuroState("idle");
        const returnStateAfterSpeaking = getReturnStateAfterSpeaking();
        if (returnStateAfterSpeaking) {
          setAgentState(returnStateAfterSpeaking);
        } else {
          setAgentState("idle");
        }
      };

      recorderRef.current = recorder;
      recorder.start();

      modeRef.current = "recording";
      setNeuroState("userSpeaking");
      setAgentState("listening");
    }

    function getReturnStateAfterSpeaking() {
      const currentObject = useSpatialObjectStore.getState().object;

      if (!currentObject || currentObject.status === "error") return null;
      if (currentObject.status === "ready") return "ready";

      return "inspecting";
    }

    function stopRecording() {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") return;

      recorder.stop();
      recorderRef.current = null;
    }

    function tick() {
      const level = getLevel();

      setAudioLevel(level);
      setVoiceLevel(level);

      if (modeRef.current === "idle" && level > speechThreshold) {
        beginRecording();
      }

      if (modeRef.current === "recording") {
        if (level < silenceThreshold) {
          if (silenceStartedAtRef.current === null) {
            silenceStartedAtRef.current = performance.now();
            setNeuroState("silence");
          }

          const silenceMs = performance.now() - silenceStartedAtRef.current;

          if (silenceMs >= silenceDurationMs) {
            stopRecording();
          }
        } else {
          silenceStartedAtRef.current = null;
          setNeuroState("userSpeaking");
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    void start();

    return () => {
      cancelled = true;

      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContext?.close();

      setAudioLevel(0);
      setVoiceLevel(0);
      setNeuroState("idle");
    };
  }, [
    enabled,
    minSpeechDurationMs,
    setAgentState,
    setAudioLevel,
    setNeuroState,
    setVoiceLevel,
    silenceDurationMs,
    silenceThreshold,
    speechThreshold,
  ]);
}
