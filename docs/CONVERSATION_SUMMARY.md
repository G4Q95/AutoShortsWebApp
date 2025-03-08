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

## Reference Documents

The following documents were created to capture the detailed plans:

1. **PROJECT_OVERVIEW.md**: High-level summary of the application concept, business model, and technical decisions
2. **PROJECT_INSTRUCTIONS.md**: Detailed implementation guide with file structure, development steps, and key notes

These documents serve as the primary reference for developing the Auto Shorts Web App. 