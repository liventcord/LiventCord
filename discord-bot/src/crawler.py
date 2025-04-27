import re
import subprocess
import sys
import discord
from discord import Embed

DOWNLOADPATH = "Temp"


media_extensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".tiff",
    ".tif",
    ".heif",
    ".heic",
    ".avif",
    ".apng",
    ".jxr",
    ".pjpeg",
    ".webm",
    ".mp4",
    ".mkv",
    ".mov",
    ".avi",
    ".flv",
    ".wmv",
    ".mpeg",
    ".mpg",
    ".m4v",
    ".ogv",
    ".3gp",
    ".3g2",
    ".ts",
]
url_pattern = re.compile(r"https?://\S+")


def crawl_images(query: str, number: int) -> list:
    try:
        python_executable = sys.executable

        process = subprocess.Popen(
            [python_executable, "src/crawl.py", query, str(number)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True,
        )

        print(f"Crawler Process started with query: {query} number {number}")

        downloaded_urls = []
        if not process.stderr:
            return []
        for line in iter(process.stderr.readline, ""):
            print(line)
            for match in url_pattern.finditer(line):
                url = match.group(0).strip()
                if any(url.lower().endswith(ext) for ext in media_extensions):
                    downloaded_urls.append(url)

            if len(downloaded_urls) >= number:
                process.kill()
                break

        process.wait()
        print(f"downloaded_urls : {downloaded_urls}")
        return downloaded_urls[:number]

    except Exception as e:
        print(f"An error occurred while running the subprocess: {e}")
        return []


def create_image_embeds(image_urls: list) -> list:
    embeds = []
    for idx, url in enumerate(image_urls):
        embed = Embed(title=f"Image {idx + 1}", color=0x00FF00)
        embed.set_image(url=url)
        embeds.append(embed)
    return embeds


async def send_embeds_in_batches(
    channel: discord.TextChannel, embeds: list, batch_size: int = 10
) -> None:
    for i in range(0, len(embeds), batch_size):
        await channel.send(embeds=embeds[i : i + batch_size])


async def process_image_search_command(message: discord.Message, command: str) -> None:
    try:
        query, number = parse_command_input(message, command)
        if query is None:
            await message.channel.send(
                f"Invalid command format. Usage: {command} {{query}} #{{number}}"
            )
            return

        if not isinstance(message.channel, discord.TextChannel):
            await message.channel.send(
                "This command can only be used in text channels."
            )
            return

        await fetch_and_send_images(message.channel, query, number)

    except Exception as e:
        print(f"Error: {e}")


def parse_command_input(message: discord.Message, command: str) -> tuple:
    parts = list(
        filter(lambda x: x.strip(), message.content[len(command) :].split("#"))
    )
    if not parts:
        return None, None

    query = parts[0].strip()
    number = int(parts[1].strip()) if len(parts) > 1 else 1
    return query, number


async def fetch_and_send_images(
    channel: discord.TextChannel, query: str, number: int
) -> None:
    image_urls = crawl_images(query, number)
    if not image_urls:
        await channel.send("No images found.")
        return

    embeds = create_image_embeds(image_urls)
    await send_embeds_in_batches(channel, embeds)


class ImagePaginator(discord.ui.View):
    def __init__(self, images: list):
        super().__init__()
        self.images = images
        self.current_page = 0

    async def update_embed(self, interaction: discord.Interaction) -> None:
        embed = Embed(title="Image Search Result")
        embed.set_image(url=self.images[self.current_page])
        embed.set_footer(text=f"Image {self.current_page + 1} of {len(self.images)}")
        await interaction.response.edit_message(embed=embed, view=self)

    @discord.ui.button(label="◀️", style=discord.ButtonStyle.gray)
    async def previous(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        if self.current_page > 0:
            self.current_page -= 1
            await self.update_embed(interaction)

    @discord.ui.button(label="▶️", style=discord.ButtonStyle.gray)
    async def next(
        self, interaction: discord.Interaction, button: discord.ui.Button
    ) -> None:
        if self.current_page < len(self.images) - 1:
            self.current_page += 1
            await self.update_embed(interaction)


if __name__ == "__main__":
    res = crawl_images("cats", 1)
    print(res)
