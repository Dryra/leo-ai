import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { KTX2Loader, type GLTFLoader } from "three-stdlib";
import { useAgentStore, type AgentState } from "../../stores/agentStore";
import { isMorphMesh, setMorphTarget } from "./morphTargets";
import type { MorphMesh } from "./morphTargets";
import {
  FACIAL_EXPRESSION_MORPH_TARGETS,
  FACIAL_EXPRESSIONS,
  type FacialExpressionName,
} from "../../constants/Expressions";

import { createHologramMaterial } from "./createHologramMaterial";
import { AIBrain } from "./AIBrain";

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
  const faceColorRef = useRef(new THREE.Color("#38bdf8"));
  const gl = useThree((state) => state.gl);
  const initialHeadRotationRef = useRef(new THREE.Euler(0, 0, 0));

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

  //const purpleMaterial = useMemo(() => createHologramMaterial("#a803c5"), []);
  const blueMaterial = useMemo(() => createHologramMaterial("#38bdf8"), []);
  //const yellowMaterial = useMemo(() => createHologramMaterial("#facc15"), []);
  //const redMaterial = useMemo(() => createHologramMaterial("#d00819"), []);

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
        morphMeshes.push(object);
      }
    });

    return { morphMeshes, allMeshes };
  }, [scene]);

  const { state, isSpeaking, mouthOpen } = useAgentStore();

  useEffect(() => {
    allMeshes.forEach((mesh) => {
      switch (mesh.name) {
        case "mesh_0":
          mesh.material = blueMaterial;
          break;
        case "mesh_1":
          mesh.material = blueMaterial;
          break;
        case "mesh_2":
          //mesh.material = redMaterial;
          break;
        case "mesh_3":
          //mesh.material = redMaterial;

          break;

        default:
          break;
      }

      //console.log("Morph targets:", mesh.morphTargetDictionary);
    });

    const shellMeshes = morphMeshes
      .filter((mesh) => mesh.name !== "mesh_2")
      .map((mesh) => {
        const material = createHologramMaterial("#38bdf8");
        material.depthTest = false;
        material.uniforms.uOpacity.value = 0.8;

        const shell = new THREE.Mesh(
          mesh.geometry,
          material,
        ) as unknown as HologramShellMesh;

        shell.name = `${mesh.name}_hologram_shell`;
        shell.renderOrder = 20;
        shell.scale.setScalar(1.015);
        shell.morphTargetDictionary = mesh.morphTargetDictionary;
        shell.morphTargetInfluences = [...mesh.morphTargetInfluences];
        shell.userData.sourceMesh = mesh;
        //if (mesh.name !== "mesh_2") {
        mesh.add(shell);
        //}

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
  }, [allMeshes, morphMeshes]);

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

    shellMeshesRef.current.forEach((shell) => {
      const material = shell.material as THREE.ShaderMaterial;

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

      shell.morphTargetInfluences.forEach((_, index) => {
        shell.morphTargetInfluences[index] =
          shell.userData.sourceMesh.morphTargetInfluences[index] ?? 0;
      });
    });

    const mouthMovement = isSpeaking ? mouthOpen * 0.55 : 0;

    const blink = Math.sin(time * 1.5) > 0.97 ? 1 : 0;

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
        idle: "neutral",
        lookLeft: "happy",
        lookRight: "happy",
        lookUp: "thinking",
        lookDown: "thinking",
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
          to.x = -0.22;
          to.y = THREE.MathUtils.randFloat(-0.18, 0.18);
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
      const inspectingX =
        state === "inspecting" || state === "ready" ? 0.32 : 0;

      let gestureX = 0;
      let gestureY = 0;
      let gestureZ = 0;

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
      }

      // POSITIONING
      const targetPositionY =
        state === "inspecting" || state === "ready" ? 2 : 0;

      const targetPositionZ =
        state === "inspecting" || state === "ready" ? -2 : 0;

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
        listeningNodX;

      const targetRotationY =
        initialHeadRotationRef.current.y + stateY + gestureY + idleY;

      const targetRotationZ =
        initialHeadRotationRef.current.z + stateZ + gestureZ + idleZ + speechZ;

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

      setMorphTarget(mesh, "browInnerUp", mouthMovement, 0.35);

      setMorphTarget(mesh, "eyeBlink_L", blink, 0.5);
      setMorphTarget(mesh, "eyeBlink_R", blink, 0.5);
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
