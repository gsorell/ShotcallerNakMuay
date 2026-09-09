"""
Build the "SHOT CALLER / MUAY THAI TIMER" horizontal lockup.

Why this file exists
--------------------
There was no editable source for the old logo. Every PSD on the machine is
flattened raster, and the wordmark was never typeset - it was generated, so the
letterforms belonged to no font and could not be re-set. This script replaces
that dead end: the type is now real text in Poppins Black (SIL Open Font
License, so unrestricted commercial and trademark use), and the gradient is
applied programmatically, so the wordmark can be re-cut at any size or reworded
without touching a pixel editor.

Only the glove-and-bolt mark is still lifted from the original artwork - it is
line art rather than type, and it survives rescaling. Vectorising it is the one
part of the logo that still has no source.

Layout keeps the pre-rename lockup's structure - two lines justified to the
same width, the subtitle letterspaced out to match the title - but the mark is
sized against the type rather than the other way round. See MARK_RATIO for why
the old logo's proportion does not transfer to a longer title.

    python scripts/build_logo_banner.py

Writes the three PNG assets the app and site reference, plus an SVG master with
the type as real vector paths.
"""
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import numpy as np
import base64
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "assets-src", "fonts", "Poppins-Black.ttf")
SRC = os.path.join(ROOT, "assets-src", "Logo_Header_Banner_TwoLine.png")
OUTDIR = os.path.join(ROOT, "public", "assets")

MARK_BOX = (152, 99, 781, 560)   # gloves + bolt, measured from the source alpha
TITLE, SUB = "SHOT CALLER", "MUAY THAI TIMER"

# The type anchors the layout and the mark scales off it. Everything below is
# expressed against TITLE_CAP so the whole lockup rescales from one number.
TITLE_CAP = 233.0                # title cap height in px
GAP_RATIO = 1.4 * 33 / 204.      # gutter; 1.4x the original, the lines differ more now
SUB_RATIO = 0.40                 # subtitle cap / title cap
TITLE_TRACK_EM = 0.02

# Mark height as a multiple of the text-block height.
#
# The old logo used 1.27 and looked right, but that was carrying "NAK MUAY" -
# a much narrower title. "SHOT CALLER" is wider, so at the same 1.27 the mark's
# share of the lockup width falls from 37% to 22% and it reads as a small icon
# bolted onto a large wordmark. 1.27 is also an awkward value in its own right:
# the mark overhangs the text block by just enough to look accidental rather
# than decided. 1.60 restores the mark's presence and reads as intentional.
MARK_RATIO = 1.60
GAP_EM = 90 / 461.               # mark-to-text gap, against mark height
PAD_EM = 44 / 461.               # canvas padding, against mark height

# Subtitle tracking. None justifies it flush to the title's width, as the
# original two lines were. A number instead sets tracking in ems and centres
# the subtitle.
SUB_TRACK_EM = None

# Colours sampled from the lightning bolt in the original mark. Their warm
# range was otherwise orphaned - nothing outside the bolt picked it up, so the
# mark and the wordmark shared no palette. Sampled by region: the bolt runs
# yellow at the top through amber and orange to a burnt orange across its
# middle-right, then salmon, then a green tip.
BOLT_YELLOW, BOLT_AMBER = (247, 212, 56), (247, 176, 62)
BOLT_ORANGE, BOLT_BURNT = (247, 143, 84), (248, 119, 88)
BOLT_SALMON, BOLT_CORAL = (241, 112, 105), (241, 89, 105)
BOLT_GREEN = (127, 179, 125)

# Subtitle fill. The title always carries the brand gradient.
#   "shared"  - one ramp spanning both lines, as the original logo did
#   "own"     - an independent ramp across the subtitle alone (see SUB_STOPS)
#   "reverse" - independent ramp, run backwards
#   (r, g, b) - a flat colour
#
# "shared" leaves both lines the same colour where they meet the right edge,
# and since CALLER and TIMER both end "ER" at the same x, the two line up as
# the same letters at two sizes. Differentiating the fill breaks that reading.
SUB_FILL = BOLT_AMBER

