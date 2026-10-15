# RBB overview diagram

The diagram follows `assets/images/source-plan.webp`, the flattened plan diagram from slide 15 of `PPTX Presentation/Exhibition Brief 2026.10.07.pptx`. Its three numbered intervention areas remain in the same source orientation. The original extracted text is at `_Audit_2026-10-14/deck/slide_text_and_notes.txt`: slide 17 identifies area 1 as the Experience Center; slide 21 identifies area 2 as Pre-function; slides 22–23 identify area 3 as the model wall/shelf and timeline screen. “Timeline gallery” is the presentation's descriptive label for area 3.

The visible source vestibule at the bottom right opens into the shared lobby. Area 1 is on the left; area 2 is across that lobby to the right; area 3 turns beyond area 2. The native SVG traces those positions, selected surrounding walls, the central stair, and exhibit silhouettes. It omits unrelated rooms and detail. Entrance placement is read visually from the source vestibule and is consistent with the user's description that the Experience room is on the left when entering.

The exported Rhino bounds in `RBB_Experience/build/model/scene-coordinates.json` corroborate the separated Experience zone and adjacent Pre-function/long-wall zones. The SVG uses the supplied perspective plan's orientation rather than rotating the Rhino axes. No geographic north, physical dimension or surveyed clearance is claimed. Connection lines indicate relationships through shared arrival; they are not a measured walking route or new doorway design. The on-slide note states the schematic status.

## Integration

Load `styles/location-plan.css`. Place `<div class="location-plan-host"></div>` inside the new `.scene.location-overview .scene-inner` alongside the eyebrow and title. Import `mountLocationPlan` from `src/location-plan.js`.

The returned API includes `setActive(active,{motion,restart})`, `setMotion(enabled)`, `seek(seconds)`, `progress(0..1)`, `dispose()`, `duration` (3.1 seconds), `timeline` (paused finite GSAP timeline), and `stats`. The optional `onSelect` receives `experience`, `prefunction` or `timeline`. Before a live scene enters, `seek(0)` prepares the reveal; activate after the parent transition. For motion-off use `progress(1)`. Native exports pass the scene's local time to `seek`. Inactive or globally paused diagrams stop; reduced motion settles immediately. The diagram has no raster, Three.js, external network or autonomous animation dependency.

## Verification

`report.json`: **14 passed, 0 failed**. Verified source-numbered regions, initial inactive state, live movement, off-slide/global pause, deterministic nonlinear seeking, all three selections, keyboard activation, reduced motion, title clearance, labels, desktop/mobile overflow, disposal and page errors. Proofs at 0, 0.9, 2 and 3.1 seconds, plus `final-desktop.png` and `final-mobile.png`, record actual painted states. Desktop final image was visually reviewed.
