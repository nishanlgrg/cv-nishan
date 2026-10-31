// Page controller: navigation, content interactions, GSAP choreography and the 3D scene.
// Everything readable lives in HTML; this file only enhances it.

const root = document.documentElement;
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const hasGsap = Boolean(gsap && ScrollTrigger);
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduced = reducedQuery.matches;
const motion = hasGsap && !reduced;

window.__ngReady = true;
if (motion) {
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('motion');
} else {
    root.classList.remove('js'); // nothing will animate the intro, so show it as-is
}

const cleanups = [];
const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
};

let scene = null;

/* ------------------------------------------------------------------ Header & nav */

const header = document.querySelector('.site-header');
const nav = document.getElementById('site-nav');
const toggle = document.querySelector('.nav-toggle');

function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.nav-toggle-label').textContent = open ? 'Close' : 'Menu';
    nav.classList.toggle('is-open', open);
}
listen(toggle, 'click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
listen(nav, 'click', (e) => { if (e.target.closest('a')) setMenu(false); });
listen(document, 'keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenu(false);
        toggle.focus();
    }
});
listen(window, 'resize', () => { if (window.innerWidth > 860) setMenu(false); });

const onScrollHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
listen(window, 'scroll', onScrollHeader, { passive: true });
onScrollHeader();

// Mark the nav link for the section currently in view.
const navLinks = [...nav.querySelectorAll('a[href^="#"]')];
const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => {
            if (a.getAttribute('href') === `#${entry.target.id}`) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
        });
    });
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main section[id]').forEach((s) => sectionObserver.observe(s));
cleanups.push(() => sectionObserver.disconnect());

/* ------------------------------------------------------------------ Skills */

const skillButtons = [...document.querySelectorAll('.skill')];
const skillSources = document.querySelector('.skill-sources');
const sourceItems = [...skillSources.querySelectorAll('li')];
const detail = {
    cat: document.querySelector('.skill-detail-cat'),
    title: document.querySelector('.skill-detail-title'),
    text: document.querySelector('.skill-detail-text'),
};
skillSources.hidden = true;

function selectSkill(i) {
    skillButtons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    const src = sourceItems[i];
    detail.cat.textContent = src.dataset.catLabel;
    detail.title.textContent = skillButtons[i].querySelector('.skill-name').textContent;
    detail.text.textContent = src.querySelector('span').textContent;
    if (motion) gsap.fromTo([detail.title, detail.text], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power2.out' });
    scene?.setActiveSkill(i);
}

skillButtons.forEach((btn, i) => {
    listen(btn, 'click', () => selectSkill(i));
    listen(btn, 'pointerenter', () => scene?.setHoverSkill(i));
    listen(btn, 'pointerleave', () => scene?.setHoverSkill(-1));
    listen(btn, 'focus', () => scene?.setHoverSkill(i));
    listen(btn, 'blur', () => scene?.setHoverSkill(-1));
    // Arrow keys move between tiles in grid order.
    listen(btn, 'keydown', (e) => {
        const cols = getComputedStyle(btn.closest('.skill-grid')).gridTemplateColumns.split(' ').length;
        const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
        if (step === undefined) return;
        const next = skillButtons[i + step];
        if (next) {
            e.preventDefault();
            next.focus();
        }
    });
});
selectSkill(0);

/* ------------------------------------------------------------------ Gallery → detail */

const cards = [...document.querySelectorAll('.card')];
const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function goToSection(id) {
    const target = document.getElementById(id);
    if (!target) return;
    history.pushState(null, '', `#${id}`);
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    const heading = target.querySelector('h2');
    if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
    }
}

cards.forEach((card) => {
    listen(card, 'click', (e) => {
        if (!motion || e.metaKey || e.ctrlKey || e.shiftKey) return; // native anchor behaviour
        e.preventDefault();
        const others = cards.filter((c) => c !== card);
        scene?.pulse();
        gsap.timeline({
            onComplete: () => {
                goToSection(card.dataset.target);
                gsap.to(cards, { opacity: 1, scale: 1, z: 0, duration: 0.6, delay: 0.5, clearProps: 'scale', ease: 'power2.out' });
            },
        })
            .to(others, { opacity: 0.25, scale: 0.94, z: -120, duration: 0.45, ease: 'power3.out' }, 0)
            .to(card, { scale: 1.05, z: 120, rotationX: 0, rotationY: 0, duration: 0.45, ease: 'power3.out' }, 0);
    });

    if (motion && fineHover) {
        const rx = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power3.out' });
        const ry = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power3.out' });
        listen(card, 'pointermove', (e) => {
            const r = card.getBoundingClientRect();
            ry(((e.clientX - r.left) / r.width - 0.5) * 12);
            rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
        });
        listen(card, 'pointerleave', () => { rx(0); ry(0); });
    }
});

/* ------------------------------------------------------------------ Scroll choreography */

const sceneSections = [...document.querySelectorAll('[data-scene]')];
const stageProgress = new Array(sceneSections.length).fill(0);
const pushStage = () => scene?.setStage(stageProgress.reduce((a, b) => a + b, 0));

