/**
 * Project-specific test utilities
 * 
 * This file contains helper functions specifically for testing project operations
 * like creating, managing, and navigating between projects.
 */

import { Page, Locator, expect } from '@playwright/test';
import { selectors, clickWithFallbacks, waitForWithFallbacks } from './selectors';
import { 
  takeDebugScreenshot, 
  waitForProjectWorkspace, 
  goToHomePage 
} from './test-utils';

/**
 * Create a new test project
 * 
 * This function creates a new project by:
 * 1. Navigating to the home page
 * 2. Clicking the "Create Video" button
 * 3. Entering the project name
 * 4. Clicking the "Create Project" button
 * 5. Waiting for the project workspace to load
 * 
 * The function takes screenshots before and after project creation for debugging
 * purposes and provides detailed logging.
 * 
 * @param page - Playwright page object
 * @param projectName - Optional project name (generates timestamp-based name if not provided)
 * @returns The name of the created project for reference in other test steps
 * 
 * @example
 * // Create a project with an auto-generated name
 * const projectName = await createProject(page);
 * 
 * // Create a project with a specific name
 * await createProject(page, 'My Custom Project');
 */
export async function createProject(page: Page, projectName?: string) {
  const name = projectName || `Test Project ${Date.now()}`;
  console.log(`Creating new project: ${name}`);
  
  // Navigate to home page
  await goToHomePage(page);
  
  // Take screenshot before project creation
  await takeDebugScreenshot(page, 'before-project-creation');
  
  // Click create video button
  await page.click(selectors.createVideoButton);
  
  // Wait for project name input
  await page.waitForSelector(selectors.projectNameInput);
  
  // Fill project name and create
  await page.fill(selectors.projectNameInput, name);
  await page.click(selectors.createProjectButton);
  
  // Wait for workspace to load
  await waitForProjectWorkspace(page);
  
  // Take screenshot after project creation
  await takeDebugScreenshot(page, 'after-project-creation');
  
  console.log(`Successfully created project: ${name}`);
  return name;
}

/**
 * Open an existing project by name
 * 
 * @param page - Playwright page
 * @param projectName - Name of the project to open
 * @returns Promise resolving when project is opened
 */
export async function openProject(page: Page, projectName: string) {
  console.log(`Opening project: ${projectName}`);
  
  // Navigate to projects list
  await page.click(selectors.myProjectsLink);
  
  // Wait for projects list to load
  await page.waitForSelector(selectors.projectsList);
  
  // Take screenshot of projects list
  await takeDebugScreenshot(page, 'projects-list');
  
  // Find the project by name
  const projectCard = page.locator(`${selectors.projectCard}:has-text("${projectName}")`);
  const projectCount = await projectCard.count();
  
  if (projectCount === 0) {
    throw new Error(`Project with name "${projectName}" not found`);
  }
  
  // Click on the project card
  await projectCard.click();
  
  // Wait for workspace to load
  await waitForProjectWorkspace(page);
  
  console.log(`Successfully opened project: ${projectName}`);
}

/**
 * Delete an existing project by name
 * 
 * @param page - Playwright page
 * @param projectName - Name of the project to delete
 * @returns Promise resolving when project is deleted
 */
export async function deleteProject(page: Page, projectName: string) {
  console.log(`Deleting project: ${projectName}`);
  
  // Navigate to projects list
  await page.click(selectors.myProjectsLink);
  
  // Wait for projects list to load
  await page.waitForSelector(selectors.projectsList);
  
  // Find the project card by name
  const projectCard = page.locator(`${selectors.projectCard}:has-text("${projectName}")`);
  const projectCount = await projectCard.count();
  
  if (projectCount === 0) {
    throw new Error(`Project with name "${projectName}" not found`);
  }
  
  // Find the delete button within the project card
  const deleteButton = projectCard.locator(selectors.projectDeleteButton);
  const deleteButtonCount = await deleteButton.count();
  
  if (deleteButtonCount === 0) {
    throw new Error(`Delete button not found for project "${projectName}"`);
  }
  
  // Take screenshot before deletion
  await takeDebugScreenshot(page, `before-project-deletion-${projectName}`);
  
  // Click the delete button
  await deleteButton.click();
  
  // Wait for confirmation dialog and confirm
  await page.waitForSelector('text=Are you sure');
  await page.click('button:has-text("Delete"), button:has-text("Confirm")');
  
  // Wait for project to be deleted
  try {
    // Wait for success toast or message
    await page.waitForSelector('text=Project deleted', { timeout: 5000 });
    console.log('Saw deletion confirmation message');
  } catch (error) {
    // Even if we don't see a confirmation message, wait a bit for deletion to complete
    console.log('No deletion confirmation message found, waiting briefly');
    await page.waitForTimeout(1000);
  }
  
  // Verify project is gone from the list
  const projectCardAfter = page.locator(`${selectors.projectCard}:has-text("${projectName}")`);
  const projectCountAfter = await projectCardAfter.count();
  
  if (projectCountAfter > 0) {
    // Take screenshot of failed deletion
    await takeDebugScreenshot(page, `project-deletion-failed-${projectName}`);
    throw new Error(`Project "${projectName}" still exists after deletion`);
  }
  
  console.log(`Successfully deleted project: ${projectName}`);
}

