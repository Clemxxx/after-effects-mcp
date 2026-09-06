---
name: ae-mcp
description: After Effects automation through Model Context Protocol. Use when users request creating, modifying, or animating content in Adobe After Effects, including compositions, layers, keyframes, effects, expressions, text animations, lower thirds, title cards, logo reveals, or any motion graphics tasks. Trigger on phrases like "create in After Effects", "animate this", "make a motion graphic", "add keyframes", "apply effects", or when users mention AE-specific concepts like compositions, precomps, expressions, or time remapping.
---

# After Effects MCP Skill

## Overview

This skill enables automation of Adobe After Effects through MCP tools. It covers project management, composition creation, layer manipulation, animation, effects, and expressions.

## Critical Property Path Formats

After Effects properties require exact naming. Common patterns:

**Transform properties:**
- Position: `"Position"`
- Scale: `"Scale"`
- Rotation: `"Rotation"` or `"Z Rotation"`
- Opacity: `"Opacity"`
- Anchor Point: `"Anchor Point"`

**Text properties:**
- Source Text: `"Source Text"`
- For text animators: Use relative paths like `"Opacity"` within animator context

**Shape layer properties:**
- Position within shape group: `"Contents.Shape 1.Transform.Position"`
- Scale within shape group: `"Contents.Shape 1.Transform.Scale"`

**Effect properties:**
- Effect parameter: `"Effects.Gaussian Blur.Blurriness"`

## Value Formats by Property Type

Different properties require specific value formats:

**Position**: `{"x": 960, "y": 540}` or `[960, 540]`
**Scale**: `[100, 100]` (percentages)
**Rotation**: `45` (degrees)
**Opacity**: `100` (percentage, 0-100)
**Color (RGB 0-1 range)**: `{"r": 1.0, "g": 0.5, "b": 0.0}`
**Source Text**: String value

## Common Workflows

### 1. Creating a Basic Animated Scene

```
1. Create project (optional name)
2. Create composition with specs (width, height, duration, frameRate)
3. Add layers (solid, shape, text, AV)
4. Set initial properties (position, scale, opacity)
5. Add keyframes at different times
6. Apply easing for smooth motion
7. Save project
```

### 2. Text Animation Pattern

New text layers spawn CENTERED: the anchor point is placed at the center of the text block and `position` (default: comp center) means the center of that block — same predictable placement as footage layers. No need to compensate for AE's baseline-left default.

```
1. Add text layer with content
2. Set text properties (fontSize, color, position, justification)
3. Use create_text_animator for preset animations:
   - typewriter
   - fadeInChars
   - scaleInChars
   - slideInChars
   - randomize
   - wave
4. Or manually add keyframes to text properties
```

### 3. Effect Application Pattern

```
1. Apply effect to layer using apply_effect
2. Modify effect properties using modify_effect_properties
3. Or use apply_effect_template for preset effects:
   - gaussianBlur, directionalBlur, glassBlur
   - curves, colorBalance, brightnessContrast, vibrance
   - glow, dropShadow, vignette
   - cinematicLook, vhsRetro, neonGlow, filmGrain
   - chromaticAberration, duotone
```

### 4. Expression-Based Animation

```
1. Set expression on property using set_expression
2. Common expression templates available via apply_expression_template:
   - wiggle, wiggleSmooth, wiggleFadeIn, wiggleFadeOut
   - loopCycle, loopPingpong, loopOffset, loopContinue
   - time, clock, countdown, frameNumber
   - matchPosition, offsetPosition, inverseRotation
   - followPath, bounce, inertia, overshoot, springy
3. Link properties between layers using link_properties
```

## Key Tool Behaviors and Gotchas

### Keyframe Setting

**set_keyframe** - Basic keyframe setting:
- Use for simple keyframes without easing
- Value format must match property type
- Time in seconds (not frames)

**set_keyframe_advanced** - With easing control:
- inType/outType: `LINEAR`, `BEZIER`, `HOLD`
- inEase/outEase: `{speed: number, influence: number}`
- Use for smooth, professional motion

**set_keyframes** - Bulk keyframe setting (PREFER for 3+ keys on one property):
- Sets 50-100+ keyframes on ONE property in a single call: `set_keyframes(property: "Source Text", keyframes: [{time: 0, value: "A"}, {time: 2.5, value: "B"}, ...])`
- The layer/property is resolved once — far faster than repeated set_keyframe or a batch_execute of set_keyframe steps
- Each keyframe can carry its own inType/outType/inEase/outEase, so a whole eased animation fits in one call
- One undo group for the whole batch; typical uses: all subtitle text changes of a video, a full Position path, a beat-synced Scale pulse
- For several properties at once, combine with batch_execute: one set_keyframes step per property

