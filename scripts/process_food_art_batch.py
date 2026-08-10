from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image


DEFAULT_SOURCE_ROOT = Path.home() / Path(
    ".codex/generated_images/019fa106-b729-71a1-b92c-fcd66e27ef78"
)
DEFAULT_CHROMA_HELPER = Path.home() / Path(
    ".codex/skills/.system/imagegen/scripts/remove_chroma_key.py"
)

GENERATED_SOURCES: dict[str, str] = {
    "kimchi-jjigae": "exec-766738de-50b6-4be3-9af4-35f303a96008.png",
    "sushi": "exec-00654127-e001-4fb6-b842-07c0323cc6ed.png",
    "pizza": "exec-766e61f4-eab9-4b20-bc20-06cfcf5b7b9f.png",
    "hamburger": "exec-45ffbae1-f6f2-4c3a-9d60-b7ccbbae24f0.png",
    "pork-cutlet": "exec-29017ff7-4dc3-4305-a6fb-925f038996fe.png",
    "jjajangmyeon": "exec-7a9c6b54-7b75-4715-b53b-fcbdbff06c75.png",
    "naengmyeon": "exec-1013d092-025b-4849-9d1e-c9f4fa7c2cec.png",
    "samgyeopsal": "exec-a1dc989d-c45e-4bd7-84f9-21bba1a621cd.png",
    "jokbal": "exec-79d96006-3339-478e-a801-5986ab60c475.png",
    "samgyetang": "exec-52c8edd2-7316-4528-a5b2-16436bcb9aa3.png",
    "bibimbap": "exec-9c774d42-c4b8-4f2c-ae48-5e1052edc17f.png",
    "gamjatang": "exec-759f4e83-e4fa-42d6-99e4-11fe76a59f31.png",
    "doenjang-jjigae": "exec-39022700-76a0-4478-baab-a6dee6b0f33c.png",
    "sundubu-jjigae": "exec-444891cc-9e78-4000-9b56-06b1d203bb3c.png",
    "budae-jjigae": "exec-a06c011b-2336-4b2c-abb8-70184df9b7d5.png",
    "seolleongtang": "exec-c7633879-eda2-4ed6-96bd-7adaed48385c.png",
    "gomtang": "exec-20b50775-9896-4a69-890c-1557a032f07d.png",
    "yukgaejang": "exec-a25b1c50-69e8-4546-b16f-788b0a58c1c6.png",
    "kongnamul-gukbap": "exec-fcdb5774-1561-4ea6-b1d2-1c3594f0645f.png",
    "dwaeji-gukbap": "exec-58ba6aef-4e60-482d-915c-b43d0236602a.png",
    "sundae-guk": "exec-45c5d8f1-261f-4e23-b289-c45a86daf6ba.png",
    "cheonggukjang": "exec-333d26ca-e021-4664-b1a6-f5e82095b3c5.png",
    "jeyuk-deopbap": "exec-53feec51-8de5-4307-b32a-a847a51b5054.png",
    "bulgogi-deopbap": "exec-cba6b611-a2a6-4c2d-b340-63f93fb5cd34.png",
    "chicken-mayo-deopbap": "exec-8313f630-be5c-4c86-b26c-af68a51e21b9.png",
    "curry-rice": "exec-d0e9150f-58fd-4ac9-9655-a16e306400ca.png",
    "fried-rice": "exec-25ddd58f-1cad-4c27-b172-c65e08105218.png",
    "kimchi-fried-rice": "exec-ff3d88c6-ee5b-412f-9dfd-506655acad0d.png",
    "bibim-guksu": "exec-1e1c6d9b-8da4-410d-99f8-cf8c6b9f1327.png",
    "janchi-guksu": "exec-37a5f07e-5ab6-4726-9d29-766f1f9284fd.png",
    "kalguksu": "exec-0f260a7d-112f-4e16-ab93-e3c01b54c414.png",
    "jjamppong": "exec-58d1cef8-f3d5-4eae-9761-48b83211a594.png",
    "udon": "exec-3b0959d6-1f46-41fc-920c-a07759b5746d.png",
    "pasta": "exec-eedcffed-1e56-4eef-8ec9-e64cc9531de7.png",
    "pho": "exec-90020a32-066c-438b-b7e4-4b68765882a0.png",
    "korean-toast": "exec-621bf07b-22f4-4aa3-b970-2b5dd4dc554c.png",
    "grilled-galbi": "exec-62213c2d-f792-4d6b-a49e-53928dcdb7c7.png",
    "dakgalbi": "exec-c29ff6bc-8b8e-4a7a-9a7e-01d13cac5449.png",
    "bossam": "exec-30f63a70-8f06-44e8-ac17-6354236408f9.png",
    "bulgogi": "exec-a49b7a1f-7905-4bde-9684-23b2d995b498.png",
    "dak-hanmari": "exec-20b0ecab-35c1-4b1e-90e9-4aa47710c8c1.png",
    "shabu-shabu": "exec-d99c0043-a771-476f-baf4-53f0e1f7f003.png",
}

