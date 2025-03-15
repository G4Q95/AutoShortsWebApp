# Auto Shorts Web App - Conversation Summary

This document summarizes the key discussions and decisions made during our planning session for transforming the Auto Shorts scripts into a web application.

## Key Decisions Made

### Technology Stack
- **Frontend**: Next.js with React + Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: MongoDB Atlas
- **Storage**: Cloudflare R2
- **Media Processing**: Google Cloud Run
- **Hosting**: Vercel

### Business Model
- Freemium approach with free tier, Premium ($15/mo) and Pro ($30/mo) options
- Open beta (not invite-only) with strict usage limits

### Architecture Approach
- Pay-As-You-Go (PAYG) model for all infrastructure
- Modular design allowing components to be swapped if needed
- URL-based content submission to start (rather than direct API integration)

### Cost Management
- Free tier limited to 3-5 videos per month, 30-45 seconds each
- Hard caps on API usage for cost protection
- Estimated maximum cost with all free users: $92.50-192.50/month for 1,000 users
- Majority of costs come from ElevenLabs voice generation
- Media files stored on Cloudflare R2 to avoid egress fees

### Project Organization
- Legacy code moved to /legacy directory
- New web app in /web directory with separate frontend and backend
- Using a single repository for better organization

## Discussion Topics Covered

1. **Tech Stack Comparison**: Evaluated multiple options for each component
   - Frontend frameworks: Next.js vs Vue.js vs SvelteKit
   - Backend frameworks: FastAPI vs Flask vs Express
   - Database options: MongoDB vs PostgreSQL vs DynamoDB
   - Storage options: Cloudflare R2 vs AWS S3 vs Backblaze B2
   - Processing: Google Cloud Run vs AWS Lambda vs dedicated servers

2. **Cost Analysis**:
   - Detailed breakdown for different user counts (100, 1,000, 5,000)
   - API costs as the largest expense (especially ElevenLabs)
   - Methods to control and cap costs
   - Worst-case scenario planning

3. **User Experience**:
   - Content retrieval workflow
   - Video generation pipeline
   - Application structure and interface
   - Authentication using Google login

4. **Development Timeline**:
   - 10-week development plan in four phases
   - Milestones and key deliverables
   - Feature prioritization for initial MVP
   
5. **Scalability Considerations**:
   - How the architecture handles growth
   - When to consider moving from pure PAYG to reserved instances
   - Predictable cost scaling with user growth

## Media Handling Investigation (May 23, 2024)

### Key Findings

1. **Content Extraction Implementation**:
   - The application successfully extracts metadata from Reddit URLs (text, title, media URLs)
   - The `extract_url_content` function in `content_retrieval.py` handles this extraction
   - For Reddit, a dedicated `handle_reddit_url` function manages the complex Reddit JSON structure

2. **Media Handling Gap**:
   - The current implementation extracts media URLs and metadata but does not download the actual media files
   - There are no utility functions for downloading external media from URLs
   - The `VideoProcessor.create_video` method uses a mock implementation that doesn't incorporate external media

3. **Storage Service**:
   - The application implements a storage service using Cloudflare R2 with local fallback
   - The storage service only handles files already on the local filesystem
   - It doesn't have functionality to download media from external URLs

### Actions Taken

1. **Documentation Created**:
   - Created a new `MEDIA_HANDLING.md` document detailing current implementation and planned improvements
   - Updated progress.md to include an external media download task in the Next Steps section
   - Updated README.md to reflect current status of media handling

2. **Implementation Plans**:
   - Documented the need for media download functionality
   - Outlined security considerations for media downloading
   - Planned integration with the video creation pipeline

### Next Steps

1. Implement utility functions to download media from external URLs
2. Add caching and management for downloaded media
3. Integrate downloaded media into the video creation process
4. Add security validations for downloaded media

The investigation clarified that a key component of the video creation pipeline—downloading and processing external media—is currently missing and needs to be implemented.

## Reference Documents

The following documents were created to capture the detailed plans:

1. **PROJECT_OVERVIEW.md**: High-level summary of the application concept, business model, and technical decisions
2. **PROJECT_INSTRUCTIONS.md**: Detailed implementation guide with file structure, development steps, and key notes

These documents serve as the primary reference for developing the Auto Shorts Web App. 

Here is a link to a google doc with more of the questions from me and clourd 3.7 sonnet thinkings responses 

https://docs.google.com/document/d/1rW49X6OtrpivQaOtDGTMMLGTiPHLH8EFBNns3ElzHwQ/edit?tab=t.0#heading=h.jehr891995sf
