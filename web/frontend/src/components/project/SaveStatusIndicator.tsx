import React from 'react';
import { CheckIcon, LoaderIcon } from 'lucide-react';

interface SaveStatusIndicatorProps {
  isSaving: boolean;
  lastSaved: number | null;
}

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