**apply_easy_ease** - Quick easing application:
- Apply to existing keyframes
- Type: `IN`, `OUT`, `BOTH`
- Can target specific keyframe by index or all keyframes

**Text keyframes** - "Source Text" is keyframable: `set_keyframe(property: "Source Text", time: 2, value: "NEW TEXT")` changes the displayed text over time on a SINGLE layer (e.g. countdowns, rotating words); for many text changes use set_keyframes with the whole list in one call. After Effects forces HOLD interpolation on text keys — the text switches instantly at each keyframe, no easing needed. The layer's styling (font, size, color) is preserved: the value is applied through the layer's existing TextDocument. Text animators keep running across text changes.

### Layer References

Layers can be identified by:
- `layerName`: Preferred for clarity
- `layerIndex`: 1-based (1 = top layer)

When modifying layers, always verify layer exists first via list_layers or get_layer_info.

list_layers is the fastest way to understand a whole composition in ONE call: it returns stacking order (index 1 = top), layer type, timing (inPoint/outPoint/startTime), parenting, and the `source` item name of footage/precomp layers. Pass `includeText: true` to also get the `text` content of every text layer (off by default to keep responses small). Only fall back to get_layer_info when you need transform values or full text styling for a specific layer.

### Composition Management

**Creating compositions:**
- Specify complete dimensions and timing
- backgroundColor uses 0-1 RGB values
- frameRate commonly: 24, 30, 60

**Modifying compositions:**
- Can change any parameter after creation
- Changes affect all nested instances

### Shape Layer Limitations

Shape layers have complex property hierarchies:
- Must navigate through Contents group
- Transform properties nested within shape groups
- Some properties may be hidden initially

When shape operations fail with "property is hidden" error, the layer structure may need manual adjustment or different approach.

### Pre-built Templates

**Lower thirds** (create_lower_third):
- Styles: modern, corporate, news, minimal, social
- Position: bottomLeft, bottomRight, bottomCenter
- Automatically creates text and animated background

**Title cards** (create_title_card):
- Styles: cinematic, documentary, social, minimal
- Full-screen animated title sequences

**Transitions** (create_transition):
- Types: wipe_left, wipe_right, wipe_up, wipe_down, dissolve, push, slide, zoom
- Duration and easing customizable

**Logo reveals** (create_logo_reveal):
- Requires imported logo footage
- Styles: fade, scale, slide, spin, glitch, particle

### Expression Best Practices

1. **Use templates when possible**: apply_expression_template provides tested, working expressions
2. **Property references**: Use `thisLayer.transform.position` not just `position`
3. **Time-based**: Use `time` variable for continuous animation
4. **Value references**: Use `value` to reference current property value

### Common Errors and Solutions

**"Property not found"**
- Verify exact property name spelling
- Check if property path includes parent groups
- Use get_layer_info to see available properties

**"Value is not an array"**
- Check value format matches property type
- Scale requires array: `[100, 100]`
- Position can use object or array

**"Property is hidden"**
- Shape layer properties may be hidden initially
- Try different approach or manual layer setup
- Some properties only accessible after layer creation

**"File couldn't be opened for writing"**
- Provide full absolute path for save operations
- Mac: `/Users/username/path/to/file.aep`
- Windows: `C:/Users/username/path/to/file.aep`

## Project Organization Best Practices

