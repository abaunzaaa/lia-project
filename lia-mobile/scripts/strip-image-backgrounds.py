"""Make opaque white-sheet PNGs transparent without eating white parts of the object."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1] / "src" / "assets"
OPAQUE_TARGETS = [
    ROOT / "images" / "medication-form" / "meal-with.png",
    ROOT / "images" / "medication-form" / "schedule-bell.png",
    ROOT / "images" / "medication-form" / "schedule-clock.png",
    ROOT / "images" / "medication-form" / "treatment-calendar.png",
]


def dist_white(p: tuple[int, int, int]) -> int:
    return (255 - p[0]) + (255 - p[1]) + (255 - p[2])


def process(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    pix = img.load()
    content_xs: list[int] = []
    content_ys: list[int] = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a < 10:
                continue
            # Content = not near-white sheet (keeps navy, teal, food, and off-white faces).
            if dist_white((r, g, b)) > 18:
                content_xs.append(x)
                content_ys.append(y)
    if not content_xs:
        print(f"{path.name}: no content, skip")
        return
    pad = 10
    min_x = max(0, min(content_xs) - pad)
    max_x = min(w - 1, max(content_xs) + pad)
    min_y = max(0, min(content_ys) - pad)
    max_y = min(h - 1, max(content_ys) + pad)

    alpha = Image.new("L", (w, h), 0)
    ap = alpha.load()
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            r, g, b, a = pix[x, y]
            ap[x, y] = a

    # Soften the cut with a slight blur on the mask, then restore interior alpha.
    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=1.2))
    ap = alpha.load()
    for y in range(min_y + 4, max_y - 3):
        for x in range(min_x + 4, max_x - 3):
            r, g, b, a = pix[x, y]
            ap[x, y] = max(ap[x, y], a)

    out = img.copy()
    out.putalpha(alpha)
    px = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                px[x, y] = (255, 255, 255, 0)
    out.save(path, "PNG", optimize=True)
    kept = sum(1 for y in range(h) for x in range(w) if px[x, y][3] > 10) / (w * h)
    print(f"{path.name}: bbox=({min_x},{min_y})-({max_x},{max_y}) kept={kept:.1%}")


def main() -> None:
    for path in OPAQUE_TARGETS:
        if path.exists():
            process(path)


if __name__ == "__main__":
    main()
