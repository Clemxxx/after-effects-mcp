/**
 * AE-MCP Stdio Server
 *
 * MCP server implementation using stdio transport.
 * Handles all tool definitions and communication with After Effects.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';

import { FileCommunicator } from './ae-integration/file-communicator.js';
import * as generators from './ae-integration/scriptGenerator.js';
import { escapeString } from './ae-integration/generators/helpers.js';
import { createErrorResponse } from './ae-integration/errorHandler.js';
import { Logger } from './types/mcpTypes.js';

// Create logger
const logger: Logger = {
  debug: (msg, meta) => console.error(`[DEBUG] ${msg}`, meta ? JSON.stringify(meta) : ''),
  info: (msg, meta) => console.error(`[INFO] ${msg}`, meta ? JSON.stringify(meta) : ''),
  warn: (msg, meta) => console.error(`[WARN] ${msg}`, meta ? JSON.stringify(meta) : ''),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta) : '')
};

// Tool definitions
const TOOLS = [
  // ============================================
  // PROJECT TOOLS
  // ============================================
  {
    name: 'create_project',
    description: 'Create a new After Effects project',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Optional project name' }
      }
    },
    generator: generators.generateCreateProject
  },
  {
    name: 'open_project',
    description: 'Open an existing After Effects project',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the project file' }
      },
      required: ['path']
    },
    generator: generators.generateOpenProject
  },
  {
    name: 'save_project',
    description: 'Save the current project',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Optional path to save as' }
      }
    },
    generator: generators.generateSaveProject
  },
  {
    name: 'close_project',
    description: 'Close the current project',
    inputSchema: {
      type: 'object',
      properties: {
        save: { type: 'boolean', description: 'Save before closing' }
      }
    },
    generator: generators.generateCloseProject
  },
  {
    name: 'get_project_info',
    description: 'Get information about the current project',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    generator: generators.generateGetProjectInfo
  },
  {
    name: 'import_footage',
    description: 'Import footage file into the project',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to import' },
        name: { type: 'string', description: 'Optional name for the imported item' },
        sequence: { type: 'boolean', description: 'Import as image sequence' },
        forceAlphabetical: { type: 'boolean', description: 'Force alphabetical order for sequences' }
      },
      required: ['path']
    },
    generator: generators.generateImportFootage
  },

  // ============================================
  // COMPOSITION TOOLS
  // ============================================
  {
    name: 'create_composition',
    description: 'Create a new composition',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Composition name' },
        width: { type: 'number', description: 'Width in pixels' },
        height: { type: 'number', description: 'Height in pixels' },
        frameRate: { type: 'number', description: 'Frame rate' },
        duration: { type: 'number', description: 'Duration in seconds' },
        backgroundColor: {
          type: 'object',
          properties: {
            r: { type: 'number' },
            g: { type: 'number' },
            b: { type: 'number' }
          },
          description: 'Background color (0-1 range)'
        }
      },
      required: ['name', 'width', 'height', 'frameRate', 'duration']
    },
    generator: generators.generateCreateComposition
  },
  {
    name: 'modify_composition',
    description: 'Modify an existing composition',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number', description: 'Composition ID' },
        compName: { type: 'string', description: 'Composition name (alternative to ID)' },
        name: { type: 'string', description: 'New name' },
        width: { type: 'number', description: 'New width' },
        height: { type: 'number', description: 'New height' },
        frameRate: { type: 'number', description: 'New frame rate' },
        duration: { type: 'number', description: 'New duration' },
        backgroundColor: { type: 'object', description: 'New background color' }
      }
    },
    generator: generators.generateModifyComposition
  },
  {
    name: 'duplicate_composition',
    description: 'Duplicate a composition',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number', description: 'Composition ID' },
        compName: { type: 'string', description: 'Composition name' },
        newName: { type: 'string', description: 'Name for the duplicate' }
      }
    },
    generator: generators.generateDuplicateComposition
  },
  {
    name: 'delete_composition',
    description: 'Delete a composition',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number', description: 'Composition ID' },
        compName: { type: 'string', description: 'Composition name' }
      }
    },
    generator: generators.generateDeleteComposition
  },
  {
    name: 'list_compositions',
    description: 'List all compositions in the project',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    generator: generators.generateListCompositions
  },
  {
    name: 'get_composition_info',
    description: 'Get detailed information about a composition',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number', description: 'Composition ID' },
        compName: { type: 'string', description: 'Composition name' }
      }
    },
    generator: generators.generateGetCompositionInfo
  },
  {
    name: 'get_composition_frame',
    description: 'Render a single frame of a composition and return it as an image, so you can see the current visual state of your work. Defaults to the active composition at its current playhead time.',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number', description: 'Composition ID' },
        compName: { type: 'string', description: 'Composition name (defaults to the active composition)' },
        time: { type: 'number', description: 'Time in seconds to render (defaults to the current playhead time)' },
        maxSize: { type: 'number', description: 'Maximum width/height of the returned image in pixels (default 1024)' },
        format: { type: 'string', enum: ['jpeg', 'png'], description: 'Returned image format (default jpeg; use png to preserve transparency)' }
      }
    },
    generator: generators.generateGetCompositionFrame,
    returnsImage: true
  },

  // ============================================
  // LAYER TOOLS
  // ============================================
  {
    name: 'add_solid_layer',
    description: 'Add a solid color layer to a composition',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number', description: 'Composition ID' },
        compName: { type: 'string', description: 'Composition name' },
        name: { type: 'string', description: 'Layer name' },
        color: {
          type: 'object',
          properties: { r: { type: 'number' }, g: { type: 'number' }, b: { type: 'number' } },
          description: 'Color (0-1 range)'
        },
        width: { type: 'number', description: 'Width (defaults to comp width)' },
        height: { type: 'number', description: 'Height (defaults to comp height)' },
        duration: { type: 'number', description: 'Duration in seconds' },
        startTime: { type: 'number', description: 'Start time in seconds' }
      },
      required: ['name', 'color']
    },
    generator: generators.generateAddSolidLayer
  },
  {
    name: 'add_text_layer',
    description: 'Add a text layer to a composition. The anchor point is centered on the text block, so `position` is the CENTER of the text and defaults to the center of the comp',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number', description: 'Composition ID' },
        compName: { type: 'string', description: 'Composition name' },
        text: { type: 'string', description: 'Text content' },
        name: { type: 'string', description: 'Layer name' },
        position: { type: 'object', description: 'Center of the text block (default: comp center)', properties: { x: { type: 'number' }, y: { type: 'number' } } },
        fontSize: { type: 'number', description: 'Font size in pixels' },
        fontFamily: { type: 'string', description: 'Font family name' },
        color: { type: 'object', description: 'Text color (0-1 range)' },
        justification: { type: 'string', enum: ['LEFT', 'CENTER', 'RIGHT'] }
      },
      required: ['text']
    },
    generator: generators.generateAddTextLayer
  },
  {
    name: 'add_text_layer_advanced',
    description: 'Add a text layer with advanced styling options. The anchor point is centered on the text block, so `position` is the CENTER of the text and defaults to the center of the comp',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        text: { type: 'string', description: 'Text content' },
        name: { type: 'string' },
        position: { type: 'object', description: 'Center of the text block (default: comp center)' },
        fontSize: { type: 'number' },
        fontFamily: { type: 'string' },
        color: { type: 'object' },
        justification: { type: 'string' },
        tracking: { type: 'number', description: 'Letter spacing' },
        leading: { type: 'number', description: 'Line height' },
        baselineShift: { type: 'number' },
        strokeColor: { type: 'object' },
        strokeWidth: { type: 'number' },
        strokeOverFill: { type: 'boolean' }
      },
      required: ['text']
    },
    generator: generators.generateAddTextLayerAdvanced
  },
  {
    name: 'add_shape_layer',
    description: 'Add a shape layer to a composition',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        name: { type: 'string', description: 'Layer name' },
        shape: { type: 'string', enum: ['rectangle', 'ellipse', 'polygon', 'star'], description: 'Shape type' },
        size: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } } },
        position: { type: 'object' },
        fillColor: { type: 'object', description: 'Fill color (0-1 range)' },
        strokeColor: { type: 'object', description: 'Stroke color (0-1 range)' },
        strokeWidth: { type: 'number' },
        points: { type: 'number', description: 'Number of points for polygon/star' },
        innerRadius: { type: 'number', description: 'Inner radius for star' },
        outerRadius: { type: 'number', description: 'Outer radius for polygon/star' }
      }
    },
    generator: generators.generateAddShapeLayer
  },
  {
    name: 'add_null_layer',
    description: 'Add a null object layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        name: { type: 'string', description: 'Layer name' }
      }
    },
    generator: generators.generateAddNullLayer
  },
  {
    name: 'add_adjustment_layer',
    description: 'Add an adjustment layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        name: { type: 'string', description: 'Layer name' }
      }
    },
    generator: generators.generateAddAdjustmentLayer
  },
  {
    name: 'add_camera_layer',
    description: 'Add a camera layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string', enum: ['ONE_NODE', 'TWO_NODE'] },
        zoom: { type: 'number' }
      }
    },
    generator: generators.generateAddCameraLayer
  },
  {
    name: 'add_light_layer',
    description: 'Add a light layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string', enum: ['PARALLEL', 'SPOT', 'POINT', 'AMBIENT'] },
        color: { type: 'object' },
        intensity: { type: 'number' }
      }
    },
    generator: generators.generateAddLightLayer
  },
  {
    name: 'add_av_layer',
    description: 'Add a footage item as a layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        itemId: { type: 'number', description: 'Project item ID' },
        itemName: { type: 'string', description: 'Project item name' },
        startTime: { type: 'number' }
      }
    },
    generator: generators.generateAddAVLayer
  },
  {
    name: 'precompose_layers',
    description: 'Precompose selected layers into a new composition',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndices: { type: 'array', items: { type: 'number' }, description: 'Layer indices to precompose' },
        name: { type: 'string', description: 'Name for the new precomp' },
        moveAttributes: { type: 'boolean', description: 'Move attributes to new comp' }
      },
      required: ['layerIndices', 'name']
    },
    generator: generators.generatePrecomposeLayers
  },
  {
    name: 'modify_layer',
    description: 'Modify layer properties',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        name: { type: 'string' },
        enabled: { type: 'boolean' },
        solo: { type: 'boolean' },
        shy: { type: 'boolean' },
        locked: { type: 'boolean' },
        inPoint: { type: 'number' },
        outPoint: { type: 'number' },
        startTime: { type: 'number' },
        stretch: { type: 'number' },
        blendMode: { type: 'string' },
        parent: { type: 'number' },
        is3D: { type: 'boolean' },
        position: { type: 'object' },
        scale: { type: 'array', items: { type: 'number' } },
        rotation: { type: 'number' },
        opacity: { type: 'number' }
      }
    },
    generator: generators.generateModifyLayer
  },
  {
    name: 'delete_layer',
    description: 'Delete a layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' }
      }
    },
    generator: generators.generateDeleteLayer
  },
  {
    name: 'copy_layers',
    description: 'Copy layers from one composition to another (or duplicate within the same comp) via AE\'s clipboard — full fidelity: text animators, keyframes, expressions, masks, effects. Parent links between layers copied in the same call are preserved (a parent left out is dropped). Omit layerIndices/layerNames to copy all layers. Note: replaces the current clipboard content.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceCompId: { type: 'number' },
        sourceCompName: { type: 'string', description: 'Source composition (defaults to active comp)' },
        targetCompId: { type: 'number' },
        targetCompName: { type: 'string', description: 'Target composition (defaults to active comp)' },
        layerIndices: { type: 'array', items: { type: 'number' }, description: 'Indices of layers to copy' },
        layerNames: { type: 'array', items: { type: 'string' }, description: 'Names of layers to copy (all matches are copied)' },
        timeOffset: { type: 'number', description: 'Seconds added to each copied layer\'s startTime (to retime the copy)' }
      }
    },
    generator: generators.generateCopyLayers
  },
  {
    name: 'reorder_layer',
    description: 'Move a layer in the stacking order: to top/bottom, before/after another layer, or to an absolute index. Useful to put a background layer behind everything after adding it.',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number', description: 'Layer to move (by index)' },
        layerName: { type: 'string', description: 'Layer to move (by name)' },
        position: { type: 'string', enum: ['top', 'bottom', 'before', 'after', 'index'], description: 'Where to move the layer' },
        targetIndex: { type: 'number', description: 'Destination index (required when position is "index"; 1 = top)' },
        referenceLayerIndex: { type: 'number', description: 'Reference layer (required when position is "before"/"after")' },
        referenceLayerName: { type: 'string', description: 'Reference layer by name (alternative to referenceLayerIndex)' }
      },
      required: ['position']
    },
    generator: generators.generateReorderLayer
  },
  {
    name: 'align_layers',
    description: 'Align/center one or several layers on the composition canvas (horizontal: left/center/right, vertical: top/middle/bottom). By default several layers are treated as ONE group: their combined bounding box is aligned and every layer moves by the same delta, preserving the relative layout between them. Bounds account for anchor point, scale, rotation and parenting; animated positions are shifted keyframe by keyframe.',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerNames: { type: 'array', items: { type: 'string' }, description: 'Layers to align (by name)' },
        layerIndices: { type: 'array', items: { type: 'number' }, description: 'Layers to align (by 1-based index)' },
        horizontal: { type: 'string', enum: ['left', 'center', 'right'], description: 'Horizontal alignment on the canvas' },
        vertical: { type: 'string', enum: ['top', 'middle', 'bottom'], description: 'Vertical alignment on the canvas' },
        mode: { type: 'string', enum: ['group', 'individual'], description: 'group (default): move all layers by one shared delta, keeping their relative layout. individual: align each layer separately' },
        padding: { type: 'number', description: 'Margin in pixels kept from the canvas edge for left/right/top/bottom alignments (default 0)' },
        time: { type: 'number', description: 'Time in seconds at which bounds are measured (default: current comp time). Matters for animated/text layers' }
      }
    },
    generator: generators.generateAlignLayers
  },
  {
    name: 'get_text_styles',
    description: 'Read the per-character formatting of a text layer as style runs (font, size, colors, faux bold/italic...). Detects mixed formatting within a single text block. Requires AE 24.3+.',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' }
      }
    },
    generator: generators.generateGetTextStyles
  },
  {
    name: 'set_text_content',
    description: 'Replace the text content of an existing text layer. Text animators, keyframes and expressions are preserved (they live on the layer, not the text). Ideal after copy_layers from a template: copy the animated layer, then swap its text. Note: if the layer had MIXED per-character styles, re-apply them with set_text_style_range afterwards.',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        text: { type: 'string', description: 'New text content (use \\n for line breaks)' }
      },
      required: ['text']
    },
    generator: generators.generateSetTextContent
  },
  {
    name: 'set_text_style_range',
    description: 'Apply a style (font, size, color, faux bold/italic, tracking) to a character range inside a text layer, preserving the rest of the formatting — e.g. make one word bold italic. Select the range with matchText (first occurrence) or startIndex/endIndex. Requires AE 24.3+.',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        matchText: { type: 'string', description: 'Substring to style (first occurrence). Alternative to startIndex/endIndex.' },
        startIndex: { type: 'number', description: '0-based start of the range (inclusive)' },
        endIndex: { type: 'number', description: 'End of the range (exclusive)' },
        font: { type: 'string', description: 'PostScript font name (e.g. "Montserrat-BoldItalic"). Alternative to fontFamily+fontStyle.' },
        fontFamily: { type: 'string', description: 'Font family name (e.g. "Montserrat"); requires fontStyle' },
        fontStyle: { type: 'string', description: 'Style name (e.g. "Bold Italic")' },
        fontSize: { type: 'number' },
        fillColor: { type: 'object', properties: { r: { type: 'number' }, g: { type: 'number' }, b: { type: 'number' } }, description: 'RGB 0-1' },
        fauxBold: { type: 'boolean' },
        fauxItalic: { type: 'boolean' },
        tracking: { type: 'number' }
      }
    },
    generator: generators.generateSetTextStyleRange
  },
  {
    name: 'list_layers',
    description: 'List all layers in a composition (stacking order, type, timing, source item name of footage/precomp layers). Pass includeText: true to also get the text content of every text layer — useful to understand a whole composition in one call',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        includeText: { type: 'boolean', description: 'Include the text content of text layers (default false)' }
      }
    },
    generator: generators.generateListLayers
  },
  {
    name: 'get_layer_info',
    description: 'Get detailed information about a layer, including transform values, text properties for text layers (font, size, fill/stroke colors, justification, content), and color for solid layers',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' }
      }
    },
    generator: generators.generateGetLayerInfo
  },

  // ============================================
  // KEYFRAME TOOLS
  // ============================================
  {
    name: 'set_keyframe',
    description: 'Set a keyframe on a property',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string', description: 'Property name (e.g., "position", "scale", "opacity")' },
        time: { type: 'number', description: 'Time in seconds' },
        value: { description: 'Property value (number, array, or string)' }
      },
      required: ['property', 'time', 'value']
    },
    generator: generators.generateSetKeyframe
  },
  {
    name: 'set_keyframe_advanced',
    description: 'Set a keyframe with easing options',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string' },
        time: { type: 'number' },
        value: {},
        inType: { type: 'string', enum: ['LINEAR', 'BEZIER', 'HOLD'] },
        outType: { type: 'string', enum: ['LINEAR', 'BEZIER', 'HOLD'] },
        inEase: { type: 'object', properties: { speed: { type: 'number' }, influence: { type: 'number' } } },
        outEase: { type: 'object', properties: { speed: { type: 'number' }, influence: { type: 'number' } } }
      },
      required: ['property', 'time', 'value']
    },
    generator: generators.generateSetKeyframeAdvanced
  },
  {
    name: 'set_keyframes',
    description: 'Set MANY keyframes on one property in a single call (50, 100+ keys at once) — e.g. all the Source Text changes of a subtitle layer, or a full Position path. The layer/property is resolved once and every key is added in one script, so it is far faster than repeated set_keyframe calls. Each keyframe can carry its own interpolation and easing.',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string', description: 'Property name (e.g., "Position", "Opacity", "Source Text")' },
        keyframes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              time: { type: 'number', description: 'Time in seconds' },
              value: { description: 'Property value (number, array, or string for Source Text)' },
              inType: { type: 'string', enum: ['LINEAR', 'BEZIER', 'HOLD'] },
              outType: { type: 'string', enum: ['LINEAR', 'BEZIER', 'HOLD'] },
              inEase: { type: 'object', properties: { speed: { type: 'number' }, influence: { type: 'number' } } },
              outEase: { type: 'object', properties: { speed: { type: 'number' }, influence: { type: 'number' } } }
            },
            required: ['time', 'value']
          },
          description: 'All keyframes to set on this property, in one go'
        }
      },
      required: ['property', 'keyframes']
    },
    generator: generators.generateSetKeyframes
  },
  {
    name: 'apply_easy_ease',
    description: 'Apply easy ease to keyframes',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string' },
        keyframeIndex: { type: 'number', description: 'Specific keyframe (optional, applies to all if omitted)' },
        type: { type: 'string', enum: ['IN', 'OUT', 'BOTH'] }
      },
      required: ['property']
    },
    generator: generators.generateApplyEasyEase
  },
  {
    name: 'set_temporal_ease',
    description: 'Set temporal ease on a keyframe',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string' },
        keyframeIndex: { type: 'number' },
        inSpeed: { type: 'number' },
        inInfluence: { type: 'number' },
        outSpeed: { type: 'number' },
        outInfluence: { type: 'number' }
      },
      required: ['property', 'keyframeIndex']
    },
    generator: generators.generateSetTemporalEase
  },
  {
    name: 'offset_keyframes',
    description: 'Offset all keyframes in time',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string' },
        offset: { type: 'number', description: 'Time offset in seconds' }
      },
      required: ['property', 'offset']
    },
    generator: generators.generateOffsetKeyframes
  },
  {
    name: 'scale_keyframe_timing',
    description: 'Scale keyframe timing (speed up or slow down)',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string' },
        scale: { type: 'number', description: 'Scale factor (2 = twice as slow, 0.5 = twice as fast)' },
        anchorTime: { type: 'number', description: 'Anchor point for scaling' }
      },
      required: ['property', 'scale']
    },
    generator: generators.generateScaleKeyframeTiming
  },
  {
    name: 'reverse_keyframes',
    description: 'Reverse keyframe order',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string' }
      },
      required: ['property']
    },
    generator: generators.generateReverseKeyframes
  },
  {
    name: 'copy_keyframes',
    description: 'Copy keyframes from one property to another',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        sourceLayerIndex: { type: 'number' },
        sourceLayerName: { type: 'string' },
        sourceProperty: { type: 'string' },
        targetLayerIndex: { type: 'number' },
        targetLayerName: { type: 'string' },
        targetProperty: { type: 'string' },
        timeOffset: { type: 'number' }
      },
      required: ['sourceProperty']
    },
    generator: generators.generateCopyKeyframes
  },
  {
    name: 'get_keyframes',
    description: 'Get all keyframes from a property',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string' }
      },
      required: ['property']
    },
    generator: generators.generateGetKeyframes
  },

  // ============================================
  // EXPRESSION TOOLS
  // ============================================
  {
    name: 'set_expression',
    description: 'Set an expression on a property',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string' },
        expression: { type: 'string', description: 'JavaScript expression' }
      },
      required: ['property', 'expression']
    },
    generator: generators.generateSetExpression
  },
  {
    name: 'get_expression',
    description: 'Get the expression from a property',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string' }
      },
      required: ['property']
    },
    generator: generators.generateGetExpression
  },
  {
    name: 'remove_expression',
    description: 'Remove expression from a property',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string' }
      },
      required: ['property']
    },
    generator: generators.generateRemoveExpression
  },
  {
    name: 'enable_expression',
    description: 'Enable or disable an expression',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string' },
        enabled: { type: 'boolean' }
      },
      required: ['property', 'enabled']
    },
    generator: generators.generateEnableExpression
  },
  {
    name: 'add_expression_control',
    description: 'Add an expression control effect to a layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        controlType: { type: 'string', enum: ['slider', 'color', 'point', 'checkbox', 'dropdown', 'angle', 'layer'] },
        controlName: { type: 'string' },
        defaultValue: {}
      },
      required: ['controlType', 'controlName']
    },
    generator: generators.generateAddExpressionControl
  },
  {
    name: 'apply_expression_template',
    description: 'Apply a pre-built expression template',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        property: { type: 'string' },
        template: {
          type: 'string',
          enum: [
            'wiggle', 'wiggleSmooth', 'wiggleFadeIn', 'wiggleFadeOut',
            'loopCycle', 'loopPingpong', 'loopOffset', 'loopContinue',
            'time', 'clock', 'countdown', 'frameNumber',
            'matchPosition', 'offsetPosition', 'inverseRotation', 'followPath',
            'bounce', 'inertia', 'overshoot', 'springy'
          ]
        },
        params: { type: 'object', description: 'Template parameters' }
      },
      required: ['property', 'template']
    },
    generator: generators.generateApplyExpressionTemplate
  },
  {
    name: 'link_properties',
    description: 'Link two properties with an expression',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        sourceLayerIndex: { type: 'number' },
        sourceLayerName: { type: 'string' },
        sourceProperty: { type: 'string' },
        targetLayerIndex: { type: 'number' },
        targetLayerName: { type: 'string' },
        targetProperty: { type: 'string' },
        offset: { description: 'Offset value (number or array)' }
      },
      required: ['sourceProperty', 'targetProperty']
    },
    generator: generators.generateLinkProperties
  },

  // ============================================
  // EFFECT TOOLS
  // ============================================
  {
    name: 'apply_effect',
    description: 'Apply an effect to a layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        effect: { type: 'string', description: 'Effect name or match name' },
        properties: { type: 'object', description: 'Effect property values' }
      },
      required: ['effect']
    },
    generator: generators.generateApplyEffect
  },
  {
    name: 'apply_effect_template',
    description: 'Apply a pre-configured effect template',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        template: {
          type: 'string',
          enum: [
            'gaussianBlur', 'directionalBlur', 'glassBlur',
            'curves', 'colorBalance', 'brightnessContrast', 'vibrance',
            'glow', 'dropShadow', 'vignette',
            'cinematicLook', 'vhsRetro', 'neonGlow', 'filmGrain',
            'chromaticAberration', 'duotone'
          ]
        },
        intensity: { type: 'number', description: 'Effect intensity (0-100)' },
        customParams: { type: 'object', description: 'Custom effect parameters' }
      },
      required: ['template']
    },
    generator: generators.generateApplyEffectTemplate
  },
  {
    name: 'modify_effect_properties',
    description: 'Modify properties of an existing effect',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        effectIndex: { type: 'number' },
        effectName: { type: 'string' },
        properties: { type: 'object' }
      },
      required: ['properties']
    },
    generator: generators.generateModifyEffectProperties
  },
  {
    name: 'remove_effect',
    description: 'Remove an effect from a layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        effectIndex: { type: 'number' },
        effectName: { type: 'string' }
      }
    },
    generator: generators.generateRemoveEffect
  },
  {
    name: 'reorder_effects',
    description: 'Reorder effects on a layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        effectIndex: { type: 'number' },
        newIndex: { type: 'number' }
      },
      required: ['effectIndex', 'newIndex']
    },
    generator: generators.generateReorderEffects
  },
  {
    name: 'copy_effects',
    description: 'Copy effects from one layer to another',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        sourceLayerIndex: { type: 'number' },
        sourceLayerName: { type: 'string' },
        targetLayerIndex: { type: 'number' },
        targetLayerName: { type: 'string' },
        effectIndices: { type: 'array', items: { type: 'number' } }
      }
    },
    generator: generators.generateCopyEffects
  },
  {
    name: 'list_effects',
    description: 'List all effects on a layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' }
      }
    },
    generator: generators.generateListEffects
  },

  // ============================================
  // TEMPLATE TOOLS (Motion Graphics)
  // ============================================
  {
    name: 'create_lower_third',
    description: 'Create a lower third graphic with animated text',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        style: { type: 'string', enum: ['modern', 'corporate', 'news', 'minimal', 'social'] },
        name: { type: 'string', description: 'Person/entity name' },
        title: { type: 'string', description: 'Title/role' },
        subtitle: { type: 'string', description: 'Optional subtitle' },
        duration: { type: 'number', description: 'Duration in seconds' },
        animateIn: { type: 'boolean' },
        animateOut: { type: 'boolean' },
        primaryColor: { type: 'object' },
        secondaryColor: { type: 'object' },
        textColor: { type: 'object' },
        position: { type: 'string', enum: ['bottomLeft', 'bottomRight', 'bottomCenter'] }
      },
      required: ['style', 'name', 'title']
    },
    generator: generators.generateCreateLowerThird
  },
  {
    name: 'create_title_card',
    description: 'Create a title card with animations',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        style: { type: 'string', enum: ['cinematic', 'documentary', 'social', 'minimal'] },
        title: { type: 'string' },
        subtitle: { type: 'string' },
        duration: { type: 'number' },
        fontFamily: { type: 'string' },
        fontSize: { type: 'number' },
        color: { type: 'object' },
        backgroundColor: { type: 'object' }
      },
      required: ['style', 'title']
    },
    generator: generators.generateCreateTitleCard
  },
  {
    name: 'create_transition',
    description: 'Create a transition effect layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        type: { type: 'string', enum: ['wipe_left', 'wipe_right', 'wipe_up', 'wipe_down', 'dissolve', 'push', 'slide', 'zoom'] },
        duration: { type: 'number' },
        easing: { type: 'string', enum: ['linear', 'easeIn', 'easeOut', 'easeInOut'] },
        color: { type: 'object' }
      },
      required: ['type']
    },
    generator: generators.generateCreateTransition
  },
  {
    name: 'create_logo_reveal',
    description: 'Create an animated logo reveal',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        logoItemId: { type: 'number', description: 'Project item ID of logo' },
        logoItemName: { type: 'string', description: 'Project item name of logo' },
        style: { type: 'string', enum: ['fade', 'scale', 'slide', 'spin', 'glitch', 'particle'] },
        duration: { type: 'number' },
        backgroundColor: { type: 'object' }
      }
    },
    generator: generators.generateCreateLogoReveal
  },
  {
    name: 'create_text_animator',
    description: 'Add a text animator to a text layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        animatorType: { type: 'string', enum: ['typewriter', 'fadeInChars', 'scaleInChars', 'slideInChars', 'randomize', 'wave'] },
        duration: { type: 'number' },
        delay: { type: 'number', description: 'Delay between characters' }
      },
      required: ['animatorType']
    },
    generator: generators.generateCreateTextAnimator
  },

  // ============================================
  // ASSET TOOLS
  // ============================================
  {
    name: 'import_folder',
    description: 'Import all files from a folder',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Folder path' },
        recursive: { type: 'boolean', description: 'Include subfolders' }
      },
      required: ['path']
    },
    generator: generators.generateImportFolder
  },
  {
    name: 'replace_footage',
    description: 'Replace footage item with a new file',
    inputSchema: {
      type: 'object',
      properties: {
        itemId: { type: 'number' },
        itemName: { type: 'string' },
        newPath: { type: 'string', description: 'Path to new footage file' }
      },
      required: ['newPath']
    },
    generator: generators.generateReplaceFootage
  },
  {
    name: 'organize_project_items',
    description: 'Organize project items into folders',
    inputSchema: {
      type: 'object',
      properties: {
        structure: { type: 'string', enum: ['type', 'usage', 'custom'] },
        customFolders: { type: 'array', items: { type: 'string' } }
      }
    },
    generator: generators.generateOrganizeProjectItems
  },
  {
    name: 'move_project_items',
    description: 'Move project items into a folder by name or ID. Creates the folder path (nested with "/", e.g. "PRODUCT/AUDIOS") if it does not exist. Items can be footage, comps, solids or folders.',
    inputSchema: {
      type: 'object',
      properties: {
        folderPath: { type: 'string', description: 'Destination folder path, "/" separated for nesting (e.g. "NEO-SERUM/AUDIOS"). Missing folders are created.' },
        itemNames: { type: 'array', items: { type: 'string' }, description: 'Names of project items to move (all items matching a name are moved)' },
        itemIds: { type: 'array', items: { type: 'number' }, description: 'IDs of project items to move' }
      },
      required: ['folderPath']
    },
    generator: generators.generateMoveProjectItems
  },
  {
    name: 'find_missing_footage',
    description: 'Find all missing footage items in the project',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    generator: generators.generateFindMissingFootage
  },
  {
    name: 'collect_files',
    description: 'Collect project files to a folder',
    inputSchema: {
      type: 'object',
      properties: {
        outputPath: { type: 'string', description: 'Output folder path' },
        includeFootage: { type: 'boolean' },
        includeFonts: { type: 'boolean' }
      },
      required: ['outputPath']
    },
    generator: generators.generateCollectFiles
  },
  {
    name: 'reduce_project',
    description: 'Remove unused items from project',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' }
      }
    },
    generator: generators.generateReduceProject
  },

  // ============================================
  // MARKER TOOLS
  // ============================================
  {
    name: 'add_composition_marker',
    description: 'Add a marker to a composition',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        time: { type: 'number', description: 'Time in seconds' },
        comment: { type: 'string' },
        duration: { type: 'number' },
        chapter: { type: 'string' },
        url: { type: 'string' },
        frameTarget: { type: 'string' },
        cuePointName: { type: 'string' }
      },
      required: ['time']
    },
    generator: generators.generateAddCompositionMarker
  },
  {
    name: 'add_layer_marker',
    description: 'Add a marker to a layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        time: { type: 'number' },
        comment: { type: 'string' },
        duration: { type: 'number' }
      },
      required: ['time']
    },
    generator: generators.generateAddLayerMarker
  },
  {
    name: 'get_markers',
    description: 'Get all markers from a composition or layer',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' }
      }
    },
    generator: generators.generateGetMarkers
  },
  {
    name: 'delete_marker',
    description: 'Delete a marker',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        layerIndex: { type: 'number' },
        layerName: { type: 'string' },
        markerIndex: { type: 'number' }
      },
      required: ['markerIndex']
    },
    generator: generators.generateDeleteMarker
  },
  {
    name: 'set_work_area',
    description: 'Set the work area of a composition',
    inputSchema: {
      type: 'object',
      properties: {
        compId: { type: 'number' },
        compName: { type: 'string' },
        start: { type: 'number', description: 'Start time in seconds' },
        duration: { type: 'number', description: 'Duration in seconds' }
      },
      required: ['start', 'duration']
    },
    generator: generators.generateSetWorkArea
  },

  // ============================================
  // BATCH TOOL
  // ============================================
  {
    name: 'batch_execute',
    description: 'Execute several MCP tool calls in a single round-trip to After Effects. Each step is any other tool name with its params (e.g. 10x modify_layer). Steps run in order; failures are reported per step without aborting the rest (unless stopOnError). Much faster than calling tools one by one.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tool: { type: 'string', description: 'Name of the MCP tool to run' },
              params: { type: 'object', description: 'Arguments for that tool' }
            },
            required: ['tool']
          },
          description: 'Ordered list of tool calls to run in one go'
        },
        stopOnError: { type: 'boolean', description: 'Stop at the first failing step (default: false, remaining steps still run)' }
      },
      required: ['steps']
    },
    generator: generateBatchExecute
  }
];

/**
 * Generate one ExtendScript that runs several tools' scripts in sequence.
 * Each step's script is embedded as a string and eval'd so its completion
 * value (the tool's result object) can be captured per step. Mutating steps
 * keep their own sequential (not nested) undo groups.
 */
