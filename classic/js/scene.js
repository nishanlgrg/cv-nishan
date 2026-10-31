// One persistent WebGL scene. Sections map to "states"; the page feeds a float
// stage (0 = hero … 6 = contact) and the scene blends camera + objects between states.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TEAL = 0x3fd6c6;
const WARM = 0xf2a66a;
const NEUTRAL = 0xb9c6c2;
const CAT_COLOR = { it: TEAL, design: WARM, web: NEUTRAL };
// Timeline progress tip, as a fraction of viewport height (matches the HTML rail trigger).
const TIMELINE_TIP = 0.72;

// --- Section states (wide screens). Narrow screens are derived below. ---------------
const STATES_WIDE = [
    // 0 hero: monogram to the right of the name
    { cam: [0, 0, 10], look: [0, 0, 0], mono: { p: [4.2, 0.1, 0], r: [0.06, -0.42, 0], s: 0.92 }, rings: 'orbit', warm: 0.45 },
    // 1 about: camera swings left, monogram recedes behind the heading
    { cam: [-1.8, 0.9, 9.4], look: [-0.6, 0.4, 0], mono: { p: [5.6, 3.4, -9], r: [0.3, -0.85, 0.1], s: 1.5 }, rings: 'drift', warm: 0.65 },
    // 2 skills: monogram far back; tiles take the stage
    { cam: [0, 0, 10], look: [0, 0, 0], mono: { p: [11.5, 6.2, -17], r: [0.35, -1.15, 0.25], s: 1.7 }, rings: 'drift', warm: 0.5, tiles: 1 },
    // 3 profile: camera dollies into a tunnel of rings
    { cam: [0, 0.4, 7.5], look: [0, 0.4, -12], mono: { p: [0, 0.4, -27], r: [0, 0, 0], s: 1.8 }, rings: 'tunnel', warm: 0.4 },
    // 4 journey: connected nodes along the timeline
    { cam: [1.2, 0, 10], look: [1.2, 0, 0], mono: { p: [5.6, -1.7, -6], r: [0.2, -0.7, 0.05], s: 1.0 }, rings: 'drift', warm: 0.6, spine: 1 },
    // 5 services
    { cam: [0, 0, 10], look: [0, 0, 0], mono: { p: [5.2, -1.4, -9], r: [-0.12, -0.95, 0.08], s: 1.6 }, rings: 'orbit', warm: 0.7 },
    // 6 contact: calm final composition
    { cam: [0, 0, 10], look: [0, 0, 0], mono: { p: [3.4, 1.1, -2.5], r: [0.02, -0.22, 0], s: 1.0 }, rings: 'halo', warm: 1 },
];

function narrowStates() {
    return STATES_WIDE.map((st, i) => {
        const s = structuredClone(st);
        s.cam[0] *= 0.2;
        s.look[0] *= 0.2;
        s.mono.p[0] *= 0.25;
        s.mono.s *= 0.6;
        if (i === 0) { s.mono.p = [0, 2.2, -1]; s.mono.s = 0.6; }
        if (i === 1 || i === 4) { s.mono.p = [2.4, 5.8, -10]; s.mono.s = 0.7; }
        if (i === 2) { s.mono.p = [2.4, 5.6, -14]; }
        if (i === 3) { s.mono.s = 1.2; }
        if (i === 6) { s.mono.p = [0, 2.75, -2.5]; s.mono.s = 0.52; }
        return s;
    });
}

// --- Helpers ----------------------------------------------------------------------
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const smooth = (t) => t * t * (3 - 2 * t);
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
let snapAll = false; // reduced motion: every damped value jumps to its target
const ease = (a, b, k, dt) => (snapAll ? b : damp(a, b, k, dt));

