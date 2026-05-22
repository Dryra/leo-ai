import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { KTX2Loader, type GLTFLoader } from "three-stdlib";
import {
  useAgentStore,
  type AgentAttentionTarget,
  type AgentState,
} from "../../stores/agentStore";
import { isMorphMesh, setMorphTarget } from "./morphTargets";
import type { MorphMesh } from "./morphTargets";
import {
  FACIAL_EXPRESSION_MORPH_TARGETS,
  FACIAL_EXPRESSIONS,
  type FacialExpressionName,
} from "../../constants/Expressions";

import { createHologramMaterial } from "./createHologramMaterial";
import { AIBrain } from "./AIBrain";
import { useNeuroVoiceStore } from "../../stores/neuroVoiceStore";

const ATTENTION_ROTATIONS: Record<
  AgentAttentionTarget,
  { x: number; y: number; z: number }
> = {
  none: { x: 0, y: 0, z: 0 },

  // If chat window is on screen-right, avatar's left is usually positive y or negative y
  // depending on your model orientation. Try one, flip if needed.
  chatInput: { x: 0.08, y: 0.42, z: 0.06 },
  sendButton: { x: 0.1, y: 0.48, z: 0.04 },
  voiceButton: { x: 0.16, y: 0.45, z: 0.08 },
  chatPanel: { x: 0.08, y: 0.38, z: 0.04 },

  spatialObject: { x: 0.2, y: -0.35, z: -0.03 },
};

type FaceModelProps = {
  facialExpression: FacialExpressionName;
};

type HologramShellMesh = THREE.Mesh & {
  morphTargetDictionary: Record<string, number>;
  morphTargetInfluences: number[];
  userData: {
    sourceMesh: MorphMesh;
  };
};

type HeadBehavior =
  | "idle"
  | "lookLeft"
  | "lookRight"
  | "lookUp"
  | "lookDown"
  | "curiousTilt"
  | "scanRoom"
  | "spin360";

type HeadMotionState = {
  behavior: HeadBehavior;
  expression: FacialExpressionName;
  startedAt: number;
  duration: number;
  from: THREE.Euler;
  to: THREE.Euler;
};

const FACE_STATE_VISUALS: Record<
  AgentState,
  {
    color: string;
    opacity: number;
    glow: number;
    scanline: number;
  }
> = {
  idle: {
    color: "#38bdf8",
    opacity: 0.55,
    glow: 1.8,
    scanline: 0.18,
  },
  listening: {
    color: "#60a5fa",
    opacity: 0.68,
    glow: 2.1,
    scanline: 0.2,
  },
  thinking: {
    color: "#a855f7",
    opacity: 0.75,
    glow: 2.6,
    scanline: 0.28,
  },
  speaking: {
    color: "#22d3ee",
    opacity: 0.82,
    glow: 3.1,
    scanline: 0.35,
  },
  ready: {
    color: "#13cb0d",
    opacity: 0.82,
    glow: 3.1,
    scanline: 0.35,
  },
  inspecting: {
    color: "#dda40a",
    opacity: 0.82,
    glow: 3.1,
    scanline: 0.35,
  },
};

