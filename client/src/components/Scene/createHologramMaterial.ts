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
      uRevealProgress: { value: 0 },
      uGlobalOpacity: { value: 1 },
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
      uniform float uRevealProgress;
      uniform float uGlobalOpacity;

      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        float revealLine = mix(-2.2, 2.2, uRevealProgress);
        float revealMask = smoothstep(revealLine - 0.22, revealLine + 0.08, vWorldPosition.y);
        float revealEdge = 1.0 - smoothstep(0.0, 0.16, abs(vWorldPosition.y - revealLine));

        if (uRevealProgress < 0.98 && revealMask < 0.03) {
          discard;
        }

        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

        float fresnel = pow(1.0 - max(dot(viewDirection, normalize(vNormal)), 0.0), uFresnelPower);

        float scanline = sin((vWorldPosition.y * 45.0) + (uTime * 5.0));
        scanline = smoothstep(0.2, 1.0, scanline) * uScanlineStrength;

        float pulse = 0.85 + sin(uTime * 2.0) * 0.15;

        float alpha = uOpacity + fresnel * 0.45 + scanline + revealEdge * 0.35;
        alpha = clamp(alpha, 0.05, 0.75);

        alpha *= uGlobalOpacity;

        vec3 color = uColor * (uGlowStrength * fresnel + pulse + scanline + revealEdge * 3.0) * uGlobalOpacity;

        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}
