import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useAgentStore } from "../../stores/agentStore";

const POINT_COUNT = 96;

type VoiceWaveformProps = {
  color?: THREE.ColorRepresentation;
};

export function VoiceWaveform({ color = "#38e8ff" }: VoiceWaveformProps) {
  const lineRef = useRef<THREE.Line>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);
  const { state, mouthOpen } = useAgentStore();

  const geometry = useMemo(() => {
    const positions = new Float32Array(POINT_COUNT * 3);

    for (let i = 0; i < POINT_COUNT; i++) {
      const x = (i / (POINT_COUNT - 1) - 0.5) * 2.4;

      positions[i * 3] = x;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    return geometry;
  }, []);

  const line = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    materialRef.current = material;

    return new THREE.Line(geometry, material);
  }, [color, geometry]);

  useFrame(({ clock }) => {
    if (!lineRef.current || !materialRef.current) return;

    const time = clock.getElapsedTime();
    const positionAttribute = lineRef.current.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;

    const positions = positionAttribute.array as Float32Array;

    const voiceAmount = state === "speaking" ? mouthOpen : 0;
    const idleAmount = state === "idle" ? 0.035 : 0.015;
    const amplitude = idleAmount + voiceAmount * 0.15;

    for (let i = 0; i < POINT_COUNT; i++) {
      const x = (i / (POINT_COUNT - 1) - 0.5) * 2.4;
      const phase = i * 0.22;

      const primaryWave = Math.sin(time * 8 + phase) * amplitude;
      const secondaryWave =
        Math.sin(time * 15 + phase * 1.7) * amplitude * 0.35;

      positions[i * 3] = x;
      positions[i * 3 + 1] = primaryWave + secondaryWave;
      positions[i * 3 + 2] = Math.cos(time * 5 + phase) * amplitude * 0.2;
    }

    positionAttribute.needsUpdate = true;

    const targetOpacity = state === "speaking" ? 0.95 : 0.35;

    materialRef.current.opacity = THREE.MathUtils.lerp(
      materialRef.current.opacity,
      targetOpacity,
      0.12,
    );
  });

  return (
    <group position={[0, -1.8, 0.8]}>
      <primitive ref={lineRef} object={line} />
    </group>
  );
}
