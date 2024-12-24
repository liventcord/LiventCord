const EventType = Object.freeze({
    CREATE_CHANNEL: "create_channel",
    JOIN_GUILD: "join_guild",
    CREATE_GUILD: "create_guild",
    DELETE_GUILD: "delete_guild",
    DELETE_GUILD_IMAGE: "delete_guild_image",
    NEW_MESSAGE: "new_message",
    GET_MEMBERS: "get_members",
    GET_CHANNELS: "get_channels",
    GET_FRIENDS: "get_friends",
    GET_HISTORY: "get_history",
    GET_SCROLL_HISTORY: "get_old_history",
    GET_GUILDS: "get_guilds",
    GET_INVITES: "get_invites",
    START_TYPING: "start_typing",
    STOP_TYPING: "stop_typing",
    ADD_FRIEND: "add_friend",
    ADD_FRIEND_ID: "add_friend_id"
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
    [EventType.CREATE_GUILD]: HttpMethod.POST,
    [EventType.DELETE_GUILD]: HttpMethod.DELETE,
    [EventType.DELETE_GUILD_IMAGE]: HttpMethod.DELETE,
    [EventType.NEW_MESSAGE]: HttpMethod.POST,
    [EventType.GET_MEMBERS]: HttpMethod.GET,
    [EventType.GET_CHANNELS] : HttpMethod.GET,
    [EventType.GET_FRIENDS]: HttpMethod.GET,
    [EventType.GET_HISTORY]: HttpMethod.GET,
    [EventType.GET_SCROLL_HISTORY]: HttpMethod.GET,
    [EventType.GET_GUILDS]: HttpMethod.GET,
    [EventType.GET_INVITES]: HttpMethod.GET,
    [EventType.START_TYPING]: HttpMethod.POST,
    [EventType.STOP_TYPING]: HttpMethod.POST,
    [EventType.ADD_FRIEND]: HttpMethod.POST,
    [EventType.ADD_FRIEND_ID]: HttpMethod.POST,
};

class CustomHttpConnection {
    constructor() {
        this.listeners = {};
        this.nonResponseEvents = [EventType.START_TYPING, EventType.STOP_TYPING];
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
        let url;

        switch (event) {
            case EventType.CREATE_CHANNEL:
                url = `${basePath}/guilds/${data.guildId}/channels`;
                break;
            case EventType.JOIN_GUILD:
                url = `${basePath}/guilds/${data.guildId}/members`;
                break;
            case EventType.CREATE_GUILD:
                url = `${basePath}/guilds`;
                break;
            case EventType.DELETE_GUILD:
                url = `${basePath}/guilds/${data.guildId}`;
                break;
            case EventType.DELETE_GUILD_IMAGE:
                url = `${basePath}/guilds/${data.guildId}/image`;
                break;
            case EventType.NEW_MESSAGE:
                url = `${basePath}/guilds/${data.guildId}/channels/${data.channelId}/messages`;
                break;
            case EventType.GET_MEMBERS:
                url = `${basePath}/guilds/${data.guildId}/members`;
                break;
            case EventType.GET_CHANNELS:
                url = `${basePath}/guilds/${data.guildId}/channels/`;
                break;
            case EventType.GET_FRIENDS:
                url = `${basePath}/friends`;
                break;
            case EventType.GET_HISTORY:
                url = `${basePath}/guilds/${data.guildId}/channels/${data.channelId}/messages`;
                break;
            case EventType.GET_SCROLL_HISTORY:
                url = `${basePath}/guilds/${data.guildId}/channels/${data.channelId}/messages`;
                break;
            case EventType.GET_GUILDS:
                url = `${basePath}/guilds`;
                break;
            case EventType.GET_INVITES:
                url = `${basePath}/guilds/${data.guildId}/invites`;
                break;
            case EventType.START_TYPING:
                url = `${basePath}/guilds/${data.guildId}/channels/${data.channelId}/typing/start`;
                break;
            case EventType.STOP_TYPING:
                url = `${basePath}/guilds/${data.guildId}/channels/${data.channelId}/typing/stop`;
                break;
            case EventType.ADD_FRIEND:
                url = `${basePath}/friends?name=${data.friendName}&discriminator=${friendDiscriminator}`;
                break;
            case EventType.ADD_FRIEND_ID:
                url = `${basePath}/friends?id=${data.friendId}`;
                break;
            default:
                throw new Error(`Unknown event: ${event}`);
        }

        return { method: this.getHttpMethod(event), url };
    }

    async sendRequest(data, url, method, expectsResponse = true) {
        try {
            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: method === HttpMethod.GET ? undefined : JSON.stringify(data),
                credentials: "same-origin",
            });
    
            if (!response.ok) {
                console.error(`Request failed with status: ${response.status}`, { url, method });
                return null; 
            }
    
            if (!expectsResponse) {
                return null; 
            }
    
            const responseBody = await response.text();
            return responseBody ? JSON.parse(responseBody) : null; 
        } catch (error) {
            console.error("Failed to send request:", error, { url, method, data });
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
    
            const response = await this.sendRequest(data, url, method, expectsResponse);
            this.handleMessage(event, response);
        } catch (error) {
            console.error(`Error during request for event "${event}":`, error, event, data);
        }
    }

    handleMessage(event,  data) {
        if (this.nonResponseEvents.includes(event)) {
            //console.log(`Event "${event}" processed. No response expected.`);
            return; 
        }
        //console.log(`Received response for event "${event}" `, data);
        if (this.listeners[event] && data != null) {
            this.listeners[event].forEach(callback => {
                callback(data);
            });
        }
    }


    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
}

const apiClient = new CustomHttpConnection();