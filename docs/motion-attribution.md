# RBB Gallery menu

`src/museum-menu.js` and `museum-menu.css` adapt Osmo's **Footer with Parallax Effect** and **Underline Link**, from the licensed source copied through the user's Osmo account into `footer-html.txt`, `footer-css.txt`, and `footer-js.txt` beside this note. Reference: [Osmo](https://osmo.supply/) / [component demo](https://osmo-footer-parallax-effect.webflow.io/).

The adaptation retains the supplied desktop proportions: 2.5em outer padding and column gutters, three equal columns, 3em group-label spacing, 2.75em links, a full-width bottom wordmark, and the exact underline duration/curve `.735s cubic-bezier(.625,.05,0,1)`. The footer inner moves from -25% to 0 while its dark layer falls from .5 to 0. Original Osmo logo, contact information, and navigation content are excluded. RBB-specific content and a small menu/close row replace them. Numbered links and focus handling are additions for presentation navigation. The public demo displayed an Osmo Vault access gate in a clean browser; no attempt was made to bypass it. The supplied licensed source is the implementation authority.

## Integration

```js
import { mountMuseumMenu } from './museum-menu.js';
const menu = mountMuseumMenu(document.querySelector('#overview'), {
  scenes,                        // The 12 existing .scene elements, in order.
  getIndex: () => state.index,
  onSelect: index => selectFromMenu(index),
  onClose: () => closeOverview(),
});
```

The module automatically loads `museum-menu.css` relative to itself. It replaces the host's children, so remove old `#overview-grid` creation/update code and old `.close-overview` binding. Application markup, `presentation.js`, and `styles.css` were not edited by this module task.

- `menu.open()` and `menu.close()` return promises resolving when their animation finishes (`false` if interrupted/no-op). Owner code should run the deck lift alongside them, using **1.2 seconds / `power3.inOut`** and reduced-motion duration zero.
- `onSelect(index)` and `onClose()` request owner actions; they do not automatically run an unrelated deck transition. Owner callback should invoke `menu.close()` and its deck return together, then select the target scene.
- `menu.setIndex(index)` updates the current chapter marker without moving focus.
- `menu.dispose()` kills motion/listeners and restores the original host contents and attributes.
- Host is fixed, full viewport, at **z-index 30**. Keep the moving deck above it while revealing. No full-screen fade-in is applied to the host; only its inner parallax and dark layer animate.
- Root owns G, deck translation, and background inertness. Module owns Escape, Close, Tab/Shift-Tab containment, and focus restoration. Remove inertness from the deck when closing; focus restoration waits until the next animation frame.
- Module handles reduced motion and interruption. On narrow screens it follows the source's stacked-column treatment and allows vertical scrolling without horizontal overflow.

## Verified

Independent local harness: `menu-review.html`.

At 1440×900: 3 columns, 12 links, 40px page margins; wordmark 1360×180 at x40/y680; no link/wordmark overlap. Open settles at y=0 and shade opacity=0. Current slide receives focus; Tab from last link wraps to Close; Shift-Tab returns to the last link; Escape closes and restores the trigger. At 390×844: scroll width equals viewport (390), content scroll height 988. No page JS errors.

Screenshots: `menu-open.png`, `menu-opening.png`, `menu-mobile.png`. Results: `menu-verification.json`. This verifies the isolated module; root must confirm its deck-lift integration in the final presentation.

## Integrated verification (final)

Tested the actual native presentation at `http://127.0.0.1:8772` and the HyperFrames wrapper at `http://localhost:8773` after root integrated the menu and presentation-sheet lift.

A controller defect was confirmed and fixed with root authorization: `menuBusy` discarded rapid G-close intent while opening. The controller now tracks the desired state, reverses the two concurrent animations, resolves interrupted sheet animations, and ignores held-key repeats. Only the open/close/toggle controller functions and keyboard G branch in `presentation.js` were changed; slide navigation, arc choreography, Three, and film logic were preserved.

Verified in the actual deck:
- G opens and closes; the sheet settles at -100% / 0 and inertness is released on close.
- Tab and Shift-Tab wrap within the menu. Focus returns to the overview trigger.
- Selecting Timeline corridor reaches slide index 8; selecting Possibility on mobile reaches index 11.
- Two G presses 120ms apart now finish closed instead of remaining open.
- Mobile 390×844 has no horizontal overflow and allows vertical scrolling.
- The official wrapper follows menu selection to index 4, stays in live mode, and its Three renderer advances from 44 to 63 frames during a 700ms hold. Rapid G also finishes closed in the wrapper.
- No page JavaScript errors in either integrated browser run.

Actual integrated screenshots: `integrated-opening.png`, `integrated-menu-desktop.png`, `integrated-selected-timeline.png`, `integrated-menu-mobile.png`, `integrated-menu-presenter.png`.

Machine results: `integrated-menu-verification.json`, `integrated-wrapper-verification.json`.

Final `npm run check` with browser sampling at 7, 48, 61, 85, 109, 133 seconds passed: `ok:true`, `browserSkipped:false`. Report: `.hyperframes/artifacts/checks/1adac08f-58cf-407e-8a6f-68412cbabcc2.json`. Zero lint/runtime/layout/contrast errors. Existing warnings remain (CSS transition determinism, empty image-slot duplicate discovery, Three shadow-map deprecation). CLI motion sampling was disabled; the browser observations above verify actual held-slide motion. Raw final check output: `integrated-final-hyperframes-check.json`.