if (hasGsap) {
    // Stage i blends in as section i rises from 85% to 20% of the viewport.
    sceneSections.forEach((section, i) => {
        if (i === 0) return;
        ScrollTrigger.create({
            trigger: section,
            start: 'top 85%',
            end: 'top 20%',
            onUpdate: (self) => { stageProgress[i] = self.progress; pushStage(); },
            onRefresh: (self) => { stageProgress[i] = self.progress; pushStage(); },
        });
    });
} else {
    const update = () => {
        const vh = window.innerHeight;
        sceneSections.forEach((section, i) => {
            if (i === 0) return;
            const top = section.getBoundingClientRect().top;
            stageProgress[i] = Math.min(1, Math.max(0, (vh * 0.85 - top) / (vh * 0.65)));
        });
        pushStage();
    };
    listen(window, 'scroll', update, { passive: true });
    listen(window, 'resize', update);
    update();
}

if (motion) {
    // Short, readable reveal groups.
    const reveal = (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out', overwrite: true });
    ScrollTrigger.batch('[data-reveal]', {
        start: 'top 88%',
        once: true,
        onEnter: reveal,
        onEnterBack: reveal,
    });

    // Gallery cards rise out of depth as the section arrives.
    gsap.fromTo(cards,
        { z: -320, y: 80, opacity: 0, rotationY: (i) => (i - 1.5) * -10 },
        {
            z: 0, y: 0, opacity: 1, rotationY: 0, ease: 'none', stagger: 0.12,
            scrollTrigger: { trigger: '.gallery', start: 'top 95%', end: 'top 45%', scrub: 0.6 },
        });

    // Timeline rail draws with scroll; entries slide in.
    const timeline = document.querySelector('.timeline');
    ScrollTrigger.create({
        trigger: timeline,
        start: 'top 72%',
        end: 'bottom 72%',
        onUpdate: (self) => timeline.style.setProperty('--progress', self.progress.toFixed(4)),
        onRefresh: (self) => timeline.style.setProperty('--progress', self.progress.toFixed(4)),
    });
    gsap.utils.toArray('.tl-item').forEach((item) => {
        // The dot stays put (the 3D node and rail are aligned to it); only the text slides in.
        gsap.from([...item.children].filter((el) => !el.classList.contains('tl-dot')), {
            opacity: 0, x: -24, duration: 0.8, stagger: 0.05, ease: 'power3.out',
            scrollTrigger: { trigger: item, start: 'top 84%', once: true },
        });
    });
}

/* ------------------------------------------------------------------ Intro */

function playIntro() {
    if (!motion) {
        if (scene) scene.intro.value = 1;
        return;
    }
    const lines = document.querySelectorAll('[data-intro-line]');
    const intro = document.querySelectorAll('[data-intro]');
    const tl = gsap.timeline({
        defaults: { ease: 'expo.out' },
        onComplete: () => gsap.set([lines, intro], { clearProps: 'transform' }),
    });
    gsap.set(lines, { yPercent: 105, y: 0 });
    gsap.set(intro, { y: 18, opacity: 0 });
    tl.to(lines, { yPercent: 0, duration: 1.3, stagger: 0.1 }, 0.1)
        .to(intro, { opacity: 1, y: 0, duration: 1, stagger: 0.08 }, 0.35);
    // The monogram enters with the name; if the scene is still loading it joins when ready.
    if (scene) tl.to(scene.intro, { value: 1, duration: 2.2, ease: 'power3.out' }, 0);
    root.classList.remove('js');
    return tl;
}

/* ------------------------------------------------------------------ Scene */

function webglAvailable() {
    try {
        const c = document.createElement('canvas');
        return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch {
        return false;
    }
}

async function loadScene() {
    if (!webglAvailable()) throw new Error('no webgl');
    const { createScene } = await import('./scene.js');
    const s = createScene(document.getElementById('scene'), { reducedMotion: reduced });
    s.setSkillElements(skillButtons);
    s.setTimelineElements([...document.querySelectorAll('.tl-dot')]);
    return s;
}

function attachScene(s) {
    scene = s;
    root.classList.add('webgl');
    scene.setActiveSkill(skillButtons.findIndex((b) => b.getAttribute('aria-pressed') === 'true'));
    pushStage();
    scene.start();

    if (!reduced && window.matchMedia('(pointer: fine)').matches) {
        listen(window, 'pointermove', (e) => {
            scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
        }, { passive: true });
    }
    listen(window, 'resize', () => scene.resize());
    listen(window, 'scroll', () => scene.invalidate(), { passive: true });
    listen(document, 'visibilitychange', () => (document.hidden ? scene.stop() : scene.start()));
}

const scenePromise = loadScene().catch(() => {
    root.classList.add('no-webgl');
    return null;
});

// Don't hold content back for the 3D: start the intro after at most ~450 ms.
const timeout = new Promise((r) => setTimeout(() => r('timeout'), 450));
Promise.race([scenePromise, timeout]).then((result) => {
    if (result && result !== 'timeout') attachScene(result);
    playIntro();
    if (result === 'timeout') {
        scenePromise.then((s) => {
            if (!s) return;
            attachScene(s);
            if (motion) gsap.to(s.intro, { value: 1, duration: 1.8, ease: 'power3.out' });
            else s.intro.value = 1;
        });
    }
    if (hasGsap) ScrollTrigger.refresh();
});

/* ------------------------------------------------------------------ Cleanup */

listen(window, 'pageshow', (e) => { if (e.persisted) scene?.start(); });
window.addEventListener('pagehide', (e) => {
    if (e.persisted) {
        scene?.stop();
        return;
    }
    cleanups.forEach((fn) => fn());
    if (hasGsap) ScrollTrigger.getAll().forEach((t) => t.kill());
    scene?.dispose();
});
