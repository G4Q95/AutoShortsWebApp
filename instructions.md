# Auto Shorts Web App - Development Instructions

This document provides instructions for setting up and developing the Auto Shorts Web App.

## Prerequisites

- Node.js (v16+)
- Python 3.9+
- MongoDB (optional, app uses mock DB if unavailable)
- Git

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Auto\ Shorts\ Web\ App
```

### 2. Backend Setup

```bash
cd web/backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create a .env file
cp .env.example .env
```

Edit the `.env` file to include your configuration:
```
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=autoshorts
OPENAI_API_KEY=your_openai_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here
```

### 3. Frontend Setup

```bash
cd web/frontend

# Install dependencies
npm install

# Create a .env.local file
cp .env.example .env.local
```

Edit the `.env.local` file:
```
NEXT_PUBLIC_API_URL=http://localhost:8002
```

## Running the Application

### Running the Backend

```bash
cd web/backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

### Running the Frontend

```bash
cd web/frontend
npm run dev
```

The frontend will be available at http://localhost:3000

## Development Workflow

1. Make changes to the code
2. Test your changes locally
3. Create a pull request for review
4. Once approved, merge to main

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /api/v1/health` - API version health check

### Projects
- `POST /api/v1/projects/` - Create a new project
- `GET /api/v1/projects/` - Get all projects
- `GET /api/v1/projects/{project_id}` - Get a specific project
- `GET /api/v1/projects/raw` - Get raw project data (includes all fields)
- `PUT /api/v1/projects/{project_id}` - Update a project
- `DELETE /api/v1/projects/{project_id}` - Delete a project

### Content
- `GET /api/v1/content/extract?url={url}` - Extract content from a URL (e.g., Reddit)

## Known Issues and Workarounds

### MongoDB Connection Issues
If MongoDB is not running, the application will fall back to a mock database. To use a real MongoDB:

```bash
# Install MongoDB (macOS)
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### Field Mapping Issues
There are currently field mapping issues between MongoDB documents and Pydantic models. 
The `/api/v1/projects/raw` endpoint can be used to view the raw data without validation errors.

## Testing

To test the backend:
```bash
cd web/backend
pytest
```

To test the frontend:
```bash
cd web/frontend
npm test
``` 