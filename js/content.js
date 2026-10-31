// All portfolio data for the Frost site lives here. Edit this file to change text,
// links, skills, journey entries or contact details — the page and the 3D scene are
// built from it. Facts come from Nishan's IT CV (Oct 2026) and the original site.

// Icons are small 24×24 stroke SVGs (original line icons, not brand logos).
const icon = {
    troubleshoot: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M6 10h3l1.5-3 3 6 1.5-3h3"/>',
    printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v5m0 0-5.2 4.6M12 12.5l5.2 4.6"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    server: '<rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    pen: '<path d="m12 19 7-7 3 3-7 7z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18z"/><path d="m2 2 7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
    video: '<rect x="2" y="5" width="15" height="14" rx="2"/><path d="m17 10 5-3v10l-5-3"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
};

export const content = {
    meta: {
        title: 'Nishan Gurung — IT Graduate · Napier, New Zealand',
        description: 'Nishan Gurung — IT graduate (BSc Hons, Infomax College) and Master of Information Technology student at EIT, Napier. IT support, PC repair and design.',
        url: 'https://nishangurung.com.np/',
    },

    name: 'Nishan Gurung',
    location: 'Napier, Hawke’s Bay',
    // Portrait frozen in the ice block on the iceberg (a penguin breaks it every 5 s).
    photo: {
        src: 'img/nishan-night.jpg',
        alt: 'Nishan Gurung at a night-time lookout above the lights of Pokhara.',
        width: 1200,
        height: 1084,
    },
    cv: { href: 'cv/Nishan_Gurung_CV.pdf', filename: 'Nishan_Gurung_CV.pdf', label: 'Download CV' },

    sections: [
        { id: 'intro', index: '01', label: 'Intro' },
        { id: 'skills', index: '02', label: 'Skills' },
        { id: 'journey', index: '03', label: 'Journey' },
        { id: 'contact', index: '04', label: 'Contact' },
    ],

    intro: {
        eyebrow: 'Portfolio & CV — Napier, Hawke’s Bay',
        headline: 'IT graduate and Master of Information Technology student at EIT, Napier — with hands-on experience in IT support and design, and a growing interest in software, cloud technology and AI automation.',
        facts: [
            { label: 'Studying', value: 'Master of IT · EIT Napier' },
            { label: 'Graduated', value: 'BSc (Hons) IT · 2025' },
            { label: 'Latest role', value: 'Junior IT Assistant' },
        ],
        aboutTitle: 'From Pokhara to Napier.',
        about: [
            'I’m an IT graduate who likes experimenting with new technology — and keeps learning new things because of it.',
            'I completed a Bachelor of Science (Honours) in Information Technology at Infomax College, Nepal, in 2025, and began a Master of Information Technology at the Eastern Institute of Technology, Napier, in October 2026.',
            'For over a year I worked as a Junior IT Assistant at Mero Creation, a design and digital printing business in Pokhara — working with computer troubleshooting, printers and networking, alongside Photoshop and CorelDRAW.',
            'I’m now looking for a part-time opportunity in IT support or technical assistance.',
        ],
    },

    skillsIntro: {
        title: 'Skills, in ice.',
        sub: 'Each block holds one tool I’ve worked with. Select a block to see where the skill comes from.',
        interests: 'software development · cloud technology · AI automation',
    },
    skillCategories: { it: 'IT support', design: 'Design & media', web: 'Web & office' },
    skills: [
        { name: 'Computer troubleshooting', cat: 'it', icon: icon.troubleshoot, note: 'Diagnosing common computer issues — part of my role as a Junior IT Assistant at Mero Creation.' },
        { name: 'Printers', cat: 'it', icon: icon.printer, note: 'Familiar with printing equipment and basic troubleshooting, from a design and digital printing business.' },
        { name: 'Networking', cat: 'it', icon: icon.network, note: 'Knowledge of basic networking concepts, used in junior IT assistance at Mero Creation.' },
        { name: 'PC build & repair', cat: 'it', icon: icon.chip, note: 'One year of training at Gandaki Computers building and repairing PCs and laptops.' },
        { name: 'Server management', cat: 'it', icon: icon.server, note: 'Three months of training as a server manager at Nepal Telecom, Pokhara.' },
        { name: 'Photoshop', cat: 'design', icon: icon.image, note: 'Image design and editing — used for design-related work at Mero Creation and learned at AlphaBeta Computers.' },
        { name: 'CorelDRAW', cat: 'design', icon: icon.pen, note: 'Design software used for design-related work at Mero Creation.' },
        { name: 'Premiere Pro', cat: 'design', icon: icon.video, note: 'Video editing, learned during six months of graphic design training at AlphaBeta Computers.' },
        { name: 'Adobe XD', cat: 'web', icon: icon.layout, note: 'Designing website layouts in Adobe XD.' },
        { name: 'WordPress', cat: 'web', icon: icon.globe, note: 'Creating and publishing posts in WordPress.' },
        { name: 'Microsoft Office', cat: 'web', icon: icon.doc, note: 'The Microsoft Office suite, studied at AlphaBeta Computers.' },
        { name: 'Social media', cat: 'web', icon: icon.share, note: 'Managing social media and advertising products.' },
    ],

    journeyIntro: {
        title: 'Experience & education.',
        sub: 'Nine stations down the iceberg, newest first. Scroll to dive deeper.',
    },
    // kind: education | experience | training — sets the shape of each ice enclosure.
    journey: [
        { kind: 'education', year: '2026', date: 'Oct 2026 – Present', title: 'Master of Information Technology', org: 'Eastern Institute of Technology (EIT), Napier', text: 'Current student.' },
        {
            kind: 'experience', year: '2025', date: '16 Jul 2025 – 22 Sep 2026', title: 'Junior IT Assistant', org: 'Mero Creation · Ranipauwa, Pokhara, Nepal',
            list: [
                'Worked in junior IT assistance within a design and digital printing business.',
                'Technical knowledge includes computer troubleshooting, printers and networking.',
                'Familiar with Photoshop and CorelDRAW for design-related work.',
            ],
        },
        { kind: 'education', year: '2025', date: 'Jan 2022 – 2025', title: 'Bachelor of Science (Honours) in Information Technology', org: 'Infomax College of IT, Nepal', text: 'Completed 2025.' },
        { kind: 'training', year: '2024', date: '30 Apr 2024 – 30 Jul 2024', title: 'Server Manager (training)', org: 'Nepal Telecom · Ranipauwa, Pokhara', text: 'Three months of training as a server manager.' },
        { kind: 'training', year: '2022', date: 'Jan 2022 – Dec 2022', title: 'PC Repair', org: 'Gandaki Computers · Newroad, Pokhara', text: 'One year of training in building and repairing PCs and laptops.' },
        { kind: 'education', year: '2021', date: '2019 – 2021', title: 'High School (+2), Science', org: 'Kaski Modernized Academy', text: 'Completed +2 studies in the Science faculty.' },
        { kind: 'training', year: '2020', date: '20 Jun 2020 – 20 Dec 2020', title: 'Graphics Designer', org: 'AlphaBeta Computers · Chipladhunga, Pokhara', text: 'Six months of training in editing, including Photoshop and Premiere Pro.' },
        { kind: 'training', year: '2019', date: '15 Feb 2019 – 15 Mar 2019', title: 'Microsoft Office', org: 'AlphaBeta Computers · Chipladhunga, Pokhara', text: 'Studied the Microsoft Office suite.' },
        { kind: 'education', year: '2018', date: '2009 – 2018', title: 'School', org: 'Kaski Modernized Academy', text: 'Completed school.' },
    ],

    contactIntro: {
        title: 'Let’s talk.',
        sub: 'Seeking part-time work in IT support or technical assistance. Available from 12:00 pm on suitable days, subject to class timetable and visa conditions.',
    },
    // shape: the particle form previewed when a contact item is hovered or focused.
    contacts: [
        { label: 'Email', value: 'nishangrg192@gmail.com', href: 'mailto:nishangrg192@gmail.com', shape: 'mail' },
        { label: 'Phone', value: '+64 22 064 8050', href: 'tel:+64220648050', shape: 'phone' },
        { label: 'Location', value: 'Napier, Hawke’s Bay, New Zealand', shape: 'pin' },
        { label: 'CV', value: 'Download PDF', href: 'cv/Nishan_Gurung_CV.pdf', download: 'Nishan_Gurung_CV.pdf', shape: 'cv' },
    ],
};
