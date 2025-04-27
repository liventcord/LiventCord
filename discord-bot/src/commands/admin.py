import time

import discord
import requests

avatar_change_cooldown = 60 * 5 + 5
last_avatar_change_time = 0.0


async def handle_status(client: discord.Client, message: discord.Message) -> None:
    split_content = message.content.split()
    if len(split_content) >= 2:
        nickname = " ".join(split_content[1:])
        await client.change_presence(activity=discord.Game(name=f"{nickname}"))
        await message.channel.send("Status updated successfully!")
    else:
        await message.channel.send("Invalid command. Usage: #status <nickname>")


async def change_avatar(client: discord.Client, message: discord.Message) -> None:
    if not client.user:
        return
    global last_avatar_change_time

    current_time = time.time()

    if current_time - last_avatar_change_time >= avatar_change_cooldown:
        attachment_url = (
            message.attachments[0].url
            if message.attachments
            else message.content.split()[1]
        )

        if attachment_url.startswith("http"):
            url_with_http = attachment_url
        else:
            url_with_http = f"http://{attachment_url}"

        response = requests.get(url_with_http)
        if response.status_code == 200:
            with open("avatar.png", "wb") as file:
                file.write(response.content)
            with open("avatar.png", "rb") as avatar_file:
                await client.user.edit(avatar=avatar_file.read())
            await message.channel.send("Avatar changed successfully!")
            last_avatar_change_time = float(current_time)
        else:
            await message.channel.send("Failed to download the image.")
    else:
        remaining_time = int(
            avatar_change_cooldown - (current_time - last_avatar_change_time)
        )
        await message.channel.send(
            f"Avatar change cooldown is active. Please wait {remaining_time} seconds."
        )
