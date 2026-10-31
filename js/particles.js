// Contact sculpture (shader morph between point sets) and ambient snow.
import * as THREE from 'three';
import { rng } from './ice.js';

const SIZE = 256;

// Draw a target shape on a canvas; particles sample its filled pixels.
const drawers = {
    ng(ctx) {
        ctx.font = '700 150px "IBM Plex Sans", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('NG', SIZE / 2, SIZE / 2 + 6);
    },
    mail(ctx) {
        ctx.lineWidth = 16;
        ctx.lineJoin = 'round';
        ctx.strokeRect(36, 66, 184, 124);
        ctx.beginPath();
        ctx.moveTo(40, 72);
        ctx.lineTo(128, 140);
        ctx.lineTo(216, 72);
        ctx.stroke();
    },
    phone(ctx) {
        ctx.lineWidth = 15;
        ctx.beginPath();
        ctx.roundRect(78, 26, 100, 204, 18);
        ctx.stroke();
        ctx.fillRect(108, 46, 40, 8);
        ctx.beginPath();
        ctx.arc(128, 204, 9, 0, Math.PI * 2);
        ctx.fill();
    },
    pin(ctx) {
        ctx.beginPath();
        ctx.arc(128, 100, 66, Math.PI * 0.85, Math.PI * 2.15);
        ctx.lineTo(128, 236);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(128, 100, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    },
    cv(ctx) {
        ctx.lineWidth = 14;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(62, 24);
        ctx.lineTo(160, 24);
        ctx.lineTo(196, 62);
        ctx.lineTo(196, 232);
        ctx.lineTo(62, 232);
        ctx.closePath();
        ctx.stroke();
        [92, 128, 164, 196].forEach((y, i) => ctx.fillRect(88, y, i === 3 ? 50 : 82, 10));
    },
};

function sampleShape(key, count, seed) {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = ctx.strokeStyle = '#fff';
    drawers[key](ctx);
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
    const filled = [];
    for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) if (data[(y * SIZE + x) * 4 + 3] > 128) filled.push(x, y);
    }
    const r = rng(seed);
    const out = new Float32Array(count * 3);
    const n = filled.length / 2;
    const pts = [];
    for (let i = 0; i < count; i++) {
        const k = Math.floor(r() * n) * 2;
        const x = ((filled[k] + r() - 0.5) / SIZE - 0.5) * 4.4;
        const y = -((filled[k + 1] + r() - 0.5) / SIZE - 0.5) * 4.4;
        const z = (r() - 0.5) * 0.55 * (1 - Math.min(1, Math.hypot(x, y) / 3));
        pts.push([x, y, z]);
    }
    // Consistent spatial ordering keeps morph paths short and readable; the shared
    // shuffle then spreads every shape evenly through the buffer, so drawing only the
    // first N points (lower quality) still shows the whole shape.
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const order = sharedOrder(count);
    for (let i = 0; i < count; i++) out.set(pts[order[i]], i * 3);
    return out;
}

const orders = new Map();
function sharedOrder(count) {
    if (!orders.has(count)) {
        const r = rng(5);
        const o = Array.from({ length: count }, (_, i) => i);
        for (let i = count - 1; i > 0; i--) {
            const j = Math.floor(r() * (i + 1));
            [o[i], o[j]] = [o[j], o[i]];
        }
        orders.set(count, o);
    }
    return orders.get(count);
}