function generateBatchExecute(params: {
  steps: Array<{ tool: string; params?: Record<string, unknown> }>;
  stopOnError?: boolean;
}): string {
  if (!params.steps || !Array.isArray(params.steps) || params.steps.length === 0) {
    throw new Error('steps must be a non-empty array');
  }

  const stepScripts: string[] = [];
  const stepNames: string[] = [];
  for (let i = 0; i < params.steps.length; i++) {
    const step = params.steps[i];
    if (step.tool === 'batch_execute') {
      throw new Error('batch_execute cannot be nested (step ' + (i + 1) + ')');
    }
    const stepTool = toolMap.get(step.tool);
    if (!stepTool) {
      throw new Error('Unknown tool in batch step ' + (i + 1) + ': ' + step.tool);
    }
    if ((stepTool as any).returnsImage) {
      throw new Error('Tool "' + step.tool + '" returns an image and cannot run in a batch (step ' + (i + 1) + ')');
    }
    stepScripts.push(stepTool.generator(step.params as any || {}));
    stepNames.push(step.tool);
  }

  let script = '';
  script += 'var __batchScripts = [';
  script += stepScripts.map(s => '"' + escapeString(s) + '"').join(', ');
  script += '];\n';
  script += 'var __batchNames = [';
  script += stepNames.map(n => '"' + escapeString(n) + '"').join(', ');
  script += '];\n';
  script += 'var __batchResults = [];\n';
  script += 'var __batchFailed = 0;\n';
  script += 'for (var __b = 0; __b < __batchScripts.length; __b++) {\n';
  script += '  try {\n';
  script += '    var __stepResult = eval(__batchScripts[__b]);\n';
  script += '    __batchResults.push({ step: __b + 1, tool: __batchNames[__b], success: true, data: __stepResult });\n';
  script += '  } catch (__err) {\n';
  script += '    __batchFailed++;\n';
  script += '    __batchResults.push({ step: __b + 1, tool: __batchNames[__b], success: false, error: __err.toString() });\n';
  if (params.stopOnError) {
    script += '    break;\n';
  }
  script += '  }\n';
  script += '}\n';
  script += 'var result = {\n';
  script += '  success: __batchFailed === 0,\n';
  script += '  stepCount: __batchScripts.length,\n';
  script += '  executedCount: __batchResults.length,\n';
  script += '  failedCount: __batchFailed,\n';
  script += '  results: __batchResults\n';
  script += '};\n';
  script += 'result;\n';

  return script;
}

