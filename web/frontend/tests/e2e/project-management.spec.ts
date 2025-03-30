import { test, expect, Page } from '@playwright/test';
import { 
    // Imports verified based on usage in this file
    NAVIGATION_TIMEOUT,
    PAGE_LOAD_TIMEOUT, 
    elementWithTextExists,
    SCENE_MEDIA_TIMEOUT,
    createTestProject,
    waitForElementWithText
} from './utils/test-utils';
// Assuming selectors are needed and defined in selectors.ts
import { selectors } from './utils/selectors'; 

// Create an array to track project IDs created during tests
let createdProjectIds: string[] = [];

// Constants used locally in this file
const TEST_PROJECT_NAME = "Test Project 84"; 
const TEST_REDDIT_PHOTO_URL = 'https://www.reddit.com/r/pics/comments/z6xw4d/this_photo_i_took_of_my_cat_looking_out_the_window/';
const TEST_REDDIT_VIDEO_URL = 'https://www.reddit.com/r/interesting/comments/1j7mwks/sand_that_moves_like_water_in_the_desert/';
// Define necessary selectors locally - Adjust these if they differ in your setup
const BLUE_NUMBER_SELECTOR = '[data-testid="scene-number-indicator"]'; 
const MEDIA_SELECTOR = 'img, video'; 

