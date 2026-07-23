/**
 * Keyframe-related Script Generators
 *
 * Generates ES3-compatible ExtendScript for keyframe operations.
 */

import {
  escapeString,
  generateProjectCheck,
  generateCompAccess,
  generateLayerAccess,
  generatePropertyAccess,
  formatKeyframeValue,
  generateInterpolationType,
  wrapInUndoGroup,
  generateResultObject,
  arrayToES3
} from './helpers.js';

/**
 * Generate script to set a keyframe
 */
export function generateSetKeyframe(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  property: string;
  time: number;
  value: number | number[] | string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);
  script += generatePropertyAccess('layer', params.property);

  script += 'var keyTime = ' + params.time + ';\n';
  script += 'var keyValue = ' + formatKeyframeValue(params.value) + ';\n';
  if (typeof params.value === 'string') {
    // Source Text: a raw string as key value would reset the layer's styling.
    // Reuse the current TextDocument and only swap its text instead.
    script += 'if (prop.propertyValueType === PropertyValueType.TEXT_DOCUMENT) {\n';
    script += '  var __textDoc = prop.value;\n';
    script += '  __textDoc.text = keyValue;\n';
    script += '  keyValue = __textDoc;\n';
    script += '}\n';
  }

  // Check if property can have keyframes
  script += 'if (!prop.canVaryOverTime) {\n';
  script += '  throw new Error("Property cannot have keyframes: ' + escapeString(params.property) + '");\n';
  script += '}\n';

  // Add or update keyframe
  script += 'var keyIndex = prop.addKey(keyTime);\n';
  script += 'prop.setValueAtKey(keyIndex, keyValue);\n';

  script += generateResultObject({
    keyIndex: 'keyIndex',
    time: 'keyTime',
    property: '"' + escapeString(params.property) + '"'
  });

  return wrapInUndoGroup(script, 'Set Keyframe');
}

/**
 * Generate script to set an advanced keyframe with easing
 */
export function generateSetKeyframeAdvanced(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  property: string;
  time: number;
  value: number | number[] | string;
  inType?: string;
  outType?: string;
  inEase?: { speed: number; influence: number };
  outEase?: { speed: number; influence: number };
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);
  script += generatePropertyAccess('layer', params.property);

  script += 'var keyTime = ' + params.time + ';\n';
  script += 'var keyValue = ' + formatKeyframeValue(params.value) + ';\n';
  if (typeof params.value === 'string') {
    // Source Text: a raw string as key value would reset the layer's styling.
    // Reuse the current TextDocument and only swap its text instead.
    script += 'if (prop.propertyValueType === PropertyValueType.TEXT_DOCUMENT) {\n';
    script += '  var __textDoc = prop.value;\n';
    script += '  __textDoc.text = keyValue;\n';
    script += '  keyValue = __textDoc;\n';
    script += '}\n';
  }

  script += 'if (!prop.canVaryOverTime) {\n';
  script += '  throw new Error("Property cannot have keyframes: ' + escapeString(params.property) + '");\n';
  script += '}\n';

  script += 'var keyIndex = prop.addKey(keyTime);\n';
  script += 'prop.setValueAtKey(keyIndex, keyValue);\n';

  // Set interpolation types
  if (params.inType || params.outType) {
    const inType = params.inType || 'BEZIER';
    const outType = params.outType || 'BEZIER';
    script += 'prop.setInterpolationTypeAtKey(keyIndex, ';
    script += generateInterpolationType(inType) + ', ';
    script += generateInterpolationType(outType) + ');\n';
  }

  // Set temporal ease
  if (params.inEase || params.outEase) {
    // Determine number of dimensions
    script += 'var numDims = 1;\n';
    script += 'if (prop.propertyValueType === PropertyValueType.TwoD || prop.propertyValueType === PropertyValueType.TwoD_SPATIAL) {\n';
    script += '  numDims = 2;\n';
    script += '} else if (prop.propertyValueType === PropertyValueType.ThreeD || prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL) {\n';
    script += '  numDims = 3;\n';
    script += '}\n';

    script += 'var inEaseArr = [];\n';
    script += 'var outEaseArr = [];\n';
    script += 'for (var d = 0; d < numDims; d++) {\n';

    if (params.inEase) {
      script += '  inEaseArr.push(new KeyframeEase(' + params.inEase.speed + ', ' + params.inEase.influence + '));\n';
    } else {
      script += '  inEaseArr.push(new KeyframeEase(0, 33.33));\n';
    }

    if (params.outEase) {
      script += '  outEaseArr.push(new KeyframeEase(' + params.outEase.speed + ', ' + params.outEase.influence + '));\n';
    } else {
      script += '  outEaseArr.push(new KeyframeEase(0, 33.33));\n';
    }

    script += '}\n';
    script += 'prop.setTemporalEaseAtKey(keyIndex, inEaseArr, outEaseArr);\n';
  }

  script += generateResultObject({
    keyIndex: 'keyIndex',
    time: 'keyTime',
    property: '"' + escapeString(params.property) + '"'
  });

  return wrapInUndoGroup(script, 'Set Keyframe');
}

