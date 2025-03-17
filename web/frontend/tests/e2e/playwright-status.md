## Helper Functions

The test suite includes several helper functions that are organized by domain:

### Layout Utilities (`layout-utils.ts`)
- `verifyLayoutAttributes` - Checks if elements have the expected CSS properties and dimensions

### Navigation Utilities (`navigation-utils.ts`)
- Functions for navigating between different parts of the application
- Functions for checking current URL and page state

### Audio Utilities (`audio-utils.ts`)
- `closeVoiceSettingsIfOpen` - Utility to close the voice settings panel if open
- Functions for audio generation and verification

### Wait Utilities (`wait-utils.ts`)
- `waitForButtonReady` - Waits for a button to be visible and enabled
- `waitForProjectWorkspace` - Waits for the project workspace to load
- `waitForSceneAppearance` - Waits for a scene to appear
- `waitForScenes` - Waits for a specific number of scenes to appear
- `sleep` - Pauses execution for a specified duration
- `retry` - Retries an operation until it succeeds or times out

### General Test Utilities (`test-utils.ts`)
- `takeDebugScreenshot` - Takes a screenshot with a timestamped filename
- Re-exports domain-specific utilities for backward compatibility
- General testing helpers not specific to any particular domain

All these utilities are accessible through the central `index.ts` file for easy imports. 