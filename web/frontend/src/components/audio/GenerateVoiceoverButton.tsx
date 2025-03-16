import React from 'react';
import { Mic as MicIcon } from 'lucide-react';

interface GenerateVoiceoverButtonProps {
  /** Handler for generating voiceover */
  onClick: () => void;
  /** Whether audio generation is in progress */
  isGenerating: boolean;
  /** Whether the button is disabled */
  disabled: boolean;
  /** Custom CSS properties */
  style?: React.CSSProperties;
}

/**
 * A button component that exactly matches the styling of the
 * original Generate Voiceover button in SceneComponent
 */
export const GenerateVoiceoverButton: React.FC<GenerateVoiceoverButtonProps> = ({
  onClick,
  isGenerating,
  disabled,
  style = {}
}) => {
  return (
    <div className="relative w-full" style={{ width: '100%', height: '100%', ...style }}>
      <button
        className="w-full generate-button front absolute inset-0 flex-grow px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-bl-md flex items-center justify-center transition-colors hover:bg-green-700 disabled:opacity-50 shadow-sm"
        data-testid="generate-voiceover-btn"
        disabled={isGenerating || disabled}
        onClick={onClick}
      >
        <MicIcon className="h-4 w-4 mr-2" />
        <span className="font-medium">{isGenerating ? "Generating..." : "Generate Voiceover"}</span>
      </button>
    </div>
  );
};

export default GenerateVoiceoverButton; 