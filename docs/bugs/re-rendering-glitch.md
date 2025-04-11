# Bug Report: Frontend Re-rendering Glitch

## Status
- **Investigating**

## Severity
- **Critical:** Makes the project workspace unusable for affected projects, causes extreme browser/system load.

## Symptoms
- Infinite re-rendering loop on the project workspace page (`/projects/[id]`).
- UI elements flash rapidly (e.g., text appearing/disappearing).
- Video preview area may flicker or show constant loading states.
- Extremely high volume of console messages (thousands per second).
- Extremely high volume of console errors (hundreds per second).
- Causes browser tab to become unresponsive and consumes high CPU/memory, leading to system overheating.
- Seems to occur only with specific projects, while others load correctly.

## Trigger
- Loading a specific project into the workspace.
- Persists even after closing and reopening the tab for the affected project.

## Console Errors Observed (Summary)
- Numerous `AbortError: signal is aborted without reason` errors originating from `src/lib/api-client.ts` (likely related to cancelled `fetch` requests).
- Numerous `SceneComponent ...: Error fetching stored audio: { ... status_code: 408, message: "Request timed out...", error_code: "timeout_error"}` errors.

## Suspected Cause
- An infinite loop involving component re-renders, likely within `SceneComponent.tsx` or related hooks/contexts.
- The loop triggers rapid, repeated attempts to fetch data (e.g., stored audio), which are immediately cancelled by the next render cycle (AbortError) or eventually time out (408).

## Affected Components (Potential)
- `web/frontend/src/components/SceneComponent.tsx`
- `web/frontend/src/lib/api-client.ts`
- Hooks related to fetching audio or scene data (e.g., `useVoice`?)
- State management context providers related to projects or scenes.

## Investigation Steps
- [ ] Examine `SceneComponent.tsx` for state updates or effects triggering re-renders.
- [ ] Analyze dependencies of `useEffect` hooks within `SceneComponent` and related components.
- [ ] Add targeted logging to trace the render and data fetching lifecycle.
- [ ] Investigate state management updates related to project/scene loading.
- [ ] Compare the data of the affected project with a working project.

## Notes
- This issue has been observed multiple times recently, potentially introduced during the backend refactoring or slightly earlier. 