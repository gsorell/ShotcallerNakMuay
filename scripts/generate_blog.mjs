import fs from 'fs';
import path from 'path';

const outDir = path.resolve('public/blog');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const baseStyle = `
    <style>
        :root {
            --bg: #0f1117;
            --text: #cbd5e1;
            --heading: #f8fafc;
            --accent: #ec4899;
            --accent-hover: #f472b6;
            --card-bg: #1e293b;
            --card-border: #334155;
        }
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            line-height: 1.7;
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }
        .navbar {
            background-color: #0a0019;
            height: 94px;
            display: flex;
            align-items: stretch;
            justify-content: center;
            border-bottom: none;
            padding: env(safe-area-inset-top) 0 0 0;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .navbar .logo {
            cursor: pointer;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            box-sizing: border-box;
            border: none;
            background: transparent;
            text-decoration: none;
            padding: 8px 12px;
        }
        .navbar img { 
            height: 100%;
            max-height: 66px;
            width: auto;
            object-fit: contain;
            user-select: none;
            -webkit-user-drag: none;
        }
        
        /* Layout wrapper styles mimicking app-layout-wrapper and app-scroll */
        .page-wrapper {
            max-width: 980px;
            margin: 28px auto;
            padding: 20px;
            min-height: calc(100vh - 94px - 140px); /* Fill space between header and footer */
            display: flex;
            flex-direction: column;
        }
        
        .container {
            /* Mimics the panel style in App.css */
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.06));
            backdrop-filter: blur(6px);
            border-radius: 12px;
            padding: 18px 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
            border: 1px solid rgba(255, 255, 255, 0.04);
            margin-bottom: 22px;
            width: 100%;
                box-sizing: border-box;
                max-width: 720px;
                margin: 0 auto;
            }
            .app-footer {
                margin-top: 60px;
                background: linear-gradient(180deg, transparent 0%, rgba(10, 0, 25, 0.4) 100%);
                border-top: 1px solid rgba(255, 255, 255, 0.06);
                padding: 24px 16px
                    calc(var(--footer-padding-bottom, 2rem) + env(safe-area-inset-bottom, 0px));
            }
            .app-footer-content {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 1.5rem;
            max-width: 600px;
            margin: 0 auto;
            flex-wrap: wrap;
        }
        .app-footer-logo {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            object-fit: cover;
            opacity: 0.8;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .app-footer-logo:hover {
            opacity: 1;
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3);
        }
        .app-footer-link {
            color: rgba(255, 255, 255, 0.55);
            font-size: 0.85rem;
            font-weight: 500;
            text-decoration: none;
            transition: color 0.2s ease;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .app-footer-link:hover { color: #fff; }
        .app-footer-social img {
            width: 24px;
            height: 24px;
            opacity: 0.55;
            transition: all 0.2s ease;
        }
        .app-footer-social:hover img {
            opacity: 1;
            transform: scale(1.1);
        }
        h1, h2, h3 { color: var(--heading); line-height: 1.2; font-weight: 700; margin-top: 1.8em; margin-bottom: 0.8em; }
        h1 { font-size: 2.6rem; font-weight: 800; margin-top: 0; margin-bottom: 0.2em; letter-spacing: -0.02em; }
        h2 { font-size: 1.75rem; border-bottom: 1px solid var(--card-border); padding-bottom: 10px; }
        h3 { font-size: 1.35rem; }
        p { font-size: 1.125rem; margin-bottom: 1.6em; }
        a { color: #38bdf8; text-decoration: none; font-weight: 500; transition: color 0.2s; }
        a:hover { color: #7dd3fc; text-decoration: underline; }
        ul { margin-bottom: 1.6em; font-size: 1.125rem; padding-left: 20px; }
        li { margin-bottom: 0.6em; }
        .meta { color: #8b9bb4; font-size: 0.95rem; margin-bottom: 2.5em; display: flex; align-items: center; gap: 12px; }
        
        .author-avatar { 
            width: 44px; 
            height: 44px; 
            border-radius: 50%; 
            background: #1e293b; 
            border: 2px solid #ec4899;
            flex: none;
            overflow: hidden; 
            clip-path: inset(0);
        }
        .author-avatar img { 
            display: block;
            height: 100%;
            width: 600%; /* 6 frames */
            max-width: none;
            /* -50% of a sheet six cells wide is three cells across, landing on frame 4 (LANDED_FRAME) */
            transform: translateX(-50%);
        }

        table { width: 100%; border-collapse: collapse; margin: 2em 0; background: var(--card-bg); border-radius: 8px; overflow: hidden; font-size: 1.05rem; }
        th, td { padding: 14px 16px; border: 1px solid var(--card-border); text-align: left; }
        th { background: rgba(0,0,0,0.25); color: var(--heading); font-weight: 600; border-bottom: 2px solid var(--card-border); }
        .post-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 28px; margin-bottom: 20px; transition: transform 0.2s ease, border-color 0.2s ease; display: block; text-decoration: none !important; }
        .post-card:hover { transform: translateY(-4px); border-color: var(--accent); box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        .post-card h2 { border: none; padding: 0; margin: 0 0 10px 0; font-size: 1.55rem; color: var(--heading) !important; }
        .post-card p { margin: 0; font-size: 1.05rem; color: #94a3b8; }
        .post-card .date { font-size: 0.85rem; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; display: block; font-weight: 700; }
        .verdict { background: rgba(236, 72, 153, 0.1); border-left: 4px solid var(--accent); padding: 24px; margin: 2.5em 0; border-radius: 0 12px 12px 0; }
        .verdict h3 { margin-top: 0; color: var(--accent); }
        .verdict p:last-child { margin-bottom: 0; }
        .back-link { display: inline-block; margin-top: 4em; border-top: 1px solid var(--card-border); padding-top: 1.5em; width: 100%; text-align: left; }
        .back-link-top { display: inline-flex; align-items: center; gap: 6px; color: var(--accent); font-weight: 700; font-size: 0.9rem; margin-bottom: 24px; }
        .back-link-top:hover { color: var(--accent-hover); text-decoration: none; }
        .highlight { color: var(--heading); font-weight: 600; }
        .hero { background: var(--card-bg); border: 1px solid var(--card-border); padding: 32px; border-radius: 12px; margin-bottom: 40px; text-align: center; }
        .hero h1 { margin-top: 0; font-size: 2.2rem; }
        .hero p { color: #94a3b8; margin-bottom: 0; }

        /* ---- Media-outlet redesign: masthead, filters, featured, grid ---- */
        .container--wide { max-width: 1120px; }

        .masthead { text-align: center; padding: 8px 0 32px; border-bottom: 1px solid var(--card-border); margin-bottom: 36px; }
        .masthead-kicker { display: inline-block; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin-bottom: 14px; }
        .masthead h1 { font-size: 2.8rem; margin: 0 0 12px; }
        .masthead p { font-size: 1.15rem; color: #94a3b8; max-width: 580px; margin: 0 auto; }

        .filter-bar { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-bottom: 40px; }
        .filter-pill { font-family: inherit; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.03em; color: #cbd5e1; background: rgba(255,255,255,0.04); border: 1px solid var(--card-border); border-radius: 999px; padding: 9px 18px; cursor: pointer; transition: all 0.2s ease; }
        .filter-pill:hover { border-color: var(--accent); color: #fff; }
        .filter-pill.active { background: var(--accent); border-color: var(--accent); color: #fff; }

        .category-chip { display: inline-block; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 10px; border-radius: 6px; margin-bottom: 12px; color: #0a0019; }

        .featured-card { display: block; background: linear-gradient(135deg, rgba(236,72,153,0.14), rgba(56,189,248,0.06)); border: 1px solid rgba(236,72,153,0.35); border-radius: 16px; padding: 40px; margin-bottom: 44px; text-decoration: none !important; transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .featured-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.3); }
        .featured-label { display: block; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent); margin-bottom: 14px; }
        .featured-card h2 { font-size: 2rem; margin: 0 0 14px; border: none; padding: 0; }
        .featured-card p { font-size: 1.1rem; color: #cbd5e1; margin-bottom: 20px; }
        .featured-card .card-meta { color: #8b9bb4; font-size: 0.9rem; font-weight: 600; }

        .post-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 22px; align-items: start; }
        .post-grid .post-card { margin-bottom: 0; display: flex; flex-direction: column; }
        .card-meta { color: #8b9bb4; font-size: 0.85rem; font-weight: 600; margin-top: 14px; }

        .read-more { display: inline-flex; align-items: center; gap: 6px; margin-top: 16px; font-size: 0.9rem; font-weight: 700; color: var(--accent); }
        .post-card:hover .read-more, .featured-card:hover .read-more { color: var(--accent-hover); }

        .article-eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
        .read-time { font-size: 0.85rem; color: #8b9bb4; font-weight: 600; }

        .post-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 3em; padding-top: 2em; border-top: 1px solid var(--card-border); }
        .post-nav a { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 16px 18px; text-decoration: none !important; transition: border-color 0.2s ease, transform 0.2s ease; }
        .post-nav a:hover { border-color: var(--accent); transform: translateY(-2px); }
        .post-nav-label { display: block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); font-weight: 800; margin-bottom: 6px; }
        .post-nav-title { color: var(--heading); font-weight: 700; font-size: 0.98rem; }
        .post-nav-next { text-align: right; }

        .related-section { margin-top: 3em; }
        .related-section h3 { border: none; padding: 0; margin-bottom: 0; }
        .related-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; margin-top: 1.2em; }
        .related-grid .post-card { padding: 20px; margin-bottom: 0; }
        .related-grid .post-card h2 { font-size: 1.1rem; }

        @media (max-width: 600px) {
            .post-nav { grid-template-columns: 1fr; }
            .post-nav-next { text-align: left; }
            .masthead h1 { font-size: 2.1rem; }
        }
    </style>
`;