VERSIONED_OUTPUTS = {"kimchi-jjigae", "sushi", "pizza"}

EXISTING_ASSETS: dict[str, str] = {
    "fried-chicken": "fried-chicken-v2.webp",
    "galbitang": "galbitang-v2.webp",
    "gimbap": "gimbap-v2.webp",
    "home-style-baekban": "home-style-baekban-v2.webp",
    "omurice": "omurice-v2.webp",
    "ramyeon": "ramyeon-v2.webp",
    "sandwich": "sandwich-v2.webp",
    "tteokbokki": "tteokbokki-v2.webp",
}


def detect_chroma_key(source: Path) -> str:
    with Image.open(source).convert("RGB") as image:
        inset = max(1, min(image.size) // 256)
        samples = [
            image.getpixel((inset, inset)),
            image.getpixel((image.width - 1 - inset, inset)),
            image.getpixel((inset, image.height - 1 - inset)),
            image.getpixel((image.width - 1 - inset, image.height - 1 - inset)),
        ]

    average = tuple(round(sum(pixel[channel] for pixel in samples) / 4) for channel in range(3))
    candidates = {"#00ff00": (0, 255, 0), "#ff00ff": (255, 0, 255)}
    key_color, distance = min(
        (
            (name, sum((average[index] - color[index]) ** 2 for index in range(3)) ** 0.5)
            for name, color in candidates.items()
        ),
        key=lambda item: item[1],
    )
    if distance > 110:
        raise ValueError(f"Unsupported chroma key in {source}: sampled {average}")
    return "#{:02x}{:02x}{:02x}".format(*average)


def remove_chroma(
    source: Path,
    transparent_png: Path,
    chroma_helper: Path,
    key_color: str,
) -> None:
    subprocess.run(
        [
            sys.executable, str(chroma_helper),
            "--input", str(source),
            "--out", str(transparent_png),
            "--key-color", key_color,
            "--soft-matte",
            "--transparent-threshold", "12",
            "--opaque-threshold", "112",
            "--despill",
            "--force",
        ],
        check=True,
    )


def normalized_webp(source_png: Path, destination: Path) -> dict[str, object]:
    image = Image.open(source_png).convert("RGBA")
    alpha = image.getchannel("A")
    thresholded = alpha.point(lambda value: 255 if value >= 32 else 0)
    bbox = thresholded.getbbox()
    if bbox is None:
        raise ValueError(f"No visible pixels in {source_png}")

    left, top, right, bottom = bbox
    content_long_edge = max(right - left, bottom - top)
    margin = max(8, round(content_long_edge * 0.015))
    crop_box = (
        max(0, left - margin), max(0, top - margin),
        min(image.width, right + margin), min(image.height, bottom + margin),
    )
    cropped = image.crop(crop_box)
    scale = 512 / max(cropped.size)
    size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    resized = cropped.resize(size, Image.Resampling.LANCZOS)
    destination.parent.mkdir(parents=True, exist_ok=True)

    selected_quality = 84
    for quality in range(84, 63, -4):
        resized.save(destination, "WEBP", quality=quality, method=6, exact=True)
        selected_quality = quality
        if destination.stat().st_size <= 120_000:
            break

    visible = sum(1 for value in resized.getchannel("A").get_flattened_data() if value >= 32)
    neon_green = sum(1 for red, green, blue, a in resized.get_flattened_data() if a >= 32 and green >= 220 and red <= 35 and blue <= 35)
    neon_magenta = sum(1 for red, green, blue, a in resized.get_flattened_data() if a >= 32 and red >= 220 and green <= 35 and blue >= 220)
    return {
        "filename": destination.name, "width": resized.width, "height": resized.height,
        "bytes": destination.stat().st_size, "quality": selected_quality,
        "visiblePixels": visible, "visibleRatio": round(visible / (resized.width * resized.height), 4),
        "neonGreenPixels": neon_green, "neonMagentaPixels": neon_magenta,
        "source": source_png.name,
    }


def inspect_existing_webp(source: Path) -> dict[str, object]:
    image = Image.open(source).convert("RGBA")
    visible = sum(1 for value in image.getchannel("A").get_flattened_data() if value >= 32)
    return {
        "filename": source.name, "width": image.width, "height": image.height,
        "bytes": source.stat().st_size, "quality": "retained",
        "visiblePixels": visible, "visibleRatio": round(visible / (image.width * image.height), 4),
        "neonGreenPixels": 0, "neonMagentaPixels": 0, "source": source.name,
    }


def validate_report(report: dict[str, dict[str, object]]) -> None:
    if len(report) != 50:
        raise ValueError(f"Expected 50 menu assets, found {len(report)}")
    for menu_id, item in report.items():
        if max(int(item["width"]), int(item["height"])) != 512:
            raise ValueError(f"{menu_id}: longest edge is not 512")
        if int(item["bytes"]) > 120_000:
            raise ValueError(f"{menu_id}: asset exceeds 120 KB")
        if int(item["neonGreenPixels"]) or int(item["neonMagentaPixels"]):
            raise ValueError(f"{menu_id}: chroma-key pixels remain")
        visible_ratio = float(item["visibleRatio"])
        if not 0.08 <= visible_ratio <= 0.93:
            raise ValueError(f"{menu_id}: suspicious visible ratio {visible_ratio}")
    sizes = sorted((int(item["bytes"]) for item in report.values()), reverse=True)
    if sum(sizes) > 3_500_000:
        raise ValueError("All food assets exceed the 3.5 MB budget")
    if sum(sizes[:20]) > 1_500_000:
        raise ValueError("Largest 20 food assets exceed the 1.5 MB game-deck budget")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--chroma-helper", type=Path, default=DEFAULT_CHROMA_HELPER)
    parser.add_argument("--apply", action="store_true", help="Copy validated staged WebPs into src/assets/food.")
    args = parser.parse_args()

    workspace = args.workspace.resolve()
    stage_dir = workspace / ".codex" / "food-full-stage"
    staged_asset_dir = stage_dir / "webp"
    asset_dir = workspace / "src" / "assets" / "food"
    stage_dir.mkdir(parents=True, exist_ok=True)
    staged_asset_dir.mkdir(parents=True, exist_ok=True)
    asset_dir.mkdir(parents=True, exist_ok=True)

    report: dict[str, dict[str, object]] = {}
    for menu_id, source_name in GENERATED_SOURCES.items():
        source = args.source_root / source_name
        if not source.is_file():
            raise FileNotFoundError(source)
        key_color = detect_chroma_key(source)
        suffix = "-v2" if menu_id in VERSIONED_OUTPUTS else ""
        destination = staged_asset_dir / f"{menu_id}{suffix}.webp"
        if destination.is_file():
            item = inspect_existing_webp(destination)
            item["quality"] = "staged"
            item["source"] = source.name
        else:
            transparent = stage_dir / f"{menu_id}.png"
            remove_chroma(source, transparent, args.chroma_helper, key_color)
            item = normalized_webp(transparent, destination)
        item["keyColor"] = key_color
        report[menu_id] = item
        print(f"staged {menu_id}: {destination.name}")

    for menu_id, filename in EXISTING_ASSETS.items():
        source = asset_dir / filename
        if not source.is_file():
            raise FileNotFoundError(source)
        report[menu_id] = inspect_existing_webp(source)

    validate_report(report)
    report_path = stage_dir / "asset-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"validated 50 assets; wrote {report_path}")

    if args.apply:
        for menu_id, item in report.items():
            if menu_id in EXISTING_ASSETS:
                continue
            staged = staged_asset_dir / str(item["filename"])
            destination = asset_dir / staged.name
            temporary = destination.with_suffix(destination.suffix + ".tmp")
            shutil.copy2(staged, temporary)
            temporary.replace(destination)
        print(f"applied generated assets to {asset_dir}")
    else:
        print("stage-only run complete; pass --apply after visual review")


if __name__ == "__main__":
    main()
