# RBB film generation evidence

Local review run: 14 October 2026 (America/Chicago). Krea session: `https://www.krea.ai/video/01a13dbd-4e9e-7004-ab7f-686cc2dc644e`.

These are actual UI submissions and observed results. Listed compute units are the UI's generation estimates, not evidence of billing or refunds. The generic failure response does not identify a cause.

| Model | Input and setup | Prompt variation | Observed result |
| --- | --- | --- | --- |
| Seedance 2.5 | Glass photographic v2 as reference; Full, 1080p, 8s | Detailed sideways track; two visitors step, point and study floor | Generic failure; 3,370-unit estimate |
| Seedance 2.5 | Same reference; Full, 720p, 5s | Static camera; one step and looking down; preserve room | Generic failure; 856-unit estimate |
| Seedance 2.5 | Same reference; Draft, 5s | Animate naturally; small pointing gesture, fixed architecture | Generic failure; 381-unit estimate |
| Kling 3.0 | Table photographic v2 as explicit first frame; STD, 5s, audio off | Lean, point and quietly study model table; fixed camera/architecture | Completed; downloaded and accepted provisionally |
| Seedance 2.5 | Table photographic v2 as explicit first frame; Full, 720p, 5s | Static camera. The visitors calmly inspect the architectural models on the table. One small pointing gesture. Natural movement. Preserve the room. | Generic failure; 856-unit estimate |
| Seedance 2.0 Fast | Same first frame, same minimal prompt; 720p, 5s | No prompt change; tests another Seedance variant | Generic failure; 896-unit estimate |
| Kling 3.0 | Shelf photographic v2 first frame; STD, 5s, audio off | Visitor steps beside shelves then studies a model; pair gestures at table | Completed; downloaded and accepted provisionally |
| Kling 3.0 | Wall photographic v2 first frame; STD, 5s, audio off | Lean toward model wall; pair gesture and turn toward timeline; retain central column | Completed; downloaded and accepted provisionally |
| Seedance 2.5 | Text only, no reference/start frame; Full, 720p, 5s | A quiet contemporary gallery with warm oak walls and a white architectural model table. Two visitors study the models and one gently points. Static camera, natural realistic movement, soft daylight. | Generic failure; 856-unit estimate; diagnostic only, not source-faithful footage |
| Kling 3.0 | Glass photographic v2 first frame; STD, 5s, audio off | Point toward model beneath glass; second visitor leans; grounded feet/stable glass grid | Completed and downloaded; quality comparison recorded separately |
| Seedance 1.5 Pro | Glass photographic v2 first frame; 720p, 5s, audio off | Static camera. Two visitors look down through the glass floor at the architectural models. One gently points while the other leans slightly closer. Small natural movements. Preserve the room and the glass grid. | Generic failure |
| Seedance 2.5 | Restored the successful earlier glass pilot's reference and parameters via Reuse parameters in original session; Full, 1080p, 8s | Reimagine source as inhabited live-action museum; two natural steps, stop and point; companion leans; gentle lateral parallax; physical glass, skin/fabric and stable architecture | Generic failure; 3,370-unit estimate |

Earlier work produced one usable Seedance 2.5 glass-floor activity pilot. Its original download is `3d5ae799-285d-43a9-a874-0599e07df8a2-video.mp4`; see `GLASS_ACTIVITY_REVIEW.json`. Other earlier failed table/shelf attempts are not assigned invented counts here. The new Kling shots are reimagined moving scenes based on photographic keyframes, with visible independent human activity. They are not static image zooms.

## Download provenance

- Table: `https://app-uploads.krea.ai/public/d85bc8fe-c882-42cb-ba58-094c88c8701f-video.mp4`
- Shelf: `https://app-uploads.krea.ai/public/61f953ab-6698-4968-a829-42a67213e4bd-video.mp4`
- Wall: `https://app-uploads.krea.ai/public/395a1b84-4685-495f-84da-6b505439782c-video.mp4`
- Glass comparison: `https://app-uploads.krea.ai/public/042a4242-a874-484c-88c9-d353d2801aee-video.mp4`

All URLs were observed on completed video elements before supported browser downloads. Original media, sampled contact sheets, technical probes, strict full-stream decode results, and the review decision are retained in each `*-kling3-review/` folder. The live film register is `../../assets/video/manifest.json`; it is authoritative if a later review replaces a candidate.

The repeated Seedance failures span references, explicit first frames, text-only input, short/detailed prompts, full/draft quality and multiple versions. This shows that shortening the prompt has not resolved the issue in this run. It does not establish a policy violation, account limit, provider outage or other particular cause.

The final retry above used the earlier session `https://www.krea.ai/video/01a13d88-697f-7ffe-a4d9-8490ebffbc90`. It also failed. The reviewed deck therefore uses the four successful Kling 3.0 films; the older Seedance pilot is preserved for comparison. No new Seedance success is claimed.

## Nine-film expansion — 15 October 2026

Five additional Kling 3.0 Pro shots completed from the previously accepted photographic first frames: glass-floor walk, pre-function walk, pre-function closer encounter, timeline walk, and timeline models-to-screen encounter. Each is 1920 × 1080, 5.041667 seconds, silent H.264. They are independent generated takes with people and camera movement, not duplicate clips or still-image pans. Combined with the four earlier clips, the presentation now has nine unique sources, three per location.

New full-stream decodes passed. Two reviewers inspected all five contact sheets at 2 fps plus selected full-resolution frames. The major source anchors remain recognizable; no obvious person/column/table intersections were seen in those sampled frames. All five remain provisional concept footage. The invented heading visible on the glass screen is the strongest remaining defect; generated display text is not approved company content. This review does not certify every frame or final photoreal quality.

The three local sequences total 17.09 MB. Local source downloads, posters, probes and per-film provenance/review are retained in `nine-films/`. The public share package encrypts the films and other presentation assets; raw source downloads are excluded from publication.
