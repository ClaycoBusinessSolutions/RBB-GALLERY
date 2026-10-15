# RBB — A Place for Possibility

A local, editable, 13-slide HTML presentation for the proposed permanent RBB gallery spaces. It combines the Clark Collection, large editorial statements, an animated overall plan, lightweight interactive Three.js studies, supplied proposal renderings, and reviewed AI concept films. Exhibition content can evolve or travel while the RBB spaces remain the focus.

## Open the presentation

From this folder, run:

```sh
python3 launch.py --port 8772
```

The source preview is **http://127.0.0.1:8772/** when served directly from this folder. The share build in `build/share/` adds an encrypted password entry screen for local viewing or static hosting; its decrypted presentation runs in the browser after unlocking. The separate development HyperFrames presenter on port **8773** is not password gated. See the share-build instructions for its current packaging and password behavior. Keep the terminal running; Control-C stops it. `--no-open` prevents automatic browser opening. The explicit port matters: the script's default is 8771. A modern desktop browser with WebGL gives the intended 16:9 presentation experience. Use the local server rather than opening `index.html` as a file.

## Present and explore

| Action | Control |
| --- | --- |
| Next / previous slide | Right / Left arrow or Page Down / Page Up |
| Next slide | Space, unless a button has keyboard focus |
| First / last slide | Home / End |
| Chapter menu | **G**; **Escape** closes |
| Full screen | **F** |
| Pause / resume ambient motion | **M** |
| Explore geometry | Drag a model to orbit; scroll over it to zoom |
| Compare concepts | Select the option labels above a model |
| Browse cinematic designs | Film option labels jump to the matching clip without changing the 3D model |
| Locate the spaces | Use the overall-plan slide; select a numbered space to enter its study |
| Plan and lighting studies | Spatial / Plan and Day / Night on model slides |
| Inspect an artwork | Click an artwork in the opening field; Escape closes |
| Compare original proposal | Source rendering on a cinematic slide |

The audience view has no footer or navigation bar. Keyboard controls and in-slide actions remain available. The menu links use stable scene IDs; the deck contains 13 scenes and a 169-second deterministic timeline, with 18-second cinematic scenes. While a film slide is held, its available location clips continue looping.

Touch devices also support horizontal swipes away from models and buttons. The deck preserves its 16:9 canvas on a phone; desktop or a presentation display is recommended for small captions. Reduced-motion preferences are respected.

## Sources and editorial boundaries

- **Overall plan:** `src/location-plan.js` traces the arrangement in source slide **15**, with a shared arrival, Experience room at the left, pre-function space across the lobby, and the timeline gallery continuing beyond it. The animation is a schematic orientation, not a prescribed route or a surveyed drawing.
- **Design intent:** `../PPTX Presentation/Exhibition Brief 2026.10.07.pptx`. Model table, glass floor, shelves/table, and timeline-wall perspectives correspond to source slides **17, 19, 21, and 23**. The combined spatial option is a connected arrangement, not a fifth perspective rendering.
- **Collection:** supplied *The Clark Collection 5.5.25.pdf*. `assets/art/manifest.json` maps **249 catalogue entries** to source pages and attribution. Multipart works count as one entry; this is not a verified physical-object or current-ownership inventory. Original artwork proportions and pixels are retained. `build/art-audit/` contains the extraction and source audit.
- **Company history:** the supplied Los Angeles office timeline is used on the history slide and as a spatial-study texture. This deck does not claim to reproduce every office timeline or invent new milestones.
- **Geometry:** `src/spatial.js` uses selected bounds and curves derived from the Rhino export, with simplified boundaries, furnishings, miniature models, and materials. The timeline column is restored from the rendering at an approximate position; its dimensions are not survey verified. These are illustrative studies, not surveyed drawings or construction geometry.
- **Direction:** `../_Audit_2026-10-14/direction-evidence.json` records the earlier email/source audit. `build/research/MUSEUM_DIRECTION.md` documents museum precedents as design interpretations, without implying association or endorsement. Licensed motion/menu adaptations are documented in `build/research/osmo/`.

## Media status and remaining review

**`assets/video/manifest.json` is the current film register.** Its `sequences` groups clips by `experience`, `prefunction`, and `timeline`; the four legacy option entries remain compatible. Only actual available clips play. Each sequence uses two video buffers to crossfade and loop without reloading the slide. The visible count and clip label identify the current view; automatic changes do not alter the selected 3D model. The original source rendering follows the current clip. An entry with a local `src` is an actual integrated video; its `status`, `model`, and `review` describe its review state. Absent entries display the original rendering and a pending label. Do not count the `assets/images/*-photographic-v2.png` still keyframes as completed films. Refresh the presentation after media updates.

Films and photographic keyframes are AI concept interpretations. Human activity and materials have been reviewed, but fine text, miniature project identity, faces/hands, and architectural detail may be interpretive. The current presentation is not a claim of final hyperreal rendering, an installed exhibition, or approved company screen content. Per-film source downloads, contact sheets, technical checks, and reviews are in `build/video/`; [GENERATION_ATTEMPTS.md](build/video/GENERATION_ATTEMPTS.md) records the Seedance retries and the successful Kling alternatives.

Day/Night changes the lighting mood of the **3D studies**; it is not a photometric simulation or a promise of paired day/night films. Proposed seminal projects, final exhibition content, and artist/SOSO collaboration remain to be selected and approved. Dimensions, circulation, structural loading, glass-floor feasibility, and AV specifications require the design team's verification.

## Editable files and audit

`index.html` contains slide content and presenter notes; `src/presentation.js` coordinates the deck; `src/spatial.js` builds the lightweight models; `src/art-field.js` runs the bounded collection field; `src/variable-title.js` animates the fixed-position opening type. `src/location-plan.js` draws the orientation plan, and `src/film-sequence.js` manages the looping location clips. `styles.css` and `styles/museum.css` define slide styling. The menu has its own module and stylesheet. Runtime assets are local under `vendor/` and `assets/`.

The deck is an interactive presentation, not a rendered MP4 of the complete sequence. `build/qa/delivery-audit/` contains a dated visual/content review; later media updates may supersede its screenshots. Preserve the supplied PowerPoint, PDF, Rhino files, and earlier study folders when revising this candidate.
