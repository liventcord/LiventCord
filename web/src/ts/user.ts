import store from "../store";
import {
  profileDiscriminator,
  selfDiscriminator,
  selfName,
  updateSelfProfile
} from "./avatar.ts";
import { initialState, userStatus } from "./app.ts";
import { socketClient, SocketEvent } from "./socketEvents.ts";
import { alertUser } from "./ui.ts";
import { translations } from "./translations.ts";
import { getId } from "./utils.ts";

export interface Member {
  userId: string;
  nickName: string;
  status: string;
}

export let currentUserId: string;

export let currentDiscriminator: string;
export let currentUserNick: string;
export interface UserInfo {
  userId: string;
  nickName: string;
  discriminator: string;
  status?: string;
  activity?: string;
  description?: string;
  isFriendsRequestToUser?: boolean;
  createdAt?: string;
  lastLogin?: string;
  socialMediaLinks?: string[];
  isPending?: boolean;
  isBlocked?: boolean;
}

export const deletedUser = "Deleted User";
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
let lastTopSenderId = null;

export function setLastTopSenderId(id: string) {
  if (!id) return;
  lastTopSenderId = id;
}

function validatePassword(password: string) {
  return password && password.length >= 5;
}

export function changePassword(
  event: KeyboardEvent | null,
  currentInput: HTMLInputElement,
  newPasswordInput: HTMLInputElement,
  newPasswordConfirmInput: HTMLInputElement,
  successCallback: CallableFunction
) {
  const currentPasswordValue = currentInput.value;
  const passwordValue = newPasswordInput.value;
  const newPasswordConfirm = newPasswordConfirmInput.value;

  if (!currentPasswordValue || !passwordValue || !newPasswordConfirm) {
    alertUser(translations.getSettingsTranslation("PasswordInvalid"));
    return;
  }

  if (passwordValue !== newPasswordConfirm) {
    alertUser(translations.getSettingsTranslation("PasswordConfirmationAlert"));
    return;
  }

  if (event) {
    event.preventDefault();
  }

  currentInput.setCustomValidity("");
  newPasswordInput.setCustomValidity("");
  newPasswordConfirmInput.setCustomValidity("");

  if (!validatePassword(passwordValue)) {
    setInputValidity(
      newPasswordInput,
      translations.getSettingsTranslation("PasswordInvalid")
    );
    return;
  }

  const formData = new FormData();
  formData.append("CurrentPassword", currentPasswordValue);
  formData.append("NewPassword", passwordValue);

  fetch("/auth/change-password", {
    method: "POST",
    body: formData
  })
    .then((response) => {
      if (!response.ok) {
        if (response.status === 400) {
          return response.text().then((text) => {
            if (text === "Current password is incorrect") {
              alertUser(translations.getSettingsTranslation("PasswordInvalid"));
            }
          });
        } else {
          alertUser(String(response.status));
        }
        return;
      }
      successCallback();
      alertUser(translations.getSettingsTranslation("PasswordChangeSuccess"));
    })
    .catch((error) => {
      console.error("Error:", error);
      alertUser(translations.getSettingsTranslation("PasswordChangeError"));
    });
}

function setInputValidity(input: HTMLInputElement, message: string) {
  input.setCustomValidity(message);
  input.reportValidity();
}

class UserManager {
  private userNames: { [userId: string]: UserInfo } = {};
  private isSelfOnline: boolean = false;
  private statusCache: Record<string, Promise<boolean> | boolean> = {};

  constructor() {
    this.userNames["1"] = {
      userId: "1",
      nickName: "Clyde",
      discriminator: "0000",
      isBlocked: false,
      status: "offline",
      description: ""
    };
  }

  setUserNick(newNickname: string) {
    currentUserNick = newNickname;
  }

  setCurrentUserId(id: string) {
    currentUserId = id;
  }

  getUserInfo(userId: string) {
    return this.userNames[userId];
  }

  getUserNick(userId: string): string {
    if (userId && currentUserId && currentUserId === userId) {
      return currentUserNick;
    }
    return this.userNames[userId]?.nickName ?? "Deleted User";
  }

  getUserDiscriminator(userId: string): string {
    return this.userNames[userId]?.discriminator ?? "0000";
  }

  getUserIdFromNick(nick: string): string | null {
    for (const [userId, userInfo] of Object.entries(this.userNames)) {
      if (userInfo.nickName === nick) {
        return userId;
      }
    }
    return null;
  }

  isUserBlocked(userId: string): boolean {
    return this.userNames[userId]?.isBlocked ?? false;
  }

  addUser(
    userId: string,
    nick: string = deletedUser,
    discriminator: string = "",
    isBlocked?: boolean
  ) {
    console.log("Adding user: ", userId, nick, discriminator);

    this.userNames[userId] = {
      nickName: nick,
      discriminator,
      isBlocked: Boolean(isBlocked),
      userId,
      status: "offline",
      description: ""
    };
  }

