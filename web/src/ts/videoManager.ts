import { getId, isMobile } from "./utils";

const myVideo: HTMLVideoElement | null = getId(
  "local_vid"
) as HTMLVideoElement | null;

export function isDraggable(): boolean {
  const parent = myVideo?.parentElement as HTMLElement;
  return parent === document.body;
}

interface SnapPoint {
  x: number;
  y: number;
}

function getSnapPoints(): SnapPoint[] {
  if (!myVideo) return [];
  const sw = window.innerWidth;
  const sh = window.innerHeight;
  const offsetX = 80;
  const offsetY = 135;

  return [
    { x: offsetX, y: offsetY },
    { x: offsetX, y: sh - myVideo.offsetHeight - offsetY },
    { x: sw - myVideo.offsetWidth - offsetX, y: offsetY },
    {
      x: sw - myVideo.offsetWidth - offsetX,
      y: sh - myVideo.offsetHeight - offsetY
    }
  ];
}

function snapToNearestPoint() {
  if (!myVideo) return;
  const rect = myVideo.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  let nearest: SnapPoint = getSnapPoints()[0];
  let minDist = Infinity;

  getSnapPoints().forEach((p) => {
    const dx = cx - (p.x + myVideo!.offsetWidth / 2);
    const dy = cy - (p.y + myVideo!.offsetHeight / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      nearest = p;
    }
  });

  myVideo.style.transition = "left 0.3s ease, top 0.3s ease";
  myVideo.style.left = nearest.x + "px";
  myVideo.style.top = nearest.y + "px";
  setTimeout(() => (myVideo!.style.transition = ""), 300);
}

export function initialiseSelfVideo() {
  if (!myVideo) return;
  myVideo.style.position = "absolute";
  const sw = window.innerWidth;
  const sh = window.innerHeight;

  if (!myVideo.style.left)
    myVideo.style.left = sw - myVideo.offsetWidth - 100 + "px";
  if (!myVideo.style.top)
    myVideo.style.top = sh - myVideo.offsetHeight - 100 + "px";

  if (isMobile) setupMobileDragging();
  else setupDesktopDragging();
}

function setupDesktopDragging() {
  if (!myVideo) return;
  let dragging = false;
  let startX = 0,
    startY = 0,
    startLeft = 0,
    startTop = 0;

  myVideo.addEventListener("mousedown", (e: MouseEvent) => {
    if (!isDraggable()) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(myVideo!.style.left, 10);
    startTop = parseInt(myVideo!.style.top, 10);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  function onMove(e: MouseEvent) {
    if (!dragging || !isDraggable()) return;
    let x = startLeft + (e.clientX - startX);
    let y = startTop + (e.clientY - startY);
    x = Math.max(0, Math.min(x, window.innerWidth - myVideo!.offsetWidth));
    y = Math.max(0, Math.min(y, window.innerHeight - myVideo!.offsetHeight));
    myVideo!.style.left = x + "px";
    myVideo!.style.top = y + "px";
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    snapToNearestPoint();
  }
}

function setupMobileDragging() {
  if (!myVideo) return;
  let startX = 0,
    startY = 0,
    offsetX = 0,
    offsetY = 0;
  let dragging = false;
  const stabilizer: number = 0;

  myVideo.addEventListener("touchstart", (e: TouchEvent) => {
    if (!isDraggable()) return;
    clearTimeout(stabilizer);
    dragging = true;
    offsetX = 0;
    offsetY = 0;
    startX = e.touches[0].clientX - offsetX;
    startY = e.touches[0].clientY - offsetY;
  });

  myVideo.addEventListener("touchmove", (e: TouchEvent) => {
    if (!dragging || !isDraggable()) return;
    e.preventDefault();
    offsetX = e.touches[0].clientX - startX;
    offsetY = e.touches[0].clientY - startY;
    myVideo!.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
  });

  myVideo.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    clearTimeout(stabilizer);
    snapToNearestPoint();
  });
}

function applyStyles(
  video: HTMLVideoElement,
  maxWidth: string,
  maxHeight: string,
  width: string = "100%",
  height: string = "auto",
  zIndex: string = "1"
) {
  Object.assign(video.style, { maxWidth, maxHeight, width, height, zIndex });
}

export function checkVideoLayout() {
  snapToNearestPoint();
  const grid = getId("video_grid");
  if (!grid) return;
  const videos = Array.from(
    grid.querySelectorAll("video")
  ) as HTMLVideoElement[];
  const count = videos.length;

  if (count === 1) applyStyles(videos[0], "100%", "100%");
  else if (count === 2) videos.forEach((v) => applyStyles(v, "50%", "100%"));
  else if (count === 3) {
    applyStyles(videos[0], "100%", "50%");
    videos.slice(1).forEach((v) => applyStyles(v, "50%", "50%"));
  } else if (count === 4) videos.forEach((v) => applyStyles(v, "50%", "50%"));
  else if (count > 4) {
    const rows = Math.ceil(Math.sqrt(count));
    const cols = Math.ceil(count / rows);
    const videoHeight = 100 / rows;
    const videoWidth = 100 / cols;
    videos.forEach((v) =>
      applyStyles(
        v,
        `${videoWidth}%`,
        `${videoHeight}vh`,
        `${videoWidth}%`,
        "auto"
      )
    );
  }

  if (window.matchMedia("(max-width: 768px)").matches) {
    videos.forEach((v) => {
      if (v.id !== "local_vid") applyStyles(v, "100%", "auto");
    });
  }
}

checkVideoLayout();
window.addEventListener("resize", checkVideoLayout);
window.addEventListener("click", checkVideoLayout);
