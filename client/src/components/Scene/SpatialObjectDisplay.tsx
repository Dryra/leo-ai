// client/src/components/Scene/SpatialObjectDisplay.tsx
import { Html, useTexture } from "@react-three/drei";
import { useSpatialObjectStore } from "../../stores/SpatialObjectStore";
import { useAgentStore } from "../../stores/agentStore";

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
      <mesh>
        <boxGeometry args={[2.2, 1.35, 0.06]} />
        <meshStandardMaterial
          color="#132a2e"
          emissive="#38e8ff"
          emissiveIntensity={0.35}
        />
      </mesh>

      <Html center transform>
        <div className="spatialObjectCard">
          <span>{object.fileName}</span>
        </div>
      </Html>
    </group>
  );
}
