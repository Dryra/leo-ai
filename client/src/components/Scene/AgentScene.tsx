import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { FaceModel } from "./FaceModel";
import type { FacialExpressionName } from "../../constants/Expressions";
import { FuturisticEnvironment } from "./FuturisticEnvironment";
import { VoiceWaveform } from "./VoiceWaveform";

export function AgentScene({ facialExpression }: AgentSceneProps) {
  return (
    <Canvas camera={{ position: [0.8, 0.8, 7], fov: 80 }}>
      <FuturisticEnvironment />

      <group position={[0, 0, 0]}>
        <FaceModel facialExpression={facialExpression} />
        <VoiceWaveform color="#38e8ff" />
        <VoiceWaveform color="#a855f7" />
      </group>

      <OrbitControls
        enableRotate={true}
        enablePan={false}
        minPolarAngle={Math.PI / 2}
        maxPolarAngle={Math.PI / 2}
        minDistance={5}
        maxDistance={6}
      />
    </Canvas>
  );
}

type AgentSceneProps = {
  facialExpression: FacialExpressionName;
};
