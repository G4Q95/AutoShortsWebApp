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
- **Architecture Update**: Implemented Celery with a Redis broker for handling background tasks (e.g., media downloads) asynchronously, improving responsiveness and robustness.

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

#### Video Editing: Core Architecture
- **Preview & UI:** Utilize the `video-context` library in the frontend (React) for:
  - Real-time visual preview of scenes and sequence.
  - Interactive trimming controls.
  - Management of the editing timeline UI.
- **Edit Definition:** User interactions (trims, scene order, audio settings) generate a JSON-based Edit Decision List (EDL).
- **Final Rendering:** Use server-side FFmpeg (integrated with the FastAPI backend) to process the EDL:
  - Fetches original media from R2 based on EDL.
  - Performs precise cuts, audio mixing, and scene concatenation.
  - Produces the final downloadable video file.

#### Media Processing: Google Cloud Run
- **Architecture Update**: Media downloading is now handled by `yt-dlp` running within a Celery worker task. FFmpeg operations are containerized in a dedicated `ffmpeg-service` Docker container.
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

### Frontend (85% Complete)
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
- ✅ Project workspace functionality
  - Scene management
  - Content extraction
  - Project saving
  - Scene reordering
- ✅ Voice Generation API Integration (100%)
  - ElevenLabs API integration
  - Voice selection interface
  - Audio preview functionality
  - Base64 audio handling
  - Comprehensive error handling
  - Audio persistence with cloud storage
  - Dynamic timeout management
  - Input validation with detailed error messages
  - Multiple output format support
- ✅ VideoContext Player Implementation (100%)
  - Enhanced media playback with precise frame control
  - Accurate timeline scrubbing with frame-by-frame positioning
  - Advanced trimming functionality with draggable brackets
  - Media download caching for improved performance
  - Synchronized audio-video playback within trim boundaries
  - Responsive design for both compact and expanded views
  - High-precision time display during trimming operations
  - Support for various media types (images, videos, galleries)
  - Elegant user experience with smooth transitions between modes
- ✅ Adaptive Scene-Based Aspect Ratio Support (100%)
  - Integrated intelligent media aspect ratio detection system
  - Implemented consistent letterboxing/pillarboxing across scenes
  - Ensured proper rendering of media with different aspect ratios
  - Fixed stretching and distortion issues with non-standard media
  - Added responsive container styling across all view modes
  - Enhanced canvas sizing and source node configuration
  - Improved visual quality for both landscape and portrait media
  - Maintained aspect ratio consistency between thumbnails and playback
  - Detailed logging system for troubleshooting and validation
- ✅ Component Architecture Refactoring (65%)
  - SceneComponent broken down into modular components
  - Extracted 8 specialized components:
    - SceneHeader: Scene numbering and source display
    - SceneTextContent: Text display with expansion
    - SceneTextEditor: Text editing functionality
    - SceneMediaPlayer: Media playback with view modes
    - SceneVoiceSettings: Voice generation controls
    - SceneTrimControls: Media trimming interface
    - SceneActions: Scene operation buttons
    - SceneTimingControls: Duration management
  - Full details in [docs/Scene-Component-Refactoring.md](docs/Scene-Component-Refactoring.md)
  - Reduced main component size by ~63%
  - Enhanced maintainability and separation of concerns
- ✅ Feature Flag Implementation
  - API module isolation
  - Controlled feature rollout
  - Development/production toggles
  - Safe fallback mechanisms
- 🔄 API Client Refactoring (80%)
  - Modular API implementation
  - Enhanced error handling
  - Incremental delivery approach
  - Comprehensive testing
- 🔄 Video API Module (40%)
  - Core video processing functions
  - Video status tracking
  - Integration with voice generation
  - Error handling for video processing
- 🔄 Voice Generation UI Integration
  - UI mode management system
  - "Start Voiceovers" button
  - Scene-level voice controls
  - Audio playback in scenes
- 🔄 Video processing interface
- ⏳ Authentication system

### Backend (75% Complete)
- ✅ FastAPI server setup
- ✅ Basic API endpoints
- ✅ Content extraction service
- ✅ Standardized error handling
- ✅ CORS configuration
- ✅ MongoDB integration
- ✅ Media proxy functionality
- ✅ Docker containerization
  - Complete development environment
  - **Architecture Update**: Expanded Docker setup including `frontend`, `backend`, `celery-worker`, `redis`, `ffmpeg-service`, and `browser-tools`.
  - Network configuration
  - Environment variable management
- ✅ Server management tools
  - Reliable startup scripts
  - Enhanced error logging
  - Health check endpoints
  - Process monitoring
