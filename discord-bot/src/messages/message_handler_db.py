import json
import os
from datetime import datetime
from typing import Any, List
import discord
import requests
from requests import RequestException
from sqlalchemy.future import select
from sqlalchemy.orm.attributes import flag_modified
from messages.message_forwarder import LiventCordClient
from utils import (
    BULK_SAVE_THRESHOLD,
    SAVE_LIMIT_PER_CHANNEL,
    MainGuildIdDiscord,
    isSaving,
)
from messages.message import Message, SessionLocal

os.makedirs("databases", exist_ok=True)


class EmbedField:
    def __init__(self, name: str, value: str) -> None:
        if len(name) > 256:
            raise ValueError("Field name cannot exceed 256 characters")
        if len(value) > 1024:
            raise ValueError("Field value cannot exceed 1024 characters")

        self.name = name
        self.value = value


class Colour:
    def __init__(self, value: int) -> None:
        self.value = value


class Embed:
    def __init__(self, data: dict) -> None:
        self.title = str(data.get("title", "")) if data.get("title") else None
        self.type = str(data.get("type", "")) if data.get("type") else None
        self.description = (
            str(data.get("description", "")) if data.get("description") else None
        )
        self.url = str(data.get("url", "")) if data.get("url") else None
        self.colour = Colour(value=data.get("color", 0))

        self.fields = [
            EmbedField(name=field.get("name", ""), value=field.get("value", ""))
            for field in data.get("fields", [])
        ]

        self.thumbnail = data.get("thumbnail", None)
        self.video = data.get("video", None)
        self.provider = data.get("provider", None)
        self.author = data.get("author", None)
        self.image = data.get("image", None)
        self.footer = data.get("footer", None)

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "type": self.type,
            "description": self.description,
            "url": self.url,
            "color": self.colour.value,
            "fields": [
                {"name": field.name, "value": field.value} for field in self.fields
            ],
            "thumbnail": self.thumbnail,
            "video": self.video,
            "provider": self.provider,
            "author": self.author,
            "image": self.image,
            "footer": self.footer,
        }


