# Auto Shorts Web App

A web application that allows users to convert social media content (primarily from Reddit) into engaging short-form videos.

## Core Concept

This application enables users to:
1. Retrieve content from URLs
2. Rewrite text using AI
3. Generate voiceovers
4. Assemble videos with the content and voiceover

## Video Creation Process

The application features an intuitive workflow:

1. **Create a Project:** Start by naming your video project
2. **Add Content:** Enter Reddit URLs to extract content
3. **Organize Scenes:** Each URL becomes a draggable scene containing the media and text
4. **Customize:** Rearrange scenes, edit text, and adjust settings
5. **Generate:** Process your project into a complete short-form video
6. **Share:** Download and share to social media platforms

## Technology Stack

- **Frontend**: Next.js with React + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB Atlas
- **Storage**: Cloudflare R2
- **Media Processing**: Google Cloud Run
- **Hosting**: Vercel
- **Development Environment**: Docker

## Business Model

- **Freemium approach** with tiered access:
  - Free tier with limited features and usage caps
  - Premium tier ($15/month) with expanded features and higher limits
  - Pro tier ($30/month) with unlimited access and priority processing

## Project Structure

```
Auto Shorts Web App/
├── legacy/                  # Original scripts
│
├── web/                     # New web application
│   ├── frontend/            # Next.js application
│   │   ├── public/          # Static assets
│   │   ├── src/             # React components, pages, etc.
│   │   ├── Dockerfile       # Frontend container configuration
│   │   └── package.json     # Frontend dependencies
│   │
│   ├── backend/             # FastAPI application
│   │   ├── app/             # API code
│   │   │   ├── api/         # API routes
│   │   │   ├── core/        # Core functionality
│   │   │   ├── models/      # Data models
│   │   │   └── services/    # Business logic
│   │   │
│   │   ├── Dockerfile       # Backend container configuration
│   │   └── requirements.txt # Backend dependencies
│
├── docker-compose.yml       # Docker composition for all services
├── .env                     # Environment variables
└── .env.example             # Example environment configuration
```

## Getting Started

### Prerequisites

- Docker Desktop
- Docker Compose (included with Docker Desktop)
- Git

### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/autoshortswebapp.git
   cd autoshortswebapp
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration details
   ```

3. **Start the application**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Running Tests

With Docker services running, execute:
```bash
cd web/frontend && npm test
```

### Alternative: Manual Setup (Without Docker)

If you prefer not to use Docker:

1. **Set up the backend**
   ```bash
   cd web/backend
   pip install -r requirements.txt
   python -m app.main
   ```

2. **Set up the frontend**
   ```bash
   cd web/frontend
   npm install
   npm run dev
   ```

3. **Set up browser tools for testing**
   ```bash
   npm install -g @agentdeskai/browser-tools-server
   npx browser-tools-server
   ```

## Current Development Status

The application is in active development with several key features implemented:

- ✅ Project creation and management
- ✅ Content extraction from Reddit
- ✅ Media display (images and videos)
- ✅ Scene management with drag-and-drop
- ✅ Docker containerization for development
- ✅ End-to-end testing with Playwright
- 🔄 Video processing pipeline
- 🔄 User authentication
- 🔄 Cloud storage integration

## Development Setup

### Frontend (Next.js)

```bash
cd web/frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

### Backend (FastAPI)

```bash
cd web/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

The backend API will be available at `http://localhost:8001`.

