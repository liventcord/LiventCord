import {
  createEl,
  getId,
  debounce,
  IMAGE_SRCS,
  enableElement,
  disableElement,
  getMediaBaseURL
} from "./utils.ts";
import { trySendMessage } from "./message.ts";
import { isUsersOpenGlobal } from "./userList.ts";
import { hideImagePreviewRequest } from "./ui.ts";
import { translations } from "./translations.ts";
import { appendBuiltinEmojiChat } from "./emoji.ts";

interface Category {
  title: string;
  class: string;
  count: number;
}

interface EmojiCategory {
  title: string;
  class: string;
  count: number;
}

interface MediaCategory {
  name: string;
  path: string;
  image: string;
}

interface GifResponse {
  error?: string;
  results: Array<{
    media_formats: {
      gif: { url: string };
      tinygif: { url: string };
    };
  }>;
}

interface Category {
  name: string;
  path: string;
  image: string;
}

interface MediaData {
  preview: string;
  [key: string]: any;
}

interface GifResult {
  media_formats: {
    gif: { url: string };
    tinygif: { url: string };
  };
}

interface GifResponse {
  error?: string;
  results: GifResult[];
}

interface GifMedia {
  gif: { url: string };
  tinygif: { url: string };
}

interface GifData {
  media: GifMedia[];
}

enum MediaTypes {
  Gif,
  Emoji,
  Sticker
}

let initialMouseX: number;
let initialMouseY: number;
let isResizing = false;
let initialWidth: number, initialHeight: number;
let resizingTop: boolean,
  resizingBottom: boolean,
  resizingLeft: boolean,
  resizingRight: boolean;
let isMediaMenuOpen = false;
let currentMenuType: MediaTypes;
let mediaMenu: HTMLElement, mediaMenuContainer: HTMLElement;
const gifsBackBtn = getId("gifsBackBtn") as HTMLElement;
const exampleTenorId = "LIVDSRZULELA"; //Example tenor apikey from tenor docs

export const gifBtn = getId("gifbtn") as HTMLElement;
const gifBtnTop = getId("gifbtntop") as HTMLElement;
export const emojiBtn = getId("emojibtn") as HTMLElement;
const emojiBtnTop = getId("emojibtntop") as HTMLElement;
const STATUS_200 = 200;
const VIEWPORT_WIDTH_RATIO = 1.7;
const VIEWPORT_HEIGHT_RATIO = 1.2;

const CATEGORIES = [
  { title: "Humans", class: "human", count: 245 },
  { title: "Nature", class: "nature", count: 213 },
  { title: "Food", class: "food", count: 129 },
  { title: "Activities", class: "activities", count: 76 },
  { title: "Travel", class: "travel", count: 131 },
  { title: "Objects", class: "objects", count: 223 },
  { title: "Symbols", class: "symbols", count: 328 },
  { title: "Flags", class: "flags", count: 269 }
];

const imgPreviewContainer = getId("image-preview-container");
if (imgPreviewContainer) {
  imgPreviewContainer.addEventListener("click", hideImagePreviewRequest);
}

function onMouseMove(e: MouseEvent) {
  const MIN_WIDTH = 300;
  const MIN_HEIGHT = 300;
  const MIN_WIDTH_LEFT = 100;
  const MIN_HEIGHT_TOP = 100;

  if (!isResizing) {
    return;
  }

  const dx = e.clientX - initialMouseX;
  const dy = e.clientY - initialMouseY;

  let newWidth = initialWidth - dx;
  let newHeight = initialHeight - dy;

  const viewportWidth = window.innerWidth / VIEWPORT_WIDTH_RATIO;
  const viewportHeight = window.innerHeight / VIEWPORT_HEIGHT_RATIO;

  newWidth = Math.max(MIN_WIDTH, newWidth);
  newHeight = Math.max(MIN_HEIGHT, newHeight);

  if (resizingLeft) {
    newWidth = Math.max(MIN_WIDTH_LEFT, newWidth);
    mediaMenu.style.width = newWidth + "px";
  } else if (resizingRight) {
    mediaMenu.style.width = newWidth + "px";
  }

  if (resizingTop) {
    newHeight = Math.max(MIN_HEIGHT_TOP, newHeight);
    mediaMenu.style.height = newHeight + "px";
  } else if (resizingBottom) {
    mediaMenu.style.height = newHeight + "px";
  }

  mediaMenu.style.width = Math.min(viewportWidth, newWidth) + "px";
  mediaMenu.style.height = Math.min(viewportHeight, newHeight) + "px";
}

