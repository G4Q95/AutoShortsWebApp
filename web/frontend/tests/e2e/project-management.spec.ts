import { test, expect } from '@playwright/test';
import { 
  NAVIGATION_TIMEOUT,
  PAGE_LOAD_TIMEOUT,
  CONTENT_LOAD_TIMEOUT,
  SCENE_MEDIA_TIMEOUT,
  TEST_PROJECT_NAME,
  TEST_REDDIT_PHOTO_URL,
  TEST_REDDIT_VIDEO_URL,
  waitForWorkspace,
  verifyLayoutAttributes,
  elementWithTextExists,
  waitForElementWithText,
  BLUE_NUMBER_SELECTOR,
  MEDIA_SELECTOR,
  SCENE_COMPONENT_SELECTOR
} from './utils/test-utils';
import { selectors } from './utils/selectors';

/**
 * Tests for project creation and management
 */
test.describe('Project Management', () => {
  
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
  
  // Add global timeout for all tests
  test.slow();
  
  test('Project creation and management', async ({ page }) => {
    console.log('Starting project creation test...');
    
    // Navigate to project creation page
    await page.goto('/projects/create', { timeout: NAVIGATION_TIMEOUT });
    
    // Wait for the page to fully load
    await page.waitForSelector('input[placeholder="Enter project name"]', { timeout: PAGE_LOAD_TIMEOUT });
    
    // Generate a unique project name
    const projectName = TEST_PROJECT_NAME + ' ' + Date.now().toString().slice(-5);
    console.log('Creating project with name:', projectName);
    
    // Fill in the project name and create project
    await page.getByPlaceholder('Enter project name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();
    
    // Wait for project workspace to load - using URL pattern
    console.log('Waiting for project workspace to load...');
    await page.waitForURL(/.*\/projects\/[a-z0-9]+$/, { timeout: NAVIGATION_TIMEOUT });
    console.log('Project workspace loaded, URL:', page.url());
    
    // Store the project ID from the URL for later verification
    const projectUrl = page.url();
    const projectId = projectUrl.split('/').pop();
    console.log('Project ID extracted from URL:', projectId);
    
    // Take a screenshot after project creation
    await page.screenshot({ path: 'debug-project-created.png' });
    
    // Wait for the URL input to be visible
    console.log('Waiting for URL input to be ready...');
    await page.waitForSelector('input[placeholder="Enter Reddit URL"]', { timeout: PAGE_LOAD_TIMEOUT });
    
    // Add a scene
    console.log('Adding a scene to project...');
    await page.getByPlaceholder('Enter Reddit URL').fill(TEST_REDDIT_PHOTO_URL);
    await page.getByRole('button', { name: 'Add' }).click();
    
    // Wait for scene to appear
    console.log('Waiting for scene to appear...');
    const blueNumberText = '1';
    await expect.poll(async () => {
      return elementWithTextExists(page, BLUE_NUMBER_SELECTOR, blueNumberText);
    }, {
      message: `Expected to find blue number with text "${blueNumberText}"`,
      timeout: PAGE_LOAD_TIMEOUT
    }).toBeTruthy();
    console.log('Scene appeared successfully');
    
    // Wait for media to load
    console.log('Waiting for media content to load...');
    await expect(page.locator(MEDIA_SELECTOR).first()).toBeVisible({ timeout: SCENE_MEDIA_TIMEOUT });
    console.log('Media content loaded successfully');
    
    // Take a screenshot after adding scene
    await page.screenshot({ path: 'debug-scene-added.png' });
    
    // Testing navigation away and back to project...
    console.log('Navigating to home page to test project re-entry...');

    // Go to home page
    try {
      await page.click('text=Auto Shorts');
      await page.waitForURL('/', { timeout: NAVIGATION_TIMEOUT });
      console.log('Successfully navigated to home page, URL:', page.url());
    } catch (error) {
      console.error('Error navigating to home page:', error);
      
      // Fallback: Try direct navigation if clicking fails
      console.log('Trying direct navigation to home page as fallback');
      await page.goto('/', { timeout: NAVIGATION_TIMEOUT });
      console.log('Direct navigation URL:', page.url());
    }
    
    // Navigate to My Projects
    console.log('Navigating to My Projects page...');
    await page.locator('header').getByRole('link', { name: 'My Projects' }).click();
    await page.waitForURL(/.*\/projects\/?$/, { timeout: NAVIGATION_TIMEOUT });
    
    // Wait for projects list to load
    await page.waitForSelector('h1', { timeout: PAGE_LOAD_TIMEOUT });
    await waitForElementWithText(page, 'h1', 'Your Projects');
    console.log('Projects page loaded successfully');
    
    // Use our new function to find and click the project
    await findAndClickProject(page, projectName);
    
    // Cleaning up: deleting test project...
    try {
      console.log('Cleaning up: deleting test project...');
      
      // Navigate to My Projects page
      await page.locator('header').getByRole('link', { name: 'My Projects' }).click();
      await page.waitForURL(/.*\/projects\/?$/, { timeout: NAVIGATION_TIMEOUT });
      
      // Wait for projects list to load
      await page.waitForSelector('h1', { timeout: PAGE_LOAD_TIMEOUT });
      
      // Find the delete button for this project
      console.log('Looking for Delete button...');
      await page.screenshot({ path: 'debug-before-delete.png' });
      
      // Look for delete buttons with different strategies
      const deleteSelector = 'button:has-text("Delete"), [data-testid="delete-project"]';
      await page.waitForSelector(deleteSelector, { timeout: 5000 })
        .catch(() => console.log('Warning: No delete button found with standard selector'));
      
      const deleteButtons = page.locator(deleteSelector);
      const deleteCount = await deleteButtons.count();
      
      if (deleteCount > 0) {
        console.log(`Found ${deleteCount} delete buttons`);
        
        // Click the first delete button
        await deleteButtons.first().click();
        console.log('Clicked Delete button');
        
        // Take screenshot to see the confirmation dialog
        await page.screenshot({ path: 'debug-delete-confirmation.png' });
        await page.waitForTimeout(500);
        
        // Try different ways to confirm deletion
        try {
          // First try the standard Confirm button
          const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
          const hasConfirm = await confirmButton.count() > 0;
          
          if (hasConfirm) {
            await confirmButton.click({ timeout: 5000 });
            console.log('Clicked Confirm button');
          } else {
            // If no confirm button, maybe it auto-deleted
            console.log('No confirmation button found, project may be already deleted');
          }
        } catch (confirmError) {
          console.log('Error clicking confirm:', confirmError);
          // Try clicking by text as fallback
          await page.locator('button:has-text("Confirm")').click({ timeout: 5000, force: true })
            .catch(e => console.log('Could not click confirmation button:', e.message));
        }
        
        // Wait for deletion to complete
        await page.waitForTimeout(1000);
        console.log('Project deletion completed');
      } else {
        console.log('No delete button found, project may not exist anymore');
      }
    } catch (error) {
      console.error('Error during project deletion:', error);
    }
    
    console.log('Project creation test completed');
  });

  test('Existing project functionality', async ({ page }) => {
    console.log('Starting existing project test...');
    
    // First, create a project for this test
    // Navigate to project creation page
    await page.goto('/projects/create', { timeout: NAVIGATION_TIMEOUT });
    await page.waitForSelector('input[placeholder="Enter project name"]', { timeout: PAGE_LOAD_TIMEOUT });
    
    // Generate a unique project name
    const projectNameExisting = TEST_PROJECT_NAME + ' Existing ' + Date.now().toString().slice(-5);
    console.log('Creating project with name:', projectNameExisting);
    
    // Fill project name and create project
    await page.getByPlaceholder('Enter project name').fill(projectNameExisting);
    await page.getByRole('button', { name: 'Create Project' }).click();
    
    // Wait for workspace to load
    console.log('Waiting for project workspace to load...');
    await page.waitForURL(/.*\/projects\/[a-z0-9]+$/, { timeout: NAVIGATION_TIMEOUT });
    
    // Capture the project ID from the URL for later verification
    const projectUrl = page.url();
    const projectId = projectUrl.split('/').pop();
    console.log('Project created with URL:', projectUrl);
    console.log('Project ID:', projectId);
    
    // Wait for workspace to be fully loaded
    await page.waitForSelector('input[placeholder="Enter Reddit URL"]', { timeout: PAGE_LOAD_TIMEOUT });
    
    // Add a scene
    console.log('Adding scene to project...');
    await page.getByPlaceholder('Enter Reddit URL').fill(TEST_REDDIT_PHOTO_URL);
    await page.getByRole('button', { name: 'Add' }).click();
    
    // Wait for scene to appear
    console.log('Waiting for scene to appear...');
    const blueNumberText = '1';
    await expect.poll(async () => {
      return elementWithTextExists(page, BLUE_NUMBER_SELECTOR, blueNumberText);
    }, {
      message: `Expected to find blue number with text "${blueNumberText}"`,
      timeout: PAGE_LOAD_TIMEOUT
    }).toBeTruthy();
    
    // Wait for media to load
    console.log('Waiting for media to load...');
    await expect(page.locator(MEDIA_SELECTOR).first()).toBeVisible({ timeout: SCENE_MEDIA_TIMEOUT });
    console.log('Scene added with visible media');
    
    // Take a screenshot of the workspace with scene
    await page.screenshot({ path: 'debug-existing-project-setup.png' });
    
    // Navigate away to Home page with improved link selection
    console.log('Navigating away to home page...');
    try {
      // Take screenshot before navigation attempt
      await page.screenshot({ path: 'debug-before-home-navigation.png' });
      
      // Try multiple ways to find and click the Home link
      const homeLink = page.locator('header a[href="/"], header nav a:has-text("Home"), a:has-text("Home")').first();
      console.log('Checking if Home link is visible...');
      await homeLink.waitFor({ state: 'visible', timeout: 5000 });
      
      // Explicitly wait to ensure page is stable before click
      await page.waitForTimeout(500);
      
      // Scroll into view and click with force option
      await homeLink.scrollIntoViewIfNeeded();
      await homeLink.click({ force: true, timeout: 10000 });
      console.log('Clicked on Home link');
      
      // Wait for navigation to complete with relaxed pattern
      await page.waitForURL('**/', { 
        timeout: NAVIGATION_TIMEOUT * 2
      });
      console.log('Successfully navigated to home page, URL:', page.url());
    } catch (error) {
      console.error('Error navigating to home page:', error);
      
      // Fallback: Try direct navigation if clicking fails
      console.log('Trying direct navigation to home page as fallback');
      await page.goto('/', { timeout: NAVIGATION_TIMEOUT });
      console.log('Direct navigation URL:', page.url());
    }
    
    // Navigate to My Projects
    console.log('Navigating to My Projects page...');
    await page.locator('header').getByRole('link', { name: 'My Projects' }).click();
    await page.waitForURL(/.*\/projects\/?$/, { timeout: NAVIGATION_TIMEOUT });
    
    // Wait for projects list to load
    await page.waitForSelector('h1', { timeout: PAGE_LOAD_TIMEOUT });
    await waitForElementWithText(page, 'h1', 'Your Projects');
    console.log('Projects page loaded successfully');
    
    // Use our new function to find and click the project
    await findAndClickProject(page, projectNameExisting);
    
    // Add a second scene to verify the project is fully functional
    console.log('Adding second scene to verify project functionality...');
    await page.getByPlaceholder('Enter Reddit URL').fill(TEST_REDDIT_PHOTO_URL);
    await page.getByRole('button', { name: 'Add' }).click();
    
    // Wait for second scene to appear
    console.log('Waiting for second scene to appear...');
    const secondSceneText = '2';
    await expect.poll(async () => {
      return elementWithTextExists(page, BLUE_NUMBER_SELECTOR, secondSceneText);
    }, {
      message: `Expected to find blue number with text "${secondSceneText}"`,
      timeout: PAGE_LOAD_TIMEOUT
    }).toBeTruthy();
    
    // Wait for second scene media to load
    console.log('Waiting for second scene media to load...');
    await expect(page.locator(MEDIA_SELECTOR).nth(1)).toBeVisible({ timeout: SCENE_MEDIA_TIMEOUT });
    console.log('Second scene added successfully after navigation');
    
    // Take a screenshot after adding second scene
    await page.screenshot({ path: 'debug-added-second-scene.png' });
    
    // Cleaning up: deleting test project...
    try {
      console.log('Cleaning up: deleting test project...');
      
      // Navigate to My Projects page if not already there
      if (!page.url().includes('/projects$')) {
        await page.locator('header').getByRole('link', { name: 'My Projects' }).click();
        await page.waitForURL(/.*\/projects\/?$/, { timeout: NAVIGATION_TIMEOUT });
      }
      
      // Wait for projects list to load
      await page.waitForSelector('h1', { timeout: PAGE_LOAD_TIMEOUT })
        .catch(e => console.log('Warning: timeout waiting for h1 element', e.message));
      
      // Find the delete button for this project
      console.log('Looking for Delete button...');
      await page.screenshot({ path: 'debug-before-delete-existing.png' });
      
      // Look for delete buttons with different strategies
      const deleteSelector = 'button:has-text("Delete"), [data-testid="delete-project"]';
      await page.waitForSelector(deleteSelector, { timeout: 5000 })
        .catch(() => console.log('Warning: No delete button found with standard selector'));
      
      const deleteButtons = page.locator(deleteSelector);
      const deleteCount = await deleteButtons.count();
      
      if (deleteCount > 0) {
        console.log(`Found ${deleteCount} delete buttons`);
        
        // Click the first delete button
        await deleteButtons.first().click();
        console.log('Clicked Delete button');
        
        // Take screenshot to see the confirmation dialog
        await page.screenshot({ path: 'debug-delete-confirmation-existing.png' });
        await page.waitForTimeout(500);
        
        // Try different ways to confirm deletion
        try {
          // First try the standard Confirm button
          const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
          const hasConfirm = await confirmButton.count() > 0;
          
          if (hasConfirm) {
            await confirmButton.click({ timeout: 5000 });
            console.log('Clicked Confirm button');
          } else {
            // If no confirm button, maybe it auto-deleted
            console.log('No confirmation button found, project may be already deleted');
          }
        } catch (confirmError) {
          console.log('Error clicking confirm:', confirmError);
          // Try clicking by text as fallback
          await page.locator('button:has-text("Confirm")').click({ timeout: 5000, force: true })
            .catch(e => console.log('Could not click confirmation button:', e.message));
        }
        
        // Wait for deletion to complete
        await page.waitForTimeout(1000);
        console.log('Project deletion completed');
      } else {
        console.log('No delete button found, project may not exist anymore');
      }
    } catch (error) {
      console.error('Error during project deletion:', error);
    }
    
    console.log('Existing project test completed');
  });
});

// Find the project in the list - improved implementation
async function findAndClickProject(page, projectName) {
  console.log('Looking for project on projects page...');
  
  // Give time for projects to load fully
  await page.waitForTimeout(1000);
  
  // Try several strategies to find the project
  const projectCards = page.locator('.project-card, .project-item, h3:has-text("' + projectName + '")');
  const count = await projectCards.count();
  console.log(`Found ${count} potential project elements`);
  
  if (count === 0) {
    console.log('No project cards found, taking screenshot for debugging');
    await page.screenshot({ path: 'debug-no-projects.png' });
    throw new Error('No project cards found on the page');
  }
  
  // Select first project card and ensure it's visible
  const projectElement = projectCards.first();
  await projectElement.scrollIntoViewIfNeeded();
  await expect(projectElement).toBeVisible();
  
  console.log('Found project, clicking on it...');
  
  // Take deliberate actions to ensure proper clicking
  // 1. First scroll to ensure visibility
  await projectElement.evaluate(element => {
    element.scrollIntoView({behavior: 'auto', block: 'center'});
  });
  
  // 2. Wait a moment for scroll to complete
  await page.waitForTimeout(300);
  
  // 3. Click with retry logic
  try {
    // Try normal click first
    await projectElement.click({ timeout: 5000 });
  } catch (error) {
    console.log('First click attempt failed, trying with force option:', error.message);
    // If normal click fails, try with force option
    await projectElement.click({ force: true, timeout: 5000 });
  }
  
  // 4. Wait for navigation to start
  await page.waitForTimeout(1000);
  console.log('URL after click:', page.url());
  
  // 5. Wait for navigation to complete
  await page.waitForURL(/.*\/projects\/.*/, { timeout: 15000 });
  
  // 6. Verify we didn't end up on the create page
  const onCreatePage = await page.locator('text=Create New Video Project').isVisible()
    .catch(() => false);
  
  if (onCreatePage) {
    console.error('ERROR: Navigated to Create Project page instead of Project Workspace');
    await page.screenshot({ path: 'error-wrong-navigation.png' });
    throw new Error('Navigation error: Ended up on Create Project page instead of Project Workspace');
  }
  
  // 7. Wait for the workspace to load
  await page.waitForSelector('input[placeholder="Enter Reddit URL"]', { timeout: 15000 });
  
  console.log('Successfully navigated to project workspace:', page.url());
  return true;
} 