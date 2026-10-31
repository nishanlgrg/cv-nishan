// Frost transition: a travelling, noise-shaped boundary that smears the image,
// adds frost and a narrow band of colour separation. At strength 0 it is an exact
// pass-through, so the scene is clean whenever the camera is holding on a section.
import { Vector2 } from 'three';

export const FrostShader = {
    uniforms: {
        tDiffuse: { value: null },
        uProgress: { value: 0 },
        uStrength: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uPx: { value: new Vector2(1 / 1920, 1 / 1080) },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uProgress;
        uniform float uStrength;
        uniform float uTime;
        uniform float uAspect;
        uniform vec2 uPx;
        varying vec2 vUv;

        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }
        float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
            return v;
        }
        vec3 tap(vec2 uv) { return texture2D(tDiffuse, clamp(uv, uPx, 1.0 - uPx)).rgb; }

        void main() {
            if (uStrength < 0.001) {
                gl_FragColor = texture2D(tDiffuse, vUv);
                return;
            }
            vec2 p = vec2(vUv.x * uAspect, vUv.y) * 3.0;
            float n = fbm(p + uTime * 0.015);

            // Diagonal sweep with an irregular frost edge. Remapped so progress 0 and 1
            // place the boundary fully off-screen.
            float field = dot(vUv, normalize(vec2(1.0, 0.45))) / 1.1 + 0.2 * (n - 0.5);
            float boundary = mix(-0.3, 1.3, uProgress);
            float band = 1.0 - smoothstep(0.0, 0.24, abs(field - boundary));

            // Distortion follows the frost noise gradient, concentrated in the band.
            float e = 0.02;
            vec2 grad = vec2(fbm(p + vec2(e, 0.0)) - n, fbm(p + vec2(0.0, e)) - n);
            vec2 dir = normalize(grad + 1e-5);
            float s = uStrength;
            vec2 off = dir * band * s * 0.04;
            vec2 ca = dir * (band * s * 10.0 + 0.6 * s) * uPx.x;

            vec3 col;
            col.r = tap(vUv + off + ca).r;
            col.g = tap(vUv + off).g;
            col.b = tap(vUv + off - ca).b;

            // Frost: soft haze at the edge plus sharper crystalline streaks.
            float streak = 1.0 - smoothstep(0.0, 0.05, abs(noise(p * 4.0 + n * 2.0) - 0.5));
            float mid = 1.0 - abs(uProgress * 2.0 - 1.0);
            float frost = s * (0.6 * band * (0.5 + 0.5 * n) + 0.22 * mid * n) + streak * band * s * 0.2;
            col = mix(col, vec3(0.72, 0.78, 0.84), clamp(frost, 0.0, 0.85));

            gl_FragColor = vec4(col, 1.0);
        }
    `,
};
