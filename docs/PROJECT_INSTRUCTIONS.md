# AUTO SHORTS WEB APP - PROJECT INSTRUCTIONS

## Technology Stack
- **Frontend**: Next.js with React + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB Atlas
- **Storage**: Cloudflare R2
- **Media Processing**: Google Cloud Run
- **Hosting**: Vercel

## Project Structure
```
Auto Shorts Web App/           # Main repository
├── legacy/                    # Original scripts moved here
│   ├── scripts/
│   ├── configs/
│   ├── commands/
│   ├── data/
│   └── utils/
│
├── web/                       # New web application
│   ├── frontend/              # Next.js application
│   │   ├── public/            # Static assets
│   │   ├── src/               # React components, pages, etc.
│   │   └── package.json       # Frontend dependencies
│   │
│   ├── backend/               # FastAPI application
│   │   ├── app/               # API code
│   │   │   ├── core/          # Core functionality
│   │   │   ├── api/           # API routes
│   │   │   ├── services/      # Business logic
│   │   │   └── models/        # Data models
│   │   │
│   │   ├── requirements.txt   # Backend dependencies
│   │   └── Dockerfile         # For containerization
│   │
│   └── README.md              # Documentation for web app
│
├── docker-compose.yml         # Docker Compose configuration
├── .env                       # Environment variables for Docker
├── .env.example               # Example environment file
├── README.md                  # Main project documentation
└── .gitignore                 # Git ignore file
```

## Docker Setup

### Docker Development Environment

The project now uses Docker to create a consistent development environment. This approach offers several benefits:

1. **Consistency**: All developers work with the same environment configuration
2. **Simplicity**: No need to manually start/stop individual servers
3. **Isolation**: Services run in isolated containers but can communicate
4. **Portability**: The setup works the same across different operating systems

#### Docker Components

1. **Frontend Container**: Runs the Next.js application
2. **Backend Container**: Runs the FastAPI server
3. **Browser-Tools Container**: Runs the browser-tools-server for E2E testing

#### Getting Started with Docker

1. **Prerequisites**:
   - Docker Desktop installed
   - Docker Compose installed (comes with Docker Desktop)

2. **Setup**:
   - Copy `.env.example` to `.env` and update with your environment variables
   - Run `docker-compose up --build` to start all services
   - Access the application at http://localhost:3000

3. **Common Commands**:
   - Start services: `docker-compose up`
   - Start services in background: `docker-compose up -d`
   - Stop services: `docker-compose down`
   - Rebuild containers: `docker-compose up --build`
   - View logs: `docker-compose logs -f`
   - View logs for a specific service: `docker-compose logs -f [service-name]`

4. **Running Tests**:
   - With Docker running, execute: `cd web/frontend && npm test`
   - All tests should pass if the environment is correctly configured

5. **Troubleshooting**:
   - If services fail to start, check Docker Desktop status
   - Ensure no conflicts on ports 3000, 8000, and 3025
   - Verify environment variables in .env file
   - Check container logs for error messages

#### Docker Configuration Files

1. **docker-compose.yml**: Defines all services and their relationships
2. **web/frontend/Dockerfile**: Defines how to build the frontend container
3. **web/backend/Dockerfile**: Defines how to build the backend container

## Detailed Development Steps

### 1. Set Up Development Environment

#### 1.1 Create Project Directory Structure
```bash
# Create directories for legacy code
mkdir -p legacy/scripts legacy/configs legacy/commands legacy/data legacy/utils

# Create directories for new web application
mkdir -p web/frontend/public web/frontend/src
mkdir -p web/backend/app/core web/backend/app/api web/backend/app/services web/backend/app/models
```

#### 1.2 Move Existing Scripts to Legacy Directory
```bash
# Move scripts to the legacy directory (adjust paths as needed)
mv scripts/* legacy/scripts/
mv configs/* legacy/configs/
mv commands/* legacy/commands/
mv data/* legacy/data/
mv utils/* legacy/utils/
```

#### 1.3 Set Up Git for Version Control
```bash
# Initialize Git repository (if not already done)
git init

# Create .gitignore file
touch .gitignore
```

