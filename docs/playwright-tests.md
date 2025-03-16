# Playwright E2E Testing Framework

Last Updated: March 22, 2025

## Overview

This document describes the end-to-end testing framework for the Auto Shorts Web App using Playwright. Our testing approach focuses on verifying critical user workflows and ensuring app functionality works as expected across different environments.

## Test Structure

We've adopted a modular, domain-specific approach to organize our tests:

### Test Files

1. **Home Page & Navigation (`home-page.spec.ts`)**
   - Home page loads correctly
   - Navigation between pages works properly

2. **Project Management (`project-management.spec.ts`)**
   - Project creation and setup
   - Existing project loading

3. **Scene Operations (`scene-operations.spec.ts`)**
   - Scene deletion 
   - Drag and drop scene reordering

4. **Audio Generation (`audio-generation.spec.ts`)**
   - Audio generation and playback

5. **Mock Audio Testing (`mock-audio-test.spec.ts`)**
   - Dedicated test for mock audio functionality

### Utility Files

1. **Test Utilities (`utils/test-utils.ts`)**
   - Shared constants
   - Common helper functions
   - Test data

2. **Selectors Library (`utils/selectors.ts`)**
   - Centralized selectors for UI elements
   - Fallback selector strategies
   - Helper functions for reliable element selection

## Running Tests

### Basic Test Command

```bash
cd web/frontend && npm test
```

### Mock Audio Testing

To avoid consuming ElevenLabs API credits, use the mock audio mode:

```bash
cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npm test
```

### Running Specific Test Files

```bash
cd web/frontend && npx playwright test tests/e2e/home-page.spec.ts
```

## Test Status

All tests (8/8) are currently passing.

## Recent Changes

1. **March 22, 2025**
   - Split large test file into domain-specific files for better organization
   - Created shared test utilities and extracted common functions
   - Implemented centralized selectors library
   - Fixed scene deletion test with proper fallback strategies

2. **March 21, 2025**
   - Fixed all issues with scene deletion test
   - Added additional data-testid attributes to components
   - Implemented proper verification for scene element counts

3. **March 20, 2025**
   - Implemented mock audio testing to avoid API credits
   - Fixed UI selection issues with better selectors
   - Enhanced test reliability with better assertion strategies

## Best Practices

1. **Use data-testid Attributes**
   - All interactive components should have data-testid attributes
   - Follow naming pattern: `data-testid="[component]-[element]-[purpose]"`

2. **Centralize Selectors**
   - Add all selectors to the `selectors.ts` file
   - Provide fallback strategies for critical elements

3. **Test Isolation**
   - Each test should create its own data
   - Clean up created resources after test completion
   - Avoid dependencies between tests

4. **Debugging**
   - Use screenshots liberally (`page.screenshot()`)
   - Add descriptive console logs
   - Implement clear error messages

## Troubleshooting

### Common Issues

1. **Element Not Found**
   - Check if data-testid is correct
   - Verify element is visible in UI
   - Try using fallback selectors

2. **Test Timeouts**
   - Adjust timeout constants in test-utils.ts
   - Add additional waiting with expect.poll()
   - Check for network or backend issues

3. **Mock Audio Not Working**
   - Verify NEXT_PUBLIC_MOCK_AUDIO environment variable is set
   - Check console logs for mock initialization
   - Verify route interception is working

## Future Improvements

1. Create domain-specific test utilities
2. Implement visual regression testing
3. Add performance testing metrics
4. Set up continuous integration with test reporting 