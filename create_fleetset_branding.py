
from pathlib import Path
from datetime import datetime
from shutil import copy2
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets" / "images"
ASSETS.mkdir(parents=True, exist_ok=True)

FILES = [
    "icon.png",
    "android-icon-foreground.png",
    "android-icon-background.png",
    "android-icon-monochrome.png",
    "splash-icon.png",
]

# Back up existing assets before replacing anything.
backup = ASSETS / f"branding_backup_{datetime.now():%Y%m%d_%H%M%S}"
existing = [ASSETS / name for name in FILES if (ASSETS / name).exists()]

if existing:
    backup.mkdir(parents=True, exist_ok=True)
    for path in existing:
        copy2(path, backup / path.name)
    print(f"Original assets backed up to: {backup}")

FONT_CANDIDATES = [
    Path("C:/Windows/Fonts/arialbd.ttf"),
    Path("C:/Windows/Fonts/seguisb.ttf"),
    Path("C:/Windows/Fonts/calibrib.ttf"),
]

font_path = next((p for p in FONT_CANDIDATES if p.exists()), None)

if font_path is None:
    raise FileNotFoundError(
        "No suitable bold Windows font found. "
        "Please check C:/Windows/Fonts."
    )


def create_mark(size, max_width, max_height, center_y, line_y):
    """Create a transparent canvas with a centered black FS monogram."""
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    font_size = int(max_height * 1.35)

    while font_size > 20:
        font = ImageFont.truetype(str(font_path), font_size)
        bbox = draw.textbbox((0, 0), "FS", font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        if text_width <= max_width and text_height <= max_height:
            break

        font_size -= 4

    font = ImageFont.truetype(str(font_path), font_size)
    bbox = draw.textbbox((0, 0), "FS", font=font)

    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) / 2 - bbox[0]
    y = center_y - text_height / 2 - bbox[1]

    draw.text((round(x), round(y)), "FS", font=font, fill="black")

    # Small geometric underline accent.
    line_width = int(size * 0.25)
    line_height = max(6, int(size * 0.009))
    draw.rounded_rectangle(
        (
            (size - line_width) // 2,
            line_y,
            (size + line_width) // 2,
            line_y + line_height,
        ),
        radius=line_height // 2,
        fill="black",
    )

    return image


# 1. Main app icon: white background, black FS.
icon = Image.new("RGBA", (1024, 1024), "white")
icon.alpha_composite(
    create_mark(1024, 850, 470, 455, 740)
)
icon.convert("RGB").save(ASSETS / "icon.png")

# 2. Android adaptive foreground: transparent background.
foreground = create_mark(1024, 650, 340, 450, 690)
foreground.save(ASSETS / "android-icon-foreground.png")

# 3. Android adaptive background: solid white.
background = Image.new("RGB", (1024, 1024), "white")
background.save(ASSETS / "android-icon-background.png")

# 4. Android monochrome icon: black mark with transparency.
monochrome = create_mark(1024, 650, 340, 450, 690)
monochrome.save(ASSETS / "android-icon-monochrome.png")

# 5. Splash artwork: transparent black FS mark.
splash = create_mark(1024, 570, 310, 450, 675)
splash.save(ASSETS / "splash-icon.png")

print("\nFleetSet branding assets created successfully:")
for name in FILES:
    path = ASSETS / name
    with Image.open(path) as image:
        print(f"  {name}: {image.size}, {image.mode}")

print("\nNext: inspect the assets/images folder in VS Code.")