export function createSculpture({ count, pixelRatio }) {
    const keys = Object.keys(drawers);
    const targets = Object.fromEntries(keys.map((k, i) => [k, sampleShape(k, count, 900 + i)]));
    const geo = new THREE.BufferGeometry();
    const aA = new Float32Array(targets.ng);
    const aB = new Float32Array(targets.ng);
    const seeds = new Float32Array(count);
    const r = rng(77);
    for (let i = 0; i < count; i++) seeds[i] = r();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(aA), 3));
    geo.setAttribute('aA', new THREE.BufferAttribute(aA, 3));
    geo.setAttribute('aB', new THREE.BufferAttribute(aB, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uMorph: { value: 1 },
            uTime: { value: 0 },
            uPointer: { value: new THREE.Vector3(99, 99, 0) },
            uPointerAmt: { value: 0 },
            uSize: { value: 15 },
            uPixelRatio: { value: pixelRatio },
            uOpacity: { value: 0 },
            uCalm: { value: 1 },
        },
        vertexShader: /* glsl */`
            uniform float uMorph, uTime, uPointerAmt, uSize, uPixelRatio, uCalm;
            uniform vec3 uPointer;
            attribute vec3 aA;
            attribute vec3 aB;
            attribute float aSeed;
            varying float vBright;
            void main() {
                float e = clamp(uMorph * 1.35 - aSeed * 0.35, 0.0, 1.0);
                e = e * e * (3.0 - 2.0 * e);
                float travel = sin(e * 3.14159);
                vec3 p = mix(aA, aB, e);
                // Swirl while travelling; tiny idle drift when settled.
                float s = aSeed * 50.0;
                vec3 swirl = vec3(sin(s + uTime * 1.3), cos(s * 1.3 + uTime * 1.1), sin(s * 0.7 + uTime * 0.9));
                p += swirl * (0.012 * uCalm + travel * 0.55);
                // Local pointer disturbance with bounded falloff.
                vec3 d = p - uPointer;
                float f = uPointerAmt * exp(-dot(d, d) / 0.45);
                p += normalize(d + vec3(1e-4)) * f * 0.7;
                vBright = 0.5 + travel * 1.4 + f * 1.6;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = clamp(uSize * uPixelRatio / -mv.z, 1.0, 7.0 * uPixelRatio);
            }
        `,
        fragmentShader: /* glsl */`
            uniform float uOpacity;
            varying float vBright;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float a = smoothstep(0.5, 0.0, length(c));
                vec3 cool = vec3(0.69, 0.84, 0.9);
                vec3 col = mix(cool, vec3(1.0), clamp(vBright - 0.6, 0.0, 1.0));
                gl_FragColor = vec4(col * min(vBright, 2.2), a * uOpacity * 0.75);
            }
        `,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;

    let current = 'ng';
    let morph = 1;
    const ease = (u, s) => {
        const e = Math.min(1, Math.max(0, u * 1.35 - s * 0.35));
        return e * e * (3 - 2 * e);
    };

    function setShape(key) {
        if (!targets[key] || key === current) return;
        // Start from where points are now, not from the old source shape.
        for (let i = 0; i < count; i++) {
            const e = ease(morph, seeds[i]);
            for (let k = 0; k < 3; k++) aA[i * 3 + k] = aA[i * 3 + k] + (aB[i * 3 + k] - aA[i * 3 + k]) * e;
        }
        aB.set(targets[key]);
        geo.attributes.aA.needsUpdate = true;
        geo.attributes.aB.needsUpdate = true;
        morph = 0;
        current = key;
    }

    return {
        points,
        setShape,
        setCount(n) { geo.setDrawRange(0, Math.min(n, count)); },
        update(dt, elapsed, reduced) {
            morph = reduced ? 1 : Math.min(1, morph + dt / 1.3);
            mat.uniforms.uMorph.value = morph;
            mat.uniforms.uTime.value = elapsed;
            mat.uniforms.uCalm.value = reduced ? 0 : 1;
        },
        uniforms: mat.uniforms,
        dispose() { geo.dispose(); mat.dispose(); },
    };
}

export function createSnow({ count, box, rise = false }) {
    const r = rng(31);
    const pos = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = box.min.x + r() * (box.max.x - box.min.x);
        pos[i * 3 + 1] = box.min.y + r() * (box.max.y - box.min.y);
        pos[i * 3 + 2] = box.min.z + r() * (box.max.z - box.min.z);
        speed[i] = 0.15 + r() * 0.35;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
            uTime: { value: 0 },
            uMinY: { value: box.min.y },
            uRangeY: { value: box.max.y - box.min.y },
            uPixelRatio: { value: 1 },
            uOpacity: { value: 0 },
            uDir: { value: rise ? -1 : 1 },
        },
        vertexShader: /* glsl */`
            uniform float uTime, uMinY, uRangeY, uPixelRatio, uDir;
            attribute float aSpeed;
            varying float vFade;
            void main() {
                vec3 p = position;
                p.y = uMinY + mod(p.y - uMinY - uDir * uTime * aSpeed, uRangeY);
                p.x += sin(uTime * 0.3 + p.z) * 0.3;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                vFade = smoothstep(60.0, 8.0, -mv.z) * smoothstep(0.5, 3.0, -mv.z);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = clamp(9.0 * uPixelRatio / -mv.z, 1.0, 4.0 * uPixelRatio);
            }
        `,
        fragmentShader: /* glsl */`
            uniform float uOpacity;
            varying float vFade;
            void main() {
                float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
                gl_FragColor = vec4(vec3(0.8, 0.95, 1.0), a * vFade * uOpacity * 0.55);
            }
        `,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return {
        points,
        uniforms: mat.uniforms,
        dispose() { geo.dispose(); mat.dispose(); },
    };
}