API documentation will be available at:
- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`

### Environment Variable Validation

The application includes automatic environment variable validation to prevent runtime errors:

1. **On Startup**: The application checks for required environment variables
2. **Clear Error Messages**: If variables are missing, detailed error messages are displayed
3. **Format Validation**: Validates the format of important variables like MongoDB URI

If validation fails:
- Backend: Displays an error message and exits
- Frontend: Shows a red banner with error details (console has additional information)

This helps identify configuration issues early and provides clear guidance on what needs to be fixed.

### CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment:

1. **Automated Testing**: All tests run automatically on code changes
2. **Build Verification**: Ensures the application builds correctly
3. **Environment Validation**: Checks that all required environment variables are defined
4. **Docker Validation**: Verifies Docker configuration files and builds containers
5. **Quality Checks**: Runs linting and formatting checks (separate workflow)

The CI/CD pipeline runs on:
- Pushes to the main branch
- Pushes to feature and fix branches
- Pull requests to the main branch

This automation helps:
- Catch issues early before they reach production
- Ensure consistent code quality
- Provide immediate feedback on changes
- Document the build and test process

Test results are available as artifacts in GitHub Actions, making it easy to diagnose any failures.

## Deployment

- Frontend: Deployed on Vercel
- Backend: Deployed on Google Cloud Run

## Key Features

1. **MVP**:
   - URL-based content submission
   - Project workspace with draggable scenes
   - Basic video generation
   - Google authentication
   - Free tier limitations

2. **Future Versions**:
   - Enhanced video editing options
   - Multiple voice styles
   - Background music options
   - Video templates
   - Advanced analytics 

## Documentation Overview

This project has several documentation files for different purposes:

| File | Location | Purpose |
|------|----------|---------|
| **README.md** | `/` | Project overview and quick start guide |
| **PROJECT_OVERVIEW.md** | `/docs/` | Comprehensive project concept, architecture, and business model |
| **PROJECT_INSTRUCTIONS.md** | `/docs/` | Detailed implementation steps and technical requirements |
| **progress.md** | `/docs/` | Current development status, completed tasks, and upcoming work |
| **DEVELOPMENT_WORKFLOW.md** | `/` | Development process, code quality practices, and workflow guidelines |
| **API_STANDARDS.md** | `/docs/` | API standards, response formats, and error handling documentation |
| **API_ENDPOINTS.md** | `/docs/` | Comprehensive API endpoint documentation with examples |
| **lightweight-refactoring-prompt.md** | `/docs/` | Current refactoring plan and progress |
| **CONVERSATION_SUMMARY.md** | `/docs/` | Summary of key development conversations and decisions |
| **frontend/README.md** | `/web/frontend/` | Frontend-specific setup and development information |
| **backend/README.md** | `/web/backend/` | Backend-specific setup and development information |

When starting a new chat in Cursor with Claude, consider adding relevant context files (especially `.cursorrules` and appropriate documentation) to ensure consistent development patterns. 

## Standards & Best Practices

This project follows strict coding standards and best practices to maintain code quality and consistency. These standards were established and refined during our lightweight refactoring process.

### Key Standards Documents

| Document | Description |
|----------|-------------|
| **[.cursorrules](.cursorrules)** | Primary source for coding standards, naming conventions, component structure, and commit conventions |
| **[DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md)** | Detailed workflow for feature development, bug fixing, and code maintenance |

### Core Principles

1. **Code Organization**
   - Dedicated utility files for different concerns
   - Consistent file and directory naming
   - Clear separation of frontend and backend code

2. **Quality Standards**
   - Pre-commit checklist for code review
   - Enhanced testing requirements
   - Documentation standards for code and APIs

3. **Error Handling**
   - Consistent error display components
   - Standardized API error responses
   - Comprehensive error logging

4. **State Management**
   - Centralized context for global state
   - Local state for component-specific concerns
   - Optimized to prevent unnecessary re-renders

5. **API Standards**
   - RESTful principles for endpoint design
   - Consistent response formats
   - Comprehensive error codes and messages

### Maintaining Quality

To maintain code quality as the project grows:

1. **Follow the development workflow** in DEVELOPMENT_WORKFLOW.md
2. **Use the pre-commit checklist** in .cursorrules
3. **Run tests regularly** to catch issues early
4. **Document code** with JSDoc comments
5. **Update documentation** when making significant changes

These standards ensure we maintain high code quality while delivering features efficiently. 