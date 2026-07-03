**Asyncrhonous server updates**
- Trigger animations when trade request (received, accepted, rejected) on clients asynchronously.

**Front-end style**
- Trigger animation when pack is obtained.

**User teams**
- Automatically get a sticker of you team.
- Render team image next to username on leaderboard.
- Add team logo image to album stage.

**Obtaining packs**
- Think on other ways to obtain packs.

**Misc**
- Move stickers map to server and randomize the stickers obtained on server side instead of client side and send obtained to server.

- When re-loading the page, the availablePacks counter is restarted to localStorage value which sometimes disagrees with server values.
- Remove #test-button from trading-stage.
- Don't: <document.getElementById("current-username").innerHTML = payload;> at eventSource event received: script.js : startEvents() : eventSource.addEventListener...