# Audio Blocks Timeline Feature Plan

## 1. Goal

To provide users with enhanced control over voiceover timing within individual scenes by allowing:
- Visualization of audio clips on the scene timeline.
- Precise placement (start time) of audio clips via dragging.
- Addition of multiple, distinct audio clips (e.g., voiceovers, potentially sound effects later) per scene.

## 2. Core Concepts

### 2.1. Visual Representation
- **Required:** Audio clips will be represented as colored rectangular blocks on the scene's timeline UI (likely below the main video/image preview scrubber).
    - The block's horizontal position will indicate its `startTime`.
    - The block's width will indicate its `duration`.
- **Potential Enhancement:** Render audio waveforms within the blocks for better visual cues of speech start/end points. This requires audio processing (backend or frontend) and efficient Canvas rendering.

### 2.2. Interaction
- Users will be able to drag these audio blocks horizontally along the timeline to adjust their `startTime`.
- The timeline scrubber/playhead will interact with these blocks during playback.

### 2.3. Multiple Clips Per Scene
- Users should be able to generate/add multiple independent audio clips to a single scene.
- The UI will need a way to manage this (e.g., an "Add Audio" or subsequent "Generate Voiceover" button appearing after the first).

## 3. Technical Implementation

### 3.1. Data Model (Backend/Database)
- The `Scene` schema needs modification. Instead of a single `audioUrl` (or similar), it should have an array property, perhaps named `audioClips`.
- Each object within the `audioClips` array should contain:
    - `id`: Unique identifier for the clip.
    - `url`: Storage URL for the audio file (e.g., R2).
    - `startTime`: The time (in seconds) within the scene where the clip should start playing.
    - `duration`: The duration (in seconds) of the audio clip.
    - `narrator` (Optional): Identifier for the voice used.
    - `waveform_data` (Optional): Pre-computed data if waveforms are implemented.

### 3.2. UI (Frontend)
- Modify `SceneComponent` or a related component to render the timeline section.
- Fetch the `audioClips` array for the scene.
- Render the visual blocks (or waveforms) based on `startTime` and `duration`.
- Implement drag-and-drop functionality for the blocks, updating the `startTime` on drop and persisting the change via API call.
- Update the UI for generating/adding new audio clips.

### 3.3. Playback Logic (Frontend)
- The primary player (`VideoContextScenePreviewPlayer` or image timer logic) acts as the master clock.
- Use the main `currentTime` from the master clock.
- In the animation frame loop or equivalent update mechanism:
    - Iterate through the `audioClips` array for the current scene.
    - For each clip, check if `masterCurrentTime` falls within `clip.startTime` and `clip.startTime + clip.duration`.
    - Manage separate `<audio>` elements (potentially dynamically created or pooled) for each *active* clip.
    - Trigger `play()`, `pause()`, and `currentTime` seeking on the relevant `<audio>` elements based on the master clock's state and time, and the clip's `startTime`.
    - **Avoid** trying to integrate these dynamically changing MP3s directly into the `VideoContext` internal graph. Treat them as external elements to be synced.

## 4. Incremental Approach

1.  **Phase 1: Single Draggable Block:** Implement visualization and dragging for the *existing single* voiceover per scene. Modify the data model to store `startTime` and `duration` for the single clip.
2.  **Phase 2: Multiple Blocks:** Modify the backend schema to support the `audioClips` array. Update UI to allow adding/managing multiple clips. Adapt playback logic to handle multiple clips.
3.  **Phase 3 (Optional): Waveform Visualization:** Implement waveform data generation and rendering. 