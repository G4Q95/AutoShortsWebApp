# AUTO SHORTS WEB APP - PROJECT OVERVIEW

## Core Concept
A web application that allows users to convert social media content (primarily from Reddit) into engaging short-form videos by:
1. Retrieving content from URLs
2. Rewriting text using AI
3. Generating voiceovers
4. Assembling videos with the content and voiceover

## Enhanced Video Project Experience (New)
The application will feature an intuitive video project creation workflow:
1. Users enter a project title to create a new video project
2. Within the project workspace, users can add Reddit URLs (and later other sources)
3. Each URL becomes a "scene" displaying:
   - The extracted media (image/video) from the URL
   - The accompanying text content below the media
4. Scenes can be dragged and reordered to determine the final video sequence
5. Users can edit text content and customize each scene
6. The entire project can be processed into a seamless short-form video

## Business Model
- **Freemium approach** with tiered access:
  - Free tier with limited features and usage caps
  - Premium tier ($15/month) with expanded features and higher limits
  - Pro tier ($30/month) with unlimited access and priority processing

## Key Technical Decisions

### Pay-As-You-Go (PAYG) Architecture
- All infrastructure components use PAYG pricing models
- No fixed monthly costs for idle resources
- Services scale up and down with actual usage
- Cost-efficient for early stages with few users

### API Costs Management
- OpenAI API costs approximately $0.001-0.002 per post with GPT-3.5
- ElevenLabs costs approximately $0.014-0.027 per video (standard voices)
- Implementation of caching strategies to reduce duplicate API calls
- Hard caps per user to prevent cost overruns

### Cost Breakdown for 1,000 Active Free Users
- OpenAI API (GPT-3.5): $10-20/month
- ElevenLabs: $70-140/month
- Google Cloud Run: $10-30/month
- Cloudflare R2: $2.50/month
- MongoDB Atlas: $0/month (free tier)
- Vercel: $0/month (free tier)
- **Total**: $92.50-192.50/month

### Technology Selection Rationale

#### Frontend: Next.js with React
- Best for media-heavy applications
- SEO benefits for attracting users
- Excellent developer experience
- Scales well with Vercel hosting
- React DnD or react-beautiful-dnd for drag-and-drop scene ordering

#### Backend: FastAPI (Python)
- Reuse existing Python code from legacy scripts
- High performance for concurrent requests
- Automatic API documentation
- Well-suited for asynchronous operations

#### Database: MongoDB Atlas
- Free tier to start
- Flexible schema for varied content types
- PAYG scaling beyond free tier
- Good Python integration

#### Storage: Cloudflare R2
- No egress fees (critical for video delivery)
- S3-compatible API
- Pay only for what you store
- Global distribution network

#### Media Processing: Google Cloud Run
- Container-based for FFMPEG integration
- No minimum instances (scales to zero)
- No time limits for video processing
- Better free tier than alternatives

#### Hosting: Vercel
- Optimized for Next.js
- Global CDN included
- Free tier sufficient for early stage
- Seamless integration with GitHub

## Development Timeline
- Total development time: 10 weeks
- Four phases of development:
  1. Foundation Building (Weeks 1-3)
  2. Web Application Development (Weeks 4-6)
  3. Processing Pipeline & Storage Optimization (Weeks 7-8)
  4. Testing & Initial Deployment (Weeks 9-10)

## Current Development Status
- Infrastructure setup complete
- Frontend and backend connected and communicating properly
- URL submission form implemented with validation
- Enhanced error handling system implemented
- Fixed Not-Found page component error
- Improved Reddit content extraction with proper redirect handling and media extraction
- Currently working on: Implementing project workspace with draggable scenes

Next steps include creating the project workspace with scene management and drag-and-drop functionality.

## Key Features by Release
1. **MVP (Week 10)**:
   - URL-based content submission
   - Project workspace with draggable scenes
   - Basic video generation
   - Google authentication
   - Free tier limitations

