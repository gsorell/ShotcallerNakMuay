#!/usr/bin/env python3
"""Shrink public/assets/*.png to WebP at the sizes the UI actually renders.

The art in public/assets arrived as 1024x1024 (and in one case 5001x5001)
near-uncompressed PNG masters, while the UI draws them at 56-84 CSS px. That
cost 57 MB, and because strip-native-assets.mjs only drops the blog, all of it
rode into the iOS and Android bundles as well as the web payload.

WebP rather than optimized PNG: on this art WebP is ~22x smaller than a
re-encoded PNG (PNG has no lossy mode, and these are painterly gradients, its
worst case). There is no fallback path and none is needed - the technique
sprites and the manifest icons already ship as WebP only, so every browser
that can run this app already decodes it. ImageWithFallback's onError still
drops to the emoji if one ever fails to load.

Two things deliberately do NOT become WebP:

  * hero_og.jpg is emitted as JPEG at the 1200x630 OpenGraph aspect. og:image
    is read by Facebook, X and LinkedIn scrapers, whose WebP support is
    inconsistent - and LinkedIn's is absent. The pages used to point at the
    1600x900 hero PNG, which was both the wrong ratio and 1.4 MB.
  * The merch, QR and debug captures in SKIP are untracked working files that
    do not belong to the app. They are left exactly as they are.

Converted masters are moved to assets-src/raster/ rather than deleted. Nothing
is thrown away: assets-src is already where this repo keeps source art, and
the point is only to get them out of public/, which is the directory Vite
copies into dist wholesale. Git stores them by content hash, so relocating
them costs no new repo space.

Run after scripts/build_logo_banner.py, which writes fresh full-size
Logo_Header_Banner_*.png into public/assets and would otherwise undo this -
that script now re-invokes this one for exactly that reason. Re-running is
safe and idempotent: a converted PNG is no longer in public/assets, so a
second pass finds nothing to do.

Usage:
    python scripts/optimize_assets.py [--keep] [--dry-run]

    --keep     leave the source PNG in public/assets next to the WebP
    --dry-run  report what would change, write nothing
"""

