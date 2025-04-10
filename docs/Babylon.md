# Babylon.js Integration Notes

**Important Clarification:** The current primary video editing strategy relies on `video-context` for core playback/timing and standard HTML/CSS/JavaScript overlays (managed by React) for UI elements, including captions. **Babylon.js is *not* currently used for base video rendering, timeline management, or caption display.**

Babylon.js remains a potential tool for **future implementation** of complex, custom visual effects that go beyond the capabilities of `video-context` shaders. If implemented, it would likely involve rendering effects onto a separate, synchronized overlay canvas layered on top of the main `video-context` canvas. This approach is considered advanced and is deferred until core editing features are stable.

The notes below pertain to the potential future use or past consideration of Babylon.js.

## Purpose

This document outlines the rationale, plan, and findings for exploring Babylon.js as a potential alternative rendering engine for the Auto Shorts web app's frontend video editor preview, replacing the current `video-context` implementation.

## Rationale

While `video-context` provides specialized APIs for video timelines, concerns exist about its limitations regarding:
*   Previewing complex visual effects or transitions in real-time.
*   General rendering performance and flexibility compared to mature graphics engines.
*   Future-proofing, especially regarding leveraging newer web graphics APIs like WebGPU.

Exploring Babylon.js aims to evaluate if its benefits (powerful rendering engine, mature WebGPU support, large ecosystem) outweigh the added complexity of implementing video timeline logic from scratch.

## Comparison with video-context

| Feature                       | `video-context`                     | Babylon.js (Potential)              |
| :---------------------------- | :---------------------------------- | :---------------------------------- |
| **Primary Focus**             | Video/Audio Timeline Compositing    | General Purpose 3D/2D Rendering   |
| **Timeline Abstractions**     | Built-in (Nodes, Timing API)        | Manual Implementation Required      |
| **Video Sync Logic**          | Partially Abstracted by API         | Manual Implementation Required      |
| **Rendering Performance**     | WebGL-based, potentially limited    | High (WebGL + Mature WebGPU)        |
| **Graphics/Effects Previews** | Limited (basic shaders)             | High potential via engine features  |
| **WebGPU Support**            | No                                  | Yes (Mature)                        |
| **Ecosystem/Community**       | Smaller                             | Very Large                          |
| **Development Effort**        | Less for core timeline *logic*      | More for timeline logic, potentially less for complex *visuals* |

## Prototype Plan (Proof of Concept)

**Goal:** Evaluate the basic feasibility and integration complexity of using Babylon.js for video preview and interactive scrubbing within the existing React application structure.

**Key Features:**

1.  **Babylon.js Canvas Component:** A React component housing the Babylon Engine/Scene rendering to a `<canvas>`.
2.  **Video Loading:** Load a single video URL (e.g., from an input or hardcoded) into an HTML `<video>` element.
3.  **Video Texture Display:** Use the `<video>` element as a source for a Babylon.js `VideoTexture` applied to a 2D Plane mesh within the scene.
4.  **Basic Play/Pause:** Simple UI buttons controlling the underlying `<video>` element.
5.  **Timeline Scrubber UI:** An HTML `<input type="range">` component visually representing the video timeline.
6.  **Interactive Scrubbing:**
    *   Dragging the scrubber updates the `.currentTime` of the HTML `<video>` element.
    *   The `timeupdate` event from the `<video>` element updates the scrubber's position during playback.

**Architecture & Modularity:**

*   Create separate, focused React components (`BabylonCanvas`, `TimelineScrubber`).
*   Use custom hooks (`useBabylonScene`, `useVideoTexture`?) where appropriate to encapsulate logic.
*   Manage state (duration, currentTime) using React state within a parent component or simple context.

### Prototype Implementation Guidelines

When building the Babylon.js prototype, the following guidelines must be strictly adhered to:

1.  **Naming Convention:** All new files specifically created for the Babylon.js implementation (components, hooks, utilities, etc.) **must** include `Babylon` in their filename (e.g., `useBabylonScene.ts`, `BabylonCanvas.tsx`, `babylonUtils.ts`) to ensure clear separation from existing `video-context` code.
2.  **Modularity:** Functionality **must** be broken down into small, focused components and hooks.
3.  **File Length:** No single file (component, hook, utility script) **must** exceed 300 lines of code. Logic must be extracted into separate functions, hooks, or components as needed to maintain this limit.
4.  **Conciseness:** Code should be as simple and minimal as possible to achieve the required prototype functionality.
5.  **`.cursorrules` Adherence:** All generated code **must** follow the established coding principles, structure guidelines, and other rules defined in the project's `.cursorrules`.

## Implementation Notes

*(Placeholder for findings, code snippets, challenges encountered during prototype development)*

## Decision

*(Placeholder for the final decision on whether to proceed with replacing `video-context` based on prototype evaluation)* 