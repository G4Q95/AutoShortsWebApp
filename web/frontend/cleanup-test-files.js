/**
 * Test Cleanup Script
 * 
 * Run this script after tests to clean up test projects and their associated R2 files
 * Usage: node cleanup-test-files.js
 */

const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:8000';
const TEST_PROJECT_PATTERNS = [
  'Test Project', 
  'Playwright',
  'Test Project 84'
];

async function cleanupTestProjects() {
  try {
    console.log('Starting test cleanup process...');
    
    // Call the backend endpoint that finds and cleans up test projects by name pattern
    const response = await fetch(`${BACKEND_URL}/api/v1/debug/cleanup-test-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name_patterns: TEST_PROJECT_PATTERNS
      })
    });
    
    if (!response.ok) {
      console.error(`Cleanup API call failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('Cleanup results:', result);
    
    if (result.mock_mode) {
      console.log('Note: Database is in mock mode. Real projects were not deleted.');
      console.log(`Would have processed ${result.name_patterns_processed} name patterns.`);
    } else {
      console.log(`Projects deleted from DB: ${result.projects_deleted_db}`);
      console.log(`R2 cleanup scheduled: ${result.r2_cleanup_scheduled}`);
    }
    
    if (result.errors && result.errors.length > 0) {
      console.warn('Cleanup errors:', result.errors);
    }
    
    console.log('Cleanup process completed.');
  } catch (error) {
    console.error('Error during cleanup process:', error);
  }
}

// Run the cleanup
cleanupTestProjects(); 