# Auto Shorts Web App - Manual Testing Checklist

This document provides a structured approach to manually testing the Auto Shorts Web App. Run through these checks before and after making significant changes to ensure everything is working correctly.

## Navigation and UI

- [ ] Home page loads correctly
  - [ ] All UI elements are visible and properly styled
  - [ ] "Create Video" button is functional
  - [ ] Auto Shorts logo links to home page

- [ ] Header navigation works correctly
  - [ ] "My Projects" button navigates to projects list
  - [ ] "Create Video" button navigates to project creation

- [ ] Responsive design checks
  - [ ] Mobile layout displays properly (viewport width < 768px)
  - [ ] Tablet layout displays properly (viewport width 768px-1024px)
  - [ ] Desktop layout displays properly (viewport width > 1024px)

## Project Management

- [ ] Project creation works
  - [ ] Can enter a project title
  - [ ] "Create Project" button creates a new project
  - [ ] After creation, redirected to project workspace

- [ ] Projects list displays correctly
  - [ ] All projects are shown with their titles
  - [ ] Creation dates are displayed correctly
  - [ ] "Last updated" timestamps are accurate

- [ ] Project deletion works
  - [ ] Clicking "Delete" removes the project
  - [ ] Project no longer appears in the list after deletion

## Project Workspace

- [ ] URL input works correctly
  - [ ] Can enter a Reddit URL
  - [ ] "Add Content" button submits the URL
  - [ ] Loading indicator appears during processing

- [ ] Scene management works
  - [ ] Added scenes appear in the workspace
  - [ ] Each scene displays the correct media (image/video)
  - [ ] Each scene displays the correct text content
  - [ ] Scene removal works properly

- [ ] Drag and drop reordering works
  - [ ] Can drag a scene to reorder it
  - [ ] Visual feedback is provided during drag
  - [ ] After dropping, the new order is maintained
  - [ ] Order is preserved when navigating away and back

## Content Extraction

- [ ] Reddit content extraction works for various post types
  - [ ] Text posts with proper formatting
  - [ ] Single image posts
  - [ ] Gallery posts with multiple images
  - [ ] Video posts
  - [ ] Posts with both text and media

- [ ] Error handling works properly
  - [ ] Invalid URLs show appropriate error messages
  - [ ] Network failures are handled gracefully
  - [ ] Proper feedback is shown when extraction fails

## Audio Generation

- [ ] Voice generation works correctly
  - [ ] Voice dropdown allows selection of different voices
  - [ ] "Generate Voiceover" button initiates generation
  - [ ] Loading indicator appears during processing
  - [ ] Audio controls appear after generation completes
  - [ ] Generated audio plays correctly
  - [ ] Audio can be paused and resumed

- [ ] Mock audio testing works (for development)
  - [ ] Setting NEXT_PUBLIC_MOCK_AUDIO=true enables mock mode
  - [ ] Mock audio generation completes without ElevenLabs API calls
  - [ ] Mock audio playback works correctly
  - [ ] Console logs indicate mock mode is active

## Performance

- [ ] Application loads quickly
  - [ ] Initial page load < 3 seconds
  - [ ] Navigation between pages < 1 second

- [ ] Project with many scenes (10+) loads and operates smoothly
  - [ ] No visible lag when scrolling
  - [ ] Drag and drop remains responsive
  - [ ] Scene removal is immediate

## Local Storage

- [ ] Projects persist between browser sessions
  - [ ] After closing and reopening the browser, projects still appear
  - [ ] Project content is preserved accurately

- [ ] Multiple browser tabs work correctly
  - [ ] Changes in one tab reflect in another after refresh

## Edge Cases

- [ ] Very long project titles display properly
- [ ] Projects with many scenes (20+) work correctly
- [ ] Extremely large media files are handled appropriately
- [ ] Very long text content displays with proper formatting

## After Each Test Session

- [ ] Clean up test projects
- [ ] Record any issues found
- [ ] Note performance concerns 