function onMouseUp() {
  if (isResizing) {
    isResizing = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.userSelect = "";
  }
}
let clickEmojiListenerAdded = false;

function renderEmojis(
  container: HTMLElement,
  categories: EmojiCategory[]
): void {
  const spriteWidth = 40;
  const spriteHeight = 40;
  const sheetWidth = 1680;
  const columns = Math.floor(sheetWidth / spriteWidth);

  let currentIndex = 0;

  categories.forEach((category) => {
    const categoryContainer = createEl("div", { className: "emoji-category" });

    const categoryTitle = createEl("div", {
      className: "category-title",
      textContent: category.title
    });
    categoryContainer.appendChild(categoryTitle);

    const emojisContainer = createEl("div", { className: "emojis-container" });

    for (let i = 0; i < category.count; i++) {
      const col = currentIndex % columns;
      const row = Math.floor(currentIndex / columns);
      const x = -(col * spriteWidth);
      const y = -(row * spriteHeight);

      const emoji = createEl("div", {
        className: `emoji ${category.class}`,
        style: {
          backgroundPosition: `${x}px ${y}px`
        }
      });
      emoji.setAttribute("data-index", currentIndex.toString());

      emojisContainer.appendChild(emoji);

      currentIndex++;
    }

    categoryContainer.appendChild(emojisContainer);
    container.appendChild(categoryContainer);
  });
  if (clickEmojiListenerAdded) {
    return;
  }
  clickEmojiListenerAdded = true;
  document.body.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("emoji")) {
      const indexStr = target.getAttribute("data-index");
      if (indexStr) {
        const index = parseInt(indexStr, 10);
        appendBuiltinEmojiChat(index);
      }
    }
  });
}

function displayContent(
  contentData: (MediaData | EmojiCategory | MediaCategory)[],
  type: MediaTypes,
  isCategory: boolean = false
): void {
  console.log(type, contentData);
  mediaMenuContainer.innerHTML = "";

  if (type === MediaTypes.Emoji) {
    mediaMenuContainer.innerHTML = getEmojiPanel();
    return;
  }

  if (type !== MediaTypes.Gif) {
    return;
  }

  if (isCategory) {
    contentData.forEach((data) => {
      if (isEmojiCategory(data)) {
        const box = createCategoryBox(
          data.title,
          data.class,
          data.count.toString()
        );
        mediaMenuContainer.appendChild(box);
      } else if (isMediaCategory(data)) {
        const box = createCategoryBox(data.name, data.path, data.image);
        mediaMenuContainer.appendChild(box);
      }
    });
    return;
  }

  enableElement(gifsBackBtn, false, true);
  mediaMenuSearchbar.classList.add("search-bar-gif");

  if (contentData.length === 0) {
    const baseGif = createEl("img", {
      className: "gif-content",
      textContent: "No gifs found"
    });
    mediaMenuContainer.appendChild(baseGif);
  } else {
    contentData.forEach((data) => {
      if (isMediaData(data)) {
        const img = createEl("img", {
          className: "gif-content",
          src: data.preview
        });
        img.addEventListener("click", () => {
          toggleMediaMenu();
          trySendMessage(data.gif);
        });
        mediaMenuContainer.appendChild(img);
      }
    });
  }
}

function isEmojiCategory(
  data: MediaData | EmojiCategory | MediaCategory
): data is EmojiCategory {
  return (
    (data as EmojiCategory).title !== undefined &&
    (data as EmojiCategory).count !== undefined
  );
}

function isMediaCategory(
  data: MediaData | EmojiCategory | MediaCategory
): data is MediaCategory {
  return (data as MediaCategory).name !== undefined;
}

