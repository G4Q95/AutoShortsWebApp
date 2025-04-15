# Press In Case of Emergency: Media Storage Debugging (2025-04-16)

## Current Situation & Problem

We are debugging Task 12, specifically subtask 12.8, which aims to fix the scene creation and media storage workflow.

**The Core Problem:**
When adding the *first* scene to a *newly created* project, the media storage process fails. This happens because:
1.  A new project is created locally in the frontend first, without its official MongoDB `_id`.
2.  The frontend logic (specifically the `useEffect` in `ProjectProvider.tsx` intended to trigger media storage) runs *before* the project has been saved to the backend database and received its `_id`.
3.  The check for `state.currentProject._id` within this effect fails, preventing the call to `storeSceneMedia` and the subsequent `/api/v1/media/store` API call.
4.  This blocks the entire asynchronous media storage pipeline (Celery task, R2 upload) for the first scene of any new project.

**Immediate Next Step (Debugging Attempt):**
The immediate plan is to fix the `saveCurrentProject` function within `web/frontend/src/components/project/ProjectProvider.tsx`. Specifically, ensure the `if (!projectToSave._id)` block correctly calls the `createProject` function from the *API client* (`lib/api/projects.ts`), not the reducer action creator. This aims to get the MongoDB `_id` populated correctly upon initial save. **Caution:** Previous attempts to fix this introduced a critical error by calling the wrong function, breaking project loading entirely (`TypeError: Cannot read properties of undefined (reading 'length')` in `ProjectReducer.tsx`).

## Historical Context & Potential Foundational Issues

The current debugging difficulty ("peeling back an onion") likely stems from the complex evolution of Task 2 (originally audio extraction, now main media processing):

*   **Mid-Task Architectural Changes:** Celery, Redis, and containerization (e.g., for FFmpeg) were introduced partway through Task 2's implementation.
*   **Technology Shift:** The download method was changed from basic HTTP requests to `yt-dlp`.
*   **Incomplete/Untested Celery Task:** The core Celery task definition for `yt-dlp` downloads (Task 2.14) is still marked "in-progress" and may have had associated failing unit tests that were skipped.
*   **Cancelled Subtasks:** Original Celery subtasks related to the initial implementation were cancelled.
*   **Async/Sync Mix:** Workarounds (like using `asyncio.run` inside a sync Celery task) were introduced, deviating from a pure async design.
*   **Reactive Task Creation:** Tasks 11 & 12 were added later to address issues arising from the evolution of Task 2.

There's a risk that the current Celery integration is built on a potentially unstable foundation due to these incremental changes and possibly unresolved issues from Task 2.

## Fallback Plans (If Current Debugging Fails)

If fixing the immediate frontend issue in `ProjectProvider.tsx` does not resolve the media storage pipeline or quickly leads to other intractable problems:

1.  **Analyze Git History:** Review commit history around Task 2 modifications, Celery integration, yt-dlp switch, and Task 11/12 creation. Look for:
    *   A stable "last known good" commit to revert to.
    *   Specific commits that introduced instability.
    *   This analysis should inform the decision between further debugging and a larger revert.

2.  **Strategic Revert & Re-Implement:** Revert the codebase to a point *before* the complex Celery/yt-dlp integration was attempted (likely somewhere mid-Task 2). Re-implement the asynchronous media download and storage functionality (covering goals of Task 2/11/12) cleanly, ensuring proper testing (including unit tests) at each stage. This is more effort upfront but potentially faster and more robust long-term.

## Purpose

This document summarizes the state as of 2025-04-16. If debugging continues to stall or reveal deeper issues, refer an AI agent to this document to provide context for deciding whether to proceed with debugging or execute one of the fallback plans (Analyze Git History or Strategic Revert). 