/**
 * Create multiple test projects
 * 
 * @param page - Playwright page
 * @param count - Number of projects to create
 * @param baseProjectName - Base name for generated projects
 * @returns Array of created project names
 */
export async function createMultipleProjects(
  page: Page, 
  count = 3, 
  baseProjectName = 'Test Project'
) {
  console.log(`Creating ${count} test projects`);
  
  const projectNames = [];
  
  for (let i = 0; i < count; i++) {
    const name = `${baseProjectName} ${i+1} (${Date.now()})`;
    
    // Create the project
    await createProject(page, name);
    projectNames.push(name);
    
    // If not the last project, go back to home
    if (i < count - 1) {
      await goToHomePage(page);
    }
  }
  
  console.log(`Successfully created ${count} test projects: ${projectNames.join(', ')}`);
  return projectNames;
}

/**
 * Clean up all test projects
 * 
 * This function ensures a clean testing environment by:
 * 1. Navigating to the projects list page
 * 2. Identifying test projects (either by specific names or a keyword)
 * 3. Deleting each test project by clicking its delete button
 * 4. Confirming the deletion in the confirmation dialog
 * 
 * The function is designed to be used in afterEach or afterAll blocks to
 * prevent test projects from accumulating. It provides detailed logging
 * and takes screenshots for debugging purposes.
 * 
 * @param page - Playwright page object
 * @param projectNames - Optional array of specific project names to clean up
 * @param testKeyword - Keyword to identify test projects (default is "Test Project")
 * @returns Promise resolving when cleanup is complete
 * 
 * @example
 * // Clean up all projects containing "Test Project" in their name
 * await cleanupTestProjects(page);
 * 
 * // Clean up specific projects by name
 * await cleanupTestProjects(page, ['Project A', 'Project B']);
 * 
 * // Clean up all projects containing a custom keyword
 * await cleanupTestProjects(page, undefined, 'Demo Project');
 */
