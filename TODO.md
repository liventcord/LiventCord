### TO-DO

## Features

- Cache uploaded attachments for each channel locally before they are ready to submit
- Add a upload slider for uploaded attachments
- Add a settings toggle for typing events
- Implement displaying guild emojis in the emoji selector
- Add an image context-menu search feature using TinEye etc (reverseImageSearch)
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
- Add event broadcasting on dm message operations
- Add Role system
- Add invite settings panel managing invites
- Add shared friends server logic & populate shared friends ui
- Add guild image delete button

## Bug fixes

- Typed message overlaps GIF/emoji and the send button on mobile
- Split API init request (it is too slow to fetch)
- HTTP URL appears duplicated when a message like "http://example.com/" is sent
- Dm container bubbles do not show accurate online status of user
- Fix dm-profile-sign-bubble reactivity, and clicking to it displays deleted user
- Guild context menu does not work if stayed on me page
- Edited messages display duplicated to other clients
- Cancelling image upload to profile and guild image should refresh settings ui
- Idle and do not disturb status only gets shown locally
- Changing guild does not refresh attachments
- Until opening dm or entering guild, dm container friend status stays offline
- Profile display is broken
- Change buttons at login to dropdown
- Logout is broken
- Deleted attachment content should not remove if that copy is used by other attachments 
- Fix user input width scaling wrongly on page switch
- Dm list users are not right clickable if they are not friends
- Pin message handler should register message on cacheinterface and should not use Message class for pin message responses