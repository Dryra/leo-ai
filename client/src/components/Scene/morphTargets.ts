import * as THREE from "three";

export type MorphMesh = THREE.Mesh & {
  morphTargetDictionary: Record<string, number>;
  morphTargetInfluences: number[];
};

export function isMorphMesh(object: THREE.Object3D): object is MorphMesh {
  const mesh = object as MorphMesh;

  return (
    mesh.isMesh === true &&
    !!mesh.morphTargetDictionary &&
    !!mesh.morphTargetInfluences
  );
}

export function setMorphTarget(
  mesh: MorphMesh,
  name: string,
  value: number,
  speed = 0.15,
) {
  const index = mesh.morphTargetDictionary[name];

  if (index === undefined) return;

  mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(
    mesh.morphTargetInfluences[index] ?? 0,
    value,
    speed,
  );
}
