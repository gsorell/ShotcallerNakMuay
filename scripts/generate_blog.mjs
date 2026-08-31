import fs from 'fs';
import path from 'path';

const outDir = path.resolve('public/blog');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const baseStyle = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;500;600&family=Public+Sans:wght@400;500;600;800&display=swap">
    <style>
        /* ===================================================================
           Palette taken from the technique sheets themselves. The silhouettes
           are hot pink on transparent, so the ground has to stay dark for them
           to glow; every neutral carries a violet bias rather than sitting on
           a flat grey, which is what keeps the pink from looking pasted on.
           Deliberately single-theme - this is the app's world, not a document.
           =================================================================== */
        :root {
            --bg: #0c0710;
            --card-bg: #16101f;
            --panel-2: #1e1629;
            --card-border: #2e2240;
            --edge-2: #3d2d54;
            --accent: #ff5fb0;
            --accent-hover: #ff8ac6;
            --cold: #7cc7f2;
            --heading: #f4eef6;
            --text: #c7b8d1;
            --muted: #9d8fa9;
            --dim: #6d6079;

            /* Anton ships one weight (400). Never ask for a heavier one - the
               browser synthesises a faux-bold and the condensed face smears. */
            --display: 'Anton', Impact, 'Arial Narrow Bold', sans-serif;
            --body: 'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            --mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        * { box-sizing: border-box; }
        body {
            font-family: var(--body);
            line-height: 1.7;
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }
        :focus-visible { outline: 2px solid var(--cold); outline-offset: 2px; }

        .navbar {
            background-color: #0a0510;
            height: 94px;
            display: flex;
            align-items: stretch;
            justify-content: center;
            border-bottom: 1px solid var(--card-border);
            padding: env(safe-area-inset-top) 0 0 0;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .navbar .logo {
            cursor: pointer;
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

        /* Wide enough for the index grid; the article container centres itself
           at 720px inside it, so widening this does not widen running text.
           (The old 980px silently clamped .container--wide, which is 1120.) */
        .page-wrapper {
            max-width: 1160px;
            margin: 40px auto;
            padding: 20px;
            min-height: calc(100vh - 94px - 140px);
            display: flex;
            flex-direction: column;
        }

        /* Flat. The article sits directly on the ink ground; panels are for
           things that are genuinely set apart, not for the page itself. */
        .container {
            width: 100%;
            max-width: 720px;
            margin: 0 auto;
            background: none;
            border: 0;
            border-radius: 0;
            box-shadow: none;
            padding: 0;
        }
        .container--wide { max-width: 1120px; }

        /* ------------------------------------------------------------ type */
        h1, h2, h3 {
            color: var(--heading);
            font-family: var(--display);
            font-weight: 400;
            letter-spacing: 0.005em;
            text-wrap: balance;
            margin-top: 2em;
            margin-bottom: 0.7em;
        }
        h1 {
            font-size: clamp(2.1rem, 5.4vw, 3.05rem);
            line-height: 1;
            margin-top: 0;
            margin-bottom: 0.35em;
        }
        h2 {
            font-size: clamp(1.55rem, 3.4vw, 2rem);
            line-height: 1.06;
            border-bottom: 1px solid var(--card-border);
            padding-bottom: 12px;
        }
        h3 { font-size: 1.3rem; line-height: 1.15; }
        p { font-size: 1.115rem; margin-bottom: 1.5em; }
        ul { margin-bottom: 1.5em; font-size: 1.115rem; padding-left: 20px; }
        li { margin-bottom: 0.6em; }
        li::marker { color: var(--accent); }
        strong, .highlight { color: var(--heading); font-weight: 600; }

        a { color: var(--cold); text-decoration: none; font-weight: 500; transition: color 0.2s, border-color 0.2s; }
        a:hover { color: #a6dcf7; }
        /* Underline only links sitting in running prose - cards and nav are
           anchors too, and a rule on bare \`a\` puts a line under all of them. */
        p a, li a, td a {
            border-bottom: 1px solid rgba(124, 199, 242, 0.32);
        }
        p a:hover, li a:hover, td a:hover { border-bottom-color: var(--cold); }

        .meta {
            font-family: var(--mono);
            color: var(--dim);
            font-size: 0.82rem;
            letter-spacing: 0.04em;
            margin-bottom: 2.8em;
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .meta strong { color: var(--muted); font-weight: 500; }

        /* The author mark is a real technique sheet held on its extension
           frame - square, like the figure boxes in the app's own shelf. */
        .author-avatar {
            width: 46px;
            height: 46px;
            border-radius: 3px;
            background: var(--card-bg);
            border: 1px solid var(--accent);
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

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 2.2em 0;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 3px;
            overflow: hidden;
            font-size: 1.02rem;
        }
        th, td { padding: 13px 16px; border: 1px solid var(--card-border); text-align: left; }
        th {
            background: var(--panel-2);
            color: var(--muted);
            font-family: var(--mono);
            font-size: 0.74rem;
            font-weight: 500;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }

        /* --------------------------------------------------------- callout */
        .verdict {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-left: 2px solid var(--accent);
            border-radius: 0 3px 3px 0;
            padding: 22px 24px;
            margin: 2.5em 0;
        }
        .verdict h3 {
            margin: 0 0 10px;
            font-family: var(--mono);
            font-weight: 500;
            font-size: 0.78rem;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--accent);
        }
        .verdict p:last-child { margin-bottom: 0; }

        /* ----------------------------------------------------- index chrome */
        .masthead {
            text-align: left;
            padding: 8px 0 34px;
            border-bottom: 1px solid var(--card-border);
            margin-bottom: 34px;
        }
        .masthead-kicker {
            display: inline-block;
            font-family: var(--mono);
            font-size: 0.72rem;
            font-weight: 500;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: var(--accent);
            margin-bottom: 18px;
        }
        .masthead h1 {
            font-size: clamp(2.6rem, 7vw, 4.4rem);
            text-transform: uppercase;
            line-height: 0.94;
            margin: 0 0 16px;
        }
        .masthead h1 em { font-style: normal; color: var(--accent); }
        .masthead p { font-size: 1.1rem; color: var(--muted); max-width: 58ch; margin: 0; }

        .filter-bar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 40px; }
        .filter-pill {
            font-family: var(--mono);
            font-size: 0.74rem;
            font-weight: 500;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--text);
            background: transparent;
            border: 1px solid var(--edge-2);
            border-radius: 3px;
            padding: 9px 15px;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .filter-pill:hover { border-color: var(--accent); color: var(--accent); }
        .filter-pill.active { background: var(--accent); border-color: var(--accent); color: #180a12; }

        .category-chip {
            display: inline-block;
            /* The grid cards are column flex containers, which stretch a plain
               inline-block child to the full card width. The chip has a solid
               background, so that reads as a coloured bar rather than a tag. */
            align-self: flex-start;
            font-family: var(--mono);
            font-size: 0.66rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.11em;
            padding: 4px 9px;
            border-radius: 2px;
            margin-bottom: 14px;
            color: #12070f;
        }

        /* The lead story borrows the "selected" treatment from the app's own
           panes: neon edge, warmed ground. Everything else stays quiet. */
        .featured-card {
            display: block;
            background: #1a0f18;
            border: 1px solid var(--accent);
            border-radius: 3px;
            padding: 36px;
            margin-bottom: 40px;
            text-decoration: none !important;
            transition: background 0.2s ease, transform 0.2s ease;
        }
        .featured-card:hover { background: #22131f; transform: translateY(-2px); }
        .featured-label {
            display: block;
            font-family: var(--mono);
            font-size: 0.72rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.16em;
            color: var(--accent);
            margin-bottom: 16px;
        }
        .featured-card h2 { font-size: clamp(1.7rem, 3.6vw, 2.2rem); margin: 0 0 14px; border: none; padding: 0; }
        .featured-card p { font-size: 1.08rem; color: var(--text); margin-bottom: 18px; }

        .post-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 3px;
            padding: 24px;
            margin-bottom: 20px;
            transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
            display: block;
            text-decoration: none !important;
        }
        .post-card:hover { transform: translateY(-2px); border-color: var(--accent); background: var(--panel-2); }
        .post-card h2 {
            border: none;
            padding: 0;
            margin: 0 0 10px;
            font-size: 1.32rem;
            line-height: 1.1;
            color: var(--heading) !important;
        }
        .post-card p { margin: 0; font-size: 1rem; color: var(--muted); }

        .post-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; align-items: start; }
        .post-grid .post-card { margin-bottom: 0; display: flex; flex-direction: column; }

        .card-meta {
            font-family: var(--mono);
            color: var(--dim);
            font-size: 0.72rem;
            font-weight: 500;
            letter-spacing: 0.09em;
            text-transform: uppercase;
            margin-top: 16px;
        }
        .read-more {
            display: inline-flex;
            align-self: flex-start;
            align-items: center;
            gap: 6px;
            margin-top: 14px;
            font-family: var(--mono);
            font-size: 0.72rem;
            font-weight: 500;
            letter-spacing: 0.11em;
            text-transform: uppercase;
            color: var(--accent);
        }
        .post-card:hover .read-more, .featured-card:hover .read-more { color: var(--accent-hover); }

        /* --------------------------------------------------- article chrome */
        .back-link-top {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-family: var(--mono);
            font-size: 0.72rem;
            font-weight: 500;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--accent);
            margin-bottom: 28px;
        }
        .back-link-top:hover { color: var(--accent-hover); }
        .back-link {
            display: inline-block;
            margin-top: 4em;
            border-top: 1px solid var(--card-border);
            padding-top: 1.6em;
            width: 100%;
            text-align: left;
            font-family: var(--mono);
            font-size: 0.75rem;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--accent);
        }

        .article-eyebrow { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .article-eyebrow .category-chip { margin-bottom: 0; }
        .read-time {
            font-family: var(--mono);
            font-size: 0.72rem;
            font-weight: 500;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--dim);
        }

        .post-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 3em; padding-top: 2em; border-top: 1px solid var(--card-border); }
        .post-nav a {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 3px;
            padding: 16px 18px;
            text-decoration: none !important;
            transition: border-color 0.2s ease, transform 0.2s ease;
        }
        .post-nav a:hover { border-color: var(--accent); transform: translateY(-2px); }
        .post-nav-label {
            display: block;
            font-family: var(--mono);
            font-size: 0.68rem;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: var(--accent);
            font-weight: 500;
            margin-bottom: 8px;
        }
        .post-nav-title { color: var(--heading); font-family: var(--display); font-weight: 400; font-size: 1.05rem; line-height: 1.15; display: block; }
        .post-nav-next { text-align: right; }

        .related-section { margin-top: 3.4em; }
        .related-section h3 { border: none; padding: 0; margin: 0 0 0.2em; font-size: 1.5rem; }
        .related-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 18px; margin-top: 1.2em; }
        .related-grid .post-card { padding: 20px; margin-bottom: 0; }
        .related-grid .post-card h2 { font-size: 1.08rem; }

        /* ------------------------------------------------ app screenshots */
        /* Phone captures, so they are held to a phone's width rather than let
           loose across the column - a 720px-wide screenshot of a 420px screen
           reads as a mistake. */
        .shot { margin: 2.6em 0; }
        .shot img {
            display: block;
            width: 100%;
            max-width: 330px;
            /* REQUIRED alongside the width/height attributes. Those attributes
               are presentational hints, so without this the intrinsic height
               (1800px) wins and every screenshot renders stretched to 2.5x. */
            height: auto;
            margin: 0 auto;
            border: 1px solid var(--card-border);
            border-radius: 4px;
        }
        .shot figcaption {
            font-family: var(--mono);
            font-size: 0.72rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--dim);
            text-align: center;
            margin-top: 14px;
            line-height: 1.6;
        }
        .shot-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
        .shot-pair img { max-width: 100%; }
        @media (max-width: 520px) {
            .shot-pair { grid-template-columns: 1fr; }
        }

        .hero { background: var(--card-bg); border: 1px solid var(--card-border); padding: 30px; border-radius: 3px; margin-bottom: 40px; }
        .hero h1 { margin-top: 0; font-size: 2.1rem; }
        .hero p { color: var(--muted); margin-bottom: 0; }

        /* ------------------------------------------------------ store CTA */
        /* The reason this block exists: every CTA on this site used to point
           at "/", the PWA - which cannot sell Pro, because RevenueCat is never
           configured on web. A reader who wanted the app had to find the
           stores themselves. These are the only links here that lead to a
           purchase, so they get the accent and the full width. */
        .store-cta {
            background: linear-gradient(160deg, var(--panel-2), var(--card-bg));
            border: 1px solid var(--edge-2);
            border-radius: 3px;
            padding: 30px;
            margin: 50px 0 10px;
            text-align: center;
        }
        .store-cta h3 {
            font-family: var(--display);
            font-size: 1.8rem;
            font-weight: 400;
            letter-spacing: 0.01em;
            color: var(--heading);
            margin: 0 0 10px;
        }
        .store-cta p { color: var(--muted); margin: 0 auto 22px; max-width: 46ch; }
        .store-cta-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            justify-content: center;
        }
        .store-cta-button {
            display: inline-block;
            padding: 13px 24px;
            border-radius: 3px;
            font-weight: 600;
            font-size: 0.95rem;
            text-decoration: none;
            border: 1px solid var(--accent);
            background: var(--accent);
            color: #1a0a12;
            transition: background 0.2s ease, color 0.2s ease;
        }
        .store-cta-button:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
        .store-cta-button--alt { background: transparent; color: var(--accent); }
        .store-cta-button--alt:hover { background: rgba(255,95,176,0.12); color: var(--accent-hover); }
        .store-cta-note { color: var(--dim); font-size: 0.82rem; margin: 18px 0 0; }

        /* ---------------------------------------------------------- footer */
        .app-footer {
            margin-top: 60px;
            background: #0a0510;
            border-top: 1px solid var(--card-border);
            padding: 26px 16px
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
            border-radius: 3px;
            object-fit: cover;
            opacity: 0.75;
            cursor: pointer;
            transition: opacity 0.2s ease;
        }
        .app-footer-logo:hover { opacity: 1; }
        .app-footer-link {
            color: var(--dim);
            font-family: var(--mono);
            font-size: 0.72rem;
            font-weight: 500;
            text-decoration: none;
            transition: color 0.2s ease;
            text-transform: uppercase;
            letter-spacing: 0.12em;
        }
        .app-footer-link:hover { color: var(--accent); }
        .app-footer-social img { width: 24px; height: 24px; opacity: 0.55; transition: opacity 0.2s ease; }
        .app-footer-social:hover img { opacity: 1; }

        @media (max-width: 600px) {
            .post-nav { grid-template-columns: 1fr; }
            .post-nav-next { text-align: left; }
            .featured-card { padding: 26px; }
        }
        @media (prefers-reduced-motion: reduce) {
            * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
            .post-card:hover, .post-nav a:hover, .featured-card:hover { transform: none; }
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
// Category colours, pulled toward the violet ground so eight chips read as one
// set rather than eight unrelated highlighters. Every one of these takes dark
// text (#12070f) at AA, which is what the chip style assumes.
const CATEGORY_COLORS = {
    'Comparisons': '#7cc7f2',
    'Technique': '#ff5fb0',
    'App Guides': '#a98bff',
    'Training Plans': '#5fd6a8',
    'Behind The Scenes': '#ffa552',
    'Training Mindset': '#ff8ac6',
    'Gear Guides': '#ffd166',
    'Fitness': '#5fd0d6',
};

const renderCategoryChip = (tag) => `<span class="category-chip" style="background: ${CATEGORY_COLORS[tag] || '#94a3b8'};">${tag}</span>`;

// ~200 words/min, estimated off the rendered post body (tags stripped).
const estimateReadTime = (html) => {
    const words = html.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
};

// ===========================================================================
// STORE LINKS
// ---------------------------------------------------------------------------
// Campaign-tagged, because an untagged install is an install you cannot
// attribute: the blog is the top of the funnel and there was previously no way
// to tell whether any of it produced a single download.
//
// Play reads `referrer`, which the Play Install Referrer API hands back to the
// app after install, and which Play Console reports on directly.
//
// Apple reads `ct` (campaign token) and `pt` (provider token). Without `pt`,
// App Analytics cannot attribute the click to a campaign - `ct` alone still
// tags the URL, but nothing groups it. Get the value by generating a campaign
// link in App Store Connect -> App Analytics -> Acquisition -> Campaigns and
// copying the `pt` out of it; see docs/CONVERSION_INSTRUMENTATION.md.
//
// SET THIS and re-run `node scripts/generate_blog.mjs`. While it is null the
// links still work and still carry `ct`, they just are not grouped.
// ===========================================================================
const PLAY_APP_ID = 'com.shotcallernakmuay.app';
const APPLE_APP_ID = '6757487630';
const APPLE_PROVIDER_TOKEN = null;

const playUrl = (campaign) => {
    const referrer = encodeURIComponent(
        `utm_source=blog&utm_medium=organic&utm_campaign=${campaign}`
    );
    return `https://play.google.com/store/apps/details?id=${PLAY_APP_ID}&referrer=${referrer}`;
};

const appleUrl = (campaign) => {
    const params = [
        ...(APPLE_PROVIDER_TOKEN ? [`pt=${APPLE_PROVIDER_TOKEN}`] : []),
        `ct=${encodeURIComponent(campaign)}`,
        'mt=8',
    ];
    return `https://apps.apple.com/us/app/shot-caller-nak-muay/id${APPLE_APP_ID}?${params.join('&')}`;
};

/**
 * The download block. `campaign` is the post slug, so a click can be traced
 * back to the article that earned it rather than to "the blog".
 */
const renderStoreCta = (campaign) => `
    <div class="store-cta">
        <h3>Train To It Tonight</h3>
        <p>Shot Caller Nak Muay calls real Muay Thai combinations out loud while you work. Free to start &mdash; the round timer, Freestyle and Nak Muay Newb cost nothing.</p>
        <div class="store-cta-buttons">
            <a href="${appleUrl(campaign)}" class="store-cta-button">Download on iPhone &amp; iPad</a>
            <a href="${playUrl(campaign)}" class="store-cta-button store-cta-button--alt">Get it on Google Play</a>
        </div>
        <p class="store-cta-note">Prefer to try it in the browser first? <a href="/">Open the web version</a>.</p>
    </div>
`;

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
        filename: 'learn-module-guided-path-technique-library.html',
        title: 'From Your First Jab to Every Callout: Inside the New Learn Module',
        desc: 'Shot Caller Nak Muay now ships a guided eleven-level path and a library of 35 moving technique figures, so a beginner can see what the app is calling and work up to using the whole thing.',
        date: 'Aug 31, 2026',
        tag: 'Behind The Scenes',
        content: `
            <h1>From Your First Jab to Every Callout: Inside the New Learn Module</h1>
            ${renderMeta('Shotcaller Sam', 'August 31, 2026')}
            <p>A combo-calling app has one failure mode that nothing else about it can fix: it shouts <em>&ldquo;1 2 3, Right Low Kick&rdquo;</em> at somebody who doesn&rsquo;t yet know what <strong>3</strong> means. Every feature past that point &mdash; the timer, the styles, the round structure &mdash; is sitting behind a wall the beginner can&rsquo;t get over.</p>
            <p>The new <strong>Learn</strong> module is the way over it. Two halves: a guided path that hands you the vocabulary in a deliberate order, and a library where every technique the app calls is now something you can actually <em>look at</em>.</p>

            <figure class="shot">
                <img src="/assets/blog/learn-landing.webp" alt="The Learn screen in Shot Caller Nak Muay, showing the Start Here guided path card above category filters reading All 35, Punches 11, Kicks 7, Knees 2, Elbows 4, Defense and Movement 11." loading="lazy" width="840" height="1800">
                <figcaption>Learn, in two halves &mdash; the guided path on top, the reference underneath</figcaption>
            </figure>

            <h2>The Path: Ten Levels, In An Order That Means Something</h2>
            <p>The problem was never a shortage of material. It was <strong>sequence</strong>. <em>Nak Muay Newb</em> is 32 individual techniques and every one of them is live from the first bell &mdash; set the difficulty to Novice and a first-timer still gets hit with the full vocabulary immediately.</p>
            <p><strong>Start Here</strong> is a curated ordering of that exact pool. Ten levels to graduation, each one introducing two to five techniques and then drilling them against everything already learned:</p>
            <ul>
                <li><strong>Hands before legs.</strong> Lowest injury risk, fastest wins. Levels 1 and 2 are the jab, cross and both hooks.</li>
                <li><strong>Distance before power.</strong> The teep comes before any round kick &mdash; it&rsquo;s the safest thing the lead leg can do and it teaches range, which every later kick depends on.</li>
                <li><strong>Defense the moment you can be countered.</strong> Level 5 is checks and guards, deliberately placed straight after kicks. The moment you can kick, you can be kicked.</li>
                <li><strong>Committed shots last.</strong> Uppercuts, the overhand and the head kick punish bad fundamentals hardest, so they wait until level 10.</li>
            </ul>
            <p>The ladder is honest about where you are, because the point isn&rsquo;t the levels &mdash; it&rsquo;s the coverage. The progress bar counts how much of the callout vocabulary you can actually answer to.</p>

            <figure class="shot">
                <img src="/assets/blog/roadmap-ladder.webp" alt="The Start Here ladder: ten levels from Stance and the Two Numbers through The Committed Shots, plus a bonus elbow level, with a progress bar reading 0 of 32 callouts." loading="lazy" width="840" height="1800">
                <figcaption>&ldquo;You answer to 0 of 32 callouts&rdquo; &mdash; the ladder measures coverage, not levels</figcaption>
            </figure>

            <p>Graduate level 10 and the union of everything you&rsquo;ve been taught is <em>exactly</em> the 32 techniques Nak Muay Newb draws from. Not approximately &mdash; a test in the codebase enforces it, so the curriculum can&rsquo;t quietly drift away from what the app actually says out loud. After that there&rsquo;s a bonus eleventh level for elbows.</p>

            <h2>The Library: 35 Figures You Can Look At</h2>
            <p>A written lesson can tell you the round kick turns the hip over. It can&rsquo;t show you the shape. Every technique on the shelf now carries a moving figure &mdash; 35 of them across 28 techniques, with seven shot from both sides because the two sides genuinely differ.</p>
            <p>Here&rsquo;s the part that does the real work: <strong>the number sits right under the name.</strong> Jab 1. Cross 2. Left Hook 3. The shelf isn&rsquo;t just a reference &mdash; it&rsquo;s a decoder for the thing the app is shouting at you.</p>

            <figure class="shot">
                <img src="/assets/blog/learn-shelf.webp" alt="The technique shelf showing neon silhouette figures in a grid, each labelled with its name and callout number: Jab 1, Cross 2, Left Hook 3, Right Hook 4, Left Uppercut 5, Right Uppercut 6." loading="lazy" width="840" height="1800">
                <figcaption>The number under the name &mdash; the shelf decodes the callouts</figcaption>
            </figure>

            <p>Categories are a filter that narrows in place rather than a screen you push into, so looking something up mid-session is a tap and a scroll instead of three taps and a back button.</p>

            <h2>Every Figure Is A Lesson</h2>
            <p>Tap one and you get the written technique behind it: what it is, the key points, and the common mistakes &mdash; the ones that actually cost you, like kicking with the instep instead of the shin, or dropping the kicking-side hand right when the counter cross arrives.</p>
            <p>The figure runs six frames in 1.15 seconds, which is about 190 milliseconds a pose. That&rsquo;s right when you want the rhythm and useless when you want to know where the rear heel is at the moment of extension &mdash; so there are transport controls. Back, play, forward, and the arrow keys step. Pause lands on the extension frame, the one each figure was built around.</p>

            <figure class="shot">
                <img src="/assets/blog/learn-lesson.webp" alt="The Roundhouse Kick lesson page, showing the technique figure held at full extension above the written description and a Key Points list." loading="lazy" width="840" height="1800">
                <figcaption>Roundhouse Kick, held on the extension frame</figcaption>
            </figure>

            <h2>Then The Loop Closes</h2>
            <p>This is the bit that makes it a learning module rather than a glossary. Every lesson knows where it sits in the path, and every lesson can start a round.</p>
            <p><strong>Taught at level 4 of Start Here</strong> takes you to the level that drills it. <strong>Drill it</strong> loads a style that calls it and starts the timer. So the reference and the curriculum point at each other in both directions, and both of them point at actually training.</p>

            <figure class="shot">
                <img src="/assets/blog/learn-loop.webp" alt="The bottom of a lesson page: a link reading Taught at level 4 of Start Here, The Round Kick, above a Drill It panel listing styles that call the technique." loading="lazy" width="840" height="1564">
                <figcaption>Look it up &rarr; find it in the path &rarr; drill it. In two taps.</figcaption>
            </figure>

            <p>That&rsquo;s the whole reason the library lives inside the app instead of on a website. Looking a technique up and drilling it are two halves of the same errand.</p>

            <h2>Southpaws Included</h2>
            <p>Every figure was shot orthodox, so a southpaw browsing the library used to be looking at someone standing the other way round from them. Turn on <strong>Southpaw Mode</strong> and the figures mirror &mdash; and so does every name that carries a side.</p>
            <p>The numbering doesn&rsquo;t move, because it was always stance-relative: 3 is your lead hook whichever way you stand, and that&rsquo;s already what the callout engine says out loud. There&rsquo;s more on training left-handed <a href="/blog/southpaw-muay-thai-training-guide.html">in our southpaw guide</a>.</p>

            <h2>A Note On How They Were Made</h2>
            <p>Worth saying, because it took months longer than the alternative: the figures are cut from real footage, frame by frame. None of them are AI-generated.</p>
            <p>Image generators produce something worse than obviously wrong &mdash; they produce plausible and wrong. A flat rear foot on a cross. A &ldquo;check&rdquo; that&rsquo;s really a knee. Errors that look fine to exactly the person least equipped to spot them, which is the person using a beginner module. Not a great trade for saving an afternoon.</p>

            <h2>What&rsquo;s Free, And What&rsquo;s Missing</h2>
            <p>Level 1 of the path is free and the whole ladder is visible. Browsing the shelf is free too &mdash; the figures, the names and the numbers are all there before you pay anything. Opening a full lesson and levels 2 onward are part of Pro.</p>
            <p>And 37 techniques in the written library still have no figure, all thirteen feints among them. A lesson without one isn&rsquo;t on the shelf at all, because a grid full of placeholders reads as a half-built page where a shelf of real figures reads as a library. Each one appears the moment its footage is shot.</p>

            <div class="verdict">
                <h3>Start At Level 1, Not At The Timer</h3>
                <p>If you&rsquo;re new, don&rsquo;t start by picking a style and hitting go &mdash; that&rsquo;s the wall. Open Learn, begin level 1, and let the path hand you the vocabulary two techniques at a time. Ten levels later the entire app is talking a language you speak.</p>
            </div>

            <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        `
    },
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

            <figure class="shot">
                <img src="/assets/blog/app-training-options.webp" alt="Advanced Settings in Shot Caller Nak Muay showing Training Options: Southpaw Mode, Include Calisthenics and Read Techniques in Order, above the rounds, length and rest controls." loading="lazy" width="840" height="1400">
                <figcaption>Advanced Settings &rarr; Southpaw Mode. One toggle, and every &ldquo;Left&rdquo; and &ldquo;Right&rdquo; flips.</figcaption>
            </figure>


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

            <figure class="shot">
                <img src="/assets/blog/app-setup.webp" alt="The style selection screen with Muay Mat and Muay Tae selected, above a bar setting rounds, length, rest and difficulty." loading="lazy" width="840" height="1880">
                <figcaption>Round count, round length and rest are the three dials that decide the session.</figcaption>
            </figure>

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

            <figure class="shot">
                <img src="/assets/blog/app-training-options.webp" alt="Advanced Settings in Shot Caller Nak Muay showing Training Options: Southpaw Mode, Include Calisthenics and Read Techniques in Order, above the rounds, length and rest controls." loading="lazy" width="840" height="1400">
                <figcaption>Include Calisthenics mixes bodyweight work into the same callout stream.</figcaption>
            </figure>


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

            <figure class="shot">
                <img src="/assets/blog/app-callout.webp" alt="A live round in Shot Caller Nak Muay: Round 1 of 5, a 2:52 round clock, and the technique Low Kick called on screen above Pause and Stop." loading="lazy" width="840" height="1440">
                <figcaption>A live round: what is called, and how long is left.</figcaption>
            </figure>

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

            <figure class="shot">
                <img src="/assets/blog/app-callout.webp" alt="A live round in Shot Caller Nak Muay: Round 1 of 5, a 2:52 round clock, and the technique Low Kick called on screen above Pause and Stop." loading="lazy" width="840" height="1440">
                <figcaption>One technique at a time, called out loud, against a running round clock.</figcaption>
            </figure>

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

            <figure class="shot">
                <img src="/assets/blog/app-callout.webp" alt="A live round in Shot Caller Nak Muay: Round 1 of 5, a 2:52 round clock, and the technique Low Kick called on screen above Pause and Stop." loading="lazy" width="840" height="1440">
                <figcaption>A digital pad-holder: it calls the shot, you throw it.</figcaption>
            </figure>

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

            <figure class="shot">
                <img src="/assets/blog/app-callout.webp" alt="A live round in Shot Caller Nak Muay: Round 1 of 5, a 2:52 round clock, and the technique Low Kick called on screen above Pause and Stop." loading="lazy" width="840" height="1440">
                <figcaption>The screen is the fallback &mdash; the callout is audio first.</figcaption>
            </figure>


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

            <figure class="shot">
                <img src="/assets/blog/roadmap-ladder.webp" alt="The Start Here ladder: ten levels from Stance and the Two Numbers through The Committed Shots, with a progress bar reading 0 of 32 callouts." loading="lazy" width="840" height="1800">
                <figcaption>The path decides the order, so you don&rsquo;t have to.</figcaption>
            </figure>

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

            <figure class="shot">
                <img src="/assets/blog/roadmap-ladder.webp" alt="The Start Here ladder: ten levels from Stance and the Two Numbers through The Committed Shots, with a progress bar reading 0 of 32 callouts." loading="lazy" width="840" height="1800">
                <figcaption>Ten levels, and a bar counting how much of the callout vocabulary you can answer to.</figcaption>
            </figure>


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

            <figure class="shot">
                <img src="/assets/blog/app-setup.webp" alt="The style selection screen with Muay Mat and Muay Tae selected, above a bar setting rounds, length, rest and difficulty." loading="lazy" width="840" height="1880">
                <figcaption>Select one style or stack several &mdash; the callout pool is the union of what you pick.</figcaption>
            </figure>

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

            <figure class="shot">
                <img src="/assets/blog/app-manage.webp" alt="The Technique Manager screen, where technique sets can be edited, favourited, or built into a new custom style." loading="lazy" width="840" height="1800">
                <figcaption>Technique Manager: edit a set, star favourites, or build a style of your own.</figcaption>
            </figure>

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

            <figure class="shot">
                <img src="/assets/blog/app-loglist.webp" alt="The Workout Logs summary: current and best streak, earned and locked charms, and a recent workouts list with one logged session." loading="lazy" width="840" height="1280">
                <figcaption>Streaks, charms and the session list &mdash; all written the moment a workout completes.</figcaption>
            </figure>

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

            <figure class="shot">
                <img src="/assets/blog/lesson-knee.webp" alt="The Straight Knee lesson page, showing the technique figure above its written description." loading="lazy" width="840" height="1800">
                <figcaption>The Straight Knee lesson, with the figure you can step through frame by frame.</figcaption>
            </figure>

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

            <figure class="shot">
                <img src="/assets/blog/shelf-defense.webp" alt="The Defense and Movement shelf: eleven technique figures including slips, rolls, checks, guards, duck, lean back and pivot." loading="lazy" width="840" height="1800">
                <figcaption>All eleven defensive figures in one place &mdash; slips, rolls, checks, guards.</figcaption>
            </figure>

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

            <figure class="shot">
                <img src="/assets/blog/app-setup.webp" alt="The style selection screen with Muay Mat and Muay Tae selected, above a bar setting rounds, length, rest and difficulty." loading="lazy" width="840" height="1880">
                <figcaption>Rounds, length and rest sit on one bar; difficulty sets how dense the callouts get.</figcaption>
            </figure>

            
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

            <figure class="shot">
                <img src="/assets/blog/lesson-teep.webp" alt="The Lead Teep lesson page, showing the technique figure held at extension above the written description and key points." loading="lazy" width="840" height="1800">
                <figcaption>The Lead Teep, held on its extension frame.</figcaption>
            </figure>

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
        <h1>The Fight <em>IQ</em> Journal</h1>
        <p>Training breakdowns, app guides, and behind-the-scenes notes for solo Nak Muays.</p>
    </div>
    ${filterBar}
    ${renderFeatured(featuredPost)}
    <div class="post-grid">
        ${restPosts.map(renderPostCard).join('')}
    </div>
    ${renderStoreCta('blog-index')}
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
        ${renderStoreCta(post.filename.replace(/\.html$/, ''))}
        ${renderRelated(related)}
        ${renderPrevNext(prev, next)}
        <a href="/blog/index.html" class="back-link">&larr; Back to all posts</a>
        ${renderFoot()}
    `;
    fs.writeFileSync(path.join(outDir, post.filename), html, 'utf-8');
});

console.log('Blog site successfully generated!');
