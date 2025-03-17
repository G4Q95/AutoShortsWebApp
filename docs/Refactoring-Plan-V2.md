# Auto Shorts Web App - Refactoring Plan V2

## Overview
This document outlines our revised approach to refactoring the Auto Shorts Web App codebase, with a particular focus on careful and incremental API changes. After encountering issues with our previous refactoring attempt, we're implementing a more methodical strategy to ensure stability throughout the process.

## Goals
- Improve code organization and maintainability
- Reduce complexity in large files
- Eliminate redundant code
- Maintain test coverage
- Ensure zero downtime during refactoring
- Preserve all existing functionality

## API Refactoring Strategy

### Phase 1: Analysis and Documentation (No Code Changes)
1. **API Function Inventory**
   - Document all functions in api-client.ts
   - Map dependencies between functions
   - Identify function groups by domain
   - Note test coverage for each function

2. **Usage Analysis**
   - Track where each API function is used
   - Document component dependencies
   - Map data flow through the application
   - Identify critical vs. non-critical functions

3. **Test Coverage Assessment**
   - Review existing test coverage
   - Identify gaps in testing
   - Plan additional test cases needed
   - Document test dependencies

### Phase 2: Test Enhancement (No API Changes)
1. **Strengthen Test Suite**
   - Add missing test cases
   - Improve test isolation
   - Add specific tests for error conditions
   - Document test patterns and expectations

2. **Test Utilities**
   - Create helper functions for common test operations
   - Implement better test data management
   - Add detailed test logging
   - Create test documentation

### Phase 3: Incremental API Refactoring
1. **Individual Function Migration**
   - Start with lowest-risk, well-tested functions
   - One function at a time approach
   - Maintain old and new implementations in parallel
   - Use feature flags for gradual transition

2. **Testing Protocol for Each Function**
   - Run full test suite before changes
   - Create new implementation
   - Test new implementation thoroughly
   - Run full test suite again
   - Manual verification of affected components
   - Revert immediately if any issues

3. **Documentation Updates**
   - Update API documentation
   - Note any interface changes
   - Document migration status
   - Update test documentation

### Phase 4: Module Organization
1. **Create Domain-Specific Modules**
   - voice.ts - Voice generation functionality
   - projects.ts - Project management
   - content.ts - Content extraction
   - user.ts - User management
   - core.ts - Base API functionality

2. **Gradual Migration Process**
   - Create new module files
   - Move tested and verified functions
   - Update imports one component at a time
   - Maintain backwards compatibility
   - Remove old code only after thorough testing

## Testing Strategy

### Before Each Change
- Run full test suite
- Document current state
- Verify all features working
- Check console for errors
- Review network requests

### During Implementation
- Test each function individually
- Run relevant component tests
- Check for console errors
- Verify network requests
- Manual testing of affected features

### After Each Change
- Run full test suite
- Verify all features still work
- Check for new console errors
- Review network activity
- Document any issues found

## Risk Mitigation

### Feature Flags
- Implement feature flags for new API modules
- Allow quick rollback if issues arise
- Test both implementations in parallel
- Gradual transition to new code

### Backup Strategy
- Maintain backup of original api-client.ts
- Document all changes in detail
- Keep revert instructions ready
- Regular commits with clear messages

### Monitoring
- Watch for console errors
- Monitor network requests
- Track test results
- Document any issues

## Progress Tracking

### Completed Tasks
- ✅ Initial refactoring attempt and reversion
- ✅ Created revised refactoring plan
- ✅ Identified need for more careful approach
- ✅ Successfully reverted problematic API changes
- ✅ Verified all tests passing after reversion
- ✅ Updated documentation with new refactoring strategy

### Current Focus
- 🔄 Creating API function inventory
- 🔄 Analyzing test coverage
- 🔄 Planning incremental changes
- 🔄 Setting up monitoring for API changes

### Next Steps
1. Complete API function inventory
   - Document all functions in api-client.ts
   - Map dependencies between functions
   - Note test coverage for each function
2. Create test enhancement plan
   - Identify gaps in test coverage
   - Plan new test cases needed
   - Document test dependencies
3. Begin single-function migrations
   - Start with lowest-risk functions
   - Implement feature flags
   - Maintain parallel implementations

## Implementation Notes

### API Function Migration Template
For each function to be migrated:

1. **Documentation Phase**
   ```typescript
   // Document current implementation
   // List all dependencies
   // Note test coverage
   // Identify usage locations
   ```

