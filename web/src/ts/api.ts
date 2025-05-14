import { translations } from "./translations.ts";
import { printFriendMessage } from "./friendui.ts";
import { alertUser } from "./ui.ts";
import { isOnDm, router } from "./router.ts";
import { fetchMessages } from "./chat.ts";
import { friendsCache } from "./friends.ts";
import { currentGuildId } from "./guild.ts";
import { guildCache } from "./cache.ts";
import { revertToLastConfirmedImage } from "./avatar.ts";
import { initialState } from "./app.ts";

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
  EDIT_MESSAGE_GUILD: "EDIT_MESSAGE_GUILD",
  EDIT_MESSAGE_DM: "EDIT_MESSAGE_DM",
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
  GET_SCROLL_HISTORY_GUILD: "GET_SCROLL_HISTORY_GUILD",
  GET_SCROLL_HISTORY_DM: "GET_SCROLL_HISTORY_DM",
  GET_GUILDS: "GET_GUILDS",
  GET_INVITES: "GET_INVITES",
  GET_ATTACHMENTS_GUILD: "GET_ATTACHMENTS_GUILD",
  GET_ATTACHMENTS_DM: "GET_ATTACHMENTS_DM",
  START_TYPING: "START_TYPING",
  STOP_TYPING: "STOP_TYPING",
  ADD_FRIEND: "ADD_FRIEND",
  ACCEPT_FRIEND: "ACCEPT_FRIEND",
  REMOVE_FRIEND: "REMOVE_FRIEND",
  DENY_FRIEND: "DENY_FRIEND",
  ADD_FRIEND_ID: "ADD_FRIEND_ID",
  CHANGE_NICK: "CHANGE_NICK",
  CHANGE_EMOJI_NAME: "CHANGE_EMOJI_NAME",
  DELETE_EMOJI: "DELETE_EMOJI",
  UPLOAD_GUILD_IMAGE: "UPLOAD_GUILD_IMAGE",
  UPLOAD_PROFILE_IMAGE: "UPLOAD_PROFILE_IMAGE",
  UPLOAD_EMOJI_IMAGE: "UPLOAD_EMOJI_IMAGE",
  ADD_DM: "ADD_DM",
  REMOVE_DM: "REMOVE_DM",
  LEAVE_VOICE_CHANNEL: "LEAVE_VOICE_CHANNEL",
  JOIN_VOICE_CHANNEL: "JOIN_VOICE_CHANNEL",
  GET_BULK_REPLY: "GET_BULK_REPLY",
  UPDATE_CHANNEL_NAME: "UPDATE_CHANNEL_NAME",
  GET_MESSAGE_DATES: "GET_MESSAGE_DATES",
  READ_MESSAGE: "READ_MESSAGE"
} as const);

export type EventType = (typeof EventType)[keyof typeof EventType];

const friendEvents: EventType[] = Object.values(EventType).filter((event) =>
  event.toLowerCase().includes("friend".toLowerCase())
) as EventType[];