class MessageHandler:
    def __init__(self, message: discord.Message):
        self.message = message
        self.attachments, self.reply_to_id, self.reaction_emojis_ids, self.embed = (
            self.extract_message_details()
        )

    def extract_message_data_from_discord(self) -> Any:
        return (
            str(self.message.id),
            str(self.message.author.id),
            self.message.content,
            str(self.message.channel.id),
            (
                self.message.created_at
                if isinstance(self.message.created_at, datetime)
                else datetime.utcnow()
            ),
            (
                self.message.edited_at
                if isinstance(self.message.edited_at, datetime)
                else None
            ),
            self.attachments,
            self.reply_to_id,
            self.reaction_emojis_ids,
            self.embed,
            str(self.message.guild.id) if self.message.guild else None,
        )

    def extract_message_details(self) -> tuple:
        attachments = ", ".join(
            [attachment.url for attachment in self.message.attachments]
        )
        reply_to_id = (
            self.message.reference.resolved.id
            if self.message.reference and self.message.reference.resolved
            else None
        )
        reaction_emojis_ids = ", ".join(
            [
                (
                    str(reaction.emoji.id)
                    if isinstance(reaction.emoji, discord.Emoji)
                    else str(reaction.emoji)
                )
                for reaction in self.message.reactions
            ]
        )
        embeds = (
            json.dumps([embed.to_dict() for embed in self.message.embeds])
            if self.message.embeds
            else None
        )

        return attachments, reply_to_id, reaction_emojis_ids, embeds

    @classmethod
    def _create_or_update_message(cls, session: Any, message_data: tuple) -> Message:
        existing_message = (
            session.query(Message).filter_by(message_id=message_data[0]).first()
        )

        if existing_message:
            for idx, field in enumerate(
                [
                    "guild_id",
                    "content",
                    "channel_id",
                    "date",
                    "last_edited",
                    "attachment_urls",
                    "reply_to_id",
                    "reaction_emojis_ids",
                    "embed",
                ]
            ):
                old_value = getattr(existing_message, field)
                new_value = message_data[idx + 2]

                if old_value != new_value:
                    setattr(existing_message, field, new_value)

                    if field in ["attachment_urls", "embed"]:
                        flag_modified(existing_message, field)

            session.add(existing_message)
            session.commit()
            return existing_message
        else:
            new_message = Message(
                message_id=message_data[0],
                user_id=message_data[1],
                content=message_data[2],
                channel_id=message_data[3],
                date=message_data[4],
                last_edited=message_data[5],
                attachment_urls=message_data[6],
                reply_to_id=message_data[7],
                reaction_emojis_ids=message_data[8],
                embed=message_data[9],
                guild_id=message_data[10],
            )
            session.add(new_message)
            session.commit()
            return new_message

    @classmethod
    async def bulk_save_to_db(cls, messages: list[discord.Message]) -> None:
        if not isSaving or not messages:
            return

        session = SessionLocal()
        try:
            message_data_list = []
            for message in messages:
                handler = cls(message)
                message_data = handler.extract_message_data_from_discord()
                msg = cls._create_or_update_message(session, message_data)
                if isinstance(msg, Message):
                    message_data_list.append(msg)

            if message_data_list:
                session.bulk_save_objects(message_data_list)

            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error in bulk saving messages: {e}")
        finally:
            session.close()

    @classmethod
    async def save_to_db(cls, message: discord.Message) -> None:
        await cls.bulk_save_to_db([message])

    @classmethod
    def get_messages(cls) -> Any:  # type: ignore
        session = SessionLocal()
        try:
            result = session.execute(select(Message))
            messages = result.scalars().all()
            return messages
        except Exception as e:
            print(f"Error fetching messages: {e}")
            return []
        finally:
            session.close()

    @classmethod
    async def get_all_messages(cls, bot: discord.Client) -> None:
        print("Started getting all messages...")
        main_server_int = int(MainGuildIdDiscord)
        guild = bot.get_guild(main_server_int)
        if guild is None:
            print("Guild not found.")
            return

        channels = guild.channels

        for channel in channels:
            await get_messages(bot, channel.id)

    @classmethod
    async def update_message_in_db(cls, original_message: discord.Message) -> None:
        session = SessionLocal()
        try:
            handler = cls(original_message)
            message_data = handler.extract_message_data_from_discord()
            cls._create_or_update_message(session, message_data)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error updating message: {e}")
        finally:
            session.close()

    @classmethod
    async def delete_message_from_db(cls, message: discord.Message) -> None:
        session = SessionLocal()
        try:
            session.query(Message).filter_by(message_id=str(message.id)).delete()
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error deleting message: {e}")
        finally:
            session.close()

    @classmethod
    async def delete_messages_from_db(cls, message_ids: List[int]) -> None:
        session = SessionLocal()
        try:
            session.query(Message).filter(
                Message.message_id.in_(map(str, message_ids))
            ).delete(synchronize_session=False)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error deleting messages: {e}")
        finally:
            session.close()

    @classmethod
    async def forward_message(
        cls, url: str, token: str, message: discord.Message
    ) -> None:
        if not isSaving:
            return
        if message.guild and message.guild.id != MainGuildIdDiscord:
            return

        handler = cls(message)
        data = handler.extract_message_data_from_discord()
        message_forwarder = LiventCordClient(url, token)

        try:
            await message_forwarder.forward_messages(data)
        except RequestException as e:
            if isinstance(e, requests.ConnectionError) or isinstance(
                e, RequestException
            ):
                await handler.save_to_db(message)


async def get_messages(bot: discord.Client, int_channel_id: int) -> None:
    channel = bot.get_channel(int_channel_id)

    if not isinstance(channel, discord.TextChannel):
        print(f"Channel ID {int_channel_id} is not a text channel")
        return

    if not channel.permissions_for(channel.guild.me).read_messages:
        print("Bot does not have permission to read messages in this channel.")
        return

    print(f"Fetching messages from channel: {channel}...")

    messages_to_save = []
    try:
        async for message in channel.history(limit=SAVE_LIMIT_PER_CHANNEL):
            messages_to_save.append(message)

            if len(messages_to_save) >= BULK_SAVE_THRESHOLD:
                await MessageHandler.bulk_save_to_db(messages_to_save)
                messages_to_save.clear()

        if messages_to_save:
            await MessageHandler.bulk_save_to_db(messages_to_save)

        print(f"Finished fetching messages from channel id {int_channel_id}")

    except Exception as e:
        print(f"An error occurred while fetching messages: {e}")
