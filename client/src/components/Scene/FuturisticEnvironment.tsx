import { Float, Stars } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useAgentStore } from "../../stores/agentStore";
import { useBackgroundAudioStore } from "../../stores/backgroundAudioStore";
import { STATE_VISUALS } from "../../constants/stateVisuals";
import { useSpatialObjectStore } from "../../stores/SpatialObjectStore";

const DEFAULT_FOG_NEAR = 3;
const DEFAULT_FOG_FAR = 9;
const OBJECT_FOCUS_FOG_NEAR = 7;
const OBJECT_FOCUS_FOG_FAR = 16;
const HOLOGRAM_GRID_Y = -2.55;
const HOLOGRAM_GRID_SIZE = 120;
const HOLOGRAM_GRID_DIVISIONS = 240;
const HOLOGRAM_GRID_CELL_SIZE = HOLOGRAM_GRID_SIZE / HOLOGRAM_GRID_DIVISIONS;

function NeonRing({
  radius,
  y,
  speed,
}: {
  radius: number;
  y: number;
  speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const { state, mouthOpen } = useAgentStore();

  useFrame(({ clock }) => {
    if (!ref.current || !materialRef.current) return;

    const time = clock.getElapsedTime();
    const visual = STATE_VISUALS[state];
    const speechBlink = state === "speaking" ? mouthOpen * 0.8 : 0;
    const pulse =
      0.75 + Math.sin(time * visual.pulseSpeed + radius) * 0.25 + speechBlink;

    ref.current.rotation.z = time * speed * (state === "speaking" ? 1.8 : 1);
    materialRef.current.color.lerp(new THREE.Color(visual.color), 0.08);
    materialRef.current.opacity = THREE.MathUtils.lerp(
      materialRef.current.opacity,
      visual.ringOpacity * pulse,
      0.12,
    );
  });

  return (
    <mesh ref={ref} position={[0, y, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.01, 16, 160]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#38e8ff"
        transparent
        opacity={0.45}
      />
    </mesh>
  );
}

function HologramGrid() {
  const gridRef = useRef<THREE.GridHelper>(null);
  const camera = useThree((state) => state.camera);
  const { state, mouthOpen } = useAgentStore();
  const { amplitude, bass, mids, highs, isPlaying } = useBackgroundAudioStore();

  useFrame(({ clock }) => {
    if (!gridRef.current) return;

    const visual = STATE_VISUALS[state];
    const time = clock.getElapsedTime();
    const materials = Array.isArray(gridRef.current.material)
      ? gridRef.current.material
      : [gridRef.current.material];
    const speechBlink =
      state === "speaking" ? Math.sin(time * 18) * mouthOpen * 0.45 : 0;

    const audioPulse = isPlaying ? amplitude * 0.01 : 0;
    const bassPulse = isPlaying ? bass : 0;
    const midsPulse = isPlaying ? mids : 0;
    const highsPulse = isPlaying ? highs : 0;

    const environmentColor = new THREE.Color(visual.color);
    const bassGlowColor = environmentColor
      .clone()
      .lerp(new THREE.Color("#ffffff"), 0.85);
    const targetScale = 1 + bassPulse * 0.5;

    gridRef.current.scale.setScalar(
      THREE.MathUtils.lerp(gridRef.current.scale.x, targetScale, 0.12),
    );

    gridRef.current.position.x =
      Math.round(camera.position.x / HOLOGRAM_GRID_CELL_SIZE) *
      HOLOGRAM_GRID_CELL_SIZE;
    gridRef.current.position.z =
      Math.round(camera.position.z / HOLOGRAM_GRID_CELL_SIZE) *
      HOLOGRAM_GRID_CELL_SIZE;

    const targetGridColor = bassPulse > 0.08 ? bassGlowColor : environmentColor;
    const colorLerpSpeed = 0.04 + highsPulse * 0.5 + bassPulse * 0.35;
    const targetOpacity =
      visual.ringOpacity * 1.25 +
      audioPulse * 0.5 +
      bassPulse * 0.45 +
      midsPulse * 0.1 +
      Math.max(0, speechBlink);

    materials.forEach((gridMaterial) => {
      const lineMaterial = gridMaterial as THREE.LineBasicMaterial;

      lineMaterial.transparent = true;
      lineMaterial.color.lerp(targetGridColor, colorLerpSpeed);
      lineMaterial.opacity = THREE.MathUtils.lerp(
        lineMaterial.opacity,
        targetOpacity,
        0.12,
      );
    });
  });

  return (
    <gridHelper
      ref={gridRef}
      args={[HOLOGRAM_GRID_SIZE, HOLOGRAM_GRID_DIVISIONS, "#849c9f", "#155e75"]}
      position={[0, HOLOGRAM_GRID_Y, 0]}
      frustumCulled={false}
    />
  );
}

function FloatingParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const { state, mouthOpen } = useAgentStore();

  const particleData = useMemo(() => {
    const count = 500;
    const positions = new Float32Array(count * 3);
    const basePositions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 10;
      const y = Math.random() * 5 - 1.5;
      const z = (Math.random() - 0.5) * 8;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = y;
      basePositions[i * 3 + 2] = z;

      velocities[i * 3] = (Math.random() - 0.5) * 0.08;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
      phases[i] = Math.random() * Math.PI * 2;
    }

    return { positions, basePositions, velocities, phases };
  }, []);

  useFrame(({ clock }, delta) => {
    if (!pointsRef.current || !materialRef.current) return;

    const time = clock.getElapsedTime();
    const visual = STATE_VISUALS[state];
    const speechBlink = state === "speaking" ? mouthOpen * 0.75 : 0;
    const positionAttribute = pointsRef.current.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const positions = positionAttribute.array as Float32Array;
    const { basePositions, velocities, phases } = particleData;

    for (let i = 0; i < phases.length; i++) {
      const index = i * 3;
      const baseX = basePositions[index];
      const baseY = basePositions[index + 1];
      const baseZ = basePositions[index + 2];
      const phase = phases[i];

      let targetX = baseX + Math.sin(time * 0.45 + phase) * velocities[index];
      let targetY =
        baseY + Math.sin(time * 0.65 + phase) * velocities[index + 1];
      let targetZ =
        baseZ + Math.cos(time * 0.45 + phase) * velocities[index + 2];
      let followSpeed = 1.8;

      if (state === "thinking" || state === "inspecting") {
        const radius = Math.max(0.8, Math.hypot(baseX, baseZ) * 0.55);
        const angle = Math.atan2(baseZ, baseX) + time * 0.75 + phase * 0.18;

        targetX = Math.cos(angle) * radius;
        targetY = baseY * 0.65 + Math.sin(time * 1.4 + phase) * 0.32 + 0.25;
        targetZ = Math.sin(angle) * radius - 0.15;
        followSpeed = 3.2;
      }

      if (state === "speaking") {
        const distance = Math.max(0.001, Math.hypot(baseX, baseY, baseZ));
        const pulse =
          mouthOpen * (1.1 + Math.max(0, Math.sin(time * 12 + phase)) * 0.8);

        targetX = baseX + (baseX / distance) * pulse * 1.4;
        targetY = baseY + (baseY / distance) * pulse * 0.9;
        targetZ = baseZ + (baseZ / distance) * pulse * 1.4;
        followSpeed = 7;
      }

      positions[index] = THREE.MathUtils.lerp(
        positions[index],
        targetX,
        delta * followSpeed,
      );
      positions[index + 1] = THREE.MathUtils.lerp(
        positions[index + 1],
        targetY,
        delta * followSpeed,
      );
      positions[index + 2] = THREE.MathUtils.lerp(
        positions[index + 2],
        targetZ,
        delta * followSpeed,
      );
    }

    positionAttribute.needsUpdate = true;

    pointsRef.current.rotation.y = time * (state === "speaking" ? 0.08 : 0.03);
    materialRef.current.color.lerp(new THREE.Color(visual.color), 0.08);
    materialRef.current.opacity = THREE.MathUtils.lerp(
      materialRef.current.opacity,
      visual.particleOpacity + speechBlink,
      0.12,
    );
    materialRef.current.size = THREE.MathUtils.lerp(
      materialRef.current.size,
      0.018 + speechBlink * 0.018,
      0.12,
    );
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particleData.positions, 3]}
        />
      </bufferGeometry>

      <pointsMaterial
        ref={materialRef}
        color="#67e8f9"
        size={0.018}
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  );
}

