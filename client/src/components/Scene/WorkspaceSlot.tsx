import { Clone, Text, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import {
  useWorkspaceStore,
  type WorkspaceObject,
} from "../../stores/workspaceStore";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

type WorkspaceSlotProps = {
  object: WorkspaceObject;
  index: number;
  position: [number, number, number];
  rotation?: THREE.Euler | THREE.Vector3Tuple;
  isActive: boolean;
};

export function WorkspaceSlot({
  object,
  position,
  rotation,
  isActive,
}: WorkspaceSlotProps) {
  const setActiveObject = useWorkspaceStore((state) => state.setActiveObject);

  const scale = isActive ? 1.15 : 0.8;
  const opacity = isActive ? 1 : 0.45;

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={(event) => {
        event.stopPropagation();
        setActiveObject(object.id);
      }}
    >
      <ActiveBaseRing isActive={isActive} />

      {object.type === "image" && object.previewUrl ? (
        <ImagePanel url={object.previewUrl} opacity={opacity} />
      ) : (
        <FileModel opacity={opacity} isActive={isActive} />
      )}

      <Text
        position={[0, -1.05, 0.04]}
        fontSize={0.16}
        color={isActive ? "#e8fbff" : "#7dd3fc"}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.8}
      >
        {object.fileName}
      </Text>
    </group>
  );
}

function ImagePanel({ url, opacity }: { url: string; opacity: number }) {
  const texture = useTexture(url);

  return (
    <mesh>
      <planeGeometry args={[2.2, 1.35]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function FileModel({
  opacity,
  isActive,
}: {
  opacity: number;
  isActive: boolean;
}) {
  const { scene } = useGLTF("/models/file.glb");
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    groupRef.current.rotation.y += delta * (isActive ? 0.35 : 0.18);
  });

  return (
    <group ref={groupRef} position={[0, -0.4, 0]} scale={isActive ? 0.6 : 1}>
      <Clone
        object={scene}
        inject={
          <meshStandardMaterial
            color={isActive ? "#38e8ff" : "#155e75"}
            transparent
            opacity={opacity}
            side={THREE.DoubleSide}
            emissive={isActive ? "#0ea5e9" : "#082f49"}
            emissiveIntensity={isActive ? 0.7 : 0.25}
          />
        }
      />
    </group>
  );
}

function ActiveBaseRing({ isActive }: { isActive: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.82, 0]}>
      <torusGeometry args={[1.25, 0.025, 16, 96]} />
      <meshBasicMaterial
        color="#eeeeee"
        transparent
        opacity={isActive ? 0.55 : 0.1}
        depthWrite={false}
      />
    </mesh>
  );
}

useGLTF.preload("/models/file.glb");
