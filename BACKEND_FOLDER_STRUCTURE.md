# Backend Folder Structure

This file documents the backend layout for [school-project-backend](./).

## Root Structure

```text
school-project-backend/
├── API_DOCUMENTATION.md
├── BACKEND_API_DOCUMENTATION.md
├── BACKEND_FOLDER_STRUCTURE.md
├── app.js
├── server.js
├── README.md
├── memory.md
├── .env
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── sockets/
├── templates/
└── utils/
```

## Route Files

All backend APIs are mounted from `app.js` under `/api/*`.

| Route file | Mounted base path |
| --- | --- |
| authRoutes.js | `/api/auth` |
| attendanceRoutes.js | `/api/attendance` |
| classRoutes.js | `/api/class` |
| subjectRoutes.js | `/api/subject` |
| teacherRoutes.js | `/api/teacher` |
| studentRoutes.js | `/api/student` |
| progressRoutes.js | `/api/progress` |
| examRoutes.js | `/api/exam` |
| dashboardRoutes.js | `/api/dashboard` |
| noticeRoutes.js | `/api/notice` |
| timeTableRoutes.js | `/api/timetable` |
| feedbackRoutes.js | `/api/feedback` |
| chatRoutes.js | `/api/chat` |
| replyRoutes.js | `/api/reply` |
| feeStructureRoutes.js | `/api/fee-structure` |
| salaryStructureRoutes.js | `/api/salary-structure` |
| feeManagementRoutes.js | `/api/fee-management` |
| salaryManagementRoutes.js | `/api/salary-management` |
| alertRoutes.js | `/api/alert` |
| broadcastRoutes.js | `/api/broadcast` |
| messagingRoutes.js | `/api/messaging` |
| profileRoutes.js | `/api/profile` |
| subscriptionRoutes.js | `/api/subscription` |
| leaveRoutes.js | `/api/leave` |
| calendarRoutes.js | `/api/calendar` |
| schoolManagementRoutes.js | `/api/school-management` |
| downloadRoutes.js | `/api/download` |

## Backend Areas

| Folder | Purpose |
| --- | --- |
| `config/` | Database and third-party service configuration such as MongoDB and Cloudinary |
| `controllers/` | Request handlers and business logic |
| `middleware/` | Authentication, authorization, validation, upload, and response helpers |
| `models/` | Mongoose schemas and indexes, including download audit and quota policy models |
| `routes/` | Express route definitions |
| `services/` | Shared service helpers |
| `sockets/` | Socket.IO or realtime messaging setup |
| `templates/` | HTML templates used for slips, reports, and messages |
| `utils/` | Shared utility functions |

## Documentation Files

| File | Purpose |
| --- | --- |
| `API_DOCUMENTATION.md` | Existing API reference in the backend folder |
| `BACKEND_API_DOCUMENTATION.md` | Complete route-by-route API reference |
| `BACKEND_FOLDER_STRUCTURE.md` | Folder and route map reference |

## Common API Behavior

- All `/api/*` endpoints set `Cache-Control: no-store` style headers in `app.js`.
- Most endpoints return a JSON envelope with `success`, `msg`, optional `data`, and optional `error`.
- Protected routes typically require `validateUser`, `allow(...)`, or `checkSubscriptionActive` depending on the resource.
- File and report endpoints may return HTML, PDF, CSV, Excel, or uploaded asset metadata instead of plain JSON.
- Download exports are now handled through `/api/download` and should log usage in `models/downloadLog.js`.
