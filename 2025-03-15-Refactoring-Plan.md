# Auto Shorts Web App - Refactoring Plan (March 15, 2025)

## Overview
This document outlines our structured approach to refactoring the Auto Shorts Web App codebase. After successfully implementing UI changes, audio generation features, Docker integration, and CloudFlare R2 storage, we need to clean up the codebase to improve maintainability, reduce complexity, and eliminate redundant code.

## Goals
- Remove duplicate and redundant files
- Break down overly large components
- Standardize API patterns
- Improve code organization
- Reduce complexity
- Maintain test coverage
- Ensure all features continue working as expected

## Refactoring Phases

### Phase 1: Clean up Redundant Files
- [x] Remove duplicate R2 test files from root directory
- [x] Delete backup test files (.bak)
- [x] Consolidate duplicate documentation
- [ ] Clean up test scripts that are no longer needed

### Phase 2: Component Refactoring
- [x] Develop incremental component extraction approach for safe refactoring
- [ ] Break down SceneComponent.tsx (1680 lines) into smaller components:
  - [ ] Extract audio-related functionality into SceneAudioControls component
  - [ ] Extract text editing functionality into SceneTextEditor component
  - [ ] Extract media display logic into SceneMediaDisplay component
- [ ] Clean up ProjectProvider.tsx and ProjectReducer.ts
- [ ] Improve error handling patterns

### Phase 3: API and Utilities Refactoring
- [ ] Refactor api-client.ts (905 lines) into domain-specific modules
- [ ] Standardize error handling across utilities
- [ ] Remove redundant utility functions
- [ ] Improve type definitions

### Phase 4: Backend Refactoring
- [ ] Clean up duplicate endpoint handlers
- [ ] Standardize response formats
- [ ] Improve error handling
- [ ] Organize services better

## Testing Strategy
- Run full test suite after each significant change
- Ensure all 7 Playwright tests continue to pass
- Manually verify affected features after UI component changes
- Check browser console for new errors after each change

## Progress Tracking

### Completed Tasks
- Created refactoring plan document
- Moved redundant R2 test files to `scripts/r2_tests` directory
- Moved backup test files to a dedicated `backups` directory
- Consolidated R2 setup documentation into a single comprehensive file at `docs/r2_setup.md`

### Currently Working On
- Breaking down large components, starting with SceneComponent.tsx

### Next Tasks
- Extract audio-related functionality from SceneComponent.tsx into dedicated components
- Clean up test scripts that are no longer needed

## Risk Assessment

### High-Risk Areas
- SceneComponent.tsx refactoring (core UI component)
- api-client.ts refactoring (critical for API communication)
- ProjectProvider.tsx (manages global state)

### Mitigation Strategies
- Small, incremental changes
- Frequent testing
- Maintain backup copies of critical files before major changes
- Document complex logic before refactoring it

## Notes and Observations
- Initial cleanup of redundant files was successful without affecting functionality
- All 7 Playwright tests are passing
- SceneComponent.tsx is a prime candidate for refactoring due to its size (1680 lines)
- Multiple redundant R2 test files were consolidated, improving codebase organization

## Incremental Component Extraction Plan

### SceneAudioControls Extraction

#### Step 1: Analyze and Understand the Current Implementation
- [x] Identify all audio-related state and functions in SceneComponent
- [x] Understand test expectations and UI elements that tests rely on
- [x] Map the component dependencies and imports needed

#### Step 2: Create a Minimal Compatible Component
- [x] Create initial SceneAudioControls with matching props interface
- [x] Copy minimal state management for basic functionality
- [x] Implement proper initialization from scene props
- [x] Ensure identical class names and element structure for tests

#### Step 3: Incremental UI Migration
- [x] First migrate just the voice selection dropdown
- [x] Run tests to verify this doesn't break anything
- [x] Implement voice generation functionality
- [x] Run tests to verify functionality
- [ ] Finally migrate audio playback controls
- [ ] Run comprehensive tests

#### Step 4: Function Migration
- [ ] Move audio playback logic
- [ ] Move voice generation logic
- [ ] Move audio settings logic
- [ ] Keep identical function signatures and behavior

#### Step 5: Revise Integration Approach
- [ ] Use feature flag approach instead of parallel components
- [ ] Add a prop to SceneComponent to switch between old and new implementations
- [ ] Test both implementations individually using the flag
- [ ] Ensure identical functionality before proceeding

#### Step 6: Incremental Feature Switching
- [ ] First switch the voice selection UI to the new component
- [ ] Then switch voice generation functionality
- [ ] Finally switch audio playback UI and controls
- [ ] Run tests after each change

#### Step 7: Cleanup
- [ ] Remove all duplicate code from SceneComponent
- [ ] Ensure proper prop passing and state management
- [ ] Remove the feature flag switch
- [ ] Verify all tests still pass
- [ ] Document the new component structure

### Implementation Notes

#### Challenges with Initial Approach
We initially tried implementing the component extraction by having both implementations (original and new) present simultaneously in the DOM, with the new component hidden via CSS (`display: none`). This approach caused test failures because:

1. **Playwright's DOM Selection**: Playwright can find elements even when they're hidden with CSS
2. **Strict Mode Violations**: Tests using strict mode to find elements failed when they found duplicate matches
3. **Identical Element Structures**: Since we kept identical class names and structures for compatibility, tests couldn't distinguish between original and new components

#### Revised Approach
Instead of having both implementations present simultaneously, we're switching to a feature flag approach where:

1. We'll add a prop to toggle between implementations
2. Tests will run with the original implementation first
3. We'll gradually switch to the new implementation, adding tests for each piece
4. This eliminates DOM duplication while maintaining test coverage

This approach allows for more controlled testing and avoids Playwright selector conflicts. 