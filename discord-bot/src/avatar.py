import os

import discord
import requests

from utils import BASE_PATH


class AvatarHandler:
    @staticmethod
    async def get_all_members_avatars(
        bot: discord.Client, guild_id: int
    ) -> list[discord.Member]:
        guild = bot.get_guild(guild_id)

        if guild is None:
            return []

        print("getting members...")
        members: list[discord.Member] = []
        async for member in guild.fetch_members(limit=None):
            members.append(member)
        return members

    @staticmethod
    async def save_avatars(client: discord.Client) -> None:
        print("Saving avatars...")

        for guild in client.guilds:
            if "Emoji" not in guild.name:
                members = await AvatarHandler.get_all_members_avatars(client, guild.id)
                for member in members:
                    if member.avatar is not None:
                        name = member.display_name
                        print(f"Saving user {name}'s avatar: {member.avatar.url}")
                        avatar_url = str(member.avatar.url)
                        AvatarHandler.download_avatar(member.id, avatar_url)

    @staticmethod
    def download_avatar(user_id: int, avatar_url: str) -> None:
        filename = os.path.join(BASE_PATH, "profiles", f"{user_id}.png")
        try:
            response = requests.get(avatar_url)
            if response.status_code == 200:
                os.makedirs(os.path.dirname(filename), exist_ok=True)
                with open(filename, "wb") as f:
                    print(f"Saving avatar to: {filename}")
                    f.write(response.content)
            else:
                print(f"Failed to download avatar for user {user_id}")
        except Exception as e:
            print(f"Error downloading avatar for user {user_id}: {e}")