/**
 * Generate script to set many keyframes on one property in a single call.
 * The comp/layer/property lookup happens once, then all keys are added in
 * one loop — much faster than one set_keyframe per key.
 */
export function generateSetKeyframes(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  property: string;
  keyframes: Array<{
    time: number;
    value: number | number[] | string;
    inType?: string;
    outType?: string;
    inEase?: { speed: number; influence: number };
    outEase?: { speed: number; influence: number };
  }>;
}): string {
  if (!params.keyframes || !Array.isArray(params.keyframes) || params.keyframes.length === 0) {
    throw new Error('keyframes must be a non-empty array of { time, value }');
  }

  let hasStringValue = false;
  const entries: string[] = [];
  for (let i = 0; i < params.keyframes.length; i++) {
    const kf = params.keyframes[i];
    if (!kf || typeof kf.time !== 'number' || kf.value === undefined || kf.value === null) {
      throw new Error('keyframes[' + i + '] must have a numeric time and a value');
    }
    if (typeof kf.value === 'string') {
      hasStringValue = true;
    }
    let entry = '{ t: ' + kf.time + ', v: ' + formatKeyframeValue(kf.value);
    if (kf.inType || kf.outType) {
      entry += ', it: ' + generateInterpolationType(kf.inType || 'BEZIER');
      entry += ', ot: ' + generateInterpolationType(kf.outType || 'BEZIER');
    }
    if (kf.inEase) {
      entry += ', ie: { s: ' + kf.inEase.speed + ', i: ' + kf.inEase.influence + ' }';
    }
    if (kf.outEase) {
      entry += ', oe: { s: ' + kf.outEase.speed + ', i: ' + kf.outEase.influence + ' }';
    }
    entry += ' }';
    entries.push(entry);
  }

  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);
  script += generatePropertyAccess('layer', params.property);

  script += 'if (!prop.canVaryOverTime) {\n';
  script += '  throw new Error("Property cannot have keyframes: ' + escapeString(params.property) + '");\n';
  script += '}\n';

  script += 'var __keys = [\n';
  script += '  ' + entries.join(',\n  ') + '\n';
  script += '];\n';

  script += 'var numDims = 1;\n';
  script += 'if (prop.propertyValueType === PropertyValueType.TwoD || prop.propertyValueType === PropertyValueType.TwoD_SPATIAL) {\n';
  script += '  numDims = 2;\n';
  script += '} else if (prop.propertyValueType === PropertyValueType.ThreeD || prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL) {\n';
  script += '  numDims = 3;\n';
  script += '}\n';

  script += 'for (var k = 0; k < __keys.length; k++) {\n';
  script += '  var kd = __keys[k];\n';
  script += '  var kv = kd.v;\n';
  if (hasStringValue) {
    // Source Text: a raw string as key value would reset the layer's styling.
    // Reuse the current TextDocument and only swap its text instead.
    script += '  if (typeof kv === "string" && prop.propertyValueType === PropertyValueType.TEXT_DOCUMENT) {\n';
    script += '    var __textDoc = prop.value;\n';
    script += '    __textDoc.text = kv;\n';
    script += '    kv = __textDoc;\n';
    script += '  }\n';
  }
  script += '  var ki = prop.addKey(kd.t);\n';
  script += '  prop.setValueAtKey(ki, kv);\n';
  script += '  if (kd.it) {\n';
  script += '    prop.setInterpolationTypeAtKey(ki, kd.it, kd.ot);\n';
  script += '  }\n';
  script += '  if (kd.ie || kd.oe) {\n';
  script += '    var inEaseArr = [];\n';
  script += '    var outEaseArr = [];\n';
  script += '    for (var d = 0; d < numDims; d++) {\n';
  script += '      inEaseArr.push(kd.ie ? new KeyframeEase(kd.ie.s, kd.ie.i) : new KeyframeEase(0, 33.33));\n';
  script += '      outEaseArr.push(kd.oe ? new KeyframeEase(kd.oe.s, kd.oe.i) : new KeyframeEase(0, 33.33));\n';
  script += '    }\n';
  script += '    prop.setTemporalEaseAtKey(ki, inEaseArr, outEaseArr);\n';
  script += '  }\n';
  script += '}\n';

  script += generateResultObject({
    property: '"' + escapeString(params.property) + '"',
    keysSet: '__keys.length'
  });

  return wrapInUndoGroup(script, 'Set Keyframes');
}

