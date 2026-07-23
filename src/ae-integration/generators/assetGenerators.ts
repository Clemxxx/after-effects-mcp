/**
 * Asset Management Script Generators
 *
 * Generates ES3-compatible ExtendScript for asset management operations.
 */

import {
  escapeString,
  arrayToES3,
  generateProjectCheck,
  generateCompAccess,
  wrapInUndoGroup,
  generateResultObject
} from './helpers.js';

/**
 * Generate script to import a folder of footage
 */
export function generateImportFolder(params: {
  path: string;
  recursive?: boolean;
}): string {
  let script = '';
  script += generateProjectCheck();

  script += 'var folder = new Folder("' + escapeString(params.path) + '");\n';
  script += 'if (!folder.exists) {\n';
  script += '  throw new Error("Folder not found: ' + escapeString(params.path) + '");\n';
  script += '}\n';

  script += 'var importedItems = [];\n';

  script += 'function importFilesFromFolder(f, parentFolder) {\n';
  script += '  var files = f.getFiles();\n';
  script += '  for (var i = 0; i < files.length; i++) {\n';
  script += '    var file = files[i];\n';
  script += '    if (file instanceof Folder) {\n';

  if (params.recursive) {
    script += '      var subFolder = app.project.items.addFolder(file.name);\n';
    script += '      if (parentFolder) subFolder.parentFolder = parentFolder;\n';
    script += '      importFilesFromFolder(file, subFolder);\n';
  }

  script += '    } else if (file instanceof File) {\n';
  script += '      try {\n';
  script += '        var importOptions = new ImportOptions(file);\n';
  script += '        var imported = app.project.importFile(importOptions);\n';
  script += '        if (parentFolder) imported.parentFolder = parentFolder;\n';
  script += '        importedItems.push({ id: imported.id, name: imported.name });\n';
  script += '      } catch (e) {\n';
  script += '        // Skip unsupported files\n';
  script += '      }\n';
  script += '    }\n';
  script += '  }\n';
  script += '}\n';

  script += 'var rootFolder = app.project.items.addFolder(folder.name);\n';
  script += 'importFilesFromFolder(folder, rootFolder);\n';

  script += generateResultObject({
    folderId: 'rootFolder.id',
    folderName: 'rootFolder.name',
    importedCount: 'importedItems.length',
    items: 'importedItems'
  });

  return wrapInUndoGroup(script, 'Import Folder');
}

/**
 * Generate script to replace footage
 */
export function generateReplaceFootage(params: {
  itemId?: number;
  itemName?: string;
  newPath: string;
}): string {
  let script = '';
  script += generateProjectCheck();

  // Find the item
  if (params.itemId) {
    script += 'var item = app.project.itemByID(' + params.itemId + ');\n';
  } else if (params.itemName) {
    script += 'var item = null;\n';
    script += 'for (var i = 1; i <= app.project.numItems; i++) {\n';
    script += '  if (app.project.item(i).name === "' + escapeString(params.itemName) + '") {\n';
    script += '    item = app.project.item(i);\n';
    script += '    break;\n';
    script += '  }\n';
    script += '}\n';
  }

  script += 'if (!item) {\n';
  script += '  throw new Error("Item not found");\n';
  script += '}\n';

  script += 'if (!(item instanceof FootageItem)) {\n';
  script += '  throw new Error("Item is not a footage item");\n';
  script += '}\n';

  script += 'var newFile = new File("' + escapeString(params.newPath) + '");\n';
  script += 'if (!newFile.exists) {\n';
  script += '  throw new Error("New file not found: ' + escapeString(params.newPath) + '");\n';
  script += '}\n';

  script += 'item.replace(newFile);\n';

  script += generateResultObject({
    success: 'true',
    itemId: 'item.id',
    itemName: 'item.name',
    newPath: '"' + escapeString(params.newPath) + '"'
  });

  return wrapInUndoGroup(script, 'Replace Footage');
}

/**
 * Generate script to organize project items
 */