const HttpMethod = Object.freeze({
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
  EDIT_MESSAGE_GUILD: HttpMethod.PUT,
  EDIT_MESSAGE_DM: HttpMethod.PUT,
  GET_MEMBERS: HttpMethod.GET,
  GET_MESSAGE_DATE: HttpMethod.GET,
  GET_CHANNELS: HttpMethod.GET,
  GET_FRIENDS: HttpMethod.GET,
  GET_HISTORY_GUILD: HttpMethod.GET,
  GET_HISTORY_DM: HttpMethod.GET,
  GET_SCROLL_HISTORY_GUILD: HttpMethod.GET,
  GET_SCROLL_HISTORY_DM: HttpMethod.GET,
  GET_GUILDS: HttpMethod.GET,
  GET_INVITES: HttpMethod.GET,
  GET_ATTACHMENTS_GUILD: HttpMethod.GET,
  GET_ATTACHMENTS_DM: HttpMethod.GET,
  GET_MESSAGE_DATES: HttpMethod.GET,
  START_TYPING: HttpMethod.POST,
  STOP_TYPING: HttpMethod.POST,
  ADD_FRIEND: HttpMethod.POST,
  ADD_FRIEND_ID: HttpMethod.POST,
  REMOVE_FRIEND: HttpMethod.DELETE,
  DENY_FRIEND: HttpMethod.DELETE,
  ACCEPT_FRIEND: HttpMethod.PUT,
  CHANGE_NICK: HttpMethod.PUT,
  ADD_DM: HttpMethod.POST,
  REMOVE_DM: HttpMethod.DELETE,
  GET_BULK_REPLY: HttpMethod.GET,
  UPDATE_GUILD_NAME: HttpMethod.PUT,
  DELETE_CHANNEL: HttpMethod.DELETE,
  LEAVE_VOICE_CHANNEL: HttpMethod.PUT,
  JOIN_VOICE_CHANNEL: HttpMethod.POST,
  DELETE_MESSAGE_DM: HttpMethod.DELETE,
  DELETE_MESSAGE_GUILD: HttpMethod.DELETE,
  UPDATE_GUILD_IMAGE: HttpMethod.PUT,
  READ_MESSAGE: HttpMethod.POST,
  UPDATE_CHANNEL_NAME: HttpMethod.POST,
  CHANGE_EMOJI_NAME: HttpMethod.PUT,
  DELETE_EMOJI: HttpMethod.DELETE,
  UPLOAD_GUILD_IMAGE: HttpMethod.POST,
  UPLOAD_PROFILE_IMAGE: HttpMethod.POST,
  UPLOAD_EMOJI_IMAGE: HttpMethod.POST
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
  UPDATE_CHANNEL_NAME: "/guilds/{guildId}/channels/{channelId}",
  GET_MEMBERS: "/guilds/{guildId}/members",
  GET_INVITES: "/guilds/{guildId}/channels/{channelId}/invites",
  GET_ATTACHMENTS_GUILD:
    "/guilds/{guildId}/channels/{channelId}/messages/attachments?page={page}",
  GET_ATTACHMENTS_DM:
    "/dms/channels/{friendId}/messages/attachments?page={page}",
  GET_HISTORY_DM:
    "/dms/channels/{channelId}/messages?date={date}&messageId={messageId}",
  GET_HISTORY_GUILD:
    "/guilds/{guildId}/channels/{channelId}/messages?date={date}&messageId={messageId}",

  GET_SCROLL_HISTORY_GUILD: "/guilds/{guildId}/channels/{channelId}/messages",
  GET_SCROLL_HISTORY_DM: "/dms/channels/{friendId}/messages",

  GET_BULK_REPLY: "/guilds/{guildId}/channels/{channelId}/messages/reply",
  GET_MESSAGE_DATE: "/guilds/{guildId}/channels/{channelId}/messages/date",
  START_TYPING: "/guilds/{guildId}/channels/{channelId}/typing/start",
  STOP_TYPING: "/guilds/{guildId}/channels/{channelId}/typing/stop",
  UPDATE_GUILD_NAME: "/guilds/{guildId}",
  UPDATE_GUILD_IMAGE: "",

  JOIN_GUILD: "/guilds/{inviteId}/members",
  LEAVE_GUILD: "/guilds/{guildId}/members",

  GET_FRIENDS: "/friends",
  ADD_FRIEND: "/friends",
  ADD_FRIEND_ID: "/friends/id/{friendId}",
  REMOVE_FRIEND: "/friends/{friendId}",

  ADD_DM: "/dm/{friendId}",
  REMOVE_DM: "/dm/{friendId}",
  SEND_MESSAGE_GUILD: "/guilds/{guildId}/channels/{channelId}/messages",
  SEND_MESSAGE_DM: "/dms/channels/{friendId}/messages",
  EDIT_MESSAGE_GUILD:
    "/guilds/{guildId}/channels/{channelId}/messages/{messageId}",
  EDIT_MESSAGE_DM: "/dms/channels/{friendId}/messages/{messageId}",
  DELETE_MESSAGE_DM: "/dms/channels/{friendId}/messages/{messageId}",
  DELETE_MESSAGE_GUILD:
    "/guilds/{guildId}/channels/{channelId}/messages/{messageId}",

  CHANGE_NICK: "/nicks",
  LEAVE_VOICE_CHANNEL: "/guilds/{guildId}/channels/{channelId}/voice",
  JOIN_VOICE_CHANNEL: "/guilds/{guildId}/channels/{channelId}/voice",
  ACCEPT_FRIEND: "/friends/accept/{friendId}",
  DENY_FRIEND: "/friends/deny/{friendId}",
  GET_MESSAGE_DATES: "",
  READ_MESSAGE: "",
  CHANGE_EMOJI_NAME: "/guilds/{guildId}/emojis/{emojiId}",
  DELETE_EMOJI: "/guilds/{guildId}/emojis/{emojiId}",
  UPLOAD_EMOJI_IMAGE: "/guilds/emojis",
  UPLOAD_GUILD_IMAGE: "/images/guild",
  UPLOAD_PROFILE_IMAGE: "/images/profile"
};

type ListenerCallback = (data: any) => void;

class ApiClient {
  private authCookie = "";
  async getAuthCookie(): Promise<string> {
    if (this.authCookie) return encodeURIComponent(this.authCookie);
    const response = await apiClient.fetchRelative("/auth/ws-token");
    if (!response.ok) console.error("Failed to retrieve cookie for ws");
    const data = await response.json();
    this.authCookie = data.token;
    return encodeURIComponent(this.authCookie);
  }
  getAuthToken = (): string | null => {
    return localStorage.getItem("jwt_token");
  };
  setAuthToken = (token: string): void => {
    localStorage.setItem("jwt_token", token);
  };
  clearToken = (): void => {
    localStorage.removeItem("jwt_token");
  };

  fetchRelative(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const token = this.getAuthToken();
    const initToUse: RequestInit = { ...(init ?? {}), credentials: "include" };

    initToUse.headers = {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`
    };

    return window
      .fetch(import.meta.env.VITE_BACKEND_URL + input, initToUse)
      .then((response) => {
        if (response.status === 401) {
          router.openLogin();
          this.clearToken();
        }
        return response;
      });
  }

  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const token = this.getAuthToken();
    const initToUse: RequestInit = { ...(init ?? {}), credentials: "include" };

    initToUse.headers = {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`
    };

    return window.fetch(input, initToUse).then((response) => {
      if (response.status === 401) {
        router.openLogin();
        this.clearToken();
      }
      return response;
    });
  }

  private listeners: Record<string, ListenerCallback[]>;
  private nonResponseEvents: EventType[];

  constructor() {
    this.listeners = {};
    this.nonResponseEvents = [];

    if (import.meta.env.DEV) {
      this.validateEventMaps();
      this.checkFullCrud();
    }
    if (!this.getBackendUrl()) {
      setTimeout(() => {
        alertUser(
          "Backend url is not set in vite config!",
          "Set up .env file at vite src directory."
        );
      }, 1000);
    }
  }
  public getEmojis() {
    return this.fetchRelative(`/api/guilds/${currentGuildId}/emojis`);
  }
  public onWebsocketReconnect() {
    console.log("Websocket reconnected!");
    this.send(EventType.GET_INIT_DATA);
    this.send(EventType.GET_FRIENDS);
    fetchMessages(
      isOnDm ? friendsCache.currentDmId : guildCache.currentChannelId,
      isOnDm
    );
    this.send(EventType.GET_MEMBERS, { guildId: currentGuildId });
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
  getBackendHostname(): string | null {
    const url = this.getBackendUrl();
    if (!url) return "";
    const urlObj = new URL(url);
    return urlObj.hostname;
  }
  getBackendUrl(): string | null {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    return backendUrl;
  }

  getProxyHostname(): string | null {
    if (initialState.mediaProxyApiUrl) {
      return new URL(initialState.mediaProxyApiUrl).hostname;
    }
    return null;
  }

  getProxyUrl(url: string): string {
    return (
      initialState.mediaProxyApiUrl +
      `/api/proxy/media?url=${encodeURIComponent(url)}`
    );
  }

  getUrlForEvent(
    event: EventType,
    data: Record<string, any> = {},
    queryParams: Record<string, any> = {}
  ): { method: HttpMethod; url: string } | null {
    const url = this.getBackendUrl();
    if (!url) return null;
    const basePath = url + "/api";

    const urlTemplate = EventUrlMap[event];
    if (!urlTemplate) {
      throw new Error(`Unknown event: ${event}`);
    }

    let [urlPath, queryStringTemplate] = urlTemplate.split("?");
    queryStringTemplate = queryStringTemplate;
    const routeParams = (urlPath.match(/{(.*?)}/g) || []).map((match) =>
      match.slice(1, -1)
    );
    const queryKeys =
      (queryStringTemplate ? queryStringTemplate.match(/{(.*?)}/g) : [])?.map(
        (match) => match.slice(1, -1)
      ) || [];

    routeParams.forEach((param) => {
      if (data.hasOwnProperty(param)) {
        urlPath = urlPath.replace(
          `{${param}}`,
          encodeURIComponent(data[param])
        );
      } else {
        throw new Error(`Missing required route parameter: ${param}`);
      }
    });

    urlPath = urlPath.replace(/\/+/g, "/").replace(/\/$/, "");

    const queryParts: string[] = [];
    queryKeys.forEach((key) => {
      if (
        queryParams.hasOwnProperty(key) &&
        queryParams[key] !== undefined &&
        queryParams[key] !== null &&
        queryParams[key] !== ""
      ) {
        queryParts.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`
        );
      }
    });

    const queryString = queryParts.length ? `?${queryParts.join("&")}` : "";
    const fullUrl = `${basePath}${urlPath}${queryString}`;

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
  // Run listener callback when request success
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
      const response: Response = await this.fetch(url, {
        method,
        headers,
        body,
        credentials: "include"
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
      if (event === EventType.GET_INIT_DATA) {
        if (window.location.hostname === "127.0.0.1") {
          alertUser(
            "CORS ISSUE",
            "You are trying to access webapp from 127.0.0.1 . If you have set up 'localhost' for frontend url in backend, make sure they are exactly same."
          );
        } else if (window.location.hostname === "localhost") {
          alertUser(
            "CORS ISSUE",
            "You are trying to access webapp from localhost . If you have set up '127.0.0.1' for frontend url in backend, make sure they are exactly same."
          );
        } else {
          alertUser("Cant establish connection to server");
        }
        return;
      }
      throw error;
    }
  }

  async sendForm(
    event: EventType,
    formData: FormData,
    additionalData: Record<string, any> = {}
  ) {
    if (!event) {
      console.error("Event is required");
      return;
    }

    try {
      const result = this.getUrlForEvent(event, additionalData);
      if (!result) {
        console.error("URL and method could not be retrieved");
        return;
      }

      const { url, method } = result;

      const response = await this.fetch(url, {
        method,
        body: formData,
        credentials: "include"
      });

      if (!response.ok) {
        await this.handleError(response, event);
        return null;
      }

      const responseBody = await response.text();
      const parsedResponse = responseBody ? JSON.parse(responseBody) : null;

      if (parsedResponse) {
        this.handleMessage(event, parsedResponse);
      }

      return parsedResponse;
    } catch (error) {
      console.error(`Failed to send form request for event "${event}":`, error);
      throw error;
    }
  }

  async send(
    event: EventType,
    data: any = {},
    queryParams: Record<string, any> = {}
  ) {
    console.log(data);

    if (!event) {
      console.error("Event is required");
      return;
    }

    const expectsResponse = !this.nonResponseEvents.includes(event);

    try {
      const result = this.getUrlForEvent(event, data, queryParams);
      if (!result) {
        console.error(`Failed to get URL and method for event: ${event}`);
        return;
      }

      const { url, method } = result;

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
      alertUser(
        `Error during request for event "${event}"`,
        `${error} ${event} ${JSON.stringify(data)}`
      );
    }
  }
  async handleError(response: Response, event: EventType) {
    if (response.ok) return;
    if (friendEvents.includes(event)) {
      const predefinedMessage =
        translations.getFriendErrorMessage(String(response.status)) ||
        translations.getFriendErrorMessage("default");

      printFriendMessage(predefinedMessage);
      console.error(
        `Error [${response.status}] for event "${event}": ${predefinedMessage}`
      );
    }
    switch (event) {
      case EventType.UPLOAD_GUILD_IMAGE:
        revertToLastConfirmedImage(true);
        break;
      case EventType.UPLOAD_PROFILE_IMAGE:
        revertToLastConfirmedImage(false);
        break;
      default:
        break;
    }
  }
}

export const apiClient = new ApiClient();
