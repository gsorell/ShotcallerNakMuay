#!/usr/bin/env python3
"""Generate the site favicons and the iOS home-screen icon from the app mark.

index.html shipped with Vite's own `/vite.svg` as its icon from the day the
project was scaffolded, so every tab, bookmark and history entry for Shot
Caller showed the Vite logo. There was also no apple-touch-icon at all, which
is what iOS reads when someone adds the PWA to their home screen - without it
Safari screenshots the page instead of using the mark.

The source is resources/icon.png, the same 1024x1024 master @capacitor/assets
builds the App Store and Play icons from, so the tab, the home screen and the
store listings cannot drift apart. It lives outside public/, which also keeps
it clear of scripts/optimize_assets.py.

PNG, not WebP, and not SVG:

  * apple-touch-icon must be PNG - iOS ignores WebP here, and the existing
    manifest icons are all WebP, which is why they cannot serve this role.
  * favicon.ico carries 16/32/48 so older Windows browsers and the Windows
    taskbar pick a crisp size instead of downsampling one themselves.
  * There is no SVG: the mark is painterly line art with gradients, not
    geometry, so there is no vector source to draw from.

iOS composites the touch icon onto a white sheet if it is transparent and
rounds the corners itself, so the master's opaque dark ground is left as-is
and no corner radius is applied here.

Usage:
    python scripts/build_favicons.py
"""

import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover - environment guard
    sys.exit("Pillow is required:  pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "resources", "icon.png")
OUT = os.path.join(ROOT, "public")

ICO_SIZES = [(16, 16), (32, 32), (48, 48)]
APPLE_TOUCH = 180  # the size current iOS asks for
PNG_FALLBACK = 96  # what Chrome and Firefox prefer when offered a choice

# A tab strip is mostly circles and rounded app tiles, and the mark's hard
# square corners were the one blunt shape in the row. 22% is the usual
# rounded-tile proportion; the art has ~14% clear margin at its tightest, so
# nothing gets bitten. The browser does not round favicons for you - only the
# touch icon gets masked by the OS, which is why that one stays square below.
CORNER_RADIUS = 0.22

# Supersample factor for the corner mask. Drawing the rounded rect at the
# final 16px and letting it alias produces visibly chunky stair-steps; drawing
# it large and shrinking gives a clean antialiased edge.
MASK_SS = 8


def rounded(im, size):
    """Square image -> RGBA at `size` with antialiased rounded corners."""
    im = im.resize((size, size), Image.LANCZOS).convert("RGBA")
    big = size * MASK_SS
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, big - 1, big - 1), radius=round(big * CORNER_RADIUS), fill=255
    )
    im.putalpha(mask.resize((size, size), Image.LANCZOS))
    return im


def main():
    if not os.path.exists(SRC):
        sys.exit(f"Missing icon master: {SRC}")

    master = Image.open(SRC).convert("RGB")
    written = []

    # Each ICO frame is rounded at its own size rather than rounding once and
    # downscaling, so the curve stays proportional and crisp at 16 as well as 48.
    ico = os.path.join(OUT, "favicon.ico")
    frames = [rounded(master, s) for s, _ in ICO_SIZES]
    frames[-1].save(ico, format="ICO", sizes=ICO_SIZES,
                    append_images=frames[:-1])
    written.append((ico, "16/32/48, rounded"))

    png = os.path.join(OUT, f"favicon-{PNG_FALLBACK}.png")
    rounded(master, PNG_FALLBACK).save(png, "PNG", optimize=True)
    written.append((png, f"{PNG_FALLBACK}x{PNG_FALLBACK}, rounded"))

    # Square and opaque on purpose. iOS masks the touch icon into its own
    # squircle, so rounding it here would round it twice, and the transparent
    # corners get flattened onto white on the home screen.
    apple = os.path.join(OUT, "apple-touch-icon.png")
    master.resize((APPLE_TOUCH, APPLE_TOUCH), Image.LANCZOS).save(
        apple, "PNG", optimize=True
    )
    written.append((apple, f"{APPLE_TOUCH}x{APPLE_TOUCH}, square (iOS masks it)"))

    for path, dims in written:
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        print(f"  {rel:<32}{os.path.getsize(path) // 1024:>4} KB   {dims}")


if __name__ == "__main__":
    main()
