# Scene Component Refactoring Plan

## Overview

This document outlines the step-by-step approach to refactoring the Scene component, which has grown to almost 2000 lines. The refactoring will follow a feature-based decomposition strategy, breaking down the component into smaller, more manageable pieces while ensuring the application remains fully functional throughout the process.

## Testing Strategy

- Run Playwright tests after each step to ensure no regression
- Use `cd web/frontend && npm test` to run tests
- If tests fail, revert changes and troubleshoot before proceeding
- Document any test failures and their resolutions

## Refactoring Steps

### Phase 1: Preparation

1. **Create baseline test results**
   - Run full test suite to document current behavior
   - Save screenshots of current UI for visual comparison

2. **Code analysis**
   - Identify major feature sections within Scene component
   - Map state dependencies between features
   - Identify shared utility functions
   - Document prop flow

3. **Create refactoring branches**
   - Create feature branch for each major refactoring phase
   - Set up fallback points for each step

### Phase 2: Extract Utility Functions

4. **Create utility file for pure functions**
   - Create `scene-utils.ts` file
   - Move pure utility functions that don't depend on component state
   - Run tests after each function extraction

5. **Extract event handlers into utility functions**
   - Group related event handlers
   - Extract and test one group at a time
   - Ensure proper parameter passing

### Phase 3: Extract Custom Hooks

6. **Create hooks directory**
   - Set up `hooks/scene` directory structure
   - Create index file for hook exports

7. **Extract media-related logic into custom hook**
   - Create `useSceneMedia.ts` hook
   - Move media state and related functions
   - Update imports and references
   - Test thoroughly

8. **Extract audio-related logic into custom hook**
   - Create `useSceneAudio.ts` hook
   - Move audio state and related functions
   - Update imports and references
   - Test thoroughly

9. **Extract edit-related logic into custom hook**
   - Create `useSceneEdit.ts` hook
   - Move editing state and related functions
   - Update imports and references
   - Test thoroughly

10. **Extract API-related logic into custom hook**
    - Create `useSceneApi.ts` hook
    - Move API calls and related state
    - Update imports and references
    - Test thoroughly

### Phase 4: Extract Sub-Components

11. **Create components directory**
    - Set up `components/scene` directory structure
    - Create index file for component exports

12. **Extract header section**
    - Create `SceneHeader.tsx` component
    - Move header JSX and related state/props
    - Test thoroughly

13. **Extract media player section**
    - Create `SceneMediaPlayer.tsx` component
    - Move media player JSX and related state/props
    - Test thoroughly

14. **Extract trim controls section**
    - Create `SceneTrimControls.tsx` component
    - Move trim controls JSX and related state/props
    - Test thoroughly

15. **Extract text content section**
    - Create `SceneTextContent.tsx` component
    - Move text content JSX and related state/props
    - Test thoroughly

16. **Extract voice settings section**
    - Create `SceneVoiceSettings.tsx` component
    - Move voice settings JSX and related state/props
    - Test thoroughly

17. **Extract action buttons section**
    - Create `SceneActions.tsx` component
    - Move action buttons JSX and related state/props
    - Test thoroughly

### Phase 5: Implement Container Component

18. **Create container component**
    - Create `SceneContainer.tsx` to manage state
    - Connect all hooks and handle state distribution
    - Test thoroughly

19. **Refactor main Scene component**
    - Update Scene component to use SceneContainer
    - Remove redundant code
    - Ensure proper prop passing
    - Test thoroughly

### Phase 6: State Management Refinement

20. **Review state management**
    - Identify any remaining prop drilling issues
    - Consider context implementation for deeply nested state
    - Refactor as needed

21. **Optimize rendering**
    - Add React.memo to appropriate components
    - Implement useMemo and useCallback where beneficial
    - Test performance

### Phase 7: Documentation and Cleanup

22. **Update component documentation**
    - Add JSDoc comments to all new components and hooks
    - Document component responsibilities and interfaces

23. **Review and cleanup**
    - Remove any dead code
    - Check for duplicated logic
    - Ensure consistent naming conventions
    - Final testing pass

## Rollback Plan

For each step:
1. If tests fail, roll back to the last working state
2. Document the issue
3. Fix in isolation before proceeding
4. Re-run tests to confirm the fix

## Completion Criteria

- All Playwright tests passing
- No regressions in functionality
- Scene component reduced to under 300 lines
- Clear separation of concerns across new components
- Improved code readability and maintainability 