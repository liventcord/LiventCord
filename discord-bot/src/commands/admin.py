import time

import discord

avatar_change_cooldown = 60 * 5 + 5
last_avatar_change_time = 0.0


async def handle_status(client: discord.Client, message: discord.Message) -> None:
    split_content = message.content.split()
    if len(split_content) >= 2:
        nickname = " ".join(split_content[1:])
        await client.change_presence(activity=discord.Game(name=nickname))
        await message.channel.send("Status updated successfully!")
    else:
        await message.channel.send("Invalid command. Usage: #status <nickname>")


async def change_avatar(client: discord.Client, message: discord.Message) -> None:
    if not client.user:
        return

    global last_avatar_change_time
    current_time = time.time()

    if current_time - last_avatar_change_time < avatar_change_cooldown:
        remaining_time = int(
            avatar_change_cooldown - (current_time - last_avatar_change_time)
        )
        await message.channel.send(
            f"Avatar change cooldown is active. Please wait {remaining_time} seconds."
        )
        return

    if not message.attachments:
        await message.channel.send("Please attach an image to change the avatar.")
        return

    attachment = message.attachments[0]
    filename = "avatar.png"

    try:
        await attachment.save(filename)
        with open(filename, "rb") as avatar_file:
            await client.user.edit(avatar=avatar_file.read())
        last_avatar_change_time = float(current_time)
        await message.channel.send("Avatar changed successfully!")
    except Exception:
        await message.channel.send("Failed to change the avatar.")
