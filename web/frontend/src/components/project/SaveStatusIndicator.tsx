import React from 'react';
import { CheckIcon, LoaderIcon } from 'lucide-react';

/**
 * Props for the SaveStatusIndicator component
 */
interface SaveStatusIndicatorProps {
  /** Whether a save operation is currently in progress */
  isSaving: boolean;
  /** Timestamp of the last successful save, or null if never saved */
  lastSaved: number | null;
}

/**
 * A component that displays the current save status of a project.
 * Shows a loading spinner when saving, and the time of the last save when complete.
 * 
 * Features:
 * - Loading spinner animation during save operations
 * - Relative time display for last save (e.g., "2m ago")
 * - Green checkmark icon for successful saves
 * - Accessible with data-testid attributes for testing
 * - Compact design suitable for headers/toolbars
 * 
 * Time Display Format:
 * - "just now" for < 1 second
 * - "Xs ago" for < 1 minute
 * - "Xm ago" for < 1 hour
 * - "Xh ago" for >= 1 hour
 * 
 * @example
 * ```tsx
 * // Show saving in progress
 * <SaveStatusIndicator isSaving={true} lastSaved={null} />
 * 
 * // Show last save time
 * <SaveStatusIndicator 
 *   isSaving={false} 
 *   lastSaved={Date.now() - 5000} // "5s ago"
 * />
 * ```
 */
export default function SaveStatusIndicator({ isSaving, lastSaved }: SaveStatusIndicatorProps) {
  const formatSavedTime = () => {
    if (!lastSaved) return '';
    
    const now = Date.now();
    const diff = now - lastSaved;
    
    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  if (isSaving) {
    return (
      <div data-testid="save-status-saving" className="text-xs text-gray-500 flex items-center">
        <LoaderIcon className="inline-block h-3 w-3 mr-1 animate-spin" />
        Saving...
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div data-testid="save-status-saved" className="text-xs text-gray-500 flex items-center">
        <CheckIcon className="inline-block h-3 w-3 mr-1 text-green-500" />
        Last saved: {formatSavedTime()}
      </div>
    );
  }

  return null;
} 