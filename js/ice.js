// Ice materials, generated frost texture, the skill ice blocks and journey enclosures.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const PALETTE = {
    deep: 0x121b22,
    slate: 0x37434d,
    mid: 0x8994a1,
    pale: 0xb9c2cd,
    frost: 0xdde5ec,
    white: 0xf4f8fb,
    accent: 0xafd7e6,
    warm: 0xf2c49b,
};
const CAT_TINT = { it: PALETTE.accent, design: PALETTE.warm, web: PALETTE.frost };

// Seeded PRNG so every layout and noise field is repeatable.
export function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// 2D value noise + fbm (CPU side, for textures and terrain).
export function makeNoise(seed = 7) {
    const rand = rng(seed);
    const perm = new Float32Array(512 * 512);
    for (let i = 0; i < perm.length; i++) perm[i] = rand();
    const at = (x, y) => perm[((y & 511) << 9) | (x & 511)];
    const n2 = (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y);
        let xf = x - xi, yf = y - yi;
        xf = xf * xf * (3 - 2 * xf);
        yf = yf * yf * (3 - 2 * yf);
        const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
        return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
    const fbm = (x, y, oct = 5) => {
        let v = 0, amp = 0.5, f = 1;
        for (let i = 0; i < oct; i++) { v += amp * n2(x * f, y * f); f *= 2.02; amp *= 0.5; }
        return v;
    };
    return { n2, fbm };
}

// Frost detail: broad cloudy variation plus thin crystalline streaks. Non-colour data.
export function frostTexture(size = 256) {
    const { fbm, n2 } = makeNoise(11);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = (x / size) * 8, v = (y / size) * 8;
            const broad = fbm(u * 0.5, v * 0.5, 4);
            const streak = 1 - Math.min(1, Math.abs(n2(u * 2.3 + broad * 3, v * 0.7) - 0.5) * 12);
            const val = Math.max(0, Math.min(1, broad * 0.75 + streak * 0.35));
            const i = (y * size + x) * 4;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = val * 255;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
}

// Ice: physical transmission on capable devices, a cheap translucent stand-in otherwise.
export function iceMaterial(tier, frost, opts = {}) {
    if (tier === 'low') {
        return new THREE.MeshStandardMaterial({
            color: opts.color ?? 0xc6d3dd,
            roughness: 0.22,
            metalness: 0.05,
            transparent: true,
            opacity: opts.lowOpacity ?? 0.4,
            roughnessMap: frost,
            depthWrite: false,
            envMapIntensity: 1.1,
        });
    }
    return new THREE.MeshPhysicalMaterial({
        color: opts.color ?? 0xe4eef4,
        metalness: 0,
        roughness: opts.roughness ?? 0.3,
        roughnessMap: frost,
        bumpMap: frost,
        bumpScale: opts.bump ?? 0.6,
        transmission: opts.transmission ?? 0.88,
        thickness: opts.thickness ?? 0.8,
        ior: 1.31,
        attenuationColor: new THREE.Color(0x9fb8c8),
        attenuationDistance: opts.attenuation ?? 2.2,
        clearcoat: 0.15,
        clearcoatRoughness: 0.4,
        envMapIntensity: opts.env ?? 1.15,
        specularIntensity: 1,
    });
}