# Slice of the brand ramp the subtitle uses when SUB_FILL is "own"/"reverse".
# Only meaningful when SUB_STOPS is None: with the shared brand ramp, (0.0, 1.0)
# lands the subtitle on exactly the cyan the title ends on and re-creates the
# "ER over ER" pairing, so (0.0, 0.55) was needed to stop it short. With its own
# SUB_STOPS the subtitle already differs, so the full range is fine.
SUB_RANGE = (0.0, 1.0)
# Only used when SUB_FILL is "own"/"reverse". The subtitle currently takes a
# flat BOLT_AMBER instead: the mark and the title both carry gradients, and a
# third one leaves the lockup no point of rest - flat keeps the gradient as the
# title's signature. Amber over the alternatives because BOLT_BURNT reads muted
# against the bright title and BOLT_YELLOW is loud enough to compete with it.
# The bolt's green tip is unused at any size - it goes muddy olive as type, and
# only works as a short accent on a stroke. BOLT_SALMON/BOLT_CORAL read pink,
# which starts rhyming with the magenta the title opens on.
SUB_STOPS = [(0.0, BOLT_YELLOW), (1.0, BOLT_BURNT)]

# Extra space added at word boundaries in the subtitle, on top of tracking.
# Justifying a much smaller subtitle to the title's width needs heavy
# letterspacing, and at that point a normal word space is no wider than the
# gaps inside a word - "MUAY THAI TIMER" reads as one run of letters. Widening
# the word gaps in step keeps the three words legible.
SUB_WORD_EXTRA_EM = 0.55

# Brand gradient. The endpoint colours are sampled from the original wordmark
# (blue sits at ~248 throughout; red falls and green rises) but the ramp is
# re-centred: the sampled original held flat magenta across its first 27%,
# which pushed the crossover late - "SHOT CALL" stayed pink and only the "ER"
# reached cyan. Crossover now lands mid-word.
STOPS = [(0.00, (248, 56, 248)), (0.12, (248, 56, 248)), (0.30, (214, 96, 248)),
         (0.50, (136, 152, 248)), (0.70, (74, 204, 248)), (0.88, (24, 248, 248)),
         (1.00, (24, 248, 248))]
AXIS = np.array([0.2306, 0.9729])

_tt = TTFont(FONT)
UPM = _tt["head"].unitsPerEm
CAP = 708.0                      # 'H' height in font units
_hmtx, _glyphs, _cmap = _tt["hmtx"], _tt.getGlyphSet(), _tt.getBestCmap()


def gname(ch):
    return _cmap[ord(ch)]


def advance(ch, size):
    return _hmtx[gname(ch)][0] * size / UPM


def size_for_cap(cap_px):
    return cap_px * UPM / CAP


def line_width(text, size, track, word_extra=0.0):
    return (sum(advance(c, size) for c in text)
            + track * (len(text) - 1)
            + word_extra * text.count(" "))


def track_to_width(text, size, target, word_extra=0.0):
    natural = sum(advance(c, size) for c in text) + word_extra * text.count(" ")
    return (target - natural) / (len(text) - 1)


def ramp(u, stops=None):
    stops = STOPS if stops is None else stops
    u = np.clip(u, 0, 1)
    out = np.zeros(u.shape + (3,), float)
    for i in range(len(stops) - 1):
        a, ca = stops[i]
        b, cb = stops[i + 1]
        m = (u >= a) & (u <= b)
        if not m.any():
            continue
        f = ((u[m] - a) / (b - a))[:, None]
        out[m] = np.array(ca) * (1 - f) + np.array(cb) * f
    return out


def layout(sub_ratio=SUB_RATIO, sub_track_em=SUB_TRACK_EM, mark_ratio=MARK_RATIO):
    tcap = TITLE_CAP
    gap, scap = GAP_RATIO * tcap, sub_ratio * tcap
    block_h = tcap + gap + scap
    mark_h = block_h * mark_ratio
    ts, ss = size_for_cap(tcap), size_for_cap(scap)
    ttrack = TITLE_TRACK_EM * ts
    tw = line_width(TITLE, ts, ttrack)
    swx = SUB_WORD_EXTRA_EM * ss
    if sub_track_em is None:
        strack = track_to_width(SUB, ss, tw, swx)
        sw = tw
    else:
        strack = sub_track_em * ss
        sw = line_width(SUB, ss, strack, swx)
    return dict(tcap=tcap, scap=scap, gap=gap, ts=ts, ss=ss,
                ttrack=ttrack, strack=strack, tw=tw, sw=sw, swx=swx,
                sub_x=(tw - sw) / 2.0, block_h=block_h,
                mark_h=int(round(mark_h)),
                gap_x=int(round(GAP_EM * mark_h)),
                pad=int(round(PAD_EM * mark_h)))


