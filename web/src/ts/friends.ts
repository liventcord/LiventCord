import {
  disableElement,
  reCalculateFriTitle,
  enableElement,
  setWindowName,
  parseUsernameDiscriminator,
  getId,
  isValidFriendName
} from "./utils.ts";
import {
  getSelfFullDisplay,
  currentUserId,
  UserInfo,
  userManager
} from "./user.ts";
import { handleResize } from "./ui.ts";
import {
  populateFriendsContainer,
  isAddFriendsOpen,
  openAddFriend,
  printFriendMessage,
  ButtonTypes,
  createButtonWithBubblesImg,
  updateUsersActivities,
  updateFriendMenu,
  removeFriendCard,
  currentSelectedFriendMenu
} from "./friendui.ts";
import { translations } from "./translations.ts";
import { apiClient, EventType } from "./api.ts";
import { createTooltipAtCursor } from "./tooltip.ts";
import { appendToProfileContextList } from "./contextMenuActions.ts";

const pendingAlertRight = getId("pendingAlertRight") as HTMLElement;
const pendingAlertLeft = getId("pendingAlertLeft") as HTMLElement;

const FriendErrorType = {
  ERR_INVALID_EVENT: "ERR_INVALID_EVENT",
  ERR_CANNOT_ADD_SELF: "ERR_CANNOT_ADD_SELF",
  ERR_USER_NOT_FOUND: "ERR_USER_NOT_FOUND",
  ERR_INVALID_IDENTIFIER: "ERR_INVALID_IDENTIFIER",
  ERR_FRIEND_REQUEST_EXISTS: "ERR_FRIEND_REQUEST_EXISTS",
  ERR_FRIEND_REQUEST_NOT_EXISTS: "ERR_FRIEND_REQUEST_NOT_EXISTS",
  ERR_REQUEST_ALREADY_ACCEPTED: "ERR_REQUEST_ALREADY_ACCEPTED",
  ERR_NOT_FRIENDS: "ERR_NOT_FRIENDS",
  ERR_REQUEST_NOT_SENT: "ERR_REQUEST_NOT_SENT",
  ERR_SUCCESS: "ERR_SUCCESS"
};
interface FriendData {
  userId: string;
  nickName: string;
  discriminator: string;
  activity?: string;
  description?: string;
  createdAt?: string;
  lastLogin?: string;
  profileVersion?: string;
  socialMediaLinks?: string[];
  isPending: boolean;
  isFriendsRequestToUser: boolean;
}

export class Friend {
  userId: string;
  nickName: string;
  discriminator: string;
  profileVersion?: string;
  activity?: string;
  description?: string;
  createdAt?: string;
  lastLogin?: string;
  socialMediaLinks?: string[];
  isFriendsRequestToUser: boolean;
  isPending: boolean;

  constructor(friend: FriendData) {
    this.userId = friend.userId;
    this.nickName = friend.nickName;
    this.discriminator = friend.discriminator;
    this.description = friend.description;
    this.createdAt = friend.createdAt;
    this.lastLogin = friend.lastLogin;
    this.profileVersion = friend.profileVersion;
    this.socialMediaLinks = friend.socialMediaLinks;
    this.isFriendsRequestToUser = friend.isFriendsRequestToUser;
    this.isPending = friend.isPending;
    this.activity = friend.activity;
  }
}

class FriendsCache {
  friendsCache: Record<string, Friend>;
  dmFriends: Record<string, Friend>;
  currentDmId: string;

  constructor() {
    this.friendsCache = {};
    this.dmFriends = {};
    this.currentDmId = "";
  }

  setupDmFriends(friends: Record<string, Friend>) {
    this.dmFriends = friends;
    for (const friend of Object.values(friends)) {
      userManager.addUser(
        friend.userId,
        friend.nickName,
        friend.discriminator,
        "",
        false
      );
    }
  }

  removeDmFriend(friendId: string) {
    delete this.dmFriends[friendId];
  }

