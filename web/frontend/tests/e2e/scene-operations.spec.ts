import { test, expect } from '@playwright/test';
import {
  // Import domain-specific helpers
  createProject,
  addScene,
  dragAndDropScene,
  cleanupTestProjects,
  DRAG_HANDLE_SELECTOR,
  
  // Import utilities for shared constants and functions
  NAVIGATION_TIMEOUT,
  PAGE_LOAD_TIMEOUT,
  CONTENT_LOAD_TIMEOUT,
  CRITICAL_STEP_TIMEOUT,
  SCENE_MEDIA_TIMEOUT,
  TEST_PROJECT_NAME,
  TEST_REDDIT_VIDEO_URL,
  SCENES_HEADING,
  BLUE_NUMBER_SELECTOR,
  MEDIA_SELECTOR,
  SCENE_COMPONENT_SELECTOR,
  waitForElementWithText,
  elementWithTextExists
} from './utils/index';

import { selectors, clickWithFallbacks } from './utils/selectors';

/**
 * Tests for scene operations
 */
test.describe('Scene Operations', () => {
  
  // Configure retries for flaky tests
  test.describe.configure({ retries: 2 });
  
  // Add console error logging
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });
  });
  
  // Global project names to track for cleanup
  const createdProjectNames: string[] = [];
  
  // Clean up test projects after each test instead of after all
  test.afterEach(async ({ page }) => {
    console.log('Cleaning up test projects after test...');
    if (createdProjectNames.length > 0) {
      await cleanupTestProjects(page, createdProjectNames);
      // Clear the array after cleanup
      createdProjectNames.length = 0;
    }
  });
  
  // Add global timeout for all tests
  test.slow();
  
  test('Drag and drop scene reordering', async ({ page }) => {
    console.log('Starting drag and drop test...');

    // Create a project with a unique name
    const projectNameDnD = TEST_PROJECT_NAME + ' DnD ' + Date.now().toString().slice(-4);
    createdProjectNames.push(projectNameDnD); // Add to tracked projects
    await createProject(page, projectNameDnD);
    console.log('Project created:', projectNameDnD);

    // Add first scene
    await addScene(page, TEST_REDDIT_VIDEO_URL);
    console.log('First scene added');
    
    // Wait longer for scene to fully load and stabilize
    await page.waitForTimeout(5000);
    
    // Add second scene
    await addScene(page, TEST_REDDIT_VIDEO_URL);
    console.log('Second scene added');
    
    // Wait longer after adding scenes before attempting drag operations 
    await page.waitForTimeout(10000);
    console.log('Waiting for scenes to fully load and stabilize before drag operations');
    
    // Verify we have 2 scenes before testing drag and drop
    const sceneComponents = page.locator(SCENE_COMPONENT_SELECTOR);
    const sceneCount = await sceneComponents.count();
    expect(sceneCount).toBe(2);
    console.log(`Verified scene count: ${sceneCount}`);
    
    // Wait a moment to ensure scenes are fully loaded
    await page.waitForTimeout(1000);
    
    // Perform drag and drop (move first scene to second position)
    await dragAndDropScene(page, 0, 1);
    console.log('Drag and drop completed');
    
    // Verify the reordering
    // This is implementation-specific and depends on how your UI shows the reordering
    // For example, if each scene has a number indicator:
    await page.waitForTimeout(1000); // Wait for any animations to complete
    
    // Verification can be done by checking specific scene properties
    // For this example, we just verify that the scenes are still there
    const scenesAfterDrag = page.locator(SCENE_COMPONENT_SELECTOR);
    const sceneCountAfterDrag = await scenesAfterDrag.count();
    expect(sceneCountAfterDrag).toBe(2);
    console.log(`Verified scene count after drag: ${sceneCountAfterDrag}`);
    
    console.log('Drag and drop test completed successfully');
  });
  
  test('Scene deletion', async ({ page }) => {
    console.log('Starting scene deletion test...');
    
    // Create a project
    await page.goto('/projects/create', { timeout: NAVIGATION_TIMEOUT });
    
    // Wait for the page to fully loaded
    await page.waitForSelector('input[placeholder="Enter project name"]', { timeout: PAGE_LOAD_TIMEOUT });
    
    // Generate a unique project name with a timestamp to avoid conflicts
    const projectNameDelete = TEST_PROJECT_NAME + ' Delete ' + Date.now().toString().slice(-4);
    await page.getByPlaceholder('Enter project name').fill(projectNameDelete);
    await page.getByRole('button', { name: 'Create Project' }).click();
    
    // Wait for project workspace to load and verify URL pattern first
    await page.waitForURL(/.*\/projects\/[a-z0-9]+$/, { timeout: NAVIGATION_TIMEOUT });
    console.log('Project URL loaded:', await page.url());
    
    // Wait for network idle to ensure all initial resources are loaded
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
      console.log('Network still active, continuing anyway');
    });
    
    // Take a screenshot in the workspace
    await page.screenshot({ path: 'debug-project-workspace-delete.png' });
    
    // Wait for the Reddit URL input field
    console.log('Waiting for Reddit URL input to be visible...');
    await page.waitForSelector('input[placeholder="Enter post URL"]', { timeout: CRITICAL_STEP_TIMEOUT });
    console.log('Reddit URL input is visible, workspace is ready');
    
    // Add a scene - using a photo URL as it's more likely to load consistently
    await page.getByPlaceholder('Enter post URL').fill(TEST_REDDIT_VIDEO_URL);
    console.log('Filled URL input with:', TEST_REDDIT_VIDEO_URL);
    
    // Take screenshot before clicking Add
    await page.screenshot({ path: 'debug-before-add-scene-delete.png' });
    
    // Click the Add button and wait for it to be processed
    await page.getByRole('button', { name: 'Add' }).click();
    console.log('Clicked Add button');
    
    // Wait for network activity to suggest content is being fetched
    await page.waitForTimeout(2000);
    
    // Take a screenshot after adding scene but before verifying
    await page.screenshot({ path: 'debug-after-add-click-delete.png' });
    
    // Log test status before waiting for media container
    console.log('Added scene, now waiting for scene container with blue number...');
    
    // Wait for Scenes section to appear
    console.log('Waiting for Scenes section to appear...');
    await expect(page.getByText(SCENES_HEADING)).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });
    
    console.log('Waiting for first scene (blue number 1) to appear...');
    // Use a more specific selector that targets the blue circled number
    const blueNumberText = '1';
    await expect.poll(async () => {
      return elementWithTextExists(page, BLUE_NUMBER_SELECTOR, blueNumberText);
    }, {
      message: `Expected to find blue number with text "${blueNumberText}"`,
      timeout: PAGE_LOAD_TIMEOUT
    }).toBeTruthy();
    console.log('Scene added successfully (blue number 1 is visible)');

    // Take a screenshot of the scene before looking for media
    await page.screenshot({ path: 'debug-scene-before-media-check.png' });
    
    // Check what elements are actually loaded
    const sceneHTML = await page.evaluate(() => {
      const sceneEl = document.querySelector('.scene-container, [data-testid="scene-component"]');
      return sceneEl ? sceneEl.outerHTML : 'No scene container found';
    });
    console.log('Scene container HTML:', sceneHTML.substring(0, 500) + (sceneHTML.length > 500 ? '...' : ''));
    
    // Check for any media elements and their state with proper TypeScript typing
    console.log('Checking media elements on page...');
    const mediaElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('img, video'));
      return elements.map(el => {
        const htmlEl = el as HTMLElement;
        return {
          tagName: el.tagName,
          src: el.getAttribute('src') || 'no-src',
          // Use safe optional chaining for dimensions
          width: htmlEl?.offsetWidth || 0,
          height: htmlEl?.offsetHeight || 0,
          isVisible: (htmlEl?.offsetWidth || 0) > 0 && (htmlEl?.offsetHeight || 0) > 0,
          inViewport: el.getBoundingClientRect().top < window.innerHeight
        };
      });
    });
    console.log('Media elements on page:', JSON.stringify(mediaElements, null, 2));
    
    // Check network requests status for media with proper TypeScript typing
    console.log('Checking network requests for media...');
    const mediaRequests = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      return resources
        .filter(r => {
          const url = r.name || '';
          return url.includes('media') || url.includes('image') || url.includes('video');
        })
        .map(r => {
          // Safely access properties with proper typing
          const res = r as PerformanceResourceTiming;
          return {
            url: res.name || '',
            duration: res.duration || 0,
            completed: (res.responseEnd || 0) > 0
          };
        });
    });
    console.log('Media network requests:', JSON.stringify(mediaRequests, null, 2));
    
    // Wait for media loading to start - this is when we expect to see a placeholder/loading state
    console.log('Waiting for media container to appear...');
    
    // IMPROVED MEDIA CONTAINER DETECTION
    // First check if the scene component itself exists
    console.log('Checking if scene component exists...');
    const sceneComponent = page.locator(SCENE_COMPONENT_SELECTOR);
    await expect(sceneComponent).toBeVisible({ timeout: 10000 });
    console.log('Scene component is visible');
    
    // Take a screenshot of the scene component
    await page.screenshot({ path: 'debug-scene-component-visible.png' });
    
    // Instead of using a complex selector, first find the scene component
    // Then check if it contains any media elements within it
    console.log('Looking for media elements inside scene component...');
    await expect.poll(async () => {
      // Count media elements (img, video) within the scene component
      const mediaElementsCount = await page.locator(`${SCENE_COMPONENT_SELECTOR} img, ${SCENE_COMPONENT_SELECTOR} video`).count();
      console.log(`Found ${mediaElementsCount} media elements in scene component`);
      return mediaElementsCount > 0;
    }, {
      message: 'Expected to find media elements in scene component',
      timeout: 30000
    }).toBeTruthy();
    
    // Take another screenshot after media verification
    await page.screenshot({ path: 'debug-media-verified.png' });
    
    // Wait for any network requests to complete
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(e => {
      console.log('Network still active, continuing anyway');
    });
    
    // Verify the scene component is present and ready for deletion
    console.log('Verifying scene component is present...');
    await expect(page.locator(SCENE_COMPONENT_SELECTOR)).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });
    console.log('Scene component is visible and ready for deletion test');

    // Take a screenshot before deletion attempt to see the UI
    await page.screenshot({ path: 'debug-before-deletion.png' });
    
    // Get the initial scene count
    const initialSceneCount = await page.locator(SCENE_COMPONENT_SELECTOR).count();
    console.log(`Initial scene count: ${initialSceneCount}`);

    // Ensure the page is fully loaded and stable before attempting deletion
    console.log('Ensuring page is stable before deletion...');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(6000); // Increased from 2000ms to 6000ms to allow video content to fully load
    
    // Try multiple strategies to find and click the delete button
    console.log('Attempting to delete scene with multiple strategies...');
    let buttonClicked = false;
    let sceneDeleted = false;

    // STRATEGY 1: Use the specific delete button with data-testid
    if (!buttonClicked) {
      try {
        console.log('Looking for delete button with data-testid="delete-scene-button"');
        const deleteButton = page.locator('[data-testid="delete-scene-button"]');
        
        if (await deleteButton.count() > 0) {
          console.log('Found delete button with data-testid');
          await deleteButton.waitFor({ state: 'visible', timeout: 5000 });
          
          // Wait for the button to be enabled
          await page.waitForTimeout(500);
          
          // First take a screenshot to show the button
          await page.screenshot({ path: 'debug-found-delete-button.png' });
          
          // Click the button
          await deleteButton.click({ timeout: 5000 });
          console.log('Successfully clicked the delete button with data-testid');
          buttonClicked = true;
        } else {
          console.log('No delete button found with data-testid="delete-scene-button"');
        }
      } catch (e) {
        console.log('Error clicking delete button with data-testid:', e);
      }
    }
    
    // STRATEGY 2: Use centralized selectors with fallbacks
    if (!buttonClicked) {
      try {
        console.log('Trying to use centralized selectors with fallbacks...');
        await clickWithFallbacks(page, selectors.sceneDeleteButtonFallbacks);
        console.log('Successfully clicked delete button with fallback selectors');
        buttonClicked = true;
      } catch (e) {
        console.log('Error using clickWithFallbacks:', e);
      }
    }
    
    // STRATEGY 3: Try direct selector as fallback
    if (!buttonClicked) {
      try {
        console.log('Falling back to direct selector...');
        await page.click(selectors.sceneDeleteButton);
        console.log('Successfully clicked delete button with direct selector');
        buttonClicked = true;
      } catch (e) {
        console.log('Error using direct selector:', e);
      }
    }
    
    // STRATEGY 4: Try by role and name
    if (!buttonClicked) {
      try {
        console.log('Trying to click delete with role and name...');
        
        // First look for any visible buttons in the scene
        const sceneButtons = page.locator('.scene-container button, [data-testid="scene-component"] button');
        const buttonCount = await sceneButtons.count();
        console.log(`Found ${buttonCount} buttons in scene container`);
        
        if (buttonCount > 0) {
          // Click the first button that might be for deletion
          for (let i = 0; i < buttonCount; i++) {
            const button = sceneButtons.nth(i);
            const isVisible = await button.isVisible();
            
            if (isVisible) {
              console.log(`Clicking visible button at index ${i}`);
              await button.click({ timeout: 5000 });
              buttonClicked = true;
              break;
            }
          }
        } else {
          // Try with generic role/name selectors
          await page.getByRole('button', { name: /remove|delete|×/i }).click({ timeout: 5000 });
          console.log('Successfully clicked delete button with role/name');
          buttonClicked = true;
        }
      } catch (e) {
        console.log('Error using role/name:', e);
      }
    }
    
    // STRATEGY 5: Try positional clicking as last resort
    if (!buttonClicked) {
      try {
        console.log('Trying positional clicking as last resort...');
        const scene = page.locator(SCENE_COMPONENT_SELECTOR).first();
        const box = await scene.boundingBox();
        
        if (box) {
          // Take a screenshot showing the scene before clicking
          await page.screenshot({ path: 'debug-scene-before-position-click.png' });
          
          // Click in the top right corner where the delete button typically is
          await page.mouse.click(box.x + box.width - 20, box.y + 20);
          console.log('Clicked position where delete button should be');
          
          // Also try clicking other positions where the delete button might be
          if (!sceneDeleted) {
            // Try top right but a bit lower down
            await page.mouse.click(box.x + box.width - 20, box.y + 40);
            // Try top right but a bit further left
            await page.mouse.click(box.x + box.width - 40, box.y + 20);
          }
          
          buttonClicked = true;
        } else {
          console.log('Could not get bounding box for scene');
        }
      } catch (e) {
        console.log('Error with positional clicking:', e);
      }
    }
    
    if (buttonClicked) {
      console.log('Successfully clicked delete button with fallback selectors');
      // Add a short delay to allow drag-and-drop library state to settle after deletion
      await page.waitForTimeout(500); // 500ms pause
      
      // Explicitly wait for the scene count to decrease
      await expect.poll(async () => {
        return await page.locator(SCENE_COMPONENT_SELECTOR).count();
      }, {
        message: 'Polling: Expected scene count to decrease after deletion click and timeout',
        timeout: CRITICAL_STEP_TIMEOUT // Use a reasonable timeout
      }).toBeLessThan(initialSceneCount);
      console.log('✓ Scene count confirmed decreased after polling');

    } else {
      console.error('Failed to click delete button using any strategy');
      await page.screenshot({ path: 'debug-delete-button-fail.png' });
      throw new Error('Could not find or click the scene delete button');
    }

    // Verify scene count decreased (This might become redundant but keeping for now)
    console.log(`Scene count after deletion attempt: ${await page.locator(SCENE_COMPONENT_SELECTOR).count()} (was ${initialSceneCount})`);
    await expect.poll(async () => {
      return await page.locator(SCENE_COMPONENT_SELECTOR).count();
    }, {
      message: 'Expected scene count to decrease after deletion',
      timeout: CRITICAL_STEP_TIMEOUT
    }).toBeLessThan(initialSceneCount);
    
    console.log('✓ Scene deletion verified - scene count decreased');
    console.log('Scene deletion test completed');
    
    // Final screenshot after successful deletion
    await page.screenshot({ path: 'debug-after-deletion.png' });

    // Clean up the created project after the test
    await cleanupTestProjects(page, [projectNameDelete]);
  });
}); 