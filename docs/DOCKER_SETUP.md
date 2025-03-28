# Docker Setup Guide for Auto Shorts Web App

This document provides a comprehensive guide for setting up and working with Docker in the Auto Shorts Web App project, including the Wrangler integration for Cloudflare R2 management.

## Docker Environment Overview

The Auto Shorts Web App uses Docker to create consistent development and production environments with the following services:

1. **Frontend**: Next.js React application (port 3000)
2. **Backend**: FastAPI Python application (port 8000)
3. **Browser Tools**: Browser automation tools for testing (port 3025)

## Prerequisites

- Docker and Docker Compose installed
- Cloudflare R2 account and credentials
- Node.js and npm (for local development outside containers)

## Docker Files Overview

- `docker-compose.yml` - Main configuration file for all services
- `web/frontend/Dockerfile` - Frontend container configuration
- `web/backend/Dockerfile` - Backend container configuration with Wrangler support

## Environment Variables

### Required Variables

Create a `.env` file at the project root with the following variables:

```
# Cloudflare credentials
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
```

### Pre-configured Variables

The following environment variables are already configured in the docker-compose.yml file:

- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `R2_BUCKET_NAME` - The R2 bucket name for media storage
- Connection details for MongoDB Atlas
- AWS-compatible credentials for R2 access using the S3 API

## Starting the Environment

```bash
# Build all containers
docker-compose build

# Start all services
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f
```

## Wrangler Integration

### Why Wrangler in Docker?

The backend Docker container now includes Wrangler CLI for native Cloudflare R2 management. This provides:

1. More consistent file operations across environments
2. Native support for all Cloudflare R2 features
3. Integration with the application for automated cleanup processes

### How Wrangler is Integrated

The backend Dockerfile:
1. Installs Node.js as a prerequisite
2. Installs Wrangler CLI globally
3. Configures environment variables for Cloudflare authentication

### Authentication

Wrangler in the container uses these environment variables for authentication:
- `CLOUDFLARE_ACCOUNT_ID` - Pre-configured in docker-compose.yml
- `CLOUDFLARE_API_TOKEN` - Must be provided in your local `.env` file

### Testing Wrangler in the Container

```bash
# Verify Wrangler installation
docker-compose exec backend wrangler --version

# Check authentication status
docker-compose exec backend wrangler whoami

# List R2 buckets
docker-compose exec backend wrangler r2 bucket list --remote
```

## Common Docker Operations

### Rebuilding After Dockerfile Changes

```bash
# Rebuild a specific service
docker-compose build backend

# Rebuild without using cache
docker-compose build --no-cache backend

# Rebuild all services
docker-compose build
```

### Container Management

```bash
# Stop all containers
docker-compose down

# Start specific service
docker-compose up frontend

# View running containers
docker-compose ps

# View container logs
docker-compose logs backend
```

### Executing Commands in Containers

```bash
# Run a shell in the backend container
docker-compose exec backend bash

# Run a Python command in the backend container
docker-compose exec backend python -c "print('Hello from container')"

# Run npm commands in the frontend container
docker-compose exec frontend npm install some-package
```

## Troubleshooting

### Wrangler Authentication Issues

If you encounter authentication issues with Wrangler:

1. Check if your `CLOUDFLARE_API_TOKEN` is correctly set in the `.env` file
2. Verify the token has the appropriate permissions for R2
3. Run the authentication check: `docker-compose exec backend wrangler whoami`
4. Check logs for any authentication errors

### Container Fails to Start

1. Check Docker logs: `docker-compose logs [service name]`
2. Verify all environment variables are correctly set
3. Try rebuilding the container: `docker-compose build --no-cache [service name]`
4. Check for port conflicts with other applications

### File Permissions

If you encounter file permission issues with volume mounts:

1. Check ownership of files on the host machine
2. Consider setting appropriate user in the Dockerfile
3. Temporarily change permissions: `chmod -R 777 ./web/backend` (not recommended for production)

## Best Practices

1. Never hardcode credentials in Dockerfiles or docker-compose.yml
2. Use environment variables from `.env` file for sensitive information
3. Keep Docker images small by cleaning up after installations
4. Run containers with least privilege necessary
5. Regularly update base images for security
6. Include version pinning for dependencies

## Updating Docker Configuration

When updating Docker configuration:

1. Document changes in this guide
2. Test changes locally before committing
3. Update the docker-compose.yml file and related Dockerfiles
4. Inform team members of significant changes

## References

- [Docker Documentation](https://docs.docker.com/)
- [Cloudflare Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [FastAPI in Containers](https://fastapi.tiangolo.com/deployment/docker/)
- [Next.js with Docker](https://nextjs.org/docs/deployment#docker-image) 