  initialiseFriends(initData: Record<string, Friend>) {
    this.friendsCache = {};

    Object.values(initData).forEach((friend) => {
      this.friendsCache[friend.userId] = friend;
    });
    const friends = this.cacheFriendToFriendConverter();
    friends.forEach((f) => {
      userManager.addUser(
        f.userId,
        f.nickName,
        f.discriminator,
        f.profileVersion
      );
      console.error(userManager.getUserProfileVersion(f.userId));
    });
    updateFriendsList(Object.values(this.friendsCache));
    requestAnimationFrame(() => {
      updateUsersActivities(friends);
    });

    UpdatePendingCounter();
  }

  addFriend(friendOrArray: Friend | UserInfo | any) {
    this.fetchFriends();
    if (Array.isArray(friendOrArray)) {
      for (const friendItem of friendOrArray) {
        this.addSingleFriend(friendItem);
      }
    } else {
      this.addSingleFriend(friendOrArray);
    }
    updateFriendsList(Object.values(this.friendsCache));

    UpdatePendingCounter();
  }
  fetchFriends() {
    apiClient.send(EventType.GET_FRIENDS);
  }

  getFriend(friendId: string) {
    return this.friendsCache[friendId] || null;
  }

  addFriendPending(friend: UserInfo) {
    const updatedFriend = { ...friend, isPending: true };
    this.addSingleFriend(updatedFriend);
  }

  addFriendNonPending(friend: UserInfo) {
    const updatedFriend = { ...friend, isPending: false };
    this.addSingleFriend(updatedFriend);
  }

  private addSingleFriend(friend: Friend | UserInfo | any) {
    if (!friend || !friend.userId) {
      console.error("Invalid friend data:", friend);
      return;
    }

    const userId = friend.userId;
    if (userId === currentUserId) {
      console.error("User id is same as friend!");
      return;
    }

    const defaultFriendData: FriendData = {
      userId,
      nickName: friend.nickName || "",
      discriminator: friend.discriminator || "",
      isFriendsRequestToUser: friend.isFriendsRequestToUser || false,
      isPending: friend.isPending || false
    };

    const friendData = { ...defaultFriendData, ...friend };

    this.friendsCache[userId] = this.friendsCache[userId]
      ? { ...this.friendsCache[userId], ...friendData }
      : new Friend(friendData);

    console.log("Added/Updated friend:", this.friendsCache[userId]);
  }

  removeFriend(userId: string) {
    if (userId in this.friendsCache) {
      delete this.friendsCache[userId];
      currentFriendInstances = currentFriendInstances.filter(
        (friend) => friend.userId !== userId
      );
      console.log("Friend removed successfully", this.friendsCache);
    } else {
      console.log("Friend not found in cache with ID:", userId);
    }
  }

  isFriend(userId: string): boolean {
    return (
      userId !== currentUserId &&
      userId in this.friendsCache &&
      !this.friendsCache[userId].isPending
    );
  }

  hasRequestToFriend(userId: string) {
    return (
      userId !== currentUserId &&
      userId in this.friendsCache &&
      this.friendsCache[userId].isPending
    );
  }

  userExistsDm(userId: string): boolean {
    console.log("User exists in dm: ", userId in this.dmFriends);
    return userId in this.dmFriends;
  }

  getFriendDiscriminator(friendId: string): string | undefined {
    return this.friendsCache[friendId]?.discriminator;
  }

  cacheFriendToFriendConverter() {
    console.log("Pulling from cache: ", this.friendsCache);
    return Object.values(this.friendsCache).map((friend) => new Friend(friend));
  }
}
export const friendsCache = new FriendsCache();

//actions

function getFriendMessage(
  userNick: string,
  isSuccess: boolean,
  errorType: string,
  status?: string
): string {
  if (isSuccess) {
  } else if (status) {
    return translations.getFriendErrorMessage(status);
  }
  return "";
}

