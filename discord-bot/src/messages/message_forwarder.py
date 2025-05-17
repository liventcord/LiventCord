import asyncio
import json
from typing import Any

from livent_cord_client import AuthenticatedClient
from livent_cord_client.api.channel import post_api_discord_bot_guilds_guild_id_channels
from livent_cord_client.api.message import (
    post_api_discord_bot_messages_bulk_guild_id_channel_id,
)
from livent_cord_client.models.create_channel_request_bot import CreateChannelRequestBot
from livent_cord_client.models.embed import Embed
from livent_cord_client.models.embed_author import EmbedAuthor
from livent_cord_client.models.embed_field import EmbedField
from livent_cord_client.models.embed_footer import EmbedFooter
from livent_cord_client.models.embed_image import EmbedImage
from livent_cord_client.models.embed_thumbnail import EmbedThumbnail
from livent_cord_client.models.embed_type import EmbedType
from livent_cord_client.models.embed_video import EmbedVideo
from livent_cord_client.models.new_bot_message_request import NewBotMessageRequest
from livent_cord_client.types import UNSET, Unset

from messages.message import Message
from utils import LC_BOT_TOKEN, MainGuildIdLiventcord, forward_url

embed_type_mapping = {
    "article": EmbedType.VALUE_0,
    "gifv": EmbedType.VALUE_1,
    "image": EmbedType.VALUE_2,
    "link": EmbedType.VALUE_3,
    "pollresult": EmbedType.VALUE_4,
    "rich": EmbedType.VALUE_5,
    "video": EmbedType.VALUE_6,
}


class LiventCordClient:
    def __init__(self, url: str, token: str):
        self.client = AuthenticatedClient(base_url=url, token=token)
        self.created_channels: set[str] = set()

    def refine_embeds(self, raw_embeds: Any) -> list[Embed]:
        refined = []
        for data in raw_embeds:
            if isinstance(data, dict):
                embed_type = embed_type_mapping.get(
                    data.get("type", "").lower(), EmbedType.VALUE_5
                )
                fields_data = data.get("fields", [])
                fields = []
                if isinstance(fields_data, list):
                    for f in fields_data:
                        if isinstance(f, dict):
                            name = f.get("name", None)
                            value = f.get("value", None)
                            fields.append(EmbedField(name=name, value=value))
                thumb: EmbedThumbnail | Unset = UNSET
                if "thumbnail" in data and isinstance(data["thumbnail"], dict):
                    thumb_data = data["thumbnail"]
                    thumb_data.pop("placeholder", None)
                    thumb_data.pop("placeholder_version", None)
                    thumb_data.pop("flags", None)
                    thumb = EmbedThumbnail(**thumb_data)

                video: EmbedVideo | Unset = UNSET
                if "video" in data and isinstance(data["video"], dict):
                    video_data = data["video"].copy()
                    video_data.pop("placeholder", None)
                    video_data.pop("placeholder_version", None)
                    video_data.pop("flags", None)
                    video = EmbedVideo(**video_data)

                author: EmbedAuthor | Unset = UNSET
                if "author" in data and isinstance(data["author"], dict):
                    author_data = data["author"].copy()
                    author_data.pop("proxy_icon_url", None)
                    author = EmbedAuthor(**author_data)

                image: EmbedImage | Unset = UNSET
                if "image" in data and isinstance(data["image"], dict):
                    image_data = data["image"]
                    image_data.pop("placeholder", None)
                    image_data.pop("placeholder_version", None)
                    image_data.pop("flags", None)
                    image = EmbedImage(**image_data)
                footer: EmbedFooter | Unset = UNSET
                footer = UNSET
                if "footer" in data and isinstance(data["footer"], dict):
                    footer_data = data["footer"].copy()
                    footer_data.pop("proxy_icon_url", None)
                    footer = EmbedFooter(**footer_data)
                else:
                    footer = UNSET

                embed = Embed(
                    title=data.get("title"),
                    type_=embed_type,
                    description=data.get("description", UNSET),
                    url=data.get("url", UNSET),
                    color=data.get("color", UNSET),
                    fields=fields,
                    thumbnail=thumb,
                    video=video,
                    author=author,
                    image=image,
                    footer=footer,
                )
            elif isinstance(data, Embed):
                embed = data
            else:
                continue
            refined.append(embed)
        return refined

    def process_embeds(self, raw_embed: Any) -> list[Embed]:
        if isinstance(raw_embed, str):
            try:
                raw_embed = json.loads(raw_embed)
            except json.JSONDecodeError:
                print("Error parsing embed JSON string.")
                return []
        if isinstance(raw_embed, list):
            return self.refine_embeds(raw_embed)
        if isinstance(raw_embed, dict):
            return self.refine_embeds([raw_embed])
        if isinstance(raw_embed, Embed):
            return [raw_embed]
        print("Unexpected embed data format.")
        return []

    async def forward_messages(self, messages: Any) -> None:
        async with self.client as client:
            if not messages:
                print("Messages not found")
                return

            if isinstance(messages, Message):
                messages = [messages]
            elif not isinstance(messages, list):
                print("Invalid input type. Expected Message or list of Message.")
                return

            channels_to_create: set[str] = set()
            for message in messages:
                channel_id: str = message.channel_id
                if channel_id not in self.created_channels:
                    channels_to_create.add(channel_id)

            for channel_id in channels_to_create:
                body: CreateChannelRequestBot = CreateChannelRequestBot(
                    channel_id, channel_id
                )
                try:
                    response = await post_api_discord_bot_guilds_guild_id_channels.asyncio_detailed(
                        guild_id=MainGuildIdLiventcord, client=client, body=body
                    )
                    print(response.content)
                    if response.status_code == 404:
                        print(f"Guild {MainGuildIdLiventcord} does not exist")
                        exit()
                    self.created_channels.add(channel_id)
                except Exception as e:
                    print(f"Error creating channel {channel_id}: {e}")

            requests: list[NewBotMessageRequest] = []
            for message in messages:
                if message.embed:
                    message.embed = self.process_embeds(message.embed)
                else:
                    message.embed = []

                data: dict[str, Any] = {
                    "message_id": message.message_id,
                    "user_id": message.user_id,
                    "content": message.content or "",
                    "last_edited": (
                        message.last_edited.isoformat() if message.last_edited else None
                    ),
                    "attachment_urls": message.attachment_urls,
                    "reply_to_id": message.reply_to_id,
                    "reaction_emojis_ids": message.reaction_emojis_ids,
                    "embeds": [embed for embed in message.embed if embed is not None],
                }

                if message.date is not None:
                    data["date"] = message.date

                filtered_data: dict[str, Any] = {
                    k: v for k, v in data.items() if v is not None
                }

                request: NewBotMessageRequest = NewBotMessageRequest(**filtered_data)
                requests.append(request)

            response = await post_api_discord_bot_messages_bulk_guild_id_channel_id.asyncio_detailed(
                guild_id=MainGuildIdLiventcord,
                channel_id=str(messages[0].channel_id),
                client=client,
                body=requests,
            )

            print(response)


async def main() -> None:
    from messages.message_handler_db import MessageHandler

    lc_client = LiventCordClient(forward_url, LC_BOT_TOKEN)
    messages = MessageHandler.get_messages()
    await lc_client.forward_messages(messages)


if __name__ == "__main__":
    asyncio.run(main())