2. **Test Enhancement Phase**
   ```typescript
   // Add specific test cases
   // Verify error handling
   // Test edge cases
   // Document test patterns
   ```

3. **Implementation Phase**
   ```typescript
   // Create new implementation
   // Maintain identical interface
   // Add comprehensive error handling
   // Include detailed comments
   ```

4. **Verification Phase**
   ```typescript
   // Run all tests
   // Manual verification
   // Check console errors
   // Verify network requests
   ```

## Rollback Plan

If issues are encountered:

1. **Immediate Actions**
   - Revert the specific function change
   - Run full test suite
   - Document the issue
   - Update the refactoring plan

2. **Analysis**
   - Review what went wrong
   - Update test cases
   - Modify approach if needed
   - Document lessons learned

## Success Criteria

For each migrated function:
- All tests passing
- No new console errors
- Identical functionality
- Clean network requests
- No performance regression
- Proper error handling
- Updated documentation

## Timeline

- Week 1: Analysis and Documentation
- Week 2: Test Enhancement
- Weeks 3-4: Individual Function Migration
- Week 5: Module Organization
- Week 6: Final Testing and Cleanup

## Daily Workflow

1. **Morning**
   - Review previous day's changes
   - Run full test suite
   - Plan day's migrations
   - Update documentation

2. **During Development**
   - Follow function migration template
   - Regular test runs
   - Frequent commits
   - Document all changes

3. **End of Day**
   - Final test suite run
   - Update progress tracking
   - Plan next day's tasks
   - Backup all changes

## Communication

- Daily updates on progress
- Immediate notification of issues
- Regular review of approach
- Documentation of all decisions

Last Updated: April 5, 2025 

## Testing Non-Negotiables

The following rules are NEVER to be broken during refactoring. These are non-negotiable requirements to ensure stability:

### Critical Testing Rules

1. **NEVER Skip Full Test Suite**
   - The COMPLETE test suite MUST be run after ANY significant change
   - "Significant change" includes ANY modification to:
     - API calls or interfaces
     - State management
     - Component props
     - Data flow between components
   - No exceptions, regardless of how small the change seems

2. **NEVER Assume API Compatibility**
   - Before using any new API module, explicitly verify:
     - HTTP method (GET vs POST) 
     - URL structure (path parameters vs query parameters)
     - Request body format (JSON structure)
     - Response structure
     - Error handling patterns
   - Document differences in implementation for each function

3. **ONE Function at a Time**
   - Migrate and test ONE function at a time
   - Never batch multiple function changes, even in the same file
   - After changing a function call, run ALL tests that could be affected

4. **Immediate Verification Required**
   - Verify the application works correctly after EACH change
   - Check all affected functionality manually, no exceptions
   - Take screenshots before and after changes for visual comparison

5. **Zero Tolerance for Test Failures**
   - ANY test failure requires IMMEDIATE rollback
   - No proceeding with new changes until ALL tests pass
   - Failed tests are top priority and block all other work

6. **Manual Testing Checklist**
   - After API changes, a manual test checklist MUST be completed:
     - Project creation
     - Project loading
     - Project deletion
     - Scene addition
     - Scene deletion
     - Scene reordering
     - Audio generation
     - Audio playback
     - Navigation between pages

7. **Refactoring Session Protocol**
   - Start each refactoring session with a full test run
   - End each refactoring session with a full test run
   - Document the exact state of the application after session
   - Leave detailed notes for ongoing refactoring work

### Testing Command Requirements

Use these exact commands for testing:

```bash
# REQUIRED: Run full test suite after ANY change
cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npm test

# For specific test areas when appropriate:
cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npx playwright test tests/e2e/project-management.spec.ts
cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npx playwright test tests/e2e/home-page.spec.ts
cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npx playwright test tests/e2e/audio-generation.spec.ts
cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npx playwright test tests/e2e/scene-operations.spec.ts
```

### Emergency Rollback Protocol

If any test fails during refactoring:

1. **Immediate Rollback**
   - Revert the most recent change immediately
   - Run full test suite to verify stability is restored

2. **Investigation**
   - Document exactly what failed and how
   - Compare implementations in detail
   - Create a specific test case for the failing scenario

3. **Test-Driven Fix**
   - Create a targeted test that fails due to the issue 
   - Fix the issue while ensuring the test passes
   - Run the full test suite to verify no regressions

4. **Post-Incident Documentation**
   - Update Refactoring-Plan-V2.md with lessons learned
   - Add the specific issue to "Known Issues" section
   - Update testing procedures if needed 