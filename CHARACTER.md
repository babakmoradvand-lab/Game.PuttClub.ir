# Rig11 — skinned PuttClub golfer

`pro_golfer_character.glb` is a genuine 3D skinned character, not a sprite, billboard or photographic body plane. `pro_golfer_character.blend` is the packed, editable Blender source.

- **1 skin / 51 joints / 5 authored clips:** FullSwing, ThreeQuarter, HalfSwing, Chip, Putt.
- Anatomical human mesh with fingers, nose, ears and actual fitted clothing geometry. Navy polo, pale grey trousers, white cap, left glove and golf shoes follow the supplied reference's outfit. Proper anatomical UV skin atlas; woven cloth normal texture; embedded PNGs. The cap has PuttClub branding, not an exact reproduction of the reference's commercial marks.
- The head is an anatomical approximation with a reference-derived facial UV texture, **not a scanned, identity-exact or guaranteed photoreal digital double**. It should not be described as a perfect match to the reference.
- The GLB contains one shaft and grip plus three interchangeable head meshes. `golfer-rig.js` exposes only the selected driver/iron/putter head in the game and hides the old procedural character/club. Raw asset viewers may display all head alternatives until a variant is selected.
- `golfer-rig.js` samples the five real GLB skeletal clips, then solves two-link arm/leg IK. Grip and hand constraints maintain contact; shorter clubs use a shorter shaft and appropriate small reach/posture adjustment. Native +X is the left/lead side along the target; native +Z faces the ball. Tee-platform stance uses the flat platform top rather than a sloped terrain sample.
- Frame mapping: 0 address, 40 backswing top, 50 contact, 100 finish at 60fps clip time. The existing game state machine drives these phases/rates; the old physical-shot callback fires once after the model has sampled frame 50. Ball physics, shot specs, lie logic and tracer functions are byte-identical to pwa9.
- Inactive bounds are not used to cull moving skinned arms. Accessories are combined by material to limit draw calls. Existing quality controls and reduced-motion treatment remain.

## Evidence

686 pose samples (13 clubs × supported modes × 7 poses × mobile/desktop), including 120 repeated idle samples per selection to rule out pose accumulation. Tests check real skinned hand vertices near the grip, wrist targets, contact, 51 bones, one shaft, one visible head, hidden fallback, finite coordinates and one callback at contact for all five strokes. All passed with no page/shader errors. The ordinary 115-record regression, 48 setup journeys, 2160 heading/stance cases, offline/update suites and original tracer tests also passed.

The actual cached pwa9 application was upgraded to the current release under the Pages subpath: **4 resources downloaded / 44 reused**, round fields preserved, new rig loaded, then successfully reopened entirely offline. Runtime: **48 files / about 14.1 MiB**, including the rig script and self-contained GLB.

Evidence is headless Chromium/SwiftShader, not a physical iPhone/Safari test, native-GPU 60fps claim or biomechanical/motion-capture certification. Models and animation can be further refined; the independent Tehran terrain and persistent cold-session scores are not changed in this release.

## Asset provenance

Anatomical base, original weight data, skeleton landmarks and morph targets: **MakeHuman core graphical assets, CC0**, downloaded from https://github.com/makehumancommunity/makehuman/tree/master/makehuman/data . The downloaded file headers and `CHARACTER_ASSET_LICENSE.txt` contain the applicable CC0 statement. No MakeHuman application source code is included. Clothing/accessories, compact skeleton remapping, five golf clips and runtime IK integration were built for this release. The provided reference supplies the outfit direction and facial-atlas pixels.

## Rig11 visual pass
Actual weighted-mesh smoothing, head-proportion changes, constructed golf shoes/laces, folded collar/open neckline, cap and garment details, 2048px corrected face atlas. This remains an approximation, not a scan; visible resemblance is not certified by the joint tests. The increased detail has a cost: about 172k scene triangles and slow software-GPU rendering. No physical iPhone performance claim. See current release notes and editable source for the exact changes.