// Create tool lookup map
const toolMap = new Map<string, typeof TOOLS[0]>();
TOOLS.forEach(tool => toolMap.set(tool.name, tool));

// Create communicator
const communicator = new FileCommunicator({ logger });

// Create MCP server
const server = new Server(
  {
    name: 'ae-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  };
});

/**
 * Wait for a file to exist with a stable, non-zero size (two consecutive
 * identical size readings), so we never read a partially written frame.
 */
async function waitForFile(filePath: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  let lastSize = -1;

  while (Date.now() - start < timeoutMs) {
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.size > 0 && stats.size === lastSize) {
        return;
      }
      lastSize = stats.size;
    } catch {
      // File not there yet
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(
    `Frame file was not written within ${timeoutMs}ms: ${filePath}. ` +
    'The composition may be too heavy to render, or saveFrameToPng failed silently.'
  );
}

/**
 * Execute a tool that returns an image: render to a temp PNG in After Effects,
 * then read, downscale, and return it as an MCP image content block.
 */
async function executeImageTool(tool: typeof TOOLS[0], args: Record<string, any>) {
  const tempPath = path
    .join(os.tmpdir(), `ae-mcp-frame-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.png`)
    .replace(/\\/g, '/');

  const script = tool.generator({ ...args, outputPath: tempPath } as any);
  const result = await communicator.executeScript(script);

  if (!result.success) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ],
      isError: true
    };
  }

  try {
    // saveFrameToPng returns before the PNG is written; wait for the file to land
    await waitForFile(tempPath, 30000);

    const maxSize = typeof args.maxSize === 'number'
      ? Math.max(64, Math.min(2048, Math.round(args.maxSize)))
      : 1024;
    const usePng = args.format === 'png';

    const resized = sharp(tempPath).resize({
      width: maxSize,
      height: maxSize,
      fit: 'inside',
      withoutEnlargement: true
    });

    const buffer = usePng
      ? await resized.png().toBuffer()
      : await resized.flatten({ background: '#000000' }).jpeg({ quality: 80 }).toBuffer();

    return {
      content: [
        {
          type: 'image',
          data: buffer.toString('base64'),
          mimeType: usePng ? 'image/png' : 'image/jpeg'
        },
        {
          type: 'text',
          text: JSON.stringify({ success: true, data: result.data, executionTime: result.executionTime })
        }
      ],
      isError: false
    };
  } finally {
    fs.promises.unlink(tempPath).catch(() => {});
  }
}

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = toolMap.get(name);
  if (!tool) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` })
        }
      ],
      isError: true
    };
  }

  try {
    // Image tools render to a temp file and return the image itself
    if ((tool as any).returnsImage) {
      return await executeImageTool(tool, (args as any) || {});
    }

    // Generate the script
    const script = tool.generator(args as any || {});

    // Execute in After Effects
    const result = await communicator.executeScript(script);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ],
      isError: !result.success
    };
  } catch (error) {
    const errorResponse = createErrorResponse(error instanceof Error ? error : String(error));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResponse)
        }
      ],
      isError: true
    };
  }
});

// List resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'ae://project/current',
        name: 'Current Project',
        description: 'Information about the current After Effects project',
        mimeType: 'application/json'
      },
      {
        uri: 'ae://compositions',
        name: 'Compositions',
        description: 'List of all compositions in the project',
        mimeType: 'application/json'
      }
    ]
  };
});

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    let script: string;

    if (uri === 'ae://project/current') {
      script = generators.generateGetProjectInfo();
    } else if (uri === 'ae://compositions') {
      script = generators.generateListCompositions();
    } else {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: 'Unknown resource' })
          }
        ]
      };
    }

    const result = await communicator.executeScript(script);

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(result.data || result)
        }
      ]
    };
  } catch (error) {
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ error: String(error) })
        }
      ]
    };
  }
});

// List prompts handler
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: 'create-animation',
        description: 'Create an animated composition with common motion graphics elements'
      },
      {
        name: 'setup-project',
        description: 'Set up a new project with standard folder structure'
      }
    ]
  };
});

// Get prompt handler
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name } = request.params;

  if (name === 'create-animation') {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Help me create an animated composition. I want to add text with entrance animations, shapes, and smooth transitions.'
          }
        }
      ]
    };
  } else if (name === 'setup-project') {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Set up a new After Effects project with organized folders for footage, compositions, and precomps.'
          }
        }
      ]
    };
  }

  return {
    messages: []
  };
});

// Main entry point
async function main() {
  logger.info('Starting AE-MCP server...');

  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info('AE-MCP server running');
}

main().catch((error) => {
  logger.error('Fatal error', { error: String(error) });
  process.exit(1);
});
