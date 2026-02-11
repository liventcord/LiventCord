import asyncio
import platform
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


async def process_image_search_command_r34(
    message: discord.Message, command: str
) -> None:
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

        await fetch_and_send_images_n(message.channel, query, number)

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


async def fetch_and_send_images_n(
    channel: discord.TextChannel, query: str, number: int
) -> None:
    content_urls = await asyncio.to_thread(crawl_images_r, query, number)
    if not content_urls:
        await channel.send("No images or videos found.")
        return

    embeds = []
    videos = []

    for item in content_urls:
        if item["type"] == "image":
            embed = Embed(title="Image", color=0x00FF00)
            embed.set_image(url=item["url"])
            embeds.append(embed)
        elif item["type"] == "video":
            videos.append(item["url"])

    if embeds:
        await send_embeds_in_batches(channel, embeds)

    if videos:
        await send_videos(channel, videos)


async def send_videos(channel: discord.TextChannel, video_urls: list) -> None:
    for video_url in video_urls:
        await channel.send(video_url)


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


try:
    selenium_available = platform.system() in ("Linux", "Windows", "Darwin")
except ImportError:
    selenium_available = False

if not selenium_available:
    raise RuntimeError(
        "Selenium is not supported on this platform or is not installed."
    )


DOMAIN = "rule34.xxx"


def crawl_images_r(query: str, number: int) -> list:
    try:
        if not selenium_available:
            return []
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By

        print(f"Rule Crawler Process started with query: {query} and number: {number}")
        chrome_options = Options()
        chrome_options.add_argument("--window-size=1280,800")
        chrome_options.add_argument("--headless")

        with webdriver.Chrome(options=chrome_options) as driver:
            search_url = f"https://{DOMAIN}/index.php?page=post&s=list&tags={query}"
            content_urls = []
            pid = 0

            while len(content_urls) < number:
                url = f"{search_url}&pid={pid}"
                driver.get(url)

                image_elements = driver.find_elements(By.CLASS_NAME, "preview")
                processed_urls = []

                for img in image_elements:
                    img_url = img.get_attribute("src")
                    if img_url:
                        skip_keywords = ["gay", "male_only"]
                        alt_text = img.get_attribute("alt") or ""
                        if any(
                            keyword in alt_text.lower() for keyword in skip_keywords
                        ):
                            continue

                        img_url = img_url.split("?")[0]

                        img_class = img.get_attribute("class")
                        if img_class and "webm-thumb" in img_class:  # video
                            processed_url = (
                                img_url
                                .replace(
                                    f"https://wimg.{DOMAIN}/thumbnails/",
                                    f"https://ws-cdn-video.{DOMAIN}//images/",
                                )
                                .replace("thumbnail_", "")
                                .replace(".jpg", ".mp4")
                            )
                            processed_urls.append({
                                "url": processed_url,
                                "type": "video",
                            })
                        else:  # image
                            processed_url = img_url.replace(
                                f"https://wimg.{DOMAIN}/thumbnails",
                                f"https://{DOMAIN}//samples",
                            ).replace("thumbnail_", "sample_")
                            processed_urls.append({
                                "url": processed_url,
                                "type": "image",
                            })

                content_urls.extend(processed_urls)

                if len(content_urls) >= number:
                    break

                pid += 42

        content_urls = content_urls[:number]
        print(f"Downloaded Content URLs: {content_urls}")
        return content_urls

    except Exception as e:
        print(f"An error occurred: {e}")
        return []


if __name__ == "__main__":
    res = crawl_images("cats", 1)
    print(res)
