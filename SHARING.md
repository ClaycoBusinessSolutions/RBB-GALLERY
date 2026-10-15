# Share the RBB presentation

The editable presentation is maintained in the private repository:
https://github.com/ClaycoBusinessSolutions/RBB-GALLERY

GitHub Pages is configured as a private organization site. Viewers need repository access through GitHub and the presentation password. The repository visibility and membership are unchanged.

The local share builder creates an encrypted package using the environment variable `RBB_SHARE_PASSWORD`. The deployed artifact contains the entry screen, a password-derived encrypted catalog, and encrypted runtime/media files. It never contains the plaintext password or source artwork/video files. Password verification decrypts the catalog; an incorrect password cannot open the deck. The browser keeps the key in memory only. Refreshing or locking requires the password again. This is a shared-password presentation gate, not individual access auditing or DRM.

## Local development

Use `python3 launch.py --port 8774` for the editable, ungated source preview, or `npm run present` for the separate HyperFrames presenter. These development previews are not the team share package.

## Build the password entry version

Set `RBB_SHARE_PASSWORD` in the environment, then run:

```sh
node scripts/build-share.mjs
python3 -m http.server 8772 --bind 127.0.0.1 --directory build/share
```

The build needs only Node.js built-ins. Open http://127.0.0.1:8772/ in a current browser. Service workers require localhost or HTTPS. The build replaces only `build/share/` and preserves editable files.

## Publish updates

Push reviewed editable source changes to `main`. Build the encrypted package locally, then publish **only the contents of `build/share/`** to the repository's `gh-pages` branch. GitHub Pages is configured to use that branch's root through its built-in publishing process. The organization restricts custom workflow files, so no custom workflow is installed and no repository rule was weakened. Rebuilding with a new password rotates the shared presentation password.

The nine clips are three per location and loop with crossfades. The 13-slide presentation has no footer. Arrow keys advance, G opens the menu, M pauses ambient motion, F enters fullscreen, and Escape closes overlays. The five newer films are 1080p; the four earlier clips are 720p. All nine remain illustrative concept films.
