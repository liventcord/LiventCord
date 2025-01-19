import { initialState } from './app';
import { createEl, defaultMediaImageUrl } from './utils';
import { sendMessage } from './message';
import { getId, debounce } from './utils';
import { isUsersOpenGlobal } from './userList';

let initialMouseX;
let initialMouseY;
let isResizing = false;
let initialX, initialY, initialWidth, initialHeight;
let initialLeft, initialTop;
let resizingTop, resizingBottom, resizingLeft, resizingRight;
let isMediaMenuOpen = false;
let currentMenuType = '';
let mediaMenu, mediaMenuContainer;
let direction = '';

const exampleTenorId = 'LIVDSRZULELA';

export function onMouseMove(e) {
  if (!isResizing) return;

  let dx = e.clientX - initialMouseX;
  let dy = e.clientY - initialMouseY;

  let newWidth = initialWidth - dx;
  let newHeight = initialHeight - dy;

  let viewportWidth = window.innerWidth / 1.7;
  let viewportHeight = window.innerHeight / 1.2;

  newWidth = Math.max(300, newWidth);
  newHeight = Math.max(300, newHeight);

  if (resizingLeft) {
    newWidth = Math.max(100, newWidth);
    mediaMenu.style.width = newWidth + 'px';
  } else if (resizingRight) {
    mediaMenu.style.width = newWidth + 'px';
  }

  if (resizingTop) {
    newHeight = Math.max(100, newHeight);
    mediaMenu.style.height = newHeight + 'px';
  } else if (resizingBottom) {
    mediaMenu.style.height = newHeight + 'px';
  }

  mediaMenu.style.width = Math.min(viewportWidth, newWidth) + 'px';
  mediaMenu.style.height = Math.min(viewportHeight, newHeight) + 'px';
}

export function onMouseUp() {
  if (isResizing) {
    isResizing = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = '';
  }
}

const categories = [
  { title: 'Humans', class: 'human', count: 245 },
  { title: 'Nature', class: 'nature', count: 213 },
  { title: 'Food', class: 'food', count: 129 },
  { title: 'Activities', class: 'activities', count: 76 },
  { title: 'Travel', class: 'travel', count: 131 },
  { title: 'Objects', class: 'objects', count: 223 },
  { title: 'Symbols', class: 'symbols', count: 328 },
  { title: 'Flags', class: 'flags', count: 269 },
];

export function renderEmojis(container, categories) {
  const spriteWidth = 40;
  const spriteHeight = 40;
  const sheetWidth = 1680;
  const columns = Math.floor(sheetWidth / spriteWidth);

  let currentIndex = 0;

  categories.forEach((category) => {
    const categoryContainer = document.createElement('div');
    categoryContainer.className = 'emoji-category';

    const categoryTitle = document.createElement('div');
    categoryTitle.className = 'category-title';
    categoryTitle.textContent = category.title;
    categoryContainer.appendChild(categoryTitle);

    const emojisContainer = document.createElement('div');
    emojisContainer.className = 'emojis-container';

    for (let i = 0; i < category.count; i++) {
      const col = currentIndex % columns;
      const row = Math.floor(currentIndex / columns);
      const x = -(col * spriteWidth);
      const y = -(row * spriteHeight);

      const emoji = document.createElement('div');
      emoji.className = `emoji ${category.class}`;
      emoji.style.backgroundPosition = `${x}px ${y}px`;

      emojisContainer.appendChild(emoji);

      currentIndex++;
    }

    categoryContainer.appendChild(emojisContainer);
    container.appendChild(categoryContainer);
  });
}

export function getEmojiPanel() {
  const emojiPanel = createEl('div', { id: 'emoji-panel' });
  const emojisContainer = createEl('div', {
    className: 'emojis-container',
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
  });

  renderEmojis(emojisContainer, categories);
  emojiPanel.appendChild(emojisContainer);
  return emojiPanel.outerHTML;
}

export function updateMediaPanelPosition() {
  const mediaMenu = getId('media-menu');
  if (mediaMenu) {
    mediaMenu.className = !isUsersOpenGlobal ? 'users-open' : '';
  }
}
export function handleMediaPanelResize() {
  let viewportWidth = window.innerWidth / 1.7;
  let viewportHeight = window.innerHeight / 1.2;
  mediaMenu.style.width =
    Math.min(viewportWidth, parseInt(mediaMenu.style.width) || 480) + 'px';
  mediaMenu.style.height =
    Math.min(viewportHeight, parseInt(mediaMenu.style.height) || 453) + 'px';
}

