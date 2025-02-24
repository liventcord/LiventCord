import { translations } from "./translations.ts";
import { printFriendMessage } from "./friendui.ts";
import { alertUser } from "./ui.ts";

export const EventType = Object.freeze({
  GET_INIT_DATA: "GET_INIT_DATA",
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
  GET_SCROLL_HISTORY: "GET_SCROLL_HISTORY",
  GET_GUILDS: "GET_GUILDS",
  GET_INVITES: "GET_INVITES",
  START_TYPING: "START_TYPING",
  STOP_TYPING: "STOP_TYPING",
  ADD_FRIEND: "ADD_FRIEND",
  ACCEPT_FRIEND: "ACCEPT_FRIEND",
  REMOVE_FRIEND: "REMOVE_FRIEND",
  DENY_FRIEND: "DENY_FRIEND",
  ADD_FRIEND_ID: "ADD_FRIEND_ID",
  CHANGE_NICK: "CHANGE_NICK",
  ADD_DM: "ADD_DM",
  LEAVE_VOICE_CHANNEL: "LEAVE_VOICE_CHANNEL",
  JOIN_VOICE_CHANNEL: "JOIN_VOICE_CHANNEL",
  GET_BULK_REPLY: "GET_BULK_REPLY",
  CHANGE_GUILD_NAME: "CHANGE_GUILD_NAME",
  GET_MESSAGE_DATES: "GET_MESSAGE_DATES",
  READ_MESSAGE: "READ_MESSAGE"
} as const);

export type EventType = (typeof EventType)[keyof typeof EventType];

const friendEvents: EventType[] = Object.values(EventType).filter((event) =>
  event.includes("friend")
) as EventType[];

export const HttpMethod = Object.freeze({
  POST: "POST",
  GET: "GET",
  PUT: "PUT",
  DELETE: "DELETE"
} as const);

type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

const EventHttpMethodMap: Record<EventType, HttpMethod> = {
  GET_INIT_DATA: HttpMethod.GET,
  CREATE_CHANNEL: HttpMethod.POST,
  JOIN_GUILD: HttpMethod.POST,
  LEAVE_GUILD: HttpMethod.DELETE,
  CREATE_GUILD: HttpMethod.POST,
  DELETE_GUILD: HttpMethod.DELETE,
  DELETE_GUILD_IMAGE: HttpMethod.DELETE,
  SEND_MESSAGE_GUILD: HttpMethod.POST,
  SEND_MESSAGE_DM: HttpMethod.POST,
  GET_MEMBERS: HttpMethod.GET,
  GET_MESSAGE_DATE: HttpMethod.GET,
  GET_CHANNELS: HttpMethod.GET,
  GET_FRIENDS: HttpMethod.GET,
  GET_HISTORY_GUILD: HttpMethod.GET,
  GET_HISTORY_DM: HttpMethod.GET,
  GET_SCROLL_HISTORY: HttpMethod.GET,
  GET_GUILDS: HttpMethod.GET,
  GET_INVITES: HttpMethod.GET,
  GET_MESSAGE_DATES: HttpMethod.GET,
  START_TYPING: HttpMethod.POST,
  STOP_TYPING: HttpMethod.POST,
  ADD_FRIEND: HttpMethod.POST,
  ADD_FRIEND_ID: HttpMethod.POST,
  REMOVE_FRIEND: HttpMethod.DELETE,
  DENY_FRIEND: HttpMethod.POST,
  ACCEPT_FRIEND: HttpMethod.POST,
  CHANGE_NICK: HttpMethod.PUT,
  ADD_DM: HttpMethod.POST,
  GET_BULK_REPLY: HttpMethod.GET,
  CHANGE_GUILD_NAME: HttpMethod.PUT,
  DELETE_CHANNEL: HttpMethod.DELETE,
  LEAVE_VOICE_CHANNEL: HttpMethod.PUT,
  JOIN_VOICE_CHANNEL: HttpMethod.POST,
  DELETE_MESSAGE_DM: HttpMethod.DELETE,
  DELETE_MESSAGE_GUILD: HttpMethod.DELETE,
  UPDATE_GUILD_NAME: HttpMethod.PUT,
  UPDATE_GUILD_IMAGE: HttpMethod.PUT,
  READ_MESSAGE: HttpMethod.POST
};

