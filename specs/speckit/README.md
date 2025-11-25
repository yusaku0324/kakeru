# speckit scenarios

Executable specs organized per domain under `specs/speckit/<domain>/`. Use these alongside the Markdown base/diff specs (see `specs/<domain>/` in main) to keep contracts in sync.

Guidelines
- Keep scenarios small and happy-path; add edge cases per issue when needed.
- Note relevant diff IDs in comments/links inside the scenario files.
- Allow extra response fields unless the contract requires strict matching.

Local usage
- Validate syntax: `speckit validate specs/speckit`
- Run a scenario against dev API: `speckit run specs/speckit/matching/search.yaml --base-url http://localhost:8000`
- (Optional) Generate mocks if enabled: `speckit mock specs/speckit/matching/search.yaml`

CI suggestion (future)
- Add a lightweight job to run `speckit validate specs/speckit` and, if a dev API is available, `speckit check specs/speckit --base-url $DEV_API`.
