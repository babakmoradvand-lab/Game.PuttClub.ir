# Current runtime: swing25 (2026-10-17)

The human GLB is unchanged from the verified published asset (SHA-256
`5a4af205f0ccab7d462a739fb48bf1e559a3f515ef600212cb992c260bd7fb01`).
The original five embedded clips and the historical notes below remain provenance,
not a claim that the current game uses those clips or professional motion capture.

`golfer-rig.js` now contains two layers:

- `GolfMotion`: original, skeleton-independent key-pose trajectories for full,
  three-quarter, half, chip, putt and the pre-existing punch option.
- `GolfAthlete(gltf, binding)`: the actual skinned-human adapter, joint mapping,
  calibrated rigid clubs, two-hand grip and bounded terrain/foot constraints.

Club lengths are independently configured in metres. Shaft geometry changes length;
club head, grip and human bone scales do not change to achieve reach. Club design lie
and avatar-fitted address shaft angle are deliberately separate parameters. New
striking surfaces are real flat polygon geometry with loft, grooves and family-specific
head shape, not the previous ellipsoids. Club sources use the existing project; no
paid motion pack or third-party replacement human was acquired.

The trail foot rolls around a toe contact; putting remains planted. Joint transforms
are reset from the bind pose for deterministic, non-accumulating samples. Body
adaptation for a lower ball is bounded by terrain height rather than an iterative
wrist-to-hip reach solver. Actual face intersection and the unchanged once-only
shot callback are verified at impact.

A future human can supply `binding.bones` (canonical name → source node name),
`binding.hands.L/R` (`rotation` XYZ radians, `palm` in hand coordinates, `along` in
metres), and `binding.clubSource`. Metres, Y-up and front +Z / lead +X are the current
contract. A different reference pose, bone axes or body proportions needs calibration
and motion retargeting; the name-mapping test is NOT universal compatibility evidence.
No future multi-sport model has been received or tested yet.

Evidence: `audit/swing25/{rig-results,game-results,protected,upgrade-results}.json`.
Tests are geometric and functional, not a coach's biomechanical certification.
Appearance likeness and physical iPhone/Safari performance are not certified.

The standalone seven-iron GLB is an additional baked study export, not the runtime
body replacement; its study textures are limited to 1024. The game retains original
textures and the original offline caching/storage architecture.

## Historical body / asset notes (superseded for runtime motion)

# Detail18 current character and scale contract

The actual shipped GLB is refined from the published look17/rig14 asset, not rebuilt with the older rig11 recipe. Native metres, upright +Y, front +Z, left/lead +X. Object scale stays (1,1,1) on every shot. Body ~1.80m, whole bind geometry ~1.8215m including cap/shoes; ball diameter 0.04267m.

`golfer-rig.js` retains authored five clips and contact IK, adds independent terrain-normal/height shoe placement and a releaseable hip hinge to reach shorter clubs without a deep squat. Runtime joint/animation byte arrays are preserved. Cap/collar geometry, cloth detail and packed editable `.blend` updated. See RELEASE_NOTES for tests and limitations. The source generator from rig11 is historical; `character-source/refine_detail18.py` is this revision's reproducible patch (uses the pinned public look17 GLB and included cloth texture).

The face is still an approximation. Passing geometric/contact tests is not a likeness or iPhone-performance certification. Raw GLB stores three alternative club heads; the game exposes only one.

---
Historical character documentation follows.

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
