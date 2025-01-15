let isAddFriendsOpen = false;

let currentSelectedStatus = null;
let friendsContainer = null;
let friends_cache = {};
let fetchUsersTimeout = null;

let isPopulating = false;

const offline = "offline";
const online = "online";
const all = "all";
const pending = "pending";
const blocked = "blocked";






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
  ERR_SUCCESS: "ERR_SUCCESS",
};



class Friend {
  constructor(friend) {
    this.userId = friend.userId;
    this.name = friend.nickName;
    this.discriminator = friend.discriminator;
    this.status = friend.status;
    this.isOnline = friend.isOnline;
    this.description = friend.description;
    this.createdAt = friend.createdAt;
    this.lastLogin = friend.lastLogin;
    this.socialMediaLinks = friend.socialMediaLinks;
    this.isFriendRequestToUser = friend.isFriendRequestToUser;
  }

  isPending() {
    return this.isFriendRequestToUser;
  }
}

class FriendsCache {
  constructor() {
    this.friendsCache = {};
    this.dmFriends = {};
  }
  setupDmFriends(friends) {
    this.dmFriends = friends;
  }
  initialiseFriends(initData) {
    this.friendsCache = initData;
    populateFriendsContainer(this.friendsCache);
  }

  addFriend(friend) {
    this.friendsCache[friend.id] = friend;
  }

  isFriend(userId) {
    if (userId === currentUserId) {
      return false;
    }
    if (!this.friendsCache) {
      return false;
    }
    return userId in this.friendsCache;
  }
  userExistsDm(userId) {
    return userId in this.dmFriends;
  }

  isOnline(userId) {
    if (!this.friendsCache || !this.friendsCache[userId]) {
      return false;
    }
    return this.friendsCache[userId].isOnline;
  }
}



function getFriendMessage(userNick, isSuccess, errorType) {
  if (isSuccess) {
    return translations.replacePlaceholder(errorType, { userNick });
  } else {
    return translations.getErrorMessage(errorType);
  }
}


function displayFriendActionMessage(userNick, isSuccess, errorType) {
  const text = isSuccess
    ? getFriendMessage(userNick, isSuccess, errorType) 
    : getFriendMessage(userNick, false, errorType); 
  
  displayFriendsMessage(text);
}

function handleAddFriendResponse(message) {
  const { userId, userNick, user_data, isSuccess } = message;
  displayFriendActionMessage(userNick, isSuccess, FriendErrorType.FRIEND_REQUEST_EXISTS);
}

function handleAcceptFriendRequestResponse(message) {
  const { userId, userNick, user_data, isSuccess } = message;
  displayFriendActionMessage(userNick, isSuccess, FriendErrorType.REQUEST_ALREADY_ACCEPTED);

  if (isSuccess) {
    friends_cache[userId] = user_data;
    disableElement("pendingAlertRight");
    disableElement("pendingAlertLeft");
    document.title = "LiventCord";
  }
}

function handleRemoveFriendResponse(message) {
  const { userId, userNick, isSuccess } = message;
  displayFriendActionMessage(userNick, isSuccess, FriendErrorType.NOT_FRIENDS);

  if (isSuccess) {
    const friCard = friendsContainer.querySelector(`#${CSS.escape(userId)}`);
    if (friCard) {
      friCard.remove();
    }
    reCalculateFriTitle();
  }
}

function handleDenyFriendRequestResponse(message) {
  const { userId, userNick, isSuccess } = message;
  displayFriendActionMessage(userNick, isSuccess, FriendErrorType.REQUEST_NOT_SENT);
}



function handleFriendEventResponse(message) {
  const { type } = message;

  switch (type) {
    case FriendRequestType.add_friend_request:
    case FriendRequestType.add_friend_request_id:
      handleAddFriendResponse(message);
      break;
    case FriendRequestType.accept_friend_request:
      handleAcceptFriendRequestResponse(message);
      break;
    case FriendRequestType.remove_friend_request:
      handleRemoveFriendResponse(message);
      break;
    case FriendRequestType.remove_friend:
      handleRemoveFriendResponse(message);
      break;
    case FriendRequestType.deny_friend_request:
      handleDenyFriendRequestResponse(message);
      break;
    default:
      displayFriendsMessage(errorMessages[FriendErrorType.INVALID_EVENT]);
  }
}