function isMediaData(
  data: MediaData | EmojiCategory | MediaCategory
): data is MediaData {
  return (data as MediaData).preview !== undefined;
}

async function loadMenuGifContent(): Promise<void> {
  mediaMenuSearchbar.value = "";
  mediaMenuSearchbar.placeholder = translations.getTranslation("search-tenor");

  console.log("Loading GIF content...");

  const categoryUrls = await fetchCategoryUrls();

  if (categoryUrls.length > 0) {
    displayContent(categoryUrls, MediaTypes.Gif, true);
  } else {
    console.log("No categories available.");
    displayContent([], MediaTypes.Gif);
  }
}

function getEmojiPanel(): string {
  const emojiPanel = createEl("div", { id: "emoji-panel" });
  const emojisContainer = createEl("div", {
    className: "emojis-container"
  });

  renderEmojis(emojisContainer, CATEGORIES);
  emojiPanel.appendChild(emojisContainer);
  return emojiPanel.outerHTML;
}

async function fetchCategoryUrls(): Promise<Category[]> {
  const url = `https://g.tenor.com/v1/categories?key=${exampleTenorId}`;
  try {
    const response = await fetch(url);
    const responseData = await response.json();
    const categories = responseData.tags || [];

    if (categories.length === 0) {
      console.error("No categories found.");
      return [];
    }

    return categories;
  } catch (error) {
    console.error("Error fetching category GIFs:", error);
    return [];
  }
}

async function loadGifContent(query: string): Promise<void> {
  if (!query) {
    mediaMenuContainer.innerHTML = "";
    showCategoriesList();
    return;
  }

  const gifUrl = `${getMediaBaseURL()}/api/gifs?q=${encodeURIComponent(query)}`;
  const response = await fetch(gifUrl);
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data: { results?: any[] } = await response.json();
  if (!data.results || !data.results.length) {
    throw new Error("API error: No data returned");
  }

  const gifElements = data.results
    .filter((result) => {
      return (
        result.media_formats?.gif?.url ||
        result.media?.[0]?.gif?.url ||
        result.url
      );
    })
    .map((result) => {
      let gifUrl, previewUrl;

      if (result.media_formats?.gif?.url) {
        gifUrl = result.media_formats.gif.url;
        previewUrl =
          result.media_formats.tinygif?.url || result.media_formats.gif.url;
      } else if (result.media?.[0]?.gif?.url) {
        gifUrl = result.media[0].gif.url;
        previewUrl = result.media[0].tinygif?.url || result.media[0].gif.url;
      } else if (result.url) {
        gifUrl = result.url;
        previewUrl = result.url;
      }

      return {
        gif: gifUrl,
        preview: previewUrl
      };
    });

  if (!gifElements.length) {
    console.error("no valid gifs found:", data);
    throw new Error("API error: No valid GIFs found");
  }

  displayContent(gifElements, MediaTypes.Gif);
}

export function updateMediaPanelPosition() {
  mediaMenu = getId("media-menu") as HTMLElement;
  if (mediaMenu) {
    if (!isUsersOpenGlobal) {
      mediaMenu.classList.add("users-open");
    } else {
      mediaMenu.classList.remove("users-open");
    }
  }
}
export function handleMediaPanelResize() {
  const DEFAULT_WIDTH = 480;
  const DEFAULT_HEIGHT = 453;

  if (!mediaMenu) {
    return;
  }

  const viewportWidth = window.innerWidth / VIEWPORT_WIDTH_RATIO;
  const viewportHeight = window.innerHeight / VIEWPORT_HEIGHT_RATIO;

  mediaMenu.style.width =
    Math.min(viewportWidth, parseInt(mediaMenu.style.width) || DEFAULT_WIDTH) +
    "px";
  mediaMenu.style.height =
    Math.min(
      viewportHeight,
      parseInt(mediaMenu.style.height) || DEFAULT_HEIGHT
    ) + "px";
}

