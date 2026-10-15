# Encrypted static sharing

Build with `RBB_SHARE_PASSWORD` set in the environment, then run `node scripts/build-share.mjs`. The supplied password is used only to derive the encryption key and is never written to the output. Upload only `build/share/` as the public Pages artifact. The build accepts no password argument and prints no key or password.

The public root contains a restrained password landing page, service worker, public cryptographic parameters, and randomly named encrypted blobs. Every presentation HTML/CSS/JS file, font, image, video and runtime manifest is encrypted. The path-to-blob catalog is encrypted too. Audits, source PowerPoint/Rhino/PDF files, scripts, node_modules and working notes are outside the build allowlist. Static hosting therefore never receives plaintext protected runtime files in its public artifact.

Encryption uses AES-256-GCM with independent random 96-bit nonces and authenticated file paths. PBKDF2-HMAC-SHA256 uses a fresh 192-bit salt and 600,000 iterations. The browser derives a non-extractable CryptoKey after password entry. No password or key is placed in localStorage, sessionStorage or CacheStorage. The key and a bounded 64 MiB decrypted LRU cache exist only in memory. Worker restarts recover the key through a MessageChannel with the still-open parent landing page in the exact deployment scope. Lock removes the presentation iframe, invalidates pending unlock/recovery work, and clears worker key/cache state.

The service worker serves decrypted resources under `deck/` with their correct MIME type and `Cache-Control: no-store`. Video byte-range requests support 206 and 416 responses. Real virtual URLs preserve relative imports and `import.meta.url`; modules are not rewritten. The gate waits for iframe load, the deck's ready promise, and fonts before its 0.6-second reveal. Reduced motion reveals immediately. The iframe allows fullscreen and receives focus for keyboard navigation.

Host at the root or a subfolder on HTTPS (GitHub Pages), or localhost for review. `file://` is unsupported because service workers require a secure origin. The landing page loads no artwork and makes no external network requests. A shared password permits anyone who knows it to unlock the package; it is not individual account authentication. As with other delivered media, a recipient can save unlocked content. Rebuilding with another password does not revoke previously downloaded copies.

## Verification

`build/sharing-qa/report.json`: 21 passed, 0 failed. Actual browser verification covers locked paths, wrong/correct passwords, keyboard focus, overview diagram, exact decrypted Range bytes, invalid ranges, film playback, menu, worker restart recovery, lock, mobile layout, public allowlist, hidden catalog paths, no password in public files, authentication-tag rejection and page errors. Screenshots record locked desktop/mobile and unlocked cover/film states.

Technical references: [Web Crypto authenticated AES-GCM](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt), [service-worker fetch interception](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/fetch_event).
