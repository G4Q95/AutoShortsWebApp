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

### Completed
✅ Core Application Structure
- Next.js frontend setup
- FastAPI backend implementation
- MongoDB Atlas integration
- Project workspace implementation
- Scene management system
- Test suite implementation

✅ Testing Infrastructure
- Playwright E2E tests
- Core functionality coverage
- Test reliability improvements
- CI/CD integration
- All tests passing successfully (6/6)

✅ Code Organization & Documentation
- Component documentation
- API documentation
- Development guides
- Code pattern standardization
- Utility function organization
- Type definition standardization

✅ Server Infrastructure
- Server management scripts
- MongoDB Atlas integration
- Browser tools server integration
- Comprehensive logging system
- Error handling and diagnostics
- Reliable startup and monitoring
- Health check endpoints

✅ Content Extraction
- Reddit URL handling
- Media extraction
- Video proxy implementation
- Error handling
- Response standardization
- Performance optimization

### In Progress
🔄 API Refactoring
- Modular API client implementation
- Feature flag infrastructure
- Enhanced error handling
- Improved testability
- Gradual rollout strategy

🔄 Video Processing Pipeline
- FFMPEG integration
- Scene processing
- Transition effects
- Progress tracking

### API Refactoring Best Practices

When implementing new API features or refactoring existing ones, follow these guidelines:

1. **Feature Flag Strategy**
   - Always initialize feature flags to `false` by default
   - Enable flags incrementally with thorough testing
   - Implement fallback mechanisms for graceful degradation
   - Never enable multiple feature flags simultaneously without testing each independently

2. **Testing Methodology**
   - Create dedicated test environments for new API implementations
   - Test both original and new implementations before switching
   - Verify compatibility with existing UI components
   - Include both success and error scenarios in tests

3. **Incremental Rollout**
   - Test in isolated environments before integration
   - Enable for development and testing environments first
   - Monitor error rates and performance metrics
   - Implement emergency rollback mechanisms

4. **Documentation Requirements**
   - Document all API changes in code comments
   - Update API documentation with new endpoints and response formats
   - Include examples of request/response formats
   - Document known limitations and edge cases

Following these guidelines will help maintain application stability while improving the codebase.

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