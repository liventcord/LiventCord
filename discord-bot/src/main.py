import discord
from discord.ext import commands
from avatar import AvatarHandler
from commands.commands import handle_commands, isDm
from messages.message_forwarder import LiventCordClient
from messages.message_handler_db import MessageHandler
from utils import (
    DC_TOKEN,
    LC_BOT_TOKEN,
    OwnerId,
    forward_url,
    guild_ids,
    isSaving,
    isSavingAvatars,
)

intents = discord.Intents.all()
client = commands.Bot(command_prefix="#", intents=intents)


@client.tree.command(name="ping")
async def ping(interaction: discord.Interaction) -> None:
    latency = f"{round(client.latency * 1000)}ms"
    await interaction.response.send_message(
        f"Pong! Latency: {latency}", ephemeral=False
    )


class SelfCog(commands.Cog):
    def __init__(self, bot: discord.Client) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_raw_reaction_add(
        self, payload: discord.RawReactionActionEvent
    ) -> None:
        channel = await self.bot.fetch_channel(payload.channel_id)
        if not isinstance(channel, discord.TextChannel):
            return
        message = await channel.fetch_message(payload.message_id)

        await MessageHandler.update_message_in_db(message)


async def fetch_and_handle_message(
    channel: discord.TextChannel, message_id: int
) -> discord.Message:
    if not isinstance(channel, discord.TextChannel):
        raise ValueError("Provided channel is not a TextChannel")
    try:
        message = await channel.fetch_message(message_id)
        return message
    except discord.NotFound:
        raise Exception("Message not found")


@client.event
async def on_message_edit(before: discord.Message, after: discord.Message) -> None:
    if isinstance(after.channel, discord.TextChannel):
        print(f"Message with id {after.id} edited in {after.channel.name}:")
        print(f"Before: {before.content}")
        print(f"After: {after.content}")
        await MessageHandler.save_to_db(after)


@client.event
async def on_message_delete(message: discord.Message) -> None:
    if isinstance(message.channel, discord.TextChannel):
        print(f"Message deleted in {message.channel.name}:")
        print(f"Content: {message.content}")
        await MessageHandler.delete_message_from_db(message)


@client.event
async def on_raw_reaction_add(payload: discord.RawReactionActionEvent) -> None:
    if payload.guild_id and payload.guild_id in guild_ids:
        channel = client.get_channel(payload.channel_id)
        if not isinstance(channel, discord.TextChannel):
            return
        if channel:
            message = await fetch_and_handle_message(channel, payload.message_id)
            if message:
                await MessageHandler.update_message_in_db(message)


@client.event
async def on_raw_reaction_remove(payload: discord.RawReactionActionEvent) -> None:
    if payload.guild_id and payload.guild_id in guild_ids:
        channel = client.get_channel(payload.channel_id)
        if not isinstance(channel, discord.TextChannel):
            return

        if channel:
            message = await fetch_and_handle_message(channel, payload.message_id)
            if message:
                await MessageHandler.update_message_in_db(message)


@client.event
async def on_message(message: discord.Message) -> None:
    if message.author == client.user:
        return
    if isDm(message.channel):
        user = client.get_user(OwnerId)
        if user and message:
            await user.send(message.content)

    # Echoer mode
    # Deletes owners messages and sends same message, acting as a mimic
    # isEchoerMode = False
    # if isEchoerMode and message.author.id == OwnerId:
    #    contentcached = message.content
    #    channelcached = message.channel
    #    await message.delete()
    #    await channelcached.send(contentcached)

    await handle_commands(client, message)
    if is_text_channel(message.channel):
        lc_client = LiventCordClient(forward_url, LC_BOT_TOKEN)
        await lc_client.forward_messages(message)


def is_text_channel(channel: discord.abc.Messageable) -> bool:
    return isinstance(channel, discord.TextChannel)


@client.event
async def on_ready() -> None:
    if isSaving:
        await MessageHandler.get_all_messages(client)
        await client.add_cog(SelfCog(client))
    if isSavingAvatars:
        await AvatarHandler.save_avatars(client)


client.run(DC_TOKEN)