export async function loadGifContent(query) {
  if (!query) {
    mediaMenuContainer.innerHTML = '';
    showCategoriesList();
    return;
  }
  const gifUrl = `${initialState.gifWorkerUrl}?q=${encodeURIComponent(query)}`;
  const response = await fetch(gifUrl);
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(`API error: ${data.error}`);

  const gifElements = data.results.map((result) => ({
    gif: result.media_formats.gif.url,
    preview: result.media_formats.tinygif.url,
  }));
  displayContent(gifElements, 'gif');
}

export function toggleMediaMenu() {
  if (isMediaMenuOpen) {
    console.log('Closing media menu');
    mediaMenu.style.display = 'none';
    isMediaMenuOpen = false;
  } else {
    console.log('Opening media menu');
    mediaMenu.style.display = 'block';
    isMediaMenuOpen = true;
  }
}
export function httpGetAsync(url, callback) {
  const xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = () => {
    if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
      callback(xmlHttp.responseText);
    }
  };
  xmlHttp.open('GET', url, true);
  xmlHttp.send(null);
}
export function handleCategoryGifs(responseText) {
  const gifs = JSON.parse(responseText).results;
  mediaMenuContainer.innerHTML = '';
  gifs.forEach((gif) => {
    console.log(gif);
    const gifImg = createEl('img', { className: 'gif-content' });
    gifImg.src = defaultMediaImageUrl;
    mediaMenuContainer.appendChild(gifImg);
    gifImg.onload = function () {
      gifImg.src = gif.media[0].gif.url;
    };
  });
}

export async function fetchCategoryGifs(categoryPath) {
  const url = `https://g.tenor.com/v1/search?key=${exampleTenorId}&q=${categoryPath}&limit=50`;
  httpGetAsync(url, handleCategoryGifs);
}
// search input field should hidden and shown category name when rendered gifs
// should return back to input field when this function is called
export function showCategoriesList() {
  console.log('Show categories list');
  const categoryNameText = getId('categoryName');
  categoryNameText.style.display = 'none';
  getId('gifsBackBtn').style.display = 'none';
  getId('mediaMenuSearchbar').style.display = 'flex';
  loadMenuGifContent();
  categoryName.textContent = '';
}
export function showCategoryView(categoryName) {
  const categoryNameText = getId('categoryName');
  categoryNameText.style.display = 'block';
  categoryNameText.textContent = categoryName;
  getId('gifsBackBtn').style.display = 'block';
  getId('mediaMenuSearchbar').style.display = 'none';
}

export function createCategoryBox(name, categoryPath, previewImage) {
  const box = createEl('div', { className: 'categoryBox' });
  const gifImg = createEl('img', {
    className: 'gifImg',
    src: previewImage,
    className: 'gifCategoryImage',
  });
  const overlay = createEl('div', { className: 'gifOverlay' });
  const caption = createEl('div', {
    textContent: name,
    className: 'gifCategoryCaption',
  });
  box.append(gifImg, overlay, caption);
  box.onclick = () => {
    if (categoryPath === 'trending') {
      fetchTrendingGifs();
    } else {
      fetchCategoryGifs(name);
    }
    showCategoryView(name);
  };
  return box;
}

export function displayContent(contentData, type, isCategory = false) {
  console.log(type, contentData);
  mediaMenuContainer.innerHTML = '';

  // If it"s emoji type, just set the emoji panel
  if (type === 'emoji') {
    mediaMenuContainer.innerHTML = getEmojiPanel();
    return;
  }

  if (type !== 'gif') return;

  if (isCategory) {
    contentData.forEach((category) => {
      const box = createCategoryBox(
        category.name,
        category.path,
        category.image,
      );
      mediaMenuContainer.appendChild(box);
    });
    return;
  }

  if (contentData.length === 0) {
    const baseGif = createEl('img', {
      className: 'gif-content',
      textContent: 'No gifs found',
    });
    mediaMenuContainer.appendChild(baseGif);
  } else {
    contentData.forEach((data) => {
      const img = createEl('img', {
        className: `${type}-content`,
        src: data.preview,
      });
      img.addEventListener('click', () => {
        toggleMediaMenu();
        sendMessage(data[type]);
      });
      mediaMenuContainer.appendChild(img);
    });
  }
}