- ✅ Reddit content handling
  - Improved video proxy
  - Enhanced error handling
  - Better logging
- ✅ Voice Generation Service
  - ElevenLabs API integration
  - Multiple output format support
  - Proper error handling
  - Audio data processing
  - Type-safe interfaces
- 🔄 Voice-Video Integration
  - ⏳ Combining audio with video segments
  - ⏳ Timing synchronization
  - ⏳ Audio placement controls
- 🔄 Video processing pipeline
- ⏳ Cloud storage integration
- ⏳ Authentication system

### Testing (95% Complete)
- ✅ Basic frontend tests
- ✅ API endpoint tests
- ✅ Error handling tests
- ✅ Integration tests
- ✅ End-to-end tests
  - Project creation
  - Scene management
  - Content extraction
  - Media display
  - Drag-and-drop functionality
- 🔄 Video processing tests

### Infrastructure (85% Complete)
- ✅ Local development environment
- ✅ MongoDB Atlas configuration
- ✅ Docker containerization for development
  - Multi-container setup with docker-compose
  - Service isolation and networking
  - Consistent environment across team members
  - Browser tools integration
- 🔄 CI/CD pipeline setup
- 🔄 Production deployment configuration
- ⏳ Monitoring and alerting
- ⏳ Backup and recovery procedures

### Documentation (75% Complete)
- ✅ Project setup instructions
- ✅ API documentation
- ✅ Code organization documentation
- ✅ Error handling documentation
- ✅ Development guides
- ✅ Testing framework documentation
- ✅ Docker setup documentation
- 🔄 Video processing documentation
- ⏳ Deployment guides

Legend:
✅ Complete
🔄 In Progress
⏳ Planned

Currently working on:
- Implementing the video processing pipeline
- Adding video segment processing
- Creating progress tracking system
- Developing error handling for processing
- Enhancing server reliability and monitoring
- Expanding Docker configuration for production

Next steps include:
- Completing the video processing pipeline
- Adding user authentication with Google OAuth
- Enhancing the user experience
- Setting up cloud storage integration
- Implementing CI/CD pipeline with Docker

## Key Features by Release
1. **MVP (Week 10)**:
   - URL-based content submission ✅
   - Project workspace with draggable scenes ✅
   - Voice generation API integration ✅
   - Voice generation UI integration 🔄
   - Basic video generation 🔄
   - Google authentication ⏳
   - Free tier limitations ⏳

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

### Real-Time Voiceover Integration (Pictori-style)
- Live preview of ElevenLabs voiceover as text is edited
- Immediate regeneration when text or voice settings change
- Automatic timing adjustment based on voiceover length
- Seamless text-to-speech workflow
- Progressive UI Enhancement Approach:
  - Voice-enabled mode active by default with direct audio controls on each scene
  - Full range of voice customization options including speed, stability, similarity, and style
  - Percentage-based controls (0-100%) for intuitive parameter adjustments
  - Variable speech speed control (0.7x-1.2x) for perfect pacing
  - Contextual editing allowing text changes and immediate audio generation
  - Save audio functionality to create checkpoints for approved audio
  - Individual scene voice settings with studio-quality controls
  - Character count indicators to prevent exceeding API limits

### Technical Decisions & Rationale

*   **Frontend Framework**: Next.js with React chosen for its robust ecosystem, SSR/SSG capabilities, and component-based architecture suitable for complex UIs.
*   **Backend Framework**: FastAPI (Python) selected for its high performance, async capabilities (crucial for I/O-bound tasks like external API calls and media processing), and automatic OpenAPI documentation.
*   **Styling**: Tailwind CSS for utility-first styling, enabling rapid UI development and consistency.
*   **Database**: MongoDB Atlas (NoSQL) for flexible data schemas, scalability, and cloud hosting convenience.
*   **Media Storage**: Cloudflare R2 for S3-compatible object storage, offering potentially lower egress costs.
*   **Video Preview Engine**: `video-context` library chosen initially for its WebGL-based timeline compositing features. **Update (July 2024):** Adopting a hybrid approach where `video-context` handles core playback/timing, while complex UI elements like captions are rendered using synchronized HTML/CSS overlays managed by React. This leverages the strengths of both technologies.
*   **Video Export Processing**: FFmpeg (executed on the backend) chosen as the industry standard for robust video manipulation, trimming, effect application, and final encoding.
*   **Containerization**: Docker and Docker Compose for consistent development, testing, and deployment environments.
*   **Deployment**: Google Cloud Run (backend) and Vercel (frontend) for scalable, managed hosting solutions. 