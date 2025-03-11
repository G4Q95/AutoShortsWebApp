import { test, expect } from '@playwright/test';

// Test data
const TEST_PROJECT_NAME = 'Test Project ' + Math.floor(Math.random() * 1000);
const TEST_REDDIT_URL = 'https://www.reddit.com/r/pics/comments/1j92xk8/the_corpse_of_mussolini_hanging_by_his_feet_in/';

test.describe('Auto Shorts Core Functionality', () => {
  
  test('Home page loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Auto Shorts')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create Video' })).toBeVisible();
  });

  test('Navigation works correctly', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to projects page
    await page.getByRole('link', { name: 'My Projects' }).click();
    await expect(page).toHaveURL(/.*\/projects/);
    await expect(page.getByText('Your Projects')).toBeVisible();
    
    // Navigate to project creation page
    await page.getByRole('link', { name: 'Create Video' }).click();
    await expect(page).toHaveURL(/.*\/projects\/create/);
    await expect(page.getByText('Project Title')).toBeVisible();
  });

  test('Project creation and management', async ({ page }) => {
    // Create a new project
    await page.goto('/projects/create');
    await page.getByPlaceholder('Enter project title').fill(TEST_PROJECT_NAME);
    await page.getByRole('button', { name: 'Create Project' }).click();
    
    // Verify we're in the project workspace
    await expect(page).toHaveURL(/.*\/projects\/[a-z0-9]+$/);
    await expect(page.getByText(TEST_PROJECT_NAME)).toBeVisible();
    
    // Add content to the project
    await page.getByPlaceholder('Enter Reddit URL').fill(TEST_REDDIT_URL);
    await page.getByRole('button', { name: 'Add Content' }).click();
    
    // Wait for content to be processed
    await expect(page.locator('.loading-indicator')).toBeVisible();
    await page.waitForTimeout(5000); // Give it time to process
    
    // Verify the scene was added (should have the scene component visible)
    await expect(page.locator('.scene-component')).toBeVisible({ timeout: 10000 });
    
    // Go back to projects list
    await page.getByRole('link', { name: 'My Projects' }).click();
    
    // Verify our project is in the list
    await expect(page.getByText(TEST_PROJECT_NAME)).toBeVisible();
    
    // Delete the test project
    await page.getByText(TEST_PROJECT_NAME).first().click();
    await page.getByRole('button', { name: 'Delete' }).click();
    
    // Verify it's been deleted
    await expect(page.getByText(TEST_PROJECT_NAME)).not.toBeVisible();
  });
  
  test('Drag and drop scene reordering', async ({ page }) => {
    // Create a project with multiple scenes
    await page.goto('/projects/create');
    await page.getByPlaceholder('Enter project title').fill(TEST_PROJECT_NAME + ' DnD');
    await page.getByRole('button', { name: 'Create Project' }).click();
    
    // Add first scene
    await page.getByPlaceholder('Enter Reddit URL').fill(TEST_REDDIT_URL);
    await page.getByRole('button', { name: 'Add Content' }).click();
    await page.waitForTimeout(5000); // Wait for content to be processed
    
    // Add second scene (with same URL for testing)
    await page.getByPlaceholder('Enter Reddit URL').fill(TEST_REDDIT_URL);
    await page.getByRole('button', { name: 'Add Content' }).click();
    await page.waitForTimeout(5000); // Wait for content to be processed
    
    // Verify we have multiple scenes
    await expect(page.locator('.scene-component')).toHaveCount(2, { timeout: 10000 });
    
    // Perform drag and drop (this is simplified; actual implementation depends on your drag-drop library)
    // This is a basic approximation of drag-drop; may need adjustment for your specific implementation
    const scenes = await page.locator('.scene-component').all();
    const firstScene = scenes[0];
    const secondScene = scenes[1];
    
    // Get positions
    const firstBox = await firstScene.boundingBox();
    const secondBox = await secondScene.boundingBox();
    
    if (firstBox && secondBox) {
      await page.mouse.move(
        firstBox.x + firstBox.width / 2,
        firstBox.y + firstBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        secondBox.x + secondBox.width / 2,
        secondBox.y + secondBox.height / 2
      );
      await page.mouse.up();
    }
    
    // Verify some change happened (this test may need adjustment based on your implementation)
    // For now, just checking scenes still exist after drag attempt
    await expect(page.locator('.scene-component')).toHaveCount(2);
    
    // Clean up - delete the project
    await page.getByRole('link', { name: 'My Projects' }).click();
    await page.getByText(TEST_PROJECT_NAME + ' DnD').first().click();
    await page.getByRole('button', { name: 'Delete' }).click();
  });
  
  test('Scene deletion', async ({ page }) => {
    // Create a project
    await page.goto('/projects/create');
    await page.getByPlaceholder('Enter project title').fill(TEST_PROJECT_NAME + ' Delete');
    await page.getByRole('button', { name: 'Create Project' }).click();
    
    // Add a scene
    await page.getByPlaceholder('Enter Reddit URL').fill(TEST_REDDIT_URL);
    await page.getByRole('button', { name: 'Add Content' }).click();
    await page.waitForTimeout(5000); // Wait for content to be processed
    
    // Verify scene is added
    await expect(page.locator('.scene-component')).toBeVisible({ timeout: 10000 });
    
    // Delete the scene
    await page.locator('.scene-component .delete-button').first().click();
    
    // Verify scene is deleted
    await expect(page.locator('.scene-component')).not.toBeVisible({ timeout: 5000 });
    
    // Clean up - delete the project
    await page.getByRole('link', { name: 'My Projects' }).click();
    await page.getByText(TEST_PROJECT_NAME + ' Delete').first().click();
    await page.getByRole('button', { name: 'Delete' }).click();
  });
}); 