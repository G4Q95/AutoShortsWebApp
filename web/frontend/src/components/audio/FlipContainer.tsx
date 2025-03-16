import React from 'react';

interface FlipContainerProps {
  /** Whether the container is flipped */
  isFlipped: boolean;
  /** Front face content */
  frontContent: React.ReactNode;
  /** Back face content */
  backContent: React.ReactNode;
  /** Custom CSS properties */
  style?: React.CSSProperties;
  /** CSS class name */
  className?: string;
}

/**
 * A reusable flip container component that provides the exact same
 * 3D flip animation as in the original SceneComponent
 */
export const FlipContainer: React.FC<FlipContainerProps> = ({
  isFlipped,
  frontContent,
  backContent,
  style = {},
  className = '',
}) => {
  return (
    <div 
      className={`flip-container ${className}`}
      style={{
        perspective: '1000px',
        height: '100%',
        width: '100%',
        ...style
      }}
    >
      <div 
        className="flipper" 
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transition: 'transform 0.6s',
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateX(180deg)' : 'rotateX(0deg)'
        }}
      >
        {/* Front face */}
        <div 
          className="front" 
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            zIndex: isFlipped ? '0' : '2',
            transform: 'rotateX(0deg)',
          }}
        >
          {frontContent}
        </div>
        
        {/* Back face */}
        <div 
          className="back" 
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            transform: 'rotateX(180deg)',
            zIndex: isFlipped ? '2' : '0',
          }}
        >
          {backContent}
        </div>
      </div>
    </div>
  );
};

export default FlipContainer; 