export async function cleanupTestProjects(
  page: Page, 
  projectNames?: string[], 
  testKeyword = 'Test Project'
) {
  try {
    console.log(`Starting cleanup process${projectNames ? ' for specific projects' : ' for all test projects'}`);
    
    // Take a screenshot before cleanup starts
    await takeDebugScreenshot(page, 'before-cleanup-start');

    // If specific project names are provided, clean those up
    if (projectNames && projectNames.length > 0) {
      console.log(`Cleaning up specific test projects: ${projectNames.join(', ')}`);
      
      // Navigate to projects list with multiple approaches
      console.log('Navigating to projects list...');
      
      try {
        // First try going to the home page
        await goToHomePage(page);
      } catch (error) {
        console.log('Error navigating to home page, trying direct navigation');
        // If that fails, try to navigate directly to the projects page
        await page.goto('http://localhost:3000/projects');
      }
      
      // Wait for projects button/link and click it
      try {
        await page.waitForTimeout(1000); // Brief pause to ensure page is ready
        console.log('Looking for projects link/button...');
        
        // Try multiple approaches to find and click the projects link
        const found = await Promise.any([
          page.click(selectors.myProjectsLink).then(() => true).catch(() => false),
          page.click('a:has-text("My Projects")').then(() => true).catch(() => false),
          page.click('a:has-text("Projects")').then(() => true).catch(() => false),
          page.click('text=My Projects').then(() => true).catch(() => false),
          page.click('text=Projects').then(() => true).catch(() => false)
        ]).catch(() => false);
        
        if (!found) {
          console.log('Could not find projects link, trying direct navigation');
          await page.goto('http://localhost:3000/projects');
        }
      } catch (error) {
        console.log('Error clicking projects link, trying direct navigation');
        await page.goto('http://localhost:3000/projects');
      }
      
      // Wait for projects list with increased timeout and resilience
      console.log('Waiting for projects list...');
      try {
        // Wait for any of these selectors that might indicate projects list is loaded
        await Promise.any([
          page.waitForSelector(selectors.projectsList, { timeout: 10000 }),
          page.waitForSelector('.project-card', { timeout: 10000 }),
          page.waitForSelector('h3:has-text("Test Project")', { timeout: 10000 }),
          page.waitForTimeout(5000) // Fallback timeout
        ]);
      } catch (error) {
        console.log('Warning: Projects list not found or timeout, will try to proceed anyway');
        // Take a screenshot to debug
        await takeDebugScreenshot(page, 'projects-list-not-found');
      }
      
      // Take a screenshot before cleanup
      await takeDebugScreenshot(page, 'before-specific-project-cleanup');
      
      // Delete each project by name
      for (const projectName of projectNames) {
        try {
          console.log(`Deleting specific project: ${projectName}`);
          const projectCard = page.locator(`${selectors.projectCard}:has-text("${projectName}")`);
          const exists = await projectCard.count() > 0;
          
          if (exists) {
            // Find and click delete button
            const deleteButton = projectCard.locator(selectors.projectDeleteButton);
            await deleteButton.click();
            
            // Confirm deletion
            await page.waitForSelector('text=Are you sure');
            await page.click('button:has-text("Delete"), button:has-text("Confirm")');
            
            // Wait a moment for deletion to complete
            await page.waitForTimeout(1000);
            console.log(`Successfully deleted specific project: ${projectName}`);
          } else {
            console.log(`Project not found: ${projectName}`);
          }
        } catch (error) {
          console.error(`Failed to delete project ${projectName}: ${(error as Error).message}`);
        }
      }
      
      // Take a screenshot after cleanup
      await takeDebugScreenshot(page, 'after-specific-project-cleanup');
      return;
    }
    
    // Otherwise, clean up by keyword
    console.log(`Cleaning up test projects containing keyword: ${testKeyword}`);
    
    // Navigate to projects list
    await goToHomePage(page);
    await page.click(selectors.myProjectsLink);
    
    // Wait for projects list to load
    await page.waitForSelector(selectors.projectsList);
    
    // Find all project cards containing the test keyword
    const testProjects = page.locator(`${selectors.projectCard}:has-text("${testKeyword}")`);
    const projectCount = await testProjects.count();
    
    console.log(`Found ${projectCount} test projects to clean up`);
    
    if (projectCount === 0) {
      console.log('No test projects to clean up');
      return;
    }
    
    // Take a screenshot before cleanup
    await takeDebugScreenshot(page, 'before-project-cleanup');
    
    // Process each test project
    let deletedCount = 0;
    
    for (let i = 0; i < projectCount; i++) {
      // Since deleting changes the DOM, always get the first remaining project
      const firstProject = page.locator(`${selectors.projectCard}:has-text("${testKeyword}")`).first();
      
      try {
        // Get project name for logging
        const projectName = await firstProject.locator('h3, .project-title').textContent();
        console.log(`Deleting test project ${i+1}/${projectCount}: ${projectName}`);
        
        // Find and click delete button
        const deleteButton = firstProject.locator(selectors.projectDeleteButton);
        await deleteButton.click();
        
        // Confirm deletion
        await page.waitForSelector('text=Are you sure');
        await page.click('button:has-text("Delete"), button:has-text("Confirm")');
        
        // Wait a moment for deletion to complete
        await page.waitForTimeout(1000);
        
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete project ${i+1}: ${(error as Error).message}`);
      }
    }
    
    // Take a screenshot after cleanup
    await takeDebugScreenshot(page, 'after-project-cleanup');
    
    console.log(`Successfully cleaned up ${deletedCount}/${projectCount} test projects`);
  } catch (error) {
    console.error(`Error in cleanupTestProjects: ${(error as Error).message}`);
    await takeDebugScreenshot(page, 'cleanup-error');
  }
} 