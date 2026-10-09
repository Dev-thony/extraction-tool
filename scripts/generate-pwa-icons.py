from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


# Project root
ROOT = Path(__file__).resolve().parent.parent

# Both applications use the same D mark
OUTPUT_DIRS = [
    ROOT / "apps" / "extractor" / "public" / "icons",
    ROOT / "apps" / "admin" / "public" / "icons",
]

# Existing Data Extractor branding
GREEN = "#059669"
WHITE = "#FFFFFF"


def find_font():
    """Find a bold system font for the D mark."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]

    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return str(path)

    return None


FONT_PATH = find_font()


def create_icon(size: int, maskable: bool = False):
    """
    Create the Data Extractor PWA icon.

    Standard icon:
      Green rounded square + large white D.

    Maskable icon:
      Same design, but the D is smaller to stay safely
      inside the PWA maskable safe area.
    """

    image = Image.new("RGBA", (size, size), GREEN)
    draw = ImageDraw.Draw(image)

    # Rounded corners for the standard icon.
    radius = int(size * 0.18)

    # Draw the green rounded-square background.
    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=radius,
        fill=GREEN,
    )

    # Keep the D comfortably inside the maskable safe area.
    if maskable:
        font_size = int(size * 0.43)
        center_y = size * 0.49
    else:
        font_size = int(size * 0.58)
        center_y = size * 0.50

    if FONT_PATH:
        font = ImageFont.truetype(FONT_PATH, font_size)
    else:
        # Pillow's built-in font is only a fallback.
        font = ImageFont.load_default()

    text = "D"

    # Calculate exact text bounds so D is centered.
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) / 2 - bbox[0]
    y = center_y - text_height / 2 - bbox[1]

    draw.text(
        (x, y),
        text,
        font=font,
        fill=WHITE,
    )

    return image


def save_icon_set(output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)

    icons = {
        "icon-192.png": create_icon(192, maskable=False),
        "icon-512.png": create_icon(512, maskable=False),
        "icon-512-maskable.png": create_icon(512, maskable=True),
    }

    for filename, image in icons.items():
        path = output_dir / filename

        image.save(
            path,
            "PNG",
            optimize=True,
        )

        print(f"Created: {path}")


def main():
    print("Generating Data Extractor PWA icons...")
    print()

    for output_dir in OUTPUT_DIRS:
        save_icon_set(output_dir)

    print()
    print("PWA icons generated successfully.")
    print()
    print("Created files:")
    print("  apps/extractor/public/icons/icon-192.png")
    print("  apps/extractor/public/icons/icon-512.png")
    print("  apps/extractor/public/icons/icon-512-maskable.png")
    print("  apps/admin/public/icons/icon-192.png")
    print("  apps/admin/public/icons/icon-512.png")
    print("  apps/admin/public/icons/icon-512-maskable.png")


if __name__ == "__main__":
    main()