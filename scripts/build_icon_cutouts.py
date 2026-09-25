"""Lift the neon icons off their baked-in dark backgrounds.

The icon art is drawn as glowing line work on a flat dark field and shipped as
opaque RGB. That field was invisible while the cards it sat on were the same
navy. Against the brand's plum-black (`#0c0710`, from `social-cards.mjs`) it
reads as a square behind the art, so the field has to come out.

Reads `assets-src/raster/*.png` and writes `public/assets/*.webp`. It never
reads its own output, so running it twice is the same as running it once.

## How the field comes out

The art is glow on dark, which is additive, so coverage is recoverable by
subtraction: whatever is brighter than the field is art, and how much brighter
is how opaque. Alpha below a few counts floors to zero, which clears the
vignette and the encoder noise in the field and is most of why these stay
small.

## Why some are un-premultiplied and some are not

Leaving the colour channels as they shipped is cheap but wrong at the edges. A
pixel that is half field and half glow keeps the field mixed into it, and
straight alpha then composites that dilution over a card darker than the field,
so the stroke lands dimmer than the artwork really is.

On thick, bright art nobody sees it. On thin strokes it is the whole mark - it
is why the footer logo first looked dark at 22px.

Un-premultiplying divides the coverage back out and recovers the true colour.
It costs file size, because dividing the faint outer halo by a near-zero alpha
amplifies noise the encoder then has to store; at 1024 square that doubled the
file for no visible gain. Downscaled first, there is no halo left to amplify
and it costs nothing. So: un-premultiply what ends up small or thin, leave what
stays large and bright.

## Why trimming matters

The art is centred in a square canvas with wide margins. Opaque, those margins
were part of the picture. Transparent, they are invisible but still occupy
layout - which is what put a gap under the trophy that no CSS margin accounted
for, because a third of the element's height was empty canvas.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

SRC = "assets-src/raster"
OUT = "public/assets"


def _resize_premultiplied(img: Image.Image, max_edge: int) -> Image.Image:
    """Downscale without darkening the edges.

    Resampling straight alpha averages transparent black into every edge pixel
    and re-darkens exactly what un-premultiplying just fixed, so the resample
    happens on premultiplied channels and is undone afterwards.
    """
    w, h = img.size
    if max(w, h) <= max_edge:
        return img
    scale = max_edge / max(w, h)
    target = (max(1, round(w * scale)), max(1, round(h * scale)))

    a = np.asarray(img).astype(np.float32)
    pm = np.dstack([a[:, :, :3] * (a[:, :, 3:4] / 255.0), a[:, :, 3:4]])
    small = np.asarray(
        Image.fromarray(pm.astype(np.uint8), mode="RGBA").resize(target, Image.LANCZOS)
    ).astype(np.float32)
    alpha = np.maximum(small[:, :, 3:4], 1)
    out = np.dstack([np.clip(small[:, :, :3] * 255.0 / alpha, 0, 255), small[:, :, 3:4]])
    return Image.fromarray(out.astype(np.uint8), mode="RGBA")


def cutout(
    name: str,
    out_name: str | None = None,
    max_edge: int | None = None,
    unpremultiply: bool = False,
    trim: bool = False,
    quality: int = 92,
    alpha_quality: int = 100,
) -> None:
    src = f"{SRC}/{name}.png"
    dst = f"{OUT}/{out_name or name}.webp"

    a = np.asarray(Image.open(src).convert("RGB")).astype(np.int16)

    # The field is flat, so any corner is a fair sample of it.
    field = a[0, 0, :].astype(np.int16)

    diff = np.clip(a - field, 0, 255)
    alpha = diff.max(axis=2)
    alpha[alpha < 6] = 0

    if unpremultiply:
        rgb = np.clip(
            diff.astype(np.float32) * 255.0 / np.maximum(alpha, 1)[:, :, None], 0, 255
        ).astype(np.uint8)
        rgb = np.where(alpha[:, :, None] > 0, rgb, 0)
    else:
        rgb = np.where(alpha[:, :, None] > 0, a, 0).astype(np.uint8)

    img = Image.fromarray(np.dstack([rgb, alpha.astype(np.uint8)]), mode="RGBA")

    if trim:
        box = img.getchannel("A").getbbox()
        if box:
            img = img.crop(box)

    if max_edge is not None:
        img = _resize_premultiplied(img, max_edge)

    img.save(
        dst,
        "WEBP",
        lossless=False,
        quality=quality,
        alpha_quality=alpha_quality,
        method=6,
    )
    print(f"{dst}: field rgb{tuple(int(v) for v in field)} -> {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    # The completion screen's belt. Thin strokes over a wide frame, so it is
    # un-premultiplied; the trophy it replaced was thick enough not to need it.
    #
    # Sized and encoded down harder than the others on purpose. Pillow stores
    # WebP alpha losslessly by default, and on art that is mostly soft glow the
    # alpha channel, not the colour, is the file: 800px with lossless alpha came
    # to 97KB, which is larger than any other asset in the project and half
    # again the header banner. 480px at alpha_quality 80 is 39KB and comfortably
    # over the size it is drawn at, which soft neon edges absorb without showing.
    cutout(
        "icon_belt",
        max_edge=480,
        trim=True,
        unpremultiply=True,
        quality=88,
        alpha_quality=80,
    )

    # The same belt with the gloves-and-bolt mark in its medallion, which is
    # what the completion screen actually draws — see build_belt_medallion.py,
    # which writes that source from this one. Identical settings, because it is
    # the same artwork with a mark drawn in the same neon.
    cutout(
        "icon_belt_logo",
        max_edge=480,
        trim=True,
        unpremultiply=True,
        quality=88,
        alpha_quality=80,
    )

    # The footer mark, drawn at 28px. Deliberately not trimmed: its margins are
    # what keep it optically the same size as the type beside it.
    cutout("logo_icon", out_name="logo_mark", max_edge=128, unpremultiply=True)
