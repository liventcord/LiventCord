import asyncio

import discord


async def me_mimic(message: discord.Message) -> None:
    parts = message.content.split()
    if not isinstance(message.channel, (discord.TextChannel)):
        return

    try:
        if parts[1].startswith("#") and parts[2].startswith("#"):
            avatar_url = parts[1][1:]
            nickname = parts[2][1:]
            content = " ".join(parts[3:])

            if "media1.tenor.com/m/" in avatar_url or "c.tenor.com/" in avatar_url:
                tenor_url = avatar_url
            elif avatar_url.startswith("tenor.com") or avatar_url.startswith(
                "https://tenor.com"
            ):
                tenor_url = (
                    avatar_url
                    if avatar_url.endswith((".gif", ".jpg", ".jpeg", ".png"))
                    else avatar_url + ".gif"
                )
            else:
                tenor_url = avatar_url

            await message.delete()
            webhook = await message.channel.create_webhook(name=nickname)
            try:
                await webhook.send(content, username=nickname, avatar_url=tenor_url)
                await asyncio.sleep(10)
            finally:
                await webhook.delete()

        # Check if the command format is #me @MentionHere <TextToSendByWebhook>
        elif parts[1].startswith("<@") and message.guild:
            mentioned_user_id = int(parts[1].strip("<@!>"))
            content = " ".join(parts[2:])
            await message.delete()
            mentioned_user = message.guild.get_member(mentioned_user_id)
            if not mentioned_user:
                return
            mentioned_avatar = (
                mentioned_user.avatar.url if mentioned_user.avatar else None
            )
            member = message.guild.get_member(mentioned_user.id)
            nickname = (
                member.nick
                if member and member.nick
                else member.name
                if member
                else "Unknown"
            )

            webhook = await message.channel.create_webhook(name=nickname)
            try:
                await webhook.send(
                    content, username=nickname, avatar_url=mentioned_avatar
                )
                await asyncio.sleep(10)
            finally:
                await webhook.delete()

    except (IndexError, ValueError):
        pass
