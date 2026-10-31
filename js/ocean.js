// The iceberg world: moving cloud sky, sea surface (seen from above and below),
// a faceted iceberg whose small tip sits above the water and whose huge mass runs
// down to y ≈ -62, light rays from the surface, and rising particles underwater.
// Water level is y = 0.
import * as THREE from 'three';
import { makeNoise } from './ice.js';

export const SKY = {
    zenith: new THREE.Color(0.16, 0.3, 0.48),
    horizon: new THREE.Color(0.64, 0.72, 0.8),
    shallow: new THREE.Color(0.06, 0.32, 0.42),
    deep: new THREE.Color(0.006, 0.03, 0.06),
};
export const SUN_DIR = new THREE.Vector3(-0.45, 0.62, -0.64).normalize();

const NOISE_GLSL = /* glsl */`
    float oHash(vec2 p) { p = fract(p * vec2(234.34, 435.35)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
    float oNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(oHash(i), oHash(i + vec2(1.0, 0.0)), f.x), mix(oHash(i + vec2(0.0, 1.0)), oHash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float oFbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * oNoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
        return v;
    }
`;

/* ------------------------------------------------------------------ Sky */

function createSky() {
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
            uTime: { value: 0 },
            uZenith: { value: SKY.zenith },
            uHorizon: { value: SKY.horizon },
            uSun: { value: SUN_DIR },
            uFade: { value: 1 },
            uFadeColor: { value: SKY.horizon.clone() },
        },
        vertexShader: /* glsl */`
            varying vec3 vDir;
            void main() {
                vDir = normalize(position);
                vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                gl_Position = p.xyww;
            }
        `,
        fragmentShader: /* glsl */`
            uniform float uTime, uFade;
            uniform vec3 uZenith, uHorizon, uSun, uFadeColor;
            varying vec3 vDir;
            ${NOISE_GLSL}
            void main() {
                vec3 d = normalize(vDir);
                float y = max(d.y, 0.0);
                vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, y));
                // Clouds on a flat layer above the sea, drifting and curling over time.
                vec2 p = d.xz / max(d.y, 0.06) * 0.9;
                vec2 q = vec2(oFbm(p * 0.6 + vec2(uTime * 0.012, 0.0)), oFbm(p * 0.6 + vec2(4.1, 2.7) - vec2(0.0, uTime * 0.01)));
                float c = oFbm(p * 0.9 + 1.6 * q + vec2(uTime * 0.02, uTime * 0.006));
                float wisp = oFbm(p * 2.4 + 2.0 * q - vec2(uTime * 0.035, 0.0));
                float density = smoothstep(0.42, 0.78, 0.72 * c + 0.28 * wisp) * smoothstep(0.02, 0.22, y);
                float lit = clamp(0.55 + (wisp - 0.5) * 1.4 + dot(d, uSun) * 0.3, 0.0, 1.0);
                vec3 cloud = mix(vec3(0.42, 0.47, 0.54), vec3(1.0, 0.98, 0.95), lit);
                col = mix(col, cloud, density * 0.92);
                // Sun glow.
                float s = max(dot(d, uSun), 0.0);
                col += vec3(1.0, 0.92, 0.8) * (pow(s, 600.0) * 6.0 + pow(s, 12.0) * 0.25) * (1.0 - density * 0.7);
                gl_FragColor = vec4(mix(uFadeColor, col, uFade), 1.0);
            }
        `,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(350, 48, 24), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    return { mesh, uniforms: mat.uniforms };
}

/* ------------------------------------------------------------------ Water surface */

