import argparse
import time
import os
import random
import asyncio
import requests
import datetime
from typing import Dict, Any
from selenium import webdriver
from selenium.webdriver.common.by import By
from utils import LC_BOT_TOKEN, MainGuildIdLiventcord, forward_url
from livent_cord_client import AuthenticatedClient
from livent_cord_client.api.message import (
    post_api_discord_bot_messages_guild_id_channel_id,
)
from livent_cord_client.models.new_bot_message_request import NewBotMessageRequest

parser = argparse.ArgumentParser(
    description="Script to scrape images from a user's page."
)
parser.add_argument("username", type=str, help="The username of the profile to access")
parser.add_argument(
    "ChannelIdLiventcord", type=str, help="The channel id to send messages at"
)
parser.add_argument("user_id", type=str, help="The user ID to attribute messages to")
parser.add_argument(
    "scroll_count", type=int, default=3, help="Number of times to scroll the page"
)
args = parser.parse_args()

username = args.username
ChannelIdLiventcord = args.ChannelIdLiventcord
user_id = args.user_id
scroll_count = args.scroll_count

user_data_dir = os.path.abspath("chrome_user_data")
if not os.path.exists(user_data_dir):
    os.makedirs(user_data_dir)

chrome_options = webdriver.ChromeOptions()
chrome_options.add_argument(f"--user-data-dir={user_data_dir}")
chrome_options.add_argument("--profile-directory=Default")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")

driver = webdriver.Chrome(options=chrome_options)

TARGET_URL = "https://x.com"
EXPECTED_HOME_ROUTE = "/home"
REDIRECT_URL = f"https://x.com/{username}/media"
PARENT_CONTAINER_XPATH = "/html/body/div[1]/div/div/div[2]/main/div/div/div/div[1]/div/div[3]/div/div/section/div/div"

driver.get(TARGET_URL)

while EXPECTED_HOME_ROUTE not in driver.current_url:
    time.sleep(1)

driver.get(REDIRECT_URL)
time.sleep(3)

images_collected = set()

for i in range(scroll_count):
    if i > 0:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)

    parent_container = driver.find_element(By.XPATH, PARENT_CONTAINER_XPATH)
    images = parent_container.find_elements(By.TAG_NAME, "img")

    for img in images:
        img_src = img.get_attribute("src")
        if img_src and requests.get(img_src).ok:
            img_src_cleaned = img_src.split("&name")[0]
            images_collected.add(img_src_cleaned)


driver.quit()

images_collected = list(images_collected)

client = AuthenticatedClient(base_url=forward_url, token=LC_BOT_TOKEN)


def create_random_id():
    "Create random 19 digits string id"
    return "".join([str(random.randint(0, 9)) for _ in range(19)])


async def send_messages(messages):
    "Send messages to liventcord guild"

    for message in messages:
        data: Dict[str, Any] = {
            "message_id": create_random_id(),
            "user_id": user_id,
            "content": message,
            "date": datetime.datetime.now(datetime.timezone.utc),
        }

        filtered_data: Dict[str, Any] = {k: v for k, v in data.items() if v is not None}

        request = NewBotMessageRequest(**filtered_data)

        response = (
            await post_api_discord_bot_messages_guild_id_channel_id.asyncio_detailed(
                guild_id=MainGuildIdLiventcord,
                channel_id=ChannelIdLiventcord,
                client=client,
                body=request,
            )
        )
        if response.status_code == "200":
            print(f"Sent message: {message} successfully")

    return response


if __name__ == "__main__":
    asyncio.run(send_messages(images_collected))