const EventUrlMap: Record<EventType, string> = {
  GET_INIT_DATA: "/init",
  CREATE_GUILD: "/guilds",
  CREATE_CHANNEL: "/guilds/{guildId}/channels",
  DELETE_GUILD: "/guilds/{guildId}",
  DELETE_GUILD_IMAGE: "/guilds/{guildId}/image",
  GET_GUILDS: "/guilds",
  GET_CHANNELS: "/guilds/{guildId}/channels/",
  DELETE_CHANNEL: "/guilds/{guildId}/channels/{channelId}",
  GET_MEMBERS: "/guilds/{guildId}/members",
  GET_INVITES: "/guilds/{guildId}/channels/{channelId}/invites",

  GET_HISTORY_DM: "/dms/channels/{channelId}/messages",
  GET_HISTORY_GUILD: "/guilds/{guildId}/channels/{channelId}/messages",

  GET_SCROLL_HISTORY: "/guilds/{guildId}/channels/{channelId}/messages",
  GET_BULK_REPLY: "/guilds/{guildId}/channels/{channelId}/messages/reply",
  GET_MESSAGE_DATE: "/guilds/{guildId}/channels/{channelId}/messages/date",
  START_TYPING: "/guilds/{guildId}/channels/{channelId}/typing/start",
  STOP_TYPING: "/guilds/{guildId}/channels/{channelId}/typing/stop",
  CHANGE_GUILD_NAME: "/guilds/{guildId}",

  JOIN_GUILD: "/guilds/{inviteId}/members",
  LEAVE_GUILD: "/guilds/{guildId}/members",

  GET_FRIENDS: "/friends",
  ADD_FRIEND: "/friends",
  ADD_FRIEND_ID: "/friends",
  REMOVE_FRIEND: "/friends/{friendId}",

  ADD_DM: "/dm/{friendId}",

  SEND_MESSAGE_GUILD: "/guilds/{guildId}/channels/{channelId}/messages",
  SEND_MESSAGE_DM: "/dms/{Id}/channels/{channelId}/messages",
  DELETE_MESSAGE_DM:
    "/guilds/{guildId}/channels/{channelId}/messages/{messageId}",
  DELETE_MESSAGE_GUILD:
    "/guilds/{guildId}/channels/{channelId}/messages/{messageId}",

  CHANGE_NICK: "/nicks",
  LEAVE_VOICE_CHANNEL: "/guilds/{guildId}/channels/{channelId}/voice",
  JOIN_VOICE_CHANNEL: "/guilds/{guildId}/channels/{channelId}/voice",
  UPDATE_GUILD_NAME: "",
  UPDATE_GUILD_IMAGE: "",
  ACCEPT_FRIEND: "",
  DENY_FRIEND: "",
  GET_MESSAGE_DATES: "",
  READ_MESSAGE: ""
};

type ListenerCallback = (data: any) => void;

class ApiClient {
  private listeners: Record<string, ListenerCallback[]>;
  private nonResponseEvents: EventType[];

  constructor() {
    this.listeners = {};
    this.nonResponseEvents = [];

    if (import.meta.env.DEV) {
      this.validateEventMaps();
      this.checkFullCrud();
    }
  }

  private validateEventMaps() {
    const eventTypes = Object.values(EventType) as EventType[];
    eventTypes.forEach((eventType) => {
      if (!EventHttpMethodMap.hasOwnProperty(eventType)) {
        console.warn(
          `Missing HTTP method mapping for event type: ${eventType}`
        );
      }
      if (!EventUrlMap.hasOwnProperty(eventType)) {
        console.warn(`Missing URL mapping for event type: ${eventType}`);
      }
    });
  }

  private checkFullCrud() {
    const missingCrud: Record<
      string,
      { create: boolean; read: boolean; update: boolean; delete: boolean }
    > = {};

    Object.keys(EventUrlMap).forEach((eventType) => {
      const url = EventUrlMap[eventType as EventType];
      const method = EventHttpMethodMap[eventType as EventType];

      const resource = url.split("/")[1];
      if (!missingCrud[resource]) {
        missingCrud[resource] = {
          create: false,
          read: false,
          update: false,
          delete: false
        };
      }

      if (method === HttpMethod.POST) missingCrud[resource].create = true;
      if (method === HttpMethod.GET) missingCrud[resource].read = true;
      if (method === HttpMethod.PUT) missingCrud[resource].update = true;
      if (method === HttpMethod.DELETE) missingCrud[resource].delete = true;
    });

    Object.entries(missingCrud).forEach(([resource, ops]) => {
      const missingOps = Object.entries(ops).filter(([_, present]) => !present);
      if (missingOps.length > 0) {
        console.warn(`${resource} is missing the following CRUD operations:`);
        missingOps.forEach(([op]) => console.warn(`  - ${op}`));
      } else {
        console.log(`${resource} has full CRUD`);
      }
    });
  }

