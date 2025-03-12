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

### A Possible Cost Breakdown for 1,000 Active Free Users
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

The project is in active development with several key components in place:

### Frontend (65% Complete)
- ✅ Next.js application structure
- ✅ Project management interface
- ✅ Scene addition and management
- ✅ Local storage implementation
- ✅ Code organization and utility functions
  - Media utilities
  - Form validation
  - Type definitions
  - API response handling
- ✅ API integration and error handling
  - Standardized error responses
  - Consistent error codes
  - Robust error utilities
  - Comprehensive error mapping
- 🔄 UI/UX improvements
- ⏳ Video processing interface

### Backend (45% Complete)
- ✅ FastAPI server setup
- ✅ Basic API endpoints
- ✅ Standardized error handling
- 🔄 Video processing pipeline
- ⏳ Cloud storage integration
- ⏳ Authentication system

### Testing (35% Complete)
- ✅ Basic frontend tests
- ✅ API endpoint tests
- ✅ Error handling tests
- 🔄 Integration tests
- ⏳ End-to-end tests

### Documentation (50% Complete)
- ✅ Project setup instructions
- ✅ API documentation
- ✅ Code organization documentation
- ✅ Error handling documentation
- 🔄 Development guides
- ⏳ Deployment guides

Legend:
✅ Complete
🔄 In Progress
⏳ Planned

Currently working on:
- Standardizing API success response formats
- Completing API documentation updates
- Implementing the video processing pipeline
- Adding remaining error boundary components

Next steps include:
- Implementing the video processing pipeline
- Building scene-to-video segment conversion
- Developing content editing capabilities
- Creating video assembly with transitions
- Adding user authentication with Google OAuth

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