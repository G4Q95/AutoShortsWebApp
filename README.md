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

### Test Efficiency Guidelines

For a comprehensive guide on making our tests more maintainable and efficient, see [docs/test-update-efficiency.md](docs/test-update-efficiency.md). This document outlines:

- Strategies for reducing test maintenance overhead
- Best practices for resilient test selectors
- Guidelines for modular test organization
- Quick wins to immediately improve test efficiency
- Implementation plan for ongoing test improvements

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

The project is currently in active development with the following components:

- ✅ Frontend Core (Next.js, React, Tailwind CSS)
- ✅ Backend API (FastAPI, Python)
- ✅ Database Integration (MongoDB Atlas)
- ✅ Voice Generation System (ElevenLabs)
- 🔄 Content Extraction (URLs, text, media metadata)
- 🔄 Video Processing Pipeline (FFMPEG)
- ⏳ External Media Download Implementation
- ⏳ Authentication System
- ⏳ Cloud Storage Integration

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

### API Documentation

The Auto Shorts Web App provides comprehensive API documentation through FastAPI's Swagger UI integration:

- **Interactive Documentation**: Full API reference available at:
  - Swagger UI: `http://localhost:8000/docs` (development) or `https://api.autoshortsapp.com/docs` (production)
  - ReDoc: `http://localhost:8000/redoc` (alternative documentation viewer)

- **Documentation Features**:
  - Interactive endpoint testing directly in the browser
  - Detailed request and response schemas with examples
  - Authentication integration for testing secured endpoints
  - Comprehensive error responses and status codes
  - Logically organized API categories

- **API Standards**:
  - RESTful design principles
  - Consistent response formats
  - Standardized error handling
  - Proper HTTP status code usage
  - Detailed validation rules

For API development guidelines and documentation standards, see [docs/API_DOCUMENTATION_GUIDE.md](docs/API_DOCUMENTATION_GUIDE.md).

### Environment Variable Validation

The application includes automatic environment variable validation to prevent runtime errors:

1. **On Startup**: The application checks for required environment variables
2. **Clear Error Messages**: If variables are missing, detailed error messages are displayed
3. **Format Validation**: Validates the format of important variables like MongoDB URI

If validation fails:
- Backend: Displays an error message and exits
- Frontend: Shows a red banner with error details (console has additional information)

This helps identify configuration issues early and provides clear guidance on what needs to be fixed.

For detailed information about environment validation, including required variables, implementation details, and troubleshooting, see [docs/ENV_VALIDATION_GUIDE.md](docs/ENV_VALIDATION_GUIDE.md).

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

### Automated Code Formatting and Linting

The project enforces code quality and consistency through automated formatting and linting tools:

1. **Frontend (Next.js/React)**:
   - ESLint: Catches JavaScript/TypeScript errors and enforces best practices
   - Prettier: Ensures consistent code formatting and style

2. **Backend (FastAPI/Python)**:
   - Black: Formats Python code in a consistent, opinionated style
   - isort: Organizes import statements systematically
   - Flake8: Catches Python errors and style issues
   - mypy: Provides optional static type checking

3. **Automation**:
   - GitHub Actions workflow automatically checks formatting and linting
   - Pre-commit hooks prevent committing code that doesn't meet standards
   - VS Code integration for real-time feedback while coding

4. **Tools**:
   - Format entire codebase with: `./format_codebase.sh`
   - Check frontend only: `cd web/frontend && npm run lint`
   - Check backend only: `cd web/backend && black . --check && isort . --check && flake8 .`

For detailed guidelines and configuration information, see [docs/CODE_QUALITY.md](docs/CODE_QUALITY.md).

### Makefile for Common Tasks

The project includes a Makefile that provides simple commands for common development tasks:

1. **Docker Management**:
   ```bash
   make up           # Start all Docker containers
   make down         # Stop all Docker containers
   make logs         # View logs from all containers
   ```

2. **Development**:
   ```bash
   make install      # Install all dependencies
   make frontend     # Start frontend server
   make backend      # Start backend server
   make browser-tools # Start browser tools server
   ```

3. **Testing and Quality**:
   ```bash
   make test         # Run all tests
   make format       # Format all code
   make lint         # Check code quality
   ```

4. **Setup and Utilities**:
   ```bash
   make dev-setup    # Initial development setup
   make clean        # Clean temporary files
   make check-env    # Validate environment
   ```

