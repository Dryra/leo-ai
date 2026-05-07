// client/src/constants/stateVisuals.ts
import type { AgentState } from "../stores/agentStore";

export const STATE_VISUALS: Record<
  AgentState,
  {
    color: string;
    uiColor: string;
    ringOpacity: number;
    lightIntensity: number;
    particleOpacity: number;
    pulseSpeed: number;
  }
> = {
  idle: {
    color: "#38e8ff",
    uiColor: "#132a2e",
    ringOpacity: 0.35,
    lightIntensity: 1.8,
    particleOpacity: 0.55,
    pulseSpeed: 1.4,
  },
  listening: {
    color: "#60a5fa",
    uiColor: "#1d4ed8",
    ringOpacity: 0.5,
    lightIntensity: 2.2,
    particleOpacity: 0.7,
    pulseSpeed: 1.8,
  },
  thinking: {
    color: "#a855f7",
    uiColor: "#6d28d9",
    ringOpacity: 0.58,
    lightIntensity: 2.7,
    particleOpacity: 0.82,
    pulseSpeed: 3,
  },
  speaking: {
    color: "#22d3ee",
    uiColor: "#0891b2",
    ringOpacity: 0.72,
    lightIntensity: 3.4,
    particleOpacity: 0.95,
    pulseSpeed: 8,
  },
  ready: {
    color: "#13cb0d",
    uiColor: "#15803d",
    ringOpacity: 0.72,
    lightIntensity: 3.4,
    particleOpacity: 0.95,
    pulseSpeed: 8,
  },
  inspecting: {
    color: "#dda40a",
    uiColor: "#b45309",
    ringOpacity: 0.72,
    lightIntensity: 3.4,
    particleOpacity: 0.95,
    pulseSpeed: 8,
  },
};
