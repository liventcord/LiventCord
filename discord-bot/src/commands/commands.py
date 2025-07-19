from io import BytesIO

import discord
import requests
from PIL import Image
from pytube import Search

from commands.admin import change_avatar, handle_status
from commands.chatbot import chat_with_llm_api, handle_ongoing_requests
from commands.mimic import me_mimic
from commands.pokemon import generate_pokemon
from commands.ui import handle_ui
from crawler import process_image_search_command
from utils import OwnerId, isDm

SEARCH_COMMAND1 = "#google"
SEARCH_COMMAND2 = "#search"
HELP_COMMAND = "#help"
AVATAR_COMMAND = "#avatar"
UI_COMMAND = "#ui"
PING_COMMAND = "#ping"
REGIONAL_COMMAND = "#reg"
SAY_COMMAND = "#say"
POKEMON_COMMAND = "#pokemon"
CHANGEAVATARCOMMAND = "#changeavatar"
DELETE_COMMAND = "#delete"
YOUTUBE_COMMAND = "#youtube"
STATUS_COMMAND = "#status"
ME_COMMAND = "#me"
YT_CMD = "#yt"
URL_COMMAND = "#url"
ONGOING_COMMAND = "#ongoing"


async def find_message_in_channels(
    guild: discord.Guild, message_id: int
) -> discord.Message | None:
    for channel in guild.text_channels:
        try:
            message = await channel.fetch_message(message_id)
            return message
        except discord.NotFound:
            pass
    return None


async def echo_message(message: discord.Message) -> None:
    text = message.content[len(SAY_COMMAND) :].strip()

    if message.reference and isinstance(message.reference.resolved, discord.Message):
        await message.reference.resolved.reply(text)
    else:
        await message.channel.send(text)

    if not isDm(message.channel) and message:
        await message.delete()


async def delete_messages(message: discord.Message) -> None:
    if not isinstance(message.channel, discord.TextChannel):
        return
    content_parts = message.content.split()
    if len(content_parts) < 2 or not content_parts[1].isdigit():
        await message.channel.send(
            "Please provide a valid number of messages to delete."
        )
        return
    amount = int(content_parts[1])
    if amount <= 0 or amount > 100:
        await message.channel.send(
            "You can only delete between 1 and 100 messages at a time."
        )
        return
    try:
        await message.channel.purge(limit=amount + 1)
    except Exception as e:
        print(e)
        await message.channel.send(
            "There was an error while trying to delete messages."
        )


async def youtube_search(message: discord.Message, command: str) -> None:
    text = message.content[len(command) :].strip()
    parts = text.split("#")
    query = parts[0].strip()
    number = int(parts[1].strip()) if len(parts) > 1 else 1
    results = Search(query).results
    if not results:
        await message.channel.send("No results found")
        return
    selected_results = results[:number]
    "\n".join(
        f"{index + 1}. {result.title}\n   URL: {result.watch_url}"
        for index, result in enumerate(selected_results)
    )
    await message.channel.send(selected_results[0].watch_url)


async def send_image_from_url(channel: discord.TextChannel, url: str) -> None:
    response = requests.get(url)
    if response.status_code == 200:
        image = Image.open(BytesIO(response.content))
        image_bytes = BytesIO()
        image.save(image_bytes, format="JPEG")
        image_bytes.seek(0)
        await channel.send(file=discord.File(image_bytes, filename="image.jpg"))
    else:
        await channel.send("Failed to download the image.")


async def handle_url(message: discord.Message) -> None:
    if not isinstance(message.channel, discord.TextChannel) or not message.guild:
        return

    content_parts = message.content.split()
    if len(content_parts) == 2:
        try:
            message_id = int(content_parts[1])
            target_message = await find_message_in_channels(message.guild, message_id)

            if target_message:
                if target_message.embeds:
                    for embed in target_message.embeds:
                        if embed.thumbnail and embed.thumbnail.url:
                            await send_image_from_url(
                                message.channel, embed.thumbnail.url
                            )

                        if embed.footer and embed.footer.icon_url:
                            await send_image_from_url(
                                message.channel, embed.footer.icon_url
                            )

                        if embed.image and embed.image.url:
                            await send_image_from_url(message.channel, embed.image.url)

                        if embed.url:
                            await message.channel.send(f"Embed URL: {embed.url}")

                        if embed.author and embed.author.icon_url:
                            await send_image_from_url(
                                message.channel, embed.author.icon_url
                            )
                else:
                    await message.channel.send("No embeds found in the message.")
            else:
                await message.channel.send("Message not found.")
        except ValueError:
            await message.channel.send("Invalid message ID provided.")


async def handle_avatar(message: discord.Message) -> None:
    mention = message.mentions[0] if message.mentions else message.author

    if isinstance(mention, discord.Member):
        user_status = {
            discord.Status.online: "Online",
            discord.Status.offline: "Offline",
            discord.Status.idle: "Idle",
            discord.Status.dnd: "Do Not Disturb",
            discord.Status.invisible: "Invisible",
        }.get(mention.status, "Offline")
    else:
        user_status = "Unknown"

    avatar_url = mention.avatar.url if mention.avatar else "default_avatar_url"

    embed = discord.Embed(
        title=f"{mention.display_name} is {user_status}",
        color=discord.Color.green(),
    )
    embed.set_image(url=avatar_url)
    await message.channel.send(embed=embed)