const renderHead = (title, metaDesc, url, bodyClass = '') => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${metaDesc}">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${metaDesc}">
    <meta property="og:url" content="${url}">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": "${title}",
      "description": "${metaDesc}",
      "author": { "@type": "Organization", "name": "Shot Caller Nak Muay" },
      "publisher": { "@type": "Organization", "name": "Shot Caller Nak Muay" }
    }
    </script>
    ${baseStyle}
</head>
<body>
    <div class="navbar app-header">
        <a href="/" class="logo">
            <img src="/assets/Logo_Header_Banner_Smooth.png" alt="Shot Caller Nak Muay">
        </a>
    </div>
    <div class="page-wrapper">
        <div class="container ${bodyClass}">
`;

const renderFoot = () => `
        </div>
    </div>
    <footer class="app-footer">
        <div class="app-footer-content">
            <a href="/">
                <img src="/assets/logo_icon.png" alt="Logo" class="app-footer-logo">
            </a>
            <a href="/" class="app-footer-link">App Home</a>
            <a href="/privacy-policy.html" class="app-footer-link">Privacy</a>
            <a href="/terms.html" class="app-footer-link">Terms</a>
            <a href="https://www.instagram.com/nakmuayshotcaller?igsh=dTh6cXE4YnZmNDc4" target="_blank" rel="noopener noreferrer" class="app-footer-social" aria-label="Instagram">
                <img src="/assets/icon.instagram.png" alt="Instagram">
            </a>
        </div>
    </footer>
</body>
</html>
`;

const renderMeta = (author, date) => `
    <div class="meta">
        <div class="author-avatar">
            <img src="/assets/technique/head-kick.webp" alt="Author">
        </div>
        <div>
            <div>By <strong>${author}</strong></div>
            <div>${date}</div>
        </div>
    </div>
`;

// Category color-coding, media-outlet style.
const CATEGORY_COLORS = {
    'Comparisons': '#38bdf8',
    'Technique': '#ec4899',
    'App Guides': '#818cf8',
    'Training Plans': '#34d399',
    'Behind The Scenes': '#f59e0b',
    'Training Mindset': '#f472b6',
    'Gear Guides': '#facc15',
    'Fitness': '#22d3ee',
};

const renderCategoryChip = (tag) => `<span class="category-chip" style="background: ${CATEGORY_COLORS[tag] || '#94a3b8'};">${tag}</span>`;

// ~200 words/min, estimated off the rendered post body (tags stripped).
const estimateReadTime = (html) => {
    const words = html.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
};

const renderPostCard = (post) => `
    <a href="/blog/${post.filename}" class="post-card" data-tag="${post.tag}">
        ${renderCategoryChip(post.tag)}
        <h2>${post.title}</h2>
        <p>${post.desc}</p>
        <div class="card-meta">${post.date} &middot; ${estimateReadTime(post.content)} min read</div>
        <span class="read-more">Read More &rarr;</span>
    </a>
`;

const renderFeatured = (post) => `
    <a href="/blog/${post.filename}" class="featured-card" data-tag="${post.tag}">
        <span class="featured-label">Latest &middot; ${post.tag}</span>
        <h2>${post.title}</h2>
        <p>${post.desc}</p>
        <div class="card-meta">${post.date} &middot; ${estimateReadTime(post.content)} min read</div>
        <span class="read-more">Read Full Story &rarr;</span>
    </a>
`;

const renderArticleEyebrow = (post) => `
    <div class="article-eyebrow">
        ${renderCategoryChip(post.tag)}
        <span class="read-time">${estimateReadTime(post.content)} min read</span>
    </div>
`;

const renderPrevNext = (prev, next) => `
    <div class="post-nav">
        ${prev ? `<a href="/blog/${prev.filename}"><span class="post-nav-label">&larr; Previous</span><span class="post-nav-title">${prev.title}</span></a>` : '<span></span>'}
        ${next ? `<a href="/blog/${next.filename}" class="post-nav-next"><span class="post-nav-label">Next &rarr;</span><span class="post-nav-title">${next.title}</span></a>` : '<span></span>'}
    </div>
`;

const renderRelated = (related) => related.length === 0 ? '' : `
    <div class="related-section">
        <h3>You Might Also Like</h3>
        <div class="related-grid">
            ${related.map(renderPostCard).join('')}
        </div>
    </div>
