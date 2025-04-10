# Storing Trim Data in MongoDB

## Implementation Plan with Incremental Testing

This document outlines a step-by-step approach to implement MongoDB storage for scene trim data, with browser testing at each critical stage. This careful, incremental approach will help us avoid breaking existing functionality.

## Phase 1: Backend Schema Update
1. **Update MongoDB Scene Schema**:
   - Add `trimStart` and `trimEnd` fields to the Scene model
   - Keep backward compatibility with existing scenes

   **TEST**: No frontend testing needed yet (backend-only change)

## Phase 2: Backend API Endpoint
1. **Create/Update Scene Trim API Endpoint**:
   - Implement `/api/projects/:projectId/scenes/:sceneId/trim` endpoint
   - Ensure proper validation and error handling

   **TEST**: No frontend testing needed yet (backend-only change)

## Phase 3: Frontend Integration - Small Steps
1. **Update Scene Types (Frontend)**:
   - Update TypeScript types to include trim fields
   - Make minimal changes to ensure backward compatibility
   
   **MCP TEST #1**: 
   - Load the app and verify we can still add scenes
   - Verify existing scenes still load and play correctly

2. **Add API Client Function**:
   - Create function to call trim endpoint without connecting to UI yet
   
   **MCP TEST #2**:
   - Verify we can still add scenes
   - Test scene playback still works correctly

3. **Connect VideoContextScenePreviewPlayer to API - Read Only**:
   - Update component to read trim data from API response
   - Don't implement saving yet, just reading
   
   **MCP TEST #3**:
   - Load a project with scenes
   - Verify scenes load properly with any existing trim data
   - Verify playback works within any existing trim boundaries

4. **Implement Trim Save with Extensive Logging**:
   - Add debounced save function for trim changes
   - Include detailed logging for debugging
   - Keep existing localStorage functionality as fallback
   
   **MCP TEST #4**:
   - Load a project
   - Add scene and verify it works
   - Adjust trim handles on a scene
   - Check console logs to verify API call occurs
   - Refresh page and verify trim settings persist

5. **Full Implementation with Fallbacks**:
   - Complete the implementation with proper error handling
   - Add fallback to localStorage if API fails
   
   **MCP TEST #5** (Comprehensive):
   - Create a new project
   - Add multiple scenes
   - Set trim points on scenes
   - Refresh page and verify trim settings persist
   - Delete a scene and verify it works
   - Add another scene and verify it works
   - Modify trim settings again and verify they save

## Final Verification Tests
1. **Edge Case Testing**:
   - Test with very short trim regions
   - Test with full-length media (no trimming)
   - Test with only start trim, only end trim
   
   **MCP TEST #6**:
   - Load project
   - Set various edge case trim settings
   - Verify playback respects these boundaries
   - Refresh and verify settings persist

2. **Performance Testing**:
   - Test with many scenes to verify performance
   
   **MCP TEST #7**:
   - Create project with 10+ scenes
   - Set trim points on multiple scenes
   - Navigate between scenes quickly
   - Verify UI remains responsive

## Rollback Strategy

At each step, if any issues arise:
1. Document the exact failure point
2. Roll back to the previous working state
3. Reassess the approach before continuing

This ensures we maintain a working application throughout the development process, with special focus on preserving the ability to add and manage scenes.