// Page controller: builds the DOM from content.js, runs the intro, maps native scroll
// to the world's stage, and wires navigation, skills, contact previews and controls.
import { content } from './content.js';
import { createAudio } from './audio.js';

const root = document.documentElement;
const gsap = window.gsap;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const motion = Boolean(gsap) && !reduced;
const cleanups = [];
const listen = (t, type, fn, opts) => { t.addEventListener(type, fn, opts); cleanups.push(() => t.removeEventListener(type, fn, opts)); };

/* ------------------------------------------------------------------ DOM helpers */

function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => c != null && el.append(c));
    return el;
}
// Screen readers get the final text; the scrambling copy is decorative.
function scrambleText(tag, text, attrs = {}) {
    return h(tag, { ...attrs, 'data-scramble': text },
        h('span', { class: 'sr-only', text }),
        h('span', { class: 'scr', 'aria-hidden': 'true', text }));
}
const svgIcon = (markup) => h('span', { class: 'icon', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24">${markup}</svg>` });

/* ------------------------------------------------------------------ Build page */

document.title = content.meta.title;
const main = document.getElementById('main');
const sectionLabel = Object.fromEntries(content.sections.map((s) => [s.id, s]));
const indexLabel = (id) => scrambleText('p', `${sectionLabel[id].index} — ${sectionLabel[id].label}`, { class: 'index' });

// 01 Intro
const hero = h('div', { class: 'panel hero', 'data-key': 'hero' },
    h('p', { class: 'eyebrow', 'data-intro': '', text: content.intro.eyebrow }),
    h('h1', { class: 'name', 'data-intro': '', text: content.name }),
    h('p', { class: 'lede', 'data-intro': '', text: content.intro.headline }),
    h('div', { class: 'actions', 'data-intro': '' },
        h('a', { class: 'btn btn-solid', href: content.cv.href, download: content.cv.filename }, content.cv.label, h('span', { class: 'tag', text: 'PDF' })),
        h('a', { class: 'btn btn-line', href: '#journey', text: 'View journey' })),
    h('dl', { class: 'facts', 'data-intro': '' },
        content.intro.facts.map((f) => h('div', {}, h('dt', { text: f.label }), h('dd', { text: f.value })))),
    h('figure', { class: 'fallback-photo' }, h('img', { src: content.photo.src, alt: content.photo.alt, width: content.photo.width, height: content.photo.height })));
const about = h('div', { class: 'panel about glass', 'data-key': 'about' },
    scrambleText('h2', content.intro.aboutTitle, { class: 'title' }),
    content.intro.about.map((p) => h('p', { class: 'reveal', text: p })));
main.append(h('section', { id: 'intro', class: 'sec sec-intro', 'aria-labelledby': 'intro-name' }, hero, about));
hero.querySelector('h1').id = 'intro-name';

// 02 Skills
const skillButtons = content.skills.map((s, i) =>
    h('li', {}, h('button', { class: 'skill', type: 'button', 'data-cat': s.cat, 'aria-pressed': 'false', 'aria-controls': 'skill-detail', 'data-i': i },
        svgIcon(s.icon), h('span', { class: 'skill-name', text: s.name }))));
const detail = h('div', { id: 'skill-detail', class: 'skill-detail', 'aria-live': 'polite' },
    h('p', { class: 'cat' }), h('h3', { class: 'skill-title' }), h('p', { class: 'skill-note' }));
main.append(h('section', { id: 'skills', class: 'sec sec-skills', 'aria-labelledby': 'skills-title' },
    h('div', { class: 'panel', 'data-key': 'skills' },
        indexLabel('skills'),
        scrambleText('h2', content.skillsIntro.title, { class: 'title', id: 'skills-title' }),
        h('p', { class: 'sub', text: content.skillsIntro.sub }),
        h('div', { class: 'skills-layout' },
            h('ul', { class: 'skill-grid', role: 'list' }, skillButtons),
            h('div', { class: 'skill-side glass' }, detail,
                h('ul', { class: 'legend', 'aria-label': 'Skill categories' },
                    Object.entries(content.skillCategories).map(([k, v]) => h('li', { 'data-cat': k, text: v }))),
                h('p', { class: 'interests' }, h('span', { text: 'Exploring next' }), content.skillsIntro.interests))))));

// 03 Journey
const stationItems = content.journey.map((e, i) =>
    h('li', { class: 'station', 'data-key': `s${i}`, 'data-kind': e.kind },
        h('article', { class: 'card glass' },
            h('p', { class: 'card-meta' }, h('span', { class: 'kind', text: e.kind }), h('span', { class: 'date', text: e.date })),
            h('h3', { class: 'card-title', text: e.title }),
            h('p', { class: 'org', text: e.org }),
            e.text ? h('p', { class: 'text', text: e.text }) : null,
            e.list ? h('ul', { class: 'list' }, e.list.map((t) => h('li', { text: t }))) : null)));
main.append(h('section', { id: 'journey', class: 'sec sec-journey', 'aria-labelledby': 'journey-title' },
    h('header', { class: 'panel journey-head' },
        indexLabel('journey'),
        scrambleText('h2', content.journeyIntro.title, { class: 'title', id: 'journey-title' }),
        h('p', { class: 'sub', text: content.journeyIntro.sub })),
    h('ol', { class: 'stations' }, stationItems)));

// 04 Contact
const contactItems = content.contacts.map((c) =>
    h('li', { 'data-shape': c.shape },
        h('span', { class: 'label', text: c.label }),
        c.href ? h('a', { href: c.href, download: c.download, text: c.value }) : h('span', { class: 'value', tabindex: '0', text: c.value })));
main.append(h('section', { id: 'contact', class: 'sec sec-contact', 'aria-labelledby': 'contact-title' },
    h('div', { class: 'panel', 'data-key': 'contact' },
        indexLabel('contact'),
        scrambleText('h2', content.contactIntro.title, { class: 'title big', id: 'contact-title' }),
        h('p', { class: 'sub', text: content.contactIntro.sub }),
        h('ul', { class: 'contacts' }, contactItems)),
    h('footer', { class: 'foot' }, h('p', { text: `© 2026 ${content.name}` }), h('a', { href: 'classic/', text: 'Standard version' }), h('a', { href: '#intro', text: 'Back to top ↑' }))));

// Navigation
const navList = document.querySelector('#nav ul');
content.sections.forEach((s) => navList.append(h('li', {}, h('a', { href: `#${s.id}` }, h('span', { class: 'n', text: s.index }), s.label))));
navList.append(h('li', {}, h('a', { class: 'nav-cv', href: content.cv.href, download: content.cv.filename, text: 'CV' })));
document.querySelector('.readout-total').textContent = String(content.sections.length).padStart(2, '0');

/* ------------------------------------------------------------------ Menu */

const menuBtn = document.querySelector('.menu-btn');
const nav = document.getElementById('nav');
const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
    nav.classList.toggle('open', open);
};
listen(menuBtn, 'click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
listen(nav, 'click', (e) => { if (e.target.closest('a')) setMenu(false); });
listen(document, 'keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });

/* ------------------------------------------------------------------ Scramble */

const GLYPHS = '░▒▓<>/\\=+*#ABCDEFGHJKLMNPRSTUVXYZ0123456789';
function scramble(el) {
    const target = el.dataset.scramble;
    const span = el.querySelector('.scr');
    if (!motion) return;
    const start = performance.now();
    const dur = 320;
    const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        span.textContent = target.split('').map((ch, i) =>
            ch === ' ' || i < p * target.length ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join('');
        if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}
const scrambleObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) scramble(e.target); });
}, { threshold: 0.8 });
document.querySelectorAll('[data-scramble]').forEach((el) => scrambleObserver.observe(el));
cleanups.push(() => scrambleObserver.disconnect());

