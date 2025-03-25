/**
 * EditHistoryManager.ts
 * 
 * This utility manages the editing history for VideoContext editing,
 * providing undo/redo functionality for editing actions.
 * 
 * It keeps track of edit states and supports command pattern for
 * reversible actions during video editing.
 */

import { Scene } from '@/components/project/ProjectTypes';

/**
 * EditAction interface for commands in the command pattern
 */
interface EditAction {
  /** Unique identifier for the action */
  id: string;
  /** User-friendly description of the action */
  description: string;
  /** Timestamp when the action was performed */
  timestamp: number;
  /** Function to undo the action */
  undo: () => void;
  /** Function to redo the action */
  redo: () => void;
  /** Metadata related to the action */
  metadata?: Record<string, any>;
}

/**
 * ActionType enum for categorizing edit actions
 */
export enum ActionType {
  /** Media-related actions (e.g., trim, replace) */
  MEDIA = 'media',
  /** Text-related actions */
  TEXT = 'text',
  /** Project structure actions (e.g., add/remove scenes) */
  STRUCTURE = 'structure',
  /** Audio-related actions */
  AUDIO = 'audio',
  /** Effect-related actions */
  EFFECT = 'effect',
}

/**
 * Default configuration for edit history
 */
const DEFAULT_CONFIG = {
  /** Maximum number of history states to keep */
  maxHistorySize: 50,
  /** Whether undo/redo functionality is enabled */
  enabled: true,
  /** Debounce time for similar consecutive actions (ms) */
  actionDebounceTime: 500,
  /** Whether to group similar consecutive actions */
  groupSimilarActions: true,
  /** Auto-save action types (major edits that trigger saves) */
  autoSaveActionTypes: [ActionType.MEDIA, ActionType.STRUCTURE],
  /** Whether to track more verbose debug information */
  debug: false,
};

/**
 * Configuration options for EditHistoryManager
 */
interface EditHistoryConfig {
  /** Maximum number of history states to keep */
  maxHistorySize?: number;
  /** Whether undo/redo functionality is enabled */
  enabled?: boolean;
  /** Debounce time for similar consecutive actions (ms) */
  actionDebounceTime?: number;
  /** Whether to group similar consecutive actions */
  groupSimilarActions?: boolean;
  /** Auto-save action types (major edits that trigger saves) */
  autoSaveActionTypes?: ActionType[];
  /** Whether to track more verbose debug information */
  debug?: boolean;
}

/**
 * Manages edit history with undo/redo capabilities
 */
class EditHistoryManager {
  private static instance: EditHistoryManager;
  private undoStack: EditAction[] = [];
  private redoStack: EditAction[] = [];
  private config: Required<EditHistoryConfig>;
  private lastActionType: string | null = null;
  private lastActionTime: number = 0;
  private lastSaveTime: number = 0;
  private autoSaveCallback: ((actionType: ActionType) => void) | null = null;