function monogramShapes() {
    const n = new THREE.Shape();
    [[0, 0], [0.36, 0], [0.36, 1.3], [1.14, 0], [1.5, 0], [1.5, 2], [1.14, 2], [1.14, 0.7], [0.36, 2], [0, 2]]
        .forEach(([x, y], i) => (i ? n.lineTo(x, y) : n.moveTo(x, y)));
    n.closePath();

    const g = new THREE.Shape();
    const cx = 2.8, cy = 1, ro = 1, ri = 0.64, a0 = THREE.MathUtils.degToRad(40);
    const ix = Math.sqrt(ri * ri - 0.26 * 0.26);
    g.moveTo(cx + ro * Math.cos(a0), cy + ro * Math.sin(a0));
    g.absarc(cx, cy, ro, a0, Math.PI * 2, false);
    g.lineTo(cx + ro, cy + 0.08);
    g.lineTo(cx + 0.22, cy + 0.08);
    g.lineTo(cx + 0.22, cy - 0.26);
    g.lineTo(cx + ix, cy - 0.26);
    g.absarc(cx, cy, ri, Math.atan2(-0.26, ix), a0 - Math.PI * 2, true);
    g.closePath();
    return [n, g];
}

function ringLayout(name, mono, i, out) {
    switch (name) {
        case 'orbit':
            out.p.set(mono.p[0], mono.p[1], mono.p[2]);
            out.r.set(1.15 + i * 0.32, 0.28 * i, 0);
            out.s = mono.s * (2.05 + i * 0.3);
            out.o = i < 3 ? 0.55 - i * 0.13 : 0;
            break;
        case 'tunnel':
            out.p.set(0, 0.4, -2 - i * 4.4);
            out.r.set(0, 0, i * 0.3);
            out.s = 2.7;
            out.o = 0.5 - i * 0.06;
            break;
        case 'halo':
            out.p.set(mono.p[0], mono.p[1], mono.p[2] - 0.4);
            out.r.set(0, 0, 0);
            out.s = mono.s * (2.2 + i * 0.5);
            out.o = 0.42 - i * 0.06;
            break;
        default: // drift: large, faint, in the background
            out.p.set(-6 + i * 2.6, -2 + (i % 3) * 2.2, -15 - i * 2);
            out.r.set(0.8 + i * 0.3, 0.5 * i, 0);
            out.s = 3 + i * 0.4;
            out.o = 0.1;
    }
    return out;
}