if (motion && window.ScrollTrigger) {
    gsap.registerPlugin(window.ScrollTrigger);
    root.classList.add('motion');
    const reveal = (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out', overwrite: true });
    window.ScrollTrigger.batch('.reveal, .card, .contacts li', { start: 'top 90%', onEnter: reveal, onEnterBack: reveal });
}

/* ------------------------------------------------------------------ Skills */

const buttons = [...document.querySelectorAll('.skill')];
let world = null;
function selectSkill(i) {
    buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    const s = content.skills[i];
    detail.querySelector('.cat').textContent = content.skillCategories[s.cat];
    detail.querySelector('.skill-title').textContent = s.name;
    detail.querySelector('.skill-note').textContent = s.note;
    if (motion) gsap.fromTo(detail.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.04, ease: 'power2.out' });
    world?.setActiveSkill(i);
}
buttons.forEach((b, i) => {
    listen(b, 'click', () => selectSkill(i));
    listen(b, 'pointerenter', () => world?.setHoverSkill(i));
    listen(b, 'pointerleave', () => world?.setHoverSkill(-1));
    listen(b, 'focus', () => world?.setHoverSkill(i));
    listen(b, 'blur', () => world?.setHoverSkill(-1));
    listen(b, 'keydown', (e) => {
        const cols = getComputedStyle(b.closest('.skill-grid')).gridTemplateColumns.split(' ').length;
        const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
        if (step && buttons[i + step]) { e.preventDefault(); buttons[i + step].focus(); }
    });
});
selectSkill(0);

/* ------------------------------------------------------------------ Contact previews */