Add the following to .gitignore:
```
# Environment variables
.env
.env.local
.env.development
.env.production

# Python
__pycache__/
*.py[cod]
*$py.class
venv/
env/

# Node.js
node_modules/
.next/
out/

# IDE/Editor folders
.vscode/
.idea/

# macOS
.DS_Store

# Temporary files
*.tmp
temp/

# API keys and secrets
*.pem
*.key
```

### 2. Set Up Frontend (Next.js)

#### 2.1 Install Node.js and npm
- Download and install Node.js from https://nodejs.org/ (which includes npm)
- Verify installation:
```bash
node --version
npm --version
```

#### 2.2 Create Next.js Application
```bash
# Navigate to the frontend directory
cd web/frontend

# Initialize a new Next.js app
npx create-next-app@latest .
```
During setup, select:
- TypeScript: No (unless you're familiar with it)
- ESLint: Yes
- Tailwind CSS: Yes
- 'src/' directory: Yes
- App Router: Yes
- Customize default import alias: No

#### 2.3 Install Additional Dependencies
```bash
# Install required packages
npm install axios react-query clsx
```

#### 2.4 Set Up Basic Project Structure
Create the following folders within `web/frontend/src`:
- `components` - For reusable UI components
- `hooks` - For custom React hooks
- `lib` - For utility functions
- `styles` - For any custom CSS

### 3. Set Up Backend (FastAPI)

#### 3.1 Set Up Python Virtual Environment
```bash
# Navigate to the backend directory
cd web/backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate
```

#### 3.2 Install FastAPI and Dependencies
```bash
# Install required packages
pip install fastapi uvicorn python-dotenv httpx pymongo python-multipart pydantic motor
```

#### 3.3 Create requirements.txt
```bash
# Generate requirements file
pip freeze > requirements.txt
```

#### 3.4 Create Basic FastAPI Application
Create a file `web/backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Auto Shorts Web App API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to Auto Shorts Web App API"}
```

#### 3.5 Create Basic API Structure
Set up basic files for backend structure:
- `app/core/config.py` - For configuration settings
- `app/core/security.py` - For authentication-related code
- `app/api/endpoints` - For API routes by feature

### 4. Set Up Cloud Services

#### 4.1 MongoDB Atlas Setup
1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new project
3. Build a new cluster (free tier is sufficient for development)
4. Create a database user
5. Get your connection string
6. Save the connection string as an environment variable

#### 4.2 Cloudflare R2 Setup
1. Create a Cloudflare account if you don't have one
2. Navigate to R2 in the dashboard
3. Create a new bucket
4. Generate API keys for accessing the bucket
5. Save the API keys as environment variables

#### 4.3 Google Cloud Run Setup
1. Create a Google Cloud account
2. Enable Cloud Run API
3. Install Google Cloud CLI
4. Set up authentication
5. Create a project

### 5. Port Legacy Code to Web App

#### 5.1 Content Retrieval Module
1. Study `legacy/scripts/download.py`
2. Create new service in `web/backend/app/services/content_retrieval.py`
3. Adapt code to work as an API endpoint
4. Create frontend interface for URL submission

#### 5.2 Text Rewriting Module
1. Study `legacy/scripts/rewrite.py`
2. Create new service in `web/backend/app/services/text_rewriting.py`
3. Adapt OpenAI integration for web use
4. Create frontend interface for viewing and editing rewritten text

#### 5.3 Voice Generation Module
1. Study `legacy/scripts/google_to_elevenlabs.py`
2. Create new service in `web/backend/app/services/voice_generation.py`
3. Adapt for web-based flow
4. Create frontend interface for voice selection and preview

#### 5.4 Video Assembly Module
1. Study `legacy/scripts/merge.sh`
2. Create new service in `web/backend/app/services/video_assembly.py`
3. Adapt for containerized execution
4. Create frontend interface for video preview and download

### 6. Implement User Authentication

#### 6.1 Set Up Authentication Backend
1. Create user models in MongoDB
2. Implement Google OAuth integration
3. Set up JWT token generation and validation
4. Create login/logout endpoints

#### 6.2 Create Frontend Authentication UI
1. Create login page component
2. Implement authentication state management
3. Create protected routes
4. Add user profile component

### 7. Create Content Submission Flow

#### 7.1 URL Submission Interface
1. Create form for URL input
2. Implement validation and submission
3. Display loading states
4. Handle and display errors

#### 7.2 Content Preview and Selection
1. Create content preview components
2. Implement selection interface
3. Add edit capabilities for text
4. Create navigation between steps

### 8. Implement Text Rewriting

#### 8.1 OpenAI Integration
1. Create secure API key management
2. Implement prompt construction
3. Handle API rate limiting
4. Implement caching for common requests

#### 8.2 Text Editing Interface
1. Create text editor component
2. Add before/after view
3. Implement character counting
4. Create style/tone selection interface

### 9. Implement Voice Generation

#### 9.1 ElevenLabs Integration
1. Create secure API key management
2. Implement voice selection interface
3. Create audio preview component
4. Implement character limits and tracking
5. Add speed parameter (0.7x-1.2x) for controlling speech pace
6. Implement percentage-based controls for intuitive parameter adjustments

#### 9.2 Voice Customization
1. Add voice selection interface
2. Create controls for voice parameters:
   - Stability (0-100%)
   - Similarity (0-100%)
   - Style (0-100%)
   - Speed (0.7x-1.2x)
3. Implement audio playback
4. Add favorite voices functionality
5. Set voice-enabled mode as default for improved workflow
6. Implement direct access to voice controls on scene components

### 10. Create Video Assembly Pipeline

#### 10.1 Media Processing Setup
1. Create container configuration for FFMPEG
2. Set up Cloud Run job definitions
3. Implement progress tracking
4. Create error handling and retries

#### 10.2 Video Preview and Export
1. Create video player component
2. Implement download functionality
3. Add platform-specific export options
4. Create video management interface

### 11. Deploy Application

#### 11.1 Frontend Deployment (Vercel)
1. Create Vercel account
2. Connect GitHub repository
3. Configure build settings
4. Set up environment variables

#### 11.2 Backend Deployment (Google Cloud Run)
1. Create Dockerfile for backend
2. Configure Cloud Run service
3. Set up environment variables
4. Configure scaling and memory settings

#### 11.3 Set Up Monitoring and Logging
1. Implement error tracking
2. Set up usage analytics
3. Create cost monitoring
4. Implement performance tracking

## Key Implementation Notes

### Cost Control Mechanisms
- Implement usage tracking and analytics from day one
- Set up hard caps on API usage per user
- Create tiered access system (free/premium)
- Implement caching for common AI operations
- Set up monitoring and alerting for costs
- Add automated service disabling if costs exceed thresholds

### Free Tier Limitations
- 3-5 videos per month (not per day)
- 30-45 second maximum video length
- 750-1000 characters per video for voice
- GPT-3.5 for text rewriting (reserve GPT-4 for premium)
- Basic voice options only
- Content auto-deleted after 14 days

### API Integration
- OpenAI for text rewriting
- ElevenLabs for voice generation
- URL submission rather than direct Reddit API initially
- Proper handling of API keys (never expose to frontend)
- API costs are centralized (your account, not individual users)

### Pay-As-You-Go Implementation
- All services configured for zero baseline costs
- No minimum instance counts or provisioned resources
- Scale seamlessly with demand
- Implement proper shutdowns when idle

### Open Beta Access
- Allow open access to beta (not invite-only)
- Monitor costs closely during beta period
- Implement strict free tier limitations from the start
- Be prepared to add temporary restrictions if costs become unsustainable

### Security Considerations
- Store all API keys securely in environment variables
- Implement proper authentication and authorization
- Rate limiting on all endpoints
- Validate all user inputs
- Secure file uploads and downloads 

## Git Commit Practices

### End of Chat Commit Summary
At the end of each productive chat where files have been modified, Claude will:

1. Provide a recommended commit message following the standard conventions:
   - "fix:" for bug fixes
   - "feat:" for new features
   - "docs:" for documentation changes
   - "style:" for formatting changes
   - "refactor:" for code refactoring
   - "test:" for adding tests
   - "chore:" for maintenance tasks

2. List all files that have been changed and need to be committed

3. Provide simple instructions for what needs to be done to commit these changes

### Example Commit Summary Format
```
## Commit Summary

feat: add user authentication component

Files to commit:
- web/frontend/src/components/Auth.js (new)
- web/frontend/src/pages/login.js (modified)

To commit these changes:
1. Click the "+" next to each file in the Source Control panel
2. Enter the commit message above in the message box
3. Click "Commit"
4. If prompted to "Save All & Commit Changes", choose this option
```

## Current Implementation Tasks

### Completed Tasks

- ✅ Docker Development Environment
- ✅ MongoDB Integration
- ✅ Cloudflare R2 Storage Setup
- ✅ VideoContext Player Implementation
- ✅ Adaptive Scene-Based Aspect Ratio Support
  - Successfully implemented media aspect ratio detection
  - Added consistent letterboxing/pillarboxing
  - Fixed stretching and distortion issues
  - Improved visual quality for mixed aspect ratio content

### In Progress Tasks

- 🔄 API Client Refactoring
- 🔄 Voice Generation UI Integration
- 🔄 Video Processing Interface

### Upcoming Tasks

- ⏳ Authentication System
- ⏳ Export Pipeline
- ⏳ Subscription Management

## Video Preview and Editing Strategy

Based on analysis of project requirements, particularly the need for complex, styled captions, and the capabilities of available libraries, the following **Hybrid Approach** has been adopted for the video editor preview and rendering:

### 1. Core Engine: `video-context`
- **Role**: `video-context` will serve as the foundational engine for the interactive preview.
- **Responsibilities**:
    - Loading and managing base video/audio sources.
    - Handling timeline sequencing of media clips.
    - Providing precise playback timing (`currentTime`) for synchronization.
    - Implementing core trimming functionality.
    - Applying basic, shader-based visual effects or transitions using its built-in `DEFINITIONS` or simple custom shaders, *if needed later*.

### 2. Captions and UI Overlays: HTML/CSS/JavaScript (React)
- **Implementation**: Captions, interactive elements (like handles for trimming), and potentially other UI overlays will be implemented as standard React components rendering HTML elements.
- **Styling & Animation**: Rich text styling and complex animations (word-by-word reveals, dynamic backgrounds, kinetic typography) will be achieved using CSS and potentially JavaScript animation libraries (e.g., Framer Motion). This leverages the strengths and flexibility of standard web technologies for UI rendering.
- **Synchronization**: React components responsible for overlays (especially captions) will listen to `currentTime` updates from `video-context` and dynamically update their state (visibility, animation progress) to remain perfectly synchronized with the video playback.

### 3. Complex Visual Effects: Deferred / Future Consideration
- **Current Status**: Implementation of complex, custom visual effects (beyond basic fades, wipes, color correction provided by `video-context`) is **deferred** to prioritize core editing and caption functionality.
- **Future Option**: If required later, complex visual effects could potentially be implemented using a separate WebGL overlay canvas managed by a library like **Babylon.js**. This overlay would also need to be synchronized with `video-context`'s `currentTime`. This adds significant synchronization complexity and is not part of the initial implementation plan.

### 4. Export Process: Backend FFmpeg + EDL
- **Mechanism**: Final video rendering will be handled by a backend process using **FFmpeg**.
- **Frontend Role**: The frontend editor will generate a detailed **Edit Decision List (EDL)**, likely in JSON format. This EDL will encapsulate the entire edit state:
    - Sequence of video/audio clips (source URLs, trim in/out points).
    - All caption data (text content, start/end times, styling information translatable to subtitles).
    - Any effects/transitions applied via `video-context` definitions.
- **Backend Role**: The backend service will:
    - Receive the EDL.
    - Fetch the original media sources.
    - Use FFmpeg commands to:
        - Trim and concatenate media according to the EDL.
        - Apply FFmpeg filter equivalents for any basic effects/transitions specified.
        - **Generate a styled subtitle file (e.g., ASS format for maximum styling fidelity) from the caption data in the EDL.**
        - **Use FFmpeg's subtitle filter to burn the generated captions directly into the output video frames.**
        - Encode the final MP4 video file.

### 5. Rationale
- This hybrid approach leverages `video-context` for its specialized media sequencing and timing capabilities, avoiding the high complexity of building a custom, low-level media playback engine from scratch.
- It utilizes the most appropriate and powerful tools (HTML/CSS/JS) for the essential requirement of complex caption rendering and animation.
- It provides a clear and robust path for high-fidelity export using the industry-standard FFmpeg, including styled captions.
- It pragmatically defers the complexity of advanced visual effects until core functionality is stable.

## Implementation Guidelines

### Code Documentation Standards
1. Component Documentation
   - JSDoc comments for all components
   - Props interface documentation
   - Usage examples
   - Key functionality notes

2. API Documentation
   - OpenAPI/Swagger documentation
   - Request/response examples
   - Error handling documentation
   - Authentication details

3. Development Guides
   - Setup instructions
   - Development workflow
   - Testing procedures
   - Deployment process

### Testing Requirements
1. E2E Tests
   - Core functionality coverage
   - User flow validation
   - Error handling scenarios
   - State management verification

2. Component Tests
   - Unit tests for utilities
   - Integration tests for features
   - Performance benchmarks
   - Accessibility testing

### Performance Optimization
1. Frontend
   - Code splitting
   - Image optimization
   - State management efficiency
   - Bundle size optimization

2. Backend
   - Query optimization
   - Caching strategy
   - Resource management
   - Error handling efficiency

## Code Quality & Formatting

### Frontend (Next.js)
- **ESLint**: For catching JavaScript/React errors and enforcing best practices
  - Configuration: `.eslintrc.json`
  - Running: `npm run lint` or `npm run lint:fix` (to automatically fix issues)
- **Prettier**: For consistent code formatting
  - Configuration: `.prettierrc`
  - Running: `npm run format` (to format code) or `npm run format:check` (to check for issues)

### Backend (FastAPI/Python)
- **Flake8**: For catching Python errors and code style issues
  - Configuration: `setup.cfg`
  - Running: `flake8 .`
- **Black**: For consistent Python code formatting
  - Configuration: `pyproject.toml`
  - Running: `black .`
- **isort**: For sorting Python imports consistently
  - Configuration: `setup.cfg`
  - Running: `isort .`
- **mypy**: For Python type checking
  - Configuration: `setup.cfg`
  - Running: `mypy app/`

### Whole Project
- **EditorConfig**: For consistent editor settings across IDEs
  - Configuration: `.editorconfig` at the root
- **Format Script**: For formatting the entire codebase
  - Script: `format_codebase.sh` at the root
  - Running: `./format_codebase.sh`
- **GitHub Actions**: For CI/CD linting checks
  - Configuration: `.github/workflows/lint.yml`

### Scene Component Refactoring
- ✅ Phase 1: Core Component Structure (70% Complete)
  - ✅ Component Architecture
    - Created modular component structure
    - Implemented proper TypeScript interfaces
    - Set up component communication patterns
  - ✅ UI Components
    - SceneHeader: Scene numbering and controls
    - SceneMediaPlayer: Media display and controls
    - SceneTextContent: Text editing and display
    - SceneVoiceSettings: Voice configuration
    - SceneAudioControls: Audio playback
    - SceneActions: Scene management actions
  - ✅ State Management
    - View mode (compact/expanded)
    - Info section visibility
    - Text editing capabilities
    - Voice generation and settings
    - Scene removal with confirmation
  - 🔄 In Progress
    - Media trim controls integration
    - Performance optimizations
    - Enhanced error handling
    - Loading state improvements 

### 5. Add Authentication (Later Phase)
- Choose an authentication method (e.g., NextAuth.js, Clerk)
- Implement user registration and login
- Secure API endpoints

### Current Implementation Tasks (Immediate Focus)

1.  **Implement Persistent Video Trimming:**
    *   Modify frontend (`VideoContextScenePreviewPlayer`, `VideoContextProvider`) to interact with the backend API.
    *   Create a backend API endpoint (`PUT /api/v1/projects/{project_id}/scenes/{scene_id}/trim`) to update `startTime` and `endTime` for a specific scene in MongoDB.
    *   Ensure the scene data model in `ProjectContext` and the database schema support `startTime` and `endTime` fields.
    *   Load saved trim values when the project/editor loads.

2.  **Implement Basic Sequential Playback Preview:**
    *   Add a "Play All" button to the editor UI.
    *   In the frontend, create logic within `VideoContextProvider` or a dedicated hook (`useSequencePlayer`) to manage sequential playback:
        *   Get the ordered list of scenes from `ProjectContext`.
        *   Use `videoContext.play()` and `videoContext.seek()` along with the saved `startTime` and `endTime` for each scene.
        *   Monitor `videoContext.currentTime` and potentially use `setTimeout` or `requestAnimationFrame` to transition to the next scene when the current one's trimmed duration is reached.

3.  **Integrate Original Video Audio:**
    *   Verify that `video-context` is loading and playing audio tracks from source videos by default. Check the `addSource` implementation in `VideoContextManager` and ensure audio isn't explicitly disabled.
    *   (Optional) Add a UI element (e.g., simple slider) to control the volume of the *original* video source within the `VideoContextScenePreviewPlayer` or `Scene` component.
    *   (Optional) Add a `sourceVolume` field to the scene data model and save/load this value alongside trim times.
    *   (Optional) Use `videoContext` methods to set the volume for the specific video node if the API supports it (check `video-context` documentation or implementation). If not directly supported on the node, this might need to be handled during FFmpeg export.

### Future Implementation Tasks (Post-Immediate Focus)

*   Implement backend export endpoint (`POST /api/v1/projects/{project_id}/export`).
*   Integrate FFmpeg into the backend service (likely within the Docker container).
*   Develop FFmpeg command generation logic based on JSON EDL.
*   Implement frontend download triggering and handling.
*   Add audio mixing controls and update FFmpeg logic.
*   Implement transitions/effects (mechanism TBD).
*   Define and implement R2 folder structure.
*   Enhance timeline UI (drag-and-drop reorder, waveforms).

## Style Guide

### Frontend (Next.js)
- **ESLint**: For catching JavaScript/React errors and enforcing best practices
  - Configuration: `.eslintrc.json`
  - Running: `npm run lint` or `npm run lint:fix` (to automatically fix issues)
- **Prettier**: For consistent code formatting
  - Configuration: `.prettierrc`
  - Running: `npm run format` (to format code) or `npm run format:check` (to check for issues)

### Backend (FastAPI/Python)
- **Flake8**: For catching Python errors and code style issues
  - Configuration: `setup.cfg`
  - Running: `flake8 .`
- **Black**: For consistent Python code formatting
  - Configuration: `pyproject.toml`
  - Running: `black .`
- **isort**: For sorting Python imports consistently
  - Configuration: `setup.cfg`
  - Running: `isort .`
- **mypy**: For Python type checking
  - Configuration: `setup.cfg`
  - Running: `mypy app/`

### Whole Project
- **EditorConfig**: For consistent editor settings across IDEs
  - Configuration: `.editorconfig` at the root
- **Format Script**: For formatting the entire codebase
  - Script: `format_codebase.sh` at the root
  - Running: `./format_codebase.sh`
- **GitHub Actions**: For CI/CD linting checks
  - Configuration: `.github/workflows/lint.yml`

### Scene Component Refactoring
- ✅ Phase 1: Core Component Structure (70% Complete)
  - ✅ Component Architecture
    - Created modular component structure
    - Implemented proper TypeScript interfaces
    - Set up component communication patterns
  - ✅ UI Components
    - SceneHeader: Scene numbering and controls
    - SceneMediaPlayer: Media display and controls
    - SceneTextContent: Text editing and display
    - SceneVoiceSettings: Voice configuration
    - SceneAudioControls: Audio playback
    - SceneActions: Scene management actions
  - ✅ State Management
    - View mode (compact/expanded)
    - Info section visibility
    - Text editing capabilities
    - Voice generation and settings
    - Scene removal with confirmation
  - 🔄 In Progress
    - Media trim controls integration
    - Performance optimizations
    - Enhanced error handling
    - Loading state improvements 