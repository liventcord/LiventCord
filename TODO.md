### TO-DO

## Features

- Cache uploaded attachments for each channel locally before they are ready to submit
- Add a upload slider for uploaded attachments
- Add a settings toggle for typing events
- Implement displaying guild emojis in the emoji selector
- Add an image context-menu search feature using TinEye etc (reverseImageSearch)
- Add a friend/guild status notifier on login (like Vencord) to display left guilds/friends (relationshipNotifier)
- Add a user's opened DM to the DMs list
- Make YouTube embeds use no cookies
- Add reactions
- Add a favorite GIFs system
- Implement dm attachments display support
- Add mention/ping notifications so messages show a red circle
- Make the server parse and save mentions for messages on submit/edit in the database

## Bug fixes

- Right-click context menu doesn't work on self-sent messages
- Typed message overlaps GIF/emoji and the send button on mobile
- Split API init request (it is too slow to fetch)
- Clicking on profiles looks broken on mobile
- HTTP URL appears duplicated when a message like "http://example.com/" is sent
- Added dm user list only gets displayed for first dm sender, other percipient throws 409 conflict error
- Dm container bubbles do not show accurate online status of user
