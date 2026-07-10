# Twister Spinner 🌀

A random spinner for the game **Twister**, built as a mobile-first web app you can
add to your iPhone home screen. Tap **SPIN** and it randomly picks a limb and a color —
plus the special **Air** and **Spinner's Choice** spots from the modern Twister spinner.

- **Left / Right Hand** and **Left / Right Foot**
- **Red · Green · Blue · Yellow**
- **Air** — raise that limb up
- **Spinner's Choice** — the spinner picks the move
- Animated needle, sound effects (toggleable), and vibration feedback
- Works offline (PWA) and installs to your home screen with its own icon

## Run it locally

It's plain HTML/CSS/JS — no build step. Serve the folder with any static server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed URL. (Opening `index.html` directly works too, but a server is
needed for the offline service worker and home-screen install to behave correctly.)

## Put it on your iPhone

1. Host the folder (see **Deploy** below) and open the URL in **Safari**.
2. Tap the **Share** button → **Add to Home Screen**.
3. Launch it from the new icon — it opens full-screen like a native app.

## Deploy (GitHub Pages)

1. Push this folder to a GitHub repo.
2. Repo **Settings → Pages → Source: Deploy from a branch**, pick `main` / root.
3. Your app goes live at `https://<user>.github.io/<repo>/`.

## Project structure

```
index.html            markup
styles.css            styles (mobile-first, dark theme)
app.js                spinner logic + wheel rendering + sound
manifest.webmanifest  PWA metadata
sw.js                 offline service worker
icons/                app icons (svg + png, incl. apple-touch-icon)
```

## Fairness

Every spin picks one of the 24 spots uniformly at random (`Math.random`). The needle is
then animated to the spot that was chosen, so what you see is what was rolled.