export function FaceModel({ facialExpression }: FaceModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const shellMeshesRef = useRef<HologramShellMesh[]>([]);
  const neuroWireframeRef = useRef<THREE.Mesh | null>(null);
  const faceColorRef = useRef(new THREE.Color("#38bdf8"));
  const revealStartedAtRef = useRef<number | null>(null);
  const gl = useThree((state) => state.gl);
  const initialHeadRotationRef = useRef(new THREE.Euler(0, 0, 0));

  const neuroModeEnabled = useNeuroVoiceStore((state) => state.enabled);

  const headMotionRef = useRef<HeadMotionState>({
    behavior: "idle",
    expression: "neutral",
    startedAt: 0,
    duration: 1,
    from: new THREE.Euler(),
    to: new THREE.Euler(),
  });

  const nextHeadMotionAtRef = useRef(2);

  const extendLoader = useMemo(() => {
    const ktx2Loader = new KTX2Loader()
      .setTranscoderPath("/basis/")
      .detectSupport(gl);

    return (loader: GLTFLoader) => {
      loader.setKTX2Loader(ktx2Loader);
    };
  }, [gl]);

  const { scene } = useGLTF("/models/facecap.glb", true, true, extendLoader);

  // Currently just used for the eyes
  const blueMaterial = useMemo(() => createHologramMaterial("#38bdf8"), []);

  const winkStartedAtRef = useRef<number | null>(null);

  const { allMeshes, morphMeshes } = useMemo(() => {
    const morphMeshes: MorphMesh[] = [];
    const allMeshes: THREE.Mesh[] = [];
    const teeth = scene.getObjectByName("teeth");
    teeth?.remove();
    scene.traverse((object) => {
      if ((object as THREE.Object3D).isObject3D) {
      }
      if ((object as THREE.Mesh).isMesh) {
        allMeshes.push(object as THREE.Mesh);
      }
      if (isMorphMesh(object)) {
        console.log("morph mesh", object);
        morphMeshes.push(object);
      }
    });

    return { morphMeshes, allMeshes };
  }, [scene]);

  // Neuro Mode useEffect, move to upper?
  useEffect(() => {
    const headMesh = scene.getObjectByName("mesh_2") as THREE.Mesh | undefined;
    if (!headMesh || !headMesh.geometry) return;

    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: "#38e8ff",
      wireframe: true,
      transparent: true,
      opacity: 0.05,
      depthTest: true,
    });

    const wireframeHead = new THREE.Mesh(headMesh.geometry, wireframeMaterial);
    wireframeHead.name = "neuro_wireframe_head";
    wireframeHead.scale.setScalar(1.01);
    wireframeHead.renderOrder = 30;
    wireframeHead.visible = neuroModeEnabled;

    headMesh.add(wireframeHead);
    neuroWireframeRef.current = wireframeHead;
    wireframeHead.morphTargetDictionary = headMesh.morphTargetDictionary;
    wireframeHead.morphTargetInfluences = headMesh.morphTargetInfluences;

    return () => {
      headMesh.remove(wireframeHead);
      wireframeMaterial.dispose();
      neuroWireframeRef.current = null;
    };
  }, [scene]);

  useEffect(() => {
    if (!neuroWireframeRef.current) return;

    neuroWireframeRef.current.visible = neuroModeEnabled;
  }, [neuroModeEnabled]);

  const {
    state,
    isSpeaking,
    mouthOpen,
    gesture,
    clearGesture,
    attentionTarget,
  } = useAgentStore();

  useEffect(() => {
    allMeshes.forEach((mesh) => {
      switch (mesh.name) {
        case "mesh_0":
          mesh.material = blueMaterial;
          break;
        case "mesh_1":
          mesh.material = blueMaterial;
          break;
        default:
          break;
      }

      //console.log("Morph targets:", mesh.morphTargetDictionary);
    });

    const shellMeshes = morphMeshes
      .filter((mesh) => mesh.name !== "mesh_0" && mesh.name !== "mesh_1")
      .map((mesh) => {
        const material = createHologramMaterial("#38bdf8");
        material.depthTest = false;
        material.uniforms.uOpacity.value = 0.55;

        const shell = new THREE.Mesh(
          mesh.geometry,
          material,
        ) as unknown as HologramShellMesh;

        shell.name = `${mesh.name}_hologram_shell`;
        shell.renderOrder = 20;
        shell.scale.setScalar(1.012);
        shell.morphTargetDictionary = mesh.morphTargetDictionary;
        shell.morphTargetInfluences = [...mesh.morphTargetInfluences];
        shell.userData.sourceMesh = mesh;

        mesh.add(shell);

        return shell;
      });

    shellMeshesRef.current = shellMeshes;

    return () => {
      shellMeshes.forEach((shell) => {
        shell.parent?.remove(shell);
        (shell.material as THREE.Material).dispose();
      });

      shellMeshesRef.current = [];
    };
  }, [allMeshes, blueMaterial, morphMeshes]);

  const applyFacialExpression = (
    expressionName: FacialExpressionName,
    speed = 0.1,
  ) => {
    const expression = FACIAL_EXPRESSIONS[expressionName];

    scene.traverse((child) => {
      if (!("morphTargetDictionary" in child)) return;
      if (!("morphTargetInfluences" in child)) return;

      const mesh = child as THREE.Mesh & {
        morphTargetDictionary: Record<string, number>;
        morphTargetInfluences: number[];
      };

      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) {
        return;
      }

      FACIAL_EXPRESSION_MORPH_TARGETS.forEach((targetName) => {
        const index = mesh.morphTargetDictionary[targetName];
        if (index === undefined) return;

        const targetValue = expression[targetName] ?? 0;

        mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(
          mesh.morphTargetInfluences[index],
          targetValue,
          speed,
        );
      });
    });
  };

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (revealStartedAtRef.current === null) {
      revealStartedAtRef.current = time;
    }

    const revealElapsed = time - revealStartedAtRef.current;
    const revealProgress = THREE.MathUtils.smoothstep(revealElapsed, 0.15, 2.2);
    const shellFadeOut = 1 - THREE.MathUtils.smoothstep(revealElapsed, 2.0, 2.9);
    const faceVisual = FACE_STATE_VISUALS[state];
    const faceTargetColor = new THREE.Color(faceVisual.color);
    const speechBlink = state === "speaking" ? mouthOpen * 0.45 : 0;

    faceColorRef.current.lerp(faceTargetColor, 0.08);
    blueMaterial.uniforms.uTime.value = time;
    blueMaterial.uniforms.uColor.value.copy(faceColorRef.current);
    blueMaterial.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      blueMaterial.uniforms.uOpacity.value,
      faceVisual.opacity * 0.55 + speechBlink,
      0.08,
    );
    blueMaterial.uniforms.uGlowStrength.value = THREE.MathUtils.lerp(
      blueMaterial.uniforms.uGlowStrength.value,
      faceVisual.glow + speechBlink * 2,
      0.08,
    );
    blueMaterial.uniforms.uScanlineStrength.value = THREE.MathUtils.lerp(
      blueMaterial.uniforms.uScanlineStrength.value,
      faceVisual.scanline,
      0.08,
    );
    blueMaterial.uniforms.uRevealProgress.value = revealProgress;
    blueMaterial.uniforms.uGlobalOpacity.value = 1;

    shellMeshesRef.current.forEach((shell) => {
      const material = shell.material as THREE.ShaderMaterial;
      const isRevealComplete = shellFadeOut <= 0.01;

      shell.visible = !isRevealComplete;

      if (isRevealComplete) return;

      material.uniforms.uTime.value = time;
      material.uniforms.uColor.value.copy(faceColorRef.current);
      material.uniforms.uOpacity.value = THREE.MathUtils.lerp(
        material.uniforms.uOpacity.value,
        faceVisual.opacity + speechBlink,
        0.08,
      );
      material.uniforms.uGlowStrength.value = THREE.MathUtils.lerp(
        material.uniforms.uGlowStrength.value,
        faceVisual.glow + speechBlink * 2,
        0.08,
      );
      material.uniforms.uScanlineStrength.value = THREE.MathUtils.lerp(
        material.uniforms.uScanlineStrength.value,
        faceVisual.scanline,
        0.08,
      );
      material.uniforms.uRevealProgress.value = revealProgress;
      material.uniforms.uGlobalOpacity.value = shellFadeOut;

      shell.morphTargetInfluences.forEach((_, index) => {
        shell.morphTargetInfluences[index] =
          shell.userData.sourceMesh.morphTargetInfluences[index] ?? 0;
      });
    });

    const mouthMovement = isSpeaking ? mouthOpen * 0.55 : 0;

    const blink = Math.sin(time * 1.5) > 0.97 ? 1 : 0;

    if (gesture === "wink" && winkStartedAtRef.current === null) {
      winkStartedAtRef.current = time;
    }

    let winkAmount = 0;
    let winkTiltZ = 0;
    let winkForwardX = 0;

    if (winkStartedAtRef.current !== null) {
      const winkTime = time - winkStartedAtRef.current;
      const duration = 1.1;
      const progress = THREE.MathUtils.clamp(winkTime / duration, 0, 1);

      // Opens and closes smoothly.
      winkAmount = Math.sin(progress * Math.PI);

      // Head tilts slightly and nods forward.
      winkTiltZ = winkAmount * -0.18;
      winkForwardX = winkAmount * 0.1;

      if (progress >= 1) {
        winkStartedAtRef.current = null;
        clearGesture();
      }
    }

    const pickHeadBehavior = (time: number, isSpeakingNow: boolean) => {
      if (!groupRef.current) return;

      const current = groupRef.current.rotation;
      const from = new THREE.Euler(current.x, current.y, current.z);
      const to = new THREE.Euler(0, 0, 0);

      const normalBehaviors: HeadBehavior[] = [
        "idle",
        "lookLeft",
        "lookRight",
        "lookUp",
        "lookDown",
        "curiousTilt",
        "scanRoom",
      ];

      const canDoBigMove = !isSpeakingNow && Math.random() < 0.08;
      const behavior = canDoBigMove
        ? "spin360"
        : normalBehaviors[Math.floor(Math.random() * normalBehaviors.length)];

      const expressionByBehavior: Record<HeadBehavior, FacialExpressionName> = {
        idle: "happy",
        lookLeft: "happy",
        lookRight: "happy",
        lookUp: "thinking",
        lookDown: "happy",
        curiousTilt: "happy",
        scanRoom: "happy",
        spin360: "happy",
      };

      const expression = expressionByBehavior[behavior];

      let duration = THREE.MathUtils.randFloat(1.2, 2.8);

      switch (behavior) {
        case "lookLeft":
          to.y = 0.45;
          to.x = THREE.MathUtils.randFloat(-0.08, 0.08);
          break;

        case "lookRight":
          to.y = -0.45;
          to.x = THREE.MathUtils.randFloat(-0.08, 0.08);
          break;

        case "lookUp":
          to.x = THREE.MathUtils.randFloat(-0.24, -0.16);
          to.y = THREE.MathUtils.randFloat(-0.28, 0.28);
          to.z = Math.random() > 0.5 ? 0.16 : -0.16;
          duration = THREE.MathUtils.randFloat(2.6, 4.2);
          break;

        case "lookDown":
          to.x = 0.2;
          to.y = THREE.MathUtils.randFloat(-0.14, 0.14);
          break;

        case "curiousTilt":
          to.z = Math.random() > 0.5 ? 0.22 : -0.22;
          to.y = THREE.MathUtils.randFloat(-0.22, 0.22);
          to.x = THREE.MathUtils.randFloat(-0.08, 0.08);
          break;

        case "scanRoom":
          to.y = Math.random() > 0.5 ? 0.6 : -0.6;
          duration = THREE.MathUtils.randFloat(2.4, 3.6);
          break;

        case "spin360":
          to.y = current.y + Math.PI * 2;
          to.x = 0;
          to.z = 0;
          duration = THREE.MathUtils.randFloat(3.5, 5);
          break;

        case "idle":
        default:
          to.x = THREE.MathUtils.randFloat(-0.04, 0.04);
          to.y = THREE.MathUtils.randFloat(-0.08, 0.08);
          to.z = THREE.MathUtils.randFloat(-0.04, 0.04);
          break;
      }

      headMotionRef.current = {
        behavior,
        expression,
        startedAt: time,
        duration,
        from,
        to,
      };
    };

    // Head movement in general
    // Head movement animation when talking
    if (groupRef.current) {
      const canUseGeneralHeadMotion = state === "idle";

      if (canUseGeneralHeadMotion && time > nextHeadMotionAtRef.current) {
        pickHeadBehavior(time, isSpeaking);
        nextHeadMotionAtRef.current = time + THREE.MathUtils.randFloat(3, 8);
      }

      // IDLE
      const idleX = Math.sin(time * 1.2) * 0.025;
      const idleY = Math.sin(time * 0.8) * 0.035;
      const idleZ = Math.sin(time * 1.5) * 0.018;

      // SPEAKING
      const speechX = mouthMovement * 0.08;
      const speechZ = Math.sin(time * 10) * mouthMovement * 0.04;
      const listeningNodX =
        state === "listening" ? Math.sin(time * 4.2) * 0.07 : 0;
      const stateX = state === "thinking" ? -0.18 : 0;
      const stateY = state === "thinking" ? 0.06 : 0;
      const stateZ = state === "listening" ? 0.12 : 0;

      // INSPECTING
      const isInspectingObject = state === "inspecting" || state === "ready";
      const inspectingIntensity =
        state === "inspecting" ? 1 : state === "ready" ? 0.45 : 0;
      const inspectingSweep = Math.sin(time * 0.85) * inspectingIntensity;
      const inspectingFocusPulse =
        Math.sin(time * 1.7 + 0.6) * inspectingIntensity;
      const inspectingX = isInspectingObject
        ? 0.34 + inspectingFocusPulse * 0.045
        : 0;
      const inspectingY = inspectingSweep * 0.38;
      const inspectingZ =
        isInspectingObject
          ? -0.08 + Math.sin(time * 1.05) * 0.09 * inspectingIntensity
          : 0;

      let gestureX = 0;
      let gestureY = 0;
      let gestureZ = 0;

      const attentionRotation = ATTENTION_ROTATIONS[attentionTarget];

      const attentionX = attentionRotation.x;
      const attentionY = attentionRotation.y;
      const attentionZ = attentionRotation.z;

      if (canUseGeneralHeadMotion) {
        const motion = headMotionRef.current;
        const progress = THREE.MathUtils.clamp(
          (time - motion.startedAt) / motion.duration,
          0,
          1,
        );

        const eased = 1 - Math.pow(1 - progress, 3);

        gestureX = THREE.MathUtils.lerp(motion.from.x, motion.to.x, eased);
        gestureY = THREE.MathUtils.lerp(motion.from.y, motion.to.y, eased);
        gestureZ = THREE.MathUtils.lerp(motion.from.z, motion.to.z, eased);

        if (motion.behavior === "lookUp") {
          const ponderAmount = Math.sin(progress * Math.PI);

          gestureX += Math.sin(time * 1.4) * 0.018 * ponderAmount;
          gestureY += Math.sin(time * 1.7) * 0.032 * ponderAmount;
          gestureZ += Math.sin(time * 1.2) * 0.024 * ponderAmount;
        }
      }

      // POSITIONING
      const targetPositionX = isInspectingObject
        ? inspectingSweep * 0.28
        : 0;

      const targetPositionY = isInspectingObject ? 1.85 : 0;

      const targetPositionZ = isInspectingObject
        ? -2.2 + inspectingFocusPulse * 0.16
        : 0;

      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        targetPositionX,
        0.08,
      );

      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        targetPositionY,
        0.08,
      );

      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        targetPositionZ,
        0.08,
      );

      // ROTATION
      const targetRotationX =
        initialHeadRotationRef.current.x +
        stateX +
        inspectingX +
        gestureX +
        idleX +
        speechX +
        listeningNodX +
        winkForwardX +
        attentionX;

      const targetRotationY =
        initialHeadRotationRef.current.y +
        stateY +
        inspectingY +
        gestureY +
        idleY +
        attentionY;

      const targetRotationZ =
        initialHeadRotationRef.current.z +
        stateZ +
        inspectingZ +
        gestureZ +
        idleZ +
        speechZ +
        winkTiltZ +
        attentionZ;

      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        targetRotationX,
        0.08,
      );

      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotationY,
        0.08,
      );

      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        targetRotationZ,
        0.08,
      );
    }

    const motion = headMotionRef.current;
    const motionProgress = THREE.MathUtils.clamp(
      (time - motion.startedAt) / motion.duration,
      0,
      1,
    );

    const isRandomExpressionActive = state === "idle" && motionProgress < 1;

    const activeFacialExpression = isRandomExpressionActive
      ? motion.expression
      : facialExpression;

    applyFacialExpression(activeFacialExpression);

    morphMeshes.forEach((mesh) => {
      setMorphTarget(mesh, "jawOpen", mouthMovement, 0.35);
      setMorphTarget(
        mesh,
        "mouthClose",
        isSpeaking ? Math.max(0, 0.15 - mouthMovement * 0.1) : 0,
        0.2,
      );

      setMorphTarget(mesh, "eyeBlink_L", Math.max(blink, winkAmount), 0.5);
      setMorphTarget(mesh, "eyeBlink_R", blink, 0.5);

      setMorphTarget(mesh, "mouthSmile_L", winkAmount * 0.55, 0.25);
      setMorphTarget(mesh, "mouthSmile_R", winkAmount * 0.75, 0.25);
      setMorphTarget(mesh, "cheekSquint_L", winkAmount * 0.35, 0.25);
      setMorphTarget(mesh, "cheekSquint_R", winkAmount * 0.25, 0.25);

      setMorphTarget(mesh, "browInnerUp", mouthMovement, 0.35);
    });
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={2.2}>
      {/* ORIGINAL FACE */}
      <primitive object={scene}>
        <group position={[0, 0.8, 0]} scale={0.1}>
          <AIBrain />
        </group>
      </primitive>
    </group>
  );
}