1. **Layer naming**: Use descriptive names for easy reference
2. **Precomposing**: Group related layers into precomps for organization
3. **Markers**: Add markers for timing references and notes
4. **Work area**: Set work area to focus rendering on specific sections
5. **Project structure**: Organize footage into folders using organize_project_items (automatic by type/usage) or move_project_items (move named items into a nested folder path like "PRODUCT/AUDIOS", creating folders as needed)
6. **Reusing animated layers**: Prefer copy_layers over recreating layers manually — it goes through AE's real clipboard, so the copy is full fidelity (text animators, keyframes, expressions, masks, effects). Use timeOffset to retime the copies. Parent links survive when parent and children are copied in the same call. For text templates, the workflow is: copy_layers (keeps the animation) then set_text_content (swaps the words, keeps animators) — never recreate an animated text layer from scratch. The tool verifies the paste against the requested layers (a stale clipboard / focus glitch is detected, rolled back and retried automatically); if it still throws "the clipboard copy did not take", just retry the call — no parasite layers are left behind.
7. **Aligning/centering on the canvas**: Use align_layers instead of computing positions by hand — horizontal (left/center/right) and/or vertical (top/middle/bottom), optional padding from the edges. Several layers are treated as ONE group by default: the combined bounding box is aligned and everything moves by the same delta, so the layout between the layers is preserved (mode: "individual" aligns each separately). Bounds are the REAL rendered bounds (anchor point, scale, rotation and parenting accounted for; text measured via sourceRectAtTime), and animated positions are shifted keyframe by keyframe so the whole animation moves. For text/animated layers pass `time` to measure at a moment where the content is fully visible.
8. **Spacing groups of layers**: Use distribute_groups to lay out SEVERAL blocks along one axis in a single call — e.g. [title+subtitle] / [3 product images] / [CTA] stacked vertically. Each group is one block (combined bounding box, all its members move together, internal layout preserved). Pass `spacing` for a fixed gap in px between blocks (the whole arrangement is centered on the canvas by default; anchor: "first" keeps the first block in place), or omit it to equalize the middle gaps while the first and last blocks stay put (needs 3+ groups). Groups keep their current on-canvas order by default (order: "given" reorders them to match the array). Combine with align_layers for the other axis (e.g. distribute vertically, then center everything horizontally).
9. **Controlling a whole arrangement with one null**: Use create_group_controller to rig several layers (or groups) under ONE null placed at the center of their combined bounding box — no visual jump. The null is trimmed automatically to span the union of the controlled layers' in/out points and lands in the stack just above the topmost controlled layer (not at the top of the comp), so overlays above the group stay above the rig. Then animate the NULL only: its Scale resizes the entire arrangement with all spacings scaling proportionally (the manual way of "make this whole block 80% smaller"), its Position/Rotation moves/rotates everything as one. Layers already parented to another selected layer keep their rig; a layer parented to an outside layer is detached from it (reported in `detachedFromPreviousParent` — check it). Typical flow: distribute_groups to space the blocks, align_layers to center, create_group_controller to scale/animate the whole thing globally.
10. **Layer stacking order**: New layers (add_av_layer, add_solid_layer, copy_layers...) are always created at the top of the stack — guaranteed (add_av_layer explicitly forces the top spot, since AE's own API does not promise it for footage). Use reorder_layer to move them afterwards — e.g. reorder_layer(layerName: "BG", position: "bottom") to send a background behind everything.
11. **Retiming a layer**: modify_layer's startTime is a RIGID MOVE, like dragging the layer bar in the timeline: the layer AND all its keyframes (transforms, effects, text animators, markers, time remap) shift by the same delta, so entry/exit animations stay glued to the layer. This is THE way to reposition an animated block in time — one call, no per-property offset_keyframes needed (keep offset_keyframes for shifting ONE property relative to the layer). inPoint/outPoint are pure trims and never move keyframes. Pass shiftKeyframes: false for the legacy "move the bar only" behavior. Retiming many layers = one batch_execute of modify_layer steps.
12. **Repetitive operations**: Use batch_execute to run many tool calls in one round-trip instead of one call at a time (e.g. setting startTime on 13 audio layers = one batch of 13 modify_layer steps). Each step reports success/error individually. Keep batches under ~50 steps to stay within the 60s command timeout. Exception: many keyframes on ONE property is NOT a batch_execute job — use set_keyframes, which takes 100+ keys in a single step.
13. **Mixed text formatting** (AE 24.3+): A single text block can mix styles (e.g. one word in Bold Italic). get_layer_info only reports the FIRST character's style — use get_text_styles to see the real formatting runs, and set_text_style_range to style a substring (matchText) without touching the rest. Bold/italic are separate font instances in AE: prefer fontFamily "Montserrat" + fontStyle "Bold Italic" (validated against installed fonts) over guessing PostScript names. For superscripts (footnote asterisks, "2ᵉ", trademark signs): style the substring with a smaller fontSize plus baselineShift ≈ 30-50% of the base font size (positive = up). leading sets the line height in px of the lines containing the range (disables auto-leading on the layer).
14. **Timeline audit**: After retiming/building a sequence, run lint_timeline instead of checking screen by screen — one call flags gaps (blank screen), overlaps (2+ content layers visible at once) and fade anomalies (hard-cut: fade-out keys past the outPoint; invisible-tail: opacity at 0 before the outPoint). Pass excludeLayers with the permanent layers (BG, header/footer, music) and raise minOverlapDuration (~0.6) so intentional crossfades don't get flagged. Visibility follows opacity keyframes, not just in/out points. Each gap lists endsBefore/startsAfter layers → fix it with one modify_layer startTime (rigid move) on the right layer, then re-run the lint to confirm zero issues.
15. **Canvas overflow audit**: Text that is too wide for the frame (long localized titles, tracking/scale animators, a font swap) is invisible in list_layers and easy to miss frame by frame — run lint_layer_bounds on the comp instead. One call checks every text layer over its whole visible span (bounds follow anchor, scale, rotation, parents and text animators) and reports each layer crossing the canvas edge with the worst moment (time, px per side, comp-space bounds), the overflow spans and a `kind`: `constant` = outside for its whole life (a real layout bug: reduce fontSize by `worst.fitScale`, wrap the line with set_text_content, lower the tracking or shrink the layer scale), `entrance`/`exit` = only while sliding in/out (usually intentional — pass ignoreHead/ignoreTail ≈ 0.5-1s or ignoreOffScreen: true to drop them), `transient`/`mixed` = check the spans. Pass margin (px) for a title-safe zone, layerTypes: ["all"] to also check shapes/footage/precomps (solids/BGs are excluded by default because they overflow on purpose). Long comps: the call keeps itself under the timeout by raising the sampling step (sampleIntervalRaised: true) — re-run with rangeStart/rangeEnd or includeLayers around a suspect zone for a frame-precise pass. Fix, then re-run to confirm issueCount 0; render the worst time with get_composition_frame if you want to see it.
16. **Exporting / rendering**: Call get_render_queue first — it lists the Render Settings templates (Best Settings, Draft Settings...) and the Output Module templates, i.e. the quality/format presets available on this machine (e.g. "H.264 - Match Render Settings - 15 Mbps", "Lossless", "Apple ProRes 422 HQ", user-saved ones). Then render_composition with the exact template name as outputModuleTemplate and the destination as outputPath (a folder → file named after the comp with the preset's extension, or a full file path; folders are created, existing files overwritten). timeSpan: comp (default) / workArea / custom with startTime+endTime — ideal to export a 3s preview of a section. mode render (default) renders INSIDE After Effects and blocks AE and the server until it finishes (the call waits up to timeoutSeconds, default 600 — raise it for long comps); it returns status DONE plus file size. mode ame sends the item to Adobe Media Encoder (non-blocking, best for long H.264 deliveries); mode queue only adds the item for the user to render. A wrong template name fails fast and lists the available ones. Other queued items are paused during the export and restored after. Templates cannot be created by script: if a needed preset is missing, ask the user to save it once in AE (Render Queue → Output Module → Make Template).

## Animation Timing Guidelines

**Duration by content type:**
- UI animations: 0.3-0.5 seconds
- Text reveals: 0.5-1.5 seconds
- Logo animations: 1-3 seconds
- Full title cards: 3-5 seconds
- Transitions: 0.5-1.5 seconds

**Easing recommendations:**
- Natural motion: Easy Ease (both)
- Bouncy entrance: Ease Out with overshoot
- Snappy exit: Ease In
- Continuous loop: Linear

## Common Use Cases

### Social Media Graphics
1. Create 1080x1920 (portrait) or 1920x1080 (landscape) comp
2. Add branded colors and text
3. Use quick animations (0.3-0.8s)
4. Apply modern, bold styles

### Corporate Videos
1. Create 1920x1080 comp at 30fps
2. Use corporate/professional templates
3. Longer, smoother animations (1-2s)
4. Professional color grading effects

### Motion Graphics Loops
1. Set looping expressions on properties
2. Use modulo operations for seamless loops
3. Match first and last frames
4. Time remap for speed variations

### Explainer Animations
1. Build scene sequentially
2. Use text animators for callouts
3. Coordinate timing with markers
4. Parent layers for grouped motion

## Performance Considerations

- Complex expressions can slow preview
- Disable expressions during editing if needed
- Use proxies for heavy footage
- Reduce composition complexity when possible
- Pre-render complex sections

## Integration Tips

When working with imported footage:
1. Use import_footage for single files
2. Use import_folder for batches
3. Replace footage items with replace_footage
4. Find missing footage with find_missing_footage
5. Collect files before sharing: collect_files

## Quick Reference: Most Used Functions

**Essential:**
- create_project, save_project
- create_composition
- add_text_layer, add_shape_layer, add_solid_layer
- set_keyframe, apply_easy_ease
- save_project

**Animation:**
- set_keyframe_advanced
- apply_expression_template
- create_text_animator

**Effects:**
- apply_effect_template
- modify_effect_properties

**Templates:**
- create_lower_third
- create_title_card
- create_transition

**Organization:**
- list_compositions, list_layers
- get_composition_info, get_layer_info
- precompose_layers

**Visual feedback:**
- get_composition_frame — renders a frame of a composition and returns it as an image. Use it after making visual changes to see the actual result and catch layout, color, or timing mistakes.
- lint_timeline — one-call audit of gaps, overlaps and fade anomalies over a whole comp.
- lint_layer_bounds — one-call audit of text (or any) layers going outside the canvas / safe area at any time, with the worst moment and a fitScale to fix it.

**Export:**
- get_render_queue — lists the render queue and the available Render Settings / Output Module presets (quality/format templates)
- render_composition — export a comp to a folder or file path with a chosen preset, whole comp / work area / custom range; renders in AE (blocking), queues only, or sends to Media Encoder