  /**
   * Private constructor for singleton pattern
   */
  private constructor(config: EditHistoryConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Set up keyboard shortcut listeners if in browser
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(config?: EditHistoryConfig): EditHistoryManager {
    if (!EditHistoryManager.instance) {
      EditHistoryManager.instance = new EditHistoryManager(config);
    } else if (config) {
      // Update config if provided
      EditHistoryManager.instance.config = {
        ...EditHistoryManager.instance.config,
        ...config,
      };
    }
    return EditHistoryManager.instance;
  }

  /**
   * Register an auto-save callback that will be called after significant actions
   * 
   * @param callback Function to call when auto-save should trigger
   */
  public registerAutoSaveCallback(callback: (actionType: ActionType) => void): void {
    this.autoSaveCallback = callback;
  }

  /**
   * Create and add a new edit action to history
   * 
   * @param actionType Type of action (for grouping and auto-save)
   * @param description User-friendly description of action
   * @param undoFunction Function to call when undoing
   * @param redoFunction Function to call when redoing
   * @param metadata Optional metadata for the action
   */
  public addAction(
    actionType: ActionType,
    description: string,
    undoFunction: () => void,
    redoFunction: () => void,
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const action: EditAction = {
      id: `${actionType}-${now}-${Math.random().toString(36).substr(2, 9)}`,
      description,
      timestamp: now,
      undo: undoFunction,
      redo: redoFunction,
      metadata,
    };

    // Check if we should group this with the previous action
    const shouldGroup = this.shouldGroupWithPreviousAction(actionType, now);
    
    if (shouldGroup && this.undoStack.length > 0) {
      // Replace the last action with this one
      this.undoStack.pop();
    }

    // Clear redo stack when a new action is added
    this.redoStack = [];
    
    // Add to undo stack
    this.undoStack.push(action);
    
    // Trim history if it exceeds max size
    if (this.undoStack.length > this.config.maxHistorySize) {
      this.undoStack.shift();
    }

    // Update tracking variables
    this.lastActionType = actionType;
    this.lastActionTime = now;

    // Check if this action should trigger auto-save
    this.checkAutoSave(actionType, now);

    if (this.config.debug) {
      console.log(`[EditHistory] Added action: ${description} (${actionType})`);
    }
  }

  /**
   * Undo the last action if available
   * 
   * @returns True if an action was undone, false otherwise
   */
  public undo(): boolean {
    if (!this.config.enabled || this.undoStack.length === 0) return false;

    const action = this.undoStack.pop();
    if (!action) return false;

    try {
      action.undo();
      this.redoStack.push(action);
      
      if (this.config.debug) {
        console.log(`[EditHistory] Undone: ${action.description}`);
      }
      
      return true;
    } catch (error) {
      console.error('[EditHistory] Error during undo:', error);
      return false;
    }
  }

  /**
   * Redo the last undone action if available
   * 
   * @returns True if an action was redone, false otherwise
   */
  public redo(): boolean {
    if (!this.config.enabled || this.redoStack.length === 0) return false;

    const action = this.redoStack.pop();
    if (!action) return false;

    try {
      action.redo();
      this.undoStack.push(action);
      
      if (this.config.debug) {
        console.log(`[EditHistory] Redone: ${action.description}`);
      }
      
      return true;
    } catch (error) {
      console.error('[EditHistory] Error during redo:', error);
      return false;
    }
  }

  /**
   * Check if undo is available
   */
  public canUndo(): boolean {
    return this.config.enabled && this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  public canRedo(): boolean {
    return this.config.enabled && this.redoStack.length > 0;
  }

  /**
   * Clear all history
   */
  public clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.lastActionType = null;
    this.lastActionTime = 0;
    
    if (this.config.debug) {
      console.log('[EditHistory] History cleared');
    }
  }

  /**
   * Handle keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)
   */
  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    // Only process if enabled
    if (!this.config.enabled) return;
    
    // Check for Cmd/Ctrl+Z (undo)
    if ((event.metaKey || event.ctrlKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.undo();
    }
    
    // Check for Cmd/Ctrl+Shift+Z (redo)
    if ((event.metaKey || event.ctrlKey) && event.key === 'z' && event.shiftKey) {
      event.preventDefault();
      this.redo();
    }
  }

  /**
   * Determine if action should be grouped with previous one
   */
  private shouldGroupWithPreviousAction(actionType: ActionType, timestamp: number): boolean {
    if (!this.config.groupSimilarActions) return false;
    if (this.lastActionType !== actionType) return false;
    
    // Check if within debounce time
    return (timestamp - this.lastActionTime) < this.config.actionDebounceTime;
  }

  /**
   * Check if current action should trigger auto-save
   */
  private checkAutoSave(actionType: ActionType, timestamp: number): void {
    // Skip if no callback registered
    if (!this.autoSaveCallback) return;
    
    // Check if this action type should trigger auto-save
    if (!this.config.autoSaveActionTypes.includes(actionType)) return;
    
    // Check if enough time has passed since last save (minimum 3 seconds)
    const MIN_SAVE_INTERVAL = 3000; // 3 seconds
    if (timestamp - this.lastSaveTime < MIN_SAVE_INTERVAL) return;
    
    // Trigger auto-save
    this.autoSaveCallback(actionType);
    this.lastSaveTime = timestamp;
    
    if (this.config.debug) {
      console.log(`[EditHistory] Auto-save triggered by ${actionType} action`);
    }
  }
}

export default EditHistoryManager; 