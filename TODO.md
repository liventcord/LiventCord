### TO-DO

## Features

- Cache uploaded attachments for each channel locally before they are ready to submit
- Add a upload slider for uploaded attachments
- Add a settings toggle for typing events
- Implement displaying guild emojis in the emoji selector
- Add a friend/guild status notifier on login (like Vencord) to display left guilds/friends (relationshipNotifier)
- Add a user's opened DM to the DMs list
- On dm, new messages should show as red bubbles
- Add dm support for read system
- Add reactions
- Add a favorite GIFs system
- Implement dm attachments display support
- Add mention/ping notifications so messages show a red circle
- Make the server parse and save mentions for messages on submit/edit in the database
- Inviting should be allowed on new guild members
- Add Role system
- Add invite friends ui on invite people popup
- Add invite settings panel managing invites
- Implement displaying invite links
- Add shared friends server logic & populate shared friends ui
- Add guild image delete button
- Change dm message deletions to be optimistic
- Add versioning to all api endpoints
- Replace put methods with patch on endpoints


## Bug fixes

- Typed message overlaps GIF/emoji and the send button on mobile
- Cancelling image upload to profile and guild image should refresh settings ui
- Until opening dm or entering guild, dm container friend status stays offline
- Fix user input width scaling wrongly on page switch
- Dm list users are not right clickable if they are not friends
- Pin message handler should register message on cacheinterface and should not use Message class for pin message responses
- Invite to guild context menu requires changing into a guild before appearing
- Navigation error : opening page in a user dm channel, going to a guild, then going to home breaks ui