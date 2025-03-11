import asyncio
import logging
import json
from datetime import datetime
from bson import ObjectId
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import db, MongoJSONEncoder

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create a TestClient for our FastAPI app
client = TestClient(app)

class JSONEncoder(MongoJSONEncoder):
    pass

async def setup_database():
    """Set up the database connection and create test data"""
    await db.connect()
    logger.info(f"Database connected. Mock mode: {db.is_mock}")
    
    if not db.is_mock:
        # Create a test project
        mongo_db = db.get_db()
        
        # Check if test project already exists
        existing = await mongo_db.projects.find_one({"title": "API Test Project"})
        if existing:
            logger.info(f"Test project already exists with ID: {existing['_id']}")
            return str(existing["_id"])
        
        test_project = {
            "title": "API Test Project",
            "description": "Created to verify API functionality",
            "user_id": None,
            "scenes": [
                {
                    "url": "https://www.example.com/api-test",
                    "title": "API Test Scene",
                    "text_content": "This is a test scene for API testing",
                    "media_url": None,
                    "media_type": None,
                    "author": "api_test_script"
                }
            ],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await mongo_db.projects.insert_one(test_project)
        project_id = result.inserted_id
        logger.info(f"Created test project with ID: {project_id}")
        return str(project_id)
    
    return None

async def cleanup_database(project_id=None):
    """Clean up test data and close database connection"""
    if not db.is_mock and project_id:
        mongo_db = db.get_db()
        # Only delete if it's our test project
        result = await mongo_db.projects.delete_one({
            "_id": ObjectId(project_id),
            "title": "API Test Project"
        })
        if result.deleted_count:
            logger.info(f"Deleted test project with ID: {project_id}")
    
    await db.close()
    logger.info("Database connection closed")

def test_health_endpoint():
    """Test the health endpoint"""
    logger.info("Testing health endpoint...")
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "available"
    logger.info("Health endpoint test passed")
    return data

def test_get_projects():
    """Test the get projects endpoint"""
    logger.info("Testing get projects endpoint...")
    response = client.get("/api/v1/projects/")
    assert response.status_code == 200
    projects = response.json()
    assert isinstance(projects, list)
    logger.info(f"Found {len(projects)} projects")
    return projects

def test_get_project(project_id):
    """Test getting a specific project"""
    logger.info(f"Testing get project endpoint for ID: {project_id}...")
    response = client.get(f"/api/v1/projects/{project_id}")
    assert response.status_code == 200
    project = response.json()
    assert project["id"] == project_id
    logger.info(f"Successfully retrieved project: {project['title']}")
    return project

def test_create_project():
    """Test creating a new project"""
    logger.info("Testing create project endpoint...")
    new_project = {
        "title": "New Test Project",
        "description": "Created via API test",
        "scenes": []
    }
    response = client.post("/api/v1/projects/", json=new_project)
    assert response.status_code == 201
    created = response.json()
    assert created["title"] == new_project["title"]
    logger.info(f"Successfully created project with ID: {created['id']}")
    return created

async def run_tests():
    """Run all the API tests"""
    project_id = await setup_database()
    
    try:
        print("\n========== API Test Results ==========\n")
        
        # Test health endpoint
        health_data = test_health_endpoint()
        print(f"Health Check: {json.dumps(health_data, indent=2)}\n")
        
        # Test get projects
        projects = test_get_projects()
        print(f"Projects Count: {len(projects)}\n")
        if projects:
            print(f"First Project: {json.dumps(projects[0], indent=2)}\n")
        
        # Test get specific project
        if project_id:
            project = test_get_project(project_id)
            print(f"Specific Project: {json.dumps(project, indent=2)}\n")
        
        # Test create project
        new_project = test_create_project()
        print(f"Created Project: {json.dumps(new_project, indent=2)}\n")
        
        print("All tests passed successfully! ✅")
    except Exception as e:
        logger.error(f"Error during tests: {e}")
        print(f"Tests failed: {e} ❌")
    finally:
        await cleanup_database(project_id)

if __name__ == "__main__":
    asyncio.run(run_tests()) 