// --- Scene ------------------------------------------------------------------------
export function createScene(canvas, { reducedMotion = false } = {}) {
    snapAll = reducedMotion;
    const narrowQuery = window.matchMedia('(max-width: 760px), (max-aspect-ratio: 4/5)');
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4;

    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: !lowPower,
        powerPreference: 'high-performance',
    });
    if (!renderer.getContext()) throw new Error('WebGL unavailable');
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    let maxDpr = lowPower ? 1.5 : 1.75;
    let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(renderer), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    // Lights
    const hemi = new THREE.HemisphereLight(0x9fd8d2, 0x0a0806, 0.35);
    const key = new THREE.DirectionalLight(0xffc293, 2.4);
    key.position.set(-5, 4, 6);
    const rim = new THREE.PointLight(TEAL, 40, 18, 2);
    const fill = new THREE.DirectionalLight(TEAL, 0.5);
    fill.position.set(4, -3, 2);
    scene.add(hemi, key, rim, fill);

    // Monogram
    const mono = new THREE.Group();
    const depth = 0.5, bevel = 0.06;
    const shapes = monogramShapes();
    const monoGeo = new THREE.ExtrudeGeometry(shapes, {
        depth,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: 0.035,
        bevelSegments: lowPower ? 2 : 4,
        curveSegments: lowPower ? 28 : 56,
    });
    monoGeo.computeBoundingBox();
    const monoCenter = monoGeo.boundingBox.getCenter(new THREE.Vector3());
    const monoMat = new THREE.MeshPhysicalMaterial({
        color: 0x9fb0b2,
        metalness: 0.95,
        roughness: 0.24,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        envMapIntensity: 0.9,
    });
    const monoMesh = new THREE.Mesh(monoGeo, monoMat);
    monoMesh.position.copy(monoCenter).negate();
    mono.add(monoMesh);

    const outlineMat = new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.85 });
    const outlineGeos = shapes.map((shape) => {
        const pts = shape.getPoints(lowPower ? 28 : 56).map((v) => new THREE.Vector3(v.x, v.y, depth + bevel + 0.004));
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.LineLoop(geo, outlineMat);
        line.position.copy(monoCenter).negate();
        mono.add(line);
        return geo;
    });
    scene.add(mono);

    // Rings
    const RING_COUNT = 6;
    const ringGeo = new THREE.TorusGeometry(1, 0.008, 6, lowPower ? 120 : 200);
    const rings = [];
    for (let i = 0; i < RING_COUNT; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: i % 2 ? WARM : TEAL,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const m = new THREE.Mesh(ringGeo, mat);
        scene.add(m);
        rings.push(m);
    }
    const ringA = { p: new THREE.Vector3(), r: new THREE.Vector3(), s: 1, o: 0 };
    const ringB = { p: new THREE.Vector3(), r: new THREE.Vector3(), s: 1, o: 0 };

    // Dust: sparse, slow, mostly far away
    const DUST = lowPower ? 180 : 420;
    const dustPos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
        dustPos[i * 3] = (Math.random() - 0.5) * 30;
        dustPos[i * 3 + 1] = (Math.random() - 0.5) * 18;
        dustPos[i * 3 + 2] = -30 + Math.random() * 30;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
        color: 0xa6e9e1,
        size: 0.035,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    // Skill tiles (aligned to HTML buttons every frame they are visible)
    const tileGeo = new RoundedBoxGeometry(1, 1, 0.22, 3, 0.07);
    const tileEdgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 0.22));
    const tiles = [];
    const tileGroup = new THREE.Group();
    scene.add(tileGroup);
    let tileEls = [];

    function setSkillElements(els) {
        tileEls = els;
        els.forEach((el, i) => {
            const color = CAT_COLOR[el.dataset.cat] || TEAL;
            const mat = new THREE.MeshPhysicalMaterial({
                color: 0x10171a,
                metalness: 0.4,
                roughness: 0.32,
                clearcoat: 0.8,
                emissive: color,
                emissiveIntensity: 0.04,
                transparent: true,
                opacity: 1,
                envMapIntensity: 0.7,
            });
            const edgeMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
            const mesh = new THREE.Mesh(tileGeo, mat);
            const edge = new THREE.LineSegments(tileEdgeGeo, edgeMat);
            mesh.add(edge);
            mesh.visible = false;
            tileGroup.add(mesh);
            tiles.push({
                mesh, mat, edgeMat,
                seed: Math.random() * Math.PI * 2,
                lift: 0, glow: 0,
            });
        });
    }

    // Timeline spine (nodes aligned to HTML dots, connected by a line)
    const nodeGeo = new THREE.SphereGeometry(0.075, 20, 14);
    const haloGeo = new THREE.SphereGeometry(0.16, 16, 12);
    const nodes = [];
    let nodeEls = [];
    const spineMat = new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0 });
    let spineGeo = new THREE.BufferGeometry();
    const spine = new THREE.Line(spineGeo, spineMat);
    scene.add(spine);

    function setTimelineElements(els) {
        nodeEls = els;
        spineGeo.dispose();
        spineGeo = new THREE.BufferGeometry();
        // One extra vertex for the moving tip between nodes.
        spineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((els.length + 1) * 3), 3));
        spine.geometry = spineGeo;
        els.forEach((el) => {
            const kind = el.closest('[data-kind]')?.dataset.kind;
            const color = kind === 'education' ? TEAL : WARM;
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
            const haloMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
            const mesh = new THREE.Mesh(nodeGeo, mat);
            const halo = new THREE.Mesh(haloGeo, haloMat);
            mesh.add(halo);
            mesh.visible = false;
            scene.add(mesh);
            nodes.push({ mesh, mat, haloMat, lit: 0 });
        });
    }

    // --- Runtime state --------------------------------------------------------
    let states = narrowQuery.matches ? narrowStates() : STATES_WIDE;
    let stageTarget = 0;
    let stage = 0;
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    const intro = { value: reducedMotion ? 1 : 0 };
    let pulse = 0;
    let activeSkill = -1;
    let hoverSkill = -1;
    let width = 1, height = 1;
    let running = false;
    let rafId = 0;
    let last = performance.now();
    let elapsed = 0;
    let needsRender = true;
    // Adaptive resolution: track slow frames and step DPR down once if needed.
    let slowFrames = 0, sampleFrames = 0;

    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();
    const tmpV = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const ndc = new THREE.Vector3();

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        states = narrowQuery.matches ? narrowStates() : STATES_WIDE;
        needsRender = true;
    }

    // Place a point at screen (x, y) px on a plane `dist` units in front of the camera.
    function screenToWorld(x, y, dist, out) {
        ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1, 0.5).unproject(camera);
        ndc.sub(camera.position).normalize();
        camera.getWorldDirection(fwd);
        return out.copy(camera.position).addScaledVector(ndc, dist / ndc.dot(fwd));
    }
    const worldPerPx = (dist) => (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / height;

    function blend(key, i0, i1, f, idx) {
        const a = states[i0], b = states[i1];
        const va = idx === undefined ? (a[key] ?? 0) : a[key][idx];
        const vb = idx === undefined ? (b[key] ?? 0) : b[key][idx];
        return lerp(va, vb, f);
    }

    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (!reducedMotion) elapsed += dt;

        // Stage + pointer smoothing
        stage = reducedMotion ? stageTarget : damp(stage, stageTarget, 3.2, dt);
        pointer.sx = reducedMotion ? 0 : damp(pointer.sx, pointer.x, 3, dt);
        pointer.sy = reducedMotion ? 0 : damp(pointer.sy, pointer.y, 3, dt);
        pulse = damp(pulse, 0, 2.2, dt);

        const n = states.length;
        const i0 = clamp(Math.floor(stage), 0, n - 1);
        const i1 = Math.min(i0 + 1, n - 1);
        const f = smooth(clamp(stage - i0, 0, 1));
        const A = states[i0], B = states[i1];
        const iv = intro.value;

        // Camera
        camPos.set(blend('cam', i0, i1, f, 0), blend('cam', i0, i1, f, 1), blend('cam', i0, i1, f, 2));
        camLook.set(blend('look', i0, i1, f, 0), blend('look', i0, i1, f, 1), blend('look', i0, i1, f, 2));
        camPos.x += pointer.sx * 0.35;
        camPos.y += pointer.sy * 0.22;
        camera.position.copy(camPos);
        camera.lookAt(camLook);
        camera.getWorldDirection(fwd);
        camera.position.addScaledVector(fwd, pulse * 1.6);
        camera.updateMatrixWorld();

        // Monogram
        const m = {
            p: [0, 1, 2].map((k) => lerp(A.mono.p[k], B.mono.p[k], f)),
            r: [0, 1, 2].map((k) => lerp(A.mono.r[k], B.mono.r[k], f)),
            s: lerp(A.mono.s, B.mono.s, f),
        };
        const calm = lerp(A.warm ?? 0.5, B.warm ?? 0.5, f);
        const idle = reducedMotion ? 0 : Math.sin(elapsed * 0.5) * 0.06;
        mono.position.set(m.p[0], m.p[1] + idle * 0.6, m.p[2] - (1 - iv) * 3);
        mono.rotation.set(
            m.r[0] - pointer.sy * 0.22 + idle * 0.4,
            m.r[1] + pointer.sx * 0.38 + (1 - iv) * -2.2,
            m.r[2] + (1 - iv) * 0.5,
        );
        mono.scale.setScalar(Math.max(0.0001, m.s * (0.35 + 0.65 * iv)));
        outlineMat.opacity = 0.85 * iv;

        // Lights: teal rim follows the monogram; warmth rises toward the contact state
        rim.position.set(m.p[0] + 2.5, m.p[1] + 1.2, m.p[2] - 2.5);
        rim.intensity = 40 * iv * (1.15 - calm * 0.45);
        key.intensity = 2.4 * iv * (0.75 + calm * 0.45);
        hemi.intensity = 0.35 * iv;

        // Rings
        for (let i = 0; i < RING_COUNT; i++) {
            ringLayout(A.rings, A.mono, i, ringA);
            ringLayout(B.rings, B.mono, i, ringB);
            const ring = rings[i];
            ring.position.lerpVectors(ringA.p, ringB.p, f);
            const spin = elapsed * 0.08 * (i % 2 ? 1 : -1);
            ring.rotation.set(
                lerp(ringA.r.x, ringB.r.x, f),
                lerp(ringA.r.y, ringB.r.y, f),
                lerp(ringA.r.z, ringB.r.z, f) + spin,
            );
            ring.scale.setScalar(lerp(ringA.s, ringB.s, f) * (0.6 + 0.4 * iv));
            ring.material.opacity = lerp(ringA.o, ringB.o, f) * iv;
            ring.visible = ring.material.opacity > 0.002;
        }

        dust.rotation.y = elapsed * 0.01;
        dust.position.y = Math.sin(elapsed * 0.1) * 0.3;
        dustMat.opacity = 0.45 * iv;

        // Skill tiles
        const tilesW = smooth(clamp(blend('tiles', i0, i1, f), 0, 1));
        tileGroup.visible = tilesW > 0.002 && tileEls.length > 0;
        if (tileGroup.visible) {
            const dist = 7;
            const k = worldPerPx(dist);
            tiles.forEach((t, i) => {
                const rect = tileEls[i].getBoundingClientRect();
                const onScreen = rect.bottom > -40 && rect.top < height + 40;
                t.mesh.visible = onScreen;
                if (!onScreen) return;
                const isActive = i === activeSkill;
                const isHover = i === hoverSkill;
                t.lift = ease(t.lift, isActive ? 1 : isHover ? 0.6 : 0, 8, dt);
                t.glow = ease(t.glow, isActive ? 1 : isHover ? 0.55 : 0, 8, dt);
                screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2, dist, tmpV);
                const scatter = 1 - tilesW;
                tmpV.addScaledVector(fwd, -scatter * 9 + t.lift * 0.2);
                tmpV.y += scatter * Math.sin(t.seed) * 3;
                t.mesh.position.copy(tmpV);
                t.mesh.quaternion.copy(camera.quaternion);
                t.mesh.rotateX(-pointer.sy * 0.25 + scatter * Math.cos(t.seed) * 1.5 + Math.sin(elapsed * 0.6 + t.seed) * 0.03);
                t.mesh.rotateY(pointer.sx * 0.3 + scatter * Math.sin(t.seed) * 1.5);
                t.mesh.scale.set(rect.width * k * 0.94, rect.height * k * 0.94, 1 + t.lift * 0.6);
                t.mat.emissiveIntensity = 0.05 + t.glow * 0.32;
                t.mat.opacity = tilesW;
                t.edgeMat.opacity = (0.3 + t.glow * 0.7) * tilesW;
            });
        }

        // Timeline nodes
        const spineW = smooth(clamp(blend('spine', i0, i1, f), 0, 1));
        spine.visible = spineW > 0.002 && nodeEls.length > 0;
        nodes.forEach((nd) => { nd.mesh.visible = spine.visible; });
        if (spine.visible) {
            // Push nodes back along their own view ray so they stay on the HTML rail on screen.
            const dist = 9 + (1 - spineW) * 6;
            const tipY = height * TIMELINE_TIP;
            const pos = spineGeo.attributes.position;
            let count = 0;
            let prevX = 0, prevY = 0, tipDone = false;
            nodes.forEach((nd, i) => {
                const rect = nodeEls[i].getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                screenToWorld(cx, cy, dist, tmpV);
                nd.mesh.position.copy(tmpV);
                const passed = cy <= tipY;
                nd.lit = ease(nd.lit, passed ? 1 : 0, 6, dt);
                nd.mat.opacity = (0.35 + 0.65 * nd.lit) * spineW;
                nd.haloMat.opacity = 0.35 * nd.lit * spineW;
                nd.mesh.scale.setScalar(0.8 + nd.lit * 0.5 + (reducedMotion ? 0 : Math.sin(elapsed * 2 + i) * 0.05 * nd.lit));
                // The line runs through every passed node, then ends exactly at the tip
                // between the last passed node and the next one.
                if (passed) {
                    pos.setXYZ(count++, tmpV.x, tmpV.y, tmpV.z);
                } else if (count > 0 && count === i && !tipDone) {
                    tipDone = true;
                    const t = (tipY - prevY) / (cy - prevY);
                    screenToWorld(lerp(prevX, cx, t), tipY, dist, tmpV);
                    pos.setXYZ(count++, tmpV.x, tmpV.y, tmpV.z);
                }
                prevX = cx;
                prevY = cy;
            });
            pos.needsUpdate = true;
            spineGeo.setDrawRange(0, count);
            spineGeo.computeBoundingSphere();
            spineMat.opacity = 0.85 * spineW;
        }

        renderer.render(scene, camera);
        needsRender = false;

        // Adaptive DPR: if most of ~90 frames are slow, step resolution down once.
        if (!reducedMotion && dpr > 1) {
            sampleFrames++;
            if (dt > 1 / 40) slowFrames++;
            if (sampleFrames >= 90) {
                if (slowFrames > 60) {
                    dpr = Math.max(1, dpr - 0.5);
                    maxDpr = dpr;
                    renderer.setPixelRatio(dpr);
                    renderer.setSize(width, height, false);
                }
                sampleFrames = 0;
                slowFrames = 0;
            }
        }
    }

    function loop(now) {
        rafId = requestAnimationFrame(loop);
        // Reduced motion: render only when something changed.
        if (reducedMotion && !needsRender) { last = now; return; }
        frame(now);
    }

    function start() {
        if (running) return;
        running = true;
        last = performance.now();
        rafId = requestAnimationFrame(loop);
    }

    function stop() {
        running = false;
        cancelAnimationFrame(rafId);
    }

    const onContextLost = (e) => { e.preventDefault(); stop(); };
    canvas.addEventListener('webglcontextlost', onContextLost);
    narrowQuery.addEventListener('change', resize);
    resize();

    function dispose() {
        stop();
        canvas.removeEventListener('webglcontextlost', onContextLost);
        narrowQuery.removeEventListener('change', resize);
        const geos = new Set([monoGeo, ringGeo, dustGeo, tileGeo, tileEdgeGeo, nodeGeo, haloGeo, spineGeo, ...outlineGeos]);
        geos.forEach((g) => g.dispose());
        scene.traverse((o) => {
            if (o.material) [].concat(o.material).forEach((mat) => mat.dispose());
        });
        envRT.dispose();
        renderer.dispose();
    }

    return {
        intro,
        setStage(v) { stageTarget = v; needsRender = true; },
        setPointer(x, y) { pointer.x = x; pointer.y = y; },
        setSkillElements,
        setTimelineElements,
        setActiveSkill(i) { activeSkill = i; needsRender = true; },
        setHoverSkill(i) { hoverSkill = i; needsRender = true; },
        pulse() { if (!reducedMotion) pulse = 1; },
        invalidate() { needsRender = true; },
        resize,
        start,
        stop,
        dispose,
    };
}
