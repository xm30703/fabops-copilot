# Project conventions

- Keep this checkout independent from Codex chat directories. Resolve machine tools, models, and deployment state via `scripts/paths.ps1` and `FABOPS_RUNTIME_DIR`.
- This is a synthetic portfolio project. Do not add employer code, data, names, or internal procedures.
- Maintain Windows PowerShell 5.1 compatibility in operational scripts. Do not assume `pwsh` is installed.
- Keep `.env`, `.venv`, tool/model directories, deployment credentials, runner state, and raw logs out of Git and Docker build contexts.
- Preserve existing database volumes, local credentials, Git history, and models during environment changes. Source relocation must not create a new empty database accidentally.
- PR checks run on hosted Linux. Local deployment runs only for trusted main commits on the registered Windows runner, using an external persistent state directory.
- Validate the affected behavior and record actual results in `docs/VALIDATION.md`. Distinguish mock, offline baseline, live DB, and live AI evidence.
