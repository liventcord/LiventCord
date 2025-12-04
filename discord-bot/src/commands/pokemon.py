"""Command for sending pokemon image."""

import os
import platform
import re
import shlex
import subprocess

import discord

if platform.system() == "Linux":
    from cairosvg import svg2png
    from wcwidth import wcswidth
else:
    svg2png = None
    wcswidth = None
from PIL import Image, ImageChops
from rich.ansi import AnsiDecoder
from rich.console import Console
from rich.terminal_theme import MONOKAI


def parse_args(content: str):
    args = shlex.split(content.lower())[1:]
    count = 1
    shiny = False
    big = False
    random_flag = False
    f_flag = False
    specific_parts = []

    for arg in args:
        arg_clean = arg.lstrip("#")
        if arg_clean in ["-s", "--shiny"]:
            shiny = True
        elif arg_clean in ["-b", "--big"]:
            big = True
        elif arg_clean in ["-r", "--random"]:
            random_flag = True
        elif arg_clean in ["-f", "--form"]:
            f_flag = True
        elif arg_clean.isdigit():
            count = min(10, int(arg_clean))
        else:
            specific_parts.append(arg_clean)

    specific = " ".join(specific_parts).strip() if specific_parts else None

    if f_flag:
        if not specific or len(specific.split()) < 2:
            raise ValueError(
                "When using -f or --form, provide both a name and form, like 'charizard mega-x'"
            )

    return count, shiny, big, random_flag, f_flag, specific


def save_svg_without_rich(console: Console, path: str):
    """Remove rich text from svg and save."""
    svg_content = console.export_svg(theme=MONOKAI)
    svg_content = re.sub(
        r"<text[^>]*>rich</text>", "", svg_content, flags=re.IGNORECASE
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg_content)


def strip_ansi(text):
    import re

    ansi_escape = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
    return ansi_escape.sub("", text)


def get_max_line_width(text):
    """Extract max line width from text."""
    lines = text.splitlines()
    if wcswidth:
        widths = [wcswidth(strip_ansi(line)) for line in lines]
    else:
        widths = [len(strip_ansi(line)) for line in lines]
    return max(widths) if widths else 40


def generate_pokemon_image(i, shiny, big, random_flag, f_flag, specific):
    """Generate Pokémon image from message args."""
    cmd = ["pokemon-colorscripts"]

    if specific:
        if f_flag:
            name_parts = specific.split(" ", 1)
            if len(name_parts) != 2:
                raise ValueError(
                    "Invalid format for -f. Use 'name form', e.g., 'charizard mega-x'"
                )
            cmd.extend(["-n", name_parts[0], "-f", name_parts[1]])
        else:
            cmd.extend(["-n", specific])
    else:
        cmd.append("-r")

    if shiny:
        cmd.append("-s")
    if big:
        cmd.append("-b")

    try:
        result = subprocess.run(cmd, capture_output=True, check=True)
    except subprocess.CalledProcessError as e:
        print("Failed command:", " ".join(cmd))
        print("Error:", e.stderr.decode().strip())
        if random_flag or not specific:
            cmd = ["pokemon-colorscripts", "-r"]
            if shiny:
                cmd.append("-s")
            if big:
                cmd.append("-b")
            try:
                result = subprocess.run(cmd, capture_output=True, check=True)
            except subprocess.CalledProcessError:
                return None, [], "Unknown"
        else:
            return None, [], "Unknown"

    output = result.stdout.decode()
    output_lines = output.strip().splitlines()
    name_line = next((line.strip() for line in output_lines if line.strip()), "Unknown")
    name = strip_ansi(name_line).strip()

    content_width = min(max(get_max_line_width(output), 40), 120)
    console = Console(record=True, width=content_width)
    decoder = AnsiDecoder()
    segments = decoder.decode(output)
    for segment in segments:
        console.print(segment)

    svg_path = f"pokemon_output_{i}.svg"
    png_path = f"pokemon_output_{i}.png"
    cropped_path = f"pokemon_output_cropped_{i}.png"

    save_svg_without_rich(console, svg_path)
    if svg2png is None:
        raise RuntimeError("svg2png is only available on Linux.")
    svg2png(url=svg_path, write_to=png_path)

    img = Image.open(png_path).convert("RGBA")
    bg = Image.new("RGBA", img.size, (0, 0, 0, 0))
    diff = ImageChops.difference(img, bg)
    bbox = diff.getbbox()
    img_cropped = img.crop(bbox) if bbox else img
    img_cropped.save(cropped_path, optimize=True, quality=85)
    console.clear()

    return cropped_path, [svg_path, png_path, cropped_path], name


def cleanup_files(paths):
    """Clean temp files."""
    for path in paths:
        if os.path.exists(path):
            os.remove(path)


async def generate_pokemon(message: discord.Message) -> None:
    """Generate Pokémon image(s) and reply to message."""
    if svg2png is None:
        raise RuntimeError("svg2png is only supported on Linux.")

    count, shiny, big, random_flag, f_flag, specific = parse_args(message.content)
    embeds, files, temp_files = [], [], []

    for i in range(count):
        cropped_path, generated_files, name = generate_pokemon_image(
            i, shiny, big, random_flag, f_flag, specific
        )

        if cropped_path is None:
            cropped_path, generated_files, name = generate_pokemon_image(
                i, shiny, big, True, f_flag, None
            )

        if cropped_path is not None:
            filename = f"pokemon_{i}.png"
            files.append(discord.File(cropped_path, filename=filename))
            embed = discord.Embed(title=name.title())
            embed.set_image(url=f"attachment://{filename}")
            embeds.append(embed)
            temp_files.extend(generated_files)
        else:
            print(f"Failed to generate Pokémon image for index {i}.")

    await message.reply(embeds=embeds, files=files)
    cleanup_files(temp_files)