export function generateOrganizeProjectItems(params: {
  structure?: string;
  customFolders?: string[];
}): string {
  let script = '';
  script += generateProjectCheck();

  const structure = params.structure || 'type';

  script += 'var organizedCount = 0;\n';

  if (structure === 'type') {
    // Create folders by type
    script += 'var compsFolder = null;\n';
    script += 'var footageFolder = null;\n';
    script += 'var solidsFolder = null;\n';

    script += 'for (var i = 1; i <= app.project.numItems; i++) {\n';
    script += '  var item = app.project.item(i);\n';
    script += '  if (item instanceof FolderItem) continue;\n';
    script += '  if (item.parentFolder !== app.project.rootFolder) continue;\n';

    script += '  if (item instanceof CompItem) {\n';
    script += '    if (!compsFolder) {\n';
    script += '      compsFolder = app.project.items.addFolder("Compositions");\n';
    script += '    }\n';
    script += '    item.parentFolder = compsFolder;\n';
    script += '    organizedCount++;\n';
    script += '  } else if (item instanceof FootageItem) {\n';
    script += '    if (item.mainSource instanceof SolidSource) {\n';
    script += '      if (!solidsFolder) {\n';
    script += '        solidsFolder = app.project.items.addFolder("Solids");\n';
    script += '      }\n';
    script += '      item.parentFolder = solidsFolder;\n';
    script += '    } else {\n';
    script += '      if (!footageFolder) {\n';
    script += '        footageFolder = app.project.items.addFolder("Footage");\n';
    script += '      }\n';
    script += '      item.parentFolder = footageFolder;\n';
    script += '    }\n';
    script += '    organizedCount++;\n';
    script += '  }\n';
    script += '}\n';
  } else if (structure === 'usage') {
    // Create folders for used and unused items
    script += 'var usedFolder = app.project.items.addFolder("Used");\n';
    script += 'var unusedFolder = app.project.items.addFolder("Unused");\n';

    script += 'for (var i = 1; i <= app.project.numItems; i++) {\n';
    script += '  var item = app.project.item(i);\n';
    script += '  if (item instanceof FolderItem) continue;\n';
    script += '  if (item.parentFolder !== app.project.rootFolder) continue;\n';

    script += '  if (item.usedIn && item.usedIn.length > 0) {\n';
    script += '    item.parentFolder = usedFolder;\n';
    script += '  } else {\n';
    script += '    item.parentFolder = unusedFolder;\n';
    script += '  }\n';
    script += '  organizedCount++;\n';
    script += '}\n';
  } else if (structure === 'custom' && params.customFolders) {
    // Create custom folders
    script += 'var folders = {};\n';
    for (let i = 0; i < params.customFolders.length; i++) {
      const folderName = params.customFolders[i];
      script += 'folders["' + escapeString(folderName) + '"] = app.project.items.addFolder("' + escapeString(folderName) + '");\n';
    }
  }

  script += generateResultObject({
    success: 'true',
    organizedCount: 'organizedCount'
  });

  return wrapInUndoGroup(script, 'Organize Project');
}

/**
 * Generate script to move project items into a (possibly nested) folder,
 * creating the folder path if it does not exist.
 */
