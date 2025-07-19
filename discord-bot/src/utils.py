import os

import discord
from environs import Env

BASE_PATH = os.getcwd()

env = Env()
env.read_env()

MainGuildIdDiscord = str(env.int("MAIN_GUILD_ID_DC"))
MainGuildIdLiventcord = str(env.int("MAIN_GUILD_ID_LC"))
OwnerId = int(env.int("OWNER_ID"))
LC_BOT_TOKEN = env.str("LC_BOT_TOKEN")
BULK_SAVE_THRESHOLD = env.int("BULK_SAVE_THRESHOLD")
SAVE_LIMIT_PER_CHANNEL = env.int("SAVE_LIMIT_PER_CHANNEL")

guild_ids: set[str] = set(env.list("GUILD_IDS", subcast=str) or [])

isSaving: bool = env.bool("IS_SAVING", default=False)
isSavingAvatars: bool = env.bool("IS_SAVING_AVATARS", default=False)

forward_url: str = env.str("FORWARD_URL")
DATABASE_PATH = "databases"
DC_TOKEN: str = env.str("DC_TOKEN")

# PromptLama server, can be cloned from https://github.com/thelp281/promptlama
PROMPTLAMA_BASE_URL: str = env.str(
    "PROMPTLAMA_BASE_URL", default="http://localhost:8000"
)
PROMPTLAMA_MODEL: str = env.str("PROMPTLAMA_MODEL", default="")


def isDm(channel: discord.abc.Messageable) -> bool:
    return isinstance(channel, discord.DMChannel)