/**
 * Generate script to apply easy ease to keyframes
 */
export function generateApplyEasyEase(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  property: string;
  keyframeIndex?: number;
  type?: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);
  script += generatePropertyAccess('layer', params.property);

  const easeType = params.type || 'BOTH';

  script += 'if (prop.numKeys === 0) {\n';
  script += '  throw new Error("Property has no keyframes");\n';
  script += '}\n';

  // Determine which keyframes to process
  if (params.keyframeIndex) {
    script += 'var startKey = ' + params.keyframeIndex + ';\n';
    script += 'var endKey = ' + params.keyframeIndex + ';\n';
  } else {
    script += 'var startKey = 1;\n';
    script += 'var endKey = prop.numKeys;\n';
  }

  // Get number of dimensions
  script += 'var numDims = 1;\n';
  script += 'if (prop.propertyValueType === PropertyValueType.TwoD || prop.propertyValueType === PropertyValueType.TwoD_SPATIAL) {\n';
  script += '  numDims = 2;\n';
  script += '} else if (prop.propertyValueType === PropertyValueType.ThreeD || prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL) {\n';
  script += '  numDims = 3;\n';
  script += '}\n';

  script += 'var easeValue = 33.33;\n';
  script += 'for (var k = startKey; k <= endKey; k++) {\n';
  script += '  var inEaseArr = [];\n';
  script += '  var outEaseArr = [];\n';
  script += '  for (var d = 0; d < numDims; d++) {\n';

  if (easeType === 'IN' || easeType === 'BOTH') {
    script += '    inEaseArr.push(new KeyframeEase(0, easeValue));\n';
  } else {
    script += '    inEaseArr.push(prop.keyInTemporalEase(k)[d]);\n';
  }

  if (easeType === 'OUT' || easeType === 'BOTH') {
    script += '    outEaseArr.push(new KeyframeEase(0, easeValue));\n';
  } else {
    script += '    outEaseArr.push(prop.keyOutTemporalEase(k)[d]);\n';
  }

  script += '  }\n';
  script += '  prop.setTemporalEaseAtKey(k, inEaseArr, outEaseArr);\n';
  script += '}\n';

  script += generateResultObject({
    success: 'true',
    keyframesModified: 'endKey - startKey + 1'
  });

  return wrapInUndoGroup(script, 'Apply Easy Ease');
}

/**
 * Generate script to set temporal ease on a keyframe
 */
