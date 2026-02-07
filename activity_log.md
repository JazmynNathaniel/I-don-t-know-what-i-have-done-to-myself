# Activity Log

## Summary of Changes

1. Scaffolded project structure.
Reason: Establish backend/frontend separation and make the app runnable.

2. Built Flask API proxy for Adzuna with validation, caching, and rate limiting.
Reason: Provide a stable backend interface, reduce upstream calls, and guard against abuse.

3. Implemented React UI with filters, pagination, saved jobs, and job details.
Reason: Meet requested feature set and deliver a functional job search experience.

4. Added shareable URLs and saved-jobs tab.
Reason: Improve UX and allow direct linking to job details and views.

5. Added sort controls and server-side validation for `sort_by`.
Reason: Ensure predictable, safe backend behavior.

6. Added toasts, clear filters, and keyboard shortcut.
Reason: Improve usability and feedback without altering core workflows.

7. Updated styling and README.
Reason: Keep UI cohesive and document how to run and use features.

8. Installed backend and frontend dependencies.
Reason: Prepare environment to run the app and tests.

9. Attempted to run tests; no backend tests found and frontend has no test script.
Reason: Follow user request to run tests and verify project readiness.

10. Applied `npm audit fix --force`.
Reason: Resolve reported npm vulnerabilities (explicit user request).
