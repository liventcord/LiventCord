import { translations } from "./translations";
import { printFriendMessage } from "./friendui";
import { alertUser } from "./ui";

export const EventType = Object.freeze({
  CREATE_CHANNEL: "CREATE_CHANNEL",
  JOIN_GUILD: "JOIN_GUILD",
  LEAVE_GUILD: "LEAVE_GUILD",
  CREATE_GUILD: "CREATE_GUILD",
  DELETE_GUILD: "DELETE_GUILD",
  DELETE_GUILD_IMAGE: "DELETE_GUILD_IMAGE",
  SEND_MESSAGE_GUILD: "SEND_MESSAGE_GUILD",
  SEND_MESSAGE_DM: "SEND_MESSAGE_DM",
  DELETE_MESSAGE_DM: "DELETE_MESSAGE_DM",
  DELETE_MESSAGE_GUILD: "DELETE_MESSAGE_GUILD",
  GET_MEMBERS: "GET_MEMBERS",
  UPDATE_GUILD_NAME: "UPDATE_GUILD_NAME",
  UPDATE_GUILD_IMAGE: "UPDATE_GUILD_IMAGE",
  GET_MESSAGE_DATE: "GET_MESSAGE_DATE",
  GET_CHANNELS: "GET_CHANNELS",
  DELETE_CHANNEL: "DELETE_CHANNEL",
  GET_FRIENDS: "GET_FRIENDS",
  GET_HISTORY_GUILD: "GET_HISTORY_GUILD",
  GET_HISTORY_DM: "GET_HISTORY_DM",
  GET_SCROLL_HISTORY: "GET_OLD_HISTORY",
  GET_GUILDS: "GET_GUILDS",
  GET_INVITES: "GET_INVITES",
  START_TYPING: "START_TYPING",
  STOP_TYPING: "STOP_TYPING",
  ADD_FRIEND: "ADD_FRIEND",
  ACCEPT_FRIEND: "ACCEPT_FRIEND",
  REMOVE_FRIEND: "REMOVE_FRIEND",
  DENY_FRIEND: "REMOVE_FRIEND",
  ADD_FRIEND_ID: "ADD_FRIEND_ID",
  CHANGE_NICK: "CHANGE_NICK",
  ADD_DM: "ADD_DM",
  LEAVE_VOICE_CHANNEL: "LEAVE_VOICE_CHANNEL",
  JOIN_VOICE_CHANNEL: "JOIN_VOICE_CHANNEL",
  GET_BULK_REPLY: "GET_BULK_REPLY",
  CHANGE_GUILD_NAME: "CHANGE_GUILD_NAME",
  GET_MESSAGE_DATES: "GET_MESSAGE_DATES",
});

const HttpMethod = Object.freeze({
  POST: "POST",
  GET: "GET",
  PUT: "PUT",
  DELETE: "DELETE",
});

const EventHttpMethodMap = {
  [EventType.CREATE_CHANNEL]: HttpMethod.POST,
  [EventType.JOIN_GUILD]: HttpMethod.POST,
  [EventType.LEAVE_GUILD]: HttpMethod.POST,
  [EventType.CREATE_GUILD]: HttpMethod.POST,
  [EventType.DELETE_GUILD]: HttpMethod.DELETE,
  [EventType.DELETE_GUILD_IMAGE]: HttpMethod.DELETE,
  [EventType.SEND_MESSAGE_GUILD]: HttpMethod.POST,
  [EventType.SEND_MESSAGE_DM]: HttpMethod.POST,
  [EventType.GET_MEMBERS]: HttpMethod.GET,
  [EventType.GET_MESSAGE_DATE]: HttpMethod.GET,
  [EventType.GET_CHANNELS]: HttpMethod.GET,
  [EventType.GET_FRIENDS]: HttpMethod.GET,
  [EventType.GET_HISTORY_GUILD]: HttpMethod.GET,
  [EventType.GET_HISTORY_DM]: HttpMethod.GET,
  [EventType.GET_SCROLL_HISTORY]: HttpMethod.GET,
  [EventType.GET_GUILDS]: HttpMethod.GET,
  [EventType.GET_INVITES]: HttpMethod.GET,
  [EventType.GET_MESSAGE_DATES]: HttpMethod.GET,
  [EventType.START_TYPING]: HttpMethod.POST,
  [EventType.STOP_TYPING]: HttpMethod.POST,
  [EventType.ADD_FRIEND]: HttpMethod.POST,
  [EventType.ADD_FRIEND_ID]: HttpMethod.POST,
  [EventType.REMOVE_FRIEND]: HttpMethod.DELETE,
  [EventType.DENY_FRIEND]: HttpMethod.POST,
  [EventType.ACCEPT_FRIEND]: HttpMethod.POST,
  [EventType.CHANGE_NICK]: HttpMethod.PUT,
  [EventType.ADD_DM]: HttpMethod.POST,
  [EventType.GET_BULK_REPLY]: HttpMethod.GET,
  [EventType.CHANGE_GUILD_NAME]: HttpMethod.PUT,
  [EventType.DELETE_CHANNEL]: HttpMethod.DELETE,
  [EventType.LEAVE_VOICE_CHANNEL]: HttpMethod.PUT,
  [EventType.JOIN_VOICE_CHANNEL]: HttpMethod.POST,
  [EventType.DELETE_MESSAGE_DM]: HttpMethod.DELETE,
  [EventType.DELETE_MESSAGE_GUILD]: HttpMethod.DELETE,
  [EventType.UPDATE_GUILD_NAME]: HttpMethod.PUT,
  [EventType.UPDATE_GUILD_IMAGE]: HttpMethod.PUT,
};