  updateMemberStatus(userId: string, status: string): void {
    if (!this.userNames[userId]) {
      console.error(userId, "does not exist!");
      this.addUser(userId);
    }
    if (this.userNames[userId]) {
      console.log("Updating user status for: ", userId, status);
      this.userNames[userId].status = status;
      if (store)
        store.dispatch("updateStatusInMembersList", {
          userId,
          status
        });
    } else {
      console.error("Failed to add user:", userId);
    }
  }

  getMemberStatus(userId: string): string {
    return this.userNames[userId]?.status ?? "offline";
  }
  async isNotOffline(userId: string): Promise<boolean> {
    const cachedStatus = this.statusCache[userId];
    if (cachedStatus instanceof Promise) return cachedStatus;
    if (cachedStatus !== undefined) return Boolean(cachedStatus);

    const currentStatus = this.userNames[userId]?.status;
    if (currentStatus !== undefined) {
      const isNotOffline = currentStatus !== "offline";
      this.statusCache[userId] = isNotOffline;
      return isNotOffline;
    }

    const statusPromise = this.getStatusString(userId).then((status) => {
      const isNotOffline = status !== "offline";
      this.statusCache[userId] = isNotOffline;
      return isNotOffline;
    });
    this.statusCache[userId] = statusPromise;
    return statusPromise;
  }

  async isOnline(userId: string): Promise<boolean> {
    return this.isNotOffline(userId);
  }

  async fetchImmediateStatus(userId: string): Promise<string | null> {
    return new Promise((resolve) => {
      socketClient.getUserStatus([userId]);

      const listener = (statusData: { userId: string; status: string }) => {
        if (statusData.userId === userId) {
          socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
          resolve(statusData.status);
        }
      };

      socketClient.on(SocketEvent.UPDATE_USER_STATUS, listener);
      setTimeout(() => {
        socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
        resolve(null);
      }, 200);
    });
  }

  async getStatus(userId: string): Promise<boolean> {
    return Promise.race([
      this.fetchImmediateStatus(userId).then((status) =>
        status !== null ? status === "online" : null
      ),
      this.pollStatusBoolean(userId, 3000)
    ]).then((status) => status ?? false);
  }

  async getStatusString(userId: string): Promise<string> {
    const currentStatus = this.userNames[userId]?.status;
    if (currentStatus !== undefined) {
      return currentStatus;
    }

    return Promise.race([
      this.fetchImmediateStatus(userId).then((status) =>
        status !== null ? status : null
      ),
      this.pollStatusString(userId, 3000)
    ]).then((status) => status ?? "offline");
  }

  private pollStatusBoolean(userId: string, timeout: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const checkStatus = setInterval(() => {
        const updatedStatus = this.userNames[userId]?.status;
        if (updatedStatus !== undefined) {
          clearInterval(checkStatus);
          socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
          resolve(updatedStatus === "online");
        }
      }, 100);

      const listener = (statusData: { userId: string; status: string }) => {
        if (statusData.userId === userId) {
          clearInterval(checkStatus);
          socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
          resolve(statusData.status === "online");
        }
      };

      socketClient.on(SocketEvent.UPDATE_USER_STATUS, listener);

      setTimeout(() => {
        clearInterval(checkStatus);
        socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
        resolve(false);
      }, timeout);

      socketClient.getUserStatus([userId]);
    });
  }

  private pollStatusString(userId: string, timeout: number): Promise<string> {
    return new Promise<string>((resolve) => {
      const checkStatus = setInterval(() => {
        const updatedStatus = this.userNames[userId]?.status;
        if (updatedStatus !== undefined) {
          clearInterval(checkStatus);
          socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
          resolve(updatedStatus);
        }
      }, 100);

      const listener = (statusData: { userId: string; status: string }) => {
        if (statusData.userId === userId) {
          clearInterval(checkStatus);
          socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
          resolve(statusData.status);
        }
      };

      socketClient.on(SocketEvent.UPDATE_USER_STATUS, listener);

      setTimeout(() => {
        clearInterval(checkStatus);
        socketClient.off(SocketEvent.UPDATE_USER_STATUS, listener);
        resolve("offline");
      }, timeout);

      socketClient.getUserStatus([userId]);
    });
  }
}

export const userManager = new UserManager();

export function initializeProfile() {
  userManager.setCurrentUserId(initialState.user.userId);
  socketClient.onUserIdAvailable();

  currentUserNick = initialState.user.nickname;
  currentDiscriminator = initialState.user.discriminator;
  selfName.textContent = currentUserNick;
  selfDiscriminator.textContent = "#" + initialState.user.discriminator;
  const profileDiscriminator = getId("profile-discriminator");
  if (profileDiscriminator)
    profileDiscriminator.textContent = "#" + initialState.user.discriminator;
  userStatus.setSelfStatus(initialState.user.status);
  updateSelfProfile(currentUserId, currentUserNick);
}

export function getSelfFullDisplay() {
  return initialState.user.nickname + "#" + initialState.user.discriminator;
}
