/**
 * EditHistoryManager.ts
 * 
 * This utility tracks edit history and enables undo/redo functionality
 * for media editing operations.
 */

// Define action types that can be tracked in history
export enum ActionType {
  TRIM_CHANGE = 'trim_change',
  MEDIA_REPLACE = 'media_replace',
  EFFECT_ADD = 'effect_add',
  EFFECT_REMOVE = 'effect_remove',
  PROPERTY_CHANGE = 'property_change'
}

// Define the structure of a history item
interface HistoryItem {
  actionType: ActionType;
  timestamp: number;
  sceneId: string;
  projectId: string;
  metadata: Record<string, any>;
  undo: () => Promise<void>;
}

class EditHistoryManager {
  private static instance: EditHistoryManager;
  private undoStack: HistoryItem[];
  private redoStack: HistoryItem[];
  private maxHistoryItems: number;

  /**
   * Create a new EditHistoryManager
   * @param maxHistoryItems Maximum number of history items to keep
   */
  private constructor(maxHistoryItems = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistoryItems = maxHistoryItems;
    console.log('EditHistoryManager initialized');
  }

  /**
   * Get the singleton instance of EditHistoryManager
   */
  public static getInstance(): EditHistoryManager {
    if (!EditHistoryManager.instance) {
      EditHistoryManager.instance = new EditHistoryManager();
    }
    return EditHistoryManager.instance;
  }

  /**
   * Add an action to the history
   * 
   * @param actionType The type of action
   * @param sceneId The scene ID
   * @param projectId The project ID
   * @param metadata Any additional data about the action
   * @param undoFunction Function to call to undo this action
   */
  public addAction(
    actionType: ActionType, 
    sceneId: string, 
    projectId: string, 
    metadata: Record<string, any>, 
    undoFunction: () => Promise<void>
  ): void {
    // Create a new history item
    const historyItem: HistoryItem = {
      actionType,
      timestamp: Date.now(),
      sceneId,
      projectId,
      metadata,
      undo: undoFunction
    };

    // Add to undo stack
    this.undoStack.push(historyItem);
    console.log(`EditHistoryManager: Added ${actionType} to history`);

    // Clear redo stack when a new action is performed
    this.redoStack = [];

    // Limit history size
    if (this.undoStack.length > this.maxHistoryItems) {
      this.undoStack.shift(); // Remove oldest item
    }
  }

  /**
   * Undo the most recent action
   * 
   * @returns Promise that resolves when the undo is complete
   */
  public async undo(): Promise<boolean> {
    if (this.undoStack.length === 0) {
      console.log('EditHistoryManager: Nothing to undo');
      return false;
    }

    // Get the most recent action
    const action = this.undoStack.pop();
    if (!action) return false;

    try {
      // Call the undo function
      await action.undo();
      
      // Add to redo stack
      this.redoStack.push(action);
      console.log(`EditHistoryManager: Undid ${action.actionType}`);
      return true;
    } catch (error) {
      console.error('Error during undo:', error);
      return false;
    }
  }

  /**
   * Get the current undo stack (for debugging)
   */
  public getUndoStack(): HistoryItem[] {
    return [...this.undoStack];
  }

  /**
   * Clear all history
   */
  public clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    console.log('EditHistoryManager: History cleared');
  }
}

export default EditHistoryManager; 