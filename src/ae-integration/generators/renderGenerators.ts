/**
 * Render Queue Script Generators
 *
 * Generates ES3-compatible ExtendScript for listing render presets and
 * rendering / exporting compositions through the After Effects render queue.
 */

import {
  escapeString,
  generateProjectCheck,
  generateCompAccess
} from './helpers.js';

/** ES3 helpers shared by the render tools */
const RENDER_HELPERS =
  'function __rqStatus(st) {\n' +
  '  if (st === RQItemStatus.QUEUED) return "QUEUED";\n' +
  '  if (st === RQItemStatus.UNQUEUED) return "UNQUEUED";\n' +
  '  if (st === RQItemStatus.NEEDS_OUTPUT) return "NEEDS_OUTPUT";\n' +
  '  if (st === RQItemStatus.RENDERING) return "RENDERING";\n' +
  '  if (st === RQItemStatus.USER_STOPPED) return "USER_STOPPED";\n' +
  '  if (st === RQItemStatus.ERR_STOPPED) return "ERR_STOPPED";\n' +
  '  if (st === RQItemStatus.DONE) return "DONE";\n' +
  '  if (st === RQItemStatus.WILL_CONTINUE) return "WILL_CONTINUE";\n' +
  '  return "UNKNOWN";\n' +
  '}\n' +
  // Template lists include internal "_HIDDEN ..." entries: drop them
  'function __visibleTemplates(arr) {\n' +
  '  var out = [];\n' +
  '  for (var i = 0; i < arr.length; i++) {\n' +
  '    if (String(arr[i]).indexOf("_HIDDEN") !== 0) out.push(String(arr[i]));\n' +
  '  }\n' +
  '  return out;\n' +
  '}\n' +
  'function __hasTemplate(arr, name) {\n' +
  '  for (var i = 0; i < arr.length; i++) { if (String(arr[i]) === name) return true; }\n' +
  '  return false;\n' +
  '}\n' +
  'function __rqItemInfo(it, idx) {\n' +
  '  var info = { index: idx, comp: it.comp ? it.comp.name : null, compId: it.comp ? it.comp.id : null, status: __rqStatus(it.status), render: it.render, outputs: [] };\n' +
  '  try { info.elapsedSeconds = it.elapsedSeconds; } catch (e1) {}\n' +
  '  try {\n' +
  '    var st = it.getSettings(GetSettingsFormat.STRING);\n' +
  '    info.timeSpan = st["Time Span"];\n' +
  '    info.timeSpanStart = st["Time Span Start"];\n' +
  '    info.timeSpanEnd = st["Time Span End"];\n' +
  '    info.quality = st["Quality"];\n' +
  '    info.resolution = st["Resolution"];\n' +
  '  } catch (e2) {}\n' +
  '  for (var o = 1; o <= it.numOutputModules; o++) {\n' +
  '    var om = it.outputModule(o);\n' +
  '    var oi = { index: o, name: om.name, file: om.file ? om.file.fsName : null };\n' +
  '    try { var os = om.getSettings(GetSettingsFormat.STRING); oi.format = os["Format"]; oi.channels = os["Channels"]; } catch (e3) {}\n' +
  '    info.outputs.push(oi);\n' +
  '  }\n' +
  '  return info;\n' +
  '}\n';

/**
 * Generate script to list the render queue and the available Render
 * Settings / Output Module templates (the "quality presets").
 */
