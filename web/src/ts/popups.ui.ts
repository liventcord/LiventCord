import { createEl } from "./utils.ts";
import { closePopUp, createPopUp } from "./popups.ts";
import { translations } from "./translations.ts";
import { changePassword } from "./user.ts";

// ─── Popup content builder ────────────────────────────────────────────────────

interface PopupOptions {
  includeCancel?: boolean;
  subject: string;
  content: string;
  buttonText: string;
  acceptCallback?: CallableFunction;
  isRed?: boolean;
}

function buildPopupContent(opts: PopupOptions): HTMLElement {
  const {
    includeCancel = false,
    subject,
    content,
    buttonText,
    acceptCallback,
    isRed
  } = opts;

  const popUpSubject = createEl("h1", {
    className: "pop-up-subject",
    textContent: subject
  });
  const popUpContent = createEl("p", {
    className: "pop-up-content",
    textContent: content
  });
  const buttonContainer = createEl("div", {
    className: "pop-button-container"
  });
  const popAcceptButton = createEl("button", {
    className: "pop-up-accept",
    textContent: buttonText
  });

  if (isRed) popAcceptButton.style.backgroundColor = "rgb(218, 55, 60)";

  const outerParent = createPopUp({
    contentElements: [popUpSubject, popUpContent, buttonContainer],
    id: ""
  });

  const handleEnterKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") accept();
  };

  const accept = () => {
    acceptCallback?.();
    if (outerParent?.firstChild) {
      closePopUp(outerParent, outerParent.firstChild as HTMLElement);
      document.removeEventListener("keydown", handleEnterKeydown);
    }
  };

  const dismiss = () => {
    if (outerParent?.firstChild) {
      closePopUp(outerParent, outerParent.firstChild as HTMLElement);
      document.removeEventListener("keydown", handleEnterKeydown);
    }
  };

  if (includeCancel) {
    const refuseBtn = createEl("button", {
      className: "pop-up-refuse",
      textContent: translations.getTranslation("cancel")
    });
    refuseBtn.addEventListener("click", dismiss);
    buttonContainer.appendChild(refuseBtn);
  }

  buttonContainer.appendChild(popAcceptButton);
  popAcceptButton.addEventListener("click", accept);
  document.addEventListener("keydown", handleEnterKeydown);

  return outerParent;
}

// ─── Alert queue ──────────────────────────────────────────────────────────────

const popupQueue: Array<{ subject: string; content?: string }> = [];
let isPopupVisible = false;
let currentPopupEl: HTMLElement | null = null;

export function alertUser(subject: string, content?: string): void {
  popupQueue.push({ subject, content });
  if (!isPopupVisible) showNextPopup();
}

function showNextPopup(): void {
  if (!popupQueue.length) {
    isPopupVisible = false;
    return;
  }

  isPopupVisible = true;
  const { subject, content } = popupQueue.shift()!;
  const displayContent = content ?? subject;

  console.error(subject, displayContent);

  const outerParent = buildPopupContent({
    subject,
    content: displayContent,
    buttonText: translations.getTranslation("ok"),
    acceptCallback: () => {
      isPopupVisible = false;
      showNextPopup();
    }
  });

  outerParent.style.zIndex = "1000";
  currentPopupEl = outerParent;
  document.body.appendChild(outerParent);
}

export function dismissCurrentPopupIf(subject: string): void {
  if (!currentPopupEl) return;
  const titleEl = currentPopupEl.querySelector(".pop-up-subject");
  if (titleEl?.textContent === subject) {
    currentPopupEl.remove();
    currentPopupEl = null;
    isPopupVisible = false;
    showNextPopup();
  }
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

export function askUser(
  subject: string,
  content: string,
  actionText: string,
  acceptCallback: CallableFunction,
  isRed = false
): void {
  buildPopupContent({
    includeCancel: true,
    subject,
    content,
    buttonText: actionText,
    acceptCallback,
    isRed
  });
}

// ─── Change-password popup ────────────────────────────────────────────────────

export function openChangePasswordPop(): void {
  const t = (key: string) => translations.getSettingsTranslation(key);

  const popUpSubject = createEl("h1", {
    className: "pop-up-subject",
    textContent: t("UpdatePasswordTitle")
  });
  const popUpContent = createEl("p", {
    className: "pop-up-content",
    textContent: t("UpdatePasswordDescription")
  });
  Object.assign(popUpContent.style, { marginLeft: "50px", marginTop: "0px" });

  const popAcceptButton = createEl("button", {
    className: "pop-up-accept",
    textContent: translations.getTranslation("done")
  });
  const popRefuseButton = createEl("button", {
    className: "pop-up-refuse",
    textContent: translations.getTranslation("cancel")
  });
  Object.assign(popAcceptButton.style, { marginTop: "60px" });
  Object.assign(popRefuseButton.style, { marginTop: "60px" });

  const outerParent = createPopUp({
    contentElements: [popUpSubject, popUpContent],
    id: ""
  });
  const parentElement = outerParent.firstChild as HTMLElement;
  parentElement.style.animation = "pop-up-animation-password 0.3s forwards";
  parentElement.style.backgroundColor = "#37373E";

  const makePasswordField = (id: string, labelKey: string) => {
    const label = createEl("p", {
      id: `${id}-title`,
      textContent: t(labelKey)
    });
    label.classList.add("password-title");
    const input = createEl("input", {
      id,
      type: "password"
    }) as HTMLInputElement;
    input.classList.add("password-input");
    parentElement.appendChild(label);
    parentElement.appendChild(input);
    return input;
  };

  const currentInput = makePasswordField(
    "current-password-input",
    "UpdatePasswordCurrent"
  );
  const newInput = makePasswordField("new-password-input", "UpdatePasswordNew");
  const confirmInput = makePasswordField(
    "new-password-input-confirm",
    "UpdatePasswordNewConfirm"
  );

  const dismiss = () => {
    if (outerParent?.firstChild) {
      closePopUp(outerParent, outerParent.firstChild as HTMLElement);
      document.removeEventListener("keydown", onEnter);
    }
  };

  const accept = (event: KeyboardEvent | null) => {
    changePassword(event, currentInput, newInput, confirmInput, dismiss);
  };

  const onEnter = (e: KeyboardEvent) => {
    e.preventDefault();
    if (e.key === "Enter") accept(e);
  };

  parentElement.appendChild(popRefuseButton);
  parentElement.appendChild(popAcceptButton);

  popRefuseButton.addEventListener("click", dismiss);
  popAcceptButton.addEventListener("click", () => accept(null));
  document.addEventListener("keydown", onEnter);
}

// ─── Log-out confirm ──────────────────────────────────────────────────────────

export function logOutPrompt(): void {
  const logOut = translations.getTranslation("log-out-button");
  askUser(
    logOut,
    translations.getTranslation("log-out-prompt"),
    logOut,
    () => {},
    true
  );
}
