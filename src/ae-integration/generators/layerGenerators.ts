/**
 * Layer-related Script Generators
 *
 * Generates ES3-compatible ExtendScript for layer operations.
 */

import {
  escapeString,
  generateProjectCheck,
  generateCompAccess,
  generateLayerAccess,
  colorToES3,
  positionToES3,
  arrayToES3,
  wrapInUndoGroup,
  generateResultObject,
  generateJustification,
  generateBlendMode,
  generateLightType,
  generateCameraType
} from './helpers.js';

/**
 * Generate script to add a solid layer
 */
export function generateAddSolidLayer(params: {
  compId?: number;
  compName?: string;
  name: string;
  color: { r: number; g: number; b: number };
  width?: number;
  height?: number;
  duration?: number;
  startTime?: number;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  const width = params.width || 'comp.width';
  const height = params.height || 'comp.height';

  script += 'var solidWidth = ' + width + ';\n';
  script += 'var solidHeight = ' + height + ';\n';
  script += 'var layer = comp.layers.addSolid(\n';
  script += '  ' + colorToES3(params.color) + ',\n';
  script += '  "' + escapeString(params.name) + '",\n';
  script += '  solidWidth,\n';
  script += '  solidHeight,\n';
  script += '  1\n'; // pixel aspect ratio
  script += ');\n';

  if (params.duration !== undefined) {
    script += 'layer.outPoint = layer.inPoint + ' + params.duration + ';\n';
  }
  if (params.startTime !== undefined) {
    script += 'layer.startTime = ' + params.startTime + ';\n';
  }

  script += generateResultObject({
    index: 'layer.index',
    name: 'layer.name',
    inPoint: 'layer.inPoint',
    outPoint: 'layer.outPoint'
  });

  return wrapInUndoGroup(script, 'Add Solid Layer');
}

/**
 * Generate script to add a text layer
 */
export function generateAddTextLayer(params: {
  compId?: number;
  compName?: string;
  text: string;
  name?: string;
  position?: { x: number; y: number };
  fontSize?: number;
  fontFamily?: string;
  color?: { r: number; g: number; b: number };
  justification?: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'var layer = comp.layers.addText("' + escapeString(params.text) + '");\n';

  if (params.name) {
    script += 'layer.name = "' + escapeString(params.name) + '";\n';
  }

  // Get text document for styling
  script += 'var textProp = layer.property("Source Text");\n';
  script += 'var textDoc = textProp.value;\n';

  if (params.fontSize) {
    script += 'textDoc.fontSize = ' + params.fontSize + ';\n';
  }
  if (params.fontFamily) {
    script += 'textDoc.font = "' + escapeString(params.fontFamily) + '";\n';
  }
  if (params.color) {
    script += 'textDoc.fillColor = ' + colorToES3(params.color) + ';\n';
  }
  if (params.justification) {
    script += 'textDoc.justification = ' + generateJustification(params.justification) + ';\n';
  }

  script += 'textProp.setValue(textDoc);\n';

  // addText() drops the layer wherever AE decides, anchored on the text
  // baseline — unlike layers.add(sourceItem) which AE auto-centers. Center
  // the anchor on the text's real bounding box so `position` means "center
  // of the text block", and default that position to the comp center.
  script += 'var __r = layer.sourceRectAtTime(comp.time, false);\n';
  script += 'layer.property("Anchor Point").setValue([__r.left + __r.width / 2, __r.top + __r.height / 2]);\n';
  if (params.position) {
    script += 'layer.property("Position").setValue(' + positionToES3(params.position) + ');\n';
  } else {
    script += 'layer.property("Position").setValue([comp.width / 2, comp.height / 2]);\n';
  }

  script += generateResultObject({
    index: 'layer.index',
    name: 'layer.name',
    text: '"' + escapeString(params.text) + '"'
  });

  return wrapInUndoGroup(script, 'Add Text Layer');
}

/**
 * Generate script to add an advanced text layer with more options
 */
export function generateAddTextLayerAdvanced(params: {
  compId?: number;
  compName?: string;
  text: string;
  name?: string;
  position?: { x: number; y: number };
  fontSize?: number;
  fontFamily?: string;
  color?: { r: number; g: number; b: number };
  justification?: string;
  tracking?: number;
  leading?: number;
  baselineShift?: number;
  strokeColor?: { r: number; g: number; b: number };
  strokeWidth?: number;
  strokeOverFill?: boolean;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'var layer = comp.layers.addText("' + escapeString(params.text) + '");\n';

  if (params.name) {
    script += 'layer.name = "' + escapeString(params.name) + '";\n';
  }

  script += 'var textProp = layer.property("Source Text");\n';
  script += 'var textDoc = textProp.value;\n';

  if (params.fontSize) {
    script += 'textDoc.fontSize = ' + params.fontSize + ';\n';
  }
  if (params.fontFamily) {
    script += 'textDoc.font = "' + escapeString(params.fontFamily) + '";\n';
  }
  if (params.color) {
    script += 'textDoc.fillColor = ' + colorToES3(params.color) + ';\n';
  }
  if (params.justification) {
    script += 'textDoc.justification = ' + generateJustification(params.justification) + ';\n';
  }
  if (params.tracking !== undefined) {
    script += 'textDoc.tracking = ' + params.tracking + ';\n';
  }
  if (params.leading !== undefined) {
    script += 'textDoc.leading = ' + params.leading + ';\n';
  }
  if (params.baselineShift !== undefined) {
    script += 'textDoc.baselineShift = ' + params.baselineShift + ';\n';
  }
  if (params.strokeColor) {
    script += 'textDoc.applyStroke = true;\n';
    script += 'textDoc.strokeColor = ' + colorToES3(params.strokeColor) + ';\n';
  }
  if (params.strokeWidth !== undefined) {
    script += 'textDoc.strokeWidth = ' + params.strokeWidth + ';\n';
  }
  if (params.strokeOverFill !== undefined) {
    script += 'textDoc.strokeOverFill = ' + params.strokeOverFill + ';\n';
  }

  script += 'textProp.setValue(textDoc);\n';

  // Same centering as generateAddTextLayer: anchor on the text's bounding
  // box, position defaulting to the comp center (see comment there).
  script += 'var __r = layer.sourceRectAtTime(comp.time, false);\n';
  script += 'layer.property("Anchor Point").setValue([__r.left + __r.width / 2, __r.top + __r.height / 2]);\n';
  if (params.position) {
    script += 'layer.property("Position").setValue(' + positionToES3(params.position) + ');\n';
  } else {
    script += 'layer.property("Position").setValue([comp.width / 2, comp.height / 2]);\n';
  }

  script += generateResultObject({
    index: 'layer.index',
    name: 'layer.name',
    text: '"' + escapeString(params.text) + '"'
  });

  return wrapInUndoGroup(script, 'Add Text Layer');
}

/**
 * Generate script to add a shape layer
 */
export function generateAddShapeLayer(params: {
  compId?: number;
  compName?: string;
  name?: string;
  shape?: string;
  size?: { width: number; height: number };
  position?: { x: number; y: number };
  fillColor?: { r: number; g: number; b: number };
  strokeColor?: { r: number; g: number; b: number };
  strokeWidth?: number;
  points?: number;
  innerRadius?: number;
  outerRadius?: number;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'var layer = comp.layers.addShape();\n';

  if (params.name) {
    script += 'layer.name = "' + escapeString(params.name) + '";\n';
  }

  // Add shape content
  script += 'var contents = layer.property("Contents");\n';
  script += 'var shapeGroup = contents.addProperty("ADBE Vector Group");\n';
  script += 'var shapeContents = shapeGroup.property("Contents");\n';

  const shape = params.shape || 'rectangle';
  const sizeW = params.size?.width || 200;
  const sizeH = params.size?.height || 200;

  if (shape === 'rectangle') {
    script += 'var rect = shapeContents.addProperty("ADBE Vector Shape - Rect");\n';
    script += 'rect.property("Size").setValue([' + sizeW + ', ' + sizeH + ']);\n';
  } else if (shape === 'ellipse') {
    script += 'var ellipse = shapeContents.addProperty("ADBE Vector Shape - Ellipse");\n';
    script += 'ellipse.property("Size").setValue([' + sizeW + ', ' + sizeH + ']);\n';
  } else if (shape === 'polygon') {
    script += 'var poly = shapeContents.addProperty("ADBE Vector Shape - Star");\n';
    script += 'poly.property("Type").setValue(1);\n'; // polygon
    script += 'poly.property("Points").setValue(' + (params.points || 6) + ');\n';
    script += 'poly.property("Outer Radius").setValue(' + (params.outerRadius || 100) + ');\n';
  } else if (shape === 'star') {
    script += 'var star = shapeContents.addProperty("ADBE Vector Shape - Star");\n';
    script += 'star.property("Type").setValue(2);\n'; // star
    script += 'star.property("Points").setValue(' + (params.points || 5) + ');\n';
    script += 'star.property("Outer Radius").setValue(' + (params.outerRadius || 100) + ');\n';
    script += 'star.property("Inner Radius").setValue(' + (params.innerRadius || 50) + ');\n';
  }

  // Add fill
  if (params.fillColor) {
    script += 'var fill = shapeContents.addProperty("ADBE Vector Graphic - Fill");\n';
    script += 'fill.property("Color").setValue(' + colorToES3(params.fillColor) + ');\n';
  }

  // Add stroke
  if (params.strokeColor) {
    script += 'var stroke = shapeContents.addProperty("ADBE Vector Graphic - Stroke");\n';
    script += 'stroke.property("Color").setValue(' + colorToES3(params.strokeColor) + ');\n';
    if (params.strokeWidth !== undefined) {
      script += 'stroke.property("Stroke Width").setValue(' + params.strokeWidth + ');\n';
    }
  }

  // Position
  if (params.position) {
    script += 'layer.property("Position").setValue(' + positionToES3(params.position) + ');\n';
  } else {
    // Center in comp
    script += 'layer.property("Position").setValue([comp.width/2, comp.height/2]);\n';
  }

  script += generateResultObject({
    index: 'layer.index',
    name: 'layer.name'
  });

  return wrapInUndoGroup(script, 'Add Shape Layer');
}

/**
 * Generate script to add a null layer
 */
export function generateAddNullLayer(params: {
  compId?: number;
  compName?: string;
  name?: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'var layer = comp.layers.addNull();\n';

  if (params.name) {
    script += 'layer.name = "' + escapeString(params.name) + '";\n';
  }

  script += generateResultObject({
    index: 'layer.index',
    name: 'layer.name'
  });

  return wrapInUndoGroup(script, 'Add Null Layer');
}

/**
 * Generate script to add an adjustment layer
 */
export function generateAddAdjustmentLayer(params: {
  compId?: number;
  compName?: string;
  name?: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  // Create solid and set as adjustment layer
  script += 'var layer = comp.layers.addSolid(\n';
  script += '  [1, 1, 1],\n';
  script += '  "' + escapeString(params.name || 'Adjustment Layer') + '",\n';
  script += '  comp.width,\n';
  script += '  comp.height,\n';
  script += '  1\n';
  script += ');\n';
  script += 'layer.adjustmentLayer = true;\n';

  script += generateResultObject({
    index: 'layer.index',
    name: 'layer.name'
  });

  return wrapInUndoGroup(script, 'Add Adjustment Layer');
}

/**
 * Generate script to add a camera layer
 */
export function generateAddCameraLayer(params: {
  compId?: number;
  compName?: string;
  name?: string;
  type?: string;
  zoom?: number;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  const cameraType = params.type || 'ONE_NODE';
  script += 'var layer = comp.layers.addCamera(\n';
  script += '  "' + escapeString(params.name || 'Camera') + '",\n';
  script += '  [comp.width/2, comp.height/2]\n';
  script += ');\n';

  // Set camera type
  if (cameraType === 'TWO_NODE') {
    script += 'layer.autoOrient = AutoOrientType.ALONG_PATH;\n';
  }

  if (params.zoom) {
    script += 'layer.property("Camera Options").property("Zoom").setValue(' + params.zoom + ');\n';
  }

  script += generateResultObject({
    index: 'layer.index',
    name: 'layer.name'
  });

  return wrapInUndoGroup(script, 'Add Camera Layer');
}

/**
 * Generate script to add a light layer
 */
export function generateAddLightLayer(params: {
  compId?: number;
  compName?: string;
  name?: string;
  type?: string;
  color?: { r: number; g: number; b: number };
  intensity?: number;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  const lightType = params.type || 'POINT';
  script += 'var layer = comp.layers.addLight(\n';
  script += '  "' + escapeString(params.name || 'Light') + '",\n';
  script += '  [comp.width/2, comp.height/2]\n';
  script += ');\n';

  script += 'layer.lightType = ' + generateLightType(lightType) + ';\n';

  if (params.color) {
    script += 'layer.property("Light Options").property("Color").setValue(' + colorToES3(params.color) + ');\n';
  }
  if (params.intensity !== undefined) {
    script += 'layer.property("Light Options").property("Intensity").setValue(' + params.intensity + ');\n';
  }

  script += generateResultObject({
    index: 'layer.index',
    name: 'layer.name'
  });

  return wrapInUndoGroup(script, 'Add Light Layer');
}

/**
 * Generate script to add an AV (audio/video) layer from project item
 */
export function generateAddAVLayer(params: {
  compId?: number;
  compName?: string;
  itemId?: number;
  itemName?: string;
  startTime?: number;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  // Find the source item
  if (params.itemId) {
    script += 'var sourceItem = app.project.itemByID(' + params.itemId + ');\n';
    script += 'if (!sourceItem) {\n';
    script += '  throw new Error("Item not found with ID: ' + params.itemId + '");\n';
    script += '}\n';
  } else if (params.itemName) {
    script += 'var sourceItem = null;\n';
    script += 'for (var i = 1; i <= app.project.numItems; i++) {\n';
    script += '  if (app.project.item(i).name === "' + escapeString(params.itemName) + '") {\n';
    script += '    sourceItem = app.project.item(i);\n';
    script += '    break;\n';
    script += '  }\n';
    script += '}\n';
    script += 'if (!sourceItem) {\n';
    script += '  throw new Error("Item not found: ' + escapeString(params.itemName) + '");\n';
    script += '}\n';
  } else {
    script += 'throw new Error("itemId or itemName must be provided");\n';
  }

  script += 'var layer = comp.layers.add(sourceItem);\n';

  // addText()/addSolid() always land at index 1, but layers.add() gives no
  // such guarantee — force the top of the stack so every creation tool
  // behaves the same (use reorder_layer to move the layer afterwards).
  script += 'if (layer.index !== 1) {\n';
  script += '  layer.moveToBeginning();\n';
  script += '}\n';

  if (params.startTime !== undefined) {
    script += 'layer.startTime = ' + params.startTime + ';\n';
  }

  script += generateResultObject({
    index: 'layer.index',
    name: 'layer.name',
    source: 'sourceItem.name'
  });

  return wrapInUndoGroup(script, 'Add AV Layer');
}

/**
 * Generate script to precompose layers
 */
export function generatePrecomposeLayers(params: {
  compId?: number;
  compName?: string;
  layerIndices: number[];
  name: string;
  moveAttributes?: boolean;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'var layerIndices = ' + arrayToES3(params.layerIndices) + ';\n';
  script += 'var precompName = "' + escapeString(params.name) + '";\n';
  script += 'var moveAttributes = ' + (params.moveAttributes !== false) + ';\n';

  // Precompose
  script += 'var precompLayer = comp.layers.precompose(layerIndices, precompName, moveAttributes);\n';

  script += generateResultObject({
    index: 'precompLayer.index',
    name: 'precompLayer.name',
    sourceCompId: 'precompLayer.source.id'
  });

  return wrapInUndoGroup(script, 'Precompose Layers');
}

/**
 * Generate script to modify layer properties
 */
export function generateModifyLayer(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  name?: string;
  enabled?: boolean;
  solo?: boolean;
  shy?: boolean;
  locked?: boolean;
  inPoint?: number;
  outPoint?: number;
  startTime?: number;
  stretch?: number;
  blendMode?: string;
  parent?: number;
  is3D?: boolean;
  position?: { x: number; y: number; z?: number };
  scale?: number[];
  rotation?: number;
  opacity?: number;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);

  if (params.name !== undefined) {
    script += 'layer.name = "' + escapeString(params.name) + '";\n';
  }
  if (params.enabled !== undefined) {
    script += 'layer.enabled = ' + params.enabled + ';\n';
  }
  if (params.solo !== undefined) {
    script += 'layer.solo = ' + params.solo + ';\n';
  }
  if (params.shy !== undefined) {
    script += 'layer.shy = ' + params.shy + ';\n';
  }
  if (params.locked !== undefined) {
    script += 'layer.locked = ' + params.locked + ';\n';
  }
  if (params.inPoint !== undefined) {
    script += 'layer.inPoint = ' + params.inPoint + ';\n';
  }
  if (params.outPoint !== undefined) {
    script += 'layer.outPoint = ' + params.outPoint + ';\n';
  }
  if (params.startTime !== undefined) {
    script += 'layer.startTime = ' + params.startTime + ';\n';
  }
  if (params.stretch !== undefined) {
    script += 'layer.stretch = ' + params.stretch + ';\n';
  }
  if (params.blendMode !== undefined) {
    script += 'layer.blendingMode = ' + generateBlendMode(params.blendMode) + ';\n';
  }
  if (params.parent !== undefined) {
    if (params.parent === 0) {
      script += 'layer.parent = null;\n';
    } else {
      script += 'layer.parent = comp.layer(' + params.parent + ');\n';
    }
  }
  if (params.is3D !== undefined) {
    script += 'layer.threeDLayer = ' + params.is3D + ';\n';
  }
  if (params.position) {
    script += 'layer.property("Position").setValue(' + positionToES3(params.position) + ');\n';
  }
  if (params.scale) {
    script += 'layer.property("Scale").setValue(' + arrayToES3(params.scale) + ');\n';
  }
  if (params.rotation !== undefined) {
    script += 'layer.property("Rotation").setValue(' + params.rotation + ');\n';
  }
  if (params.opacity !== undefined) {
    script += 'layer.property("Opacity").setValue(' + params.opacity + ');\n';
  }

  script += generateResultObject({
    index: 'layer.index',
    name: 'layer.name'
  });

  return wrapInUndoGroup(script, 'Modify Layer');
}

/**
 * Generate script to delete a layer
 */
export function generateDeleteLayer(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);

  script += 'var deletedName = layer.name;\n';
  script += 'layer.remove();\n';

  script += generateResultObject({
    success: 'true',
    deleted: 'deletedName'
  });

  return wrapInUndoGroup(script, 'Delete Layer');
}

const CHARACTER_RANGE_GUARD =
  'if (typeof textDoc.characterRange !== "function") {\n' +
  '  throw new Error("Per-character text styling requires After Effects 24.3+ (characterRange API not available in this version)");\n' +
  '}\n';

/**
 * Generate script to read per-character style runs of a text layer.
 * Requires AE 24.3+ (TextDocument.characterRange API).
 */
export function generateGetTextStyles(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);

  script += 'if (!(layer instanceof TextLayer)) {\n';
  script += '  throw new Error("Layer is not a text layer: " + layer.name);\n';
  script += '}\n';
  script += 'var textDoc = layer.property("Source Text").value;\n';
  script += CHARACTER_RANGE_GUARD;
  script += 'var fullText = textDoc.text;\n';

  // Read each character's style and group consecutive identical ones into runs
  script += 'var runs = [];\n';
  script += 'var prevKey = null;\n';
  script += 'for (var ci = 0; ci < fullText.length; ci++) {\n';
  script += '  var cr = textDoc.characterRange(ci, ci + 1);\n';
  script += '  var st = {};\n';
  script += '  try { st.font = cr.font; } catch (e1) {}\n';
  script += '  try {\n';
  script += '    if (cr.fontObject) {\n';
  script += '      st.fontFamily = cr.fontObject.familyName;\n';
  script += '      st.fontStyle = cr.fontObject.styleName;\n';
  script += '    }\n';
  script += '  } catch (e2) {}\n';
  script += '  try { st.fontSize = cr.fontSize; } catch (e3) {}\n';
  script += '  try {\n';
  script += '    if (cr.applyFill) {\n';
  script += '      st.fillColor = [cr.fillColor[0], cr.fillColor[1], cr.fillColor[2]];\n';
  script += '    }\n';
  script += '  } catch (e4) {}\n';
  script += '  try {\n';
  script += '    if (cr.applyStroke) {\n';
  script += '      st.strokeColor = [cr.strokeColor[0], cr.strokeColor[1], cr.strokeColor[2]];\n';
  script += '      st.strokeWidth = cr.strokeWidth;\n';
  script += '    }\n';
  script += '  } catch (e5) {}\n';
  script += '  try { st.fauxBold = cr.fauxBold; } catch (e6) {}\n';
  script += '  try { st.fauxItalic = cr.fauxItalic; } catch (e7) {}\n';
  script += '  try { st.tracking = cr.tracking; } catch (e8) {}\n';
  script += '  var key = "";\n';
  script += '  for (var k in st) {\n';
  script += '    if (st.hasOwnProperty(k)) key += k + "=" + st[k] + ";";\n';
  script += '  }\n';
  script += '  if (prevKey !== null && key === prevKey) {\n';
  script += '    var lastRun = runs[runs.length - 1];\n';
  script += '    lastRun.end = ci + 1;\n';
  script += '    lastRun.text += fullText.charAt(ci);\n';
  script += '  } else {\n';
  script += '    var newRun = { start: ci, end: ci + 1, text: fullText.charAt(ci) };\n';
  script += '    for (var k2 in st) {\n';
  script += '      if (st.hasOwnProperty(k2)) newRun[k2] = st[k2];\n';
  script += '    }\n';
  script += '    runs.push(newRun);\n';
  script += '  }\n';
  script += '  prevKey = key;\n';
  script += '}\n';

  script += generateResultObject({
    layerName: 'layer.name',
    text: 'fullText',
    isMixed: 'runs.length > 1',
    runCount: 'runs.length',
    runs: 'runs'
  });

  return script;
}

/**
 * Generate script to replace the text content of an existing text layer.
 * Text animators, keyframes, expressions and layer styling are untouched —
 * they live on the layer, not in the TextDocument.
 */
export function generateSetTextContent(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  text: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);

  script += 'if (!(layer instanceof TextLayer)) {\n';
  script += '  throw new Error("Layer is not a text layer: " + layer.name);\n';
  script += '}\n';
  script += 'var textProp = layer.property("Source Text");\n';
  script += 'var textDoc = textProp.value;\n';
  script += 'var previousText = textDoc.text;\n';
  script += 'textDoc.text = "' + escapeString(params.text) + '";\n';
  script += 'textProp.setValue(textDoc);\n';

  script += generateResultObject({
    success: 'true',
    layerName: 'layer.name',
    previousText: 'previousText',
    text: '"' + escapeString(params.text) + '"'
  });

  return wrapInUndoGroup(script, 'Set Text Content');
}

/**
 * Generate script to style a character range inside a text layer.
 * Requires AE 24.3+ (TextDocument.characterRange API).
 */
export function generateSetTextStyleRange(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  startIndex?: number;
  endIndex?: number;
  matchText?: string;
  font?: string;
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
  fillColor?: { r: number; g: number; b: number };
  fauxBold?: boolean;
  fauxItalic?: boolean;
  tracking?: number;
}): string {
  const hasIndexRange = params.startIndex !== undefined && params.endIndex !== undefined;
  if (!hasIndexRange && params.matchText === undefined) {
    throw new Error('Provide either matchText or startIndex + endIndex to select the character range');
  }
  const hasStyle = params.font !== undefined || params.fontFamily !== undefined ||
    params.fontSize !== undefined || params.fillColor !== undefined ||
    params.fauxBold !== undefined || params.fauxItalic !== undefined ||
    params.tracking !== undefined;
  if (!hasStyle) {
    throw new Error('Provide at least one style property (font, fontFamily/fontStyle, fontSize, fillColor, fauxBold, fauxItalic, tracking)');
  }
  if (params.fontFamily !== undefined && params.fontStyle === undefined) {
    throw new Error('fontFamily requires fontStyle (e.g. "Bold Italic"); alternatively use font with a PostScript name');
  }

  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);

  script += 'if (!(layer instanceof TextLayer)) {\n';
  script += '  throw new Error("Layer is not a text layer: " + layer.name);\n';
  script += '}\n';
  script += 'var textProp = layer.property("Source Text");\n';
  script += 'var textDoc = textProp.value;\n';
  script += CHARACTER_RANGE_GUARD;
  script += 'var fullText = textDoc.text;\n';

  if (params.matchText !== undefined) {
    script += 'var startIdx = fullText.indexOf("' + escapeString(params.matchText) + '");\n';
    script += 'if (startIdx === -1) {\n';
    script += '  throw new Error("Text not found in layer: ' + escapeString(params.matchText) + '");\n';
    script += '}\n';
    script += 'var endIdx = startIdx + ' + params.matchText.length + ';\n';
  } else {
    script += 'var startIdx = ' + params.startIndex + ';\n';
    script += 'var endIdx = ' + params.endIndex + ';\n';
  }
  script += 'if (startIdx < 0 || endIdx > fullText.length || startIdx >= endIdx) {\n';
  script += '  throw new Error("Invalid character range " + startIdx + "-" + endIdx + " (text length: " + fullText.length + ")");\n';
  script += '}\n';

  script += 'var cr = textDoc.characterRange(startIdx, endIdx);\n';

  if (params.fontFamily !== undefined) {
    script += 'var matchedFonts = app.fonts.getFontsByFamilyNameAndStyleName("' +
      escapeString(params.fontFamily) + '", "' + escapeString(params.fontStyle as string) + '");\n';
    script += 'if (!matchedFonts || matchedFonts.length === 0) {\n';
    script += '  throw new Error("Font not installed: ' + escapeString(params.fontFamily) + ' ' + escapeString(params.fontStyle as string) + '");\n';
    script += '}\n';
    script += 'cr.fontObject = matchedFonts[0];\n';
  } else if (params.font !== undefined) {
    script += 'cr.font = "' + escapeString(params.font) + '";\n';
  }
  if (params.fontSize !== undefined) {
    script += 'cr.fontSize = ' + params.fontSize + ';\n';
  }
  if (params.fillColor !== undefined) {
    script += 'cr.applyFill = true;\n';
    script += 'cr.fillColor = ' + colorToES3(params.fillColor) + ';\n';
  }
  if (params.fauxBold !== undefined) {
    script += 'cr.fauxBold = ' + params.fauxBold + ';\n';
  }
  if (params.fauxItalic !== undefined) {
    script += 'cr.fauxItalic = ' + params.fauxItalic + ';\n';
  }
  if (params.tracking !== undefined) {
    script += 'cr.tracking = ' + params.tracking + ';\n';
  }

  // Write the styled document back; since AE 24.3 setValue preserves
  // per-character styling instead of flattening it
  script += 'textProp.setValue(textDoc);\n';

  script += generateResultObject({
    success: 'true',
    layerName: 'layer.name',
    start: 'startIdx',
    end: 'endIdx',
    styledText: 'fullText.substring(startIdx, endIdx)'
  });

  return wrapInUndoGroup(script, 'Set Text Style Range');
}

/**
 * Generate script to reorder a layer in the stacking order.
 */
export function generateReorderLayer(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  position: string;
  targetIndex?: number;
  referenceLayerIndex?: number;
  referenceLayerName?: string;
}): string {
  const needsReference = params.position === 'before' || params.position === 'after';
  if (needsReference &&
      params.referenceLayerIndex === undefined && params.referenceLayerName === undefined) {
    throw new Error('position "' + params.position + '" requires referenceLayerIndex or referenceLayerName');
  }
  if (params.position === 'index' && params.targetIndex === undefined) {
    throw new Error('position "index" requires targetIndex');
  }

  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += generateLayerAccess('comp', params.layerIndex, params.layerName);
  script += 'var moveLayer = layer;\n';

  if (needsReference) {
    script += generateLayerAccess('comp', params.referenceLayerIndex, params.referenceLayerName);
    script += 'var refLayer = layer;\n';
    script += 'if (refLayer === moveLayer) {\n';
    script += '  throw new Error("Reference layer and layer to move are the same");\n';
    script += '}\n';
  }

  if (params.position === 'top') {
    script += 'moveLayer.moveToBeginning();\n';
  } else if (params.position === 'bottom') {
    script += 'moveLayer.moveToEnd();\n';
  } else if (params.position === 'before') {
    script += 'moveLayer.moveBefore(refLayer);\n';
  } else if (params.position === 'after') {
    script += 'moveLayer.moveAfter(refLayer);\n';
  } else if (params.position === 'index') {
    script += 'var t = ' + params.targetIndex + ';\n';
    script += 'if (t <= 1) {\n';
    script += '  moveLayer.moveToBeginning();\n';
    script += '} else if (t >= comp.numLayers) {\n';
    script += '  moveLayer.moveToEnd();\n';
    script += '} else if (moveLayer.index < t) {\n';
    script += '  moveLayer.moveAfter(comp.layer(t));\n';
    script += '} else if (moveLayer.index > t) {\n';
    script += '  moveLayer.moveBefore(comp.layer(t));\n';
    script += '}\n';
  } else {
    throw new Error('Unknown position: ' + params.position);
  }

  script += generateResultObject({
    success: 'true',
    layerName: 'moveLayer.name',
    newIndex: 'moveLayer.index'
  });

  return wrapInUndoGroup(script, 'Reorder Layer');
}

/**
 * Emit the ES3 layer-to-comp geometry helpers shared by align_layers,
 * distribute_groups and create_group_controller. Expects a `comp` variable
 * and an `alignTime` variable to be defined before this block.
 * `tool` prefixes the error messages so failures name the right MCP tool.
 */
function emitGeometryHelpers(tool: string): string {
  let script = '';
  // Layer-to-comp geometry: walk the parent chain applying anchor/scale/
  // Z-rotation/position at each level (2D math; 3D X/Y rotations ignored).
  script += 'var __d2r = Math.PI / 180;\n';
  script += 'var __xf = function (lyr) {\n';
  script += '  var tr = lyr.property("ADBE Transform Group");\n';
  script += '  var a = tr.property("ADBE Anchor Point").valueAtTime(alignTime, false);\n';
  script += '  var p = tr.property("ADBE Position").valueAtTime(alignTime, false);\n';
  script += '  var s = tr.property("ADBE Scale").valueAtTime(alignTime, false);\n';
  script += '  var rp = tr.property("ADBE Rotate Z");\n';
  script += '  var r = rp ? rp.valueAtTime(alignTime, false) * __d2r : 0;\n';
  script += '  return { ax: a[0], ay: a[1], px: p[0], py: p[1], sx: s[0] / 100, sy: s[1] / 100, r: r };\n';
  script += '};\n';
  script += 'var __toComp = function (lyr, x, y) {\n';
  script += '  var cur = lyr;\n';
  script += '  var px = x, py = y;\n';
  script += '  while (cur) {\n';
  script += '    var f = __xf(cur);\n';
  script += '    var lx = (px - f.ax) * f.sx;\n';
  script += '    var ly = (py - f.ay) * f.sy;\n';
  script += '    var c = Math.cos(f.r), sn = Math.sin(f.r);\n';
  script += '    px = f.px + lx * c - ly * sn;\n';
  script += '    py = f.py + lx * sn + ly * c;\n';
  script += '    cur = cur.parent;\n';
  script += '  }\n';
  script += '  return [px, py];\n';
  script += '};\n';
  // Inverse of the parent chain's linear part, to convert a comp-space
  // delta into the layer's own position space (position lives in parent space).
  script += 'var __compDeltaToParent = function (lyr, dx, dy) {\n';
  script += '  var m00 = 1, m01 = 0, m10 = 0, m11 = 1;\n';
  script += '  var cur = lyr.parent;\n';
  script += '  while (cur) {\n';
  script += '    var f = __xf(cur);\n';
  script += '    var c = Math.cos(f.r), sn = Math.sin(f.r);\n';
  script += '    var a00 = c * f.sx, a01 = -sn * f.sy;\n';
  script += '    var a10 = sn * f.sx, a11 = c * f.sy;\n';
  script += '    var n00 = a00 * m00 + a01 * m10;\n';
  script += '    var n01 = a00 * m01 + a01 * m11;\n';
  script += '    var n10 = a10 * m00 + a11 * m10;\n';
  script += '    var n11 = a10 * m01 + a11 * m11;\n';
  script += '    m00 = n00; m01 = n01; m10 = n10; m11 = n11;\n';
  script += '    cur = cur.parent;\n';
  script += '  }\n';
  script += '  var det = m00 * m11 - m01 * m10;\n';
  script += '  if (det > -1e-9 && det < 1e-9) {\n';
  script += '    throw new Error("' + tool + ': layer " + lyr.name + " has a parent scaled to 0, cannot compute its move");\n';
  script += '  }\n';
  script += '  return [(m11 * dx - m01 * dy) / det, (m00 * dy - m10 * dx) / det];\n';
  script += '};\n';
  script += 'var __bounds = function (lyr) {\n';
  script += '  var rect = null;\n';
  script += '  try { rect = lyr.sourceRectAtTime(alignTime, false); } catch (eR) {}\n';
  script += '  if (!rect && lyr.source) {\n';
  script += '    rect = { left: 0, top: 0, width: lyr.source.width, height: lyr.source.height };\n';
  script += '  }\n';
  script += '  if (!rect) {\n';
  script += '    throw new Error("' + tool + ': cannot measure the bounds of layer " + lyr.name);\n';
  script += '  }\n';
  script += '  var corners = [[rect.left, rect.top], [rect.left + rect.width, rect.top], [rect.left, rect.top + rect.height], [rect.left + rect.width, rect.top + rect.height]];\n';
  script += '  var b = null;\n';
  script += '  for (var cI = 0; cI < 4; cI++) {\n';
  script += '    var pt = __toComp(lyr, corners[cI][0], corners[cI][1]);\n';
  script += '    if (!b) {\n';
  script += '      b = { minX: pt[0], minY: pt[1], maxX: pt[0], maxY: pt[1] };\n';
  script += '    } else {\n';
  script += '      if (pt[0] < b.minX) b.minX = pt[0];\n';
  script += '      if (pt[1] < b.minY) b.minY = pt[1];\n';
  script += '      if (pt[0] > b.maxX) b.maxX = pt[0];\n';
  script += '      if (pt[1] > b.maxY) b.maxY = pt[1];\n';
  script += '    }\n';
  script += '  }\n';
  script += '  return b;\n';
  script += '};\n';
  script += 'var __unionBounds = function (a, b) {\n';
  script += '  if (!a) return b;\n';
  script += '  if (b.minX < a.minX) a.minX = b.minX;\n';
  script += '  if (b.minY < a.minY) a.minY = b.minY;\n';
  script += '  if (b.maxX > a.maxX) a.maxX = b.maxX;\n';
  script += '  if (b.maxY > a.maxY) a.maxY = b.maxY;\n';
  script += '  return a;\n';
  script += '};\n';
  return script;
}

/**
 * Emit the ES3 helpers that move a layer by a comp-space delta, shifting
 * every position keyframe (separated dimensions included). Requires the
 * geometry helpers (emitGeometryHelpers) to be emitted first.
 */
function emitShiftHelpers(): string {
  let script = '';
  script += 'var __shiftDim = function (p, dd) {\n';
  script += '  if (!p) return;\n';
  script += '  if (p.numKeys > 0) {\n';
  script += '    for (var kk = 1; kk <= p.numKeys; kk++) {\n';
  script += '      p.setValueAtKey(kk, p.keyValue(kk) + dd);\n';
  script += '    }\n';
  script += '  } else {\n';
  script += '    p.setValue(p.value + dd);\n';
  script += '  }\n';
  script += '};\n';
  script += 'var __shift = function (lyr, dx, dy) {\n';
  script += '  var dp = __compDeltaToParent(lyr, dx, dy);\n';
  script += '  var tr = lyr.property("ADBE Transform Group");\n';
  script += '  var posProp = tr.property("ADBE Position");\n';
  script += '  if (posProp.dimensionsSeparated) {\n';
  script += '    __shiftDim(tr.property("ADBE Position_0"), dp[0]);\n';
  script += '    __shiftDim(tr.property("ADBE Position_1"), dp[1]);\n';
  script += '  } else if (posProp.numKeys > 0) {\n';
  script += '    for (var kk = 1; kk <= posProp.numKeys; kk++) {\n';
  script += '      var kv = posProp.keyValue(kk);\n';
  script += '      posProp.setValueAtKey(kk, kv.length > 2 ? [kv[0] + dp[0], kv[1] + dp[1], kv[2]] : [kv[0] + dp[0], kv[1] + dp[1]]);\n';
  script += '    }\n';
  script += '  } else {\n';
  script += '    var pv = posProp.value;\n';
  script += '    posProp.setValue(pv.length > 2 ? [pv[0] + dp[0], pv[1] + dp[1], pv[2]] : [pv[0] + dp[0], pv[1] + dp[1]]);\n';
  script += '  }\n';
  script += '};\n';
  return script;
}

/**
 * Generate script to align layers to the composition canvas.
 * Default mode treats the whole selection as ONE group: the combined
 * bounding box is aligned and every layer moves by the same delta, so the
 * relative layout inside the group is preserved. Bounds account for anchor
 * point, scale, Z rotation and parent chains; position keyframes are
 * offset along with the layer so animations move too.
 */
export function generateAlignLayers(params: {
  compId?: number;
  compName?: string;
  layerIndices?: number[];
  layerNames?: string[];
  horizontal?: string;
  vertical?: string;
  mode?: string;
  padding?: number;
  time?: number;
}): string {
  const horizontal = params.horizontal;
  const vertical = params.vertical;
  if (!horizontal && !vertical) {
    throw new Error('align_layers needs at least one of horizontal ("left"|"center"|"right") or vertical ("top"|"middle"|"bottom")');
  }
  if (horizontal && ['left', 'center', 'right'].indexOf(horizontal) === -1) {
    throw new Error('horizontal must be "left", "center" or "right"');
  }
  if (vertical && ['top', 'middle', 'bottom'].indexOf(vertical) === -1) {
    throw new Error('vertical must be "top", "middle" or "bottom"');
  }
  const mode = params.mode || 'group';
  if (mode !== 'group' && mode !== 'individual') {
    throw new Error('mode must be "group" or "individual"');
  }
  const padding = params.padding || 0;

  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'var layersToAlign = [];\n';
  script += 'var notFound = [];\n';

  if (params.layerIndices && params.layerIndices.length > 0) {
    script += 'var idxs = ' + arrayToES3(params.layerIndices) + ';\n';
    script += 'for (var d = 0; d < idxs.length; d++) {\n';
    script += '  if (idxs[d] >= 1 && idxs[d] <= comp.numLayers) {\n';
    script += '    layersToAlign.push(comp.layer(idxs[d]));\n';
    script += '  } else {\n';
    script += '    notFound.push("index:" + idxs[d]);\n';
    script += '  }\n';
    script += '}\n';
  }

  if (params.layerNames && params.layerNames.length > 0) {
    script += 'var names = ' + arrayToES3(params.layerNames) + ';\n';
    script += 'for (var n = 0; n < names.length; n++) {\n';
    script += '  var matched = false;\n';
    script += '  for (var i = 1; i <= comp.numLayers; i++) {\n';
    script += '    if (comp.layer(i).name === names[n]) {\n';
    script += '      layersToAlign.push(comp.layer(i));\n';
    script += '      matched = true;\n';
    script += '    }\n';
    script += '  }\n';
    script += '  if (!matched) {\n';
    script += '    notFound.push(names[n]);\n';
    script += '  }\n';
    script += '}\n';
  }

  script += 'if (notFound.length > 0) {\n';
  script += '  throw new Error("align_layers: layers not found: " + notFound.join(", "));\n';
  script += '}\n';
  script += 'if (layersToAlign.length === 0) {\n';
  script += '  throw new Error("align_layers: no layers to align (pass layerNames or layerIndices)");\n';
  script += '}\n';
  script += 'for (var cl = 0; cl < layersToAlign.length; cl++) {\n';
  script += '  if (layersToAlign[cl] instanceof CameraLayer || layersToAlign[cl] instanceof LightLayer) {\n';
  script += '    throw new Error("align_layers: layer " + layersToAlign[cl].name + " is a camera/light and has no bounds to align");\n';
  script += '  }\n';
  script += '}\n';

  script += 'var alignTime = ' + (params.time !== undefined ? params.time : 'comp.time') + ';\n';

  script += emitGeometryHelpers('align_layers');

  // The comp-space delta that aligns a bounding box to the canvas.
  script += 'var __pad = ' + padding + ';\n';
  script += 'var __deltaFor = function (b) {\n';
  script += '  var dx = 0, dy = 0;\n';
  if (horizontal === 'left') {
    script += '  dx = __pad - b.minX;\n';
  } else if (horizontal === 'center') {
    script += '  dx = (comp.width - (b.maxX - b.minX)) / 2 - b.minX;\n';
  } else if (horizontal === 'right') {
    script += '  dx = comp.width - __pad - b.maxX;\n';
  }
  if (vertical === 'top') {
    script += '  dy = __pad - b.minY;\n';
  } else if (vertical === 'middle') {
    script += '  dy = (comp.height - (b.maxY - b.minY)) / 2 - b.minY;\n';
  } else if (vertical === 'bottom') {
    script += '  dy = comp.height - __pad - b.maxY;\n';
  }
  script += '  return [dx, dy];\n';
  script += '};\n';

  // Apply a comp-space delta to a layer's Position, shifting every
  // keyframe when the position is animated (separated dimensions included).
  script += emitShiftHelpers();
  // A selected layer parented (directly or not) to another selected layer
  // already follows its parent's move — moving it too would double the shift.
  script += 'var __hasSelectedAncestor = function (lyr) {\n';
  script += '  var cur = lyr.parent;\n';
  script += '  while (cur) {\n';
  script += '    for (var q = 0; q < layersToAlign.length; q++) {\n';
  script += '      if (layersToAlign[q].index === cur.index) return true;\n';
  script += '    }\n';
  script += '    cur = cur.parent;\n';
  script += '  }\n';
  script += '  return false;\n';
  script += '};\n';

  script += 'var relockList = [];\n';
  script += 'for (var lk = 0; lk < layersToAlign.length; lk++) {\n';
  script += '  if (layersToAlign[lk].locked) {\n';
  script += '    layersToAlign[lk].locked = false;\n';
  script += '    relockList.push(layersToAlign[lk]);\n';
  script += '  }\n';
  script += '}\n';

  script += 'var alignedNames = [];\n';
  script += 'var groupDelta = null;\n';
  script += 'try {\n';
  if (mode === 'group') {
    script += '  var union = null;\n';
    script += '  for (var bb = 0; bb < layersToAlign.length; bb++) {\n';
    script += '    union = __unionBounds(union, __bounds(layersToAlign[bb]));\n';
    script += '  }\n';
    script += '  groupDelta = __deltaFor(union);\n';
    script += '  for (var mv = 0; mv < layersToAlign.length; mv++) {\n';
    script += '    if (__hasSelectedAncestor(layersToAlign[mv])) continue;\n';
    script += '    __shift(layersToAlign[mv], groupDelta[0], groupDelta[1]);\n';
    script += '    alignedNames.push(layersToAlign[mv].name);\n';
    script += '  }\n';
  } else {
    // Compute every delta first: moving a layer must not skew the
    // measurement of the next one (parented selections).
    script += '  var deltas = [];\n';
    script += '  for (var bb = 0; bb < layersToAlign.length; bb++) {\n';
    script += '    deltas.push(__deltaFor(__bounds(layersToAlign[bb])));\n';
    script += '  }\n';
    script += '  for (var mv = 0; mv < layersToAlign.length; mv++) {\n';
    script += '    __shift(layersToAlign[mv], deltas[mv][0], deltas[mv][1]);\n';
    script += '    alignedNames.push(layersToAlign[mv].name);\n';
    script += '  }\n';
  }
  script += '} finally {\n';
  script += '  for (var r = 0; r < relockList.length; r++) {\n';
  script += '    relockList[r].locked = true;\n';
  script += '  }\n';
  script += '}\n';

  script += generateResultObject({
    success: 'true',
    mode: '"' + mode + '"',
    alignedLayers: 'alignedNames',
    deltaX: 'groupDelta ? Math.round(groupDelta[0] * 100) / 100 : null',
    deltaY: 'groupDelta ? Math.round(groupDelta[1] * 100) / 100 : null'
  });

  return wrapInUndoGroup(script, 'Align Layers');
}

/**
 * Generate script to distribute GROUPS of layers along one axis.
 * Each group (a set of layers) is treated as one block: its combined
 * bounding box is measured and all its members move by the same delta.
 * Two modes: fixed spacing between consecutive blocks, or even
 * distribution (first and last blocks stay, middle gaps are equalized).
 */
export function generateDistributeGroups(params: {
  compId?: number;
  compName?: string;
  groups: Array<{ layerNames?: string[]; layerIndices?: number[] }>;
  axis: string;
  spacing?: number;
  anchor?: string;
  order?: string;
  time?: number;
}): string {
  if (!params.groups || params.groups.length < 2) {
    throw new Error('distribute_groups needs at least 2 groups');
  }
  for (let gi = 0; gi < params.groups.length; gi++) {
    const g = params.groups[gi];
    const hasNames = g.layerNames && g.layerNames.length > 0;
    const hasIdxs = g.layerIndices && g.layerIndices.length > 0;
    if (!hasNames && !hasIdxs) {
      throw new Error('distribute_groups: group ' + (gi + 1) + ' has no layerNames and no layerIndices');
    }
  }
  const axis = params.axis;
  if (axis !== 'horizontal' && axis !== 'vertical') {
    throw new Error('axis must be "horizontal" or "vertical"');
  }
  if (params.spacing !== undefined && typeof params.spacing !== 'number') {
    throw new Error('spacing must be a number (pixels between consecutive group boxes)');
  }
  if (params.spacing === undefined && params.groups.length < 3) {
    throw new Error('even distribution (no spacing) needs at least 3 groups — with 2 groups pass an explicit spacing');
  }
  const anchor = params.anchor || 'center';
  if (anchor !== 'center' && anchor !== 'first') {
    throw new Error('anchor must be "center" or "first"');
  }
  const order = params.order || 'position';
  if (order !== 'position' && order !== 'given') {
    throw new Error('order must be "position" or "given"');
  }
  const minProp = axis === 'horizontal' ? 'minX' : 'minY';
  const maxProp = axis === 'horizontal' ? 'maxX' : 'maxY';
  const axisLen = axis === 'horizontal' ? 'comp.width' : 'comp.height';

  let defsES3 = '[';
  for (let gi = 0; gi < params.groups.length; gi++) {
    const g = params.groups[gi];
    defsES3 += (gi > 0 ? ', ' : '') + '{ x: ' + arrayToES3(g.layerIndices || []) + ', n: ' + arrayToES3(g.layerNames || []) + ' }';
  }
  defsES3 += ']';

  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'var groupDefs = ' + defsES3 + ';\n';
  script += 'var groups = [];\n';
  script += 'var notFound = [];\n';
  script += 'for (var gi = 0; gi < groupDefs.length; gi++) {\n';
  script += '  var arr = [];\n';
  script += '  var gd = groupDefs[gi];\n';
  script += '  for (var d = 0; d < gd.x.length; d++) {\n';
  script += '    if (gd.x[d] >= 1 && gd.x[d] <= comp.numLayers) {\n';
  script += '      arr.push(comp.layer(gd.x[d]));\n';
  script += '    } else {\n';
  script += '      notFound.push("group " + (gi + 1) + " index:" + gd.x[d]);\n';
  script += '    }\n';
  script += '  }\n';
  script += '  for (var n = 0; n < gd.n.length; n++) {\n';
  script += '    var matched = false;\n';
  script += '    for (var i = 1; i <= comp.numLayers; i++) {\n';
  script += '      if (comp.layer(i).name === gd.n[n]) {\n';
  script += '        arr.push(comp.layer(i));\n';
  script += '        matched = true;\n';
  script += '      }\n';
  script += '    }\n';
  script += '    if (!matched) {\n';
  script += '      notFound.push("group " + (gi + 1) + " " + gd.n[n]);\n';
  script += '    }\n';
  script += '  }\n';
  script += '  groups.push(arr);\n';
  script += '}\n';
  script += 'if (notFound.length > 0) {\n';
  script += '  throw new Error("distribute_groups: layers not found: " + notFound.join(", "));\n';
  script += '}\n';
  script += 'for (var gc = 0; gc < groups.length; gc++) {\n';
  script += '  if (groups[gc].length === 0) {\n';
  script += '    throw new Error("distribute_groups: group " + (gc + 1) + " is empty");\n';
  script += '  }\n';
  script += '  for (var cl = 0; cl < groups[gc].length; cl++) {\n';
  script += '    if (groups[gc][cl] instanceof CameraLayer || groups[gc][cl] instanceof LightLayer) {\n';
  script += '      throw new Error("distribute_groups: layer " + groups[gc][cl].name + " is a camera/light and has no bounds");\n';
  script += '    }\n';
  script += '  }\n';
  script += '}\n';

  script += 'var alignTime = ' + (params.time !== undefined ? params.time : 'comp.time') + ';\n';
  script += emitGeometryHelpers('distribute_groups');
  script += emitShiftHelpers();

  // One bounding box per group, then reduce to a scalar (min + size) on the axis.
  script += 'var boxes = [];\n';
  script += 'for (var bb = 0; bb < groups.length; bb++) {\n';
  script += '  var union = null;\n';
  script += '  for (var bm = 0; bm < groups[bb].length; bm++) {\n';
  script += '    union = __unionBounds(union, __bounds(groups[bb][bm]));\n';
  script += '  }\n';
  script += '  boxes.push(union);\n';
  script += '}\n';
  script += 'var mins = [], sizes = [];\n';
  script += 'for (var bx = 0; bx < boxes.length; bx++) {\n';
  script += '  mins.push(boxes[bx].' + minProp + ');\n';
  script += '  sizes.push(boxes[bx].' + maxProp + ' - boxes[bx].' + minProp + ');\n';
  script += '}\n';

  script += 'var order = [];\n';
  script += 'for (var oi = 0; oi < groups.length; oi++) { order.push(oi); }\n';
  if (order === 'position') {
    // Process groups in their current on-canvas order so spacing does not reshuffle them.
    script += 'order.sort(function (a, b) { return (mins[a] + sizes[a] / 2) - (mins[b] + sizes[b] / 2); });\n';
  }

  script += 'var deltas = [];\n';
  script += 'for (var dz = 0; dz < groups.length; dz++) { deltas.push(0); }\n';
  if (params.spacing !== undefined) {
    script += 'var __gap = ' + params.spacing + ';\n';
    script += 'var totalSize = 0;\n';
    script += 'for (var ts = 0; ts < order.length; ts++) { totalSize += sizes[order[ts]]; }\n';
    script += 'var span = totalSize + __gap * (order.length - 1);\n';
    if (anchor === 'center') {
      script += 'var cursor = (' + axisLen + ' - span) / 2;\n';
    } else {
      script += 'var cursor = mins[order[0]];\n';
    }
    script += 'for (var pl = 0; pl < order.length; pl++) {\n';
    script += '  deltas[order[pl]] = cursor - mins[order[pl]];\n';
    script += '  cursor += sizes[order[pl]] + __gap;\n';
    script += '}\n';
  } else {
    // Even distribution: first and last blocks stay put, middle gaps equalize.
    script += 'var first = order[0], last = order[order.length - 1];\n';
    script += 'var middleSum = 0;\n';
    script += 'for (var ms = 1; ms < order.length - 1; ms++) { middleSum += sizes[order[ms]]; }\n';
    script += 'var avail = mins[last] - (mins[first] + sizes[first]);\n';
    script += 'var __gap = (avail - middleSum) / (order.length - 1);\n';
    script += 'var cursor = mins[first] + sizes[first] + __gap;\n';
    script += 'for (var pl = 1; pl < order.length - 1; pl++) {\n';
    script += '  deltas[order[pl]] = cursor - mins[order[pl]];\n';
    script += '  cursor += sizes[order[pl]] + __gap;\n';
    script += '}\n';
  }

  // Flatten to unique layers (a layer listed twice moves once), remembering
  // which group each belongs to so parented selections shift correctly.
  script += 'var flatL = [], flatG = [];\n';
  script += 'for (var fg = 0; fg < groups.length; fg++) {\n';
  script += '  for (var fm = 0; fm < groups[fg].length; fm++) {\n';
  script += '    var dup = false;\n';
  script += '    for (var fq = 0; fq < flatL.length; fq++) {\n';
  script += '      if (flatL[fq].index === groups[fg][fm].index) { dup = true; break; }\n';
  script += '    }\n';
  script += '    if (!dup) { flatL.push(groups[fg][fm]); flatG.push(fg); }\n';
  script += '  }\n';
  script += '}\n';
  script += 'var __groupOf = function (lyr) {\n';
  script += '  for (var q = 0; q < flatL.length; q++) {\n';
  script += '    if (flatL[q].index === lyr.index) return flatG[q];\n';
  script += '  }\n';
  script += '  return -1;\n';
  script += '};\n';
  script += 'var __nearestSelGroup = function (lyr) {\n';
  script += '  var cur = lyr.parent;\n';
  script += '  while (cur) {\n';
  script += '    var g = __groupOf(cur);\n';
  script += '    if (g >= 0) return g;\n';
  script += '    cur = cur.parent;\n';
  script += '  }\n';
  script += '  return -1;\n';
  script += '};\n';

  script += 'var relockList = [];\n';
  script += 'for (var lk = 0; lk < flatL.length; lk++) {\n';
  script += '  if (flatL[lk].locked) {\n';
  script += '    flatL[lk].locked = false;\n';
  script += '    relockList.push(flatL[lk]);\n';
  script += '  }\n';
  script += '}\n';

  script += 'var movedNames = [];\n';
  script += 'try {\n';
  script += '  for (var mv = 0; mv < flatL.length; mv++) {\n';
  script += '    var eff = deltas[flatG[mv]];\n';
  // A parent selected in another group already carries its own group's move;
  // only the residual is applied so the child lands on ITS group's target.
  script += '    var anc = __nearestSelGroup(flatL[mv]);\n';
  script += '    if (anc >= 0) { eff -= deltas[anc]; }\n';
  script += '    if (eff !== 0) {\n';
  if (axis === 'horizontal') {
    script += '      __shift(flatL[mv], eff, 0);\n';
  } else {
    script += '      __shift(flatL[mv], 0, eff);\n';
  }
  script += '    }\n';
  script += '    movedNames.push(flatL[mv].name);\n';
  script += '  }\n';
  script += '} finally {\n';
  script += '  for (var r = 0; r < relockList.length; r++) {\n';
  script += '    relockList[r].locked = true;\n';
  script += '  }\n';
  script += '}\n';

  script += 'var deltasOut = [];\n';
  script += 'for (var ro = 0; ro < deltas.length; ro++) { deltasOut.push(Math.round(deltas[ro] * 100) / 100); }\n';

  script += generateResultObject({
    success: 'true',
    axis: '"' + axis + '"',
    mode: '"' + (params.spacing !== undefined ? 'spacing' : 'even') + '"',
    gap: 'Math.round(__gap * 100) / 100',
    groupDeltas: 'deltasOut',
    movedLayers: 'movedNames'
  });

  return wrapInUndoGroup(script, 'Distribute Groups');
}

/**
 * Generate script to create a null that controls a set of layers as one rig.
 * The null is placed at the center of the combined bounding box and every
 * root layer of the selection is parented to it (AE preserves the visual
 * position when parenting). Scaling/moving/rotating the null then transforms
 * the whole arrangement, keeping the relative distances proportional.
 */
export function generateCreateGroupController(params: {
  compId?: number;
  compName?: string;
  groups?: Array<{ layerNames?: string[]; layerIndices?: number[] }>;
  layerNames?: string[];
  layerIndices?: number[];
  nullName?: string;
  position?: { x: number; y: number };
  time?: number;
}): string {
  const names: string[] = (params.layerNames || []).slice();
  const idxs: number[] = (params.layerIndices || []).slice();
  if (params.groups) {
    for (const g of params.groups) {
      if (g.layerNames) names.push(...g.layerNames);
      if (g.layerIndices) idxs.push(...g.layerIndices);
    }
  }
  if (names.length === 0 && idxs.length === 0) {
    throw new Error('create_group_controller needs layers (layerNames, layerIndices and/or groups)');
  }
  const nullName = params.nullName || 'Group Controller';

  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'var layersToControl = [];\n';
  script += 'var notFound = [];\n';

  if (idxs.length > 0) {
    script += 'var idxs = ' + arrayToES3(idxs) + ';\n';
    script += 'for (var d = 0; d < idxs.length; d++) {\n';
    script += '  if (idxs[d] >= 1 && idxs[d] <= comp.numLayers) {\n';
    script += '    layersToControl.push(comp.layer(idxs[d]));\n';
    script += '  } else {\n';
    script += '    notFound.push("index:" + idxs[d]);\n';
    script += '  }\n';
    script += '}\n';
  }

  if (names.length > 0) {
    script += 'var names = ' + arrayToES3(names) + ';\n';
    script += 'for (var n = 0; n < names.length; n++) {\n';
    script += '  var matched = false;\n';
    script += '  for (var i = 1; i <= comp.numLayers; i++) {\n';
    script += '    if (comp.layer(i).name === names[n]) {\n';
    script += '      layersToControl.push(comp.layer(i));\n';
    script += '      matched = true;\n';
    script += '    }\n';
    script += '  }\n';
    script += '  if (!matched) {\n';
    script += '    notFound.push(names[n]);\n';
    script += '  }\n';
    script += '}\n';
  }

  script += 'if (notFound.length > 0) {\n';
  script += '  throw new Error("create_group_controller: layers not found: " + notFound.join(", "));\n';
  script += '}\n';
  // Dedupe: a layer listed in several groups must be parented only once.
  script += 'var uniq = [];\n';
  script += 'for (var u = 0; u < layersToControl.length; u++) {\n';
  script += '  var dup = false;\n';
  script += '  for (var uq = 0; uq < uniq.length; uq++) {\n';
  script += '    if (uniq[uq].index === layersToControl[u].index) { dup = true; break; }\n';
  script += '  }\n';
  script += '  if (!dup) { uniq.push(layersToControl[u]); }\n';
  script += '}\n';
  script += 'layersToControl = uniq;\n';
  script += 'for (var cl = 0; cl < layersToControl.length; cl++) {\n';
  script += '  if (layersToControl[cl] instanceof CameraLayer || layersToControl[cl] instanceof LightLayer) {\n';
  script += '    throw new Error("create_group_controller: layer " + layersToControl[cl].name + " is a camera/light and has no bounds");\n';
  script += '  }\n';
  script += '}\n';

  script += 'var alignTime = ' + (params.time !== undefined ? params.time : 'comp.time') + ';\n';
  script += emitGeometryHelpers('create_group_controller');

  script += 'var union = null;\n';
  script += 'for (var bb = 0; bb < layersToControl.length; bb++) {\n';
  script += '  union = __unionBounds(union, __bounds(layersToControl[bb]));\n';
  script += '}\n';
  if (params.position) {
    script += 'var cx = ' + params.position.x + ';\n';
    script += 'var cy = ' + params.position.y + ';\n';
  } else {
    script += 'var cx = (union.minX + union.maxX) / 2;\n';
    script += 'var cy = (union.minY + union.maxY) / 2;\n';
  }

  // The null's in/out must cover every controlled layer, like a human
  // would trim it: from the earliest inPoint to the latest outPoint.
  script += 'var minIn = null, maxOut = null;\n';
  script += 'for (var tp = 0; tp < layersToControl.length; tp++) {\n';
  script += '  if (minIn === null || layersToControl[tp].inPoint < minIn) { minIn = layersToControl[tp].inPoint; }\n';
  script += '  if (maxOut === null || layersToControl[tp].outPoint > maxOut) { maxOut = layersToControl[tp].outPoint; }\n';
  script += '}\n';

  // Null anchor sits at its position in comp space, so putting the null at
  // the bbox center makes it the pivot: scaling it later resizes the whole
  // arrangement around the center, gaps included, proportionally.
  script += 'var ctrl = comp.layers.addNull(comp.duration);\n';
  script += 'ctrl.name = "' + escapeString(nullName) + '";\n';
  script += 'ctrl.startTime = minIn;\n';
  script += 'ctrl.outPoint = maxOut;\n';
  script += 'ctrl.property("ADBE Transform Group").property("ADBE Position").setValue([cx, cy]);\n';

  // Sit just above the topmost controlled layer, not at the top of the
  // comp — overlays above the group must stay above the controller too.
  script += 'var topMost = layersToControl[0];\n';
  script += 'for (var ti = 1; ti < layersToControl.length; ti++) {\n';
  script += '  if (layersToControl[ti].index < topMost.index) { topMost = layersToControl[ti]; }\n';
  script += '}\n';
  script += 'if (ctrl.index !== topMost.index - 1) {\n';
  script += '  ctrl.moveBefore(topMost);\n';
  script += '}\n';

  // A layer whose ancestor is also selected already follows the rig through
  // its parent; re-parenting it to the null would break the existing rig.
  script += 'var __hasControlledAncestor = function (lyr) {\n';
  script += '  var cur = lyr.parent;\n';
  script += '  while (cur) {\n';
  script += '    for (var q = 0; q < layersToControl.length; q++) {\n';
  script += '      if (layersToControl[q].index === cur.index) return true;\n';
  script += '    }\n';
  script += '    cur = cur.parent;\n';
  script += '  }\n';
  script += '  return false;\n';
  script += '};\n';

  script += 'var relockList = [];\n';
  script += 'for (var lk = 0; lk < layersToControl.length; lk++) {\n';
  script += '  if (layersToControl[lk].locked) {\n';
  script += '    layersToControl[lk].locked = false;\n';
  script += '    relockList.push(layersToControl[lk]);\n';
  script += '  }\n';
  script += '}\n';

  script += 'var controlled = [];\n';
  script += 'var childrenSkipped = [];\n';
  script += 'var reparented = [];\n';
  script += 'try {\n';
  script += '  for (var mv = 0; mv < layersToControl.length; mv++) {\n';
  script += '    if (__hasControlledAncestor(layersToControl[mv])) {\n';
  script += '      childrenSkipped.push(layersToControl[mv].name);\n';
  script += '      continue;\n';
  script += '    }\n';
  script += '    if (layersToControl[mv].parent) {\n';
  script += '      reparented.push(layersToControl[mv].name + " (was under " + layersToControl[mv].parent.name + ")");\n';
  script += '    }\n';
  // Assigning .parent keeps the layer's world position (no visual jump).
  script += '    layersToControl[mv].parent = ctrl;\n';
  script += '    controlled.push(layersToControl[mv].name);\n';
  script += '  }\n';
  script += '} finally {\n';
  script += '  for (var r = 0; r < relockList.length; r++) {\n';
  script += '    relockList[r].locked = true;\n';
  script += '  }\n';
  script += '}\n';

  script += generateResultObject({
    success: 'true',
    nullName: 'ctrl.name',
    nullIndex: 'ctrl.index',
    position: '[Math.round(cx * 100) / 100, Math.round(cy * 100) / 100]',
    inPoint: 'Math.round(ctrl.inPoint * 1000) / 1000',
    outPoint: 'Math.round(ctrl.outPoint * 1000) / 1000',
    controlledLayers: 'controlled',
    childrenFollowingTheirParent: 'childrenSkipped',
    detachedFromPreviousParent: 'reparented'
  });

  return wrapInUndoGroup(script, 'Create Group Controller');
}

/**
 * Generate script to copy layers between compositions.
 * Uses layer.copyToComp(), which preserves everything on the layer:
 * text animators, keyframes, expressions, masks, effects, transforms.
 */
export function generateCopyLayers(params: {
  sourceCompId?: number;
  sourceCompName?: string;
  targetCompId?: number;
  targetCompName?: string;
  layerIndices?: number[];
  layerNames?: string[];
  timeOffset?: number;
}): string {
  let script = '';
  script += generateProjectCheck();

  script += generateCompAccess(params.sourceCompId, params.sourceCompName);
  script += 'var sourceComp = comp;\n';
  script += generateCompAccess(params.targetCompId, params.targetCompName);
  script += 'var targetComp = comp;\n';

  script += 'var layersToCopy = [];\n';
  script += 'var notFound = [];\n';

  if (params.layerIndices && params.layerIndices.length > 0) {
    script += 'var idxs = ' + arrayToES3(params.layerIndices) + ';\n';
    script += 'for (var d = 0; d < idxs.length; d++) {\n';
    script += '  if (idxs[d] >= 1 && idxs[d] <= sourceComp.numLayers) {\n';
    script += '    layersToCopy.push(sourceComp.layer(idxs[d]));\n';
    script += '  } else {\n';
    script += '    notFound.push("index:" + idxs[d]);\n';
    script += '  }\n';
    script += '}\n';
  }

  if (params.layerNames && params.layerNames.length > 0) {
    script += 'var names = ' + arrayToES3(params.layerNames) + ';\n';
    script += 'for (var n = 0; n < names.length; n++) {\n';
    script += '  var matched = false;\n';
    script += '  for (var i = 1; i <= sourceComp.numLayers; i++) {\n';
    script += '    if (sourceComp.layer(i).name === names[n]) {\n';
    script += '      layersToCopy.push(sourceComp.layer(i));\n';
    script += '      matched = true;\n';
    script += '    }\n';
    script += '  }\n';
    script += '  if (!matched) {\n';
    script += '    notFound.push(names[n]);\n';
    script += '  }\n';
    script += '}\n';
  }

  if ((!params.layerIndices || params.layerIndices.length === 0) &&
      (!params.layerNames || params.layerNames.length === 0)) {
    script += 'for (var i = 1; i <= sourceComp.numLayers; i++) {\n';
    script += '  layersToCopy.push(sourceComp.layer(i));\n';
    script += '}\n';
  }

  // copyToComp() looks like the right API but silently drops text animators
  // (and other property groups added after layer creation). Go through AE's
  // real clipboard instead: scripted menu Copy/Paste is the same full-fidelity
  // copy as manual Ctrl+C/Ctrl+V, and also preserves parent links between
  // layers copied together. Menu command IDs are resolved by localized name.
  script += 'var __findCmd = function (names) {\n';
  script += '  for (var f = 0; f < names.length; f++) {\n';
  script += '    try {\n';
  script += '      var cmdId = app.findMenuCommandId(names[f]);\n';
  script += '      if (cmdId) return cmdId;\n';
  script += '    } catch (eCmd) {}\n';
  script += '  }\n';
  script += '  return 0;\n';
  script += '};\n';

  script += 'var copiedLayers = [];\n';
  script += 'if (layersToCopy.length > 0) {\n';
  script += '  var copyCmd = __findCmd(["Copy", "Copier"]);\n';
  script += '  var pasteCmd = __findCmd(["Paste", "Coller"]);\n';
  script += '  if (!copyCmd || !pasteCmd) {\n';
  script += '    throw new Error("Could not resolve Copy/Paste menu commands for this AE UI language");\n';
  script += '  }\n';

  // Locked layers cannot be selected — unlock them for the copy, relock after
  script += '  var relockList = [];\n';
  script += '  for (var t = 0; t < layersToCopy.length; t++) {\n';
  script += '    if (layersToCopy[t].locked) {\n';
  script += '      layersToCopy[t].locked = false;\n';
  script += '      relockList.push(layersToCopy[t]);\n';
  script += '    }\n';
  script += '  }\n';

  // Menu Copy/Paste act on the ACTIVE panel. If another panel keeps focus
  // (project panel, CEP panel...), Copy silently does nothing and Paste
  // re-pastes the previous clipboard content. So: force the viewer active
  // (setActive), then verify after paste that what landed matches what was
  // requested — on mismatch, roll the paste back and retry once, and if it
  // still fails, fail loudly instead of returning wrong layers as a success.
  script += '  var expectedNames = [];\n';
  script += '  for (var en = 0; en < layersToCopy.length; en++) {\n';
  script += '    expectedNames.push(layersToCopy[en].name);\n';
  script += '  }\n';
  // Pasted names may get a numeric suffix on collision ("Titre" -> "Titre 2"),
  // and an existing trailing number is incremented ("Titre 2" -> "Titre 3"),
  // so names are compared with any trailing number stripped.
  script += '  var __stem = function (n) { return n.replace(/\\s+[0-9]+$/, ""); };\n';
  script += '  var __validatePasted = function (pasted) {\n';
  script += '    if (pasted.length !== expectedNames.length) return false;\n';
  script += '    var consumed = [];\n';
  script += '    for (var c = 0; c < expectedNames.length; c++) consumed.push(false);\n';
  script += '    for (var pv = 0; pv < pasted.length; pv++) {\n';
  script += '      var pn = pasted[pv].name;\n';
  script += '      var ok = false;\n';
  script += '      for (var c2 = 0; c2 < expectedNames.length; c2++) {\n';
  script += '        if (consumed[c2]) continue;\n';
  script += '        var base = expectedNames[c2];\n';
  script += '        if (pn === base || __stem(pn) === __stem(base)) {\n';
  script += '          consumed[c2] = true;\n';
  script += '          ok = true;\n';
  script += '          break;\n';
  script += '        }\n';
  script += '      }\n';
  script += '      if (!ok) return false;\n';
  script += '    }\n';
  script += '    return true;\n';
  script += '  };\n';

  script += '  var pastedLayers = [];\n';
  script += '  var attemptOk = false;\n';
  script += '  for (var att = 0; att < 2 && !attemptOk; att++) {\n';
  script += '    var srcViewer = sourceComp.openInViewer();\n';
  script += '    if (srcViewer && srcViewer.setActive) srcViewer.setActive();\n';
  script += '    for (var s = 1; s <= sourceComp.numLayers; s++) {\n';
  script += '      sourceComp.layer(s).selected = false;\n';
  script += '    }\n';
  script += '    for (var t2 = 0; t2 < layersToCopy.length; t2++) {\n';
  script += '      layersToCopy[t2].selected = true;\n';
  script += '    }\n';
  script += '    app.executeCommand(copyCmd);\n';
  script += '    var tgtViewer = targetComp.openInViewer();\n';
  script += '    if (tgtViewer && tgtViewer.setActive) tgtViewer.setActive();\n';
  script += '    for (var u = 1; u <= targetComp.numLayers; u++) {\n';
  script += '      targetComp.layer(u).selected = false;\n';
  script += '    }\n';
  script += '    app.executeCommand(pasteCmd);\n';
  // Pasted layers come back selected — that is how we identify them
  script += '    pastedLayers = targetComp.selectedLayers;\n';
  script += '    if (__validatePasted(pastedLayers)) {\n';
  script += '      attemptOk = true;\n';
  script += '    } else {\n';
  script += '      for (var rb = 0; rb < pastedLayers.length; rb++) {\n';
  script += '        try { pastedLayers[rb].remove(); } catch (eRb) {}\n';
  script += '      }\n';
  script += '    }\n';
  script += '  }\n';

  script += '  for (var r = 0; r < relockList.length; r++) {\n';
  script += '    relockList[r].locked = true;\n';
  script += '  }\n';

  script += '  if (!attemptOk) {\n';
  script += '    throw new Error("copy_layers: the clipboard copy did not take (the paste produced different layers than requested, likely a panel focus issue). The bad paste was rolled back automatically — retry the call.");\n';
  script += '  }\n';

  script += '  for (var p = 0; p < pastedLayers.length; p++) {\n';
  if (params.timeOffset !== undefined && params.timeOffset !== 0) {
    script += '    pastedLayers[p].startTime = pastedLayers[p].startTime + ' + params.timeOffset + ';\n';
  }
  script += '    copiedLayers.push(pastedLayers[p].name);\n';
  script += '  }\n';
  script += '}\n';

  script += generateResultObject({
    success: 'true',
    sourceComp: 'sourceComp.name',
    targetComp: 'targetComp.name',
    copiedCount: 'copiedLayers.length',
    copiedLayers: 'copiedLayers',
    notFound: 'notFound'
  });

  return wrapInUndoGroup(script, 'Copy Layers');
}

/**
 * Generate script to list all layers in a composition
 */
export function generateListLayers(params: {
  compId?: number;
  compName?: string;
  includeText?: boolean;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'var layers = [];\n';
  script += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
  script += '  var layer = comp.layer(i);\n';
  script += '  var layerType = "unknown";\n';
  script += '  if (layer instanceof CameraLayer) layerType = "camera";\n';
  script += '  else if (layer instanceof LightLayer) layerType = "light";\n';
  script += '  else if (layer instanceof TextLayer) layerType = "text";\n';
  script += '  else if (layer instanceof ShapeLayer) layerType = "shape";\n';
  script += '  else if (layer.adjustmentLayer) layerType = "adjustment";\n';
  script += '  else if (layer.nullLayer) layerType = "null";\n';
  script += '  else if (layer.source instanceof CompItem) layerType = "precomp";\n';
  script += '  else if (layer.source && layer.source.mainSource instanceof SolidSource) layerType = "solid";\n';
  script += '  else if (layer.source) layerType = "av";\n';
  script += '  else layerType = "unknown";\n';
  script += '  var entry = {\n';
  script += '    index: layer.index,\n';
  script += '    name: layer.name,\n';
  script += '    type: layerType,\n';
  script += '    enabled: layer.enabled,\n';
  script += '    solo: layer.solo,\n';
  script += '    shy: layer.shy,\n';
  script += '    locked: layer.locked,\n';
  script += '    inPoint: layer.inPoint,\n';
  script += '    outPoint: layer.outPoint,\n';
  script += '    startTime: layer.startTime,\n';
  script += '    is3D: layer.threeDLayer,\n';
  script += '    parent: layer.parent ? layer.parent.index : null\n';
  script += '  };\n';
  script += '  if (layer.source) {\n';
  script += '    try { entry.source = layer.source.name; } catch (eSrc) {}\n';
  script += '  }\n';
  if (params.includeText) {
    script += '  if (layer instanceof TextLayer) {\n';
    script += '    try { entry.text = layer.property("Source Text").value.text; } catch (eTxt) {}\n';
    script += '  }\n';
  }
  script += '  layers.push(entry);\n';
  script += '}\n';
  script += 'layers;\n';

  return script;
}

/**
 * Generate script to get layer info
 */
export function generateGetLayerInfo(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);

  script += 'var layerType = "unknown";\n';
  script += 'if (layer instanceof CameraLayer) layerType = "camera";\n';
  script += 'else if (layer instanceof LightLayer) layerType = "light";\n';
  script += 'else if (layer instanceof TextLayer) layerType = "text";\n';
  script += 'else if (layer instanceof ShapeLayer) layerType = "shape";\n';
  script += 'else if (layer.adjustmentLayer) layerType = "adjustment";\n';
  script += 'else if (layer.nullLayer) layerType = "null";\n';
  script += 'else if (layer.source instanceof CompItem) layerType = "precomp";\n';
  script += 'else if (layer.source && layer.source.mainSource instanceof SolidSource) layerType = "solid";\n';
  script += 'else if (layer.source) layerType = "av";\n';
  script += 'else layerType = "unknown";\n';

  script += 'var info = {\n';
  script += '  index: layer.index,\n';
  script += '  name: layer.name,\n';
  script += '  type: layerType,\n';
  script += '  enabled: layer.enabled,\n';
  script += '  solo: layer.solo,\n';
  script += '  shy: layer.shy,\n';
  script += '  locked: layer.locked,\n';
  script += '  inPoint: layer.inPoint,\n';
  script += '  outPoint: layer.outPoint,\n';
  script += '  startTime: layer.startTime,\n';
  script += '  stretch: layer.stretch,\n';
  script += '  is3D: layer.threeDLayer,\n';
  script += '  parent: layer.parent ? layer.parent.index : null,\n';
  script += '  hasVideo: layer.hasVideo,\n';
  script += '  hasAudio: layer.hasAudio,\n';
  script += '  source: layer.source ? layer.source.name : null\n';
  script += '};\n';

  // Get transform values if available
  script += 'if (layer.property("Transform")) {\n';
  script += '  info.position = layer.property("Position").value;\n';
  script += '  info.scale = layer.property("Scale").value;\n';
  script += '  info.rotation = layer.property("Rotation") ? layer.property("Rotation").value : 0;\n';
  script += '  info.opacity = layer.property("Opacity").value;\n';
  script += '  info.anchorPoint = layer.property("Anchor Point").value;\n';
  script += '}\n';

  // Text layers: expose the TextDocument (font, size, colors, content).
  // Individual properties are wrapped in try/catch because some throw
  // depending on point vs paragraph text and AE version.
  script += 'if (layer instanceof TextLayer) {\n';
  script += '  try {\n';
  script += '    var textDoc = layer.property("Source Text").value;\n';
  script += '    var textInfo = {};\n';
  script += '    textInfo.text = textDoc.text;\n';
  script += '    try { textInfo.font = textDoc.font; } catch (e1) {}\n';
  script += '    try {\n';
  script += '      if (textDoc.fontObject) {\n';
  script += '        textInfo.fontFamily = textDoc.fontObject.familyName;\n';
  script += '        textInfo.fontStyle = textDoc.fontObject.styleName;\n';
  script += '      }\n';
  script += '    } catch (e2) {}\n';
  script += '    try { textInfo.fontSize = textDoc.fontSize; } catch (e3) {}\n';
  script += '    try {\n';
  script += '      if (textDoc.applyFill) {\n';
  script += '        textInfo.fillColor = [textDoc.fillColor[0], textDoc.fillColor[1], textDoc.fillColor[2]];\n';
  script += '      }\n';
  script += '    } catch (e4) {}\n';
  script += '    try {\n';
  script += '      if (textDoc.applyStroke) {\n';
  script += '        textInfo.strokeColor = [textDoc.strokeColor[0], textDoc.strokeColor[1], textDoc.strokeColor[2]];\n';
  script += '        textInfo.strokeWidth = textDoc.strokeWidth;\n';
  script += '      }\n';
  script += '    } catch (e5) {}\n';
  script += '    try { textInfo.tracking = textDoc.tracking; } catch (e6) {}\n';
  script += '    try { textInfo.leading = textDoc.autoLeading ? "auto" : textDoc.leading; } catch (e7) {}\n';
  script += '    try {\n';
  script += '      var just = textDoc.justification;\n';
  script += '      if (just === ParagraphJustification.LEFT_JUSTIFY) textInfo.justification = "LEFT";\n';
  script += '      else if (just === ParagraphJustification.CENTER_JUSTIFY) textInfo.justification = "CENTER";\n';
  script += '      else if (just === ParagraphJustification.RIGHT_JUSTIFY) textInfo.justification = "RIGHT";\n';
  script += '      else textInfo.justification = "OTHER";\n';
  script += '    } catch (e8) {}\n';
  script += '    try {\n';
  script += '      textInfo.isBoxText = textDoc.boxText;\n';
  script += '      if (textDoc.boxText) {\n';
  script += '        textInfo.boxSize = [textDoc.boxTextSize[0], textDoc.boxTextSize[1]];\n';
  script += '      }\n';
  script += '    } catch (e9) {}\n';
  script += '    info.textDocument = textInfo;\n';
  script += '  } catch (eText) {\n';
  script += '    info.textDocumentError = eText.toString();\n';
  script += '  }\n';
  script += '}\n';

  // Solid layers: expose the solid color
  script += 'if (layerType === "solid") {\n';
  script += '  try {\n';
  script += '    var solidColor = layer.source.mainSource.color;\n';
  script += '    info.solidColor = [solidColor[0], solidColor[1], solidColor[2]];\n';
  script += '  } catch (eSolid) {}\n';
  script += '}\n';

  script += 'info;\n';

  return script;
}
