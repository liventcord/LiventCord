import { apiClient } from "./api";

const Engines: Record<string, string> = {
  Google:   "https://lens.google.com/uploadbyurl?url=",
  Yandex:   "https://yandex.com/images/search?rpt=imageview&url=",
  SauceNAO: "https://saucenao.com/search.php?url=",
  IQDB:     "https://iqdb.org/?url=",
  Bing:     "https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:",
  TinEye:   "https://www.tineye.com/search?url=",
  ImgOps:   "https://imgops.com/start?url=",
};

function getEngineIcon(engineUrl: string): string {
  const host = new URL(engineUrl).host;
  return `https://icons.duckduckgo.com/ip3/${host}.ico`;
}

function searchImage(src: string, engineUrl: string): void {
  window.open(engineUrl + encodeURIComponent(src), "_blank", "noopener,noreferrer");
}

function searchAllEngines(src: string): void {
  for (const url of Object.values(Engines)) {
    searchImage(src, url);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

let activeMenu: HTMLElement | null = null;

function buildMenu(src: string, x: number, y: number): HTMLElement {
  const menu = el("div", {
    id: "reverse-image-context-menu",
    class: "context-menu",
    role: "menu",
    "aria-label": "Reverse Image Search"
  });

  menu.style.setProperty("--menu-left", `${x}px`);
  menu.style.setProperty("--menu-top", `${y}px`);

  const rootList = el("ul");

  for (const [name, url] of Object.entries(Engines)) {
    rootList.appendChild(
      makeItem(name, getEngineIcon(url), () => searchImage(src, url))
    );
  }

  rootList.appendChild(
    makeItem("Search All Engines", "", () => searchAllEngines(src))
  );

  menu.appendChild(rootList);
  document.body.appendChild(menu);

  const { offsetWidth: w, offsetHeight: h } = menu;
  const clampedX = Math.min(x, window.innerWidth - w - 8);
  const clampedY = Math.min(y, window.innerHeight - h - 8);

  menu.style.setProperty("--menu-left", `${clampedX}px`);
  menu.style.setProperty("--menu-top", `${clampedY}px`);

  return menu;
}

function makeItem(
  label: string,
  iconUrl: string,
  action: () => void
): HTMLElement {
  const li = el("li", { role: "menuitem", tabIndex: "0" });

  if (iconUrl) {
    const img = el("img", {
      src: iconUrl,
      width: "16",
      height: "16"
    });
    img.style.marginRight = "8px";
    img.style.verticalAlign = "middle";
    li.appendChild(img);
  }

  const span = el("span");
  span.textContent = label;
  li.appendChild(span);

  const activate = () => {
    action();
    closeMenu();
  };

  li.addEventListener("click", activate);
  li.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  });

  return li;
}

function closeMenu(): void {
  activeMenu?.remove();
  activeMenu = null;
}

function getImageSrc(target: HTMLElement): string | null {
  let node: HTMLElement | null = target;
  for (let i = 0; i < 6 && node; i++) {
    if (node instanceof HTMLImageElement) {
      return (
        node.dataset.originalSrc ||
        node.getAttribute("data-original-src") ||
        node.src ||
        null
      );
    }
    if (node.dataset.src) return node.dataset.src;
    node = node.parentElement;
  }
  return null;
}

function onContextMenu(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const src = getImageSrc(target);
  if (!src) return;

  const showImageSearch =
    target.id === "preview-image" ||
    target.parentElement?.classList.contains("media-wrapper");

  if (!showImageSearch) return;

  e.preventDefault();
  e.stopPropagation();

  closeMenu();
  activeMenu = buildMenu(src, e.clientX, e.clientY);

  setTimeout(() => {
    document.addEventListener("mousedown", onOutside, { capture: true, once: true });
    document.addEventListener("keydown", onEscape, { capture: true, once: true });
  });
}

function onOutside(e: MouseEvent): void {
  if (!activeMenu?.contains(e.target as Node)) closeMenu();
}

function onEscape(e: KeyboardEvent): void {
  if (e.key === "Escape") closeMenu();
}

export function initReverseImageSearch() {
  document.addEventListener("contextmenu", onContextMenu, true);
}

initReverseImageSearch();