function displayFriendActionMessage(
  userNick: string,
  isSuccess: boolean,
  errorType: string,
  status?: string
): void {
  const text = isSuccess
    ? getFriendMessage(userNick, isSuccess, errorType, status)
    : getFriendMessage(userNick, false, errorType, status);
  console.log(text);
  if (text) {
    printFriendMessage(text);
  }
}
interface FriendMessage {
  friendId: string;
  friendNick: string;
  friendData?: UserInfo;
  isSuccess: boolean;
  type: string;
}
function handleAddFriendResponse(message: FriendMessage): void {
  const { friendNick, isSuccess, friendData } = message;
  console.log("add friend response:", message);
  const pendingButton = getId("pending-button");
  if (pendingButton) {
    pendingButton.click();
  }
  displayFriendActionMessage(
    friendNick,
    isSuccess,
    FriendErrorType.ERR_FRIEND_REQUEST_EXISTS
  );
  if (friendData) {
    friendsCache.addFriend(friendData);
  }
  if (
    currentSelectedFriendMenu !== "pending" ||
    friendData?.userId === undefined
  ) {
    return;
  }
  updateFriendMenu();
}

function handleAcceptFriendRequestResponse(message: FriendMessage): void {
  const { friendId, friendNick, friendData, isSuccess } = message;

  displayFriendActionMessage(
    friendNick,
    isSuccess,
    FriendErrorType.ERR_REQUEST_ALREADY_ACCEPTED
  );

  if (isSuccess && friendData) {
    friendsCache.addFriendNonPending(friendData);

    if (currentSelectedFriendMenu === "pending") {
      removeFriendCard(friendId);
    }
  }
}

function handleRemoveFriendResponse(message: FriendMessage): void {
  const { friendId, friendNick, isSuccess } = message;

  const cachedFriend = friendsCache.getFriend(friendId);
  if (isSuccess) {
    removeFriendCard(friendId);
    friendsCache.removeFriend(friendId);
  }
  appendToProfileContextList(cachedFriend, friendId);

  displayFriendActionMessage(
    friendNick,
    isSuccess,
    FriendErrorType.ERR_NOT_FRIENDS
  );
}

function handleDenyFriendRequestResponse(message: FriendMessage): void {
  const { friendNick, isSuccess, friendId } = message;
  displayFriendActionMessage(
    friendNick,
    isSuccess,
    FriendErrorType.ERR_REQUEST_NOT_SENT
  );
  if (isSuccess) {
    removeFriendCard(friendId);
    friendsCache.removeFriend(friendId);
    UpdatePendingCounter();
    removeFriendCard(friendId);
  }
}

export function handleFriendEventResponse(message: FriendMessage): void {
  const { type } = message;
  console.log(type);

  switch (type) {
    case "add_friend":
    case "add_friend_id":
      handleAddFriendResponse(message);
      break;
    case "accept_friend":
      handleAcceptFriendRequestResponse(message);
      break;
    case "remove_friend":
      handleRemoveFriendResponse(message);
      break;
    case "deny_friend":
      handleDenyFriendRequestResponse(message);
      break;
    default:
      printFriendMessage("");
  }
  updateFriendsList(Object.values(friendsCache.friendsCache));
  UpdatePendingCounter();
  const cachedFriend = friendsCache.getFriend(message.friendId);
  if (cachedFriend) {
    appendToProfileContextList(cachedFriend, message.friendId);
  }
  reCalculateFriTitle();
}
export function removeDm(friendId: string) {
  apiClient.send(EventType.REMOVE_DM, { friendId });
}
export function addDm(friendId: string) {
  apiClient.send(EventType.ADD_DM, { friendId });
}

let currentFriendInstances: FriendData[];

export function UpdatePendingCounter() {
  setTimeout(() => {
    let pendingCounter = 0;
    if (currentFriendInstances) {
      pendingCounter = currentFriendInstances.reduce((count, friend) => {
        return (
          count + (friend.isPending && friend.isFriendsRequestToUser ? 1 : 0)
        );
      }, 0);
    }

    const pendingAlerts = [
      pendingAlertLeft,
      pendingAlertRight,
      getId("pendingAlertMain")
    ];
    const hasPending = pendingCounter > 0;

    pendingAlerts.forEach((alert) => {
      if (!alert) {
        return;
      }

      alert.textContent = String(pendingCounter);
      if (hasPending) {
        enableElement(alert);
      } else {
        disableElement(alert);
      }
    });

    setWindowName(pendingCounter);
  }, 0);
}

