// client/src/components/Scene/SpatialObjectDisplay.tsx
import { Html, useTexture, useGLTF } from "@react-three/drei";
import { useSpatialObjectStore } from "../../stores/SpatialObjectStore";
import { useAgentStore } from "../../stores/agentStore";

import { useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import type { Group } from "three";

function ImageObject({ url }: { url: string }) {
  const texture = useTexture(url);

  return (
    <mesh position={[0, -1.15, 0.45]} rotation={[-0.35, 0, 0]}>
      <planeGeometry args={[2.2, 1.35]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}

export function SpatialObjectDisplay() {
  const object = useSpatialObjectStore((state) => state.object);
  const isSpeaking = useAgentStore((state) => state.isSpeaking);
  const { state } = useAgentStore();

  if (!object || isSpeaking || state === "listening" || state === "thinking")
    return null;

  if (object.kind === "image" && object.previewUrl) {
    return <ImageObject url={object.previewUrl} />;
  }

  return (
    <group position={[0, -1.15, 0.45]} rotation={[-0.35, 0, 0]}>
      <Suspense fallback={null}>
        <ModelObject />
      </Suspense>

      <Html center transform>
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
    <group ref={groupRef} scale={1}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/models/file.glb");
