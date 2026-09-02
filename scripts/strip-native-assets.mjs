import fs from 'fs';
import path from 'path';

// The blog is Netlify-only marketing content, static-generated into
// public/blog and copied verbatim into dist/blog by Vite. It has no reason
// to ship inside the native app bundle, so this runs between `npm run build`
// and `cap sync` to drop it before native assets are synced.
//
// assets/blog holds the screenshots those posts embed. They live under
// assets/ so the pages can reference them at a stable path, but they are the
// same marketing-only content and would otherwise ride into the app bundle.
//
// home.html is the same story: it is the site's marketing landing page, served
// at `/` by a Netlify rewrite. The native shells load dist/index.html directly
// and never route through Netlify, so it is dead weight in the app bundle.
const NATIVE_EXCLUDED_PATHS = [
    'dist/blog',
    'dist/assets/blog',
    'dist/assets/landing', // the landing page's cropped captures
    'dist/home.html',
];

for (const target of NATIVE_EXCLUDED_PATHS) {
    const resolved = path.resolve(target);
    if (fs.existsSync(resolved)) {
        fs.rmSync(resolved, { recursive: true, force: true });
        console.log(`[strip-native-assets] Removed ${target} from the native build output.`);
    }
}