export function generateMoveProjectItems(params: {
  folderPath: string;
  itemNames?: string[];
  itemIds?: number[];
}): string {
  const pathParts = params.folderPath
    .split('/')
    .map(function (p) { return p.trim(); })
    .filter(function (p) { return p.length > 0; });

  if (pathParts.length === 0) {
    throw new Error('folderPath must contain at least one folder name');
  }

  let script = '';
  script += generateProjectCheck();

  // Walk the folder path from the root, creating missing folders
  script += 'var pathParts = ' + arrayToES3(pathParts) + ';\n';
  script += 'var currentFolder = app.project.rootFolder;\n';
  script += 'for (var p = 0; p < pathParts.length; p++) {\n';
  script += '  var found = null;\n';
  script += '  for (var c = 1; c <= currentFolder.numItems; c++) {\n';
  script += '    var child = currentFolder.item(c);\n';
  script += '    if (child instanceof FolderItem && child.name === pathParts[p]) {\n';
  script += '      found = child;\n';
  script += '      break;\n';
  script += '    }\n';
  script += '  }\n';
  script += '  if (!found) {\n';
  script += '    found = app.project.items.addFolder(pathParts[p]);\n';
  script += '    found.parentFolder = currentFolder;\n';
  script += '  }\n';
  script += '  currentFolder = found;\n';
  script += '}\n';
  script += 'var targetFolder = currentFolder;\n';

  // Collect items first, then move — moving while iterating reorders indices
  script += 'var itemsToMove = [];\n';
  script += 'var notFound = [];\n';

  if (params.itemIds && params.itemIds.length > 0) {
    script += 'var ids = ' + arrayToES3(params.itemIds) + ';\n';
    script += 'for (var d = 0; d < ids.length; d++) {\n';
    script += '  var byId = app.project.itemByID(ids[d]);\n';
    script += '  if (byId) {\n';
    script += '    itemsToMove.push(byId);\n';
    script += '  } else {\n';
    script += '    notFound.push("id:" + ids[d]);\n';
    script += '  }\n';
    script += '}\n';
  }

  if (params.itemNames && params.itemNames.length > 0) {
    script += 'var names = ' + arrayToES3(params.itemNames) + ';\n';
    script += 'for (var n = 0; n < names.length; n++) {\n';
    script += '  var matched = false;\n';
    script += '  for (var i = 1; i <= app.project.numItems; i++) {\n';
    script += '    if (app.project.item(i).name === names[n]) {\n';
    script += '      itemsToMove.push(app.project.item(i));\n';
    script += '      matched = true;\n';
    script += '    }\n';
    script += '  }\n';
    script += '  if (!matched) {\n';
    script += '    notFound.push(names[n]);\n';
    script += '  }\n';
    script += '}\n';
  }

  script += 'var movedItems = [];\n';
  script += 'var skipped = [];\n';
  script += 'for (var m = 0; m < itemsToMove.length; m++) {\n';
  script += '  var moveItem = itemsToMove[m];\n';
  // A folder cannot be moved into itself or one of its descendants
  script += '  var invalid = false;\n';
  script += '  if (moveItem instanceof FolderItem) {\n';
  script += '    var anc = targetFolder;\n';
  script += '    while (anc) {\n';
  script += '      if (anc === moveItem) {\n';
  script += '        invalid = true;\n';
  script += '        break;\n';
  script += '      }\n';
  script += '      if (anc === app.project.rootFolder) break;\n';
  script += '      anc = anc.parentFolder;\n';
  script += '    }\n';
  script += '  }\n';
  script += '  if (invalid) {\n';
  script += '    skipped.push(moveItem.name);\n';
  script += '  } else {\n';
  script += '    moveItem.parentFolder = targetFolder;\n';
  script += '    movedItems.push(moveItem.name);\n';
  script += '  }\n';
  script += '}\n';

  script += generateResultObject({
    success: 'true',
    folderPath: '"' + escapeString(params.folderPath) + '"',
    folderId: 'targetFolder.id',
    movedCount: 'movedItems.length',
    movedItems: 'movedItems',
    notFound: 'notFound',
    skipped: 'skipped'
  });

  return wrapInUndoGroup(script, 'Move Project Items');
}

/**
 * Generate script to find missing footage
 */
export function generateFindMissingFootage(): string {
  let script = '';
  script += generateProjectCheck();

  script += 'var missingItems = [];\n';

  script += 'for (var i = 1; i <= app.project.numItems; i++) {\n';
  script += '  var item = app.project.item(i);\n';
  script += '  if (item instanceof FootageItem) {\n';
  script += '    if (item.footageMissing) {\n';
  script += '      var info = {};\n';
  script += '      info.id = item.id;\n';
  script += '      info.name = item.name;\n';
  script += '      if (item.file) {\n';
  script += '        info.path = item.file.fsName;\n';
  script += '      }\n';
  script += '      missingItems.push(info);\n';
  script += '    }\n';
  script += '  }\n';
  script += '}\n';

  script += 'var result = {};\n';
  script += 'result.missingCount = missingItems.length;\n';
  script += 'result.items = missingItems;\n';
  script += 'result;\n';

  return script;
}

/**
 * Generate script to collect files
 */
