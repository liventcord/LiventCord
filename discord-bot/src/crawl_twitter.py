import argparse
import asyncio
import datetime
import os
import platform
import random
import time
from typing import Any

import requests
from livent_cord_client import AuthenticatedClient
from livent_cord_client.api.message import (
    post_api_discord_bot_messages_guild_id_channel_id,
)
from livent_cord_client.models.new_bot_message_request import NewBotMessageRequest

from utils import LC_BOT_TOKEN, MainGuildIdLiventcord, forward_url


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape images from a user's page.")
    parser.add_argument("username", type=str, help="Username of the profile to access")
    parser.add_argument("channel_id", type=str, help="Channel ID to send messages at")
    parser.add_argument("user_id", type=str, help="User ID to attribute messages to")
    parser.add_argument(
        "scroll_count", type=int, default=3, help="Number of times to scroll the page"
    )
    return parser.parse_args()


def setup_webdriver():
    """Set up Selenium WebDriver with safe defaults."""
    if platform.system() not in ("Linux", "Windows"):
        raise RuntimeError("Selenium is not supported on this platform.")

    try:
        from selenium import webdriver
        from selenium.webdriver.common.by import By
    except ImportError:
        raise RuntimeError(
            "Selenium is not installed. Please run 'pip install selenium'."
        )

    USER_DATA_DIR = os.path.abspath("chrome_user_data")
    os.makedirs(USER_DATA_DIR, exist_ok=True)

    options = webdriver.ChromeOptions()
    options.add_argument(f"--user-data-dir={USER_DATA_DIR}")
    options.add_argument("--profile-directory=Default")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=options)
    return driver, webdriver


def create_random_id() -> str:
    """Create a random 19-digit string ID."""
    return "".join(str(random.randint(0, 9)) for _ in range(19))


def scrape_images(
    driver, webdriver_module, username: str, scroll_count: int
) -> set[str]:
    """Scrape images from a user's page using Selenium."""
    images_collected: set[str] = set()

    TARGET_URL = "https://x.com"
    EXPECTED_HOME_ROUTE = "/home"
    REDIRECT_URL = f"{TARGET_URL}/{username}/media"
    PARENT_CONTAINER_XPATH = "/html/body/div[1]/div/div/div[2]/main/div/div/div/div[1]/div/div[3]/div/div/section/div/div"

    driver.get(TARGET_URL)
    while EXPECTED_HOME_ROUTE not in driver.current_url:
        time.sleep(1)

    driver.get(REDIRECT_URL)
    time.sleep(3)

    for i in range(scroll_count):
        if i > 0:
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)

        try:
            parent_container = driver.find_element(
                webdriver_module.By.XPATH, PARENT_CONTAINER_XPATH
            )
        except Exception as e:
            print(f"Failed to locate parent container: {e}")
            continue

        images = parent_container.find_elements(webdriver_module.By.TAG_NAME, "img")
        for img in images:
            img_src = img.get_attribute("src")
            if img_src:
                try:
                    if requests.get(img_src).ok:
                        img_src_cleaned = img_src.split("&name")[0]
                        images_collected.add(img_src_cleaned)
                except Exception as e:
                    print(f"Failed to fetch image URL {img_src}: {e}")

    return images_collected


async def send_messages(
    messages: list[str], client: AuthenticatedClient, channel_id: str, user_id: str
) -> None:
    """Send messages to Liventcord guild asynchronously."""
    for message in messages:
        data: dict[str, Any] = {
            "message_id": create_random_id(),
            "user_id": user_id,
            "content": message,
            "date": datetime.datetime.now(datetime.UTC),
        }
        request = NewBotMessageRequest(**{
            k: v for k, v in data.items() if v is not None
        })

        try:
            response = await post_api_discord_bot_messages_guild_id_channel_id.asyncio_detailed(
                guild_id=MainGuildIdLiventcord,
                channel_id=channel_id,
                client=client,
                body=request,
            )
            if response.status_code == 200:
                print(f"Sent message: {message}")
            else:
                print(
                    f"Failed to send message: {message} (status {response.status_code})"
                )
        except Exception as e:
            print(f"Error sending message: {message}. Exception: {e}")


async def main():
    args = parse_args()
    driver = None
    webdriver_module = None

    try:
        driver, webdriver_module = setup_webdriver()
        images = list(
            scrape_images(driver, webdriver_module, args.username, args.scroll_count)
        )
        if not images:
            print("No images found.")
            return
        print("DONE")
        return
        client = AuthenticatedClient(base_url=forward_url, token=LC_BOT_TOKEN)
        await send_messages(images, client, args.channel_id, args.user_id)

    finally:
        if driver:
            driver.quit()


if __name__ == "__main__":
    asyncio.run(main())
