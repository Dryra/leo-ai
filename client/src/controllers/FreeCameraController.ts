import { useFrame, useThree } from "@react-three/fiber";
import { useCameraStore } from "../stores/cameraStore";
import { useEffect, useRef } from "react";
import { MathUtils, Vector3 } from "three";

export function FreeCameraController() {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const freeCameraEnabled = useCameraStore((state) => state.freeCameraEnabled);

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

      pitchRef.current = MathUtils.clamp(
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

  useFrame((_, delta) => {
    if (!freeCameraEnabled) return;

    camera.rotation.order = "YXZ";
    camera.rotation.y = yawRef.current;
    camera.rotation.x = pitchRef.current;

    const speed = 3.5;
    const moveSpeed = speed * delta;

    const direction = new Vector3();

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