export function generateCollectFiles(params: {
  outputPath: string;
  includeFootage?: boolean;
  includeFonts?: boolean;
}): string {
  let script = '';
  script += generateProjectCheck();

  // Note: AE's collectFiles is limited in scripting
  // This creates a manual collection

  script += 'var outputFolder = new Folder("' + escapeString(params.outputPath) + '");\n';
  script += 'if (!outputFolder.exists) {\n';
  script += '  outputFolder.create();\n';
  script += '}\n';

  script += 'var collectedFiles = [];\n';

  if (params.includeFootage !== false) {
    script += 'var footageFolder = new Folder(outputFolder.fsName + "/footage");\n';
    script += 'footageFolder.create();\n';

    script += 'for (var i = 1; i <= app.project.numItems; i++) {\n';
    script += '  var item = app.project.item(i);\n';
    script += '  if (item instanceof FootageItem && item.file) {\n';
    script += '    try {\n';
    script += '      var srcFile = item.file;\n';
    script += '      var destFile = new File(footageFolder.fsName + "/" + srcFile.name);\n';
    script += '      if (srcFile.copy(destFile.fsName)) {\n';
    script += '        collectedFiles.push(srcFile.name);\n';
    script += '      }\n';
    script += '    } catch (e) {}\n';
    script += '  }\n';
    script += '}\n';
  }

  // Save project to output folder
  script += 'var projectFile = new File(outputFolder.fsName + "/" + (app.project.file ? app.project.file.name : "collected_project.aep"));\n';
  script += 'app.project.save(projectFile);\n';

  script += generateResultObject({
    outputPath: 'outputFolder.fsName',
    collectedCount: 'collectedFiles.length',
    files: 'collectedFiles'
  });

  return wrapInUndoGroup(script, 'Collect Files');
}

/**
 * Generate script to reduce project to used items
 */
export function generateReduceProject(params: {
  compId?: number;
  compName?: string;
}): string {
  let script = '';
  script += generateProjectCheck();
  script += generateCompAccess(params.compId, params.compName);

  script += 'app.project.reduceProject([comp]);\n';

  script += generateResultObject({
    success: 'true',
    compName: 'comp.name',
    remainingItems: 'app.project.numItems'
  });

  return wrapInUndoGroup(script, 'Reduce Project');
}

/**
 * Generate script to set proxy for footage
 */
export function generateSetProxy(params: {
  itemId?: number;
  itemName?: string;
  proxyPath: string;
}): string {
  let script = '';
  script += generateProjectCheck();

  // Find the item
  if (params.itemId) {
    script += 'var item = app.project.itemByID(' + params.itemId + ');\n';
  } else if (params.itemName) {
    script += 'var item = null;\n';
    script += 'for (var i = 1; i <= app.project.numItems; i++) {\n';
    script += '  if (app.project.item(i).name === "' + escapeString(params.itemName) + '") {\n';
    script += '    item = app.project.item(i);\n';
    script += '    break;\n';
    script += '  }\n';
    script += '}\n';
  }

  script += 'if (!item) {\n';
  script += '  throw new Error("Item not found");\n';
  script += '}\n';

  script += 'var proxyFile = new File("' + escapeString(params.proxyPath) + '");\n';
  script += 'if (!proxyFile.exists) {\n';
  script += '  throw new Error("Proxy file not found: ' + escapeString(params.proxyPath) + '");\n';
  script += '}\n';

  script += 'item.setProxy(proxyFile);\n';

  script += generateResultObject({
    success: 'true',
    itemName: 'item.name',
    proxyPath: '"' + escapeString(params.proxyPath) + '"'
  });

  return wrapInUndoGroup(script, 'Set Proxy');
}

/**
 * Generate script to remove proxy
 */
export function generateRemoveProxy(params: {
  itemId?: number;
  itemName?: string;
}): string {
  let script = '';
  script += generateProjectCheck();

  // Find the item
  if (params.itemId) {
    script += 'var item = app.project.itemByID(' + params.itemId + ');\n';
  } else if (params.itemName) {
    script += 'var item = null;\n';
    script += 'for (var i = 1; i <= app.project.numItems; i++) {\n';
    script += '  if (app.project.item(i).name === "' + escapeString(params.itemName) + '") {\n';
    script += '    item = app.project.item(i);\n';
    script += '    break;\n';
    script += '  }\n';
    script += '}\n';
  }

  script += 'if (!item) {\n';
  script += '  throw new Error("Item not found");\n';
  script += '}\n';

  script += 'item.setProxyToNone();\n';

  script += generateResultObject({
    success: 'true',
    itemName: 'item.name'
  });

  return wrapInUndoGroup(script, 'Remove Proxy');
}