import argparse
import os
import shutil
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover - environment guard
    sys.exit("Pillow is required:  pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "public", "assets")
MASTERS = os.path.join(ROOT, "assets-src", "raster")

# Untracked working files: shirt artwork, QR codes and the sprite-edge audit
# captures. Not app assets, not ours to rewrite.
SKIP_PREFIXES = ("qr-", "shirt-back", "silhouette-", "sprite-edge-audit")

# The largest the UI ever draws one of these, times a 3x device pixel ratio,
# rounded up. .roadmap-detail-art is the biggest at 5.25rem (84 px) -> 252,
# so 320 clears every icon site with room to spare.
ICON_EDGE = 320

# Header banner: width:100% capped at maxHeight 96px on a 4.62:1 wordmark is
# ~444 CSS px wide, so 1400 covers 3x. social-cards.mjs also consumes the
# Transparency copy and resizes it to 600 wide, well inside this.
BANNER_WIDTH = 1400

# Full-viewport grain, drawn at opacity 0.12 under mixBlendMode: overlay.
# Detail is not recoverable at that blend, so it does not need to be 1024.
TEXTURE_EDGE = 768

OG_SIZE = (1200, 630)


def plan(name, width, height):
    """Return (longest-edge cap, webp quality) for one file, or None to skip."""
    if name.startswith(SKIP_PREFIXES):
        return None
    if name.startswith("hero_"):
        # Background photography, drawn with object-fit: cover across the
        # whole viewport. Keep the pixels, drop the encoding waste.
        return max(width, height), 82
    if name.startswith("Logo_Header_Banner"):
        # A wordmark on transparency: ringing around the letterforms shows,
        # so this one buys a higher quality than the painterly art does.
        return BANNER_WIDTH, 88
    if name == "texture_overlay.png":
        return TEXTURE_EDGE, 80
    return ICON_EDGE, 82


def has_alpha(im):
    if im.mode in ("RGBA", "LA"):
        return True
    return im.mode == "P" and "transparency" in im.info


def convert(path, cap, quality, dry_run, keep):
    name = os.path.basename(path)
    before = os.path.getsize(path)
    im = Image.open(path)
    w, h = im.size

    scale = min(1.0, cap / max(w, h))
    size = (max(1, round(w * scale)), max(1, round(h * scale)))
    out = path[: -len(".png")] + ".webp"

    if dry_run:
        return name, before, None, (w, h), size

    im = im.convert("RGBA" if has_alpha(im) else "RGB")
    if size != (w, h):
        im = im.resize(size, Image.LANCZOS)
    im.save(out, "WEBP", quality=quality, method=6)

    if not keep:
        # Retire the master to assets-src rather than dropping it: this only
        # needs it out of public/, which ships wholesale.
        os.makedirs(MASTERS, exist_ok=True)
        shutil.move(path, os.path.join(MASTERS, name))
    return name, before, os.path.getsize(out), (w, h), size


def write_og_image(dry_run):
    """Emit the OpenGraph card as JPEG, cropped to the 1.91:1 scrapers expect."""
    src = os.path.join(ASSETS, "hero_desktop.png")
    if not os.path.exists(src):
        # Already converted on an earlier run; fall back to the WebP.
        src = os.path.join(ASSETS, "hero_desktop.webp")
    if not os.path.exists(src):
        print("  ! no hero_desktop source found; skipping hero_og.jpg")
        return
    out = os.path.join(ASSETS, "hero_og.jpg")
    if dry_run:
        print(f"  hero_og.jpg            would be written  {OG_SIZE[0]}x{OG_SIZE[1]} JPEG")
        return

    im = Image.open(src).convert("RGB")
    # Cover-crop to 1.91:1 rather than squashing the framing.
    tw, th = OG_SIZE
    scale = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (im.width - tw) // 2
    top = (im.height - th) // 2
    im.crop((left, top, left + tw, top + th)).save(
        out, "JPEG", quality=85, optimize=True, progressive=True
    )
    print(f"  hero_og.jpg            {os.path.getsize(out) // 1024:>5} KB  "
          f"{tw}x{th} JPEG (og:image)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", action="store_true",
                    help="keep the source PNG next to the new WebP")
    ap.add_argument("--dry-run", action="store_true",
                    help="report what would change, write nothing")
    args = ap.parse_args()

    pngs = sorted(f for f in os.listdir(ASSETS) if f.lower().endswith(".png"))
    if not pngs:
        print("Nothing to do - no PNGs left in public/assets.")
        return

    before_total = after_total = 0
    skipped = []
    print(f"{'file':<38}{'before':>9}{'after':>9}   dimensions")
    print("-" * 76)
    for name in pngs:
        path = os.path.join(ASSETS, name)
        im = Image.open(path)
        rule = plan(name, *im.size)
        im.close()
        if rule is None:
            skipped.append(name)
            continue
        cap, quality = rule
        n, before, after, src_dim, dst_dim = convert(
            path, cap, quality, args.dry_run, args.keep
        )
        before_total += before
        after_total += after or 0
        dims = f"{src_dim[0]}x{src_dim[1]}"
        if dst_dim != src_dim:
            dims += f" -> {dst_dim[0]}x{dst_dim[1]}"
        shown = f"{after // 1024:>5} KB" if after is not None else "      -"
        print(f"{n:<38}{before // 1024:>6} KB{shown:>9}   {dims}")

    print("-" * 76)
    write_og_image(args.dry_run)

    if not args.dry_run:
        og = os.path.join(ASSETS, "hero_og.jpg")
        after_total += os.path.getsize(og) if os.path.exists(og) else 0
        saved = before_total - after_total
        print(f"\n{before_total // 1024} KB -> {after_total // 1024} KB "
              f"({saved // 1024} KB saved, "
              f"{saved * 100 // max(before_total, 1)}% smaller)")
    if skipped:
        print(f"\nLeft alone ({len(skipped)} untracked working files): "
              + ", ".join(skipped))


if __name__ == "__main__":
    main()
