import glob, os, sys
from PIL import Image, ImageChops, ImageDraw

PERS = ["classic", "minimal", "bold", "soft", "professional", "playful",
        "elegant", "architect", "soft-touch", "electric", "control-center", "foundation"]
ROOT = os.environ.get("DESIGN_REVIEW_OUT", "/tmp/persona-eval")


def autocrop(im, pad=12):
    # Crop empty rows only. Cropping columns too scaled borderless components
    # up in the grid, which made identical widths look different.
    bg = Image.new(im.mode, im.size, im.getpixel((2, 2)))
    box = ImageChops.difference(im, bg).convert("L").point(lambda v: 255 if v > 12 else 0).getbbox()
    if not box:
        return im
    _, t, _, b = box
    return im.crop((0, max(0, t - pad), im.width, min(im.height, b + pad)))


def build(mode, story, tw=460, th=290, cols=4):
    cells = []
    for p in PERS:
        f = f"{ROOT}/{mode}/{story}--{p}.png"
        cells.append((p, autocrop(Image.open(f).convert("RGB")) if os.path.exists(f) else None))
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * (th + 22)), (236, 236, 240))
    d = ImageDraw.Draw(sheet)
    for i, (p, im) in enumerate(cells):
        x, y = (i % cols) * tw, (i // cols) * (th + 22)
        d.rectangle([x, y, x + tw - 1, y + 21], fill=(40, 40, 48))
        d.text((x + 6, y + 5), p, fill="white")
        if im is None:
            d.text((x + 6, y + 40), "missing", fill="red")
            continue
        im.thumbnail((tw - 8, th - 6))
        sheet.paste(im, (x + 4, y + 25))
    out = f"{ROOT}/sheet-{mode}-{story.split('--')[0].replace('common-ui-', '').replace('form-ui-', 'form-').replace('message-ui-', 'msg-')}-{story.split('--')[1]}.png"
    sheet.save(out)
    return out


if __name__ == "__main__":
    for mode in sys.argv[1:] or ["light", "dark"]:
        stories = sorted({os.path.basename(f).rsplit("--", 1)[0] for f in glob.glob(f"{ROOT}/{mode}/*.png")})
        for s in stories:
            print(build(mode, s))
