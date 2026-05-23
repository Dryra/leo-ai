import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useAgentStore } from "../../stores/agentStore";

type BrainNode = {
  position: THREE.Vector3;
  offset: number;
};

type BrainConnection = {
  start: THREE.Vector3;
  end: THREE.Vector3;
  offset: number;
};

function BrainNodeMesh({ node, index }: { node: BrainNode; index: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const { state, mouthOpen } = useAgentStore();

  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current) return;

    const time = clock.getElapsedTime();

    let opacity = 0.45;
    let scale = 1;

    if (state === "idle") {
      opacity = 0.45 + Math.sin(time * 1.2 + node.offset) * 0.12;
      scale = 1 + Math.sin(time * 1.2 + node.offset) * 0.08;
    }

    if (state === "thinking") {
      const wave = (time * 4 - index * 0.35) % 8;
      const active = wave > 0 && wave < 1 ? 1 - wave : 0;

      opacity = 0.5 + active * 0.5;
      scale = 1 + active * 0.8;
    }

    if (state === "speaking") {
      const voicePulse = mouthOpen * 2.8;
      const rhythm = Math.max(0, Math.sin(time * 12 + node.offset));

      opacity = 0.55 + voicePulse * 0.16 + rhythm * mouthOpen * 0.25;
      scale = 1 + mouthOpen * 1.1;
    }

    materialRef.current.opacity = THREE.MathUtils.lerp(
      materialRef.current.opacity,
      THREE.MathUtils.clamp(opacity, 0.25, 1),
      0.18,
    );

    meshRef.current.scale.setScalar(
      THREE.MathUtils.lerp(meshRef.current.scale.x, scale, 0.18),
    );
  });

  return (
    <mesh ref={meshRef} position={node.position}>
      <sphereGeometry args={[0.025, 16, 16]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#7dd3fc"
        transparent
        opacity={0.95}
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function BrainConnectionLine({
  connection,
  index,
}: {
  connection: BrainConnection;
  index: number;
}) {
  const lineRef = useRef<THREE.Line>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);
  const { state, mouthOpen } = useAgentStore();

  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      connection.start,
      connection.end,
    ]);
    const material = new THREE.LineBasicMaterial({
      color: "#38bdf8",
      transparent: true,
      opacity: 0.28,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    materialRef.current = material;
    return new THREE.Line(geometry, material);
  }, [connection.start, connection.end]);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;

    const time = clock.getElapsedTime();

    let opacity = 0.12;

    if (state === "idle") {
      opacity = 0.1 + Math.sin(time * 0.8 + connection.offset) * 0.04;
    }

    if (state === "thinking") {
      const wave = (time * 5 - index * 0.25) % 8;
      const active = wave > 0 && wave < 1 ? 1 - wave : 0;

      opacity = 0.15 + active * 0.75;
    }

    if (state === "speaking") {
      opacity = 0.2 + mouthOpen * 0.9;
    }

    materialRef.current.opacity = THREE.MathUtils.lerp(
      materialRef.current.opacity,
      opacity,
      0.18,
    );
  });

  return <primitive ref={lineRef} object={line} />;
}

export function AIBrain() {
  const groupRef = useRef<THREE.Group>(null);
  const state = useAgentStore((store) => store.state);

  const { nodes, connections } = useMemo(() => {
    const radius = 1.25;
    const nodeCount = 48;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    const nodes: BrainNode[] = Array.from({ length: nodeCount }, (_, index) => {
      const y = 1 - (index / (nodeCount - 1)) * 2;
      const circleRadius = Math.sqrt(1 - y * y);
      const theta = goldenAngle * index;
      const organicOffset = 1;

      return {
        position: new THREE.Vector3(
          Math.cos(theta) * circleRadius * radius * organicOffset,
          y * radius * 0.95,
          Math.sin(theta) * circleRadius * radius * organicOffset,
        ),
        offset: index * 0.28,
      };
    });

    const connectionKeys = new Set<string>();
    const connections: BrainConnection[] = [];

    nodes.forEach((node, index) => {
      const nearest = nodes
        .map((otherNode, otherIndex) => ({
          otherNode,
          otherIndex,
          distance: node.position.distanceTo(otherNode.position),
        }))
        .filter(({ otherIndex }) => otherIndex !== index)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);

      nearest.forEach(({ otherNode, otherIndex }) => {
        const startIndex = Math.min(index, otherIndex);
        const endIndex = Math.max(index, otherIndex);
        const key = `${startIndex}-${endIndex}`;

        if (connectionKeys.has(key)) return;

        connectionKeys.add(key);
        connections.push({
          start: node.position,
          end: otherNode.position,
          offset: connections.length * 0.25,
        });
      });
    });

    return { nodes, connections };
  }, []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const time = clock.getElapsedTime();
    const isPulsing = state === "thinking" || state === "inspecting";
    const pulse = isPulsing ? 1 + Math.sin(time * 4.5) * 0.14 : 1;

    groupRef.current.rotation.y = time * 0.08;
    groupRef.current.rotation.x = Math.sin(time * 0.25) * 0.12;
    groupRef.current.scale.setScalar(
      THREE.MathUtils.lerp(groupRef.current.scale.x, pulse, 0.12),
    );
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[1.25, 32, 12]} />
        <meshBasicMaterial
          color="#38bdf8"
          wireframe
          transparent
          opacity={0.08}
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {connections.map((connection, index) => (
        <BrainConnectionLine
          key={`connection-${index}`}
          connection={connection}
          index={index}
        />
      ))}

      {nodes.map((node, index) => (
        <BrainNodeMesh key={`node-${index}`} node={node} index={index} />
      ))}
    </group>
  );
}
