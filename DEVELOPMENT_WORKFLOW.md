# Auto Shorts Web App - Development Workflow

This document outlines the development workflow for the Auto Shorts Web App project. It provides guidelines for feature development, bug fixing, code quality maintenance, and release management.

## Feature Development Process

### 1. Planning & Requirements

1. **Understand Requirements**
   - Clarify the feature purpose and expected behavior
   - Identify acceptance criteria
   - Consider edge cases and error scenarios

2. **Task Breakdown**
   - Break down complex features into smaller, manageable tasks
   - Estimate time for each task
   - Document API requirements or UI changes needed

3. **Technical Planning**
   - Decide on implementation approach
   - Identify potential challenges
   - Consider security, performance, and accessibility implications

### 2. Implementation

1. **Setup**
   - Ensure your local environment is up-to-date
   - Start Docker containers with `docker-compose up`
   - Create a feature branch if needed

2. **Development Cycle**
   - Implement one task at a time
   - Follow the coding standards in `.cursorrules`
   - Add tests for new functionality
   - Document your code
   - Commit frequently with meaningful messages

3. **Self-Review & Testing**
   - Review your own code for quality issues
   - Test your changes locally
   - Run relevant tests
   - Fix any issues found

### 3. Code Review & Refinement

1. **Peer Review**
   - Have another developer review your code
   - Address feedback from reviews
   - Make necessary improvements

2. **Quality Assurance**
   - Run all tests
   - Check for console errors
   - Verify visual appearance
   - Test on different screen sizes
   - Ensure accessibility

3. **Documentation Update**
   - Update `progress.md` with completed tasks
   - Add or update JSDoc comments
   - Update API documentation if relevant
   - Add user documentation if needed

### 4. Integration & Deployment

1. **Merge to Main**
   - Resolve any merge conflicts
   - Ensure tests pass after merging
   - Follow the commit message conventions

2. **Deployment**
   - Deploy to development environment
   - Verify functionality in deployed environment
   - Monitor for issues after deployment

## Bug Fix Process

1. **Bug Report & Analysis**
   - Understand the issue and how to reproduce it
   - Identify the root cause
   - Determine severity and priority

2. **Implementation**
   - Create a fix with minimal changes
   - Add tests to prevent regression
   - Document the fix and its implications

3. **Verification**
   - Verify the bug is fixed
   - Ensure no new issues are introduced
   - Get sign-off from the reporter

## Refactoring Process

1. **Identifying Technical Debt**
   - Review code regularly for improvement opportunities
   - Look for code smells, duplication, or complex logic
   - Prioritize areas that impact development speed or quality

2. **Refactoring Approach**
   - Make small, incremental changes
   - Maintain existing functionality
   - Add or update tests
   - Document improvements

3. **Verification**
   - Ensure all tests pass
   - Verify functionality is unchanged
   - Review performance impact
   - Get peer review for significant changes

## Code Quality Maintenance Practices

1. **Regular Review Sessions**
   - Schedule bi-weekly code review sessions
   - Focus on different areas of the codebase each time
   - Document patterns and anti-patterns found

2. **Testing Strategy**
   - Unit tests for utility functions and isolated components
   - Integration tests for API endpoints and data flow
   - E2E tests for user workflows
   - All code should have appropriate test coverage

3. **Performance Monitoring**
   - Review application performance regularly
   - Address performance bottlenecks
   - Optimize rendering and data fetching
   - Monitor network request timing

4. **Documentation Maintenance**
   - Keep documentation up-to-date
   - Document complex logic and business rules
   - Maintain clear API documentation
   - Update setup instructions when dependencies change

5. **Code Formatting and Linting**
   - All code must follow the project's formatting and linting rules
   - Use the provided tools to auto-format code before committing
   - Run `./format_codebase.sh` to format the entire codebase
   - Consider setting up pre-commit hooks with `pre-commit install`
   - Refer to `docs/CODE_QUALITY.md` for detailed guidelines
   - VS Code users should install recommended extensions and settings
   - Never commit code that doesn't pass linting checks
   - Address formatting issues before code reviews