function createWater() {
    const geo = new THREE.PlaneGeometry(700, 700, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        fog: true,
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.fog,
            {
                uTime: { value: 0 },
                uSun: { value: SUN_DIR },
                uZenith: { value: SKY.zenith },
                uHorizon: { value: SKY.horizon },
                uShallow: { value: SKY.shallow },
                uDeepTint: { value: new THREE.Color(0.02, 0.12, 0.18) },
            },
        ]),
        vertexShader: /* glsl */`
            #include <fog_pars_vertex>
            varying vec3 vW;
            void main() {
                vec4 w = modelMatrix * vec4(position, 1.0);
                vW = w.xyz;
                vec4 mvPosition = viewMatrix * w;
                gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
            }
        `,
        fragmentShader: /* glsl */`
            #include <fog_pars_fragment>
            uniform float uTime;
            uniform vec3 uSun, uZenith, uHorizon, uShallow, uDeepTint;
            varying vec3 vW;
            ${NOISE_GLSL}
            float waves(vec2 p) {
                float h = oFbm(p * 0.18 + vec2(uTime * 0.05, uTime * 0.03));
                h += 0.5 * oFbm(p * 0.6 - vec2(uTime * 0.09, -uTime * 0.04));
                h += 0.25 * sin(p.x * 0.7 + uTime * 0.9) * sin(p.y * 0.5 - uTime * 0.6);
                return h;
            }
            void main() {
                vec2 p = vW.xz;
                float e = 0.15;
                float h = waves(p);
                vec3 n = normalize(vec3(h - waves(p + vec2(e, 0.0)), e * 2.2, h - waves(p + vec2(0.0, e))));
                vec3 V = normalize(cameraPosition - vW);
                vec3 col;
                float alpha = 1.0;
                if (cameraPosition.y >= 0.0) {
                    // From above: sky reflection by fresnel, sun glints, see-through near the berg.
                    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
                    vec3 r = reflect(-V, n);
                    vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.5, r.y));
                    col = mix(uDeepTint, sky, fres);
                    col += vec3(1.0, 0.93, 0.82) * pow(max(dot(r, uSun), 0.0), 320.0) * 3.0;
                    alpha = mix(0.84, 1.0, fres);
                } else {
                    // From below: Snell's window of bright sky, rippled; darker teal outside.
                    vec3 look = -V;
                    float cosT = look.y;
                    float window = smoothstep(0.58, 0.78, cosT + (h - 0.6) * 0.08);
                    float caust = pow(1.0 - abs(oNoise(p * 0.9 + n.xz * 3.0 + uTime * 0.2) - 0.5) * 2.0, 6.0);
                    vec3 bright = vec3(0.7, 0.88, 0.94) * (0.85 + 0.4 * caust);
                    col = mix(uShallow * 0.8, bright, window);
                }
                gl_FragColor = vec4(col, alpha);
                #include <fog_fragment>
            }
        `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1;
    return { mesh, uniforms: mat.uniforms, geo, mat };
}

/* ------------------------------------------------------------------ Iceberg */

// Radius of the iceberg at height Y (water at 0): a broad floe at the surface that
// widens dramatically underwater, then narrows to a point near Y = -62.
export const BERG_TOP = 1.2;
export const BERG_BOTTOM = -62;
export function bergRadius(Y) {
    if (Y >= 0) return 7.2 - Y * 0.5;
    const d = -Y;
    const s = (t) => t * t * (3 - 2 * t);
    const grow = 7.2 + 10 * s(Math.min(1, d / 22));
    const shrink = s(Math.min(1, Math.max(0, (d - 30) / 32)));
    return grow * (1 - shrink * 0.97);
}

function bergMaterial(frost) {
    return new THREE.MeshPhysicalMaterial({
        color: 0xc9dce6,
        roughness: 0.5,
        roughnessMap: frost,
        bumpMap: frost,
        bumpScale: 0.5,
        metalness: 0,
        clearcoat: 0.35,
        clearcoatRoughness: 0.3,
        emissive: new THREE.Color(0x0c3646),
        emissiveIntensity: 0.18,
        flatShading: true,
        envMapIntensity: 0.7,
    });
}

function createIceberg(frost, detail) {
    const { fbm } = makeNoise(21);
    let body = new THREE.IcosahedronGeometry(1, detail);
    const pos = body.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const t = (v.y + 1) / 2;
        const Y = BERG_BOTTOM + t * (BERG_TOP - BERG_BOTTOM);
        const a = Math.atan2(v.z, v.x);
        const ring = Math.pow(Math.max(0, 1 - v.y * v.y), 0.12); // closes the poles
        const n = fbm(Math.cos(a) * 1.6 + 7, Math.sin(a) * 1.6 + Y * 0.06 + 3, 4);
        const ridges = Math.abs(Math.sin(a * 6 + Y * 0.09 + n * 4)) * 0.09;
        let r = bergRadius(Y) * ring * (1 + (n - 0.5) * 0.55 + ridges);
        const cx = Math.sin(Y * 0.05) * 2.5, cz = Math.cos(Y * 0.04) * 1.5 - 1.5;
        const yJitter = Y < -1 ? (fbm(a * 2, Y * 0.2, 2) - 0.5) * 2.5 : 0;
        pos.setXYZ(i, cx + Math.cos(a) * r, Math.min(BERG_TOP, Y + yJitter), cz + Math.sin(a) * r);
    }
    body = body.toNonIndexed();
    body.computeVertexNormals();

    // Peak above the floe, set toward the back so the portrait stands in front of it.
    let peak = new THREE.ConeGeometry(4.6, 7.6, 11, 7);
    const pp = peak.attributes.position;
    for (let i = 0; i < pp.count; i++) {
        v.fromBufferAttribute(pp, i);
        const k = 1 + (fbm(v.x * 0.6 + 2, v.z * 0.6 + v.y * 0.4, 3) - 0.5) * 0.7;
        pp.setXYZ(i, v.x * k, v.y + (fbm(v.x, v.z, 2) - 0.5) * 0.8, v.z * k);
    }
    peak = peak.toNonIndexed();
    peak.computeVertexNormals();

    const mat = bergMaterial(frost);
    const group = new THREE.Group();
    const bodyMesh = new THREE.Mesh(body, mat);
    const peakMesh = new THREE.Mesh(peak, mat);
    peakMesh.position.set(0.4, BERG_TOP + 3.2, -3.6);
    peakMesh.rotation.y = 0.4;
    group.add(bodyMesh, peakMesh);

    // A few small floes drifting near the berg.
    const floeGeo = new THREE.DodecahedronGeometry(1, 0);
    const floes = [[11, 0.1, 6, 1.4], [-13, 0.05, 2, 1.1], [16, -0.1, -10, 1.8], [-9, 0.1, 12, 0.8]].map(([x, y, z, s], i) => {
        const m = new THREE.Mesh(floeGeo, mat);
        m.position.set(x, y, z);
        m.scale.set(s * 1.6, s * 0.6, s * 1.3);
        m.rotation.y = i * 1.3;
        m.userData = { y, phase: i * 1.9 };
        group.add(m);
        return m;
    });
    return {
        group,
        floes,
        dispose() { body.dispose(); peak.dispose(); floeGeo.dispose(); mat.dispose(); },
    };
}