export function generateSetTemporalEase(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  property: string;
  keyframeIndex: number;
  inSpeed?: number;
  inInfluence?: number;
  outSpeed?: number;
  outInfluence?: number;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);
  script += generatePropertyAccess('layer', params.property);

  script += 'var keyIndex = ' + params.keyframeIndex + ';\n';
  script += 'if (keyIndex > prop.numKeys) {\n';
  script += '  throw new Error("Keyframe index out of range");\n';
  script += '}\n';

  // Get number of dimensions
  script += 'var numDims = 1;\n';
  script += 'if (prop.propertyValueType === PropertyValueType.TwoD || prop.propertyValueType === PropertyValueType.TwoD_SPATIAL) {\n';
  script += '  numDims = 2;\n';
  script += '} else if (prop.propertyValueType === PropertyValueType.ThreeD || prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL) {\n';
  script += '  numDims = 3;\n';
  script += '}\n';

  script += 'var currentInEase = prop.keyInTemporalEase(keyIndex);\n';
  script += 'var currentOutEase = prop.keyOutTemporalEase(keyIndex);\n';

  script += 'var inEaseArr = [];\n';
  script += 'var outEaseArr = [];\n';

  const inSpeed = params.inSpeed !== undefined ? params.inSpeed : 'currentInEase[d].speed';
  const inInfluence = params.inInfluence !== undefined ? params.inInfluence : 'currentInEase[d].influence';
  const outSpeed = params.outSpeed !== undefined ? params.outSpeed : 'currentOutEase[d].speed';
  const outInfluence = params.outInfluence !== undefined ? params.outInfluence : 'currentOutEase[d].influence';

  script += 'for (var d = 0; d < numDims; d++) {\n';
  script += '  inEaseArr.push(new KeyframeEase(' + inSpeed + ', ' + inInfluence + '));\n';
  script += '  outEaseArr.push(new KeyframeEase(' + outSpeed + ', ' + outInfluence + '));\n';
  script += '}\n';

  script += 'prop.setTemporalEaseAtKey(keyIndex, inEaseArr, outEaseArr);\n';

  script += generateResultObject({
    success: 'true',
    keyIndex: 'keyIndex'
  });

  return wrapInUndoGroup(script, 'Set Temporal Ease');
}

/**
 * Generate script to offset keyframes in time
 */
export function generateOffsetKeyframes(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  property: string;
  offset: number;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);
  script += generatePropertyAccess('layer', params.property);

  script += 'var offset = ' + params.offset + ';\n';

  script += 'if (prop.numKeys === 0) {\n';
  script += '  throw new Error("Property has no keyframes");\n';
  script += '}\n';

  // Store keyframe data
  script += 'var keyData = [];\n';
  script += 'for (var i = 1; i <= prop.numKeys; i++) {\n';
  script += '  keyData.push({\n';
  script += '    time: prop.keyTime(i),\n';
  script += '    value: prop.keyValue(i),\n';
  script += '    inType: prop.keyInInterpolationType(i),\n';
  script += '    outType: prop.keyOutInterpolationType(i),\n';
  script += '    inEase: prop.keyInTemporalEase(i),\n';
  script += '    outEase: prop.keyOutTemporalEase(i)\n';
  script += '  });\n';
  script += '}\n';

  // Remove all keyframes
  script += 'while (prop.numKeys > 0) {\n';
  script += '  prop.removeKey(1);\n';
  script += '}\n';

  // Re-add keyframes at new times
  script += 'for (var i = 0; i < keyData.length; i++) {\n';
  script += '  var newTime = keyData[i].time + offset;\n';
  script += '  if (newTime >= 0) {\n';
  script += '    var keyIndex = prop.addKey(newTime);\n';
  script += '    prop.setValueAtKey(keyIndex, keyData[i].value);\n';
  script += '    prop.setInterpolationTypeAtKey(keyIndex, keyData[i].inType, keyData[i].outType);\n';
  script += '    prop.setTemporalEaseAtKey(keyIndex, keyData[i].inEase, keyData[i].outEase);\n';
  script += '  }\n';
  script += '}\n';

  script += generateResultObject({
    success: 'true',
    keyframesMoved: 'keyData.length',
    offset: 'offset'
  });

  return wrapInUndoGroup(script, 'Offset Keyframes');
}

