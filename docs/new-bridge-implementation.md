# VideoContextBridge Implementation Plan

## Overview
This document outlines the redesigned approach for the VideoContextBridge implementation, focusing on proper state management and coordination between the bridge and the main component.

## Design Goals
- Single source of truth for state management
- Clear separation of concerns
- Proper async coordination
- Robust error handling
- Reliable DOM visibility handling

## Interface Design

### Bridge Props Interface
```typescript
interface UseVideoContextBridgeProps {
  // DOM Refs (read-only)
  canvasRef: RefObject<HTMLCanvasElement>;
  videoRef: RefObject<HTMLVideoElement>; // For first frame
  
  // Media Info (read-only)
  mediaUrl: string;
  localMediaUrl?: string | null;
  mediaType: string;
  
  // Visual State (read-only)
  showFirstFrame: boolean;  // Critical for coordination
  
  // Callbacks (for state changes)
  onIsReadyChange: (isReady: boolean) => void;
  onDurationChange: (duration: number) => void;
  onError: (error: Error) => void;
  onTimeUpdate: (time: number) => void;
}
```

### Bridge Return Interface
```typescript
interface UseVideoContextBridgeReturn {
  // Actions (methods only, no state)
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (time: number) => Promise<void>;
  
  // Status info (derived from internal implementation)
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string | null;
}
```

## Implementation Steps

### Step 1: Create Basic Bridge Structure ⏳ In Progress
- [ ] Create new hook file with TypeScript interfaces
- [ ] Implement basic hook structure
- [ ] Add error handling utilities
- [ ] Set up state management

### Step 2: Implement Promise-Based Methods 🔄 Next
- [ ] Implement play() method
- [ ] Implement pause() method
- [ ] Implement seek() method
- [ ] Add proper error handling
- [ ] Add state coordination checks

### Step 3: Component Integration 🔄 Pending
- [ ] Update component to use new bridge
- [ ] Implement proper DOM state handling
- [ ] Add error boundary integration
- [ ] Update state management
- [ ] Add loading states

### Step 4: Testing Implementation 🔄 Pending
- [ ] Create unit tests for bridge
- [ ] Add integration tests
- [ ] Test edge cases
- [ ] Add performance tests
- [ ] Document test scenarios

## Example Implementations

### Promise-Based Play Method
```typescript
play: async () => {
  if (showFirstFrame) {
    console.warn('Cannot play - canvas is hidden! Check component state.');
    return Promise.reject(new Error('Canvas not visible'));
  }
  
  try {
    // Actual VideoContext play logic
    videoContext.play();
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}
```

### Component Integration Example
```typescript
const handlePlay = async () => {
  try {
    // First make canvas visible
    setShowFirstFrame(false);
    
    // Small delay to ensure React has updated the DOM
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Now play
    await bridge.play();
    
    // Only update state after successful play
    setIsPlaying(true);
  } catch (error) {
    console.error('Play failed:', error);
    // Handle error appropriately
  }
};
```

## Progress Tracking

### Current Status
- Implementation Phase: Step 1
- Last Updated: [Current Date]
- Current Focus: Setting up basic bridge structure

### Known Issues
- None yet

### Next Actions
1. Create the basic hook structure
2. Implement error handling utilities
3. Set up state management
4. Begin implementing promise-based methods

## Success Metrics
- Zero frame drops during normal playback
- No state synchronization issues
- Immediate play/pause response
- Proper error handling and reporting
- Coordinated video element and canvas visibility 