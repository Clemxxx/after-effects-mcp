/**
 * Composition-related Script Generators
 *
 * Generates ES3-compatible ExtendScript for composition operations.
 */

import {
  escapeString,
  generateProjectCheck,
  generateCompAccess,
  colorToES3,
  wrapInUndoGroup,
  generateResultObject
} from './helpers.js';

/**
 * Generate script to create a new composition
 */
export function generateCreateComposition(params: {
  name: string;
  width: number;
  height: number;
  frameRate: number;
  duration: number;
  backgroundColor?: { r: number; g: number; b: number };
}): string {
  let script = '';
  script += generateProjectCheck();

  script += 'var comp = app.project.items.addComp(\n';
  script += '  "' + escapeString(params.name) + '",\n';
  script += '  ' + params.width + ',\n';
  script += '  ' + params.height + ',\n';
  script += '  1,\n'; // pixel aspect ratio
  script += '  ' + params.duration + ',\n';
  script += '  ' + params.frameRate + '\n';
  script += ');\n';

  if (params.backgroundColor) {
    script += 'comp.bgColor = ' + colorToES3(params.backgroundColor) + ';\n';
  }

  script += generateResultObject({
    id: 'comp.id',
    name: 'comp.name',
    width: 'comp.width',
    height: 'comp.height',
    frameRate: 'comp.frameRate',
    duration: 'comp.duration'
  });

  return wrapInUndoGroup(script, 'Create Composition');
}

/**
 * Generate script to modify an existing composition
 */