function toggleMediaMenu(isClickingTop?: boolean) {
  if (isMediaMenuOpen && !isClickingTop) {
    console.error("Closing media menu");
    disableElement(mediaMenu);
    isMediaMenuOpen = false;
  } else {
    enableElement(mediaMenu, false, true);
    isMediaMenuOpen = true;
  }
}
function httpGetAsync(url: string, callback: CallableFunction) {
  const xmlHttp = new XMLHttpRequest();

  const READY_STATE_DONE = 4;

  xmlHttp.onreadystatechange = () => {
    if (
      xmlHttp.readyState === READY_STATE_DONE &&
      xmlHttp.status === STATUS_200
    ) {
      callback(xmlHttp.responseText);
    }
  };

  xmlHttp.open("GET", url, true);
  xmlHttp.send(null);
}

class Gif {
  gifUrl: string;
  previewUrl: string;

  constructor(gifUrl: string, previewUrl: string) {
    this.gifUrl = gifUrl;
    this.previewUrl = previewUrl;
  }

  loadGif(gifImg: HTMLImageElement) {
    gifImg.src = this.previewUrl;
    gifImg.onload = () => {
      gifImg.src = this.gifUrl;
    };
  }
}

function handleCategoryGifs(responseText: string) {
  const gifs = JSON.parse(responseText).results as GifData[];
  mediaMenuContainer.innerHTML = "";

  gifs.forEach((gifData) => {
    const gif = new Gif(gifData.media[0].gif.url, gifData.media[0].tinygif.url);

    const gifImg = createEl("img", {
      className: "gif-content"
    });
    gifImg.addEventListener("click", () => {
      toggleMediaMenu();
      trySendMessage(gifData.media[0].gif.url);
    });
    gifImg.src = IMAGE_SRCS.DEFAULT_MEDIA_IMG_SRC;
    mediaMenuContainer.appendChild(gifImg);

    gif.loadGif(gifImg);
  });
}
const mediaMenuSearchbar = getId("media-menu-search-bar") as HTMLInputElement;
const categoryNameText = getId("category-name");

async function fetchCategoryGifs(categoryPath: string) {
  const url = `https://g.tenor.com/v1/search?key=${exampleTenorId}&q=${categoryPath}&limit=50`;
  httpGetAsync(url, handleCategoryGifs);
}
function showCategoriesList() {
  console.log("Show categories list");

  if (categoryNameText) {
    categoryNameText.textContent = "";
  }
  mediaMenuSearchbar.classList.remove("search-bar-gif");
  disableElement(gifsBackBtn);

  enableElement(mediaMenuSearchbar);
  loadMenuGifContent();
}

function showCategoryView(categoryName: string) {
  if (categoryNameText) {
    categoryNameText.textContent = categoryName;
  }
  enableElement(gifsBackBtn, false, true);
  mediaMenuSearchbar.classList.add("search-bar-gif");
  disableElement(mediaMenuSearchbar);
}

function fetchTrendingGifs() {
  throw new Error("Trending gifs not implemented");
}
function createCategoryBox(
  name: string,
  categoryPath: string,
  previewImage: string
) {
  const box = createEl("div", { className: "category-box" });
  const gifImg = createEl("img", {
    className: "gif-category-image",
    src: previewImage
  });

  //className: "gif-category-image",
  const overlay = createEl("div", { className: "overlay" });
  const caption = createEl("div", {
    textContent: name,
    className: "gifCategoryCaption"
  });
  box.append(gifImg, overlay, caption);
  box.onclick = () => {
    if (categoryPath === "trending") {
      fetchTrendingGifs();
    } else {
      fetchCategoryGifs(name);
    }
    showCategoryView(name);
  };
  return box;
}

function toggleGifs(isClickingTop?: boolean) {
  console.log(currentMenuType);
  if (currentMenuType === MediaTypes.Emoji) {
    currentMenuType = MediaTypes.Gif;
    toggleGifs();

    toggleMediaMenu(isClickingTop);
  } else {
    currentMenuType = MediaTypes.Gif;
    loadMenuGifContent();

    if (!isMediaMenuOpen) {
      toggleMediaMenu(isClickingTop);
    }
  }
}

