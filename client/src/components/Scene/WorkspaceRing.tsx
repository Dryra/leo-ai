import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useAgentStore } from "../../stores/agentStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { WorkspaceSlot } from "./WorkspaceSlot";

const RADIUS = 4;

type WorkspaceRingProps = {
  position?: THREE.Vector3Tuple;
};

export function WorkspaceRing({ position = [0, 0, 0] }: WorkspaceRingProps) {
  const groupRef = useRef<THREE.Group>(null);
  const objects = useWorkspaceStore((state) => state.objects);
  const activeIndex = useWorkspaceStore((state) => state.activeIndex);
  const agentState = useAgentStore((state) => state.state);
  const isVisible = agentState === "inspecting" || agentState === "ready";

  useFrame(() => {
    if (!groupRef.current || !isVisible || objects.length === 0) return;

    const activeAngle = (activeIndex / objects.length) * Math.PI * 2;

    // Rotate ring so active object comes to front.
    const targetRotationY = -activeAngle;

    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotationY,
      0.08,
    );
  });

  if (!isVisible) return null;

  return (
    <group ref={groupRef} position={position}>
      {objects.map((object, index) => {
        const angle = (index / objects.length) * Math.PI * 2;
        const position: [number, number, number] = [
          Math.sin(angle) * RADIUS,
          1.15,
          Math.cos(angle) * RADIUS,
        ];

        return (
          <WorkspaceSlot
            key={object.id}
            object={object}
            index={index}
            position={position}
            rotation={[0, angle, 0]}
            isActive={index === activeIndex}
          />
        );
      })}
    </group>
  );
}