const EventUrlMap = {
  [EventType.CREATE_GUILD]: "/guilds",
  [EventType.CREATE_CHANNEL]: "/guilds/{guildId}/channels",
  [EventType.DELETE_GUILD]: "/guilds/{guildId}",
  [EventType.DELETE_GUILD_IMAGE]: "/guilds/{guildId}/image",
  [EventType.GET_GUILDS]: "/guilds",
  [EventType.GET_CHANNELS]: "/guilds/{guildId}/channels/",
  [EventType.DELETE_CHANNEL]: "/guilds/{guildId}/channels/{channelId}",
  [EventType.GET_MEMBERS]: "/guilds/{guildId}/members",
  [EventType.GET_INVITES]: "/guilds/{guildId}/invites",

  [EventType.GET_HISTORY_DM]: "/guilds/{guildId}/channels/{channelId}/messages",
  [EventType.GET_HISTORY_GUILD]:
    "/guilds/{guildId}/channels/{channelId}/messages",

  [EventType.GET_SCROLL_HISTORY]:
    "/guilds/{guildId}/channels/{channelId}/messages",
  [EventType.GET_BULK_REPLY]:
    "/guilds/{guildId}/channels/{channelId}/messages/reply",
  [EventType.GET_MESSAGE_DATE]:
    "/guilds/{guildId}/channels/{channelId}/messages/date",
  [EventType.START_TYPING]:
    "/guilds/{guildId}/channels/{channelId}/typing/start",
  [EventType.STOP_TYPING]: "/guilds/{guildId}/channels/{channelId}/typing/stop",
  [EventType.CHANGE_GUILD_NAME]: "/guilds/{guildId}",

  [EventType.JOIN_GUILD]: "/guilds/{guildId}/members",
  [EventType.LEAVE_GUILD]: "/guilds/{guildId}/members",

  [EventType.GET_FRIENDS]: "/friends",
  [EventType.ADD_FRIEND]: "/friends",
  [EventType.ADD_FRIEND_ID]: "/friends",
  [EventType.REMOVE_FRIEND]: "/friends/{friendId}",

  [EventType.ADD_DM]: "/dm/{friendId}",

  [EventType.SEND_MESSAGE_GUILD]:
    "/guilds/{guildId}/channels/{channelId}/messages",
  [EventType.SEND_MESSAGE_DM]: "/dms/{Id}/channels/{channelId}/messages",
  [EventType.DELETE_MESSAGE_DM]:
    "/guilds/{guildId}/channels/{channelId}/messages/{messageId}",
  [EventType.DELETE_MESSAGE_GUILD]:
    "/guilds/{guildId}/channels/{channelId}/messages/{messageId}",

  [EventType.CHANGE_NICK]: "/nicks",
  [EventType.LEAVE_VOICE_CHANNEL]:
    "/guilds/{guildId}/channels/{channelId}/voice",
  [EventType.JOIN_VOICE_CHANNEL]:
    "/guilds/{guildId}/channels/{channelId}/voice",
};

class ApiClient {
  constructor() {
    this.listeners = {};
    this.nonResponseEvents = [
      EventType.START_TYPING,
      EventType.STOP_TYPING,
      EventType.CHANGE_NICK,
    ];
    this.validateEventMaps();
    this.checkFullCrud();
  }

