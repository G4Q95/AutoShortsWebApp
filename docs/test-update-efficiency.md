# Test Update Efficiency Guidelines

This document outlines strategies to make our Playwright test suite more efficient, easier to maintain, and less time-consuming to update when implementing new features.

## Current Challenges

Our current testing approach faces several challenges:

- [ ] Time-consuming maintenance of comprehensive end-to-end tests
- [ ] Brittle selectors that break with UI changes
- [ ] Heavy reliance on specific UI implementation details
- [ ] Tests that require extensive rewriting with feature updates
- [ ] Long test execution times
- [ ] Difficulty isolating failures in large test files

## Improvement Strategies

### 1. Component-Level Testing

Complement E2E tests with more focused component tests for faster feedback and better isolation.

- [ ] Set up React Testing Library for component tests
- [ ] Create component tests for complex UI elements like SceneComponent
- [ ] Test complex logic in isolation
- [ ] Reserve E2E tests for critical user flows only

**Example Component Test:**
```javascript
// Component test example
test('Generate Voiceover button enables when text is valid', async () => {
  render(<SceneComponent sceneData={mockSceneData} />);
  expect(screen.getByText('Generate Voiceover')).toBeDisabled();
  // Add text to make button enable
  fireEvent.change(screen.getByTestId('scene-text-input'), { 
    target: { value: 'Valid text' }
  });
  expect(screen.getByText('Generate Voiceover')).toBeEnabled();
});
```

### 2. Test Helpers & Abstraction

Create reusable helper functions to avoid repetition and improve maintainability.

- [ ] Identify common test patterns and create helper functions
- [ ] Create a dedicated test utilities file (`test-utils.ts`)
- [ ] Abstract page object patterns for complex interactions
- [ ] Centralize setup and teardown logic

**Example Helper Functions:**
```javascript
// test-utils.ts
export async function createTestProject(page, projectName = `Test Project ${Date.now()}`) {
  await page.goto('/');
  await page.click('text=Create Video');
  await page.fill('[data-testid="project-name-input"]', projectName);
  await page.click('[data-testid="create-project-button"]');
  await page.waitForSelector('[data-testid="project-workspace"]');
  return projectName;
}

export async function addSceneWithContent(page, url) {
  await page.fill('[data-testid="url-input"]', url);
  await page.click('[data-testid="add-content-button"]');
  return await page.waitForSelector('.scene-container');
}
```

### 3. Resilient Selectors Strategy

Improve selector resiliency to reduce breakage from UI changes.

- [ ] Add consistent `data-testid` attributes to all key UI elements
- [ ] Create a centralized selectors library file
- [ ] Implement multiple fallback selectors in priority order
- [ ] Use text-based selectors when appropriate
- [ ] Avoid relying on CSS classes that may change with styling updates

**Example Selectors Library:**
```javascript
// selectors.ts
export const selectors = {
  // Navigation & Global UI
  homeButton: '[data-testid="home-button"]',
  createVideoButton: '[data-testid="create-video-button"]',
  myProjectsButton: '[data-testid="my-projects-button"]',
  
  // Project Creation
  projectNameInput: '[data-testid="project-name-input"]',
  createProjectButton: '[data-testid="create-project-button"]',
  
  // Project Workspace
  projectWorkspace: '[data-testid="project-workspace"]',
  urlInput: '[data-testid="url-input"]',
  addContentButton: '[data-testid="add-content-button"]',
  
  // Scene Components
  sceneComponent: '[data-testid="scene-component"]',
  sceneDeleteButton: '[data-testid="scene-delete-button"]',
  sceneTextInput: '[data-testid="scene-text-input"]',
  
  // Audio Generation
  generateVoiceButton: '[data-testid="generate-voice-button"]',
  voiceSelector: '[data-testid="voice-selector"]',
  audioPlayer: '[data-testid="audio-player"]',
  
  // Fallback selectors with multiple strategies
  generateVoiceButtonFallbacks: {
    testId: '[data-testid="generate-voice-button"]',
    text: 'text="Generate Voiceover"',
    cssClass: '.voice-generation-button',
  }
};
```

