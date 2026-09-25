"""Put the Shot Caller mark in the championship belt's medallion.

The belt art ships with a bare lightning bolt in its centre oval. The bolt is
generic — it is the one element of the completion screen that could belong to
any timer — while the gloves-and-bolt mark is the thing people already know the
app by from the header and the store listing. So the medallion carries the mark
instead.

Reads `assets-src/raster/icon_belt.png` and `assets-src/raster/logo_icon.png`
and writes `assets-src/raster/icon_belt_logo.png`, which
`build_icon_cutouts.py` then lifts off its field like any other source. Both
inputs are sources and the output is a new file, so this never reads its own
output and running it twice is the same as running it once. The original belt
source is left untouched, which is what makes this reversible: point the
completion screen back at `icon_belt` and nothing else has to change.

## Why the compositing happens here and not in CSS

Overlaying the mark on the belt with absolute positioning would have worked on
screen and then broken in the share card, which is rendered by html2canvas at
2x into a fixed-width node — two stacked images with percentage offsets are
exactly the kind of thing that lands half a pixel out there. One asset cannot
drift from itself.

## Why it is additive

These sources are glow drawn on a flat dark field, and glow is additive light,
which is the same reason `build_icon_cutouts.py` can recover alpha by
subtracting the field. So the mark is composited as light: subtract each
source's own field to get its glow, add the glows, add the field back. Pasting
RGB would have stamped the mark's near-black plum field as a rectangle in the
middle of the belt.

Clearing the bolt is the same idea in reverse — the interior of the oval is set
back to zero glow, which is what "nothing is drawn here" means in this domain.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

SRC = "assets-src/raster"

# Geometry, measured on the shipped 480x255 belt and expressed as fractions of
# its trimmed content box so it survives the source being re-exported at a
# different resolution. The oval's interior — inside the stroke, not including
# it — runs x 162..317 and y 34..221 of that 480x255.
OVAL_CX, OVAL_CY = 239.5 / 480, 127.5 / 255
OVAL_RX, OVAL_RY = 77.5 / 480, 93.5 / 255

# How much of the oval's interior the mark is allowed to occupy. The mark is
# landscape (roughly 1.36:1) and the oval is portrait, so width binds long
# before height does and the vertical slack is expected rather than timid.
MARK_WIDTH_FRAC = 320 / 1204

# The bolt is cleared just shy of the stroke. Going to the stroke would eat the
# inner edge of its glow and leave the oval looking thinner on the inside.
CLEAR_INSET = 0.97


def _glow(path: str) -> tuple[np.ndarray, np.ndarray]:
    """Return (glow, field) for a source drawn on a flat field.

    The field is sampled from a corner, as in `build_icon_cutouts.py`; these
    files are authored the same way and it is a fair sample of it.
    """
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    field = rgb[0, 0, :].copy()
    return np.clip(rgb - field, 0, 255), field


def _content_box(glow: np.ndarray) -> tuple[int, int, int, int]:
    """The art's bounds, by the same >=6 floor the cutout script uses."""
    alpha = glow.max(axis=2)
    ys, xs = np.nonzero(alpha >= 6)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def main() -> None:
    belt, belt_field = _glow(f"{SRC}/icon_belt.png")
    mark, _ = _glow(f"{SRC}/logo_icon.png")

    bx0, by0, bx1, by1 = _content_box(belt)
    bw, bh = bx1 - bx0 + 1, by1 - by0 + 1

    cx = bx0 + OVAL_CX * bw
    cy = by0 + OVAL_CY * bh
    rx = OVAL_RX * bw
    ry = OVAL_RY * bh

    # --- clear the bolt -----------------------------------------------------
    h, w = belt.shape[:2]
    yy, xx = np.ogrid[:h, :w]
    inside = ((xx - cx) / (rx * CLEAR_INSET)) ** 2 + (
        (yy - cy) / (ry * CLEAR_INSET)
    ) ** 2 <= 1.0
    belt[inside] = 0

    # --- scale the mark -----------------------------------------------------
    mx0, my0, mx1, my1 = _content_box(mark)
    mark_art = mark[my0 : my1 + 1, mx0 : mx1 + 1]
    src_h, src_w = mark_art.shape[:2]

    target_w = max(1, round(MARK_WIDTH_FRAC * bw))
    target_h = max(1, round(src_h * target_w / src_w))

    half_w, half_h = target_w / 2, target_h / 2
    fit = (half_w / rx) ** 2 + (half_h / ry) ** 2
    if fit > 1.0:
        raise SystemExit(
            f"mark {target_w}x{target_h} does not fit the medallion "
            f"(ellipse fit {fit:.3f} > 1); lower MARK_WIDTH_FRAC"
        )

    # Resized as light rather than as an image: the glow is already
    # intensity-weighted, so a straight LANCZOS resample of it is correct and
    # needs none of the premultiply dance the cutout script does for alpha.
    scaled = np.asarray(
        Image.fromarray(mark_art.astype(np.uint8), mode="RGB").resize(
            (target_w, target_h), Image.LANCZOS
        )
    ).astype(np.int16)

    # --- add it in ----------------------------------------------------------
    x0 = int(round(cx - half_w))
    y0 = int(round(cy - half_h))
    region = belt[y0 : y0 + target_h, x0 : x0 + target_w]
    belt[y0 : y0 + target_h, x0 : x0 + target_w] = np.clip(region + scaled, 0, 255)

    out = np.clip(belt + belt_field, 0, 255).astype(np.uint8)
    dst = f"{SRC}/icon_belt_logo.png"
    Image.fromarray(out, mode="RGB").save(dst)
    print(
        f"{dst}: medallion centre ({cx:.0f},{cy:.0f}) r({rx:.0f},{ry:.0f}), "
        f"mark {target_w}x{target_h}, ellipse fit {fit:.3f}"
    )


if __name__ == "__main__":
    main()
