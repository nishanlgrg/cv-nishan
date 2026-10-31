// One persistent renderer + camera diving down an iceberg: puzzle portrait on the
// ice above the sea (intro) → skill ice blocks just under the surface → journey
// stations down the submerged mass → contact sculpture in the deep below its tip.
// The page feeds a float "stage" (key index + fraction); everything visual is sampled
// from it each frame, so scrolling backward or jumping is always consistent.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FrostShader } from './frost.js';
import { PALETTE, frostTexture, iceMaterial, createSkillBlocks, createStations } from './ice.js';
import { createIceCube } from './icecube.js';
import { createSculpture, createSnow } from './particles.js';
import { createOcean, bergRadius, BERG_TOP } from './ocean.js';

const FOG_ABOVE = 0.006;
const FOG_SHALLOW = 0.06;
const FOG_DEEP = 0.07;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const smooth = (t) => t * t * (3 - 2 * t);
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

export function pickTier() {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const cores = navigator.hardwareConcurrency || 8;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    return coarse || cores <= 4 || small ? 'low' : 'high';
}

export async function createWorld({ canvas, content, reducedMotion = false, quality = 'auto' }) {
    let tier = quality === 'auto' ? pickTier() : quality;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier === 'high', powerPreference: 'high-performance' });
    if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 unavailable');
    renderer.localClippingEnabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    const dprFor = (t) => Math.min(window.devicePixelRatio || 1, t === 'high' ? 1.5 : 1.25);
    let dpr = dprFor(tier);
    renderer.setPixelRatio(dpr);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color();
    scene.fog = new THREE.FogExp2(0xffffff, FOG_ABOVE);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(renderer), 0.05);
    scene.environment = envRT.texture;
    pmrem.dispose();

    // Lighting: broad cool sky, a key from above-behind-left, restrained fill, cool rim.
    const hemi = new THREE.HemisphereLight(PALETTE.frost, PALETTE.slate, 0.7);
    const key = new THREE.DirectionalLight(0xfff1e0, 2.4);
    key.position.set(-9, 14, 4);
    const fill = new THREE.DirectionalLight(PALETTE.pale, 0.35);
    fill.position.set(6, 2, 6);
    const rim = new THREE.DirectionalLight(PALETTE.accent, 1.0);
    rim.position.set(4, 7, -9);
    scene.add(hemi, key, fill, rim);
    const lightBase = [0.7, 2.2, 0.35, 1.0];

    const frost = frostTexture(256);

    /* ------------------------------------------------------------- Ocean + iceberg */
    const ocean = createOcean({ frost, tier });
    scene.add(ocean.group);

    /* ------------------------------------------------------------- Layout */
    // The portrait, frozen in a block of ice, stands on the front of the floe with
    // the penguin beside it. Photo is 3.75 units wide (25% larger than the puzzle was).
    const PHOTO_W = 3.75, MARGIN = 0.25;
    const cubeH = (PHOTO_W * content.photo.height) / content.photo.width + 2 * MARGIN;
    const base = new THREE.Vector3(1.6, BERG_TOP, 3.4);
    const SLAB_TOP = base.y + 0.26;
    const P = new THREE.Vector3(base.x, SLAB_TOP + cubeH / 2 + 0.01, base.z);
    // Journey stations spiral down the submerged mass, just outside its surface.
    const radial = (i) => 0.3 + i * 0.17;
    const stationPos = content.journey.map((_, i) => {
        const Y = -11 - i * 5.4;
        const r = bergRadius(Y) * 1.38 + 6;
        const a = radial(i);
        return new THREE.Vector3(Math.sin(a) * r + Math.sin(Y * 0.05) * 2.5, Y, Math.cos(a) * r + Math.cos(Y * 0.04) * 1.5 - 1.5);
    });
    // Contact: in the deep, below the iceberg's point.
    const C = new THREE.Vector3(0, -76, 8);

    // Ice slab under the portrait.
    const slabGeo = new RoundedBoxGeometry(8.2, 0.26, 2.6, 3, 0.1);
    const slabOpts = { roughness: 0.16, thickness: 0.5, color: 0xb7c9d6, attenuation: 0.9 };
    let slabMat = iceMaterial(tier, frost, slabOpts);
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.copy(base).add(new THREE.Vector3(-0.9, 0.13, 0));
    scene.add(slab);

    // Contact stage: platform and bright overhead ring.
    const stage = new THREE.Group();
    stage.position.copy(C);
    const platGeo = new THREE.CylinderGeometry(3.3, 3.6, 0.4, 72);
    const platMat = new THREE.MeshStandardMaterial({ color: PALETTE.slate, roughness: 0.55, metalness: 0.35 });
    const plat = new THREE.Mesh(platGeo, platMat);
    plat.position.y = 0.2;
    const ringGeo = new THREE.TorusGeometry(2.9, 0.035, 12, 160);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.6, 2.8), toneMapped: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 5.6;
    const floorRing = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.02, 8, 160), new THREE.MeshBasicMaterial({ color: PALETTE.accent, toneMapped: false }));
    floorRing.rotation.x = Math.PI / 2;
    floorRing.position.y = 0.42;
    const stageLight = new THREE.PointLight(PALETTE.accent, 30, 14, 2);
    stageLight.position.y = 6;
    stage.add(plat, ring, floorRing, stageLight);
    scene.add(stage);

    /* ------------------------------------------------------------- Subjects */
    const puzzle = await createIceCube({ photo: content.photo, tier, frost, width: PHOTO_W, margin: MARGIN, center: P, floorY: SLAB_TOP });
    scene.add(puzzle.group, puzzle.penguin);

    const skillBlocks = createSkillBlocks(content.skills, tier, frost);
    scene.add(skillBlocks.group);
    let skillEls = [];

    const stations = createStations(content.journey, stationPos, tier, frost);
    scene.add(stations.group);

    const PARTICLES = 20000;
    const sculpture = createSculpture({ count: PARTICLES, pixelRatio: dpr });
    sculpture.points.position.copy(C).add(new THREE.Vector3(0, 3.4, 0));
    scene.add(sculpture.points);

    // Rising particles in the water column.
    const snow = createSnow({ count: 2400, rise: true, box: new THREE.Box3(new THREE.Vector3(-28, -88, -24), new THREE.Vector3(30, -0.5, 34)) });
    scene.add(snow.points);

    /* ------------------------------------------------------------- Camera states */
    const KEY_NAMES = ['hero', 'about', 'skills', ...content.journey.map((_, i) => `s${i}`), 'contact'];
    const SKILLS = 2, FIRST_STATION = 3, CONTACT = KEY_NAMES.length - 1;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    function buildStates(narrow) {
        const st = [];
        const at = (x, y, z) => P.clone().add(V(x, y, z));
        st.push(narrow
            ? { pos: at(-0.8, 1.8, 23), look: at(-0.8, -3, 0) }
            : { pos: at(-3.4, 0.5, 11.5), look: at(-2.3, 0.05, 0) });
        st.push(narrow
            ? { pos: at(-4.4, 1.6, 20), look: at(-0.8, -2.2, 0) }
            : { pos: at(-6, 0.2, 9), look: at(-1.6, 0.05, 0) });
        // Skills: just under the surface, facing the iceberg wall.
        st.push(narrow
            ? { pos: V(5, -6.5, 36), look: V(-1, -10, 0) }
            : { pos: V(7, -5.5, 33), look: V(-4, -9.5, 0) });
        stationPos.forEach((S, i) => {
            const a = radial(i);
            const out = V(Math.sin(a), 0, Math.cos(a));
            const right = V(Math.cos(a), 0, -Math.sin(a));
            st.push(narrow
                ? { pos: S.clone().addScaledVector(out, 13).add(V(0, 2.2, 0)), look: S.clone().add(V(0, -1.6, 0)) }
                : { pos: S.clone().addScaledVector(out, 7.5).addScaledVector(right, -3.1).add(V(0, 0.8, 0)), look: S.clone().addScaledVector(right, -1.95).add(V(0, -0.1, 0)) });
        });
        const target = C.clone().add(V(0, 3.4, 0));
        st.push(narrow
            ? { pos: target.clone().add(V(0, 0.4, 19)), look: target.clone().add(V(0, -3.8, 0)) }
            : { pos: target.clone().add(V(-2.6, 0.9, 12.5)), look: target.clone().add(V(-2.6, -0.3, 0)) });
        return st;
    }
    // Frost strength for the transition that arrives at key i: full when entering a new
    // section (skills, first station, contact), lighter between stations, none in the intro.
    const arriving = KEY_NAMES.map((_, i) => (i <= 1 ? 0 : i === SKILLS || i === FIRST_STATION || i === CONTACT ? 1 : 0.4));

    let narrow = false;
    let states = buildStates(false);

    /* ------------------------------------------------------------- Post */
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const frostPass = new ShaderPass(FrostShader);
    composer.addPass(frostPass);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.28, 0.35, 1.5);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    /* ------------------------------------------------------------- Runtime */
    let width = 1, height = 1;
    let stageTarget = 0, stageNow = 0;
    const pointer = { x: 0, y: 0, sx: 0, sy: 0, active: false };
    const raycaster = new THREE.Raycaster();
    let activeSkill = -1, hoverSkill = -1;
    let contactPointer = 0;
    let running = false, rafId = 0, last = performance.now(), elapsed = 0;
    const frameHooks = [];
    const intro = { env: reducedMotion ? 1 : 0 };
    const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), fwd = new THREE.Vector3(), ndc = new THREE.Vector3();
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    const contactPlane = new THREE.Plane();
    let slowFrames = 0, sampled = 0, adaptive = quality === 'auto';

    function applyTier(t) {
        tier = t;
        dpr = dprFor(t);
        renderer.setPixelRatio(dpr);
        composer.setPixelRatio(dpr);
        bloomPass.enabled = t === 'high';
        sculpture.setCount(t === 'high' ? PARTICLES : 9000);
        snow.points.geometry.setDrawRange(0, t === 'high' ? 2400 : 900);
        sculpture.uniforms.uPixelRatio.value = dpr;
        snow.uniforms.uPixelRatio.value = dpr;
        resize();
    }

    function setMaterialsTier(t) {
        puzzle.setTier(t);
        skillBlocks.setTier(t);
        stations.setTier(t);
        slabMat.dispose();
        slabMat = iceMaterial(t, frost, slabOpts);
        slab.material = slabMat;
    }

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        renderer.setSize(width, height, false);
        composer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        narrow = width / height < 0.8 || width < 760;
        states = buildStates(narrow);
        frostPass.uniforms.uAspect.value = width / height;
        frostPass.uniforms.uPx.value.set(1 / (width * dpr), 1 / (height * dpr));
    }

    function screenToWorld(x, y, dist, out) {
        ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
        camera.getWorldDirection(fwd);
        return out.copy(camera.position).addScaledVector(ndc, dist / ndc.dot(fwd));
    }
    const worldPerPx = (dist) => (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / height;
    const weightNear = (k, span) => smooth(clamp(1 - Math.abs(stageNow - k) / span, 0, 1));

    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (!reducedMotion) elapsed += dt;

        // One smoothing stage on the scroll-derived value. Reduced motion jumps
        // directly to the nearest section state instead of travelling.
        stageNow = reducedMotion ? Math.round(stageTarget) : damp(stageNow, stageTarget, 4, dt);
        const n = states.length;
        const i0 = clamp(Math.floor(stageNow), 0, n - 1);
        const i1 = Math.min(i0 + 1, n - 1);
        const raw = clamp(stageNow - i0, 0, 1);
        const f = smooth(clamp((raw - 0.15) / 0.7, 0, 1)); // holds at both ends
        const hold = 1 - Math.min(1, Math.abs(stageNow - Math.round(stageNow)) * 2.5);

        // Camera: move position and aim together; parallax applied after aiming.
        camPos.lerpVectors(states[i0].pos, states[i1].pos, f);
        camLook.lerpVectors(states[i0].look, states[i1].look, f);
        // Bow travel outward from the berg between distant keys so the path clears the ice.
        camPos.y += Math.sin(f * Math.PI) * (i0 >= SKILLS ? 0.6 : 0.3);
        if (i0 >= SKILLS) {
            tmp.set(camPos.x, 0, camPos.z).normalize();
            camPos.addScaledVector(tmp, Math.sin(f * Math.PI) * 2.5);
        }
        camera.position.copy(camPos);
        camera.lookAt(camLook);
        pointer.sx = damp(pointer.sx, pointer.x, 5, dt);
        pointer.sy = damp(pointer.sy, pointer.y, 5, dt);
        if (!reducedMotion) {
            const k = 0.4 + 0.6 * hold;
            camera.rotateY(-pointer.sx * THREE.MathUtils.degToRad(1.8) * k);
            camera.rotateX(pointer.sy * THREE.MathUtils.degToRad(1.2) * k);
        }
        camera.updateMatrixWorld();
        camera.getWorldDirection(fwd);

        // Environment: sky and sea emerge from haze during the intro; fog, background
        // and light follow the camera above or below the water line.
        const env = intro.env;
        const { under, depth } = ocean.update({ elapsed, camera, env });
        scene.fog.color.copy(ocean.fogColor);
        scene.background.copy(ocean.fogColor);
        const density = lerp(FOG_ABOVE, lerp(FOG_SHALLOW, FOG_DEEP, depth), under);
        scene.fog.density = lerp(0.2, density, smooth(env));
        // Underwater, direct sun and sky light fade with depth.
        const sunlight = 1 - under * (0.55 + 0.4 * depth);
        [hemi, key, fill, rim].forEach((l, i) => { l.intensity = lightBase[i] * (0.25 + 0.75 * env) * (i <= 1 ? sunlight : 1); });
        snow.uniforms.uOpacity.value = env * under;
        snow.uniforms.uTime.value = elapsed;
        slab.visible = stageNow < SKILLS + 0.5;

        // Puzzle portrait
        puzzle.group.visible = stageNow < SKILLS + 0.6;
        puzzle.penguin.visible = puzzle.group.visible && puzzle.penguin.visible;
        if (puzzle.group.visible) {
            let ray = null;
            if (pointer.active && hold > 0.8 && stageNow < 1.5) {
                raycaster.setFromCamera({ x: pointer.x, y: pointer.y }, camera);
                ray = raycaster.ray;
            }
            puzzle.update({ dt, elapsed, aboutW: weightNear(1, 0.9), ray, reduced: reducedMotion, active: stageNow < 0.6 });
        }

        // Skill ice blocks, aligned to their HTML buttons.
        const skillsW = weightNear(SKILLS, 0.85);
        skillBlocks.group.visible = skillsW > 0.002 && skillEls.length > 0;
        if (skillBlocks.group.visible) {
            const dist = 6;
            const k = worldPerPx(dist);
            skillBlocks.blocks.forEach((b, i) => {
                const rect = skillEls[i].getBoundingClientRect();
                const on = rect.bottom > -40 && rect.top < height + 40;
                b.holder.visible = on;
                if (!on) return;
                const isActive = i === activeSkill, isHover = i === hoverSkill;
                b.lift = reducedMotion ? +isActive : damp(b.lift, isActive ? 1 : isHover ? 0.6 : 0, 8, dt);
                b.glow = reducedMotion ? +isActive : damp(b.glow, isActive ? 1 : isHover ? 0.5 : 0, 8, dt);
                const cx = rect.left + rect.width / 2, cy = rect.top + rect.height * 0.42;
                // Blocks arrive from depth as the section settles; the active one moves forward.
                screenToWorld(cx, cy, dist + (1 - skillsW) * 7 - b.lift * 0.3, tmp);
                b.holder.position.copy(tmp);
                b.holder.quaternion.copy(camera.quaternion);
                const scatter = 1 - skillsW;
                b.holder.rotateX(Math.sin(elapsed * 0.5 + b.seed) * 0.08 - pointer.sy * 0.2 + scatter * Math.cos(b.seed) * 1.4);
                b.holder.rotateY(Math.sin(elapsed * 0.4 + b.seed) * 0.12 + pointer.sx * 0.25 + b.lift * 0.35 + scatter * Math.sin(b.seed) * 1.4);
                const s = Math.min(rect.width, rect.height * 0.7) * k * (0.62 + b.lift * 0.08) * (0.4 + 0.6 * skillsW);
                b.holder.scale.setScalar(s);
                b.edgeMat.opacity = 0.3 + b.glow * 0.7;
                b.iconMat.color.copy(b.tint).multiplyScalar(1.6 + b.glow * 1.6);
            });
        }

        // Journey stations
        stations.update(elapsed, camera);

        // Contact sculpture
        const contactW = weightNear(CONTACT, 1.4);
        sculpture.points.visible = contactW > 0.002;
        if (sculpture.points.visible) {
            sculpture.update(dt, elapsed, reducedMotion);
            sculpture.uniforms.uOpacity.value = contactW;
            let target = 0;
            if (pointer.active && !reducedMotion) {
                raycaster.setFromCamera({ x: pointer.x, y: pointer.y }, camera);
                tmp2.copy(sculpture.points.position);
                contactPlane.setFromNormalAndCoplanarPoint(tmp.copy(fwd).negate(), tmp2);
                if (raycaster.ray.intersectPlane(contactPlane, tmp)) {
                    sculpture.uniforms.uPointer.value.copy(tmp).sub(sculpture.points.position);
                    target = 1;
                }
            }
            contactPointer = damp(contactPointer, target, target ? 6 : 1.6, dt);
            sculpture.uniforms.uPointerAmt.value = contactPointer;
        }
        ring.material.color.setScalar(2.2 + Math.sin(elapsed * 0.8) * 0.25);

        // Frost transition, sampled from progress.
        const fstrength = reducedMotion || i1 === i0 ? 0 : Math.sin(f * Math.PI) * arriving[i1];
        frostPass.uniforms.uStrength.value = fstrength;
        frostPass.uniforms.uProgress.value = f;
        frostPass.uniforms.uTime.value = elapsed;

        composer.render(dt);

        frameHooks.forEach((fn) => fn({ stage: stageNow, hold }));

        // Adaptive quality: sustained slow frames on "auto" step the tier down once.
        if (adaptive && tier === 'high' && intro.env >= 1) {
            sampled++;
            if (dt > 1 / 34) slowFrames++;
            if (sampled >= 150) {
                if (slowFrames > 100) {
                    applyTier('low');
                    setMaterialsTier('low');
                    adaptive = false;
                }
                sampled = slowFrames = 0;
            }
        }
    }

    function loop(now) {
        rafId = requestAnimationFrame(loop);
        frame(now);
    }

    const onLost = (e) => {
        e.preventDefault();
        stop();
        canvas.dispatchEvent(new CustomEvent('world-lost'));
    };
    canvas.addEventListener('webglcontextlost', onLost);

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

    applyTier(tier);
    resize();
    camera.position.copy(states[0].pos);
    camera.lookAt(states[0].look);
    // Prepare shaders up front to reduce first-use stalls (not a guarantee for later variants).
    if (renderer.compileAsync) {
        await Promise.race([renderer.compileAsync(scene, camera), new Promise((r) => setTimeout(r, 2500))]);
    }

    return {
        keyNames: KEY_NAMES,
        intro,
        puzzleState: puzzle.state,
        setStage(v) { stageTarget = v; },
        setPointer(x, y, active = true) { pointer.x = x; pointer.y = y; pointer.active = active; },
        setSkillElements(els) { skillEls = els; },
        setActiveSkill(i) { activeSkill = i; },
        setHoverSkill(i) { hoverSkill = i; },
        setContactShape(key) { sculpture.setShape(key); },
        projectStation(i) {
            const s = stations.stations[i];
            if (!s) return null;
            s.holder.getWorldPosition(tmp).project(camera);
            return { x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height, visible: tmp.z < 1 && tmp.z > -1 };
        },
        onFrame(fn) { frameHooks.push(fn); },
        onSlam(fn) { puzzle.onImpact(fn); },
        getTier: () => tier,
        setQuality(q) {
            adaptive = q === 'auto';
            const t = q === 'auto' ? pickTier() : q;
            if (t !== tier) setMaterialsTier(t);
            applyTier(t);
        },
        resize,
        start,
        stop,
        dispose() {
            stop();
            canvas.removeEventListener('webglcontextlost', onLost);
            puzzle.dispose();
            skillBlocks.dispose();
            stations.dispose();
            sculpture.dispose();
            snow.dispose();
            ocean.dispose();
            [slabGeo, platGeo, ringGeo, floorRing.geometry].forEach((g) => g.dispose());
            [slabMat, platMat, ringMat, floorRing.material].forEach((m) => m.dispose());
            frost.dispose();
            envRT.dispose();
            composer.dispose?.();
            renderer.dispose();
        },
    };
}
