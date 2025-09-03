import { getId } from "./utils";

let myVideo: HTMLVideoElement | null = getId(
  "local_vid"
) as HTMLVideoElement | null;

interface SnapPoint {
  x: number;
  y: number;
}

function snapToNearestPoint() {
  if (!myVideo) return;

  const rect = myVideo.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const points = getSnapPoints();
  let nearest: SnapPoint = points[0];
  let minDist = Infinity;

  points.forEach((p) => {
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

export function initialiseSelfVideo() {
  if (!myVideo) return;

  myVideo.style.position = "absolute";

  const sw = window.innerWidth;
  const sh = window.innerHeight;

  if (!myVideo.style.left)
    myVideo.style.left = sw - myVideo.offsetWidth - 100 + "px";
  if (!myVideo.style.top)
    myVideo.style.top = sh - myVideo.offsetHeight - 100 + "px";

  if (getMobile()) {
    handleMobileDragging();
  } else {
    handleDesktopDragging();
  }

  function handleDesktopDragging() {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    myVideo!.addEventListener("mousedown", (e: MouseEvent) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(myVideo!.style.left, 10);
      startTop = parseInt(myVideo!.style.top, 10);
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    function onMove(e: MouseEvent) {
      if (!dragging) return;
      let x = startLeft + (e.clientX - startX);
      let y = startTop + (e.clientY - startY);
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      const w = myVideo!.offsetWidth;
      const h = myVideo!.offsetHeight;
      x = Math.max(0, Math.min(x, sw - w));
      y = Math.max(0, Math.min(y, sh - h));
      myVideo!.style.left = x + "px";
      myVideo!.style.top = y + "px";
    }

    function onUp() {
      dragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      snapToNearestPoint();
    }
  }

  function handleMobileDragging() {
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;
    let stabilizer: number = 0;

    myVideo!.addEventListener("touchstart", (e: TouchEvent) => {
      clearTimeout(stabilizer);
      dragging = true;
      offsetX = 0;
      offsetY = 0;
      startX = e.touches[0].clientX - offsetX;
      startY = e.touches[0].clientY - offsetY;
    });

    myVideo!.addEventListener("touchmove", (e: TouchEvent) => {
      if (!dragging) return;
      e.preventDefault();
      offsetX = e.touches[0].clientX - startX;
      offsetY = e.touches[0].clientY - startY;
      myVideo!.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
    });

    myVideo!.addEventListener("touchend", () => {
      dragging = false;
      clearTimeout(stabilizer);
      snapToNearestPoint();
    });
  }
}

function getMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function checkVideoLayout() {
  snapToNearestPoint();

  const grid = getId("video_grid");
  if (!grid) return;

  const videos = Array.from(
    grid.querySelectorAll("video")
  ) as HTMLVideoElement[];
  const count = videos.length;

  Object.assign(grid.style, {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center"
  });

  const setStyles = (
    video: HTMLVideoElement,
    {
      flex,
      maxWidth,
      maxHeight,
      width = "100%",
      height = "auto",
      zIndex = "1"
    }: {
      flex: string;
      maxWidth: string;
      maxHeight: string;
      width?: string;
      height?: string;
      zIndex?: string;
    }
  ) => {
    Object.assign(video.style, {
      flex,
      maxWidth,
      maxHeight,
      width,
      height,
      zIndex
    });
  };

  if (count === 1) {
    setStyles(videos[0], {
      flex: "1 1 100%",
      maxWidth: "100%",
      maxHeight: "100%"
    });
  } else if (count === 2) {
    videos.forEach((v) =>
      setStyles(v, { flex: "1 1 50%", maxWidth: "50%", maxHeight: "100%" })
    );
  } else if (count === 3) {
    setStyles(videos[0], {
      flex: "1 1 100%",
      maxWidth: "100%",
      maxHeight: "50%"
    });
    videos
      .slice(1)
      .forEach((v) =>
        setStyles(v, { flex: "1 1 50%", maxWidth: "50%", maxHeight: "50%" })
      );
  } else if (count === 4) {
    videos.forEach((v) =>
      setStyles(v, { flex: "1 1 50%", maxWidth: "50%", maxHeight: "50%" })
    );
  } else if (count > 4) {
    const rows = Math.ceil(Math.sqrt(count));
    const cols = Math.ceil(count / rows);
    const videoHeight = 100 / rows;
    const videoWidth = 100 / cols;
    videos.forEach((v) =>
      setStyles(v, {
        flex: `1 1 ${videoWidth}%`,
        maxWidth: `${videoWidth}%`,
        maxHeight: `${videoHeight}vh`
      })
    );
  }

  if (window.matchMedia("(max-width: 768px)").matches) {
    videos.forEach((v) => {
      if (v.id !== "local_vid") {
        setStyles(v, { flex: "1 1 100%", maxWidth: "100%", maxHeight: "auto" });
      }
    });
  }
}

checkVideoLayout();
window.addEventListener("resize", checkVideoLayout);
window.addEventListener("click", checkVideoLayout);