export function updateFriendsList(friends: FriendData[]): void {
  if (!friends || friends.length === 0) {
    console.warn("Empty friend list data.");
    return;
  }
  console.warn("Friends: ", friends);
  if (isAddFriendsOpen) {
    return;
  }

  currentFriendInstances = friends;

  populateFriendsContainer(
    currentFriendInstances,
    currentSelectedFriendMenu === "pending"
  );
}
export function addPendingButtons(friendButton: HTMLElement, friend: Friend) {
  if (friend.isFriendsRequestToUser) {
    const acceptButton = createButtonWithBubblesImg(
      friendButton,
      ButtonTypes.TickBtn,
      translations.getTranslation("accept")
    );
    acceptButton.addEventListener("click", (event) =>
      handleButtonClick(event, EventType.ACCEPT_FRIEND, friend.userId)
    );

    const denyButton = createButtonWithBubblesImg(
      friendButton,
      ButtonTypes.CloseBtn,
      translations.getTranslation("deny")
    );
    denyButton.addEventListener("click", (event) =>
      handleButtonClick(event, EventType.DENY_FRIEND, friend.userId)
    );
  } else {
    const closeButton = createButtonWithBubblesImg(
      friendButton,
      ButtonTypes.CloseBtn,
      translations.getTranslation("cancel")
    );
    closeButton.addEventListener("click", (event) =>
      handleButtonClick(event, EventType.REMOVE_FRIEND, friend.userId)
    );
  }
}

function handleButtonClick(event: Event, action: EventType, friendId: string) {
  event.stopPropagation();
  apiClient.send(action, { friendId });
}

export function addFriendId(userId: string) {
  apiClient.send(EventType.ADD_FRIEND_ID, { friendId: userId });
  createTooltipAtCursor(translations.getContextTranslation("ADDED_FRIEND"));
}
function addFriend(nickName: string, discriminator: string) {
  apiClient.send(EventType.ADD_FRIEND, {
    friendName: nickName,
    friendDiscriminator: discriminator
  });
  createTooltipAtCursor(translations.getContextTranslation("ADDED_FRIEND"));
}
export function removeFriend(friendId: string) {
  apiClient.send(EventType.REMOVE_FRIEND, { friendId });
}

export function submitAddFriend() {
  const addfriendinput = getId("addfriendinputfield") as HTMLInputElement;
  const currentValue = addfriendinput.value.trim();

  if (!currentValue) {
    return;
  }

  if (!isValidFriendName(currentValue)) {
    printFriendMessage(
      translations.getTranslation("addFriendDiscriminatorErrorText")
    );
    return;
  }

  if (currentValue === getSelfFullDisplay()) {
    printFriendMessage(
      translations.getTranslation("friendAddYourselfErrorText")
    );
    return;
  }

  const parsed = parseUsernameDiscriminator(currentValue);
  if (!parsed) {
    return;
  }

  const { nickName, discriminator } = parsed;

  addFriend(nickName, discriminator);
}

export function filterFriendsOnSearch(): void {
  const friendsSearchInput = getId("friendsSearchInput") as HTMLInputElement;
  if (!friendsSearchInput) {
    return;
  }

  const input = friendsSearchInput.value.toLowerCase();
  const friends = document.getElementsByClassName("friend-card");

  for (let i = 0; i < friends.length; i++) {
    const friend = friends[i] as HTMLElement;
    const dataName = friend.getAttribute("data-name");
    console.log(friends);

    if (dataName) {
      const friendName = dataName.toLowerCase();
      if (friendName.includes(input)) {
        friend.classList.add("visible");
      } else {
        friend.classList.remove("visible");
      }
    }
  }
}

function init() {
  window.addEventListener("resize", handleResize);

  const addFriButton = getId("open-friends-button");
  if (addFriButton) {
    addFriButton.addEventListener("click", openAddFriend);
  }
}

init();