test.describe('Project Management', () => {
  
  test.describe.configure({ retries: 2 });
  
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });
  });
  
  test.slow();
  
  // Add afterAll hook for cleanup
  test.afterAll(async ({ request }) => {
    console.log('Running afterAll hook to clean up test projects...');
    if (createdProjectIds.length === 0) {
      console.log('No project IDs captured during test run, skipping cleanup.');
      return;
    }
    
    // Ensure unique IDs before sending
    const uniqueProjectIds = [...new Set(createdProjectIds)];
    console.log(`Attempting to clean up ${uniqueProjectIds.length} unique project IDs:`, uniqueProjectIds);
    
    try {
      // Use the modified backend endpoint that expects project_ids
      const response = await request.post('http://localhost:8000/api/v1/debug/cleanup-test-data', {
        data: { 
          project_ids: uniqueProjectIds // Send the list of captured unique IDs
        },
        headers: { 
          'Content-Type': 'application/json' 
        }
      });

      if (response.ok()) {
        const result = await response.json();
        console.log('Cleanup API call successful:', result);
        // Check if the counts match
        if (result.projects_deleted_db !== uniqueProjectIds.length || result.r2_cleanup_scheduled !== uniqueProjectIds.length) {
            console.warn(`Cleanup Mismatch: Attempted ${uniqueProjectIds.length}, DB Deleted ${result.projects_deleted_db}, R2 Scheduled ${result.r2_cleanup_scheduled}`);
        }
        if (result.errors && result.errors.length > 0) {
            console.error('Cleanup reported errors:', result.errors);
        }
      } else {
        // Log detailed error if API call fails
        console.error(`Cleanup API call failed: Status ${response.status()} ${response.statusText()}`);
        try {
            const errorBody = await response.json(); // Try parsing JSON first
            console.error('Cleanup error details (JSON):', errorBody);
        } catch (parseError) {
            const errorBody = await response.text(); // Fallback to text
            console.error('Cleanup error details (Text):', errorBody);
        }
      }
    } catch (error) {
      // Log error if the request itself fails
      console.error('Error during cleanup API call:', error);
    }
    // Reset the list for safety, although ideally not needed if tests run isolated
    createdProjectIds = []; 
  });
  
  test('Project creation and management', async ({ page }) => {
    console.log('Starting project creation test...');
    
    await page.goto('/projects/create', { timeout: NAVIGATION_TIMEOUT });
    await page.waitForSelector('input[placeholder="Enter project name"]', { timeout: PAGE_LOAD_TIMEOUT });
    
    const projectName = TEST_PROJECT_NAME + ' ' + Date.now().toString().slice(-5);
    console.log('Creating project with name:', projectName);
    
    await page.getByPlaceholder('Enter project name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();
    
    console.log('Waiting for project workspace to load...');
    await page.waitForURL(/.*\/projects\/[a-z0-9]+$/, { timeout: NAVIGATION_TIMEOUT });
    console.log('Project workspace loaded, URL:', page.url());
    
    const createdProjectUrl = page.url();
    const createdProjectIdMatch = createdProjectUrl.match(/\/projects\/(?:proj_)?([a-zA-Z0-9]+)$/); 
    if (createdProjectIdMatch && createdProjectIdMatch[1]) {
      const extractedId = createdProjectIdMatch[1]; 
      console.log('Captured project ID from creation:', extractedId);
      if (!createdProjectIds.includes(extractedId)) { 
          createdProjectIds.push(extractedId);
      }
    } else {
      console.warn('Could not extract project ID from URL after creation:', createdProjectUrl);
    }
    
    await page.screenshot({ path: 'debug-project-created.png' });
    await page.waitForSelector('input[placeholder="Enter Reddit URL"]', { timeout: PAGE_LOAD_TIMEOUT });
    
    console.log('Adding a scene to project...');
    await page.getByPlaceholder('Enter Reddit URL').fill(TEST_REDDIT_PHOTO_URL);
    await page.getByRole('button', { name: 'Add' }).click();
    
    console.log('Waiting for scene to appear...');
    const blueNumberText = '1'; 
    await expect.poll(async () => {
      return elementWithTextExists(page, BLUE_NUMBER_SELECTOR, blueNumberText); 
    }, {
      message: `Expected to find scene number indicator with text "${blueNumberText}"`,
      timeout: PAGE_LOAD_TIMEOUT 
    }).toBeTruthy();
    console.log('Scene appeared successfully');
    
    console.log('Waiting for media content to load...');
    await expect(page.locator(MEDIA_SELECTOR).first()).toBeVisible({ timeout: SCENE_MEDIA_TIMEOUT });
    console.log('Media content loaded successfully');
    
    await page.screenshot({ path: 'debug-scene-added.png' });
    
    console.log('Navigating to home page to test project re-entry...');
    try {
      await page.locator('header >> text=Auto Shorts').click(); 
      await page.waitForURL('/', { timeout: NAVIGATION_TIMEOUT });
      console.log('Successfully navigated to home page, URL:', page.url());
    } catch (error) {
      console.error('Error navigating to home page:', error);
      console.log('Trying direct navigation to home page as fallback');
      await page.goto('/', { timeout: NAVIGATION_TIMEOUT });
      console.log('Direct navigation URL:', page.url());
    }
    
    console.log('Navigating to My Projects page...');
    await page.locator('header').getByRole('link', { name: 'My Projects' }).click();
    await page.waitForURL(/.*\/projects\/?$/, { timeout: NAVIGATION_TIMEOUT });
    
    await page.waitForSelector('h1', { timeout: PAGE_LOAD_TIMEOUT });
    console.log('Projects page loaded successfully');
    
    // Use local helper function to find and click
    await findAndClickProject(page, projectName); 
    
    await page.waitForURL(/.*\/projects\/[a-z0-9]+$/, { timeout: NAVIGATION_TIMEOUT });
    const navigatedUrl = page.url(); 
    console.log('Successfully navigated back to project workspace:', navigatedUrl);

    const navigatedMatch = navigatedUrl.match(/\/projects\/(?:proj_)?([a-zA-Z0-9]+)$/); 
    if (navigatedMatch && navigatedMatch[1]) {
      const navigatedId = navigatedMatch[1]; 
      console.log('Captured project ID after navigation:', navigatedId);
      if (!createdProjectIds.includes(navigatedId)) { 
          createdProjectIds.push(navigatedId);
      }
    } else {
      console.warn('Could not extract project ID from URL after navigation:', navigatedUrl);
    }
    
    console.log('Project creation test completed - cleanup deferred to afterAll');
    // Removed the inline cleanup logic from here
  });

  test('Existing project functionality', async ({ page }) => {
    console.log('Starting existing project test...');
    
    await page.goto('/projects/create', { timeout: NAVIGATION_TIMEOUT });
    await page.waitForSelector('input[placeholder="Enter project name"]', { timeout: PAGE_LOAD_TIMEOUT });
    
    const projectNameExisting = TEST_PROJECT_NAME + ' Existing ' + Date.now().toString().slice(-5);
    console.log('Creating project with name:', projectNameExisting);
    
    await page.getByPlaceholder('Enter project name').fill(projectNameExisting);
    await page.getByRole('button', { name: 'Create Project' }).click();
    
    await page.waitForURL(/.*\/projects\/[a-z0-9]+$/, { timeout: NAVIGATION_TIMEOUT });
    
    const projectUrlExisting = page.url(); 
    const projectIdExistingMatch = projectUrlExisting.match(/\/projects\/(?:proj_)?([a-zA-Z0-9]+)$/); 
    if (projectIdExistingMatch && projectIdExistingMatch[1]) {
        const extractedIdExisting = projectIdExistingMatch[1]; 
        console.log('Captured project ID for existing test:', extractedIdExisting);
        if (!createdProjectIds.includes(extractedIdExisting)) {
            createdProjectIds.push(extractedIdExisting);
        }
    } else {
        console.warn('Could not extract project ID for existing test:', projectUrlExisting);
    }
    
    await page.waitForSelector('input[placeholder="Enter Reddit URL"]', { timeout: PAGE_LOAD_TIMEOUT });
    
    await page.getByPlaceholder('Enter Reddit URL').fill(TEST_REDDIT_PHOTO_URL); // Use Photo URL here
    await page.getByRole('button', { name: 'Add' }).click();
    
    console.log('Waiting for scene in existing project test...');
    const blueNumberTextExisting = '1';
    await expect.poll(async () => {
      return elementWithTextExists(page, BLUE_NUMBER_SELECTOR, blueNumberTextExisting);
    }, {
      message: `Expected to find scene number indicator with text "${blueNumberTextExisting}"`,
      timeout: PAGE_LOAD_TIMEOUT
    }).toBeTruthy();
    
    await expect(page.locator(MEDIA_SELECTOR).first()).toBeVisible({ timeout: SCENE_MEDIA_TIMEOUT });
    console.log('Scene and media loaded in existing project test');

    console.log('Adding second scene to verify project functionality...');
    await page.getByPlaceholder('Enter Reddit URL').fill(TEST_REDDIT_VIDEO_URL); // Use Video URL here
    await page.getByRole('button', { name: 'Add' }).click();
    
    console.log('Waiting for second scene to appear...');
    const blueNumberTextSecond = '2'; 
    await expect.poll(async () => {
      return elementWithTextExists(page, BLUE_NUMBER_SELECTOR, blueNumberTextSecond);
    }, {
      message: `Expected to find scene number indicator with text "${blueNumberTextSecond}"`,
      timeout: PAGE_LOAD_TIMEOUT 
    }).toBeTruthy();
    
    console.log('Waiting for second scene media to load...');
    await expect(page.locator(MEDIA_SELECTOR).nth(1)).toBeVisible({ timeout: SCENE_MEDIA_TIMEOUT }); 
    console.log('Second scene added successfully');
    
    console.log('Existing project test completed - cleanup deferred to afterAll');
     // Removed the inline cleanup logic from here
  });

}); // End of describe block