**Example Usage:**
```javascript
import { selectors } from './selectors';

// Simple usage
await page.click(selectors.generateVoiceButton);

// With fallbacks
async function clickGenerateVoice(page) {
  const { testId, text, cssClass } = selectors.generateVoiceButtonFallbacks;
  try {
    await page.click(testId);
  } catch {
    try {
      await page.click(text);
    } catch {
      await page.click(cssClass);
    }
  }
}
```

### 4. Test-Driven Feature Development

Write tests before or alongside feature implementation, not after.

- [ ] Create failing tests for new features before implementation
- [ ] Implement the feature to make tests pass
- [ ] Test interfaces and contracts before implementing details
- [ ] Evolve tests alongside feature development

**TDD Process:**
1. Write a failing test describing the new feature's behavior
2. Implement the minimum code needed to pass the test
3. Refactor the code while keeping tests passing
4. Repeat for each aspect of the feature

### 5. Modular Test Structure

Break down monolithic tests into smaller, focused files.

- [ ] Split core-functionality.spec.ts into feature-specific test files
- [ ] Create independent test suites that don't rely on each other
- [ ] Implement test categorization with tags
- [ ] Enable parallel test execution for faster feedback

**Suggested Test Structure:**
```
tests/
  e2e/
    project-creation.spec.ts    # Just project creation
    scene-management.spec.ts    # Just scene management
    voice-generation.spec.ts    # Just voice features
    mock-audio.spec.ts          # Just mock audio
    drag-and-drop.spec.ts       # Just drag and drop functionality
  components/
    scene-component.spec.tsx    # Component tests for SceneComponent
    audio-controls.spec.tsx     # Component tests for audio controls
  utils/
    selectors.ts                # Centralized selectors
    test-utils.ts               # Common test utilities
```

### 6. Test Tagging and Filtering

Implement test tags for selective test execution.

- [ ] Add tags to categorize tests (feature, smoke, regression)
- [ ] Create custom test commands for running specific test subsets
- [ ] Add npm scripts for common test patterns
- [ ] Document tagging conventions

**Example Tagging:**
```javascript
// In test files
test.describe.configure({ tag: '@voice' });
test('generates voice for scene', { tag: '@voice' }, async ({ page }) => {
  // Test code
});

// In another file
test.describe.configure({ tag: '@project' });
test('creates new project', { tag: '@project' }, async ({ page }) => {
  // Test code
});
```

**Running Tagged Tests:**
```bash
# Run only voice-related tests
npx playwright test --grep @voice

# Run smoke tests across all features
npx playwright test --grep @smoke

# Run all tests except slow ones
npx playwright test --grep-invert @slow
```

**Package.json Scripts:**
```json
{
  "scripts": {
    "test:smoke": "playwright test --grep @smoke",
    "test:voice": "playwright test --grep @voice",
    "test:project": "playwright test --grep @project"
  }
}
```

### 7. Visual Regression Testing

Leverage Playwright's built-in visual comparison capabilities.

- [ ] Implement snapshot testing for critical UI components
- [ ] Create baseline screenshots for important UI states
- [ ] Automate visual regression detection
- [ ] Include visual testing in CI/CD pipeline

**Example Visual Test:**
```javascript
test('project workspace visual appearance', async ({ page }) => {
  await createTestProject(page);
  await addSceneWithContent(page, 'https://reddit.com/r/example');
  
  // Take screenshot and compare with baseline
  expect(await page.screenshot({
    fullPage: true,
  })).toMatchSnapshot('project-with-one-scene.png');
});
```

### 8. State Setup Optimization

Optimize test state setup for faster test execution.

- [ ] Use API calls instead of UI interactions for test setup where possible
- [ ] Implement direct database seeding for test data
- [ ] Create fixtures for common test scenarios
- [ ] Share authentication state between tests
- [ ] Reset application state between tests without full reload

**Example API-Based Setup:**
```javascript
test('existing project functionality', async ({ page, request }) => {
  // Create project via API instead of UI
  const projectData = {
    name: `API Test Project ${Date.now()}`,
    scenes: []
  };
  
  const response = await request.post(`${API_BASE_URL}/projects`, {
    data: projectData
  });
  
  const { id } = await response.json();
  
  // Now navigate directly to the project
  await page.goto(`/projects/${id}`);
  
  // Continue with UI testing from here
  await addSceneWithContent(page, 'https://reddit.com/r/example');
  // ...
});
```

