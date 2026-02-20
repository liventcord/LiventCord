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
- Add invite friends ui on invite people popup
- Inviting should be allowed on new guild members
- Add Role system
- Add invite settings panel managing invites
- Add shared friends server logic & populate shared friends ui
- Add guild image delete button

## Bug fixes

- Typed message overlaps GIF/emoji and the send button on mobile
- Split API init request (it is too slow to fetch)
- Guild context menu does not work if stayed on me page
- Cancelling image upload to profile and guild image should refresh settings ui
- Idle and do not disturb status only gets shown locally
- Changing guild does not refresh attachments
- Until opening dm or entering guild, dm container friend status stays offline
- Profile display is broken
- Fix user input width scaling wrongly on page switch
- Dm list users are not right clickable if they are not friends
- Pin message handler should register message on cacheinterface and should not use Message class for pin message responses
- Add edited message text on loaded messages 
- Create server popup looks broken
- Avoid inactive client disconnections to ws
- Changing channel while media panel is open should close media panel