6. **API Documentation Maintenance**
   - Document all API changes in Swagger UI using FastAPI decorators
   - Include detailed descriptions for all endpoints, parameters, and responses
   - Add request and response examples for every endpoint
   - Organize endpoints with appropriate tags
   - Test documentation by using the Swagger UI interactive interface
   - Update documentation before submitting code for review
   - Follow standards in `docs/API_DOCUMENTATION_GUIDE.md`
   - Ensure all error responses are documented
   - Use proper status codes and consistent response formats
   - Validate that OpenAPI schema generation works correctly

## Release Management

1. **Release Planning**
   - Determine feature set for the release
   - Ensure all features are complete and tested
   - Run full test suite

2. **Release Process**
   - Create release branch
   - Update version numbers
   - Create release notes
   - Deploy to staging environment
   - Perform final testing
   - Deploy to production

3. **Post-Release Activities**
   - Monitor for issues
   - Address any critical bugs
   - Document any issues for future improvements
   - Schedule retrospective meeting

## Tools & Environment

1. **Development Environment**
   - Docker for containerization
   - Local environment setup as documented in PROJECT_INSTRUCTIONS.md
   - Browser Tools server for frontend testing
   - MongoDB for data storage
   - Visual Studio Code (or preferred IDE) with recommended extensions

2. **Testing Tools**
   - Playwright for E2E testing
   - Jest for unit testing
   - Manual testing checklist

3. **Continuous Integration**
   - Run tests automatically on push
   - Check code quality with linters
   - Verify build passes before merge

4. **Makefile Commands**
   - Use `make` commands for consistent workflow across the team
   - Common commands:
     - `make up` / `make down` - Start/stop Docker containers
     - `make test` - Run all tests
     - `make format` / `make lint` - Code quality checks
     - `make dev-setup` - Set up development environment
   - Always check `make help` for the full list of commands
   - See [docs/MAKEFILE_GUIDE.md](docs/MAKEFILE_GUIDE.md) for detailed usage

## GitHub Actions CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment, automating testing, building, and validation processes.

### Pipeline Components

1. **Test Workflow**
   - Runs Playwright E2E tests
   - Sets up MongoDB service container
   - Starts backend and browser tools servers
   - Executes all frontend tests
   - Uploads test artifacts for debugging

2. **Build Verification**
   - Ensures frontend builds successfully
   - Verifies backend imports work correctly
   - Catches build-time errors early

3. **Environment Validation**
   - Checks that required environment variables are defined
   - Validates environment variable configuration
   - Ensures .env.example contains necessary variables

4. **Docker Validation**
   - Verifies Docker Compose configuration
   - Checks Dockerfile existence
   - Tests container builds

5. **Linting and Formatting** (separate workflow)
   - Runs ESLint and Prettier on frontend code
   - Runs isort, black, and flake8 on backend code
   - Ensures code style consistency

### Working with the CI/CD Pipeline

1. **Viewing Results**
   - Check the Actions tab in GitHub after pushing changes
   - Review failed steps to identify issues
   - Download artifacts for detailed test reports

2. **Troubleshooting Failures**
   - Test failures: Check test artifacts for screenshots and logs
   - Build failures: Review build logs for errors
   - Environment validation failures: Verify environment variable configuration
   - Docker failures: Check Docker configuration files

3. **Local Verification**
   - Run tests locally before pushing: `cd web/frontend && npm test`
   - Check linting: `cd web/frontend && npm run lint`
   - Verify build: `cd web/frontend && npm run build`

4. **Best Practices**
   - Always check CI results after pushing
   - Fix CI failures promptly
   - Don't merge code with failing CI checks
   - Add tests for new features and bug fixes

## Troubleshooting Common Issues

1. **Docker Issues**
   - If containers fail to start, check port conflicts
   - For volume mount issues, verify permissions
   - Check logs with `docker-compose logs`

2. **Frontend Issues**
   - Check browser console for errors
   - Verify network requests and responses
   - Check state management using React DevTools

3. **Backend Issues**
   - Check server logs
   - Verify environment variables
   - Test endpoints with API client

## Continuous Improvement

1. **Regular Retrospectives**
   - Review development process
   - Identify areas for improvement
   - Implement process changes
   - Document lessons learned

2. **Skills Development**
   - Share knowledge with team members
   - Learn new technologies and patterns
   - Apply best practices from industry

---

By following this development workflow, we can maintain high code quality, efficient development processes, and a reliable application. Adjust these guidelines as the project evolves and new needs emerge. 