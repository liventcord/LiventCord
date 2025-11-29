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


async def chat_with_llm_api(message: discord.Message) -> str | None:
    global ongoing_requests

    async with ongoing_requests_lock:
        ongoing_requests += 1
        print(f"Ongoing requests: {ongoing_requests}")

    try:
        channel_id = message.channel.id
        session_id = await getSessionId(str(channel_id))
        text = message.content.strip()
        if not text:
            await message.channel.send("Please provide some text after the command.")
            return None

        context_messages = []
        current_message = message
        for _ in range(5):
            if (
                hasattr(current_message, "reference")
                and current_message.reference
                and getattr(current_message.reference, "resolved", None)
            ):
                referenced = current_message.reference.resolved
                context_messages.append(
                    f"{referenced.author.display_name}: {referenced.content}"
                )
                current_message = referenced
            else:
                break
        context_messages.reverse()

        full_input_text = "\n".join(
            context_messages + [f"{message.author.display_name}: {text}"]
        )

        channel_id_from_lama = None
        if session_id:
            channel_id_from_lama = await get_channel_id_from_lama(session_id)

        url = f"{PROMPTLAMA_BASE_URL}/api/chat/"
        cookies = {"session_id": session_id}
        data = {
            "model": PROMPTLAMA_MODEL,
            "text": full_input_text,
        }
        if channel_id_from_lama:
            data["channel_id"] = str(channel_id_from_lama)

        print("Url is: ", url)
        async with aiohttp.ClientSession(cookies=cookies) as session:  # type: ignore
            print(f"Sending POST request to {url} with data: {data}")
            async with session.post(url, data=data) as resp:
                if resp.status != 200:
                    print(f"Error {resp.status}: {await resp.text()}")
                    await message.reply("Request failed. Please try again later.")
                    return None

                full_message = ""
                print("Starting to read streamed response chunks...")
                async for chunk, _ in resp.content.iter_chunks():
                    text_chunk = chunk.decode("utf-8")
                    if text_chunk:
                        full_message += text_chunk

                print("Finished reading all chunks.")
                print(f"Full message length: {len(full_message)}")

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
        print("Exception occurred during request:")
        print(e)
        await message.channel.send("An error occurred while processing the request.")

    finally:
        async with ongoing_requests_lock:
            ongoing_requests -= 1
            print(f"Ongoing requests after completion: {ongoing_requests}")