let shapeTimer = 0;
document.querySelectorAll('.contacts li').forEach((li) => {
    const preview = () => { clearTimeout(shapeTimer); world?.setContactShape(li.dataset.shape); };
    const reset = () => { clearTimeout(shapeTimer); shapeTimer = setTimeout(() => world?.setContactShape('ng'), 900); };
    listen(li, 'pointerenter', preview);
    listen(li, 'pointerleave', reset);
    listen(li, 'focusin', preview);
    listen(li, 'focusout', reset);
});

/* ------------------------------------------------------------------ Scroll → stage */

const keyEls = [...document.querySelectorAll('[data-key]')];
let stage = 0;
function computeStage() {
    const vc = window.innerHeight / 2;
    const centers = keyEls.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; });
    if (vc <= centers[0]) stage = 0;
    else if (vc >= centers[centers.length - 1]) stage = centers.length - 1;
    else {
        for (let k = 0; k < centers.length - 1; k++) {
            if (vc >= centers[k] && vc < centers[k + 1]) { stage = k + (vc - centers[k]) / (centers[k + 1] - centers[k]); break; }
        }
    }
    world?.setStage(stage);
}
listen(window, 'scroll', computeStage, { passive: true });
listen(window, 'resize', computeStage);

// Current section: nav state, readout, and a soft sound cue on change.
const sectionOfKey = (k) => (k <= 1 ? 'intro' : k === 2 ? 'skills' : k === keyEls.length - 1 ? 'contact' : 'journey');
const navLinks = [...nav.querySelectorAll('a[href^="#"]')];
let currentSection = '';
const audio = createAudio();
function updateSection(k) {
    const id = sectionOfKey(k);
    if (id === currentSection) return;
    if (currentSection) audio.whoosh();
    currentSection = id;
    navLinks.forEach((a) => (a.getAttribute('href') === `#${id}` ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    document.querySelector('.readout-index').textContent = sectionLabel[id].index;
    document.querySelector('.readout-label').textContent = sectionLabel[id].label;
}
listen(window, 'scroll', () => updateSection(Math.round(stage)), { passive: true });
updateSection(0);

/* ------------------------------------------------------------------ Controls */

// On narrow screens the controls live in the menu instead of over the content.
const controlsEl = document.querySelector('.controls');
const hudBottom = document.querySelector('.hud-bottom');
const narrowMq = window.matchMedia('(max-width: 760px)');
// Skip intro stays on screen at every size.
hudBottom.append(document.querySelector('[data-ctl="skip"]'));
const placeControls = () => (narrowMq.matches ? nav.append(controlsEl) : hudBottom.append(controlsEl));
narrowMq.addEventListener('change', placeControls);
cleanups.push(() => narrowMq.removeEventListener('change', placeControls));
placeControls();

const ctl = (name) => document.querySelector(`[data-ctl="${name}"]`);
listen(ctl('sound'), 'click', async () => {
    const on = await audio.toggle();
    ctl('sound').setAttribute('aria-pressed', String(on));
    ctl('sound').textContent = `Sound · ${on ? 'On' : 'Off'}`;
});
const QUALITIES = ['auto', 'low', 'high'];
let quality = 'auto';
try { quality = localStorage.getItem('ng-quality') || 'auto'; } catch { /* storage unavailable */ }
const setQualityLabel = () => {
    const label = quality[0].toUpperCase() + quality.slice(1);
    ctl('quality').textContent = `Quality · ${label}`;
    ctl('quality').setAttribute('aria-label', `Graphics quality: ${label}`);
};
setQualityLabel();
listen(ctl('quality'), 'click', () => {
    quality = QUALITIES[(QUALITIES.indexOf(quality) + 1) % QUALITIES.length];
    try { localStorage.setItem('ng-quality', quality); } catch { /* storage unavailable */ }
    setQualityLabel();
    world?.setQuality(quality);
});

/* ------------------------------------------------------------------ Leader line */

const leader = document.querySelector('.leader');
const leaderLine = leader.querySelector('line');
const leaderDot = leader.querySelector('circle');
function drawLeader({ stage: s, hold }) {
    const k = Math.round(s);
    const i = k - 3;
    const card = stationItems[i]?.querySelector('.card');
    const p = card && world.projectStation(i);
    if (!p || !p.visible) { leader.style.opacity = 0; return; }
    const r = card.getBoundingClientRect();
    const narrow = window.innerWidth < 760 || window.innerWidth / window.innerHeight < 0.8;
    const ax = narrow ? r.left + r.width / 2 : r.right;
    const ay = narrow ? r.top : r.top + 34;
    leaderLine.setAttribute('x1', ax);
    leaderLine.setAttribute('y1', ay);
    leaderLine.setAttribute('x2', p.x);
    leaderLine.setAttribute('y2', p.y);
    leaderDot.setAttribute('cx', p.x);
    leaderDot.setAttribute('cy', p.y);
    leader.style.opacity = Math.max(0, hold * 1.4 - 0.4).toFixed(3);
}

/* ------------------------------------------------------------------ Intro */

const loader = document.querySelector('.loader');
const skipBtn = ctl('skip');
let introTl = null;
let seen = false;
try { seen = sessionStorage.getItem('ng-intro-seen') === '1'; } catch { /* storage unavailable */ }

function showInterface() {
    root.classList.remove('intro-pending');
    skipBtn.hidden = true;
}

function playIntro(w) {
    const ps = w.puzzleState;
    const finish = () => {
        Object.assign(ps, { points: 0, lines: 0, assemble: 1, reveal: 1, seams: 0.07 });
        w.intro.env = 1;
        if (motion) gsap.set('[data-intro]', { opacity: 1, y: 0 });
        showInterface();
        try { sessionStorage.setItem('ng-intro-seen', '1'); } catch { /* storage unavailable */ }
    };
    if (!motion || seen) { finish(); return; }
    Object.assign(ps, { points: 0, lines: 0, assemble: 0, reveal: 0, seams: 0 });
    gsap.set('[data-intro]', { opacity: 0, y: 16 });
    root.classList.remove('intro-pending');
    skipBtn.hidden = false;
    // outline → form → surface → environment → interface, overlapping.
    introTl = gsap.timeline({ onComplete: finish })
        .to(ps, { points: 1, duration: 0.5, ease: 'power2.out' }, 0)
        .to(ps, { lines: 1, duration: 0.9, ease: 'power2.out' }, 0.4)
        .to(ps, { assemble: 1, duration: 1.6, ease: 'power2.inOut' }, 0.8)
        .to(ps, { reveal: 1, duration: 1.3, ease: 'power1.inOut' }, 1.1)
        .to(w.intro, { env: 1, duration: 1.4, ease: 'power2.inOut' }, 1.8)
        .to(ps, { points: 0, lines: 0, seams: 0.07, duration: 0.9, ease: 'power2.inOut' }, 2.7)
        .to('[data-intro]', { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out' }, 2.6);
}
listen(skipBtn, 'click', () => {
    introTl?.progress(1);
    document.getElementById('intro-name').focus?.();
});

/* ------------------------------------------------------------------ World */

function fallback() {
    root.classList.add('no-webgl');
    root.classList.remove('intro-pending');
    loader.hidden = true;
    ctl('quality').hidden = true;
    skipBtn.hidden = true;
}

async function boot() {
    root.classList.add('intro-pending');
    // Never hold content back indefinitely.
    const guard = setTimeout(() => { if (!world) fallback(); }, 12000);
    try {
        await document.fonts?.load('700 150px "IBM Plex Sans"');
        await document.fonts?.load('500 150px "IBM Plex Mono"');
        const { createWorld } = await import('./world.js');
        const w = await createWorld({ canvas: document.getElementById('world'), content, reducedMotion: reduced, quality });
        if (root.classList.contains('no-webgl')) { w.dispose(); return; }
        clearTimeout(guard);
        world = w;
        root.classList.add('webgl');
        loader.hidden = true;
        w.setSkillElements(buttons);
        w.setActiveSkill(buttons.findIndex((b) => b.getAttribute('aria-pressed') === 'true'));
        w.onFrame(drawLeader);
        w.onSlam(() => audio.crack());
        computeStage();
        w.start();
        playIntro(w);

        if (window.matchMedia('(pointer: fine)').matches) {
            listen(window, 'pointermove', (e) => w.setPointer((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), { passive: true });
            listen(document, 'pointerleave', () => w.setPointer(0, 0, false));
        } else {
            // Touch: a tap disturbs particles / lifts pieces briefly, then releases.
            listen(window, 'pointerdown', (e) => {
                w.setPointer((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
                setTimeout(() => w.setPointer(0, 0, false), 700);
            }, { passive: true });
        }
        listen(window, 'resize', () => { w.resize(); computeStage(); });
        listen(document, 'visibilitychange', () => {
            if (document.hidden) { w.stop(); audio.suspend(); } else { w.start(); audio.resume(); }
        });
        listen(document.getElementById('world'), 'world-lost', fallback);
    } catch (err) {
        clearTimeout(guard);
        console.warn('3D scene unavailable:', err.message);
        fallback();
    }
}
boot();

/* ------------------------------------------------------------------ Cleanup */

listen(window, 'pageshow', (e) => { if (e.persisted) world?.start(); });
window.addEventListener('pagehide', (e) => {
    if (e.persisted) { world?.stop(); return; }
    cleanups.forEach((fn) => fn());
    window.ScrollTrigger?.getAll().forEach((t) => t.kill());
    world?.dispose();
    audio.dispose();
});
