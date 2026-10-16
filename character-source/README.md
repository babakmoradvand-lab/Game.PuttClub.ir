# Actual editable character recipe
Blender 4.3.2, numpy and Pillow. `build_golfer.py` constructs and skins real geometry and exports the five GLB golf clips, then renders inspection views. Native dimensions in metres; original anatomical assets and weights are CC0 (see included licence). The script writes `candidate-rig11/pro_golfer_character.glb`, `character-source/puttclub_golfer_rigged.blend` and `audit/character11` renders. It does not automatically publish.

Run at repository root: `blender -b -t 4 --python character-source/build_golfer.py`. Baked textures are included. Optionally `python character-source/bake_atlas.py` re-bakes the face atlas, but requires the original reference at `uploads/IMG_9091.png`, not included in the repository. The full packed editable scene is published at `pro_golfer_character.blend`.

This is an incremental visual correction of rig10, not an exact photoreal digital double. The final facial profile overlay is disabled because its stretched cap/background sampling produced visible artefacts. Functional pose tests are not a likeness assessment. Phone/GPU performance has not been physically measured; software rendering is slow at this higher detail.

## Current detail18 workflow

Use `python character-source/refine_detail18.py` for the published model refinement. It patches the immutable look17 GLB (pinned commit; downloads it into .cache only if needed), preserving every joint/animation byte, and uses the included de-lit fabric sample if the original user reference is absent. It outputs the new GLB to `public/` in the development workspace or repository root in a normal Pages clone. The old rig11 builder is historical and does not reproduce later rig14/detail18 appearance edits.

The published packed `.blend` is an editable import of the exact final GLB, not the earlier unsynchronized scene; Blender round-trip exports must be re-tested before replacement.
