/**
 * File-based Communication Bridge for After Effects
 *
 * Handles communication between Node.js MCP server and After Effects CEP extension
 * using filesystem as the transport layer.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger, MCPResponse, PendingCommand, CommandFile, ResponseFile } from '../types/mcpTypes.js';

// Default logger if none provided
const defaultLogger: Logger = {
  debug: (msg: string, meta?: any) => console.log('[DEBUG]', msg, meta || ''),
  info: (msg: string, meta?: any) => console.log('[INFO]', msg, meta || ''),
  warn: (msg: string, meta?: any) => console.warn('[WARN]', msg, meta || ''),
  error: (msg: string, meta?: any) => console.error('[ERROR]', msg, meta || '')
};

export class FileCommunicator {
  private commandsFolder: string;
  private clientPrefix: string;
  private pendingCommands: Map<string, PendingCommand> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;
  private logger: Logger;
  private commandTimeout: number;
  private pollRate: number;
  private isConnected: boolean = false;

  constructor(options: {
    logger?: Logger;
    commandTimeout?: number;
    pollRate?: number;
  } = {}) {
    this.logger = options.logger || defaultLogger;
    this.commandTimeout = options.commandTimeout || 60000; // 60 seconds
    this.pollRate = options.pollRate || 100; // 100ms

    // Generate unique client prefix
    this.clientPrefix = `client_${process.pid}_${Date.now()}`;

    // Set up commands folder in user's Documents
    const documentsPath = path.join(os.homedir(), 'Documents');
    this.commandsFolder = path.join(documentsPath, 'ae-mcp-commands');

    this.logger.info('FileCommunicator initialized', {
      clientPrefix: this.clientPrefix,
      commandsFolder: this.commandsFolder
    });
  }

  /**
   * Initialize the communicator and start polling for responses
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.debug('Already connected');
      return;
    }

    // Ensure commands folder exists
    try {
      if (!fs.existsSync(this.commandsFolder)) {
        fs.mkdirSync(this.commandsFolder, { recursive: true });
        this.logger.info('Created commands folder', { path: this.commandsFolder });
      }
    } catch (error) {
      this.logger.error('Failed to create commands folder', { error });
      throw new Error(`Failed to create commands folder: ${this.commandsFolder}`);
    }

    // Start polling for responses
    this.startPolling();
    this.isConnected = true;
    this.logger.info('FileCommunicator connected');
  }

  /**
   * Stop polling and cleanup
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    this.stopPolling();

    // Reject all pending commands
    for (const [commandId, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Communicator disconnected'));
    }
    this.pendingCommands.clear();

    this.isConnected = false;
    this.logger.info('FileCommunicator disconnected');
  }

  /**
   * Execute a script in After Effects and return the result
   */
  async executeScript(script: string, timeoutMs?: number): Promise<MCPResponse> {
    if (!this.isConnected) {
      await this.connect();
    }

    const commandId = this.generateCommandId();
    const commandFile: CommandFile = {
      id: commandId,
      script: script,
      timestamp: Date.now()
    };

    const commandPath = path.join(
      this.commandsFolder,
      `${this.clientPrefix}_${commandId}.json`
    );

    return new Promise<MCPResponse>((resolve, reject) => {
      // Set up timeout
      const effectiveTimeout = timeoutMs && timeoutMs > 0 ? timeoutMs : this.commandTimeout;
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        this.cleanupCommandFile(commandPath);

        this.logger.error('Command timeout', { commandId });
        reject(new Error(
          `Command timeout after ${effectiveTimeout}ms. ` +
          'Make sure After Effects is running and the CEP extension is loaded. ' +
          'The extension panel should be visible in Window > Extensions > AE-MCP.'
        ));
      }, effectiveTimeout);

      // Store pending command
      this.pendingCommands.set(commandId, {
        resolve,
        reject,
        timeout,
        createdAt: Date.now()
      });

      // Write command file
      try {
        fs.writeFileSync(commandPath, JSON.stringify(commandFile, null, 2), 'utf8');
        this.logger.debug('Command written', { commandId, path: commandPath });
      } catch (error) {
        this.pendingCommands.delete(commandId);
        clearTimeout(timeout);
        this.logger.error('Failed to write command', { commandId, error });
        reject(new Error(`Failed to write command file: ${error}`));
      }
    });
  }

  /**
   * Start polling for response files
   */
  private startPolling(): void {
    if (this.pollInterval) {
      return;
    }

    this.pollInterval = setInterval(() => {
      this.checkForResponses();
    }, this.pollRate);

    this.logger.debug('Started polling for responses', { rate: this.pollRate });
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      this.logger.debug('Stopped polling');
    }
  }

  /**
   * Check for response files and process them
   */
  private checkForResponses(): void {
    if (this.pendingCommands.size === 0) {
      return;
    }

    try {
      const files = fs.readdirSync(this.commandsFolder);

      for (const file of files) {
        // Look for response files matching our client prefix
        if (file.startsWith(this.clientPrefix) && file.endsWith('.json.response')) {
          this.processResponseFile(file);
        }
      }
    } catch (error) {
      // Folder might not exist or be inaccessible temporarily
      this.logger.debug('Error reading commands folder', { error });
    }
  }

  /**
   * Process a response file
   */
  private processResponseFile(filename: string): void {
    const responsePath = path.join(this.commandsFolder, filename);

    // Extract command ID from filename
    // Format: {clientPrefix}_{commandId}.json.response
    const match = filename.match(new RegExp(`^${this.clientPrefix}_(.+)\\.json\\.response$`));
    if (!match) {
      this.logger.warn('Invalid response filename', { filename });
      return;
    }

    const commandId = match[1];
    const pending = this.pendingCommands.get(commandId);

    if (!pending) {
      // Response for unknown command - clean it up
      this.cleanupResponseFile(responsePath);
      return;
    }

    // Read response with retries (file might still be written)
    let response: ResponseFile | null = null;
    let retries = 3;

    while (retries > 0 && response === null) {
      try {
        const content = fs.readFileSync(responsePath, 'utf8');
        response = JSON.parse(content) as ResponseFile;
      } catch (error) {
        retries--;
        if (retries > 0) {
          // Wait a bit before retry
          this.sleep(50);
        } else {
          this.logger.error('Failed to read response file', { commandId, error });
          pending.reject(new Error(`Failed to read response: ${error}`));
          this.pendingCommands.delete(commandId);
          clearTimeout(pending.timeout);
          this.cleanupResponseFile(responsePath);
          return;
        }
      }
    }

    if (!response) {
      return;
    }

    // Validate response structure
    if (typeof response.success !== 'boolean') {
      this.logger.error('Invalid response structure', { commandId, response });
      pending.reject(new Error('Invalid response structure from After Effects'));
      this.pendingCommands.delete(commandId);
      clearTimeout(pending.timeout);
      this.cleanupResponseFile(responsePath);
      return;
    }

    // Resolve or reject based on success
    clearTimeout(pending.timeout);
    this.pendingCommands.delete(commandId);

    const executionTime = Date.now() - pending.createdAt;

    if (response.success) {
      this.logger.debug('Command succeeded', { commandId, executionTime });
      pending.resolve({
        success: true,
        data: response.data,
        executionTime
      });
    } else {
      this.logger.warn('Command failed', { commandId, error: response.error });
      pending.resolve({
        success: false,
        error: response.error || 'Unknown error',
        executionTime
      });
    }

    // Cleanup response file
    this.cleanupResponseFile(responsePath);
  }

  /**
   * Clean up a command file
   */
  private cleanupCommandFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug('Cleaned up command file', { path: filePath });
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup command file', { path: filePath, error });
    }
  }

  /**
   * Clean up a response file
   */
  private cleanupResponseFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug('Cleaned up response file', { path: filePath });
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup response file', { path: filePath, error });
    }
  }

  /**
   * Generate unique command ID
   */
  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Synchronous sleep (used for retries)
   */
  private sleep(ms: number): void {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      // Busy wait
    }
  }

  /**
   * Get the client prefix for this communicator
   */
  getClientPrefix(): string {
    return this.clientPrefix;
  }

  /**
   * Get connection status
   */
  isActive(): boolean {
    return this.isConnected;
  }

  /**
   * Get number of pending commands
   */
  getPendingCount(): number {
    return this.pendingCommands.size;
  }
}

// Export singleton instance for convenience
let defaultCommunicator: FileCommunicator | null = null;

export function getDefaultCommunicator(logger?: Logger): FileCommunicator {
  if (!defaultCommunicator) {
    defaultCommunicator = new FileCommunicator({ logger });
  }
  return defaultCommunicator;
}