  validateEventMaps() {
    const eventTypes = Object.values(EventType);
    eventTypes.forEach((eventType) => {
      if (!EventHttpMethodMap.hasOwnProperty(eventType)) {
        console.warn(
          `Missing HTTP method mapping for event type: ${eventType}`,
        );
      }
      if (!EventUrlMap.hasOwnProperty(eventType)) {
        console.warn(`Missing URL mapping for event type: ${eventType}`);
      }
    });
  }
  checkFullCrud() {
    const missingCrud = {};

    Object.keys(EventUrlMap).forEach((eventType) => {
      const url = EventUrlMap[eventType];
      const method = EventHttpMethodMap[eventType];

      const resource = url.split("/")[1];
      if (!missingCrud[resource]) {
        missingCrud[resource] = {
          create: false,
          read: false,
          update: false,
          delete: false,
        };
      }

      if (method === HttpMethod.POST) missingCrud[resource].create = true;
      if (method === HttpMethod.GET) missingCrud[resource].read = true;
      if (method === HttpMethod.PUT) missingCrud[resource].update = true;
      if (method === HttpMethod.DELETE) missingCrud[resource].delete = true;
    });

    Object.entries(missingCrud).forEach(([resource, ops]) => {
      const missingOps = Object.entries(ops).filter(
        ([op, present]) => !present,
      );
      if (missingOps.length > 0) {
        console.warn(`${resource} is missing the following CRUD operations:`);
        missingOps.forEach(([op]) => console.warn(`  - ${op}`));
      } else {
        console.log(`${resource} has full CRUD`);
      }
    });
  }

  getHttpMethod(event) {
    const method = EventHttpMethodMap[event];
    if (!method) {
      throw new Error(`HTTP method not defined for event: ${event}`);
    }
    return method;
  }
  getUrlForEvent(event, data = {}) {
    const basePath = "/api";
    const urlTemplate = EventUrlMap[event];

    if (!urlTemplate) {
      throw new Error(`Unknown event: ${event}`);
    }

    let url = urlTemplate;
    let missingKeys = [];
    let requiredKeys = [];

    // Extract the placeholders required by the URL template
    const allPlaceholders = (urlTemplate.match(/{(.*?)}/g) || []).map((match) =>
      match.replace(/[{}]/g, ""),
    );

    // Populate the requiredKeys list
    requiredKeys = allPlaceholders;

    // Replace placeholders with actual values from data
    Object.keys(data).forEach((key) => {
      url = url.replace(`{${key}}`, data[key]);
    });

    // Check for any remaining placeholders that weren't replaced
    allPlaceholders.forEach((placeholder) => {
      if (!data.hasOwnProperty(placeholder)) {
        missingKeys.push(placeholder); // Add missing keys to the list
      }
    });

    if (missingKeys.length > 0) {
      alertUser(
        `Missing data for URL placeholders: ${missingKeys.join(
          ", ",
        )}. Template ${event} requires: ${requiredKeys.join(", ")}.`,
      );
    }

    return { method: this.getHttpMethod(event), url: basePath + url };
  }

  async handleError(response, event) {
    let predefinedMessage =
      translations.getErrorMessage(response.status)?.[event] ||
      translations.getErrorMessage("default");
    printFriendMessage(predefinedMessage);
    console.error(
      `Error [${response.status}] for event "${event}": ${predefinedMessage}`,
    );
  }

  async sendRequest(data, url, method, event, expectsResponse = true) {
    const body = method === HttpMethod.POST ? JSON.stringify(data) : undefined;
    const headers =
      method === HttpMethod.GET
        ? undefined
        : { "Content-Type": "application/json" };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        credentials: "same-origin",
      });

      if (!response.ok) {
        await this.handleError(response, event);
        return null;
      }

      if (!expectsResponse) {
        return null;
      }

      const responseBody = await response.text();
      return responseBody ? JSON.parse(responseBody) : null;
    } catch (error) {
      console.error(`Failed to send request for event "${event}":`, error);
      throw error;
    }
  }

  async send(event, data = {}) {
    if (!event) {
      console.error("Event is required");
      return;
    }

    const expectsResponse = !this.nonResponseEvents.includes(event);

    try {
      const { url, method } = this.getUrlForEvent(event, data);
      const response = await this.sendRequest(
        data,
        url,
        method,
        event,
        expectsResponse,
      );

      if (response) {
        this.handleMessage(event, response);
      }
    } catch (error) {
      console.error(error);
      alertUser(
        `Error during request for event "${event}"`,
        `${error} ${event} ${JSON.stringify(data)}`,
      );
    }
  }

  handleMessage(event, data) {
    if (this.nonResponseEvents.includes(event)) {
      return;
    }
    console.log(
      "Handing event: ",
      event,
      " with data: ",
      data,
      " listeners: ",
      this.listeners[event],
      " all listeners: ",
      this.listeners,
    );
    if (this.listeners[event] && data !== null) {
      this.listeners[event].forEach((callback) => callback(data));
    }
  }

  on(event, callback) {
    if (Object.values(EventType).includes(event)) {
    } else {
      console.error("Event type doesnt includes: ", event);
      if (event) {
        alertUser("Event type doesnt includes: ", event);
      } else {
        console.error("Event type called null ");
      }
    }
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
}

export const apiClient = new ApiClient();
