// The portrait frozen in a block of ice, built from fracture shards so it can break.
// A penguin waddles beside it and, every five seconds, body-slams the block: the
// shards burst away from the impact, scatter on the floe, then rewind into place.
// Every visual is sampled from a clock, so the cycle is deterministic and reversible.
import * as THREE from 'three';
import { iceMaterial, rng, PALETTE } from './ice.js';

const DEPTH = 1.05;
const CYCLE = 5;
const IMPACT_AT = 2.85;     // seconds into the cycle
const FLIGHT = 1.25;        // shards in the air (then rest on the floe)
const REWIND_START = 4.25;  // shards fly back...
const REWIND_END = 4.95;    // ...and the block is whole again
const GRAVITY = 9.8;

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// Face texture: the photo set inside a frosted ice border, with a cold sheen over it.
function frozenPhotoTexture(img, W, H, margin) {
    const scale = 1400 / (W + 2 * margin);
    const c = document.createElement('canvas');
    c.width = Math.round((W + 2 * margin) * scale);
    c.height = Math.round((H + 2 * margin) * scale);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, '#d9e8f0');
    g.addColorStop(1, '#a8c4d3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    const r = rng(8);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 60; i++) {
        ctx.lineWidth = 0.5 + r() * 1.5;
        ctx.beginPath();
        const x = r() * c.width, y = r() * c.height;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 140, y + (r() - 0.5) * 140);
        ctx.stroke();
    }
    const m = margin * scale;
    ctx.drawImage(img, m, m, c.width - 2 * m, c.height - 2 * m);
    // Cold tint and frost creeping in from the photo's edges.
    ctx.fillStyle = 'rgba(175, 215, 230, 0.12)';
    ctx.fillRect(m, m, c.width - 2 * m, c.height - 2 * m);
    const edge = ctx.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.3, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.62);
    edge.addColorStop(0, 'rgba(230,242,248,0)');
    edge.addColorStop(1, 'rgba(230,242,248,0.55)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

/* ------------------------------------------------------------------ Penguin */

function createPenguin() {
    const black = new THREE.MeshStandardMaterial({ color: 0x15191e, roughness: 0.55, metalness: 0.05 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf1f4f6, roughness: 0.6 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xf0973a, roughness: 0.5 });
    const geos = [];
    const sphere = (r, mat, pos, scale = [1, 1, 1]) => {
        const g = new THREE.SphereGeometry(r, 28, 20);
        geos.push(g);
        const m = new THREE.Mesh(g, mat);
        m.position.set(...pos);
        m.scale.set(...scale);
        return m;
    };
    const root = new THREE.Group();     // on the ground, yaw
    const pivot = new THREE.Group();    // centre of mass, pitch for the dive
    pivot.position.y = 0.7;
    root.add(pivot);
    const Y = (y) => y - 0.7;
    pivot.add(
        sphere(0.45, black, [0, Y(0.68), 0], [1, 1.45, 0.92]),
        sphere(0.4, white, [0, Y(0.62), 0.2], [0.85, 1.28, 0.62]),
        sphere(0.3, black, [0, Y(1.33), 0.02]),
        sphere(0.2, white, [0, Y(1.31), 0.15], [1.05, 0.9, 0.7]),
        sphere(0.055, white, [-0.1, Y(1.39), 0.27]),
        sphere(0.055, white, [0.1, Y(1.39), 0.27]),
        sphere(0.03, black, [-0.1, Y(1.395), 0.315]),
        sphere(0.03, black, [0.1, Y(1.395), 0.315]),
    );
    const beakGeo = new THREE.ConeGeometry(0.075, 0.22, 16);
    geos.push(beakGeo);
    const beak = new THREE.Mesh(beakGeo, orange);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, Y(1.27), 0.36);
    pivot.add(beak);
    const flippers = [-1, 1].map((s) => {
        const hinge = new THREE.Group();
        hinge.position.set(0.4 * s, Y(1.0), 0);
        const f = sphere(0.33, black, [0.04 * s, -0.28, 0], [0.18, 0.95, 0.48]);
        f.rotation.z = 0.12 * s;
        hinge.add(f);
        pivot.add(hinge);
        return hinge;
    });
    const feet = [-1, 1].map((s) => {
        const foot = sphere(0.14, orange, [0.16 * s, Y(0.04), 0.14], [1, 0.35, 1.6]);
        pivot.add(foot);
        return foot;
    });
    root.traverse((o) => { o.castShadow = false; });
    return {
        root, pivot, flippers, feet,
        dispose() { geos.forEach((g) => g.dispose()); [black, white, orange].forEach((m) => m.dispose()); },
    };
}

