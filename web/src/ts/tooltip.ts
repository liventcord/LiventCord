import { cacheInterface } from "./cache.ts";
import { translations } from "./translations.ts";
import { createEl } from "./utils.ts";

let tooltip: HTMLElement | null = null;
let isHoverTooltip: boolean = false;
let currentTarget: HTMLElement | null = null;

document.addEventListener("mouseover", async function (event) {
  const target = event.target as HTMLElement | null;
  if (
    !target ||
    target.classList.contains("tooltip") ||
    target === currentTarget
  )
    return;

  currentTarget = target;
  const name =
    target.id ||
    (target.closest("#tb-pin") ? "tb-pin" : getTooltipClassName(target));

  if (!name) return;

  let tooltipText = translations.getTooltipTranslation(name) || "";
  if (target.className === "guild-image") {
    const guildName = cacheInterface.getGuildName(target.id);
    tooltipText = guildName || tooltipText;
  }

  createTooltip(target, tooltipText);
  isHoverTooltip = true;
});

document.addEventListener("mouseout", function (event) {
  if (tooltip && isHoverTooltip && event.relatedTarget !== tooltip) {
    tooltip.remove();
    tooltip = null;
    isHoverTooltip = false;
    currentTarget = null;
  }
});

export function copyText(event: MouseEvent, text: string) {
  if (navigator.clipboard) navigator.clipboard.writeText(text);
  createTooltip(event.target as HTMLElement, "Copied!", {
    x: event.clientX,
    y: event.clientY
  });

  isHoverTooltip = false;
  setTimeout(() => tooltip?.remove(), 1200);
}

export function createTooltipAtCursor(text: string) {
  const event = window.event as MouseEvent | null;
  if (!event) return;

  createTooltip(document.body, text, {
    x: event.clientX,
    y: event.clientY
  });

  setTimeout(() => tooltip?.remove(), 1200);
}

function getTooltipClassName(target: HTMLElement): string | undefined {
  return Array.from(target.classList).find((className) =>
    translations.getTooltipTranslation(className)
  );
}

function createTooltip(
  target: HTMLElement,
  tooltipText: string,
  positionOffset: { x: number; y: number } = { x: 0, y: 0 }
) {
  if (!tooltipText) return;

  tooltip?.remove();
  tooltip = createEl("div", { className: "tooltip", textContent: tooltipText });
  document.body.appendChild(tooltip);

  let tooltipLeft = positionOffset.x - tooltip.offsetWidth / 2;
  let tooltipTop = positionOffset.y - tooltip.offsetHeight - 8;

  tooltipLeft = Math.max(
    10,
    Math.min(tooltipLeft, window.innerWidth - tooltip.offsetWidth - 10)
  );
  tooltipTop = Math.max(
    10,
    Math.min(tooltipTop, window.innerHeight - tooltip.offsetHeight - 10)
  );

  tooltip.style.left = `${tooltipLeft}px`;
  tooltip.style.top = `${tooltipTop}px`;

  tooltip.style.visibility = "visible";
  tooltip.style.opacity = "1";
  tooltip.style.zIndex = "1000";
  tooltip.style.pointerEvents = "none";
}

export function showHoverTooltip(target: HTMLElement, tooltipText: string) {
  createTooltip(target, tooltipText);
  isHoverTooltip = true;
}