  getHttpMethod(event: EventType): HttpMethod {
    const method = EventHttpMethodMap[event];
    if (!method) {
      throw new Error(`HTTP method not defined for event: ${event}`);
    }
    return method;
  }

  getUrlForEvent(
    event: EventType,
    data: Record<string, any> = {}
  ): { method: HttpMethod; url: string } {
    const basePath = "/api";
    const urlTemplate = EventUrlMap[event];

    if (!urlTemplate) {
      throw new Error(`Unknown event: ${event}`);
    }

    let url = urlTemplate;
    const missingKeys: string[] = [];
    const allPlaceholders = (urlTemplate.match(/{(.*?)}/g) || []).map((match) =>
      match.replace(/[{}]/g, "")
    );

    allPlaceholders.forEach((placeholder) => {
      if (!data.hasOwnProperty(placeholder)) {
        missingKeys.push(placeholder);
      } else {
        url = url.replace(`{${placeholder}}`, data[placeholder]);
      }
    });

    if (missingKeys.length > 0) {
      alertUser(
        `Missing data for URL placeholders: ${missingKeys.join(", ")}.`
      );
    }
    const fullUrl = `${basePath}${url}`;

    return { method: this.getHttpMethod(event), url: fullUrl };
  }

  handleMessage(event: EventType, data: any): void {
    if (this.nonResponseEvents.includes(event)) {
      return;
    }
    console.log(
      "Handling event: ",
      event,
      " with data: ",
      data,
      " listeners: ",
      this.listeners[event]
    );
    if (this.listeners[event] && data !== null) {
      this.listeners[event].forEach((callback) => callback(data));
    }
  }

  on(event: EventType, callback: ListenerCallback) {
    if (!Object.values(EventType).includes(event)) {
      console.error("Event type doesn't include: ", event);
      alertUser("Event type doesn't include: " + event);
      return;
    }
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
  async sendRequest(
    data: Record<string, any>,
    url: string,
    method: HttpMethod,
    event: EventType,
    expectsResponse: boolean = true
  ): Promise<any | null> {
    const body: string | undefined =
      method !== HttpMethod.GET && data ? JSON.stringify(data) : undefined;

    const headers: HeadersInit | undefined =
      method === HttpMethod.GET
        ? undefined
        : { "Content-Type": "application/json" };

    try {
      const response: Response = await fetch(url, {
        method,
        headers,
        body,
        credentials: "same-origin"
      });

      if (!response.ok) {
        await this.handleError(response, event);
        return null;
      }

      if (!expectsResponse) {
        return null;
      }

      const responseBody: string = await response.text();
      return responseBody ? JSON.parse(responseBody) : null;
    } catch (error) {
      console.error(`Failed to send request for event "${event}":`, error);
      throw error;
    }
  }

  async sendForm(
    event: EventType,
    formData: FormData,
    additionalData: Record<string, any>
  ) {
    if (!event) {
      console.error("Event is required");
      return;
    }

    try {
      const { url, method } = this.getUrlForEvent(event, additionalData);

      const response = await fetch(url, {
        method,
        body: formData,
        credentials: "same-origin"
      });

      if (!response.ok) {
        await this.handleError(response, event);
        return null;
      }

      const responseBody = await response.text();
      return responseBody ? JSON.parse(responseBody) : null;
    } catch (error) {
      console.error(`Failed to send form request for event "${event}":`, error);
      throw error;
    }
  }

  async send(event: EventType, data: any = {}) {
    console.log(data);
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
        expectsResponse
      );

      if (response) {
        this.handleMessage(event, response);
      }
    } catch (error: any) {
      console.error(error);

      if (
        error.message.includes("NetworkError") ||
        error.message.includes("Failed to fetch")
      ) {
        console.error(`Network error when trying to request event: ${event}`);
      } else {
        console.error(`Error during request for event "${event}"`);
      }

      alertUser(
        `Error during request for event "${event}"`,
        `${error} ${event} ${JSON.stringify(data)}`
      );
    }
  }

  async handleError(response: Response, event: EventType) {
    if (friendEvents.includes(event)) {
      const predefinedMessage =
        translations.getFriendErrorMessage(String(response.status)) ||
        translations.getFriendErrorMessage("default");

      printFriendMessage(predefinedMessage);
      console.error(
        `Error [${response.status}] for event "${event}": ${predefinedMessage}`
      );
    }
  }
}

export const apiClient = new ApiClient();