export function toggleGifs(isTop) {
  if (currentMenuType === 'gif') {
    toggleMediaMenu();
  } else {
    currentMenuType = 'gif';
    loadMenuGifContent();
    if (!isMediaMenuOpen) {
      toggleMediaMenu();
    }
  }
}

export function toggleEmojis(isTop) {
  if (currentMenuType === 'emoji') {
    toggleMediaMenu();
  } else {
    currentMenuType = 'emoji';
    mediaMenuContainer.innerHTML = getEmojiPanel();

    if (!isMediaMenuOpen) {
      toggleMediaMenu();
    }
  }
}

export function httpGetSync(url) {
  const xmlHttp = new XMLHttpRequest();
  xmlHttp.open('GET', url, false);
  xmlHttp.send(null);
  if (xmlHttp.status === 200) {
    return xmlHttp.responseText;
  } else {
    throw new Error(`HTTP error! Status: ${xmlHttp.status}`);
  }
}

//TODO: add favourite gifs and popular gifs here
export async function fetchCategoryUrls() {
  const url = `https://g.tenor.com/v1/categories?key=${exampleTenorId}`;
  try {
    const response = await fetch(url);
    const responseData = await response.json();
    const categories = responseData.tags || [];

    if (categories.length === 0) {
      console.error('No categories found.');
      return [];
    }

    return categories;
  } catch (error) {
    console.error('Error fetching category GIFs:', error.message);
    return [];
  }
}

export async function loadMenuGifContent() {
  console.log('Loading GIF content...');

  const categoryUrls = await fetchCategoryUrls();

  if (categoryUrls.length > 0) {
    displayContent(categoryUrls, 'gif', true);
  } else {
    console.log('No categories available.');
    displayContent([], 'gif');
  }
}
export function initialiseEmojiPreview() {
  const emoji = getId('emojibtn');
  const totalEmojis = 73;
  const emojiWidth = 48;
  const emojiHeight = 48;

  let isHovered = false;
  let currentEmojiPosition = '0px 0px';

  function getRandomEmojiPosition() {
    const randomIndex = Math.floor(Math.random() * totalEmojis);
    const row = Math.floor(randomIndex / (960 / emojiWidth));
    const col = randomIndex % (960 / emojiWidth);
    return `-${col * emojiWidth}px -${row * emojiHeight}px`;
  }

  emoji.addEventListener('mouseover', () => {
    if (!isHovered) {
      currentEmojiPosition = getRandomEmojiPosition();
      emoji.style.backgroundPosition = currentEmojiPosition;
      emoji.classList.add('hovered');
      emoji.classList.remove('selected');
      isHovered = true;
    }
  });

  emoji.addEventListener('mouseout', () => {
    emoji.classList.remove('hovered');
    emoji.classList.add('selected');
    emoji.style.backgroundPosition = currentEmojiPosition;
    isHovered = false;
  });
}

export function initialiseMedia() {
  initialiseEmojiPreview();
  mediaMenu = getId('media-menu');
  mediaMenuContainer = getId('media-menu-container');
  mediaMenu.style.display = 'none';
  const searchBar = getId('mediaMenuSearchbar');

  searchBar.addEventListener(
    'keydown',
    debounce(async () => {
      const query = getId('mediaMenuSearchbar').value;
      await loadGifContent(query);
    }, 300),
  );

  getId('emojibtntop').addEventListener('click', (e) => {
    toggleEmojis(false);
    e.stopPropagation();
  });
  getId('gifbtn').addEventListener('click', (e) => {
    toggleGifs(false);
    e.stopPropagation();
  });
  getId('emojibtn').addEventListener('click', (e) => {
    toggleEmojis(false);
    e.stopPropagation();
  });
  getId('gifbtntop').addEventListener('click', (e) => {
    toggleGifs(true);
    e.stopPropagation();
  });

  document.body.addEventListener('click', (event) => {
    if (
      mediaMenu &&
      isMediaMenuOpen &&
      !mediaMenu.contains(event.target) &&
      event.target.id !== 'basebtn'
    ) {
      console.log('Clicked outside, closing media menu');
      toggleMediaMenu();
    }
  });
  gifsBackBtn.addEventListener('click', showCategoriesList);
  mediaMenu.style.width = 1200 + 'px';
  mediaMenu.style.height = 1200 + 'px';

  mediaMenu.addEventListener('mousedown', (e) => {
    initialX = e.clientX;
    initialY = e.clientY;
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
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
  });
}

document.addEventListener('DOMContentLoaded', initialiseMedia);
