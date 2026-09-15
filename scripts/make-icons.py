#!/usr/bin/env python3
"""Generate the PWA icon set in public/.

A host-side developer tool, not part of the runtime: it is run by hand when the
icon design changes, and its output (the PNGs) is what ships. Requires Pillow.

    python3 scripts/make-icons.py

Bump the ?v= query in app/manifest.ts after regenerating. Android bakes the
icon into a generated APK at install time and only re-reads it when it notices
the manifest changed, so an icon swapped behind an unchanged URL never reaches
a home screen that already has the app.
"""

from pathlib import Path

from PIL import Image, ImageDraw

PUBLIC = Path(__file__).resolve().parent.parent / "public"

ACCENT = (244, 63, 94)       # --accent, rose-500
ACCENT_DEEP = (159, 18, 57)  # rose-800, the far end of the maskable gradient
TILE_TOP = (42, 15, 24)      # the rose-tinted dark the app's background fades from
TILE_BOTTOM = (18, 18, 18)   # --app-bg's base
WHITE = (255, 255, 255)

SUPERSAMPLE = 4


def vertical_gradient(size, top, bottom):
    """A one-pixel-wide gradient stretched to `size` — cheaper than per-pixel."""
    strip = Image.new("RGB", (1, size))
    px = strip.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        px[0, y] = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
    return strip.resize((size, size), Image.Resampling.BICUBIC)


def play_triangle(draw, cx, cy, height, fill):
    """An equilateral-ish play glyph, optically centred (not geometrically:
    a triangle's visual centre sits left of its bounding box's)."""
    half = height / 2
    width = height * 0.86
    left = cx - width * 0.42
    draw.polygon(
        [(left, cy - half), (left, cy + half), (left + width, cy)],
        fill=fill,
    )


def card_icon(size, *, background, card_fill, glyph, bleed=False):
    """The Adshortis mark: a portrait card — the shape of the video itself —
    with a play glyph punched out of it.

    `bleed` fills the whole square (iOS applies its own rounding, and a maskable
    icon must have paint in every corner); otherwise the tile gets Android's
    rounded-square silhouette.
    """
    s = size * SUPERSAMPLE
    img = background(s).convert("RGBA")

    if not bleed:
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=s * 0.22, fill=255)
        img.putalpha(mask)

    draw = ImageDraw.Draw(img)

    # The card. Narrower than it is tall, at 9:16 — the aspect every clip in the
    # library has.
    card_h = s * (0.56 if bleed else 0.62)
    card_w = card_h * 9 / 16
    draw.rounded_rectangle(
        (
            (s - card_w) / 2,
            (s - card_h) / 2,
            (s + card_w) / 2,
            (s + card_h) / 2,
        ),
        radius=card_w * 0.22,
        fill=card_fill,
    )

    play_triangle(draw, s / 2, s / 2, card_h * 0.28, glyph)
    return img.resize((size, size), Image.Resampling.LANCZOS)


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)

    def tile(s):
        return vertical_gradient(s, TILE_TOP, TILE_BOTTOM)

    def rose(s):
        return vertical_gradient(s, ACCENT, ACCENT_DEEP)

    # "any": the dark tile, so the icon reads as the app on a dark home screen
    # rather than as a rose blob.
    for size in (512, 192):
        card_icon(size, background=tile, card_fill=ACCENT, glyph=WHITE).save(
            PUBLIC / f"icon-{size}.png"
        )

    # "maskable": paint to every edge. The launcher crops this to whatever
    # shape it likes, so the card sits well inside the 80% safe zone.
    card_icon(512, background=rose, card_fill=WHITE, glyph=ACCENT_DEEP, bleed=True).save(
        PUBLIC / "icon-maskable-512.png"
    )

    # iOS rounds this itself and puts it on the home screen as-is.
    card_icon(180, background=tile, card_fill=ACCENT, glyph=WHITE, bleed=True).save(
        PUBLIC / "apple-touch-icon.png"
    )

    card_icon(32, background=tile, card_fill=ACCENT, glyph=WHITE).save(
        PUBLIC / "favicon-32.png"
    )

    for f in sorted(PUBLIC.glob("*.png")):
        print(f"{f.name}: {f.stat().st_size} B")


if __name__ == "__main__":
    main()