View all available commands with `make help`. For detailed usage instructions, see [docs/MAKEFILE_GUIDE.md](docs/MAKEFILE_GUIDE.md).

### Version Control and .gitignore

The project uses a comprehensive gitignore configuration to keep the repository clean and secure:

1. **Technology-Specific Patterns**:
   - Python backend (compiled files, caches, build artifacts)
   - JavaScript/TypeScript frontend (node_modules, Next.js directories)
   - Docker (volumes and container data)
   
2. **Security Features**:
   - Automatic exclusion of all environment files (`.env`, `.env.local`)
   - Prevention of accidental commitment of API keys and secrets
   - Protection for SSL certificates and credentials

3. **Development Experience**:
   - IDE-specific exclusions (VS Code, JetBrains, Vim)
   - Testing artifacts (coverage reports, Playwright results)
   - Build caches and temporary files

4. **Best Practices**:
   - Selective inclusion of important shared configuration
   - Clear section organization with comments
   - Specific patterns to avoid accidental exclusions

For detailed information about our gitignore structure and best practices, see [docs/GITIGNORE_GUIDE.md](docs/GITIGNORE_GUIDE.md).

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
| **PROJECT_OVERVIEW.md** | `/docs/` | Comprehensive project concept, architecture, and business model (symlinked from root) |
| **PROJECT_INSTRUCTIONS.md** | `/docs/` | Detailed implementation steps and technical requirements (symlinked from root) |
| **progress.md** | `/docs/` | Current development status, completed tasks, and upcoming work |
| **DEVELOPMENT_WORKFLOW.md** | `/` | Development process, code quality practices, and workflow guidelines |
| **API_STANDARDS.md** | `/docs/` | API standards, response formats, and error handling documentation |
| **API_ENDPOINTS.md** | `/docs/` | Comprehensive API endpoint documentation with examples |
| **lightweight-refactoring-prompt.md** | `/docs/` | Current refactoring plan and progress (symlinked from root) |
| **Refactoring-Plan-V2.md** | `/docs/` | Detailed refactoring plan with implementation steps (symlinked from root) |
| **r2_setup.md** | `/docs/` | CloudFlare R2 storage setup and configuration guide |
| **playwright-guide.md** | `/docs/` | Guide for running and maintaining Playwright tests |
| **playwright-status.md** | `/` | Current status of Playwright tests and recent changes |
| **test-update-efficiency.md** | `/docs/` | Guidelines for improving test efficiency and maintenance |
| **frontend/README.md** | `/web/frontend/` | Frontend-specific setup and development information |
| **backend/README.md** | `/web/backend/` | Backend-specific setup and development information |

When starting a new chat in Cursor with Claude, consider adding relevant context files (especially `.cursorrules` and appropriate documentation) to ensure consistent development patterns.

### Documentation Organization

This project follows a consistent documentation organization strategy:

1. **Source of Truth**: The `docs/` directory contains the authoritative versions of most documentation files
2. **Symbolic Links**: Important files are symlinked from the root directory for easy access
3. **Directory-Specific Documentation**: Each major component (frontend, backend) has its own README
4. **Specialized Guides**: Topic-specific guides are stored in the `docs/` directory
5. **Testing Documentation**: Test-related documentation is kept in the `docs/` directory with status reports in the root

This organization ensures documentation is easy to find and maintain with a single source of truth for each document.

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

## Features

### Voice Generation
- ✅ ElevenLabs API integration for high-quality voice synthesis
- ✅ Multiple voice options with preview functionality
- ✅ Support for various audio formats (MP3, PCM)
- ✅ Real-time audio generation and playback
- ✅ Comprehensive error handling and validation
- ✅ Voice testing interface at `/voice-test`

### Video Processing
// ... existing code ...

## Quick Start

1. Clone the repository
2. Install Docker and Docker Compose
3. Copy `.env.example` to `.env` and configure your environment variables:
   ```
   ELEVENLABS_API_KEY=your_api_key_here
   MONGODB_URI=your_mongodb_uri
   ```
4. Start the development environment:
   ```bash
   docker-compose up -d
   ```
5. Access the application:
   - Main application: http://localhost:3000
   - Voice testing interface: http://localhost:3000/voice-test
   - Backend API: http://localhost:8000
   - API documentation: http://localhost:8000/docs

## Testing

// ... existing code ... 