function toggleEmojis(isClickingTop?: boolean) {
  mediaMenuSearchbar.value = "";
  if (currentMenuType === MediaTypes.Emoji) {
    toggleMediaMenu(isClickingTop);
    mediaMenuSearchbar.placeholder =
      translations.getTranslation("search-tenor");
  } else {
    currentMenuType = MediaTypes.Emoji;
    mediaMenuContainer.innerHTML = getEmojiPanel();
    mediaMenuSearchbar.placeholder =
      translations.getTranslation("find-perfect-emoji");

    if (!isMediaMenuOpen) {
      toggleMediaMenu(isClickingTop);
    }
  }
}

//TODO: add favourite gifs and popular gifs here

function initialiseEmojiPreview() {
  const emoji = getId("emojibtn") as HTMLElement;
  const totalEmojis = 73;
  const emojiWidth = 48;
  const emojiHeight = 48;

  let isHovered = false;
  let currentEmojiPosition = "0px 0px";

  function getRandomEmojiPosition() {
    const randomIndex = Math.floor(Math.random() * totalEmojis);
    const row = Math.floor(randomIndex / (960 / emojiWidth));
    const col = randomIndex % (960 / emojiWidth);
    return `-${col * emojiWidth}px -${row * emojiHeight}px`;
  }

  emoji.addEventListener("mouseover", () => {
    if (!isHovered) {
      currentEmojiPosition = getRandomEmojiPosition();
      emoji.style.backgroundPosition = currentEmojiPosition;
      emoji.classList.add("hovered");
      emoji.classList.remove("selected");
      isHovered = true;
    }
  });

  emoji.addEventListener("mouseout", () => {
    emoji.classList.remove("hovered");
    emoji.classList.add("selected");
    emoji.style.backgroundPosition = currentEmojiPosition;
    isHovered = false;
  });
}
const GIF_DEBOUNCE_TIME = 300;
function initialiseMedia() {
  initialiseEmojiPreview();
  mediaMenu = getId("media-menu") as HTMLElement;

  mediaMenuContainer = getId("media-menu-container") as HTMLElement;
  disableElement(mediaMenu);
  if (mediaMenuSearchbar) {
    mediaMenuSearchbar.addEventListener(
      "keydown",
      debounce(async () => {
        if (currentMenuType === MediaTypes.Gif) {
          const query = mediaMenuSearchbar.value;
          await loadGifContent(query);
        } else if (currentMenuType === MediaTypes.Emoji) {
          //TODO: Add emoji querying
        }
      }, GIF_DEBOUNCE_TIME)
    );
  }

  emojiBtnTop.addEventListener("click", (e) => {
    toggleEmojis(true);
    e.stopPropagation();
  });
  gifBtn.addEventListener("click", (e) => {
    toggleGifs();
    e.stopPropagation();
  });
  emojiBtn.addEventListener("click", (e) => {
    toggleEmojis();
    e.stopPropagation();
  });
  gifBtnTop.addEventListener("click", (e) => {
    toggleGifs(true);
    e.stopPropagation();
  });

  document.body.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (
      mediaMenu &&
      isMediaMenuOpen &&
      !mediaMenu.contains(target) &&
      target.id !== "basebtn"
    ) {
      console.log("Clicked outside, closing media menu");
      toggleMediaMenu();
    }
  });

  gifsBackBtn.addEventListener("click", showCategoriesList);
  mediaMenu.style.width = 1200 + "px";
  mediaMenu.style.height = 1200 + "px";

  mediaMenu.addEventListener("mousedown", (e) => {
    initialMouseX = e.clientX;
    initialMouseY = e.clientY;
    initialWidth = mediaMenu.offsetWidth;
    initialHeight = mediaMenu.offsetHeight;

    resizingLeft = e.offsetX < 10;
    resizingRight = e.offsetX > mediaMenu.offsetWidth - 10;
    resizingTop = e.offsetY < 10;
    resizingBottom = e.offsetY > mediaMenu.offsetHeight - 10;

    if (resizingLeft || resizingRight || resizingTop || resizingBottom) {
      isResizing = true;
      initialMouseX = e.clientX;
      initialMouseY = e.clientY;
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }
  });
}

document.addEventListener("DOMContentLoaded", initialiseMedia);