`;


const posts = [
    {
        filename: 'southpaw-muay-thai-training-guide.html',
        title: 'Training Muay Thai as a Southpaw: The Adjustments Every Left-Handed Fighter Needs',
        desc: 'A guide for left-handed fighters training Muay Thai solo: stance adjustments, common mistakes orthodox-first content misses, and how to drill authentic southpaw combinations.',
        date: 'Aug 31, 2026',
        tag: 'App Guides',
        content: `
            <h1>Training Muay Thai as a Southpaw: The Adjustments Every Left-Handed Fighter Needs</h1>
            ${renderMeta('Shotcaller Sam', 'August 31, 2026')}
            <p>Roughly one in ten people is left-handed, but almost all Muay Thai instructional content, numbering systems, and combo apps are built orthodox-first. If you're a southpaw, you've probably spent training sessions doing mental gymnastics — mirroring every "jab, cross, hook" call in real time before your body can react.</p>
            <p>That translation delay is the exact opposite of what a reactive drill is supposed to build. Here's how to actually train Muay Thai as a southpaw, without constantly working against the material.</p>

            <h2>Why Southpaw Training Gets Overlooked</h2>
            <p>Most combo generators and timer apps are written by and for orthodox fighters, since they're the majority. Numbering systems like "1 = jab" assume a lead left hand. When a southpaw hears these calls, they have to flip lead and rear on the fly — a small tax on every single strike that adds up over a 5-round session and quietly caps how fast you can react.</p>

            <h2>The Core Stance Adjustments</h2>
            <p>As a southpaw, your lead hand and lead leg are your right side. Your power side — the one generating the heavy cross and rear kick — is your left. This isn't just a mirror image of orthodox technique; it changes how you close distance and where your power angles land.</p>
            <ul>
                <li><strong>Open vs. Closed Stance:</strong> Against an orthodox opponent, you're in an "open" stance — your lead legs are on the same side. This changes which angles are available compared to fighting another southpaw, where the stance is "closed."</li>
                <li><strong>The Outside Angle:</strong> Southpaws in an open stance often have easier access to the outside of an orthodox opponent's lead leg with the rear teep and rear low kick, since there's nothing blocking that lane.</li>
                <li><strong>Rear Straight Placement:</strong> Your rear cross (left hand) travels a slightly different line than an orthodox rear cross, because your hips and shoulders are rotated the opposite way. Drill it deliberately rather than assuming it's a pure mirror.</li>
            </ul>

            <h2>The Mistake Most Lefties Make</h2>
            <p>The most common error isn't technical — it's mental. Southpaws who learn primarily from orthodox instruction often just mirror everything 1:1 without questioning it, including footwork patterns that were designed around an orthodox fighter's angles. Pivots that create outside angles for an orthodox fighter can put a southpaw in a worse position if copied blindly. Treat every drill as something to test for your own stance, not just flip.</p>

            <h2>How Shot Caller Handles It</h2>
            <p>Under <strong>Advanced Settings</strong>, <strong><a href="/">Shot Caller Nak Muay</a></strong> has a dedicated <strong>Southpaw Mode</strong> toggle. Flip it on, and every "Left" and "Right" in the callout engine mirrors automatically — so "Left Hook" becomes your actual lead hook instead of forcing you to translate mid-combo. It's a small switch that removes the single biggest source of hesitation in southpaw solo training.</p>

            <div class="verdict">
                <h3>Turn On Southpaw Mode First</h3>
                <p>Before you drill a single round, flip on Southpaw Mode in Advanced Settings. Every combination the app calls will already be correct for your stance, which means the only thing left to work on is your actual technique — not translation lag.</p>
            </div>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'small-apartment-muay-thai-training.html',
        title: 'How to Train Muay Thai in a Small Apartment (No Bag, No Space, No Problem)',
        desc: 'You do not need a garage gym to train Muay Thai. Here is how to run a full shadow boxing session in a small apartment, hotel room, or dorm without disturbing your neighbors.',
        date: 'Aug 30, 2026',
        tag: 'Training Plans',
        content: `
            <h1>How to Train Muay Thai in a Small Apartment (No Bag, No Space, No Problem)</h1>
            ${renderMeta('Shotcaller Sam', 'August 30, 2026')}
            <p>"I don't have room for a heavy bag" is one of the most common reasons people put off training. It's also not a real barrier. Shadow boxing — striking against air, with intent and full extension — builds the vast majority of the technical skill a heavy bag does. You just need a plan that respects thin walls and downstairs neighbors.</p>

            <h2>What You Actually Need</h2>
            <p>A patch of floor roughly six feet square, shoes off, and a phone. That's it. No bag, no mount, no mats. Everything that makes a combo-calling app valuable — reactive timing, authentic terminology, unpredictable sequencing — works exactly the same whether you're hitting a bag or hitting air.</p>

            <h2>Respect the Downstairs Neighbors</h2>
            <p>The adjustment isn't the technique, it's the landing. A few practical swaps keep a small-space session quiet:</p>
            <ul>
                <li><strong>Control your foot-down:</strong> Land kicks and knees with control instead of stomping the recovery step. The strike itself doesn't need to be loud to be sharp.</li>
                <li><strong>Skip the jumping footwork:</strong> Save switch kicks that involve a hop for a gym or park session. Standard switch kicks without the jump still build the same hip mechanics.</li>
                <li><strong>Trade volume for precision:</strong> A slower, deliberately controlled combination teaches your body the same pattern as a loud, fast one — and it's the pattern that matters when there's no bag giving you feedback.</li>
            </ul>

            <h2>Let the Audio Do the Resistance's Job</h2>
            <p>A heavy bag gives you two things shadow boxing doesn't: impact feedback and a reason to stay committed to full extension. Without a bag, the temptation is to go through combos lazily since nothing is pushing back. This is exactly where an unpredictable audio callout timer earns its keep — <strong><a href="/">Shot Caller Nak Muay</a></strong> calls the combination, and your job is to snap through it with full technique and a real return to guard, exactly as if it were about to be checked.</p>

            <h2>Combinations That Fit a Small Footprint</h2>
            <p>Favor combinations built around knees, elbows, and pivots, which need almost no lateral space, over combos that lean on wide lateral footwork or a long switch-kick step. You lose nothing technically — you're just choosing the tools that suit the room.</p>

            <div class="verdict">
                <h3>Consistency Beats Equipment</h3>
                <p>A six-foot square of apartment floor and a phone is a complete training setup. The bag, the mats, and the garage gym are nice-to-haves that come later — they were never the thing standing between you and showing up today.</p>
            </div>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'is-muay-thai-good-for-weight-loss.html',
        title: 'Is Muay Thai Good for Weight Loss? Calories, Realistic Results, and What Actually Works',
        desc: 'Can shadow boxing and heavy bag training help you lose weight? A realistic breakdown of calorie burn, training intensity, and how to structure sessions for fat loss.',
        date: 'Aug 29, 2026',
        tag: 'Fitness',
        content: `
            <h1>Is Muay Thai Good for Weight Loss? Calories, Realistic Results, and What Actually Works</h1>
            ${renderMeta('Shotcaller Sam', 'August 29, 2026')}
            <p>Muay Thai is routinely cited as one of the more demanding forms of cardio conditioning, and for good reason: it combines full-body strikes, constant footwork, and short bursts of high output over multiple rounds. But does that translate to actual weight loss? Broadly, yes — with a few honest caveats.</p>

            <h2>Roughly How Much You're Burning</h2>
            <p>Exact numbers depend heavily on your body weight and how hard you're actually working, but trainers commonly cite a hard round of continuous striking — shadow boxing or bag work — in the same general range as other vigorous cardio: often estimated between 500–800 calories per hour of sustained effort. A relaxed, technical session burns meaningfully less than an all-out interval session. The intensity you bring is the biggest variable, not the sport itself.</p>

            <h2>Why Unpredictable Combos Beat a Fixed Routine</h2>
            <p>Your heart rate climbs fastest when your body doesn't know what's coming next. A memorized routine, no matter how demanding on paper, gets easier every time you repeat it because your brain stops working as hard to execute it. This is the same principle behind interval training research generally: variability keeps effort — and heart rate — higher for longer.</p>
            <p>A dynamic combo-generator closes that loophole. Because <strong><a href="/">Shot Caller Nak Muay</a></strong> never calls the exact same sequence twice, your nervous system stays engaged round after round instead of coasting through a pattern it has already memorized.</p>

            <h2>Structuring Rounds for Fat Loss vs. Skill</h2>
            <p>The two goals pull in slightly different directions, and it's worth being deliberate about which one a given session is for:</p>
            <ul>
                <li><strong>Fat-loss focused:</strong> Shorter rest periods, a heavier-hands style focus like <em>Muay Mat</em>, and higher round counts at a controlled pace you can sustain.</li>
                <li><strong>Skill focused:</strong> Longer rest, slower and more deliberate combinations, and a technical style focus like <em>Muay Femur</em> where precision matters more than volume.</li>
            </ul>
            <p>Both are valid training days. Just don't confuse a technical, precision-focused session for a fat-loss session — they're doing different jobs.</p>

            <div class="verdict">
                <h3>A Real Tool, Not a Magic Fix</h3>
                <p>Muay Thai training — even entirely solo, entirely at home — is a legitimate, demanding form of conditioning that can support weight loss as part of a broader plan that includes diet. It won't out-train a poor diet, but as a consistency-friendly, genuinely difficult cardio session you can do without a commute to a gym, it's hard to beat.</p>
            </div>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'home-muay-thai-equipment-guide.html',
        title: "The Complete Beginner's Equipment Guide: What You Actually Need for Home Muay Thai Training",
        desc: 'Hand wraps, gloves, a bag or none at all — here is exactly what gear beginners need (and do not need yet) to start training Muay Thai from home.',
        date: 'Aug 28, 2026',
        tag: 'Gear Guides',
        content: `
            <h1>The Complete Beginner's Equipment Guide: What You Actually Need for Home Muay Thai Training</h1>
            ${renderMeta('Shotcaller Sam', 'August 28, 2026')}
            <p>Gear checklists for combat sports have a way of spiraling — wraps, gloves, shin guards, a bag, a mount, a mouthguard, headgear. Almost none of that is required to start. Here's what actually matters at each stage.</p>

            <h2>The Non-Negotiables</h2>
            <ul>
                <li><strong>Hand wraps:</strong> Even for shadow boxing, wrapping your hands builds a good habit for wrist support and protects your knuckles the moment you do start hitting something.</li>
                <li><strong>Something to structure the session:</strong> A round timer with real combinations to react to — like <strong><a href="/">Shot Caller Nak Muay</a></strong> — is the difference between a workout and aimless flailing.</li>
                <li><strong>Shoes or bare feet on an appropriate surface:</strong> Whatever lets you pivot without slipping or scraping your skin raw.</li>
            </ul>

            <h2>If You're Hitting Something</h2>
            <p>Once you add a heavy bag — a hanging bag, a freestanding base for apartments, or even a securely mounted banana bag — add two things: bag gloves sized for your hand and the bag's density, and shin guards if you're kicking regularly while your shins are still conditioning. Neither needs to be expensive to do its job.</p>

            <h2>If You're Shadow Boxing Only</h2>
            <p>You genuinely need nothing beyond wraps. A mirror is a nice-to-have for visual self-correction, but it isn't mandatory — an audio callout timer replaces a lot of that self-correction by forcing you to react on a beat instead of admiring your form.</p>

            <h2>What You Don't Need Yet</h2>
            <p>Competition gloves, headgear, and thigh pads are sparring and fight-day gear. Buying them before you've built a consistent solo habit is a common way beginners burn money on equipment that sits in a closet. Let your training habit prove itself first.</p>

            <div class="verdict">
                <h3>Start With Wraps and an App</h3>
                <p>Everything past hand wraps and a good callout timer is an upgrade you earn by showing up consistently, not a prerequisite to start. Begin with the minimum, and let your own training tell you what to add next.</p>
            </div>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'hybrid-muay-thai-calisthenics-workout.html',
        title: 'Building a Hybrid Muay Thai + Calisthenics Workout: Strength Training Without a Gym',
        desc: 'Combine Muay Thai striking with bodyweight strength work. Here is how to structure a hybrid calisthenics and combo-generator workout for full-body conditioning.',
        date: 'Aug 27, 2026',
        tag: 'Training Plans',
        content: `
            <h1>Building a Hybrid Muay Thai + Calisthenics Workout: Strength Training Without a Gym</h1>
            ${renderMeta('Shotcaller Sam', 'August 27, 2026')}
            <p>Striking builds sharp conditioning and rotational power, but it doesn't build much raw pushing or posterior-chain strength on its own. Calisthenics fills exactly that gap, and it doesn't require a single piece of gym equipment — just a bit of floor space and the willingness to mix disciplines in the same session.</p>

            <h2>Why the Combination Works</h2>
            <p>Bodyweight strength work — push-ups, squats, planks, lunges — builds the structural strength that makes every strike hit harder and every round feel easier to sustain. Meanwhile, the striking keeps the session from turning into a plain calisthenics circuit; you're still drilling reactive technique, just with strength work woven through it as active recovery.</p>

            <h2>How Shot Caller Blends Them</h2>
            <p>Under <strong>Advanced Settings</strong>, the <strong>Include Calisthenics</strong> toggle adds bodyweight exercises like jumping jacks and high knees directly into your combo rounds. Rather than treating strength work as a separate workout bolted onto the end, it's interleaved with striking — so your heart rate never gets the chance to fully settle, and your muscles get a break from throwing strikes without the round actually slowing down.</p>

            <h2>A Sample Hybrid Round Structure</h2>
            <p>Five rounds, alternating focus:</p>
            <ul>
                <li><strong>Round 1 — Pure Combos:</strong> Standard striking combinations to establish rhythm and warm the joints.</li>
                <li><strong>Round 2 — Combos + Calisthenics On:</strong> The app weaves in bodyweight moves between combinations, keeping intensity high without added striking volume.</li>
                <li><strong>Round 3 — Pure Combos, Heavier Style:</strong> Switch to a heavy-hands focus like <em>Muay Mat</em> for pure output.</li>
                <li><strong>Round 4 — Combos + Calisthenics On:</strong> Back to the hybrid format as fatigue sets in — this is where the conditioning work really counts.</li>
                <li><strong>Round 5 — Freestyle:</strong> Whatever combination of the two your body has left, finishing on strikes.</li>
            </ul>

            <div class="verdict">
                <h3>Toggle It On for Full-Body Conditioning</h3>
                <p>If your solo sessions have started to feel like pure cardio with nothing left for strength, flip on Include Calisthenics. It's a small setting that turns a striking-only workout into genuine full-body conditioning, no gym required.</p>
            </div>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'best-shadow-boxing-apps.html',
        title: 'The Best Shadow Boxing & Heavy Bag Apps for 2026',
        desc: 'What to look for in the best shadow boxing app: an authentic heavy bag audio callout timer, dynamic kickboxing combo generator, and true martial arts pacing.',
        date: 'Aug 26, 2026',
        tag: 'Comparisons',
        content: `
            <h1>The Best Shadow Boxing & Heavy Bag Apps for 2026</h1>
            ${renderMeta('Shotcaller Sam', 'August 26, 2026')}
            
            <p>If you train solo—whether you're shadow boxing in your living room, hitting a heavy bag in a garage gym, or drilling combos before a class—a good training app can be the difference between a highly productive session and mindlessly repeating the same three punches for twenty minutes.</p>

            <p>Without a coach holding pads and calling out combinations, it’s remarkably easy to fall into repetitive, low-effort routines. A <strong>combo-generator application</strong> acts as a digital pad-holder, keeping your brain engaged and forcing you to react to audio cues.</p>

            <p>But not all apps are created equal. Let’s break down what actually matters and look at the top contenders in 2026.</p>

            <h2>Where Most Apps Fall Short</h2>
            <p>If you search the app store for a "heavy bag timer" or "kickboxing combo generator," you'll find dozens of options. However, most of them suffer from the same three problems:</p>
            <ul>
                <li><strong>Boxing Bias:</strong> They are built for western boxing first. Kicks and knees are simply tacked onto the end of punch routines.</li>
                <li><strong>Predictability:</strong> They loop a predefined set of 15 combinations, which you memorize by your third workout.</li>
                <li><strong>Generic Terminology:</strong> They use numbering systems (1 = jab, 2 = cross) that completely ignore authentic Muay Thai strikes and defenses like the teep, sok (elbow), and checks.</li>
            </ul>

            <h2>Top Contenders in 2026</h2>

            <h3>1. FightFlow (Great for Fitness Kickboxing)</h3>
            <p>FightFlow has built a huge following, and for good reason—it features a highly polished interface and a gamified experience. It’s excellent for anyone looking to get a sweat on and burn calories. </p>
            <p><strong>The Catch:</strong> It leans very heavily into cardio kickboxing conventions. You can expect to throw high-volume punch combinations with exactly one kick to finish. It’s less ideal if you’re looking to focus authentically on the pacing, clinching, and defensive work required for real Muay Thai.</p>

            <h3>2. Heavy Bag Pro (Great for Guided Workouts)</h3>
            <p>Heavy Bag Pro takes a different approach by offering hundreds of pre-recorded, guided workout tracks. It feels more like attending a digital class, complete with a coach walking you through a specific routine for 30 minutes.</p>
            <p><strong>The Catch:</strong> Because the workouts are pre-recorded tracks, they lack dynamic randomization. Once you do a specific workout track a few times, you know exactly what’s coming next, which removes the reactive, brain-engaging element of true pad work.</p>

            <h3>3. Shot Caller Nak Muay (Best for Authentic Muay Thai)</h3>
            <p>We built <strong><a href="/">Shot Caller Nak Muay</a></strong> precisely because we couldn't find an app that respected the "Art of 8 Limbs." </p>
            <p>Shot Caller uses a dynamic engine that randomly generates infinite, biomechanically sound combinations on the fly. It utilizes true Nak Muay terminology, calling out strikes like "Teep," "Sok," and "Khao." Most importantly, the app lets you choose targeted Thai fighting styles. Want to work heavy hands and low kicks? Select <em>Muay Mat</em> mode. Want to work long-range kicks and evasion? Switch to <em>Muay Tae</em>.</p>

            <div class="verdict">
                <h3>The Verdict</h3>
                <p>If you want a fitness-focused cardio session with a slick UI, <strong>FightFlow</strong> is great. If you want a pre-recorded guided class, try <strong>Heavy Bag Pro</strong>. But if you train Muay Thai and want an infinite, highly authentic digital pad-holder that dynamically tests your skills using authentic terminology, <strong>Shot Caller Nak Muay</strong> is unmatched.</p>
            </div>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'muay-thai-timer-app-comparison.html',
        title: 'Shot Caller vs. FightFlow vs. Heavy Bag Pro: Which Muay Thai App is Best?',
        desc: 'A feature-by-feature comparison of Shot Caller, FightFlow, and Heavy Bag Pro comparing callout authenticity, round customization, and dynamic combo generation.',
        date: 'Aug 25, 2026',
        tag: 'Comparisons',
        content: `
            <h1>Shot Caller vs. FightFlow vs. Heavy Bag Pro: Which Muay Thai App is Best?</h1>
            ${renderMeta('Shotcaller Sam', 'August 25, 2026')}

            <p>If you are looking to elevate your solo heavy bag or shadow boxing sessions, the top digital tools on the market consistently boil down to three options: <strong>FightFlow</strong>, <strong>Heavy Bag Pro</strong>, and <strong>Shot Caller Nak Muay</strong>. </p>
            <p>Each app takes a completely different philosophical approach to combat sports training. Which one should you install? Here is an honest, feature-by-feature breakdown.</p>

            <h2>The High-Level Differences</h2>
            <ul>
                <li><strong>FightFlow:</strong> A highly polished, gamified app designed heavily around western boxing and cardio-kickboxing volume.</li>
                <li><strong>Heavy Bag Pro:</strong> A library of static, pre-recorded audio workouts styled like a digital fitness class.</li>
                <li><strong>Shot Caller Nak Muay:</strong> A dynamic, infinitely generating audio callout engine built specifically around authentic Muay Thai styles and terminology.</li>
            </ul>

            <h2>Feature Comparison Breakdown</h2>
            
            <table>
                <thead>
                    <tr>
                        <th>Feature</th>
                        <th>Shot Caller Nak Muay</th>
                        <th>FightFlow</th>
                        <th>Heavy Bag Pro</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Combo Generation</strong></td>
                        <td>Infinite, dynamic algorithm</td>
                        <td>Dynamic, boxing-heavy</td>
                        <td>Static, pre-recorded tracks</td>
                    </tr>
                    <tr>
                        <td><strong>Authentic Thai Terms</strong></td>
                        <td>Yes (Teep, Sok, Khao, Check)</td>
                        <td>No (Numbers & Generic Kicks)</td>
                        <td>No (Standard Kickboxing)</td>
                    </tr>
                    <tr>
                        <td><strong>Style Focus Modes</strong></td>
                        <td>Yes (Muay Mat, Femur, Khao, etc.)</td>
                        <td>No (General)</td>
                        <td>No (Categorized by intensity)</td>
                    </tr>
                    <tr>
                        <td><strong>Custom Round Timers</strong></td>
                        <td>Fully customizable</td>
                        <td>Fully customizable</td>
                        <td>Pre-set to the workout track</td>
                    </tr>
                </tbody>
            </table>

            <h2>1. Callout Authenticity & Terminology</h2>
            <p>If you train in a real Muay Thai gym, you are used to a coach yelling "Teep," "Check," or "Elbow." <span class="highlight">FightFlow</span> and <span class="highlight">Heavy Bag Pro</span> primarily lean on standard western boxing translation: calling out a "1-2-3-Right Kick."</p>
            <p><strong>Shot Caller</strong> was built for Nak Muays. The audio engine uses the actual terminology of the sport, and equally importantly, calls for defensive maneuvers like checks and slips mid-combo, forcing you to maintain a defensive mindset.</p>

            <h2>2. Reactive Training vs. Rote Memorization</h2>
            <p><span class="highlight">Heavy Bag Pro</span> excels if you don't want to think; you just press play on a 30-minute track and follow the coach. The downside is that you are listening to a static MP3 file. Once you've done a track a few times, you anticipate the calls.</p>
            <p>Both <span class="highlight">FightFlow</span> and <span class="highlight">Shot Caller</span> use procedural generation, meaning no two rounds are ever the same. However, Shot Caller takes this a step further by grouping combos into actual Thai fighting styles (such as the aggressive, low-kicking <em>Muay Mat</em> or the technical <em>Muay Femur</em>).</p>

            <div class="verdict">
                <h3>Final Thought</h3>
                <p>There is no "wrong" app here—it depends on your goals. For a sweat-inducing cardio workout, FightFlow is fantastic. For guided classes, Heavy Bag Pro is unmatched. But if you want a tool that authentically replicates an experienced Thai pad-holder challenging your timing, defense, and technique, <strong>Shot Caller Nak Muay</strong> is the clear choice.</p>
            </div>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'why-i-built-shotcaller.html',
        title: 'Why We Built Shot Caller: The Muay Thai App We Couldn\'t Find',
        desc: 'The origin story of Shot Caller Nak Muay, and why generic shadow boxing apps fail to capably capture the Art of 8 Limbs.',
        date: 'Aug 24, 2026',
        tag: 'Behind The Scenes',
        content: `
            <h1>Why We Built Shot Caller: The Muay Thai App We Couldn't Find</h1>
            ${renderMeta('Shotcaller Sam', 'August 24, 2026')}

            <p>The idea for Shot Caller Nak Muay was born out of frustration in a damp, poorly-insulated garage gym.</p>

            <p>Like many practitioners, I frequently trained solo. Showing up to the gym for classes wasn't always possible, so I'd spend hours on my heavy bag at home. But hitting a bag for rounds on end can quickly devolve into sloppy habits. Without a coach, you start dropping your hands, abandoning defense, and throwing the same three comfortable combinations over and over.</p>

            <h2>The Shortcomings of Existing Apps</h2>
            <p>To fix this, I downloaded every "shadow boxing app" and "combo generator" on the market. Most of them were beautifully designed, but the moment I pressed play, it became obvious they were built by—and for—western boxers.</p>
            <p>I would hear calls like <em>"One, Two, Three, Four, Right Kick!"</em> It was all high-volume punch output with a token kick slapped onto the end for flavor. I wanted to drill knees. I wanted to throw slicing elbows. I wanted an app to yell "Check!" forcing me to lift my leg before firing back.</p>

            <h2>Building a Digital Pad-Holder</h2>
            <p>A good Thai pad session has a specific rhythm. It’s not just a barrage of strikes. A good pad-holder will throw a kick at you to test your guard, ask you to teep them away, and then command a heavy roundhouse.</p>
            <p>I built <strong>Shot Caller Nak Muay</strong> to emulate that rhythm. We threw out the generic boxing templates and mapped out the biomechanics of real Muay Thai.</p>
            
            <ul>
                <li><strong>Authentic Pacing:</strong> Combos range from single, devastating power strikes to complex 5-strike flurries, mixed with defensive actions.</li>
                <li><strong>True Terminology:</strong> Using proper Nak Muay terms so the audio cues translate directly to what you'll hear in a real gym in Thailand.</li>
                <li><strong>Stylistic Approaches:</strong> Because no two fighters fight the same, we programmed specific modes. You can train like a <em>Muay Khao</em> (clincher/knee fighter) for three rounds, then switch to a <em>Muay Tae</em> (heavy kicker) for the next three.</li>
            </ul>

            <div class="verdict">
                <h3>Our Mission</h3>
                <p>Shot Caller was built by practitioners, for practitioners. It is designed to be the ultimate companion for the days you can't make it to the mats, ensuring your solo work remains sharp, reactive, and relentlessly authentic.</p>
            </div>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'how-to-optimize-heavy-bag-workouts.html',
        title: 'How to Optimize Your Heavy Bag Workouts with an Audio Callout Timer',
        desc: 'Actionable tips and training methods for using a kickboxing combo generator to improve your shadow boxing and heavy bag sessions.',
        date: 'Aug 23, 2026',
        tag: 'App Guides',
        content: `
            <h1>How to Optimize Your Heavy Bag Workouts with an Audio Callout Timer</h1>
            ${renderMeta('Shotcaller Sam', 'August 23, 2026')}

            <p>A heavy bag is arguably the most valuable piece of equipment for a solo martial artist. However, without direction, staring at a bag for three minutes often reinforces bad habits. You fatigue, your output drops, and you stop practicing defense.</p>

            <p>Using an audio callout timer or combo generator like <strong>Shot Caller Nak Muay</strong> immediately fixes this by outsourcing the mental load of <em>what</em> to throw. Here is how to structure your session to get the most out of it.</p>

            <h2>1. Warm Up with Intent</h2>
            <p>Don't jump immediately into complex, high-intensity combinations. Use your first two rounds purely to warm up the nervous system.</p>
            <p>In Shot Caller, set your style to <strong>"Nak Muay Newb"</strong> or <strong>"Meat & Potatoes"</strong> for rounds one and two. These modes prioritize fundamental, high-percentage strikes (1-2s, single kicks, teeps). Focus 100% on your balance, the snap of your punches, and returning to your stance perfectly after every strike.</p>

            <h2>2. Don't Stare at the Screen</h2>
            <p>The entire point of an <em>audio</em> callout timer is to keep your eyes forward. Put your phone on a bench or tripod out of your direct line of sight. Keep your chin tucked, eyes on the "opponent" (the center of the bag), and rely entirely on your hearing to react.</p>

            <h2>3. Treat Defensive Calls as Real Threats</h2>
            <p>When the app calls <strong>"Check"</strong> or <strong>"Slip,"</strong> do it with urgency. Treat the heavy bag as if it is actively fighting back. If the combo is "Check, Lead Hook, Low Kick," envision the incoming kick, physically raise your block to meet it, plant your foot firmly, and explode into the hook.</p>

            <h2>4. Divide Your Rounds by Style</h2>
            <p>To avoid monotony in a 6 or 8-round workout, change your fighting style focus every two rounds. A fantastic template looks like this:</p>
            <ul>
                <li><strong>Rounds 1-2:</strong> Warmup / Meat & Potatoes.</li>
                <li><strong>Rounds 3-4:</strong> <em>Muay Mat</em> focus. The app will prioritize heavy hands finishing with low kicks. Dig your feet in and throw with bad intentions.</li>
                <li><strong>Rounds 5-6:</strong> <em>Muay Tae</em> focus. The engine will call an exhausting amount of body and head kicks. Focus on hip rotation and flexibility.</li>
            </ul>

            <div class="verdict">
                <h3>Track Your Consistency</h3>
                <p>Progress in combat sports isn't made in a single, brutal workout; it's made through weeks of relentless consistency. Use Shot Caller's <strong>Workout Log</strong> feature to track the rounds you put in, and trust the process.</p>
            </div>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'overcoming-the-muay-thai-learning-curve.html',
        title: 'Overcoming the Muay Thai Learning Curve: How to Keep Training When It Gets Hard',
        desc: 'Muay Thai is famously brutal on beginners. Here is how to conquer the early learning curve and use tools like a combination generator to build confidence.',
        date: 'Aug 22, 2026',
        tag: 'Training Mindset',
        content: `
            <h1>Overcoming the Muay Thai Learning Curve: How to Keep Training When It Gets Hard</h1>
            ${renderMeta('Shotcaller Sam', 'August 22, 2026')}

            <p>The first few months of Muay Thai training are notoriously difficult. Unlike some fitness routines where you can simply "muscle through" a workout, the Art of 8 Limbs requires tremendous coordination, balance, and fine motor skills. When your shins are bruised, your hips are tight, and you still can't throw a roundhouse without losing your balance, it’s easy to feel entirely demoralized.</p>

            <p>Every single practitioner—from your gym's newest white shirt to world champions fighting at Rajadamnern Stadium—started exactly where you are. Here is how to navigate the infamous Muay Thai learning curve.</p>

            <h2>Embrace Being Bad </h2>
            <p>The biggest roadblock to progression isn't physical weakness; it is the ego. Beginners often paralyze themselves with frustration because they expect their body to immediately perform complex biomechanical movements. A proper Muay Thai roundhouse is a full-body whipping motion that contradicts natural human instinct. It takes thousands of repetitions to wire into your nervous system. Expect to be clumsy, and embrace the awkwardness as data you can use to correct your form.</p>

            <h2>Focus on Balance Before Power</h2>
            <p>When beginners hit the heavy bag, their instinct is to throw as hard as possible. This is a mistake. Power is the byproduct of proper technique, and proper technique is supported entirely by balance.</p>
            <p>If you fall off-center after throwing a teep, or if you have to take three stutter-steps to catch yourself after missing a hook, you are prioritizing power over structure. Slow down. Throw strikes at 40% speed and focus entirely on whether your feet are back in a solid stance afterward.</p>

            <h2>Outsource the Mental Load</h2>
            <p>When shadowing boxing or hitting the bag outside of class, beginners often "freeze up" because they simply don't know what combinations to throw. This leads to them drilling the same 1-2, 1-2 over and over, stunting their growth.</p>
            <p>This is exactly why tools like <strong>Shot Caller Nak Muay</strong> are so effective for beginners. By using an audio callout timer in "Nak Muay Newb" mode, the app tells you exactly what to throw. You don't have to invent combinations; you simply listen to the callout (e.g., "Jab, Cross, Teep"), throw the sequence, reset your stance, and wait for the next command. It removes the paralyzing "what do I do next" anxiety.</p>

            <h2>Shadow Box in the Mirror</h2>
            <p>The heavy bag is forgiving; it stops your momentum. Shadow boxing is where true technique is forged because it forces you to control your own body weight. Spending just ten minutes a day shadow boxing in front of a mirror allows you to monitor your guard (are your hands dropping?) and your stance (are your feet too narrow?).</p>

            <div class="verdict">
                <h3>The 10,000 Rep Rule</h3>
                <p>There are no shortcuts or cheat codes in Muay Thai. The learning curve is flattened entirely by repetition. Show up to class, check your ego at the door, and use your solo training days to slowly, methodically wire the fundamentals into your muscle memory.</p>
            </div>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'getting-started-with-shot-caller-callouts.html',
        title: 'Overcoming the App Learning Curve: Mastering Thai Callouts',
        desc: 'Intimidated by true Muay Thai terminology? Here is how to use Shot Caller\'s built-in guided paths and technique library to confidently learn the callouts.',
        date: 'Aug 21, 2026',
        tag: 'App Guides',
        content: `
            <h1>Overcoming the App Learning Curve: Mastering Thai Callouts</h1>
            ${renderMeta('Shotcaller Sam', 'August 21, 2026')}

            <p>One of the most common pieces of feedback we get from new users is: <em>"This app is amazing, but I don't know what half of these words mean!"</em></p>

            <p>We purposefully built <strong>Shot Caller Nak Muay</strong> using authentic Thai terminology. Instead of "Front Kick," you hear <strong>"Teep."</strong> Unlike boxing apps that just use numbers, you hear commands to <strong>"Check"</strong> or <strong>"Lean Back."</strong> If you are transitioning from western boxing, or if you are entirely new to martial arts, this audio learning curve can feel intimidating. Don't worry—we built specific features into the app to help you master it.</p>

            <h2>1. Use the "Start Here" Guided Path</h2>
            <p>You don't need to learn 50 different strikes on day one. On the app's home screen, you will find a <strong>"Start Here"</strong> section containing a 10-level guided path. Level 1 starts with only the most basic punches and a standard roundhouse kick. As you complete rounds and progress through the levels, the app slowly drip-feeds new vocabulary (like elbows, checks, and parries) into your sessions.</p>

            <h2>2. Explore the Technique Library</h2>
            <p>If the app calls out a technique and you find yourself freezing because you don't know how to throw it, tap the <strong>"Learn"</strong> button in the bottom navigation bar. Our comprehensive technique library contains an entry for every single callout in the app.</p>
            <p>Tap on a technique to see exactly how it is spelled, hear its audio pronunciation in isolation, and read a breakdown of how the strike or defense should be executed.</p>

            <h2>3. Stick to "Nak Muay Newb" Mode</h2>
            <p>When you are setting up your workout, Shot Caller allows you to select your fighting style Focus. Resist the urge to jump straight into complex styles like <em>Muay Femur</em> (which is heavy on tricky counters) or <em>Muay Sok</em> (which calls endless close-range elbows).</p>
            <p>Select the <strong>"Nak Muay Newb"</strong> style. This mode restricts the combination generator to simple, 2-to-3 strike combos using foundational techniques. It gives you the space to react to basic Thai terms without getting overwhelmed by complex strings of attacks.</p>

            <div class="verdict">
                <h3>It Only Takes a Few Sessions</h3>
                <p>Learning the callouts is just like learning the physical techniques: it requires a little bit of repetition. After three or four sessions with the app, your brain will stop translating "Teep" into "Push Kick" and you will simply lift your leg and fire. Lean on the Learn tab, start at Level 1, and enjoy the process of becoming a true Nak Muay.</p>
            </div>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'muay-thai-styles-explained.html',
        title: 'The Major Muay Thai Styles Explained: Muay Mat, Muay Tae, & More',
        desc: 'Understand the different fighting styles in Muay Thai (Muay Mat, Muay Femur, Muay Khao, Muay Tae) and how to train them.',
        date: 'Aug 20, 2026',
        tag: 'Technique',
        content: `
            <h1>The Major Muay Thai Styles Explained</h1>
            ${renderMeta('Shotcaller Sam', 'August 20, 2026')}
            <p>One of the beautiful things about Muay Thai is that no two fighters look exactly the same. The sport recognizes several primary "styles" of fighting, which dictate a fighter's strategy and favored weapons.</p>
            <h2>Muay Mat (Heavy Puncher/Low Kicker)</h2>
            <p>A Muay Mat relies on forward pressure, heavy hands, and devastating low kicks. They aim to end the fight early through sheer power and volume. <strong>How to train it:</strong> Sit down on your punches, focus on boxing combinations that end in hard leg kicks, and practice cutting off the ring.</p>
            <h2>Muay Tae (The Kicker)</h2>
            <p>A Muay Tae controls the distance and scores heavily with roundhouse kicks to the body and arms. They use kicks to break an opponent's guard and drain their stamina. <strong>How to train it:</strong> Volume kicking. Drill double and triple roundhouses off the same leg, and focus on fast retractions.</p>
            <h2>Muay Khao (The Knee Fighter)</h2>
            <p>A Muay Khao excels at moving forward, absorbing or parrying strikes, and wrapping their opponent in the clinch to deliver relentless knees. <strong>How to train it:</strong> Work the heavy bag at close range, stepping straight in, establishing a collar tie, and throwing marching knees.</p>
            <h2>Muay Femur (The Technician)</h2>
            <p>A Muay Femur is a master of timing, evasion, and counters. They fight beautifully, often leaning backward to evade high kicks and returning with sharp teeps or fast strikes. <strong>How to train it:</strong> Lower your output volume but increase your precision. Drill checks, slips, and immediately returning fire.</p>
            <div class="verdict">
                <h3>Train Them All with Shot Caller</h3>
                <p>Shot Caller Nak Muay features dedicated style modes for all of these approaches. Select "Muay Mat" to receive boxing-heavy callouts, or "Muay Khao" to be prompted for relentless knees and clinch work.</p>
            </div>
            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'dutch-kickboxing-vs-muay-thai.html',
        title: 'Dutch Kickboxing vs. Traditional Muay Thai: How They Differ',
        desc: 'What is the difference between Dutch rules kickboxing and traditional Muay Thai? Explore the rules, stances, and combo philosophy.',
        date: 'Aug 19, 2026',
        tag: 'Comparisons',
        content: `
            <h1>Dutch Kickboxing vs. Traditional Muay Thai</h1>
            ${renderMeta('Shotcaller Sam', 'August 19, 2026')}
            <p>While both are devastating striking arts, Dutch Kickboxing and Traditional Muay Thai have deeply varied philosophies developed under different rulesets and cultural influences.</p>
            <h2>The Rules Dictate the Style</h2>
            <p>Traditional Muay Thai allows elbows, extensive clinching, sweeps, and catches. This leads to a taller, more evenly weighted stance to allow for quick checks and teeps (push kicks).</p>
            <p>Dutch Kickboxing (the style popularized by legends like Ramon Dekkers and Ernesto Hoost) traditionally prohibits elbows and severely limits the clinch. Fighters stand with a heavier, more boxing-oriented base, relying on a tight guard to block kicks rather than checking them.</p>
            <h2>Combo Generation: Volume vs. Single Power Strikes</h2>
            <p>A typical Muay Thai exchange might consist of a teep to establish distance, followed by a singular, crushing body kick. Evasion is prioritized.</p>
            <p>Dutch kickboxing is built on high-pressure combinations. A fighter will throw a heavy 3-to-4 punch boxing combination specifically designed to open up the guard, finishing the sequence with a devastating low kick.</p>
            <div class="verdict">
                <h3>Drill Both on the Heavy Bag</h3>
                <p>You don't have to choose permanently. Inside Shot Caller Nak Muay, you can select the <strong>Dutch Kickboxing</strong> style mode to drill high-volume boxing-to-low-kick combos, or switch to traditional Thai modes to practice your teeps and checks. Being proficient in both rhythms makes you a much deadlier striker.</p>
            </div>
            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'building-custom-combinations.html',
        title: 'How to Build Custom Muay Thai Combinations for the Heavy Bag',
        desc: 'Stop throwing the same 1-2-kick every round. Learn how to sequence logical, effective custom combinations for your solo workouts.',
        date: 'Aug 18, 2026',
        tag: 'App Guides',
        content: `
            <h1>How to Build Custom Muay Thai Combinations</h1>
            ${renderMeta('Shotcaller Sam', 'August 18, 2026')}
            <p>One of the easiest traps to fall into during a heavy bag session is combo stagnation. If you rely on muscle memory without actively thinking, your brain will naturally default to the path of least resistance: a jab, a cross, and a right roundhouse.</p>
            <p>To train properly, you need to sequence strikes that logically set up the next strike.</p>
            <h2>The Formula for a Good Combination</h2>
            <ul>
                <li><strong>Change Levels:</strong> Don't throw all strikes at the head. A jab (high) sets up a rear body hook (low), which in turn drops the opponent's guard for a head kick (high).</li>
                <li><strong>Alternate Sides:</strong> (Left-Right-Left-Right). If your last strike was a right cross, your weight naturally shifts over your left leg, making a left hook or a left switch-kick the fastest, most powerful follow-up.</li>
                <li><strong>Mask the Kick with Punches:</strong> Throwing a naked low kick is easily checked. Instead, throw a 3-punch combo. As the opponent raises their guard to protect their face, their vision is obscured, making the low kick invisible until it lands.</li>
            </ul>
            <div class="verdict">
                <h3>Taking Control in Shot Caller</h3>
                <p>While dynamic generation is great, sometimes you want to drill a specific fight plan. Shot Caller Nak Muay’s <strong>Technique Editor</strong> allows you to build completely custom combo sets. Select the exact strikes you want to chain together, uncheck the ones you don't want to drill today, and let the app cycle through your personalized playbook.</p>
            </div>
            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'gamifying-the-grind-workout-logs.html',
        title: 'Gamifying the Grind: Why Tracking Training Streaks Matters',
        desc: 'Consistency beats intensity every time. Discover how logging workouts and hitting streak goals can keep you showing up to the bag.',
        date: 'Aug 17, 2026',
        tag: 'Behind The Scenes',
        content: `
            <h1>Gamifying the Grind: Why Tracking Training Streaks Matters</h1>
            ${renderMeta('Shotcaller Sam', 'August 17, 2026')}
            <p>In combat sports, the most dangerous fighter isn't the most talented one; it's the one who shows up every single day. A thirty-minute heavy bag session done five days a week will absolutely eclipse a single, grueling three-hour session done once a month.</p>
            <p>But building that daily habit is incredibly difficult, especially when you are training alone without a coach holding you accountable.</p>
            <h2>The Psychology of the Streak</h2>
            <p>This is where gamification becomes a valid psychological tool. By tracking your training days and forcing yourself not to "break the streak," you shift your goal from an arbitrary performance metric to a simple binary outcome: <em>Did I show up today? Yes or no.</em></p>
            <h2>Tracking with Charms and Logs</h2>
            <p>We purposefully built a <strong>Workout Log</strong> and a <strong>Charm (Achievement) System</strong> into Shot Caller Nak Muay for exactly this reason.</p>
            <ul>
                <li><strong>Visual Accountability:</strong> After every round you complete via the app timer, the session is logged. You can review your history to ensure your volume isn't dropping off over the month.</li>
                <li><strong>Earning Charms:</strong> As you hit escalating round counts (10, 50, 100, 500 rounds), you earn digital charms. It sounds trivial, but that tiny hit of dopamine can be exactly the push you need to put your wraps on when you don't feel like training.</li>
            </ul>
            <div class="verdict">
                <h3>Focus on Volume</h3>
                <p>Stop worrying about whether your strikes feel perfect every session. Focus purely on putting time on the clock. Open Shot Caller, commit to just three rounds, log the session, and keep the streak alive. The technique will follow.</p>
            </div>
            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'solo-drills-muay-khao.html',
        title: 'Solo Heavy Bag Drills for the Muay Khao (Knee Fighter)',
        desc: 'How to utilize the heavy bag when you favor the clinch and knees over long-range striking.',
        date: 'Aug 16, 2026',
        tag: 'Technique',
        content: `
            <h1>Solo Heavy Bag Drills for the Muay Khao</h1>
            ${renderMeta('Shotcaller Sam', 'August 16, 2026')}
            <p>A Muay Khao is a fighter who thrives in the clinch, relentlessly marching forward to deliver devastating knees. But training the clinch is difficult when you are hitting a heavy bag alone in your garage. How do you simulate an opponent pulling you down?</p>
            <h2>Working the Bag for the Clinch</h2>
            <ul>
                <li><strong>Establishing the Collar Tie:</strong> Instead of standing back and throwing punches, march into the bag, reach your hands high on the leather (or around the top straps), and anchor your elbows down. Clinch the bag tightly to your chest.</li>
                <li><strong>Marching Knees:</strong> While maintaining the collar tie, drive your hip into the bag, lift your knee straight up and spear the bag. Alternate legs, using the bag's swing to time your steps forward.</li>
                <li><strong>The Skip-Knee (Khao Loi):</strong> From outside step range, drive off your rear foot, jump into the air, and spear the bag with your rear knee, landing directly into a clinch tie-up.</li>
            </ul>
            <div class="verdict">
                <h3>Using the Muay Khao Mode</h3>
                <p>Shot Caller Nak Muay has a dedicated <strong>Muay Khao</strong> style focus. By selecting it, the audio engine will heavily bias its combinations toward closing the distance with punches and ending with clinch tie-ups, marching knees, and skip-knees. It's the perfect digital coach for the relentless pressure fighter.</p>
            </div>
            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'shadow-boxing-defense-drills.html',
        title: 'Stop Forgetting Defense: How to Drill Checks and Parries Solo',
        desc: 'A heavy bag doesn\'t hit back. Here is how to maintain a defensive mindset through automated audio callouts.',
        date: 'Aug 15, 2026',
        tag: 'Technique',
        content: `
            <h1>Stop Forgetting Defense: Drilling Checks and Parries Solo</h1>
            ${renderMeta('Shotcaller Sam', 'August 15, 2026')}
            <p>The single biggest flaw of solo heavy bag training is that the bag doesn't hit back. When there is no physical consequence for dropping your hands or standing completely square, your brain subconsciously stops dedicating resources to defense.</p>
            <p>This is how fighters develop beautiful, powerful striking combinations that leave them completely exposed to a counter-hook.</p>
            <h2>Simulating Threats with Audio Callouts</h2>
            <p>You have to force your brain to react defensively. If you are shadow boxing, you need an external trigger to tell you when a strike is coming. This is why a digital pad-holder app is practically mandatory for solo work.</p>
            <p>In <strong>Shot Caller Nak Muay</strong>, defense is baked into the combat algorithm. The app doesn't just call out punches; it regularly commands defensive actions mid-combo.</p>
            <ul>
                <li>When the app calls <strong>"Check"</strong>, elevate your knee to your elbow with a strong frame, hold for a split second, and look for a counter strike.</li>
                <li>When the app calls <strong>"Slip"</strong>, dip your shoulder and take your head off the centerline, setting yourself up for an immediate hook.</li>
                <li>When the app calls <strong>"Parry"</strong>, execute a tight, controlled slap on an imaginary incoming jab before returning fire.</li>
            </ul>
            <div class="verdict">
                <h3>Treat the Audio as Gospel</h3>
                <p>If the app tells you to check, do not ignore it. Your goal is to map the audio cue to your muscles instantly. By reacting to random defensive callouts on the bag, you wire your brain to keep your guard active when returning to sparring.</p>
            </div>
            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'structuring-5-round-heavy-bag-workout.html',
        title: 'The Ultimate 5-Round Heavy Bag Workout Structure',
        desc: 'A complete round-by-round layout for a 15-minute heavy bag session that builds cardio, power, and technique.',
        date: 'Aug 14, 2026',
        tag: 'Training Plans',
        content: `
            <h1>The Ultimate 5-Round Heavy Bag Workout Structure</h1>
            ${renderMeta('Shotcaller Sam', 'August 14, 2026')}
            <p>Walking up to the heavy bag and blindly striking for 15 minutes is a recipe for fatigue and poor form. A structured session with specific goals for each round maximizes your cardio output while keeping the brain engaged.</p>
            <p>Fire up the <strong>Shot Caller Nak Muay</strong> timer, set it for 3-minute rounds with 1-minute rests, and follow this 5-round layout.</p>
            
            <h2>Round 1: The Warmup (Nak Muay Newb)</h2>
            <p>Set the app focus to <em>Nak Muay Newb</em>. Throw strikes at 30% power. The goal here is solely to establish rhythm, get a sweat going, and ensure you are exhaling sharply on every strike and returning to your guard.</p>
            
            <h2>Round 2: Teeps and Distance (Muay Femur)</h2>
            <p>Set the app focus to <em>Muay Femur</em>. Try to stay entirely out of punch range. When the app calls a combination, step in quickly, execute it, and immediately step out or teep the bag away. Focus entirely on footwork and range management.</p>
            
            <h2>Round 3: Inside Pressure (Muay Khao)</h2>
            <p>Set the focus to <em>Muay Khao</em>. Stay close to the bag. Smother the leather and focus on heavy knees, tight elbows (sok), and short, thudding hooks. Do not back up.</p>
            
            <h2>Round 4: Heavy Hands (Muay Mat)</h2>
            <p>Set the focus to <em>Muay Mat</em>. Plant your feet and throw your punches with 80% to 90% power, finishing combinations with crushing low kicks. This is your power and conditioning round.</p>
            
            <h2>Round 5: Freestyle Flow (Meat & Potatoes)</h2>
            <p>Set the focus to <em>Meat & Potatoes</em> for classic, high-percentage combos. You are fatigued now—the goal of round 5 is strictly maintaining good form while exhausted. Keep your hands high, bite down on your mouthpiece, and react to the commands until the bell rings.</p>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'mastering-the-teep.html',
        title: 'Mastering the Teep: The Most Important Strike in Muay Thai',
        desc: 'A breakdown of the Teep (push kick). How to throw it, when to throw it, and why it is the jab of Muay Thai.',
        date: 'Aug 12, 2026',
        tag: 'Technique',
        content: `
            <h1>Mastering the Teep: The Most Important Strike in Muay Thai</h1>
            ${renderMeta('Shotcaller Sam', 'August 12, 2026')}
            <p>If boxing relies on the jab to measure distance, blind the opponent, and dictate the pace, Muay Thai relies on the <strong>Teep</strong> (the push kick) to do the exact same thing at a much longer range.</p>
            <p>A fighter with a fast, heavy, and highly accurate front teep can completely shut down an aggressive puncher by off-balancing them every time they attempt to step forward.</p>
            <h2>How to Execute the Teep</h2>
            <p>Unlike a karate push kick, the Muay Thai teep is heavily reliant on the hips.</p>
            <ul>
                <li><strong>The Chamber:</strong> Lift your lead knee straight up to your chest. Your foot should remain flexed.</li>
                <li><strong>The Drive:</strong> Extend your leg directly into the opponent's solar plexus or beltline. As you extend, thrust your hips forward, leaning your torso slightly back to counterbalance the momentum.</li>
                <li><strong>The Target:</strong> Strike with the ball of the foot, not the entire flat sole. This concentrates the force into a smaller surface area, causing a sharper impact.</li>
            </ul>
            <div class="verdict">
                <h3>Drill It Relentlessly</h3>
                <p>When you are using Shot Caller Nak Muay, the app will constantly command you to <strong>"Teep."</strong> Do not throw it softly. Treat the heavy bag as an encroaching opponent. Jab it with your foot, stop the bag's swing entirely, and re-establish your stance immediately.</p>
            </div>
            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
    {
        filename: 'shadow-boxing-vs-heavy-bag.html',
        title: 'Shadow Boxing vs Heavy Bag: Where Should You Spend Your Time?',
        desc: 'Analyzing the different benefits of shadow boxing in the mirror versus conditioning strikes on the heavy bag.',
        date: 'Aug 11, 2026',
        tag: 'Training Plans',
        content: `
            <h1>Shadow Boxing vs Heavy Bag: Where Should You Spend Your Time?</h1>
            ${renderMeta('Shotcaller Sam', 'August 11, 2026')}
            <p>A frequent question among beginners is whether they should focus their solo training days on the heavy bag or on shadow boxing. The answer is that both are absolute necessities, as they train completely different aspects of striking.</p>
            <h2>The Role of the Heavy Bag</h2>
            <p>The heavy bag is your resistance tool. You cannot build genuine knockout power without an object returning force against your shins and knuckles. Generating deep, structural power requires you to feel the impact, condition your bones, and learn how to snap a strike through a solid object rather than just stopping at the surface.</p>
            <h2>The Role of Shadow Boxing</h2>
            <p>The heavy bag tells a lie: it stops your momentum. If you throw yourself off-balance with a wild hook, the bag holds you up. Shadow boxing strips this away.</p>
            <p>When you shadow box (ideally in front of a mirror), your body is forced to control its own inertia. A missed roundhouse requires core strength to pull back into a stance. Shadow boxing hones your center of gravity, refines your guard, and builds the fluid footwork that the heavy bag naturally restricts.</p>
            <div class="verdict">
                <h3>Combine Both with Audio Callouts</h3>
                <p>Shot Caller Nak Muay is designed for both tools. Use the app timer for 2 rounds of pure shadow boxing to warm up your nervous system and check your balance, then put on your gloves and hit the bag for the next 3 rounds to put that technique into practice under resistance.</p>
            </div>
            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    }
];

// Generate index.html: magazine-style masthead, category filter pills, a
// featured story (the newest post), then a responsive grid of the rest.
const [featuredPost, ...restPosts] = posts;
const categories = [...new Set(posts.map(p => p.tag))];

const filterBar = `
    <div class="filter-bar">
        <button class="filter-pill active" data-filter="all">All Articles</button>
        ${categories.map(tag => `<button class="filter-pill" data-filter="${tag}">${tag}</button>`).join('')}
    </div>
`;

const indexContent = `
    ${renderHead('Muay Thai Training Blog - Shot Caller', 'Guides on shadow boxing, heavy bag drills, and combo-calling timers.', 'https://shotcallernakmuay.netlify.app/blog/', 'container--wide')}
    <div class="masthead">
        <span class="masthead-kicker">Shot Caller Nak Muay</span>
        <h1>The Fight IQ Journal</h1>
        <p>Training breakdowns, app guides, and behind-the-scenes notes for solo Nak Muays.</p>
    </div>
    ${filterBar}
    ${renderFeatured(featuredPost)}
    <div class="post-grid">
        ${restPosts.map(renderPostCard).join('')}
    </div>
    <script>
    (function () {
        var pills = document.querySelectorAll('.filter-pill');
        var cards = document.querySelectorAll('[data-tag]');
        pills.forEach(function (pill) {
            pill.addEventListener('click', function () {
                pills.forEach(function (p) { p.classList.remove('active'); });
                pill.classList.add('active');
                var filter = pill.getAttribute('data-filter');
                cards.forEach(function (card) {
                    var show = filter === 'all' || card.getAttribute('data-tag') === filter;
                    card.style.display = show ? '' : 'none';
                });
            });
        });
    })();
    </script>
    ${renderFoot()}
`;

fs.writeFileSync(path.join(outDir, 'index.html'), indexContent, 'utf-8');

// Generate all posts: strip each post's hardcoded back-link, and append a
// category eyebrow, related-articles grid, and prev/next navigation instead.
posts.forEach((post, i) => {
    const prev = posts[i - 1] || null;
    const next = posts[i + 1] || null;
    const related = posts
        .filter(p => p.filename !== post.filename && p.tag === post.tag)
        .slice(0, 3);

    const body = post.content.replace(
        /<a href="\/blog\/index\.html" class="back-link">[\s\S]*?<\/a>\s*$/,
        ''
    );

    const html = `
        ${renderHead(post.title, post.desc, `https://shotcallernakmuay.netlify.app/blog/${post.filename}`)}
        <a href="/blog/index.html" class="back-link-top">&larr; All Articles</a>
        ${renderArticleEyebrow(post)}
        ${body}
        ${renderRelated(related)}
        ${renderPrevNext(prev, next)}
        <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        ${renderFoot()}
    `;
    fs.writeFileSync(path.join(outDir, post.filename), html, 'utf-8');
});

console.log('Blog site successfully generated!');
