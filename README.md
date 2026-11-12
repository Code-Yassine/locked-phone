# The Locked Phone

An escape game for the club kickoff, in Moroccan Darija (Latin script). Teams get a fake smartphone in the browser, unlock four locks across its apps, and find where the club president is hiding before the battery dies.

It is plain HTML, CSS and JavaScript with no build step, plus a small Node server (`server.js`, no dependencies) that serves the game and keeps a **live scoreboard** of all teams.

**End of the game:** when a team unlocks the last lock (the pin in Maps), the flag (`n7sec{...}`, set in `js/config.js`) is shown and their game ends. There is no physical part.

**Hints:** each team can take only 2 hints in the whole game (−10% battery each). Change `MAX_HINTS` in `js/game.js` to allow more.

**Score:** 100 points per lock opened + battery left − 2 points per full minute played (never below 0). The phone dying ends the game too; the team keeps the points for the locks it opened. Each device sends its progress to the server when the team starts, opens a lock, makes a mistake, takes a hint, finishes or dies, and every 15 seconds while playing.

```
locked-phone/
├── server.js       serves the game + the scoreboard API
├── scores.html     live scoreboard page (/scores)
├── index.html      page structure
├── css/style.css   all styles
├── js/config.js    settings to edit before the event
├── js/game.js      game logic and all the puzzle content
├── media/          your own photos (media/photos/); see media/README.txt
├── Dockerfile      Node image that runs server.js
└── tools/make-hash.js  helper for changing answers (not deployed)
```

## 1. Set up the game

Open `js/config.js` and change:

- `flag`: the flag teams get on the final screen (format `n7sec{...}`).
- `batteryMinutes`: how long a full battery lasts on its own (20 to 240). The default is 60.

## 2. Try it on your computer

You need Node.js (18 or newer). From the `locked-phone` folder:

```bash
PORT=8080 node server.js
```

Then open http://localhost:8080 for the game and http://localhost:8080/scores for the scoreboard. A plain static server (`python3 -m http.server`) also runs the game, but without the scoreboard.

## 3. Deploy

### With Docker

```bash
docker build -t locked-phone .
docker run -d --name locked-phone -p 80:80 -v locked-phone-data:/app/data -e ADMIN_KEY=your-secret --restart unless-stopped locked-phone
```

The game is at `http://<server-ip>/` and the scoreboard at `http://<server-ip>/scores` (put it on a projector; it refreshes every 3 seconds). Scores are saved in the `locked-phone-data` volume. After you edit `config.js`, rebuild the image and restart the container.

### Without Docker

Copy the folder to a server with Node.js and run `node server.js` (use `PORT`, `DATA_DIR` and `ADMIN_KEY` to configure it). A static host such as GitHub Pages or Netlify can run the game but not the scoreboard.

## During the event

- **Game master panel**: add `#gm` to the address (for example `http://<server-ip>/#gm`). It appears at the bottom of the case file and lets you change the flag and battery time on that device, or reset the phone for the next team. Players don't see it without `#gm`.
- **Progress** is saved in each browser, so a refresh doesn't lose it. Every team should play on its own device or browser.
- **Scoreboard**: open `/scores`. The **Clear scoreboard** button clears all scores; it asks for `ADMIN_KEY` (default `kickoff-gm`, change it with `-e ADMIN_KEY=...`). A finished game can't be changed afterwards.
- **Restarting**: when a team finishes or the phone dies, the final screen has a **Start a new game** button.
- **Fonts** load from Google Fonts. Without internet access the game still works and uses the device's system fonts.
- **Cheating**: a player who opens the browser's developer tools can read the puzzle content in `js/game.js`. The answers are stored as hashes, but ask teams to keep dev tools closed.

## Your own photos

See `media/README.txt`: copy pictures into `media/photos/` and add `img:'media/photos/name.jpg'` to a photo in `PHOTOS`. Rebuild the Docker image afterwards.

## Changing the puzzles

All the content is near the top of `js/game.js`: `CHATS`, `PHOTOS`, `NOTES`, `MAILS`, `EVENTS`, `PLAYLISTS`, `PASSES`, `MEMO` and `HINTS`.

The phone passcode is Rayan's birthday, which the lock screen announces as **tomorrow** ("ghedda 3id miladek"). Players read today's date on the lock screen and type tomorrow as `DDMM` (for example 13 November → `1311`). It is computed from the device clock, so it works on any day; nothing to configure. Check that the devices show the right date.

The other answers are checked against hashes in `KEY` (`note`, `vault`, `pin`). To change one, get its new hash with Node:

```bash
node tools/make-hash.js "your new answer"
```

Paste the printed number into `KEY`. Text answers are compared in lowercase, without spaces, accents or punctuation, and the script applies the same rules. Also update the clues and `HINTS` that lead to the new answer.
