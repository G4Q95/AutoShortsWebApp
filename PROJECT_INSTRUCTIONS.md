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
├── README.md                  # Main project documentation
└── .gitignore                 # Git ignore file
```

## Current Implementation Tasks

### 1. ✅ Fix Not-Found Page Error
- ✅ Resolved "The default export of notFound is not a React Component" error
- ✅ Properly implemented the 404 page for better user experience

### 2. ✅ Enhanced Reddit Content Extraction
- ✅ Fixed the Reddit URL 302 redirect handling issue
- ✅ Implemented proper headers and user agent for Reddit API requests
- ✅ Added extraction of content (text, images, videos) from Reddit URLs

### 3. 🔄 Project Workspace Implementation (Current Focus)
- Create a new project creation flow:
  1. Enter project title to create a new project
  2. Project workspace with scene management
- Implement scene components that display:
  - Extracted media (image/video)
  - Text content
  - Basic controls
- Add drag-and-drop functionality for scene reordering
- Implement project state management

### 4. Future Tasks
- Complete video processing pipeline
- Add user authentication
- Implement premium features and payment processing
- Optimize for production deployment

## Implementation Notes

### Not-Found Page Fix (Completed)
- Renamed the component from `NotFound` to `NotFoundPage` to avoid conflicts with Next.js built-in functions
- Component properly displays a user-friendly 404 page with navigation links

### Reddit Content Extraction (Completed)
- Added comprehensive browser-like headers to avoid bot detection
- Implemented two-step approach: first establishing cookies, then fetching JSON data
- Created dedicated function to extract media (images, videos, galleries)
- Extended data structure to include metadata (subreddit, votes, created time)

## Original Development Steps (for reference)
1. Create the directory structure
2. Move existing scripts to legacy/
3. Initialize Next.js in web/frontend
4. Initialize FastAPI in web/backend
5. Port functionality from legacy code, one component at a time
6. Implement user authentication with Google login
7. Create URL-based content submission interface
8. Implement text rewriting with OpenAI
9. Implement voice generation with ElevenLabs
10. Create video assembly with FFMPEG in containers
11. Deploy to chosen infrastructure

## Key Implementation Notes

### Enhanced User Interface
- Implement project-based workflow for video creation
- Create intuitive scene management with drag-and-drop ordering
- Design responsive scene components that display media and text
- Add real-time preview of content extraction
- Implement visual indicators for process status

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