# Backend Memory

Purpose: concise working log for backend conventions, API contracts, and verified implementation notes.

## Entry Format
- Date: YYYY-MM-DD
- Task: short summary
- Files: touched backend files
- Notes: key decisions, routes, validations, or follow-up risks

## Baseline
- Date: 2026-05-23
- Task: initialized backend memory file for project tracking.
- Files: memory.md
- Notes: keep entries brief; log any route or validation changes after completion.

## 2026-05-23
- Task: documented the school-management CRUD contract used by the new dashboard people manager.
- Files: routes/schoolManagementRoutes.js, controllers/schoolManagementCtrl.js
- Notes: frontend now relies on `/api/school-management/{admins|teachers|staff|students}` plus update, password, deactivate, restore, and delete routes; student roll numbers are generated from the backend `generate/roll-number` endpoint when changing class.