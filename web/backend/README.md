# Auto Shorts API Backend

This is the backend API for the Auto Shorts application, built with FastAPI and MongoDB.

## Features

- MongoDB Atlas integration for persistent data storage
- RESTful API for project management
- Media content extraction from Reddit and other sources
- Video generation pipeline

## Setup

1. **Environment Setup**

   Create a virtual environment and install dependencies:

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Environment Variables**

   Copy the example env file and update with your configuration:

   ```bash
   cp .env.example .env
   ```

   Edit the `.env` file and add your MongoDB connection string and other configuration values.

3. **MongoDB Connection**

   The application uses MongoDB Atlas as the database. You need to:
   
   - Create a MongoDB Atlas account
   - Create a cluster
   - Create a database user
   - Get your connection string
   - Add it to the `.env` file as `MONGODB_URI`

4. **Run the Development Server**

   ```bash
   python run_api.py
   ```

   Or with uvicorn directly:

   ```bash
   uvicorn app.main:app --reload
   ```

5. **API Documentation**

   When the server is running, you can access the automatic API documentation at:

   - Swagger UI: http://127.0.0.1:8001/docs
   - ReDoc: http://127.0.0.1:8001/redoc

## Project Structure

```
web/backend/
├── app/
│   ├── api/              # API endpoints
│   ├── core/             # Core functionality (config, database)
│   ├── models/           # Pydantic models
│   └── services/         # Business logic services
├── venv/                 # Virtual environment (not in git)
├── .env                  # Environment variables (not in git)
├── .env.example          # Example environment variables
├── requirements.txt      # Python dependencies
└── run_api.py            # Script to run the API server
```

## API Endpoints

- `GET /api/v1/health` - Check API health
- `GET /api/v1/projects/` - List all projects
- `POST /api/v1/projects/` - Create a new project
- `GET /api/v1/projects/{id}` - Get project details
- `PUT /api/v1/projects/{id}` - Update a project
- `DELETE /api/v1/projects/{id}` - Delete a project
- `GET /api/v1/content/extract` - Extract content from a URL

## MongoDB Data Models

### Project

Main collection for storing project data:

```javascript
{
  "_id": ObjectId,
  "title": String,
  "description": String,
  "user_id": String,
  "scenes": [
    {
      "url": String,
      "title": String,
      "text_content": String,
      "media_url": String,
      "media_type": String,
      "author": String
    }
  ],
  "created_at": Date,
  "updated_at": Date
}
```

## Development Notes

- The API uses FastAPI's built-in validation system via Pydantic models
- ObjectId serialization is handled in the custom MongoJSONResponse class
- Database connections are managed by the Database class in `app/core/database.py` 