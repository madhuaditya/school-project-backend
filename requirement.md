# Requirement: Role-Based School Download System

## Goal

Build a backend download system that lets school users export school data according to role, tracks every download attempt, and enforces a daily download quota.

The first phase must support:

- Admin downloads for the full school dataset
- Teacher downloads for approved academic data only
- CSV, Excel, and PDF output formats
- A hard daily limit of 10 downloads per actor
- Persistent audit history for successful and blocked attempts

## Scope Decisions

- Phase 1 roles: `admin` and `teacher`
- Phase 1 formats: `csv`, `excel`, `pdf`
- Daily quota: 10 files per day per actor
- Quota applies to each successful file download
- Blocked attempts must also be logged
- Limit updates must be possible from the backend so the school can raise the quota later

## Role Matrix

### Admin

Admin can export any school-owned data that already exists in the backend:

- School profile and subscription overview
- Classes
- Subjects
- Teachers
- Students
- Attendance
- Progress and results
- Exams
- Timetable
- Notices
- Calendar events
- Fee structure
- Fee payment records
- Salary structure
- Salary payment records
- Leave records
- Dashboard summary data

### Teacher

Teacher can export only data that belongs to the classes/subjects they are assigned to:

- Classes they teach
- Subjects assigned to them
- Students from their assigned classes
- Attendance for their assigned classes
- Results/progress for their assigned classes and subjects

Teacher must not be able to export admin-only data such as salary, fee, subscription, staff management, or global school administration data.

## Functional Requirements

1. The backend must expose a single download entrypoint that accepts a module name, format, and optional filters.
2. The backend must validate role access before any export is generated.
3. The backend must validate the school boundary on every request.
4. The backend must reject unsupported modules, unsupported formats, and invalid filters with clear errors.
5. The backend must stop downloads after the actor reaches 10 successful files in the same day.
6. The backend must record every successful and blocked download attempt in MongoDB.
7. The backend must expose download history so school admins can audit who downloaded what and when.
8. The backend must expose the current quota configuration and allow admins to update it later.

## Backend Files To Create

### Models

- `models/downloadLog.js`
  - Stores each download attempt
  - Must record actor, role, school, module, format, filters, filename, count, status, reason, IP, and user agent
  - Must include a date key for efficient per-day quota lookups

- `models/downloadPolicy.js`
  - Stores the per-school download limit
  - Default daily limit should be 10
  - Can be updated later by admin

### Controller

- `controllers/downloadCtrl.js`
  - Main export handler
  - Quota enforcement
  - Audit log write
  - File rendering for CSV, Excel, and PDF
  - Download history endpoint
  - Download policy endpoints

### Routes

- `routes/downloadRoutes.js`
  - `POST /api/download/export`
  - `GET /api/download/history`
  - `GET /api/download/limits`
  - `PUT /api/download/limits`

### App Wiring

- `app.js`
  - Mount the new download routes under `/api/download`

### Documentation

- `BACKEND_API_DOCUMENTATION.md`
  - Add the new route map and endpoint details

- `BACKEND_FOLDER_STRUCTURE.md`
  - Add the new model and route entries

## Implementation Rules

- Use the existing `validateUser` and `allow(...)` middleware pattern.
- Keep school scoping strict by using `req.user.school` or the school auth context.
- Reuse the backend response envelope style: `success`, `msg`, `data`, `error`.
- Use MongoDB indexes on the download log for efficient counting by day and actor.
- Keep the export code reusable so future modules can be added without rewriting the quota logic.

## Audit Fields

Each log record should include:

- School id
- Actor id
- Actor role
- Module name
- Export format
- Applied filters
- File name
- Record count
- Status: `success`, `blocked`, or `failed`
- Block reason when applicable
- Quota limit snapshot
- Quota used before / after
- IP address
- User agent
- Created timestamp

## Acceptance Criteria

1. Admin can export any supported module in CSV, Excel, or PDF.
2. Teacher can export only approved academic modules.
3. The 11th same-day download attempt fails with a clear quota error.
4. Every successful download writes a persistent audit log.
5. Every blocked attempt writes a persistent audit log.
6. Admin can view download history and update the daily quota.
7. The implementation is documented in the backend docs and folder map.

## Notes For Future Agents

- Start from the existing export patterns in attendance and progress controllers.
- Keep PDF generation simple and backend-native unless a shared template already exists.
- If a new school-wide module is added later, add it to the registry rather than duplicating the quota logic.