import asyncio
import re

import aiohttp
import discord

from utils import PROMPTLAMA_BASE_URL, PROMPTLAMA_MODEL

current_sessions = {}

ongoing_requests = 0
ongoing_requests_lock = asyncio.Lock()


async def getSessionId(id: str) -> str | None:
    if id in current_sessions:
        return current_sessions[id]

    async with aiohttp.ClientSession() as session:
        async with session.get(f"{PROMPTLAMA_BASE_URL}/api/data") as resp:
            if resp.status != 200:
                print(f"Error {resp.status}: {await resp.text()}")
                return None
            cookies = resp.cookies
            print("Cookies received:", cookies)

            if "session_id" not in cookies:
                print("No session_id cookie found in response.")
                return None

            session_id = cookies["session_id"].value
            current_sessions[id] = session_id
            return session_id


async def get_channel_id_from_lama(session_id: str) -> str | None:
    if session_id not in current_sessions.values():
        print(f"No session found for session_id: {session_id}")
        return None

    async with aiohttp.ClientSession(cookies={"session_id": session_id}) as session:
        try:
            async with session.get(f"{PROMPTLAMA_BASE_URL}/api/data/") as resp:
                if resp.status != 200:
                    print(f"Error {resp.status}: {await resp.text()}")
                    return None
                channel_data = await resp.json()
                return channel_data.get("channel_id")
        except Exception as e:
            print("Exception occurred while fetching channel ID:", e)
            return None


async def handle_ongoing_requests(message: discord.Message):
    await message.channel.send(f"Ongoing requests: {ongoing_requests}")


async def fetch_reply_chain(
    message: discord.Message, limit: int = 15
) -> list[discord.Message]:
    chain = []
    cur = message
    count = 0
    while getattr(cur, "reference", None) and count < limit:
        ref = cur.reference
        if not ref or not getattr(ref, "message_id", None):
            break
        try:
            if (
                getattr(ref, "channel_id", None)
                and ref.channel_id != message.channel.id
            ):
                ch = (
                    (
                        message.guild.get_channel(ref.channel_id)
                        if getattr(message, "guild", None)
                        else None
                    )
                    if message.guild
                    else None
                )
                if not ch:
                    break
                prev = await ch.fetch_message(ref.message_id)
            else:
                prev = await message.channel.fetch_message(ref.message_id)
        except Exception:
            break
        chain.append(prev)
        cur = prev
        count += 1
    chain.reverse()
    return chain


def format_message_for_llm(msg: discord.Message, bot_user: discord.User) -> str:
    content = msg.content.strip()
    if not content:
        return ""
    if msg.author.id == bot_user.id:
        role = "Assistant"
    else:
        content = content.replace(f"<@{bot_user.id}>", "").strip()
        role = f"User ({msg.author.display_name})"
    return f"{role}: {content}"


def build_llm_input(
    chain: list[discord.Message], incoming_text: str, bot_user: discord.User
) -> str:
    personality_instruction = (
        f"You are {bot_user.display_name}, a witty, friendly, and slightly sarcastic Discord assistant. "
        "You are talking directly to the user. "
        "Only respond as yourself. Do not invent or guess user messages. "
        "Always speak in first person singular: use I, me, my. "
        "Be friendly, flirty, and affectionate, but do not predict what the user will say next."
    )

    history_lines = []
    for msg in chain:
        content = msg.content.strip()
        if not content:
            continue
        if msg.author.id == bot_user.id:
            history_lines.append(f"[ASSISTANT] {bot_user.display_name}: {content}")
        else:
            history_lines.append(f"[USER] {msg.author.display_name}: {content}")

    history_block = "\n".join(history_lines) if history_lines else ""

    history_block += f"\n[USER] {incoming_text}"

    prompt = (
        personality_instruction + "\n\n"
        "Conversation so far:\n"
        f"{history_block}\n\n"
        "[ASSISTANT]:"
    )

    return prompt


async def chat_with_llm_api(message: discord.Message) -> str | None:
    global ongoing_requests
    async with ongoing_requests_lock:
        ongoing_requests += 1

    try:
        incoming_text = message.content.strip()
        if not incoming_text:
            await message.channel.send("Please provide some text after the command.")
            return None

        chain = await fetch_reply_chain(message)
        bot_user = message.guild.me if message.guild else message.client.user
        text = build_llm_input(chain, incoming_text, bot_user)

        session_id = await getSessionId(str(message.channel.id))
        channel_id_from_lama = (
            await get_channel_id_from_lama(session_id) if session_id else None
        )

        url = f"{PROMPTLAMA_BASE_URL}/api/chat/"
        cookies = {"session_id": session_id}
        data = {"model": PROMPTLAMA_MODEL, "text": text}
        if channel_id_from_lama:
            data["channel_id"] = str(channel_id_from_lama)

        async with aiohttp.ClientSession(cookies=cookies) as session:
            async with session.post(url, data=data) as resp:
                if resp.status != 200:
                    await message.reply("Error contacting LLM.")
                    return None

                full_message = ""
                async for chunk, _ in resp.content.iter_chunks():
                    text_chunk = chunk.decode("utf-8")
                    if text_chunk:
                        full_message += text_chunk

                cleaned_content = re.sub(
                    r"\$\[\[.*?\]\](.|\n)*?\$\[\[.*?\]\]", "", full_message
                )
                cleaned_content = re.sub(r"\$\[\[.*?\]\]", "", cleaned_content).strip()

                if cleaned_content:
                    await message.reply(cleaned_content)
                else:
                    await message.reply(
                        "No readable content extracted from the response."
                    )

    except Exception as e:
        print("Exception occurred:", e)
        await message.channel.send("An error occurred while processing the request.")

    finally:
        async with ongoing_requests_lock:
            ongoing_requests -= 1