/* ------------------------------------------------------------------ Ice block */

export async function createIceCube({ photo, tier, frost, width, margin = 0.25, center, floorY }) {
    const img = await loadImage(photo.src);
    const W = width;
    const H = (width * img.naturalHeight) / img.naturalWidth;
    const TW = W + 2 * margin, TH = H + 2 * margin;
    const cols = 7, rows = 6;
    const rand = rng(64);

    // Jittered lattice: interior points wander, border points slide along their edge.
    const pt = [];
    for (let r = 0; r <= rows; r++) {
        pt[r] = [];
        for (let c = 0; c <= cols; c++) {
            let x = (c / cols) * TW, y = (r / rows) * TH;
            const jx = (rand() - 0.5) * 0.7 * (TW / cols), jy = (rand() - 0.5) * 0.7 * (TH / rows);
            if (c > 0 && c < cols) x += jx;
            if (r > 0 && r < rows) y += jy;
            pt[r][c] = [x, y];
        }
    }

    const map = frozenPhotoTexture(img, W, H, margin);
    map.repeat.set(1 / TW, 1 / TH);
    const revealPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e3);
    const faceMat = new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.4,
        metalness: 0,
        clearcoat: 0.8,
        clearcoatRoughness: 0.15,
        bumpMap: frost,
        bumpScale: 0.18,
        envMapIntensity: 0.6,
        clippingPlanes: [revealPlane],
        fog: false,
    });
    const sideOpts = { roughness: 0.18, thickness: 0.8, attenuation: 1.6, bump: 0.35, color: 0xd6e9f2 };
    let sideMat = iceMaterial(tier, frost, sideOpts);
    sideMat.clippingPlanes = [revealPlane];
    sideMat.fog = false;
    const seamMat = new THREE.LineBasicMaterial({ color: PALETTE.white, transparent: true, opacity: 0, fog: false });

    const group = new THREE.Group();
    group.position.copy(center);
    const shards = [];
    const impact = new THREE.Vector3(-TW / 2, -TH / 2 + 1.15, 0.1);
    const groundLocal = floorY - center.y;
    const e = new THREE.Euler();

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const a = pt[r][c], b = pt[r][c + 1], d = pt[r + 1][c], q = pt[r + 1][c + 1];
            const tris = rand() > 0.5 ? [[a, b, q], [a, q, d]] : [[a, b, d], [b, q, d]];
            for (const tri of tris) {
                const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
                const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
                const shape = new THREE.Shape(tri.map(([x, y]) => new THREE.Vector2(x, y)));
                const geo = new THREE.ExtrudeGeometry(shape, {
                    // No bevel: shards meet flush, so the intact block reads as one solid piece.
                    depth: DEPTH, bevelEnabled: false,
                });
                geo.translate(-cx, -cy, -DEPTH / 2);
                const mesh = new THREE.Mesh(geo, [faceMat, sideMat]);
                const rest = new THREE.Vector3(cx - TW / 2, cy - TH / 2, 0);
                mesh.position.copy(rest);
                const lineGeo = new THREE.BufferGeometry().setFromPoints(
                    tri.map(([x, y]) => new THREE.Vector3(x - cx, y - cy, DEPTH / 2 + 0.004)));
                mesh.add(new THREE.LineLoop(lineGeo, seamMat));
                group.add(mesh);

                // Intro: thrown toward the viewer.
                const dirIn = new THREE.Vector3(rest.x * 0.9 + (rand() - 0.5) * 2, rest.y * 0.9 + (rand() - 0.5) * 2, 1.2 + rand() * 2).normalize();
                e.set((rand() - 0.5) * 3.4, (rand() - 0.5) * 3.4, (rand() - 0.5) * 2.4);
                // Break: velocity away from the impact, stronger nearby, with some lift.
                const away = rest.clone().sub(impact);
                const dist = away.length();
                away.normalize();
                away.y += 0.35 + rand() * 0.5;
                away.z += (rand() - 0.2) * 0.9;
                const speed = Math.min(3.6, (1.6 + rand() * 1.8) * (1.3 / (0.7 + dist * 0.5)));
                shards.push({
                    mesh, geo, lineGeo, rest,
                    scatter: rest.clone().addScaledVector(dirIn, 2.6 + rand() * 3.2),
                    scatterQ: new THREE.Quaternion().setFromEuler(e),
                    order: Math.hypot(rest.x / TW, rest.y / TH) + rand() * 0.25,
                    layer: (rand() - 0.5) * 0.9,
                    vel: away.multiplyScalar(speed + 1.2),
                    spin: new THREE.Vector3((rand() - 0.5) * 9, (rand() - 0.5) * 9, (rand() - 0.5) * 9),
                    // Half the shard's thickness, so it rests on the floe instead of in it.
                    floor: groundLocal + 0.18 + rand() * 0.12,
                    lift: 0,
                    tilt: new THREE.Vector3(),
                });
            }
        }
    }
    const maxOrder = Math.max(...shards.map((s) => s.order));
    shards.forEach((s) => { s.order /= maxOrder; });

    // Intro blueprint: points at each shard centre joined to near neighbours.
    const bpPos = [], linePos = [];
    const near = Math.max(TW / cols, TH / rows) * 0.95;
    shards.forEach((s) => bpPos.push(s.rest.x, s.rest.y, DEPTH / 2));
    shards.forEach((a, i) => shards.forEach((b, j) => {
        if (j > i && a.rest.distanceTo(b.rest) < near) linePos.push(a.rest.x, a.rest.y, DEPTH / 2, b.rest.x, b.rest.y, DEPTH / 2);
    }));
    const bpGeo = new THREE.BufferGeometry();
    bpGeo.setAttribute('position', new THREE.Float32BufferAttribute(bpPos, 3));
    const bpMat = new THREE.PointsMaterial({ color: PALETTE.accent, size: 0.07, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const bpLineGeo = new THREE.BufferGeometry();
    bpLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    const bpLineMat = new THREE.LineBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0, depthWrite: false, fog: false });
    group.add(new THREE.Points(bpGeo, bpMat), new THREE.LineSegments(bpLineGeo, bpLineMat));

    // Ice dust burst at the moment of impact.
    const DUST = 220;
    const dustPos = new Float32Array(DUST * 3);
    const dustVel = [];
    for (let i = 0; i < DUST; i++) {
        dustVel.push(new THREE.Vector3(Math.abs(rand() - 0.2) * 3.5, rand() * 3.2, (rand() - 0.5) * 3));
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    group.add(dust);

    // Penguin lives in world space on the floe, beside the block.
    const penguin = createPenguin();
    const pGroup = new THREE.Group();
    pGroup.position.set(center.x, floorY, center.z + 0.1);
    pGroup.add(penguin.root);
    const leftFace = -TW / 2;
    const X_IDLE = leftFace - 0.95;

    const state = { points: 0, lines: 0, assemble: 0, reveal: 0, seams: 0.07 };
    const baseY = center.y;
    const bottomY = center.y - TH / 2 - 0.1, topY = center.y + TH / 2 + 0.2;
    const local = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -center.z);
    const smooth = (t) => t * t * (3 - 2 * t);
    const clamp01 = (t) => Math.min(1, Math.max(0, t));
    const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tmpQ = new THREE.Quaternion(), spinQ = new THREE.Quaternion(), axis = new THREE.Vector3();
    let clock = 0;
    let lastImpactCycle = -1;
    const listeners = [];

    // Shard time since impact (0 = intact), rewinding near the end of the cycle.
    function breakTime(t) {
        if (t < IMPACT_AT) return 0;
        if (t < REWIND_START) return Math.min(t - IMPACT_AT, FLIGHT);
        const k = ease(clamp01((t - REWIND_START) / (REWIND_END - REWIND_START)));
        return FLIGHT * (1 - k);
    }

    // Penguin pose for cycle time t: x along the block, height, yaw, pitch, flap, step.
    function penguinPose(t) {
        const p = { x: X_IDLE, y: 0, yaw: Math.PI / 2, pitch: 0, flap: 0.1, step: 0, sway: 0 };
        const lerp = (a, b, k) => a + (b - a) * k;
        if (t < 2.0) {
            // Idle: small waddle in place and a look toward the viewer.
            p.sway = Math.sin(t * 6) * 0.06;
            p.yaw = Math.PI / 2 - smooth(clamp01((t - 0.6) / 0.4)) * 0.9 + smooth(clamp01((t - 1.4) / 0.4)) * 0.9;
            p.flap = 0.1 + Math.max(0, Math.sin(t * 3)) * 0.15;
        } else if (t < 2.4) {
            // Shuffle back for a run-up.
            const k = smooth((t - 2.0) / 0.4);
            p.x = lerp(X_IDLE, X_IDLE - 0.7, k);
            p.step = Math.sin(t * 30) * 0.06;
            p.sway = Math.sin(t * 30) * 0.08;
            p.pitch = -0.15 * k;
        } else if (t < IMPACT_AT) {
            // Run and dive into the block, belly first.
            const k = (t - 2.4) / (IMPACT_AT - 2.4);
            p.x = lerp(X_IDLE - 0.7, leftFace - 0.45, k * k);
            p.y = Math.sin(k * Math.PI) * 0.55 + k * 0.3;
            p.pitch = lerp(-0.15, Math.PI / 2, smooth(k));
            p.flap = lerp(0.1, 1.3, k);
        } else if (t < 3.35) {
            // Carry through where the block was and belly-slide to a stop.
            const k = (t - IMPACT_AT) / (3.35 - IMPACT_AT);
            p.x = lerp(leftFace - 0.45, leftFace + 0.75, 1 - (1 - k) * (1 - k));
            p.y = Math.max(0, 0.3 * (1 - k * 1.6)) - 0.35 * smooth(k);
            p.pitch = Math.PI / 2;
            p.flap = 1.3 - k * 0.6;
        } else if (t < 3.75) {
            // Get up and shake off the ice.
            const k = smooth((t - 3.35) / 0.4);
            p.x = leftFace + 0.75;
            p.y = -0.35 * (1 - k);
            p.pitch = Math.PI / 2 * (1 - k);
            p.sway = Math.sin(t * 40) * 0.18 * k;
            p.flap = 0.7 + Math.sin(t * 40) * 0.4 * k;
        } else if (t < 4.55) {
            // Waddle back to its spot, facing away from the block.
            const k = (t - 3.75) / 0.8;
            p.x = lerp(leftFace + 0.75, X_IDLE, smooth(k));
            p.yaw = -Math.PI / 2;
            p.step = Math.sin(t * 22) * 0.05;
            p.sway = Math.sin(t * 22) * 0.1;
        } else {
            // Turn back to watch the block re-form.
            const k = smooth((t - 4.55) / 0.45);
            p.yaw = -Math.PI / 2 + Math.PI * k;
            p.sway = Math.sin(t * 8) * 0.03;
        }
        return p;
    }

    function update({ dt, elapsed, aboutW, ray, reduced, active }) {
        // Idle float of the block.
        group.position.y = baseY + (reduced ? 0 : Math.sin(elapsed * 0.7) * 0.02);
        group.updateMatrixWorld();
        revealPlane.constant = state.reveal >= 1 ? 1e3 : THREE.MathUtils.lerp(bottomY, topY, smooth(state.reveal));
        bpMat.opacity = state.points * 0.9;
        bpLineMat.opacity = state.points * 0.35;
        seamMat.opacity = THREE.MathUtils.lerp(state.seams, 0.9, state.lines);

        // The slam cycle runs only once the block is built, while the intro or about
        // view is on screen, and never with reduced motion.
        const canSlam = active && !reduced && state.assemble >= 1 && aboutW < 0.5;
        // Once a slam has started, the cycle always plays through so the block re-forms;
        // otherwise it waits at the start of a cycle.
        if (canSlam || clock % CYCLE >= IMPACT_AT) clock += dt;
        else clock = Math.floor(clock / CYCLE) * CYCLE;
        const t = clock % CYCLE;
        const cycle = Math.floor(clock / CYCLE);
        const bt = breakTime(t);
        if (canSlam && t >= IMPACT_AT && lastImpactCycle !== cycle) {
            lastImpactCycle = cycle;
            listeners.forEach((fn) => fn());
        }

        let hover = null;
        if (ray && bt === 0 && state.assemble >= 1 && ray.intersectPlane(plane, local)) hover = group.worldToLocal(local);

        shards.forEach((s) => {
            const a = THREE.MathUtils.clamp(state.assemble * 1.6 - s.order * 0.6, 0, 1);
            const k = ease(a);
            s.mesh.position.lerpVectors(s.scatter, s.rest, k);
            s.mesh.quaternion.slerpQuaternions(s.scatterQ, tmpQ.identity(), k);

            if (bt > 0) {
                // Ballistic flight from rest, stopping on the floe.
                s.mesh.position.addScaledVector(s.vel, bt);
                s.mesh.position.y -= 0.5 * GRAVITY * bt * bt;
                if (s.mesh.position.y < s.floor) s.mesh.position.y = s.floor;
                const ang = s.spin.length() * bt;
                spinQ.setFromAxisAngle(axis.copy(s.spin).normalize(), ang);
                s.mesh.quaternion.premultiply(spinQ);
            }

            // About view: shards separate into shallow layers.
            s.mesh.position.x += s.rest.x * 0.06 * aboutW;
            s.mesh.position.y += s.rest.y * 0.06 * aboutW;
            s.mesh.position.z += s.layer * aboutW;

            let target = 0;
            if (hover) {
                const dx = s.rest.x - hover.x, dy = s.rest.y - hover.y;
                target = 0.14 * Math.exp(-(dx * dx + dy * dy) / 0.32);
                s.tilt.set(dy, -dx, 0);
            }
            s.lift = reduced ? 0 : damp(s.lift, target, 7, dt);
            if (s.lift > 0.0005) {
                s.mesh.position.z += s.lift;
                if (s.tilt.lengthSq() > 0) s.mesh.rotateOnAxis(axis.copy(s.tilt).normalize(), s.lift * 0.9);
            }
        });

        // Dust: a quick burst from the impact point, fading as it falls.
        const dtDust = t - IMPACT_AT;
        const showDust = bt > 0 && dtDust > 0 && dtDust < 1.2;
        dust.visible = showDust;
        if (showDust) {
            const pos = dustGeo.attributes.position;
            dustVel.forEach((v, i) => {
                pos.setXYZ(i, impact.x + v.x * dtDust, impact.y + v.y * dtDust - 0.5 * GRAVITY * 0.5 * dtDust * dtDust, impact.z + v.z * dtDust);
            });
            pos.needsUpdate = true;
            dustMat.opacity = 0.9 * (1 - dtDust / 1.2);
        }

        // Penguin
        const p = penguinPose(t);
        const show = state.assemble >= 0.98;
        pGroup.visible = show;
        if (show) {
            penguin.root.position.set(p.x, p.y + Math.abs(p.step), 0);
            penguin.root.rotation.set(0, p.yaw, p.sway);
            penguin.pivot.rotation.x = p.pitch;
            penguin.flippers[0].rotation.z = -p.flap;
            penguin.flippers[1].rotation.z = p.flap;
            penguin.feet[0].position.y = -0.66 + Math.max(0, p.step) * 1.5;
            penguin.feet[1].position.y = -0.66 + Math.max(0, -p.step) * 1.5;
            // Fade in once after the intro.
            const appear = smooth(clamp01((state.assemble - 0.98) / 0.02));
            penguin.root.scale.setScalar(Math.max(0.001, appear));
        }
    }

    return {
        group,
        penguin: pGroup,
        state,
        height: TH,
        width: TW,
        update,
        onImpact(fn) { listeners.push(fn); },
        setVisible(v) { group.visible = v; pGroup.visible = v && pGroup.visible; },
        setTier(t) {
            const next = iceMaterial(t, frost, sideOpts);
            next.clippingPlanes = [revealPlane];
            next.fog = false;
            shards.forEach((s) => { s.mesh.material = [faceMat, next]; });
            sideMat.dispose();
            sideMat = next;
        },
        dispose() {
            shards.forEach((s) => { s.geo.dispose(); s.lineGeo.dispose(); });
            [faceMat, sideMat, seamMat, bpMat, bpLineMat, dustMat].forEach((m) => m.dispose());
            [bpGeo, bpLineGeo, dustGeo].forEach((g) => g.dispose());
            map.dispose();
            penguin.dispose();
        },
    };
}