export function generateModifyComposition(params: {
  compId?: number;
  compName?: string;
  name?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  duration?: number;
  backgroundColor?: { r: number; g: number; b: number };
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  if (params.name) {
    script += 'comp.name = "' + escapeString(params.name) + '";\n';
  }
  if (params.width) {
    script += 'comp.width = ' + params.width + ';\n';
  }
  if (params.height) {
    script += 'comp.height = ' + params.height + ';\n';
  }
  if (params.frameRate) {
    script += 'comp.frameRate = ' + params.frameRate + ';\n';
  }
  if (params.duration) {
    script += 'comp.duration = ' + params.duration + ';\n';
  }
  if (params.backgroundColor) {
    script += 'comp.bgColor = ' + colorToES3(params.backgroundColor) + ';\n';
  }

  script += generateResultObject({
    id: 'comp.id',
    name: 'comp.name',
    width: 'comp.width',
    height: 'comp.height',
    frameRate: 'comp.frameRate',
    duration: 'comp.duration'
  });

  return wrapInUndoGroup(script, 'Modify Composition');
}

/**
 * Generate script to duplicate a composition
 */
export function generateDuplicateComposition(params: {
  compId?: number;
  compName?: string;
  newName?: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'var newComp = comp.duplicate();\n';

  if (params.newName) {
    script += 'newComp.name = "' + escapeString(params.newName) + '";\n';
  }

  script += generateResultObject({
    id: 'newComp.id',
    name: 'newComp.name',
    width: 'newComp.width',
    height: 'newComp.height',
    frameRate: 'newComp.frameRate',
    duration: 'newComp.duration'
  });

  return wrapInUndoGroup(script, 'Duplicate Composition');
}

/**
 * Generate script to delete a composition
 */
export function generateDeleteComposition(params: {
  compId?: number;
  compName?: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'var deletedName = comp.name;\n';
  script += 'comp.remove();\n';

  script += generateResultObject({
    success: 'true',
    deleted: 'deletedName'
  });

  return wrapInUndoGroup(script, 'Delete Composition');
}

/**
 * Generate script to list all compositions
 */
export function generateListCompositions(): string {
  let script = '';
  script += generateProjectCheck();

  script += 'var compositions = [];\n';
  script += 'for (var i = 1; i <= app.project.numItems; i++) {\n';
  script += '  var item = app.project.item(i);\n';
  script += '  if (item instanceof CompItem) {\n';
  script += '    compositions.push({\n';
  script += '      id: item.id,\n';
  script += '      name: item.name,\n';
  script += '      width: item.width,\n';
  script += '      height: item.height,\n';
  script += '      frameRate: item.frameRate,\n';
  script += '      duration: item.duration,\n';
  script += '      numLayers: item.numLayers,\n';
  script += '      workAreaStart: item.workAreaStart,\n';
  script += '      workAreaDuration: item.workAreaDuration\n';
  script += '    });\n';
  script += '  }\n';
  script += '}\n';
  script += 'compositions;\n';

  return script;
}

/**
 * Generate script to get detailed composition info
 */
export function generateGetCompositionInfo(params: {
  compId?: number;
  compName?: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'var compInfo = {\n';
  script += '  id: comp.id,\n';
  script += '  name: comp.name,\n';
  script += '  width: comp.width,\n';
  script += '  height: comp.height,\n';
  script += '  pixelAspect: comp.pixelAspect,\n';
  script += '  frameRate: comp.frameRate,\n';
  script += '  duration: comp.duration,\n';
  script += '  numLayers: comp.numLayers,\n';
  script += '  workAreaStart: comp.workAreaStart,\n';
  script += '  workAreaDuration: comp.workAreaDuration,\n';
  script += '  bgColor: [comp.bgColor[0], comp.bgColor[1], comp.bgColor[2]],\n';
  script += '  resolutionFactor: [comp.resolutionFactor[0], comp.resolutionFactor[1]],\n';
  script += '  shutterAngle: comp.shutterAngle,\n';
  script += '  shutterPhase: comp.shutterPhase,\n';
  script += '  motionBlur: comp.motionBlur,\n';
  script += '  renderer: comp.renderer\n';
  script += '};\n';

  // Get layer summary
  script += 'compInfo.layers = [];\n';
  script += 'for (var i = 1; i <= comp.numLayers; i++) {\n';
  script += '  var layer = comp.layer(i);\n';
  script += '  compInfo.layers.push({\n';
  script += '    index: layer.index,\n';
  script += '    name: layer.name,\n';
  script += '    enabled: layer.enabled,\n';
  script += '    inPoint: layer.inPoint,\n';
  script += '    outPoint: layer.outPoint\n';
  script += '  });\n';
  script += '}\n';

  script += 'compInfo;\n';

  return script;
}

/**
 * Generate script to render a single frame of a composition to a PNG file
 */
export function generateGetCompositionFrame(params: {
  compId?: number;
  compName?: string;
  time?: number;
  outputPath: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'if (typeof comp.saveFrameToPng !== "function") {\n';
  script += '  throw new Error("saveFrameToPng is not available in this version of After Effects (requires 22.0+)");\n';
  script += '}\n';

  if (params.time !== undefined) {
    script += 'var frameTime = ' + params.time + ';\n';
  } else {
    script += 'var frameTime = comp.time;\n';
  }
  script += 'if (frameTime < 0) { frameTime = 0; }\n';
  script += 'var lastFrameTime = comp.duration - comp.frameDuration;\n';
  script += 'if (frameTime > lastFrameTime) { frameTime = lastFrameTime; }\n';

  // saveFrameToPng is asynchronous: it returns before the PNG is written.
  // The Node server waits for the file to appear, so do not check outFile.exists here.
  script += 'var outFile = new File("' + escapeString(params.outputPath) + '");\n';
  script += 'comp.saveFrameToPng(frameTime, outFile);\n';

  script += generateResultObject({
    path: 'outFile.fsName',
    compName: 'comp.name',
    time: 'frameTime',
    width: 'comp.width',
    height: 'comp.height'
  });

  return script;
}

/**
 * Generate script to set active composition
 */
export function generateSetActiveComposition(params: {
  compId?: number;
  compName?: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'comp.openInViewer();\n';

  script += generateResultObject({
    id: 'comp.id',
    name: 'comp.name'
  });

  return script;
}
