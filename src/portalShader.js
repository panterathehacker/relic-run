export const portalVertexShader = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const portalFragmentShader = /* glsl */`
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),               hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 uv = vUv;

  // Radial soft edge for circular shape
  float dist = length(uv - 0.5);
  float edge = smoothstep(0.5, 0.40, dist);

  float n  = noise(uv * 3.0 + uTime * 0.4);
  n += 0.6 * noise(uv * 6.0 - uTime * 0.25);
  n += 0.3 * noise(uv * 12.0 + uTime * 0.6);
  n = clamp(n / 1.9, 0.0, 1.0);

  vec3 dark  = uColor * 0.15;
  vec3 bright = uColor * 1.8 + vec3(0.15);
  vec3 color = mix(dark, bright, n);

  float alpha = edge * (0.75 + n * 0.25);

  gl_FragColor = vec4(color, alpha);
}
`;