export function generateGetRenderQueue(params: {
  includeTemplates?: boolean;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += RENDER_HELPERS;
  script += 'var rq = app.project.renderQueue;\n';
  script += 'var items = [];\n';
  script += 'for (var i = 1; i <= rq.numItems; i++) { items.push(__rqItemInfo(rq.item(i), i)); }\n';
  script += 'var result = { numItems: rq.numItems, rendering: rq.rendering, items: items };\n';
  script += 'try { result.canQueueInAME = rq.canQueueInAME; } catch (eAme) { result.canQueueInAME = false; }\n';

  if (params.includeTemplates !== false) {
    // Templates are only readable through a render queue item: reuse the
    // first one, or add a temporary item for the first comp and remove it.
    script += 'var probe = null; var tempProbe = false;\n';
    script += 'if (rq.numItems > 0) { probe = rq.item(1); }\n';
    script += 'else {\n';
    script += '  for (var pi = 1; pi <= app.project.numItems; pi++) {\n';
    script += '    if (app.project.item(pi) instanceof CompItem) { probe = rq.items.add(app.project.item(pi)); tempProbe = true; break; }\n';
    script += '  }\n';
    script += '}\n';
    script += 'if (probe !== null) {\n';
    script += '  try {\n';
    script += '    result.renderSettingsTemplates = __visibleTemplates(probe.templates);\n';
    script += '    result.outputModuleTemplates = __visibleTemplates(probe.outputModule(1).templates);\n';
    script += '  } finally {\n';
    script += '    if (tempProbe) { try { probe.remove(); } catch (eRm) {} }\n';
    script += '  }\n';
    script += '} else {\n';
    script += '  result.renderSettingsTemplates = [];\n';
    script += '  result.outputModuleTemplates = [];\n';
    script += '  result.note = "No composition in the project: templates cannot be listed";\n';
    script += '}\n';
  }

  script += 'result;\n';
  return script;
}

/**
 * Generate script to export a composition through the render queue.
 * Adds a render queue item, applies the requested Render Settings and
 * Output Module templates, points the output at the requested path, sets
 * the time span, then either renders now (blocking, Node side waits with a
 * long timeout), leaves it queued, or hands it to Adobe Media Encoder.
 */
export function generateRenderComposition(params: {
  compId?: number;
  compName?: string;
  outputPath?: string;
  outputModuleTemplate?: string;
  renderSettingsTemplate?: string;
  timeSpan?: 'comp' | 'workArea' | 'custom';
  startTime?: number;
  endTime?: number;
  mode?: 'render' | 'queue' | 'ame';
  renderOnlyThisItem?: boolean;
  overwrite?: boolean;
  timeoutSeconds?: number;
}): string {
  const mode = params.mode || 'render';
  const timeSpan = params.timeSpan || (params.startTime !== undefined || params.endTime !== undefined ? 'custom' : 'comp');
  if (timeSpan === 'custom' && (params.startTime === undefined || params.endTime === undefined)) {
    throw new Error('timeSpan "custom" requires both startTime and endTime (seconds)');
  }
  if (timeSpan === 'custom' && (params.endTime as number) <= (params.startTime as number)) {
    throw new Error('endTime must be greater than startTime');
  }

  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);
  script += RENDER_HELPERS;

  script += 'var rq = app.project.renderQueue;\n';
  script += 'if (rq.rendering) { throw new Error("The render queue is already rendering — wait for it to finish (get_render_queue) before starting another export"); }\n';
  script += 'var mode = "' + mode + '";\n';
  script += 'var renderOnlyThis = ' + (params.renderOnlyThisItem !== false) + ';\n';
  script += 'var overwrite = ' + (params.overwrite !== false) + ';\n';
  script += 'var warnings = [];\n';
  script += 'var savedWorkArea = null;\n';
  script += 'function __restoreWorkArea() {\n';
  script += '  if (savedWorkArea !== null) { try { comp.workAreaStart = savedWorkArea[0]; comp.workAreaDuration = savedWorkArea[1]; } catch (eW) {} savedWorkArea = null; }\n';
  script += '}\n';

  // Remember other items' render flags so only this export runs
  script += 'var savedFlags = [];\n';
  script += 'for (var si = 1; si <= rq.numItems; si++) { savedFlags.push(rq.item(si).render); }\n';
  script += 'function __restoreFlags() {\n';
  script += '  for (var ri = 0; ri < savedFlags.length; ri++) {\n';
  script += '    try { if (rq.item(ri + 1).status !== RQItemStatus.DONE) { rq.item(ri + 1).render = savedFlags[ri]; } } catch (eF) {}\n';
  script += '  }\n';
  script += '}\n';

  script += 'var rqItem = rq.items.add(comp);\n';
  script += 'var itemIndex = rq.numItems;\n';
  script += 'var __out = null;\n';
  script += 'try {\n';

  // Render settings template
  if (params.renderSettingsTemplate !== undefined) {
    script += '  var rsName = "' + escapeString(params.renderSettingsTemplate) + '";\n';
    script += '  if (!__hasTemplate(rqItem.templates, rsName)) {\n';
    script += '    throw new Error("Render Settings template not found: " + rsName + ". Available: " + __visibleTemplates(rqItem.templates).join(" | "));\n';
    script += '  }\n';
    script += '  rqItem.applyTemplate(rsName);\n';
  }

  // Output module template (the quality preset)
  script += '  var om = rqItem.outputModule(1);\n';
  if (params.outputModuleTemplate !== undefined) {
    script += '  var omName = "' + escapeString(params.outputModuleTemplate) + '";\n';
    script += '  if (!__hasTemplate(om.templates, omName)) {\n';
    script += '    throw new Error("Output Module template not found: " + omName + ". Available: " + __visibleTemplates(om.templates).join(" | "));\n';
    script += '  }\n';
    script += '  om.applyTemplate(omName);\n';
  }

  // Work out the extension the template produces, and whether it is a sequence
  script += '  var defName = "";\n';
  script += '  try { defName = om.file ? String(om.file.name) : ""; } catch (eDn) {}\n';
  script += '  var extM = defName.match(/\\.([A-Za-z0-9]+)$/);\n';
  script += '  var ext = extM ? "." + extM[1] : "";\n';
  script += '  var isSequence = defName.indexOf("[#") !== -1;\n';
  script += '  try { var fmt0 = String(om.getSettings(GetSettingsFormat.STRING)["Format"]); if (/sequence/i.test(fmt0)) { isSequence = true; } } catch (eFm) {}\n';

  // Resolve the destination path
  if (params.outputPath !== undefined) {
    script += '  var wanted = "' + escapeString(params.outputPath.replace(/\\/g, '/')) + '";\n';
  } else {
    script += '  var wanted = "";\n';
    script += '  if (app.project.file) { wanted = app.project.file.parent.fsName.replace(/\\\\/g, "/") + "/"; }\n';
    script += '  else { wanted = Folder.desktop.fsName.replace(/\\\\/g, "/") + "/"; }\n';
  }
  script += '  var finalPath = wanted;\n';
  script += '  var endsWithSlash = /[\\/\\\\]$/.test(wanted);\n';
  script += '  var asFolder = new Folder(wanted);\n';
  script += '  if (endsWithSlash || asFolder.exists) {\n';
  script += '    finalPath = wanted.replace(/[\\/\\\\]$/, "") + "/" + comp.name + (isSequence ? "_[#####]" : "") + ext;\n';
  script += '  } else if (!/\\.[A-Za-z0-9]+$/.test(wanted)) {\n';
  script += '    finalPath = wanted + (isSequence && wanted.indexOf("[#") === -1 ? "_[#####]" : "") + ext;\n';
  script += '  } else if (isSequence && wanted.indexOf("[#") === -1) {\n';
  script += '    finalPath = wanted.replace(/(\\.[A-Za-z0-9]+)$/, "_[#####]$1");\n';
  script += '  }\n';
  script += '  var outFile = new File(finalPath);\n';
  script += '  var parentFolder = outFile.parent;\n';
  script += '  if (parentFolder && !parentFolder.exists) {\n';
  script += '    if (!parentFolder.create()) { throw new Error("Cannot create the output folder: " + parentFolder.fsName); }\n';
  script += '  }\n';
  script += '  if (outFile.exists && !isSequence) {\n';
  script += '    if (overwrite) { if (!outFile.remove()) { throw new Error("Output file exists and cannot be removed (in use?): " + outFile.fsName); } }\n';
  script += '    else { throw new Error("Output file already exists: " + outFile.fsName + " (pass overwrite: true)"); }\n';
  script += '  }\n';
  script += '  om.file = outFile;\n';
  script += '  if (ext !== "" && String(om.file.name).toLowerCase().indexOf(ext.toLowerCase()) === -1) { warnings.push("The output extension does not match the template default (" + ext + ")"); }\n';

  // Time span
  if (timeSpan === 'workArea') {
    script += '  try { rqItem.setSettings({ "Time Span": "Work Area Only" }); } catch (eTs) { warnings.push("Could not set time span to Work Area Only: " + eTs.toString()); }\n';
  } else if (timeSpan === 'custom') {
    script += '  var tsStart = ' + params.startTime + '; var tsEnd = ' + params.endTime + ';\n';
    script += '  if (tsEnd > comp.duration) { tsEnd = comp.duration; warnings.push("endTime clamped to the comp duration"); }\n';
    script += '  var customOk = false;\n';
    script += '  try {\n';
    // Setting Start/End directly switches the item to "Custom" (AE rejects
    // "Time Span": "Custom" as a value). End first so the span never inverts.
    script += '    rqItem.setSettings({ "Time Span End": tsEnd });\n';
    script += '    rqItem.setSettings({ "Time Span Start": tsStart });\n';
    script += '    var chk = rqItem.getSettings(GetSettingsFormat.NUMBER);\n';
    script += '    customOk = Math.abs(Number(chk["Time Span Start"]) - tsStart) < comp.frameDuration && Math.abs(Number(chk["Time Span End"]) - tsEnd) < comp.frameDuration;\n';
    script += '  } catch (eC) { customOk = false; }\n';
    script += '  if (!customOk) {\n';
    // Fallback (older AE): drive the span through the comp work area
    script += '    savedWorkArea = [comp.workAreaStart, comp.workAreaDuration];\n';
    script += '    comp.workAreaStart = tsStart;\n';
    script += '    comp.workAreaDuration = tsEnd - tsStart;\n';
    script += '    rqItem.setSettings({ "Time Span": "Work Area Only" });\n';
    script += '    warnings.push("Custom time span applied through the comp work area (" + tsStart + "s-" + tsEnd + "s)" + (mode === "render" ? ", restored after the render" : " — the work area stays changed until the item is rendered"));\n';
    script += '  }\n';
  } else {
    script += '  try { rqItem.setSettings({ "Time Span": "Length of Comp" }); } catch (eTl) {}\n';
  }

  script += '  var result = { success: true, mode: mode, comp: comp.name, compId: comp.id, queueIndex: itemIndex, outputPath: om.file.fsName, outputModule: om.name, isSequence: isSequence };\n';
  script += '  try { var rs = rqItem.getSettings(GetSettingsFormat.STRING); result.timeSpan = rs["Time Span"]; result.timeSpanStart = rs["Time Span Start"]; result.timeSpanEnd = rs["Time Span End"]; result.quality = rs["Quality"]; result.resolution = rs["Resolution"]; } catch (eRs) {}\n';
  script += '  try { var os = om.getSettings(GetSettingsFormat.STRING); result.format = os["Format"]; } catch (eOs) {}\n';

  script += '  if (mode === "queue") {\n';
  script += '    rqItem.render = true;\n';
  script += '    result.status = __rqStatus(rqItem.status);\n';
  script += '    result.message = "Added to the render queue (not rendered). Render it from After Effects, or call render_composition with mode render.";\n';
  script += '  } else if (mode === "ame") {\n';
  script += '    var canAme = false;\n';
  script += '    try { canAme = rq.canQueueInAME; } catch (eCa) { canAme = false; }\n';
  script += '    if (!canAme) { throw new Error("Adobe Media Encoder is not available from this After Effects (canQueueInAME is false)"); }\n';
  script += '    if (renderOnlyThis) { for (var ai = 1; ai < itemIndex; ai++) { try { rq.item(ai).render = false; } catch (eA) {} } }\n';
  script += '    rqItem.render = true;\n';
  script += '    rq.queueInAME(true);\n';
  script += '    __restoreFlags();\n';
  script += '    result.status = "SENT_TO_AME";\n';
  script += '    result.message = "Sent to Adobe Media Encoder, encoding starts there (After Effects is not blocked). Check the file at outputPath when AME finishes.";\n';
  script += '  } else {\n';
  script += '    if (renderOnlyThis) { for (var di = 1; di < itemIndex; di++) { try { rq.item(di).render = false; } catch (eD) {} } }\n';
  script += '    rqItem.render = true;\n';
  script += '    var t0 = new Date().getTime();\n';
  script += '    rq.render();\n';
  script += '    var elapsed = (new Date().getTime() - t0) / 1000;\n';
  script += '    __restoreFlags();\n';
  script += '    __restoreWorkArea();\n';
  script += '    result.status = __rqStatus(rqItem.status);\n';
  script += '    result.elapsedSeconds = Math.round(elapsed * 10) / 10;\n';
  script += '    if (rqItem.status === RQItemStatus.DONE) {\n';
  script += '      var written = new File(om.file.fsName);\n';
  script += '      if (!isSequence) { result.fileExists = written.exists; if (written.exists) { result.fileSizeBytes = written.length; } }\n';
  script += '      result.message = "Render finished";\n';
  script += '    } else if (rqItem.status === RQItemStatus.RENDERING || rqItem.status === RQItemStatus.QUEUED || rqItem.status === RQItemStatus.WILL_CONTINUE) {\n';
  script += '      result.message = "Render started but had not finished when the call returned — poll get_render_queue until this item is DONE";\n';
  script += '    } else {\n';
  script += '      var logMsg = "";\n';
  script += '      try { logMsg = String(rqItem.logType); } catch (eL) {}\n';
  script += '      throw new Error("Render did not complete (status " + __rqStatus(rqItem.status) + "). Check the render queue panel / render log in After Effects." + (logMsg ? " logType=" + logMsg : ""));\n';
  script += '    }\n';
  script += '  }\n';
  script += '  if (warnings.length > 0) { result.warnings = warnings; }\n';
  script += '  __out = result;\n';
  script += '} catch (eMain) {\n';
  script += '  __restoreFlags();\n';
  script += '  __restoreWorkArea();\n';
  script += '  try { if (rqItem.status !== RQItemStatus.DONE && rqItem.status !== RQItemStatus.RENDERING) { rqItem.remove(); } } catch (eRem) {}\n';
  script += '  throw eMain;\n';
  script += '}\n';
  script += '__out;\n';

  return script;
}
