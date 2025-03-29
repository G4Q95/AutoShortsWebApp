# R2 Refactoring Plan

**1. Introduction & Goals**
    *   **Context:** Briefly state that the R2 file deletion functionality is now working after extensive debugging (ref Parts 2, 3, 4, and R2-Deletion-Fix). Acknowledge that this process likely introduced complexity, redundant code, and potential inconsistencies.
    *   **Goals:**
        *   Simplify R2 interaction and project cleanup logic.
        *   Improve code maintainability and readability.
        *   Remove dead code, unused dependencies, and configuration artifacts from previous approaches (Wrangler, Worker exploration).
        *   Consolidate scattered R2-related logic.
        *   Ensure robustness and consistent error handling for R2 operations.
        *   Update documentation to accurately reflect the final, cleaned-up implementation.

**2. Assessment of Current State**
    *   **Review Code:** Systematically review all files involved in R2 operations and project cleanup:
        *   `web/backend/app/services/storage.py`
        *   `web/backend/app/services/project.py` (specifically `cleanup_project_storage`)
        *   `web/backend/app/services/r2_file_tracking.py`
        *   `web/backend/app/api/projects.py` (delete endpoint)
        *   `web/backend/app/api/debug.py` (R2-related endpoints)
        *   `web/backend/app/core/config.py` (R2 settings)
        *   Potentially other files calling storage methods.
    *   **Analyze Current Strategy:** Map out the current flow: Frontend -> API -> DB Delete -> Background Task -> `cleanup_project_storage` -> Tracked Files Check -> (Fallback) `list_project_files` (Patterns) -> S3 `delete_objects`. Confirm this is the desired final flow.
    *   **Identify Redundancies:** List specific code blocks, functions, or files related to:
        *   Wrangler CLI execution attempts (e.g., subprocess calls in older versions of `storage.py` or debug scripts).
        *   Cloudflare Worker client (`worker_client.py`) and its potential usage points (currently unused in the final fix).
    *   **List Debug Artifacts:** Identify:
        *   Temporary test scripts (`test_*.py` related to R2/TLS/Wrangler).
        *   Debug endpoints in `debug.py` that are no longer necessary.
        *   Excessive `print()` statements or overly verbose logging added during debugging.
        *   Commented-out code blocks from previous attempts.
    *   **Configuration Review:** Check `Dockerfile` (backend), `docker-compose.yml`, `.env`, `.env.example` for remnants of Node.js, Wrangler, or unnecessary R2-related variables.
    *   **Documentation Audit:** Review `README.md`, `DOCKER_SETUP.md`, and the `Cloudflare-R2-Reconfig-Part-*.md` series for consistency and accuracy regarding the *current* working solution.

**3. Cleanup Phase**
    *   **Remove Unused Code:**
        *   Delete code related to Wrangler CLI execution (e.g., related debug endpoints in `debug.py`).
        *   Delete `worker_client.py` and any code attempting to use it. (Decision: Stick with the S3 API approach for now; Worker code can be re-implemented later if needed, but remove it now to reduce complexity).
        *   Delete identified temporary test scripts in the root directory: `simple_test.py`, `test_elevenlabs_official.py`, `test_elevenlabs.py`, `test_fast_deletion.py`, `test_mongo.py`, `test_tls_connection.py`, `test_tls.py`, `test_wrangler.py`.
        *   Remove non-essential debug endpoints from `debug.py`, especially those related to Wrangler or Workers (e.g., `verify_wrangler_auth`, `verify_r2_access`, `test_worker`, `get_worker_status`). Keep essential ones like `verify-cleanup` for now.
        *   Clean up comments and logging related to deprecated approaches.
    *   **Docker & Environment:**
        *   Remove Node.js/Wrangler installation steps from the backend `Dockerfile`.
        *   Clean up `docker-compose.yml` environment variables related to unused methods (Wrangler `CLOUDFLARE_API_TOKEN`, Worker variables like `CF_WORKER_URL`, `CF_WORKER_API_TOKEN`, `USE_WORKER_FOR_DELETION`). Ensure necessary S3/R2 vars remain.
        *   Ensure `.env` and `.env.example` only contain necessary R2 variables (Account ID, Key ID, Secret Key, Endpoint URL, Bucket Name, URL Expiration). Add any missing ones like `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_URL_EXPIRATION` to `.env.example`.

**4. Refactoring & Improvement Phase**
    *   **Centralize R2 Logic:** Ensure all direct R2 interactions (upload, download, delete, list, head) reside within `storage.py`. `project.py` should *use* the storage service, not contain direct S3 calls.
    *   **Simplify Cleanup Orchestration:** Review `project.py`'s `cleanup_project_storage`. Can the logic for checking tracked files vs. pattern fallback be clearer?
    *   **Streamline `list_project_files`:** Evaluate the necessity and efficiency of all the patterns and the substring search in `storage.py`. Can it be simplified while remaining effective?
    *   **Enhance File Tracking:** Review `r2_file_tracking.py`. Add logging or checks if tracking fails during upload. Ensure `delete_project_files` is robust.
    *   **Consistent Error Handling:** Standardize how `ClientError` and other exceptions from `boto3` are caught, logged, and reported back within `storage.py`.
    *   **Code Quality:** Apply PEP 8, add type hints, improve docstrings for all modified functions.

**5. Testing Phase**
    *   **Unit Tests (Optional but Recommended):** Consider if mocking `boto3` calls is feasible to add unit tests for parts of `storage.py`.
    *   **Integration Tests:** Ensure debug endpoints (if kept) function correctly after refactoring.
    *   **End-to-End Tests:** Rigorously re-test the full project lifecycle: Create -> Upload Media -> Verify in R2 -> Delete Project (UI) -> Verify R2 is empty. Test with different file types/scenarios if possible.

**6. Documentation Update Phase**
    *   **Update Core Docs:** Modify `README.md`, `DOCKER_SETUP.md`, etc., to reflect the simplified setup and cleaned configuration.
    *   **Refine `R2-Deletion-Fix.md`:** Ensure it clearly explains the *final, refactored* solution.
    *   **Archive Historical Docs:** Clearly mark `Cloudflare-R2-Reconfig-Part-2, 3, 4` as "Historical" or "Outdated" in their titles or introduction, explaining they document the *process* but not the final implementation state after refactoring. Add a link to the updated `R2-Deletion-Fix.md` or relevant README section.
    *   **Code Documentation:** Ensure docstrings and comments in the code itself are accurate. 