/**
 * Generate script to scale keyframe timing
 */
export function generateScaleKeyframeTiming(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  property: string;
  scale: number;
  anchorTime?: number;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);
  script += generatePropertyAccess('layer', params.property);

  const anchor = params.anchorTime !== undefined ? params.anchorTime : 0;
  script += 'var scaleFactor = ' + params.scale + ';\n';
  script += 'var anchorTime = ' + anchor + ';\n';

  script += 'if (prop.numKeys === 0) {\n';
  script += '  throw new Error("Property has no keyframes");\n';
  script += '}\n';

  // Store keyframe data
  script += 'var keyData = [];\n';
  script += 'for (var i = 1; i <= prop.numKeys; i++) {\n';
  script += '  keyData.push({\n';
  script += '    time: prop.keyTime(i),\n';
  script += '    value: prop.keyValue(i),\n';
  script += '    inType: prop.keyInInterpolationType(i),\n';
  script += '    outType: prop.keyOutInterpolationType(i),\n';
  script += '    inEase: prop.keyInTemporalEase(i),\n';
  script += '    outEase: prop.keyOutTemporalEase(i)\n';
  script += '  });\n';
  script += '}\n';

  // Remove all keyframes
  script += 'while (prop.numKeys > 0) {\n';
  script += '  prop.removeKey(1);\n';
  script += '}\n';

  // Re-add keyframes at scaled times
  script += 'for (var i = 0; i < keyData.length; i++) {\n';
  script += '  var newTime = anchorTime + (keyData[i].time - anchorTime) * scaleFactor;\n';
  script += '  if (newTime >= 0) {\n';
  script += '    var keyIndex = prop.addKey(newTime);\n';
  script += '    prop.setValueAtKey(keyIndex, keyData[i].value);\n';
  script += '    prop.setInterpolationTypeAtKey(keyIndex, keyData[i].inType, keyData[i].outType);\n';
  script += '    prop.setTemporalEaseAtKey(keyIndex, keyData[i].inEase, keyData[i].outEase);\n';
  script += '  }\n';
  script += '}\n';

  script += generateResultObject({
    success: 'true',
    keyframesScaled: 'keyData.length',
    scale: 'scaleFactor'
  });

  return wrapInUndoGroup(script, 'Scale Keyframe Timing');
}

/**
 * Generate script to reverse keyframes
 */
export function generateReverseKeyframes(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  property: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);
  script += generatePropertyAccess('layer', params.property);

  script += 'if (prop.numKeys < 2) {\n';
  script += '  throw new Error("Need at least 2 keyframes to reverse");\n';
  script += '}\n';

  // Store keyframe data
  script += 'var keyData = [];\n';
  script += 'var firstTime = prop.keyTime(1);\n';
  script += 'var lastTime = prop.keyTime(prop.numKeys);\n';
  script += 'for (var i = 1; i <= prop.numKeys; i++) {\n';
  script += '  keyData.push({\n';
  script += '    time: prop.keyTime(i),\n';
  script += '    value: prop.keyValue(i),\n';
  script += '    inType: prop.keyInInterpolationType(i),\n';
  script += '    outType: prop.keyOutInterpolationType(i),\n';
  script += '    inEase: prop.keyInTemporalEase(i),\n';
  script += '    outEase: prop.keyOutTemporalEase(i)\n';
  script += '  });\n';
  script += '}\n';

  // Remove all keyframes
  script += 'while (prop.numKeys > 0) {\n';
  script += '  prop.removeKey(1);\n';
  script += '}\n';

  // Re-add keyframes in reverse order with reversed times
  script += 'for (var i = keyData.length - 1; i >= 0; i--) {\n';
  script += '  var newTime = firstTime + (lastTime - keyData[i].time);\n';
  script += '  var keyIndex = prop.addKey(newTime);\n';
  script += '  prop.setValueAtKey(keyIndex, keyData[i].value);\n';
  // Swap in/out types
  script += '  prop.setInterpolationTypeAtKey(keyIndex, keyData[i].outType, keyData[i].inType);\n';
  // Swap in/out ease
  script += '  prop.setTemporalEaseAtKey(keyIndex, keyData[i].outEase, keyData[i].inEase);\n';
  script += '}\n';

  script += generateResultObject({
    success: 'true',
    keyframesReversed: 'keyData.length'
  });

  return wrapInUndoGroup(script, 'Reverse Keyframes');
}