// Local helper function (Modified to wait for project cards)
async function findAndClickProject(page: Page, projectName: string) {
  console.log(`Looking for project '${projectName}' on projects page...`);
  
  // --- MODIFIED: Wait for the project list container or at least one card ---
  const projectListSelector = '.grid'; // Adjust if your project list uses a different container selector
  const projectCardSelector = '.project-card'; // Adjust if your card uses a different class
  
  try {
      console.log(`Waiting for project list container ('${projectListSelector}') or at least one card ('${projectCardSelector}')...`);
      // Wait for either the main container or the first card within it to be visible
      await page.locator(`${projectListSelector} ${projectCardSelector}:first-child, ${projectListSelector}`).first().waitFor({ state: 'visible', timeout: 10000 }); 
      console.log('Project list/cards appear to be loaded.');
  } catch (e) {
      console.error('Timed out waiting for project list/cards to appear.');
      await page.screenshot({ path: `debug-project-list-load-timeout-${Date.now()}.png` });
      throw new Error('Timed out waiting for the project list to load.');
  }
  // -----------------------------------------------------------------------

  // Give a very brief moment for rendering after visibility
  await page.waitForTimeout(500); 

  // Now look for the specific project card by name (h3 inside the card)
  const projectLink = page.locator(`${projectCardSelector} h3:has-text("${projectName}")`).first(); 

  const count = await projectLink.count();
  if (count === 0) {
    console.log(`Project card with name "${projectName}" not found after list loaded.`);
    await page.screenshot({ path: `debug-project-not-found-${projectName.replace(/\s+/g, '-')}-${Date.now()}.png` });
    // Returning false instead of throwing an error allows the test to potentially handle it
    return false; 
  }
  
  console.log(`Found project card for '${projectName}', scrolling and clicking...`);
  try {
    await projectLink.scrollIntoViewIfNeeded({ timeout: 5000 }); 
    // Use click options that might be more robust
    await projectLink.click({ timeout: 5000, force: true, delay: 100 }); // Force click with slight delay
    console.log(`Clicked project link for '${projectName}'.`);
  } catch(error) {
      console.error(`Error clicking project link for "${projectName}":`, error);
      await page.screenshot({ path: `debug-project-click-error-${projectName.replace(/\s+/g, '-')}-${Date.now()}.png` });
      return false; // Indicate click failed
  }

  // The calling test should handle waiting for navigation/state changes after the click
  return true; // Indicate click was attempted successfully
}