function updateFriendsList(friends, isPending) {
  if (!data) {
    console.warn("Empty friend list data.");
    return;
  }

  if (isAddFriendsOpen) return;

  const friendInstances = friends.map((friend) => new Friend(friend));

  if (isPending) {
    let pendingCounter = 0;
    friendInstances.forEach((friend) => {
      if (friend.isPending()) {
        pendingCounter += 1;
      }
    });

    if (pendingCounter > 0) {
      getId("pendingAlertLeft").textContent = pendingCounter;
      enableElement("pendingAlertLeft");
      getId("pendingAlertRight").textContent = pendingCounter;
      enableElement("pendingAlertRight");
      setWindowName(pendingCounter);
    }

    return;
  }

  populateFriendsContainer(friendInstances, isPending);
}

function addPendingButtons(friendButton, friend) {
  //TODO: fix isFriendsRequestsToUser
  let isFriendsRequestsToUser = false;
  if(isFriendsRequestsToUser) {
    const acceptButton = createButtonWithBubblesImg(
      friendButton,
      ButtonTypes.TickBtn,
      translations.getTranslation("accept")
  
    );
    acceptButton.addEventListener("click", (event) =>
      handleButtonClick(event, EventType.ADD_FRIEND, friend),
    );

  } else {
    const closeButton = createButtonWithBubblesImg(
      friendButton,
      ButtonTypes.CloseBtn,
      translations.getTranslation("cancel")
    );
    closeButton.addEventListener("click", (event) =>
      handleButtonClick(
        event,
        isFriendsRequestsToUser
          ? EventType.ADD_FRIEND
          : EventType.ADD_FRIEND_ID,
        friend,
      ),
    );

  }

}

function handleButtonClick(event, action, friend) {
  event.stopPropagation();
  apiClient.send(action, { friendId: friend.userId });
}

function addFriend(userId) {
  apiClient.send(EventType.ADD_FRIEND_ID, { friendId: userId });
}

function submitAddFriend() {
  const addfriendinput = getId("addfriendinputfield");
  const currentValue = addfriendinput.value.trim();

  if (currentValue && currentValue.length > 0) {
    if (!isValidFriendName(currentValue)) {
      displayFriendsMessage(translations.getTranslation("addFriendDiscriminatorErrorText"));
      return;
    }

    const { nickName: nickName, discriminator } =
      parseUsernameDiscriminator(currentValue);
    if (!nickName || !discriminator) {
      return;
    }

    apiClient.send(EventType.ADD_FRIEND, {
      friendName: nickName,
      friendDiscriminator: discriminator,
    });
  }
}



function filterFriends() {
  const input = getId("friendsSearchInput").value.toLowerCase();
  const friends = document.getElementsByClassName("friend-card");

  for (let i = 0; i < friends.length; i++) {
    const friendName = friends[i].getAttribute("data-name").toLowerCase();
    if (friendName.includes(input)) {
      friends[i].classList.add("visible");
    } else {
      friends[i].classList.remove("visible");
    }
  }
}

function toggleButtonState(booleanstate) {
  if (booleanstate) {
    addButton.classList.add("active");
    addButton.classList.remove("inactive");
  } else {
    addButton.classList.add("inactive");
    addButton.classList.remove("active");
  }
}

const friendCache = new FriendsCache();
let buttonElements = {};
let ButtonsList = {};
document.addEventListener("DOMContentLoaded", function () {

  window.addEventListener("resize", handleResize);
  friendsContainer = getId("friends-container");

  buttonElements = {
    online: getId("online-button"),
    all: getId("all-button"),
    pending: getId("pending-button"),
    blocked: getId("blocked-button"),
  };
  ButtonsList = Object.values(buttonElements);
  initializeButtonsList(ButtonsList);

});
