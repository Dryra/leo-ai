import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { FaceModel } from "./FaceModel";
import type { FacialExpressionName } from "../../constants/Expressions";
import { FuturisticEnvironment } from "./FuturisticEnvironment";
import { VoiceWaveform } from "./VoiceWaveform";
import { useAgentStore } from "../../stores/agentStore";
import { useCameraStore } from "../../stores/cameraStore";
import { WorkspaceRing } from "./WorkspaceRing";

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0.8, 0.8, 7);
const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, 0.8, 0);
const NON_IDLE_AZIMUTH_LIMIT = Math.PI / 2;

export function AgentScene({ facialExpression }: AgentSceneProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const freeCameraEnabled = useCameraStore((state) => state.freeCameraEnabled);
  const wasFreeCameraEnabledRef = useRef(false);
  const agentState = useAgentStore((state) => state.state);

  function FreeCameraController() {
    const camera = useThree((state) => state.camera);
    const gl = useThree((state) => state.gl);
    const freeCameraEnabled = useCameraStore(
      (state) => state.freeCameraEnabled,
    );

    const keysRef = useRef({
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false,
    });

    const yawRef = useRef(0);
    const pitchRef = useRef(0);
    const isPointerDownRef = useRef(false);

    useEffect(() => {
      if (!freeCameraEnabled) return;

      function handleKeyDown(event: KeyboardEvent) {
        switch (event.code) {
          case "KeyW":
            keysRef.current.forward = true;
            break;
          case "KeyS":
            keysRef.current.backward = true;
            break;
          case "KeyA":
            keysRef.current.left = true;
            break;
          case "KeyD":
            keysRef.current.right = true;
            break;
          case "Space":
            keysRef.current.up = true;
            break;
          case "ShiftLeft":
          case "ShiftRight":
            keysRef.current.down = true;
            break;
        }
      }

      function handleKeyUp(event: KeyboardEvent) {
        switch (event.code) {
          case "KeyW":
            keysRef.current.forward = false;
            break;
          case "KeyS":
            keysRef.current.backward = false;
            break;
          case "KeyA":
            keysRef.current.left = false;
            break;
          case "KeyD":
            keysRef.current.right = false;
            break;
          case "Space":
            keysRef.current.up = false;
            break;
          case "ShiftLeft":
          case "ShiftRight":
            keysRef.current.down = false;
            break;
        }
      }

      function handlePointerDown() {
        isPointerDownRef.current = true;
      }

      function handlePointerUp() {
        isPointerDownRef.current = false;
      }

      function handlePointerMove(event: PointerEvent) {
        if (!isPointerDownRef.current) return;

        yawRef.current -= event.movementX * 0.002;
        pitchRef.current -= event.movementY * 0.002;

        pitchRef.current = THREE.MathUtils.clamp(
          pitchRef.current,
          -Math.PI / 2.4,
          Math.PI / 2.4,
        );
      }

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      gl.domElement.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointermove", handlePointerMove);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
        gl.domElement.removeEventListener("pointerdown", handlePointerDown);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointermove", handlePointerMove);
      };
    }, [freeCameraEnabled, gl.domElement]);

    useFrame(() => {
      const controls = controlsRef.current;
      if (!controls) return;

      const shouldReturnCamera =
        wasFreeCameraEnabledRef.current !== freeCameraEnabled;

      if (freeCameraEnabled) {
        wasFreeCameraEnabledRef.current = true;
        return;
      }

      if (!shouldReturnCamera) return;

      //camera.position.lerp(INITIAL_CAMERA_POSITION, 0.08);
      //controls.target.lerp(INITIAL_CAMERA_TARGET, 0.08);
      //controls.update();

      if (camera.position.distanceTo(INITIAL_CAMERA_POSITION) < 0.02) {
        wasFreeCameraEnabledRef.current = false;
      }
    });
    useFrame((_, delta) => {
      if (!freeCameraEnabled) return;

      camera.rotation.order = "YXZ";
      camera.rotation.y = yawRef.current;
      camera.rotation.x = pitchRef.current;

      const speed = 3.5;
      const moveSpeed = speed * delta;

      const direction = new THREE.Vector3();

      if (keysRef.current.forward) direction.z -= 1;
      if (keysRef.current.backward) direction.z += 1;
      if (keysRef.current.left) direction.x -= 1;
      if (keysRef.current.right) direction.x += 1;
      if (keysRef.current.up) direction.y += 1;
      if (keysRef.current.down) direction.y -= 1;

      if (direction.lengthSq() === 0) return;

      direction.normalize();
      direction.applyEuler(camera.rotation);
      direction.multiplyScalar(moveSpeed);

      camera.position.add(direction);
    });

    return null;
  }

  return (
    <Canvas camera={{ position: INITIAL_CAMERA_POSITION.toArray(), fov: 80 }}>
      <FuturisticEnvironment />

      <group position={[0, 0, 0]}>
        <FaceModel facialExpression={facialExpression} />
        <VoiceWaveform color="#38e8ff" />
        <VoiceWaveform color="#a855f7" />
      </group>
      <WorkspaceRing position={[0, -2, -4]} />

      <OrbitControls
        ref={controlsRef}
        enableRotate={true}
        enablePan={false}
        enabled={!freeCameraEnabled}
        target={INITIAL_CAMERA_TARGET.toArray()}
        minPolarAngle={Math.PI / 2}
        maxPolarAngle={Math.PI / 2}
        minAzimuthAngle={
          agentState === "idle" ? -Infinity : -NON_IDLE_AZIMUTH_LIMIT
        }
        maxAzimuthAngle={
          agentState === "idle" ? Infinity : NON_IDLE_AZIMUTH_LIMIT
        }
        minDistance={5}
        maxDistance={6}
      />
      <FreeCameraController />
    </Canvas>
  );
}

type AgentSceneProps = {
  facialExpression: FacialExpressionName;
};