// Icon (SVG stroke markup) → bright transparent canvas texture.
function iconTexture(markup, color) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    const img = new Image();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="256" height="256" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${markup}</svg>`;
    img.onload = () => {
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 256, 256);
        ctx.drawImage(img, 28, 28, 200, 200);
        tex.needsUpdate = true;
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return tex;
}

function textTexture(text, { size = 512, font = '500 150px "IBM Plex Mono", monospace', color = '#f4f8fb' } = {}) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size / 2;
    const ctx = c.getContext('2d');
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 4 + 6);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
}

/* ----------------------------------------------------------------- Skill ice blocks */

export function createSkillBlocks(skills, tier, frost) {
    const group = new THREE.Group();
    const geo = new RoundedBoxGeometry(1, 1, 1, 3, 0.1);
    const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01));
    const planeGeo = new THREE.PlaneGeometry(0.62, 0.62);
    const blockOpts = { roughness: 0.12, thickness: 0.9, attenuation: 4, bump: 0.3, env: 1.6, color: 0xeef5f9 };
    let mat = iceMaterial(tier, frost, blockOpts);
    const blocks = skills.map((skill, i) => {
        const tint = CAT_TINT[skill.cat] ?? PALETTE.frost;
        const mesh = new THREE.Mesh(geo, mat);
        // The texture is used as a cut-out (alphaMap) and colour comes from the material:
        // a colour map would average its white strokes with black transparent texels
        // when mipmapped, turning small icons grey.
        const iconMat = new THREE.MeshBasicMaterial({
            alphaMap: iconTexture(skill.icon, '#ffffff'),
            color: new THREE.Color(tint),
            // Alpha-tested (not blended) so the transmission pass sees it through the ice.
            alphaTest: 0.35,
            toneMapped: false,
            fog: false,
        });
        // Icon etched on the front face: a copy deep inside refracts into clutter.
        const iconMesh = new THREE.Mesh(planeGeo, iconMat);
        iconMesh.position.z = 0.52;
        iconMesh.scale.setScalar(0.82);
        const edgeMat = new THREE.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.25, fog: false });
        mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));
        const holder = new THREE.Group();
        holder.add(mesh, iconMesh);
        holder.visible = false;
        group.add(holder);
        const r = rng(100 + i);
        return { holder, mesh, iconMesh, iconMat, edgeMat, tint: new THREE.Color(tint), seed: r() * Math.PI * 2, spin: (r() - 0.5) * 0.5, lift: 0, glow: 0 };
    });
    return {
        group,
        blocks,
        setTier(t) {
            const next = iceMaterial(t, frost, blockOpts);
            blocks.forEach((b) => { b.mesh.material = next; });
            mat.dispose();
            mat = next;
        },
        dispose() {
            geo.dispose(); edgeGeo.dispose(); planeGeo.dispose(); mat.dispose();
            blocks.forEach((b) => { b.iconMat.alphaMap.dispose(); b.iconMat.dispose(); b.edgeMat.dispose(); });
        },
    };
}

/* ----------------------------------------------------------------- Journey enclosures */

// Distinct silhouettes per kind: tall faceted (education), wide rounded (experience),
// compact sharp (training). Each holds an opaque symbol and its year.
const KIND_SHAPE = {
    education: { scale: [1.05, 1.55, 1.05], detail: 1, amp: 0.16, flat: true },
    experience: { scale: [1.65, 1.0, 1.15], detail: 3, amp: 0.1, flat: false },
    training: { scale: [1.15, 1.15, 1.15], detail: 1, amp: 0.24, flat: true },
};

function crystalGeometry(kind, seed) {
    const cfg = KIND_SHAPE[kind] ?? KIND_SHAPE.training;
    let g = new THREE.IcosahedronGeometry(1, cfg.detail);
    const { fbm } = makeNoise(seed);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const n = fbm(v.x * 1.3 + 10, v.y * 1.3 + v.z * 0.7 + 10, 3);
        v.multiplyScalar(1 + (n - 0.5) * cfg.amp * 2.2);
        v.set(v.x * cfg.scale[0], v.y * cfg.scale[1], v.z * cfg.scale[2]);
        pos.setXYZ(i, v.x, v.y, v.z);
    }
    if (cfg.flat) g = g.toNonIndexed();
    g.computeVertexNormals();
    return g;
}

function symbolMesh(kind, mat) {
    const grp = new THREE.Group();
    if (kind === 'education') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 12, 48), mat);
        ring.rotation.x = Math.PI / 2.4;
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 6), mat);
        grp.add(ring, cap);
    } else if (kind === 'experience') {
        [[-0.26, 0, 0], [0.04, 0.1, 0.05], [0.3, -0.04, -0.04]].forEach(([x, y, z], i) => {
            const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22 + i * 0.06, 0.22), mat);
            b.position.set(x, y, z);
            grp.add(b);
        });
    } else {
        grp.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), mat));
    }
    return grp;
}

export function createStations(entries, positions, tier, frost) {
    const group = new THREE.Group();
    const innerMat = new THREE.MeshStandardMaterial({
        color: PALETTE.slate,
        roughness: 0.45,
        metalness: 0.2,
        emissive: PALETTE.accent,
        emissiveIntensity: 0.12,
    });
    const yearGeo = new THREE.PlaneGeometry(1.1, 0.55);
    const iceOpts = { roughness: 0.3, thickness: 0.7, attenuation: 2.6, lowOpacity: 0.3 };
    const toCam = new THREE.Vector3();
    const stations = entries.map((entry, i) => {
        const holder = new THREE.Group();
        holder.position.copy(positions[i]);
        holder.userData.baseY = positions[i].y;
        const geo = crystalGeometry(entry.kind, 300 + i);
        const shell = new THREE.Mesh(geo, iceMaterial(tier, frost, iceOpts));
        const symbol = symbolMesh(entry.kind, innerMat);
        symbol.position.y = 0.25;
        const yearMat = new THREE.MeshBasicMaterial({ alphaMap: textTexture(entry.year), color: new THREE.Color(1.6, 1.7, 1.8), alphaTest: 0.35, toneMapped: false });
        const year = new THREE.Mesh(yearGeo, yearMat);
        year.position.set(0, -0.3, 0.05);
        year.renderOrder = -1;
        symbol.renderOrder = -1;
        holder.add(symbol, year, shell);
        group.add(holder);
        return { holder, shell, symbol, year, yearMat, geo, seed: i * 1.7 };
    });
    return {
        group,
        stations,
        setTier(t) {
            stations.forEach((s) => {
                s.shell.material.dispose();
                s.shell.material = iceMaterial(t, frost, iceOpts);
            });
        },
        update(elapsed, camera) {
            stations.forEach((s) => {
                s.shell.rotation.y = elapsed * 0.05 + s.seed;
                s.symbol.rotation.y = -elapsed * 0.3 + s.seed;
                s.holder.position.y = s.holder.userData.baseY + Math.sin(elapsed * 0.6 + s.seed) * 0.04;
                // Keep the year near the face toward the viewer so it reads through the ice.
                toCam.copy(camera.position).sub(s.holder.position).normalize();
                s.year.position.copy(toCam).multiplyScalar(0.45);
                s.year.position.y -= 0.3;
                s.year.quaternion.copy(camera.quaternion);
            });
        },
        dispose() {
            yearGeo.dispose();
            innerMat.dispose();
            stations.forEach((s) => {
                s.geo.dispose();
                s.shell.material.dispose();
                s.yearMat.alphaMap.dispose();
                s.yearMat.dispose();
                s.symbol.traverse((o) => o.geometry?.dispose());
            });
        },
    };
}
