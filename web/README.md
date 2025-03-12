# Auto Shorts Web Application

This directory contains the web application components for Auto Shorts, a service that allows users to convert social media content into engaging short-form videos.

## Project Structure

```
web/
├── frontend/              # Next.js application
│   ├── public/            # Static assets
│   ├── src/               # React components, pages, etc.
│   └── package.json       # Frontend dependencies
│
├── backend/               # FastAPI application
│   ├── app/               # API code
│   │   ├── core/          # Core functionality
│   │   ├── api/           # API routes
│   │   ├── services/      # Business logic
│   │   └── models/        # Data models
│   │
│   ├── requirements.txt   # Backend dependencies
│   └── Dockerfile         # For containerization
```

## Frontend (Next.js)

The frontend is built with Next.js, React, and Tailwind CSS.

### Development

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## Backend (FastAPI)

The backend is built with FastAPI and Python.

### Development

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend API will be available at `http://localhost:8000`.

API documentation will be available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API Documentation

Comprehensive API documentation is available in the following files:

- [API Standards](../docs/API_STANDARDS.md) - Detailed documentation of API response formats, error handling patterns, and standardized conventions
- [API Endpoints](../docs/API_ENDPOINTS.md) - Comprehensive documentation of all available API endpoints with request/response examples

The API follows standardized response formats for both success and error cases, with consistent error codes and status codes.

## Environment Variables

Copy the `.env.example` file to `.env` in both the frontend and backend directories and fill in the required values.

## Docker Development Environment

The project uses Docker to create a consistent development environment:

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f
```

The Docker environment includes:
- Frontend container (Next.js)
- Backend container (FastAPI)
- Browser-tools container (for E2E testing)

## Testing

End-to-end tests are implemented using Playwright:

```bash
# Run tests
cd frontend && npm test

# Run tests with debugging
cd frontend && npm run test:debug
```

All tests require the following services to be running:
- Frontend server
- Backend server
- Browser-tools server

## Deployment

- Frontend: Deployed on Vercel
- Backend: Deployed on Google Cloud Run 