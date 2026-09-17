# Rummikub Turn Timer

A full-screen turn timer and scorekeeper for Rummikub, built to sit on a phone in
the middle of the table. Tap anywhere to start your turn; the next player taps to
reset it. Ticks through the last three seconds, sounds an alarm at zero.

Ships as a static export — the same build deploys unchanged to Vercel or
Cloudflare, installs to a home screen, and works with no signal.

## Running it

```bash
npm run dev                 # development
npm test                    # scoring unit tests
npm run build               # static export into out/
npx serve out -l 3000       # serve the export
```

`http://localhost` counts as a secure context, so service workers, the manifest
and wake lock all work locally without a certificate.

## How it works

**The timer never counts down.** A tap records an absolute deadline
(`Date.now() + maxMs`) and every reading derives from `deadlineAt - Date.now()`.
There is no accumulator, so there is nothing to drift: a delayed or coalesced
tick changes *when* the display updates, never *what* it says. Because the
deadline is an epoch timestamp in `localStorage`, a reload or a PWA relaunch
mid-turn resumes on the right second.

**Audio is scheduled at the moment of the tap, not fired by a timer.** All four
cues go onto the `AudioContext` clock inside the tap handler. `osc.start(t)` is
sample-accurate, whereas `setTimeout` on a phone jitters by tens of milliseconds
and is clamped to ≥1s once the tab is hidden. That is also why the alarm still
fires while you are on the scoring screen.

**Scoring stores inputs, not scores.** A round records the winner plus each other
player's leftover tile value; every total is derived. Correct one mistyped
leftover and the winner's positive corrects itself. Storing per-player scores
would mean every correction touches two records, and they drift apart.

**The state lives outside React** in module-scope stores read through
`useSyncExternalStore`, which is what lets the timer keep running across
navigation and lets stores hydrate from `localStorage` synchronously — before
the first client render, so there is no flash of default values. An inline
`<head>` script closes the remaining gap between HTML parse and hydration, so
opening the app mid-turn paints the true remaining seconds in the first frame.

```
lib/timer/engine.ts     deadline-based engine (no React imports)
lib/audio/              presets, synth, iOS unlock, cue scheduling
lib/match/              scoring: pure compute + pure reducer, unit-tested
lib/store/, lib/persist/  external stores, localStorage, IndexedDB
```

## Deploying

### Vercel

The Next.js framework preset detects `output: 'export'` on its own. Leave the
build command and output directory at their defaults. Don't also set
`trailingSlash` in `vercel.json` — with the Next preset it comes from
`next.config.ts`, and setting both produces a redirect loop. `vercel.json` here
carries only cache headers, because `headers()` in `next.config.ts` is ignored
under static export.

### Cloudflare Pages

| Setting | Value |
|---|---|
| Build command | `npx next build` |
| Output directory | `out` |
| Environment variable | `NODE_VERSION=22` (Next 16 needs ≥20.9) |

Headers come from `public/_headers`, which Next copies into `out/` verbatim.

Both hosts need `/sw.js` served `no-cache` and `/_next/static/*` served
`immutable`; that's what the two header files do.

## Things worth knowing

**Sound on iPhone.** Web Audio is silenced by the hardware ring/silent switch
unless the page claims the `playback` audio session. Claiming it is the *only*
way past that switch — and it pauses whatever the user was playing and puts
transport controls on the lock screen. There is no quiet override. It's on by
default under Settings → *Play on silent*, with the trade spelled out in the UI.

**Haptics are Android-only.** iOS Safari does not implement the Vibration API at
all. The toggle exists and its hint says so on unsupported devices.

**Safari wipes storage after 7 days.** Tracking prevention clears all
script-writable storage — `localStorage`, IndexedDB *and* the service worker
cache — after seven days of Safari use without visiting the site. Installed
home-screen apps are exempt, which is why Settings nudges you to install, and
why there's a JSON export/import under *Your data*.

**Debugging iOS from Windows isn't possible.** There's no remote inspector. The
Diagnostics panel at the bottom of Settings reports audio context state, audio
session type, wake lock, display mode and service worker status instead.

**Prefetch 404s when you build on Windows.** Next writes its RSC segment
payloads through `path.relative`, which yields backslashes on Windows, but
`convertSegmentPathToStaticExportFilename` only replaces forward slashes — so
the separators survive into the filename and Next emits nested directories where
the client expects one flat dotted file. Link clicks fall back to a full page
load, which works but isn't as fast as it should be. **A Linux CI build (Vercel,
Cloudflare) produces the correct filenames**, so don't work around it in app
code.

## Testing on a real phone

`next dev --experimental-https` won't help — iOS won't trust the generated CA and
it doesn't serve `out/` anyway. Tunnel the built export instead:

```bash
npm run build
npx serve out -l 3000
cloudflared tunnel --url http://localhost:3000   # or ngrok
```

That gives a publicly-trusted HTTPS URL iOS Safari will accept, so you can test
Add to Home Screen, the service worker, and the audio session on the real device.
Android debugs properly over `chrome://inspect`.

The things most worth testing by hand, because they're where the bugs hide:

- Tap at 2s remaining — no stale 1-second tick should fire afterwards.
- Background the app at 5s remaining and return at 2s; display and cues should
  both reconcile.
- Flip the ringer switch on an iPhone and confirm the alarm still sounds.
- Edit one leftover in a saved round and confirm the winner's total moves too.
- Add to Home Screen and confirm the icon isn't a screenshot of the page.
