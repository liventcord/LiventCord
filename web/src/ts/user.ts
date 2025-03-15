import {
  selfDiscriminator,
  selfName,
  selfStatus,
  updateSelfProfile
} from "./avatar.ts";
import { initialState } from "./app.ts";
import { translations } from "./translations.ts";
import { getId } from "./utils.ts";
import { socketClient } from "./socketEvents.ts";

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
class UserManager {
  private selfOnline = false;
  private userNames: { [userId: string]: UserInfo } = {};

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
    console.log("Searching for user ", userId, " in : ", this.userNames);
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
    nick: string = "",
    discriminator: string = "",
    isBlocked?: boolean
  ) {
    console.log("Adding user: ", userId, nick, discriminator);
    if (!nick) {
      console.error("Adding user without nick!: ", userId, discriminator);
      if (this.userNames[userId]) {
        console.log("User already exists, not overwriting: ", userId);
        return;
      }
    }
    this.userNames[userId] = {
      nickName: nick,
      discriminator,
      isBlocked: Boolean(isBlocked),
      userId,
      status,
      description: ""
    };
  }

  isSelfOnline() {
    return this.selfOnline;
  }

  updateMemberStatus(userId: string, status: string): void {
    if (!this.userNames[userId]) {
      this.userNames[userId] = {
        userId,
        nickName: "",
        discriminator: "",
        isBlocked: false,
        status,
        description: ""
      };
    } else {
      this.userNames[userId].status = status;
    }
    console.warn(this.userNames);
  }

  getMemberStatus(userId: string): string {
    return this.userNames[userId]?.status ?? "offline";
  }

  async isOnline(userId: string): Promise<boolean> {
    if (this.statusCache[userId] instanceof Promise) {
      return this.statusCache[userId];
    }

    if (this.statusCache[userId] !== undefined) {
      return this.statusCache[userId] as boolean;
    }

    const currentStatus = this.userNames[userId]?.status;

    if (currentStatus === "online") {
      this.statusCache[userId] = true;
      return true;
    }

    if (currentStatus === "offline") {
      this.statusCache[userId] = false;
      return false;
    }

    const statusPromise = this.getStatusPollingInternal(userId);
    this.statusCache[userId] = statusPromise;
    const isOnline = await statusPromise;
    this.statusCache[userId] = isOnline;

    return isOnline;
  }

  private pollStatus(
    userId: string,
    resolve: (status: string) => void,
    timeout: number
  ): void {
    const checkStatus = setInterval(() => {
      const updatedStatus = this.userNames[userId]?.status;
      if (updatedStatus) {
        clearInterval(checkStatus);
        resolve(updatedStatus);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkStatus);
      resolve("offline");
    }, timeout);

    socketClient.getUserStatus([userId]);
  }

  private getStatusPollingInternal(userId: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log("Polling status for user:", userId);
      this.pollStatus(userId, (status) => resolve(status === "online"), 5000);
    });
  }

  public getStatusPollingString(userId: string): Promise<string> {
    return new Promise((resolve) => {
      console.log("Polling status for user:", userId);
      this.pollStatus(userId, resolve, 5000);
    });
  }
}

export const userManager = new UserManager();

export const statusTypes = {
  offline: "offline",
  online: "online",
  "dont-disturb": "dont-disturb",
  idle: "idle"
};

export function setSelfStatus(status: string) {
  const status_translated =
    translations.getTranslation(
      statusTypes[status as keyof typeof statusTypes]
    ) ??
    translations.getTranslation(statusTypes.offline) ??
    "Unknown";

  selfStatus.textContent = status_translated;
}

export function initializeProfile() {
  userManager.setCurrentUserId(initialState.user.userId);
  currentUserNick = initialState.user.nickname;
  currentDiscriminator = initialState.user.discriminator;
  selfName.textContent = currentUserNick;
  selfDiscriminator.textContent = "#" + initialState.user.discriminator;
  setSelfStatus(initialState.user.status);
  updateSelfProfile(currentUserId, currentUserNick);
}

export function getSelfFullDisplay() {
  return initialState.user.nickname + "#" + initialState.user.discriminator;
}
const selfBubble = getId("self-bubble") as HTMLElement;

function updateSelfStatus(status: string) {
  if (!selfBubble) return;
  selfBubble.classList.value = "";
  selfBubble.classList.add(status);
  setSelfStatus(status);
}

export function updateUserOnlineStatus(userId: string, status: string) {
  if (userId === currentUserId) {
    updateSelfStatus(status);
  }
  console.log(userId, status);

  userManager.updateMemberStatus(userId, status);

  console.log(`User ${userId} not found in any guild`);
}
