import { create } from "zustand";

export type MusicStyle = "ambient" | "futuristic" | "static";

type BackgroundAudioState = {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  style: MusicStyle;
  amplitude: number;
  bass: number;
  mids: number;
  highs: number;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsMuted: (isMuted: boolean) => void;
  setVolume: (volume: number) => void;
  setStyle: (style: MusicStyle) => void;
  setAmplitude: (amplitude: number) => void;
  setAudioAnalysis: (analysis: {
    amplitude: number;
    bass: number;
    mids: number;
    highs: number;
  }) => void;
};

export const useBackgroundAudioStore = create<BackgroundAudioState>((set) => ({
  isPlaying: false,
  isMuted: false,
  volume: 0.3,
  style: "ambient",
  amplitude: 0,
  bass: 0,
  mids: 0,
  highs: 0,
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setVolume: (volume) => set({ volume }),
  setStyle: (style) => set({ style }),
  setAmplitude: (amplitude) => set({ amplitude }),
  setAudioAnalysis: (analysis) => set(analysis),
}));
