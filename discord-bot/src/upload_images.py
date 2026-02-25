import os

import requests
from environs import Env

env = Env()
env.read_env()

guild_id = env.str("MAIN_GUILD_ID_LC")
channel_id = env.str("MAIN_CHANNEL_ID_LC")
url = f"{env.str('FORWARD_URL')}/api/v1/guilds/{guild_id}/channels/{channel_id}/messages"

folder_path = "images/"
LC_USER_TOKEN = env.str("LC_USER_TOKEN")
max_file_size = 3 * 1024 * 1024

supported_image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"}

data = {
    "content": "Imported",
    "isSpoiler[]": [],
    "replyToId": None,
    "temporaryId": None,
}

headers = {"Authorization": "Bearer " + LC_USER_TOKEN}

valid_files = []
for root, _dirs, files_in_dir in os.walk(folder_path):
    for file_name in files_in_dir:
        file_extension = os.path.splitext(file_name)[1].lower()
        if file_extension not in supported_image_extensions:
            continue

        file_path = os.path.join(root, file_name)
        if os.path.getsize(file_path) < max_file_size:
            valid_files.append(file_path)

for i in range(0, len(valid_files), 4):
    batch = valid_files[i : i + 4]
    files = []
    spoiler_flags = []

    for file_path in batch:
        with open(file_path, "rb") as file_obj:
            files.append(("files[]", (os.path.basename(file_path), file_obj)))
        spoiler_flags.append("false")

    data["isSpoiler[]"] = spoiler_flags

    response = requests.post(url, data=data, files=files, headers=headers)
    if response.status_code == 200:
        print("Message sent successfully:", response.json())
    else:
        print(
            f"Failed to send message. Status code: {response.status_code}, Response: {response.text}"
        )
