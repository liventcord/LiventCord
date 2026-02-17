import { createEl, getId, isMobile } from "./utils.ts";
import { createGuild, joinToGuild } from "./guild.ts";
import { translations } from "./translations.ts";
import { appState } from "./appState.ts";
import { isOnGuild } from "./router.ts";
import { fillDropDownContent } from "./ui.ts";
import { updateSettingsProfileColor } from "./settingsui.ts";
import {
  closePopUp,
  createPopUpCloseButton,
  setCloseCurrentJoinPop
} from "./popups.ts";

// --- Dropdown state ---

let isDropdownOpen = false;

export function hideGuildSettingsDropdown() {
  isDropdownOpen = false;
}

export function closeDropdown() {
  const dropdown = getId("guild-settings-dropdown");
  if (!dropdown || !isDropdownOpen) return;
  dropdown.style.animation = "fadeOut 0.3s forwards";
  setTimeout(() => {
    dropdown.style.display = "none";
    isDropdownOpen = false;
  }, 300);
}

export function toggleDropdown() {
  if (!isOnGuild) return;
  const dropdown = getId("guild-settings-dropdown");
  if (!dropdown) return;
  if (!isDropdownOpen) {
    isDropdownOpen = true;
    dropdown.style.display = "flex";
    dropdown.style.animation = "fadeIn 0.3s forwards";
    fillDropDownContent();
  } else {
    closeDropdown();
  }
}

// --- Image upload helper

function handleImageUpload(
  guildImageEl: HTMLElement,
  uploadText: HTMLElement,
  clearBtn: HTMLElement,
  event: Event
) {
  const input = event.target as HTMLInputElement;
  const file = input?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target?.result;
    if (typeof result !== "string") {
      console.error("Error: Loaded file is not a valid image string.");
      return;
    }
    const svg = document.getElementById("guildImg");
    if (svg) {
      const img = Object.assign(new Image(), { src: result, id: "guildImg" });
      svg.replaceWith(img);
    }
    Object.assign(guildImageEl.style, {
      backgroundImage: `url(${result})`,
      backgroundSize: "cover",
      backgroundPosition: "center"
    });
    uploadText.style.display = "none";
    clearBtn.style.display = "flex";
    guildImageEl.className = "guildImage";
  };
  reader.readAsDataURL(file);
}

// --- Guild creation panel

function buildGuildCreationPanel(
  popDiv: HTMLElement,
  buttonContainer: HTMLElement,
  contentEl: HTMLElement,
  subjectEl: HTMLElement,
  closeCallback: () => void
) {
  if (!appState.currentUserId) return;
  buttonContainer.parentNode?.removeChild(buttonContainer);

  subjectEl.textContent = translations.getTranslation("customize-guild");
  contentEl.textContent = translations.getTranslation("customize-guild-detail");

  const nameInput = createEl("input", {
    value: translations.generateGuildName(appState.currentUserId),
    id: "guild-name-input"
  }) as HTMLInputElement;

  const createBtn = createEl("button", {
    textContent: translations.getTranslation("create"),
    className: "create-guild-verify common-button"
  });
  const backBtn = createEl("button", {
    textContent: translations.getTranslation("back"),
    className: "create-guild-back common-button"
  });

  backBtn.addEventListener("click", async (e) => {
    closeCallback();
    await showGuildPop();
  });

  const nameTitle = createEl("h1", {
    textContent: translations.getTranslation("guildname"),
    className: "create-guild-title"
  });

  // Image upload
  const imageForm = createEl("div", {
    id: "guildImageForm",
    accept: "image/*"
  });
  const imageInput = createEl("input", {
    type: "file",
    id: "guildImageInput",
    accept: "image/*",
    style: { display: "none" }
  }) as HTMLInputElement;
  const imageEl = createEl("div", {
    id: "guildImg",
    className: "fas fa-camera"
  });
  const uploadText = createEl("p", {
    id: "uploadText",
    textContent: translations.getTranslation("upload")
  });
  const clearBtn = createEl("button", {
    id: "clearButton",
    textContent: "X",
    style: { display: "none" }
  });

  imageEl.addEventListener("click", () => imageInput.click());
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    imageEl.style.backgroundImage = "";
    uploadText.style.display = "block";
    clearBtn.style.display = "none";
    imageInput.value = "";
  });
  imageInput.addEventListener("change", (e) =>
    handleImageUpload(imageEl, uploadText, clearBtn, e)
  );

  // Delegate body click for guildImg (set up once)
  if (!document.body.dataset.guildImgListenerSet) {
    document.body.dataset.guildImgListenerSet = "true";
    document.body.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("#guildImg")) imageInput.click();
    });
  }

  let created = false;
  createBtn.addEventListener("click", () => {
    if (!created) {
      createGuild();
      created = true;
    }
  });

  imageForm.append(uploadText, clearBtn, imageInput, imageEl);
  popDiv.style.animation = "guild-pop-up-create-guild-animation 0.3s forwards";
  popDiv.append(imageForm, nameTitle, nameInput, createBtn, backBtn);
}

