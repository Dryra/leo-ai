// client/src/components/Scene/SpatialObjectDisplay.tsx
import { Html, useTexture, useGLTF } from "@react-three/drei";
import { useSpatialObjectStore } from "../../stores/SpatialObjectStore";
import { useAgentStore } from "../../stores/agentStore";

import { useFrame } from "@react-three/fiber";
import { Suspense, useRef, useState } from "react";
import { DoubleSide, MathUtils, Vector3, type Group } from "three";

function ImageObject({ url }: { url: string }) {
  const texture = useTexture(url);

  return (
    <mesh>
      <planeGeometry args={[2.2, 1.35]} />
      <meshBasicMaterial map={texture} transparent side={DoubleSide} />
    </mesh>
  );
}

export function SpatialObjectDisplay() {
  const object = useSpatialObjectStore((state) => state.object);
  const isSpeaking = useAgentStore((state) => state.isSpeaking);
  const { state } = useAgentStore();
  const groupRef = useRef<Group>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  useFrame(() => {
    if (
      !groupRef.current ||
      !object ||
      isSpeaking ||
      state === "listening" ||
      state === "thinking"
    )
      return;

    const targetPosition = isZoomed
      ? new Vector3(0, -0.25, 1.6)
      : new Vector3(0, -1.15, 0.45);
    const targetScale = isZoomed ? 1.65 : 1;
    const targetRotationX = isZoomed ? -0.08 : -0.35;

    groupRef.current.position.lerp(targetPosition, 0.1);
    groupRef.current.scale.setScalar(
      MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.1),
    );
    groupRef.current.rotation.x = MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRotationX,
      0.1,
    );
  });

  if (!object || isSpeaking || state === "listening" || state === "thinking")
    return null;

  return (
    <group ref={groupRef} position={[0, -1.15, 0.45]} rotation={[-0.35, 0, 0]}>
      <mesh
        position={[0, 0, 0.02]}
        onClick={(event) => {
          event.stopPropagation();
          setIsZoomed((zoomed) => !zoomed);
        }}
      >
        <planeGeometry args={[2.5, 1.65]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {object.kind === "image" && object.previewUrl ? (
        <ImageObject url={object.previewUrl} />
      ) : (
        <Suspense fallback={null}>
          <ModelObject />
        </Suspense>
      )}

      <Html center transform position={[0, -1.05, 0]}>
        <div className="spatialObjectCard">
          <span>{object.fileName}</span>
        </div>
      </Html>
    </group>
  );
}

function ModelObject() {
  const groupRef = useRef<Group>(null);
  const { scene } = useGLTF("/models/file.glb");

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.35;
    }
  });

  return (
    <group ref={groupRef} scale={0.1}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/models/file.glb");
