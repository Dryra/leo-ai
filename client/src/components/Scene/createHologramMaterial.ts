import * as THREE from "three";

export function createHologramMaterial(color = "#a803c5") {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    //side: THREE.DoubleSide,

    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.28 },
      uColor: { value: new THREE.Color(color) },
      uFresnelPower: { value: 2.2 },
      uScanlineStrength: { value: 0.18 },
      uGlowStrength: { value: 1.8 },
    },

    vertexShader: `
      #include <common>
      #include <morphtarget_pars_vertex>

      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        vUv = uv;

        #include <beginnormal_vertex>
        #include <morphnormal_vertex>

        vec3 transformed = vec3(position);
        #include <morphtarget_vertex>

        vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
        vWorldPosition = worldPosition.xyz;

        vNormal = normalize(mat3(modelMatrix) * objectNormal);

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,

    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform float uFresnelPower;
      uniform float uScanlineStrength;
      uniform float uGlowStrength;

      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

        float fresnel = pow(1.0 - max(dot(viewDirection, normalize(vNormal)), 0.0), uFresnelPower);

        float scanline = sin((vWorldPosition.y * 45.0) + (uTime * 5.0));
        scanline = smoothstep(0.2, 1.0, scanline) * uScanlineStrength;

        float pulse = 0.85 + sin(uTime * 2.0) * 0.15;

        float alpha = uOpacity + fresnel * 0.45 + scanline;
        alpha = clamp(alpha, 0.05, 0.75);

        vec3 color = uColor * (uGlowStrength * fresnel + pulse + scanline);

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}