def generate_help_embed() -> discord.Embed:
    commands = {
        "#google or #search": "Google search for the specified query. Usage: #google <search> #count",
        "#reg": "Converts text to a regional variant of emojis. Usage: #reg <input>",
        "#say": "Echoes the provided text in the chat. Usage: #say <input>",
        "#delete": "Deletes specific messages. Usage: #delete #count",
        "#youtube or #yt": "Searches YouTube for the specified query. Usage: #youtube <input>",
        "#me": "Spoofs a message by user. Usage: #me @MentionHere <TextToSendByWebhook>",
        "#avatar": "Displays the avatar and status of a user. Usage: #avatar @mention(optional)",
        "#ui": "Shows detailed user information in the server. Usage: #ui <Mention>",
        "#ping": "Shows the bot's latency.",
        "#pokemon": "Display pokemon. Usage: #pokemon POKEMON_NAME OPTIONS. Available options:\n"
        "-s, --shiny : Show shiny variant\n"
        "-b, --big : Show bigger image\n"
        "-f, --form : Show an alternate form of a pokemon\n"
        "-r, --random : Select random Pokémon\n"
        "COUNT (1-10) : Number of images to generate (default 1)\n"
        "POKEMON_NAME : Specify a Pokémon by name.\n"
        "Examples:\n"
        "  #pokemon pikachu\n"
        "  #pokemon charizard -b 2\n"
        "  #pokemon -r 3 -s\n",
        "--Admin Commands--": "Admin-specific commands below.",
        "#changeavatar": "Changes the bot's avatar (with cooldown). Usage: #changeavatar (with attachment image or link)",
        "#status": "Updates the bot's status message. Usage: #status <status_text>",
    }

    help_embed = discord.Embed(
        title="Help Menu",
        description="List of commands and their descriptions",
        color=0x00FF00,
    )

    for name, value in commands.items():
        help_embed.add_field(name=name, value=value, inline=False)

    return help_embed


async def regionalconvert(message: discord.Message, REGIONAL_COMMAND: str) -> None:
    char_with_regional = []
    text = message.content[len(REGIONAL_COMMAND) :].strip()

    for i, char in enumerate(text):
        if char.isalpha():
            char_with_regional.append(f":regional_indicator_{char.lower()}:")

            if i < len(text) - 1 and text[i + 1].isspace():
                char_with_regional.append("   ")
        elif char.isspace():
            char_with_regional.append(char)

    result = "".join(char_with_regional)

    if len(result) > 2000:
        result = result[:1997] + "..."

    if result:
        await message.channel.send(result)


async def handle_commands(client: discord.Client, message: discord.Message) -> None:
    message_lower = message.content.lower()
    if message_lower.startswith(HELP_COMMAND):
        help_embed = generate_help_embed()
        await message.author.send(embed=help_embed)

    if message_lower.startswith(AVATAR_COMMAND):
        await handle_avatar(message)

    elif message_lower.startswith(UI_COMMAND):
        await handle_ui(message)
    elif message_lower.startswith(PING_COMMAND):
        latency = f"{round(client.latency * 1000)}ms"
        await message.reply(f"Pong! Latency: {latency}")
    elif message_lower.startswith(ME_COMMAND):
        await me_mimic(message)

    elif message_lower.startswith(DELETE_COMMAND):
        await delete_messages(message)
    elif message_lower.startswith(YOUTUBE_COMMAND):
        await youtube_search(message, YOUTUBE_COMMAND)
    elif message_lower.startswith(YT_CMD):
        await youtube_search(message, YT_CMD)

    elif message_lower.startswith(SAY_COMMAND):
        await echo_message(message)
    elif message_lower.startswith(REGIONAL_COMMAND):
        await regionalconvert(message, REGIONAL_COMMAND)
    elif message_lower.startswith(SEARCH_COMMAND1) or message.content.startswith(
        SEARCH_COMMAND2
    ):
        command = (
            SEARCH_COMMAND1
            if message.content.startswith(SEARCH_COMMAND1)
            else SEARCH_COMMAND2
        )
        await process_image_search_command(message, command)
    elif message_lower.startswith(URL_COMMAND):
        await handle_url(message)
    elif message_lower.startswith(POKEMON_COMMAND):
        await generate_pokemon(message)
    elif await check_reply(client, message) is True:
        (await chat_with_llm_api(message),)  # type: ignore
    elif message_lower.startswith(ONGOING_COMMAND):
        await handle_ongoing_requests(message)
    if message.author.id == OwnerId:
        if message_lower.startswith(CHANGEAVATARCOMMAND) and message.attachments:
            await change_avatar(client, message)
        elif message_lower.startswith(STATUS_COMMAND):
            await handle_status(client, message)


async def check_reply(client: discord.Client, message: discord.Message) -> bool:
    if client.user in message.mentions:
        return True
    author = (
        message.reference.resolved.author
        if message.reference and message.reference.resolved
        else None
    )

    if author == client.user:
        return True

    return False