/* ------------------------------------------------------------------ Light rays */

function createRays() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(64, 256);
    for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 64; x++) {
            const u = (x / 63) * 2 - 1;
            const a = Math.exp(-u * u * 5) * Math.pow(1 - y / 255, 1.6);
            const i = (y * 64 + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
            img.data[i + 3] = a * 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, -0.5, 0); // hang from the surface
    const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: new THREE.Color(0.55, 0.85, 0.95),
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        side: THREE.DoubleSide,
    });
    const r = (() => { let s = 9; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const rays = [];
    for (let i = 0; i < 22; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(-24 + r() * 52, -0.2, -14 + r() * 46);
        m.scale.set(1.2 + r() * 3.4, 26 + r() * 30, 1);
        m.userData = { x: m.position.x, phase: r() * 6.28, tilt: (r() - 0.5) * 0.3 };
        rays.push(m);
    }
    const group = new THREE.Group();
    rays.forEach((m) => group.add(m));
    return {
        group,
        update(elapsed, camera) {
            rays.forEach((m) => {
                m.position.x = m.userData.x + Math.sin(elapsed * 0.15 + m.userData.phase) * 0.8;
                // Face the camera around the vertical axis, leaning slightly with the sun.
                m.rotation.set(0, Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z), m.userData.tilt);
            });
        },
        material: mat,
        dispose() { geo.dispose(); mat.dispose(); tex.dispose(); },
    };
}

/* ------------------------------------------------------------------ World */

export function createOcean({ frost, tier }) {
    const sky = createSky();
    const water = createWater();
    const berg = createIceberg(frost, tier === 'high' ? 30 : 18);
    const rays = createRays();
    const group = new THREE.Group();
    group.add(sky.mesh, water.mesh, berg.group, rays.group);

    const fogColor = new THREE.Color();
    return {
        group,
        fogColor,
        // Returns 0 above water, 1 below, plus how deep the camera is.
        update({ elapsed, camera, env }) {
            const y = camera.position.y;
            const under = THREE.MathUtils.smoothstep(-y, -0.3, 1.2);
            const depth = THREE.MathUtils.clamp(-y / 75, 0, 1);
            fogColor.copy(SKY.shallow).lerp(SKY.deep, Math.pow(depth, 0.8));
            fogColor.lerpColors(SKY.horizon, fogColor, under);
            sky.uniforms.uTime.value = elapsed;
            sky.uniforms.uFade.value = env;
            sky.uniforms.uFadeColor.value.copy(fogColor);
            sky.mesh.visible = y > -0.6;
            sky.mesh.position.copy(camera.position);
            water.uniforms.uTime.value = elapsed;
            rays.group.visible = under > 0.01;
            rays.material.opacity = 0.1 * under * (1 - depth * 0.8);
            if (rays.group.visible) rays.update(elapsed, camera);
            berg.floes.forEach((f) => {
                f.position.y = f.userData.y + Math.sin(elapsed * 0.6 + f.userData.phase) * 0.06;
            });
            return { under, depth };
        },
        dispose() {
            sky.mesh.geometry.dispose();
            sky.mesh.material.dispose();
            water.geo.dispose();
            water.mat.dispose();
            berg.dispose();
            rays.dispose();
        },
    };
}
