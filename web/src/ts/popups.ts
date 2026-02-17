import { createEl } from "./utils.ts";
import { SVG } from "./svgIcons.ts";

export interface PopUpOptions {
  contentElements?: HTMLElement[];
  id: string;
  closeBtnId?: string | null;
  shouldDrawPanel?: boolean;
}

export let closeCurrentJoinPop: CallableFunction | null = null;
export function setCloseCurrentJoinPop(fn: CallableFunction | null) {
  closeCurrentJoinPop = fn;
}

// --- Helpers

/** Animates and removes the popup. Works for both overlay and panel modes. */
export function closePopUp(outerParent: HTMLElement, popParent: HTMLElement) {
  popParent.style.animation = "pop-up-shrink-animation 0.2s forwards";
  popParent.style.overflow = "hidden";
  setTimeout(() => outerParent.remove(), 200);
}

/** Creates a close button that calls closePopUp on click. */
export function createPopUpCloseButton(
  outerParent: HTMLElement,
  popParent: HTMLElement,
  className: string,
  id?: string
): HTMLButtonElement {
  const btn = createEl("button", { className }) as HTMLButtonElement;
  if (id) btn.id = id;

  btn.innerHTML = SVG.close;
  btn.addEventListener("click", () => closePopUp(outerParent, popParent));
  return btn;
}

export function toggleButtonState(isActive: boolean, btn: HTMLElement) {
  btn.classList.toggle("active", isActive);
  btn.classList.toggle("inactive", !isActive);
}

// --- Factory

/**
 * Creates a popup, wires overlay-click-to-close, appends to body.
 * Returns the outerParent (overlay) in normal mode, or the pop div in panel mode.
 */
export function createPopUp({
  contentElements = [],
  id,
  closeBtnId = null,
  shouldDrawPanel = false
}: PopUpOptions): HTMLElement {
  const outerParent = createEl("div", { className: "outer-parent" });
  const popDiv = createEl("div", { className: "pop-up", id });
  outerParent.style.display = "flex";

  contentElements.forEach((el) => popDiv.appendChild(el));

  if (closeBtnId) {
    popDiv.appendChild(
      createPopUpCloseButton(outerParent, popDiv, "popup-close", closeBtnId)
    );
  }

  if (shouldDrawPanel) {
    document.body.appendChild(popDiv);
    return popDiv;
  }

  // Overlay mode: close on background click (mousedown+mouseup on same target)
  let mouseDownOnOuter = false;
  outerParent.addEventListener("mousedown", (e) => {
    mouseDownOnOuter = e.target === outerParent;
  });
  outerParent.addEventListener("mouseup", (e) => {
    if (mouseDownOnOuter && e.target === outerParent) {
      closePopUp(outerParent, popDiv);
    }
    mouseDownOnOuter = false;
  });

  outerParent.appendChild(popDiv);
  document.body.appendChild(outerParent);
  return outerParent;
}