## Quick Wins (Implement These First)

These changes can be implemented immediately for fast impact:

- [ ] **Test Tags for Selective Running**:
  ```javascript
  test.describe.configure({ tag: '@voice' });
  test('generates voice for scene', { tag: '@voice' }, async ({ page }) => {
    // Test code
  });
  
  // Run only voice tests:
  // npx playwright test --grep @voice
  ```

- [ ] **Selector Library**:
  ```javascript
  // selectors.ts
  export const selectors = {
    projectWorkspace: '[data-testid="project-workspace"]',
    sceneComponent: '[data-testid="scene-component"]',
    generateVoiceButton: '[data-testid="generate-voice-button"]',
    // Add all your selectors here
  };
  
  // In tests
  import { selectors } from './selectors';
  await page.click(selectors.generateVoiceButton);
  ```

- [ ] **Helper Functions for Common Operations**:
  ```javascript
  // test-utils.ts
  export async function createTestProject(page, name = `Test ${Date.now()}`) {
    await page.goto('/');
    await page.click('text=Create Video');
    await page.fill('[data-testid="project-name-input"]', name);
    await page.click('[data-testid="create-project-button"]');
    return name;
  }
  ```

- [ ] **Add data-testid to Key Elements**:
  ```html
  <!-- Before -->
  <button class="generate-voice-btn">Generate Voiceover</button>
  
  <!-- After -->
  <button 
    class="generate-voice-btn" 
    data-testid="generate-voice-button"
  >Generate Voiceover</button>
  ```

- [ ] **Split Tests by Feature Area**:
  ```
  # Instead of one large file:
  core-functionality.spec.ts
  
  # Create multiple smaller files:
  project-creation.spec.ts
  scene-management.spec.ts  
  voice-generation.spec.ts
  ```

## Implementation Plan

### Phase 1: Foundation (1-2 days)
- [ ] Create selectors.ts library
- [ ] Create test-utils.ts for helper functions
- [ ] Add data-testid attributes to critical UI elements
- [ ] Implement test tagging for major feature areas

### Phase 2: Test Restructuring (2-3 days)
- [ ] Split core-functionality.spec.ts into feature-specific files
- [ ] Update package.json with scripts for running specific test groups
- [ ] Refactor common test patterns into helper functions
- [ ] Implement visual regression tests for key UI components

### Phase 3: Advanced Improvements (ongoing)
- [ ] Setup component testing for complex UI elements
- [ ] Implement API-based test setup for faster execution
- [ ] Create fixtures for common test scenarios
- [ ] Automate visual regression testing in CI pipeline

## Progress Tracking

- **Phase 1 Progress**: 50% complete
  - [x] Create selectors.ts library
  - [x] Create test-utils.ts for helper functions
  - [ ] Add data-testid attributes to critical UI elements
  - [x] Implement test tagging for major feature areas

- **Phase 2 Progress**: 0% complete
  - [ ] Split core-functionality.spec.ts into feature-specific files
  - [ ] Update package.json with scripts for running specific test groups
  - [ ] Refactor common test patterns into helper functions
  - [ ] Implement visual regression tests for key UI components

- **Phase 3 Progress**: 0% complete
  - [ ] Setup component testing for complex UI elements
  - [ ] Implement API-based test setup for faster execution
  - [ ] Create fixtures for common test scenarios
  - [ ] Automate visual regression testing in CI pipeline

- **Overall Progress**: 15% complete

## Implemented Improvements

- **Selectors Library**: Created a centralized file for all test selectors with fallback mechanisms
- **Test Utilities**: Implemented common helper functions to reduce duplication across tests
- **Test Tagging**: Added tag-based comments to tests for selective test running

## Conclusion

By implementing these improvements incrementally, we'll gradually reduce the time spent on test maintenance while maintaining comprehensive test coverage. The goal is to shift from spending most development time on test maintenance to spending it on actual feature development, while still keeping a robust safety net of tests.

## Resources

- [Playwright Test Documentation](https://playwright.dev/docs/test-intro)
- [Page Object Model Pattern](https://playwright.dev/docs/test-pom)
- [Test Fixtures in Playwright](https://playwright.dev/docs/test-fixtures)
- [Visual Comparisons in Playwright](https://playwright.dev/docs/test-snapshots)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) 