# Auto Shorts Web App - Makefile
# This Makefile provides shortcuts for common development tasks

# Use bash as the shell for command execution
SHELL := /bin/bash

# Default environment variables
ENV ?= dev
DOCKER_COMPOSE = docker-compose

# Styling for console output
BOLD := $(shell tput bold)
RESET := $(shell tput sgr0)
GREEN := $(shell tput setaf 2)
YELLOW := $(shell tput setaf 3)
BLUE := $(shell tput setaf 4)
RED := $(shell tput setaf 1)

# Helper functions
define log
	@echo "$(BOLD)$(BLUE)>>> $(1)$(RESET)"
endef

define success
	@echo "$(BOLD)$(GREEN)✓ $(1)$(RESET)"
endef

define warn
	@echo "$(BOLD)$(YELLOW)⚠ $(1)$(RESET)"
endef

define error
	@echo "$(BOLD)$(RED)✗ $(1)$(RESET)"
endef

.PHONY: help
help: ## Show this help message
	@echo "$(BOLD)Auto Shorts Web App - Development Commands$(RESET)"
	@echo ""
	@echo "$(BOLD)Usage:$(RESET)"
	@echo "  make [command]"
	@echo ""
	@echo "$(BOLD)Available commands:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(RESET) %s\n", $$1, $$2}'

# Docker commands
.PHONY: up
up: ## Start all Docker containers
	$(call log,Starting Docker containers...)
	@$(DOCKER_COMPOSE) up -d
	$(call success,Docker containers started. Frontend: http://localhost:3000, Backend: http://localhost:8000)

.PHONY: up-build
up-build: ## Start all Docker containers with a rebuild
	$(call log,Building and starting Docker containers...)
	@$(DOCKER_COMPOSE) up -d --build
	$(call success,Docker containers built and started)

.PHONY: down
down: ## Stop all Docker containers
	$(call log,Stopping Docker containers...)
	@$(DOCKER_COMPOSE) down
	$(call success,Docker containers stopped)

.PHONY: restart
restart: down up ## Restart all Docker containers

.PHONY: logs
logs: ## View Docker container logs
	@$(DOCKER_COMPOSE) logs -f

.PHONY: logs-frontend
logs-frontend: ## View frontend container logs
	@$(DOCKER_COMPOSE) logs -f frontend

.PHONY: logs-backend
logs-backend: ## View backend container logs
	@$(DOCKER_COMPOSE) logs -f backend

# Development commands
.PHONY: install
install: ## Install all dependencies
	$(call log,Installing frontend dependencies...)
	@cd web/frontend && npm install
	$(call success,Frontend dependencies installed)
	
	$(call log,Installing backend dependencies...)
	@cd web/backend && pip install -r requirements.txt
	$(call success,Backend dependencies installed)
	
	$(call log,Installing pre-commit hooks...)
	@pip install pre-commit
	@pre-commit install
	$(call success,Pre-commit hooks installed)

.PHONY: frontend
frontend: ## Start the frontend development server
	$(call log,Starting frontend server...)
	@cd web/frontend && npm run dev

.PHONY: backend
backend: ## Start the backend development server
	$(call log,Starting backend server...)
	@cd web/backend && python -m uvicorn app.main:app --reload --port 8001

.PHONY: browser-tools
browser-tools: ## Start the browser tools server
	$(call log,Starting browser tools server...)
	@npx browser-tools-server

# Testing commands
.PHONY: test
test: ## Run all tests
	$(call log,Running Playwright tests...)
	@cd web/frontend && npm test

.PHONY: test-debug
test-debug: ## Run tests in debug mode
	$(call log,Running Playwright tests in debug mode...)
	@cd web/frontend && PWDEBUG=1 npm run test:debug

.PHONY: test-report
test-report: ## Show the last test report
	$(call log,Opening test report...)
	@cd web/frontend && npx playwright show-report

# Code quality commands
.PHONY: format
format: ## Format all code
	$(call log,Running formatter on all code...)
	@./format_codebase.sh

.PHONY: lint
lint: ## Lint frontend and backend code
	$(call log,Linting frontend code...)
	@cd web/frontend && npm run lint
	
	$(call log,Linting backend code...)
	@cd web/backend && isort . --check && black . --check && flake8 .

.PHONY: lint-fix
lint-fix: ## Fix linting issues where possible
	$(call log,Fixing linting issues in frontend code...)
	@cd web/frontend && npm run lint:fix
	
	$(call log,Fixing formatting issues in backend code...)
	@cd web/backend && isort . && black .

# Build commands
.PHONY: build-frontend
build-frontend: ## Build the frontend for production
	$(call log,Building frontend for production...)
	@cd web/frontend && npm run build
	$(call success,Frontend built successfully)

.PHONY: build-backend
build-backend: ## Check backend build
	$(call log,Verifying backend build...)
	@cd web/backend && python -c "import app.main"
	$(call success,Backend imports verified successfully)

.PHONY: build
build: build-frontend build-backend ## Build the entire application

# Utility commands
.PHONY: clean
clean: ## Clean up temporary files and caches
	$(call log,Cleaning up temporary files and caches...)
	@find . -type d -name __pycache__ -exec rm -rf {} +
	@find . -type d -name .pytest_cache -exec rm -rf {} +
	@find . -type d -name node_modules -prune -o -name "*.pyc" -exec rm -f {} \;
	@find . -type d -name node_modules -prune -o -name "*.pyo" -exec rm -f {} \;
	@rm -rf web/frontend/.next
	@rm -rf web/frontend/out
	$(call success,Temporary files and caches cleaned up)

.PHONY: env-setup
env-setup: ## Set up environment files from examples
	$(call log,Setting up environment files...)
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		$(call success,Created .env from .env.example); \
	else \
		$(call warn,.env already exists. Skipping.); \
	fi
	@if [ ! -f web/frontend/.env.local ]; then \
		echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > web/frontend/.env.local; \
		$(call success,Created web/frontend/.env.local); \
	else \
		$(call warn,web/frontend/.env.local already exists. Skipping.); \
	fi

.PHONY: check-env
check-env: ## Check environment configuration
	$(call log,Checking environment configuration...)
	@cd web/backend && python -c "from app.core.env_validator import validate_environment; validate_environment()" || ($(call error,Backend environment check failed) && exit 1)
	@cd web/frontend && node -e "require('./src/lib/env-validator').validateEnvironment()" || ($(call error,Frontend environment check failed) && exit 1)
	$(call success,Environment configuration is valid)

.PHONY: reset-db
reset-db: ## Reset the development database
	$(call log,Resetting development database...)
	@mongo auto-shorts --eval "db.dropDatabase()" || ($(call warn,Failed to connect to local MongoDB. Is MongoDB running?))
	$(call success,Development database reset)

# Project setup shortcuts
.PHONY: dev-setup
dev-setup: env-setup install ## Complete development environment setup
	$(call success,Development environment setup complete!)
	@echo ""
	@echo "$(BOLD)Next steps:$(RESET)"
	@echo "1. Edit $(BOLD).env$(RESET) with your configuration"
	@echo "2. Start the application with $(BOLD)make up$(RESET) or run services individually"
	@echo "3. Run tests with $(BOLD)make test$(RESET)"

.PHONY: start-all
start-all: ## Start all services without Docker
	$(call log,Starting all services without Docker...)
	@(cd web/backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &)
	@(cd web/frontend && npm run dev &)
	@(npx browser-tools-server &)
	$(call success,All services started. Use 'fg' to bring processes to foreground or Ctrl+C to stop all)

# Default target
.DEFAULT_GOAL := help 