2. **Version 1.1**:
   - Enhanced video editing options
   - Multiple voice styles
   - Improved UI/UX
   - Better customization options

3. **Version 2.0**:
   - Additional content sources
   - Background music options
   - Video templates
   - Advanced analytics

## Scaling Considerations
- Architecture supports up to ~5,000 free users or ~1,000 premium users before significant restructuring
- MongoDB Atlas can be upgraded to dedicated clusters as demand grows
- Google Cloud Run configurations can be adjusted for higher performance
- Additional API optimizations can be implemented at scale
- Consider transitioning some components to reserved instances once usage patterns are established 

## Project Status Update

## Checkpoint: "project-workspace-grid-layout-complete"

This checkpoint marks the completion of the project workspace with grid layout, drag-and-drop functionality, and proper media display.

## Progress Summary

### What We've Accomplished:

1. **Media Content Preview Component**:
   - ✅ Created `MediaContentItem` and improved `SceneComponent`
   - ✅ Added support for different media types (image, video, gallery)
   - ✅ Implemented proper text display with "Post by" prefix removal
   - ✅ Added error handling for media loading failures
   - ✅ Videos display properly with thumbnails and controls

2. **Project Workspace Container**:
   - ✅ Enhanced the `ProjectWorkspace` component
   - ✅ Implemented responsive grid layout (3 columns on large screens)
   - ✅ Created "Add Content" form integrated with URL extraction
   - ✅ Fixed text overflow issues in metadata sections

3. **Drag-and-Drop Functionality**:
   - ✅ Integrated `@hello-pangea/dnd` for drag-and-drop
   - ✅ Implemented visual feedback during dragging
   - ✅ Created state management for ordering information
   - ✅ Made it work with the grid layout

## Timeline Status

According to `PROJECT_INSTRUCTIONS.md`, we are in Phase 1 of the project, focused on content gathering and organization. We have completed approximately 70% of this phase:

- The content extraction from Reddit is working
- The UI for organizing scenes is in place
- The drag-and-drop functionality for reordering is working

## Next Priorities (In Order of Importance)

1. **Project Persistence (CRITICAL)**:
   - Implement save/load functionality for projects
   - Add auto-saving of project state
   - Create local storage mechanism for draft projects

2. **Project Management Features**:
   - Create a projects dashboard/listing page
   - Implement project deletion functionality
   - Add duplicate project capability

3. **Content Enhancement**:
   - Add bulk import of multiple URLs
   - Improve error handling for failed content extraction
   - Add retry options for failed media downloads

4. **UI/UX Improvements**:
   - Add confirmation dialogs for scene deletion
   - Implement keyboard shortcuts for common actions
   - Add loading states/skeletons while content loads

5. **Scene Preview Enhancements**:
   - Add video trimming controls
   - Implement image cropping/zooming
   - Add simple text formatting options

## Save Project Feature Design Options

Since saving projects is the most critical missing feature, here are specific implementation options:

### Option 1: Local Storage Only
- **Pros**: Simple to implement, works offline, no backend required
- **Cons**: Limited storage, doesn't sync across devices, lost if browser data cleared
- **Implementation**: Use browser's localStorage or IndexedDB to store project data

### Option 2: Backend Storage with MongoDB
- **Pros**: Reliable, scalable, accessible across devices
- **Cons**: Requires backend implementation, network dependency
- **Implementation**: Create API endpoints for CRUD operations on projects

### Option 3: Hybrid Approach
- **Pros**: Works offline with sync capability, best user experience
- **Cons**: More complex to implement
- **Implementation**: Store locally first, sync with backend when online

I recommend Option 3 for the best user experience, but Option 1 could be implemented quickly as a starting point.

## Commit Message for Documentation Updates

docs: update project status and next steps

- Update progress tracking with completed features
- Identify project persistence as critical next priority 
- Outline implementation options for save functionality
- Add timeline status relative to project phases 