def _fill(alpha, t, lo, hi, spec, urange=(0.0, 1.0), stops=None):
    """Colour one line's alpha: a flat tuple, or a ramp between lo and hi.

    urange restricts which slice of the brand ramp the line uses, so a line can
    carry a gradient without travelling the full magenta-to-cyan distance.
    """
    if isinstance(spec, tuple):
        rgb = np.zeros(alpha.shape + (3,), float)
        rgb[:] = np.array(spec, float)
    else:
        u = (t - lo) / (hi - lo)
        if spec == "reverse":
            u = 1.0 - u
        u0, u1 = urange
        rgb = ramp(u0 + (u1 - u0) * u, stops)
    return np.dstack([rgb, alpha]).astype(np.uint8)


def render_png(L, out):
    """Rasterise via PIL, supersampled 3x for clean edges."""
    ss = 3
    mark = Image.open(SRC).convert("RGBA").crop(MARK_BOX)
    mark_h, gap_x, pad = L["mark_h"], L["gap_x"], L["pad"]
    mw = int(round(mark.width * mark_h / mark.height))

    tw, bh = int(round(L["tw"])), int(round(L["block_h"]))
    yy, xx = np.mgrid[0:bh * ss, 0:tw * ss]
    t = (xx * AXIS[0] + yy * AXIS[1]) / float(ss)

    # Each line is drawn onto its own full-block canvas so the two can be
    # filled independently while staying in one coordinate space.
    masks = []
    for text, size, track, top, x_off, wx in (
            (TITLE, L["ts"], L["ttrack"], 0.0, 0.0, 0.0),
            (SUB, L["ss"], L["strack"], L["tcap"] + L["gap"], L["sub_x"], L["swx"])):
        canvas = Image.new("L", (tw * ss, bh * ss), 0)
        d = ImageDraw.Draw(canvas)
        f = ImageFont.truetype(FONT, int(round(size * ss)))
        x = x_off * ss
        for ch in text:
            d.text((x, top * ss), ch, font=f, fill=255, anchor="lt")
            x += advance(ch, size * ss) + track * ss + (wx * ss if ch == " " else 0.0)
        masks.append(np.array(canvas).astype(float))

    both = (masks[0] > 8) | (masks[1] > 8)
    g_lo, g_hi = t[both].min(), t[both].max()

    block = Image.new("RGBA", (tw * ss, bh * ss), (0, 0, 0, 0))
    for mask, spec, rng, st in ((masks[0], "shared", (0.0, 1.0), None),
                                (masks[1], SUB_FILL, SUB_RANGE, SUB_STOPS)):
        if spec in ("own", "reverse"):
            ink = mask > 8
            lo, hi = t[ink].min(), t[ink].max()
        else:
            lo, hi = g_lo, g_hi
        block.alpha_composite(
            Image.fromarray(_fill(mask, t, lo, hi, spec, rng, st), "RGBA"))
    text_img = block.resize((tw, bh), Image.LANCZOS)

    W = pad + mw + gap_x + text_img.width + pad
    H = max(mark_h, text_img.height) + 2 * pad
    cv = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cv.alpha_composite(mark.resize((mw, mark_h), Image.LANCZOS), (pad, (H - mark_h) // 2))
    cv.alpha_composite(text_img, (pad + mw + gap_x, (H - text_img.height) // 2))
    cv.save(out)
    return cv.size, mw


def render_svg(L, size, mw, out):
    """Vector master: type as real vector paths, mark embedded as raster."""
    W, H = size
    mark = Image.open(SRC).convert("RGBA").crop(MARK_BOX)
    buf = io.BytesIO()
    mark.save(buf, "PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    mark_h, gap_x, pad = L["mark_h"], L["gap_x"], L["pad"]
    x0 = pad + mw + gap_x
    y0 = (H - L["block_h"]) / 2

    groups = []          # (paths, x_start, x_end, y_top, y_bottom)
    for text, sz, track, top, x_off, wx in (
            (TITLE, L["ts"], L["ttrack"], 0.0, 0.0, 0.0),
            (SUB, L["ss"], L["strack"], L["tcap"] + L["gap"], L["sub_x"], L["swx"])):
        s_ = sz / UPM
        baseline = y0 + top + CAP * s_
        x = x0 + x_off
        start, ps = x, []
        for ch in text:
            # Bake the glyph transform into the path coordinates rather than
            # emitting a transform attribute. A userSpaceOnUse gradient
            # resolves in the coordinate system *after* the element's own
            # transform, so a per-path transform would give every letter its
            # own frame - and its own copy of the ramp.
            pen = SVGPathPen(_glyphs)
            _glyphs[gname(ch)].draw(TransformPen(pen, (s_, 0, 0, -s_, x, baseline)))
            d = pen.getCommands()
            if d:
                ps.append('<path d="%s"/>' % d)
            x += advance(ch, sz) + track + (wx if ch == " " else 0.0)
        groups.append((ps, start, x, y0 + top, baseline))

    gx, gy = AXIS

    def grad(gid, x1, y1, x2, y2, reverse=False, urange=(0.0, 1.0), stops=None):
        if urange == (0.0, 1.0) and not reverse:
            st = STOPS if stops is None else stops
        else:
            # Resample the ramp across the restricted slice so the SVG carries
            # the same colours the raster fill produces.
            u0, u1 = urange
            st = []
            for i in range(17):
                o = i / 16.0
                uu = u0 + (u1 - u0) * (1.0 - o if reverse else o)
                c = ramp(np.array([[uu]]), stops)[0, 0]
                st.append((o, tuple(int(round(v)) for v in c)))
        body = "".join('<stop offset="%.3f" stop-color="rgb(%d,%d,%d)"/>'
                       % (o, c[0], c[1], c[2]) for o, c in st)
        span = (x2 - x1) * gx + (y2 - y1) * gy
        return ('<linearGradient id="%s" gradientUnits="userSpaceOnUse" '
                'x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f">%s</linearGradient>'
                % (gid, x1, y1, x1 + gx * span, y1 + gy * span, body))

    # The title's ramp spans the whole text block, matching the raster fill.
    defs = [grad("brand", x0, y0, x0 + L["tw"], y0 + L["block_h"])]
    if isinstance(SUB_FILL, tuple):
        sub_fill = "rgb(%d,%d,%d)" % SUB_FILL
    elif SUB_FILL in ("own", "reverse"):
        _, sx1, sx2, sy1, sy2 = groups[1]
        defs.append(grad("sub", sx1, sy1, sx2, sy2,
                         reverse=(SUB_FILL == "reverse"), urange=SUB_RANGE,
                         stops=SUB_STOPS))
        sub_fill = "url(#sub)"
    else:
        sub_fill = "url(#brand)"

    nl = chr(10)
    body = ""
    for (ps, *_), fill in zip(groups, ("url(#brand)", sub_fill)):
        body += ('  <g fill="%s">' % fill + nl
                 + nl.join("    " + q for q in ps) + nl
                 + "  </g>" + nl)

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"' + nl
        + '     width="%d" height="%d" viewBox="0 0 %d %d">' + nl
        + '  <title>Shot Caller - Muay Thai Timer</title>' + nl
        + '  <defs>' + nl + '    %s' + nl + '  </defs>' + nl
        + '  <image x="%d" y="%d" width="%d" height="%d" xlink:href="data:image/png;base64,%s"/>' + nl
        + '%s</svg>' + nl
        ) % (W, H, W, H, (nl + "    ").join(defs),
           pad, (H - mark_h) // 2, mw, mark_h, b64, body)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(svg)


if __name__ == "__main__":
    L = layout()
    primary = os.path.join(OUTDIR, "Logo_Header_Banner_Smooth.png")
    size, mw = render_png(L, primary)
    for name in ("Logo_Header_Banner_Smooth1.png", "Logo_Header_Banner_Transparency.png"):
        Image.open(primary).save(os.path.join(OUTDIR, name))
    render_svg(L, size, mw, os.path.join(OUTDIR, "logo-shotcaller.svg"))
    print("%dx%d (%.2f:1)  title_cap=%.0f sub_cap=%.0f gap=%.0f  sub_tracking=%+.1fpx"
          % (size[0], size[1], size[0] / size[1],
             L["tcap"], L["scap"], L["gap"], L["strack"]))
