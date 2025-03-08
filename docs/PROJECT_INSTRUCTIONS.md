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
Try and brake 

## Development Steps
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