// --- Guild join panel

function buildGuildJoinPanel(
  popDiv: HTMLElement,
  buttonContainer: HTMLElement,
  contentEl: HTMLElement,
  subjectEl: HTMLElement,
  closeCallback: () => void,
  inviteId?: string
) {
  buttonContainer?.remove();
  subjectEl.textContent = translations.getTranslation("join-a-guild");
  contentEl.textContent = translations.getTranslation("join-a-guild-detail");

  const protocol = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : "";
  const exampleBase = `${protocol}//${host}${port}`;

  const nameInput = createEl("input", {
    placeholder: `${protocol}//${host}/hTKzmak`,
    id: "guild-name-input"
  }) as HTMLInputElement;
  if (inviteId) nameInput.value = inviteId;

  const joinBtn = createEl("button", {
    textContent: translations.getTranslation("join-guild"),
    className: "create-guild-verify common-button",
    style: {
      fontSize: "14px",
      whiteSpace: "nowrap",
      padding: "0px",
      width: "120px"
    }
  });
  const backBtn = createEl("button", {
    textContent: translations.getTranslation("back"),
    className: "create-guild-back common-button"
  });
  const nameTitle = createEl("h1", {
    textContent: translations.getTranslation("invite-link"),
    className: "create-guild-title",
    id: "create-guild-title",
    style: { top: "25%" }
  });

  joinBtn.addEventListener("click", () => {
    if (!nameInput.value) {
      nameTitle.textContent = translations.getTranslation(
        "guild-join-invite-title"
      );
      nameTitle.style.color = "red";
      setTimeout(() => {
        nameTitle.textContent = translations.getTranslation("invite-link");
        nameTitle.style.color = "white";
      }, 5000);
      return;
    }
    joinToGuild(nameInput.value);
    setCloseCurrentJoinPop(closeCallback);
  });

  backBtn.addEventListener("click", async () => {
    closeCallback();
    await showGuildPop();
  });

  const examplesHtml = `hTKzmak<br>${exampleBase}/join-guild/hTKzmak<br>${exampleBase}/join-guild/cool-people`;
  const descTitle = createEl("h1", {
    textContent: translations.getTranslation("invites-look-like"),
    className: "create-guild-title",
    style: { top: "55%" }
  });
  const descContent = createEl("h1", {
    innerHTML: examplesHtml,
    className: "create-guild-title",
    style: { top: "60%", textAlign: "left", color: "white" }
  });

  nameInput.style.bottom = "50%";

  const guildPopButtonContainer = createEl("div", {
    className: "guild-pop-button-container"
  });
  guildPopButtonContainer.appendChild(
    createEl("div", { className: "popup-bottom-container" })
  );
  popDiv.appendChild(guildPopButtonContainer);

  popDiv.style.animation = "guild-pop-up-join-guild-animation 0.3s forwards";
  popDiv.append(nameTitle, descTitle, descContent, nameInput, joinBtn, backBtn);
}

