"""Command for sending pokemon image."""

import os
import re
import shlex
import subprocess

import discord
from cairosvg import svg2png
from PIL import Image, ImageChops
from rich.ansi import AnsiDecoder
from rich.console import Console
from rich.terminal_theme import MONOKAI
from wcwidth import wcswidth


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


def strip_ansi(line):
    """Strip ansi from text."""
    return re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", line)


def get_max_line_width(text):
    """Extract max line width from text."""
    lines = text.splitlines()
    widths = [wcswidth(strip_ansi(line)) for line in lines]
    return max(widths) if widths else 40


def generate_pokemon_image(i, shiny, big, random_flag, f_flag, specific):
    """Generate pokemon image from message args."""
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
    elif random_flag:
        cmd.append("-r")
    else:
        cmd.append("-r")

    if shiny:
        cmd.append("-s")
    if big:
        cmd.append("-b")

    result = subprocess.run(cmd, stdout=subprocess.PIPE, check=True)
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
    svg2png(url=svg_path, write_to=png_path)

    img = Image.open(png_path).convert("RGBA")
    bg = Image.new("RGBA", img.size, (0, 0, 0, 0))
    diff = ImageChops.difference(img, bg)
    bbox = diff.getbbox()
    if bbox:
        img_cropped = img.crop(bbox)
    else:
        img_cropped = img

    img_cropped.save(cropped_path, optimize=True, quality=85)
    console.clear()

    return cropped_path, [svg_path, png_path, cropped_path], name


def cleanup_files(paths):
    """Clean temp files."""
    for path in paths:
        if os.path.exists(path):
            os.remove(path)


async def generate_pokemon(message: discord.Message) -> None:
    """Generate pokemon image and reply to message."""
    count, shiny, big, random_flag, f_flag, specific = parse_args(message.content)
    embeds = []
    files = []
    temp_files = []

    for i in range(count):
        cropped_path, generated_files, name = generate_pokemon_image(
            i, shiny, big, random_flag, f_flag, specific
        )
        filename = f"pokemon_{i}.png"
        file = discord.File(cropped_path, filename=filename)
        embed = discord.Embed(title=name.title())
        embed.set_image(url=f"attachment://{filename}")
        embeds.append(embed)
        files.append(file)
        temp_files.extend(generated_files)

    await message.reply(embeds=embeds, files=files)
    cleanup_files(temp_files)
