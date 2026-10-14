# Actual editable character recipe
Blender 4.3.2, numpy and Pillow. `build_golfer.py` constructs and skins real geometry and exports the five GLB golf clips, then renders inspection views. Native dimensions in metres; original anatomical assets and weights are CC0 (see included licence). The script writes `candidate-rig11/pro_golfer_character.glb`, `character-source/puttclub_golfer_rigged.blend` and `audit/character11` renders. It does not automatically publish.

Run at repository root: `blender -b -t 4 --python character-source/build_golfer.py`. Baked textures are included. Optionally `python character-source/bake_atlas.py` re-bakes the face atlas, but requires the original reference at `uploads/IMG_9091.png`, not included in the repository. The full packed editable scene is published at `pro_golfer_character.blend`.

This is an incremental visual correction of rig10, not an exact photoreal digital double. The final facial profile overlay is disabled because its stretched cap/background sampling produced visible artefacts. Functional pose tests are not a likeness assessment. Phone/GPU performance has not been physically measured; software rendering is slow at this higher detail.