function BackPortal() {
  return (
    <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.25}>
      <group position={[0, 0.15, -1.2]}>
        <NeonRing radius={1.65} y={0} speed={0.12} />
        <NeonRing radius={1.95} y={0} speed={-0.08} />
        <NeonRing radius={2.25} y={0} speed={0.05} />
      </group>
    </Float>
  );
}

export function FuturisticEnvironment() {
  const mainLightRef = useRef<THREE.PointLight>(null);
  const sideLightRef = useRef<THREE.PointLight>(null);
  const accentLightRef = useRef<THREE.PointLight>(null);
  const backgroundColorRef = useRef(new THREE.Color("#020617"));
  const fogColorRef = useRef(new THREE.Color("#020617"));

  const { state, mouthOpen } = useAgentStore();
  const hasSpatialObject = useSpatialObjectStore((store) =>
    Boolean(store.object),
  );

  const mainLightTargetRef = useRef(new THREE.Vector3());
  const sideLightTargetRef = useRef(new THREE.Vector3());
  const accentLightTargetRef = useRef(new THREE.Vector3());

  useFrame(({ clock, scene }) => {
    const visual = STATE_VISUALS[state];
    const time = clock.getElapsedTime();
    const breathing = 0.9 + Math.sin(time * visual.pulseSpeed) * 0.1;
    const speechBlink =
      state === "speaking" ? Math.max(0, Math.sin(time * 18)) * mouthOpen : 0;
    const targetColor = new THREE.Color(visual.color);
    const targetBackground = new THREE.Color("#020617").lerp(
      targetColor,
      state === "speaking" ? 0.3 + speechBlink * 0.28 : 0.05,
    );

    backgroundColorRef.current.lerp(targetBackground, 0.08);
    fogColorRef.current.copy(backgroundColorRef.current);
    scene.background = backgroundColorRef.current;

    // Light positioning while inspecting or ready
    const isInspectingObject = state === "inspecting" || state === "ready";
    const shouldReduceFog = isInspectingObject && hasSpatialObject;

    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(fogColorRef.current);
      scene.fog.near = THREE.MathUtils.lerp(
        scene.fog.near,
        shouldReduceFog ? OBJECT_FOCUS_FOG_NEAR : DEFAULT_FOG_NEAR,
        0.08,
      );
      scene.fog.far = THREE.MathUtils.lerp(
        scene.fog.far,
        shouldReduceFog ? OBJECT_FOCUS_FOG_FAR : DEFAULT_FOG_FAR,
        0.08,
      );
    }

    mainLightTargetRef.current.set(
      0,
      isInspectingObject ? 0.7 : 1.3,
      isInspectingObject ? 1.2 : 2.4,
    );

    sideLightTargetRef.current.set(
      isInspectingObject ? -1.2 : -2.5,
      isInspectingObject ? -0.2 : 0.4,
      isInspectingObject ? 0.8 : 1.5,
    );

    accentLightTargetRef.current.set(
      isInspectingObject ? 1.2 : 2.5,
      isInspectingObject ? -0.1 : 0.5,
      isInspectingObject ? 0.8 : 1.2,
    );

    if (mainLightRef.current) {
      mainLightRef.current.position.lerp(mainLightTargetRef.current, 0.08);
      mainLightRef.current.color.lerp(targetColor, 0.08);
      mainLightRef.current.intensity = THREE.MathUtils.lerp(
        mainLightRef.current.intensity,
        visual.lightIntensity * breathing + speechBlink * 4,
        0.12,
      );
    }

    if (sideLightRef.current) {
      sideLightRef.current.position.lerp(sideLightTargetRef.current, 0.08);
      sideLightRef.current.intensity = THREE.MathUtils.lerp(
        sideLightRef.current.intensity,
        state === "speaking" ? 0.8 + speechBlink * 2 : 1.4,
        0.08,
      );
    }

    if (accentLightRef.current) {
      accentLightRef.current.position.lerp(accentLightTargetRef.current, 0.08);
      accentLightRef.current.color.lerp(targetColor, 0.06);
      accentLightRef.current.intensity = THREE.MathUtils.lerp(
        accentLightRef.current.intensity,
        state === "thinking" ? 2.2 : 1.2 + speechBlink * 2,
        0.08,
      );
    }
  });

  return (
    <>
      <color attach="background" args={["#020617"]} />
      <fog attach="fog" args={["#020617", DEFAULT_FOG_NEAR, DEFAULT_FOG_FAR]} />

      <ambientLight intensity={0.2} />

      <pointLight
        ref={mainLightRef}
        position={[0, 1.3, 2.4]}
        intensity={2.2}
        color="#4f63c6"
      />

      <pointLight
        ref={sideLightRef}
        position={[-2.5, 0.4, 1.5]}
        intensity={1.4}
        color="#fa15ae"
      />

      <pointLight
        ref={accentLightRef}
        position={[2.5, 0.5, 1.2]}
        intensity={1.2}
        color="#a855f7"
      />

      <Stars radius={80} depth={40} count={1200} factor={3} fade />

      <BackPortal />
      <HologramGrid />
      <FloatingParticles />
    </>
  );
}