/** Opens the main guild selection popup (create or join). */
export async function showGuildPop(inviteId?: string) {
  const subject = translations.getTranslation("create-your-guild");
  const content = translations.getTranslation("create-your-guild-detail");

  const outerParent = createEl("div", { className: "outer-parent" });
  const popDiv = createEl("div", { className: "pop-up", id: "guild-pop-up" });
  const subjectEl = createEl("h1", {
    className: "guild-pop-up-subject",
    textContent: subject
  });
  const contentEl = createEl("p", {
    className: "guild-pop-up-content",
    textContent: content
  });
  const buttonContainer = createEl("div", {
    className: "guild-pop-button-container"
  });

  const closeCallback = () => closePopUp(outerParent, popDiv);

  const createBtn = createEl("button", {
    id: "popOptionButton",
    className: "guild-pop-up-accept",
    textContent: translations.getTranslation("create-myself")
  });
  createBtn.addEventListener("click", () =>
    buildGuildCreationPanel(
      popDiv,
      buttonContainer,
      contentEl,
      subjectEl,
      closeCallback
    )
  );

  const joinTitle = createEl("p", {
    className: "guild-pop-up-content",
    id: "guild-popup-option2-title",
    textContent: translations.getTranslation("already-have-invite")
  });
  const joinBtn = createEl("button", {
    id: "popOptionButton2",
    className: "guild-pop-up-accept",
    textContent: translations.getTranslation("join-a-guild")
  });
  joinBtn.addEventListener("click", () =>
    buildGuildJoinPanel(
      popDiv,
      buttonContainer,
      contentEl,
      subjectEl,
      closeCallback
    )
  );

  const bottomContainer = createEl("div", {
    className: "popup-bottom-container"
  });
  bottomContainer.append(joinTitle, joinBtn);
  buttonContainer.append(createBtn, bottomContainer);

  const closeBtn = createPopUpCloseButton(outerParent, popDiv, "popup-close");

  popDiv.append(subjectEl, contentEl, buttonContainer, closeBtn);
  outerParent.appendChild(popDiv);
  outerParent.style.display = "flex";
  outerParent.addEventListener("click", (e) => {
    if (e.target === outerParent) closeCallback();
  });

  if (inviteId) {
    buildGuildJoinPanel(
      popDiv,
      buttonContainer,
      contentEl,
      subjectEl,
      closeCallback,
      inviteId
    );
  }

  document.body.appendChild(outerParent);
}

// --- Crop popup

export async function createCropPop(
  inputSrc: string,
  callbackAfterAccept: (base64: string) => void
) {
  const [{ default: Croppie }] = await Promise.all([
    import("croppie"),
    import("croppie/croppie.css")
  ]);

  const inviteTitle = createEl("p", {
    id: "invite-users-title",
    textContent: translations.getTranslation("crop-title")
  });
  const imageContainer = createEl("div", { id: "image-container" });

  const bottomContainer = createEl("div", {
    className: "popup-bottom-container",
    id: "invite-popup-bottom-container",
    style: { bottom: "-5%", top: "auto", height: "10%", zIndex: "-1" }
  });

  const backBtn = createEl("button", {
    textContent: translations.getTranslation("cancel"),
    className: "create-guild-back common-button",
    style: { left: "20px" }
  });
  const appendBtn = createEl("button", {
    className: "pop-up-append",
    textContent: translations.getTranslation("append")
  });

  const contentElements = [
    inviteTitle,
    imageContainer,
    backBtn,
    appendBtn,
    bottomContainer
  ];

  const { createPopUp: _create } = await import("./popups.ts");
  const parentContainer = _create({
    contentElements,
    id: "cropPopContainer",
    closeBtnId: "invite-close-button"
  });

  const croppie = new Croppie(imageContainer, {
    viewport: { width: 430, height: 430, type: "circle" },
    boundary: { width: 440, height: 440 },
    showZoomer: true,
    enableExif: true
  });
  croppie.bind({ url: inputSrc });

  appendBtn.addEventListener("click", () => {
    croppie
      .result({
        type: "base64",
        format: "jpeg",
        quality: 1,
        size: { width: 430, height: 430 },
        circle: false
      })
      .then((base64: string) => {
        callbackAfterAccept(base64);
        parentContainer.remove();
        updateSettingsProfileColor();
      });
  });
  backBtn.addEventListener("click", () => parentContainer.remove());

  const cropPop = getId("cropPopContainer");
  if (cropPop) {
    cropPop.style.setProperty("height", "600px", "important");
    cropPop.style.setProperty(
      "width",
      isMobile ? "400px" : "600px",
      "important"
    );
  }

  const slider = imageContainer.querySelector<HTMLElement>(
    ".cr-slider-wrap .cr-slider"
  );
  if (slider) slider.style.transform = "scale(1.5)";
}

export function openSearchPop() {
  // TODO: implement search popup
}