/**
 * Generate script to copy keyframes between properties
 */
export function generateCopyKeyframes(params: {
  compId?: number;
  compName?: string;
  sourceLayerIndex?: number;
  sourceLayerName?: string;
  sourceProperty: string;
  targetLayerIndex?: number;
  targetLayerName?: string;
  targetProperty?: string;
  timeOffset?: number;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  // Get source layer and property
  script += generateLayerAccess('comp', params.sourceLayerIndex, params.sourceLayerName);
  script += 'var sourceLayer = layer;\n';
  script += generatePropertyAccess('sourceLayer', params.sourceProperty);
  script += 'var sourceProp = prop;\n';

  // Get target layer and property
  if (params.targetLayerIndex || params.targetLayerName) {
    script += generateLayerAccess('comp', params.targetLayerIndex, params.targetLayerName);
  } else {
    script += 'layer = sourceLayer;\n';
  }
  const targetProp = params.targetProperty || params.sourceProperty;
  script += generatePropertyAccess('layer', targetProp);
  script += 'var targetProp = prop;\n';

  const timeOffset = params.timeOffset || 0;

  script += 'if (sourceProp.numKeys === 0) {\n';
  script += '  throw new Error("Source property has no keyframes");\n';
  script += '}\n';

  // Copy keyframes
  script += 'var keysCopied = 0;\n';
  script += 'for (var i = 1; i <= sourceProp.numKeys; i++) {\n';
  script += '  var newTime = sourceProp.keyTime(i) + ' + timeOffset + ';\n';
  script += '  if (newTime >= 0) {\n';
  script += '    var keyIndex = targetProp.addKey(newTime);\n';
  script += '    targetProp.setValueAtKey(keyIndex, sourceProp.keyValue(i));\n';
  script += '    targetProp.setInterpolationTypeAtKey(keyIndex, sourceProp.keyInInterpolationType(i), sourceProp.keyOutInterpolationType(i));\n';
  script += '    targetProp.setTemporalEaseAtKey(keyIndex, sourceProp.keyInTemporalEase(i), sourceProp.keyOutTemporalEase(i));\n';
  script += '    keysCopied++;\n';
  script += '  }\n';
  script += '}\n';

  script += generateResultObject({
    success: 'true',
    keyframesCopied: 'keysCopied'
  });

  return wrapInUndoGroup(script, 'Copy Keyframes');
}

/**
 * Generate script to get keyframes from a property
 */
export function generateGetKeyframes(params: {
  compId?: number;
  compName?: string;
  layerIndex?: number;
  layerName?: string;
  property: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += generateLayerAccess('comp', params.layerIndex, params.layerName);
  script += generatePropertyAccess('layer', params.property);

  script += 'var keyframes = [];\n';
  script += 'for (var i = 1; i <= prop.numKeys; i++) {\n';
  script += '  var kf = {};\n';
  script += '  kf.index = i;\n';
  script += '  kf.time = prop.keyTime(i);\n';
  script += '  kf.value = prop.keyValue(i);\n';
  script += '  kf.inInterpolation = prop.keyInInterpolationType(i).toString();\n';
  script += '  kf.outInterpolation = prop.keyOutInterpolationType(i).toString();\n';
  script += '  keyframes.push(kf);\n';
  script += '}\n';

  script += 'var result = {};\n';
  script += 'result.property = "' + escapeString(params.property) + '";\n';
  script += 'result.numKeys = prop.numKeys;\n';
  script += 'result.keyframes = keyframes;\n';
  script += 'result;\n';

  return script;
}
