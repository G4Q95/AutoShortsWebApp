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
│   │   └── package.json     # Frontend dependencies
│   │
│   ├── backend/             # FastAPI application
│   │   ├── app/             # API code
│   │   │   ├── core/        # Core functionality
│   │   │   ├── api/         # API routes
│   │   │   ├── services/    # Business logic
│   │   │   └── models/      # Data models
│   │   │
│   │   ├── requirements.txt # Backend dependencies
│   │   └── Dockerfile       # For containerization
│
├── docs/                    # Project documentation
│   ├── PROJECT_OVERVIEW.md
│   └── PROJECT_INSTRUCTIONS.md
│
└── README.md               # This file
```

## Current Development Status

- Basic infrastructure setup completed
- Connected frontend and backend services
- Implemented URL submission form with validation
- Enhanced error handling functionality
- Fixed Not-Found page errors
- Improved Reddit content extraction for better media handling
- Implemented MongoDB Atlas for project storage and persistence
- Created project workspace with drag-and-drop scene management
- Implemented scene reordering and content organization
- Working on:
  - Completing the video processing pipeline
  - Enhancing content extraction capabilities
  - Implementing video preview and download functionality

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
| **progress.md** | `/` | Current development status, completed tasks, and upcoming work |
| **instructions.md** | `/` | Development environment setup and workflow instructions |
| **.cursorrules** | `/` | Coding patterns, conventions, and AI assistant guidelines |
| **CONVERSATION_SUMMARY.md** | `/docs/` | Summary of key development conversations and decisions |
| **frontend/README.md** | `/web/frontend/` | Frontend-specific setup and development information |
| **backend/README.md** | `/web/backend/` | Backend-specific setup and development information |

When starting a new chat in Cursor with Claude, consider adding relevant context files (especially `.cursorrules` and appropriate documentation) to ensure consistent development patterns. 