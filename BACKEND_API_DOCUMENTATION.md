# Backend API Documentation

This is the route-by-route API reference for [school-project-backend](./).

## Base URL

All routes are mounted under `http://<host>:<port>/api`.

## Common Response Envelope

Most endpoints return JSON in this shape:

```json
{
  "success": true,
  "msg": "Operation successful",
  "data": {},
  "error": null
}
```

Error responses use the same envelope with `success: false` and an `error` message when available.

## Common Status Codes

- `200` OK
- `201` Created
- `204` No Content when used by a logout or delete flow
- `400` Bad Request
- `401` Unauthorized
- `402` Payment Required or subscription-blocked access in attendance flows
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `500` Internal Server Error

## Folder Structure Reference

See [BACKEND_FOLDER_STRUCTURE.md](./BACKEND_FOLDER_STRUCTURE.md) for the backend tree and route mount map.

## Route Map

| Route file | Base path |
| --- | --- |
| `authRoutes.js` | `/api/auth` |
| `attendanceRoutes.js` | `/api/attendance` |
| `classRoutes.js` | `/api/class` |
| `subjectRoutes.js` | `/api/subject` |
| `teacherRoutes.js` | `/api/teacher` |
| `studentRoutes.js` | `/api/student` |
| `progressRoutes.js` | `/api/progress` |
| `examRoutes.js` | `/api/exam` |
| `dashboardRoutes.js` | `/api/dashboard` |
| `noticeRoutes.js` | `/api/notice` |
| `timeTableRoutes.js` | `/api/timetable` |
| `feedbackRoutes.js` | `/api/feedback` |
| `chatRoutes.js` | `/api/chat` |
| `replyRoutes.js` | `/api/reply` |
| `feeStructureRoutes.js` | `/api/fee-structure` |
| `salaryStructureRoutes.js` | `/api/salary-structure` |
| `feeManagementRoutes.js` | `/api/fee-management` |
| `salaryManagementRoutes.js` | `/api/salary-management` |
| `alertRoutes.js` | `/api/alert` |
| `broadcastRoutes.js` | `/api/broadcast` |
| `messagingRoutes.js` | `/api/messaging` |
| `profileRoutes.js` | `/api/profile` |
| `subscriptionRoutes.js` | `/api/subscription` |
| `leaveRoutes.js` | `/api/leave` |
| `calendarRoutes.js` | `/api/calendar` |
| `schoolManagementRoutes.js` | `/api/school-management` |

## 1. authRoutes.js

Base path: `/api/auth`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/register` | Authenticated admin/teacher/school | User JSON payload for registration | Created user payload | `201`, `400`, `403`, `500` |
| POST | `/login` | Public | Login credentials | Tokens plus user/session data | `200`, `400`, `401`, `500` |
| POST | `/verify-otp` | Public | OTP verification payload | Verified session/token response | `200`, `400`, `401`, `500` |
| POST | `/refresh` | Public | Refresh token | New access token | `200`, `401`, `403`, `500` |
| POST | `/logout` | Public | Refresh token if present | Logout confirmation | `200` or `204`, `500` |
| POST | `/change-password` | Authenticated user | Old and new password | Password update confirmation | `200`, `400`, `401`, `404`, `500` |
| POST | `/forgot-password` | Public | Email or identity payload | Reset instructions / token response | `200`, `404`, `500` |
| POST | `/reset-password` | Public | Reset token and new password | Password reset confirmation | `200`, `400`, `500` |
| POST | `/change-role` | Authenticated admin | Target user id and new role | Updated role payload | `200`, `400`, `403`, `404`, `500` |
| POST | `/update-user/:id` | Authenticated admin/teacher/staff/student | Path `id`, user profile JSON | Updated user payload | `200`, `400`, `403`, `404`, `500` |
| POST | `/delete-user/:id` | Authenticated admin | Path `id` | Soft delete confirmation | `200`, `403`, `404`, `500` |
| POST | `/delete-user-permanent/:id` | Authenticated admin | Path `id` | Permanent delete confirmation | `200`, `403`, `404`, `500` |
| POST | `/reinstate-user/:id` | Authenticated admin | Path `id` | Reinstate confirmation | `200`, `403`, `404`, `500` |
| GET | `/admin/all` | Authenticated admin | None | Admin list | `200`, `400`, `403`, `500` |
| GET | `/staff/all` | Authenticated admin | None | Staff list | `200`, `400`, `403`, `500` |
| POST | `/generate/username` | Authenticated admin | Name payload | Generated unique username | `200`, `400`, `403`, `500` |
| POST | `/generate/student-id` | Authenticated admin | School-scoped student hints | Generated student id | `200`, `400`, `403`, `404`, `500` |
| POST | `/generate/roll-number` | Authenticated admin | Class id | Next roll number | `200`, `400`, `403`, `404`, `500` |
| POST | `/school/register` | Public | School registration JSON | Created school account | `201`, `400`, `409`, `500` |
| POST | `/school/login` | Public | School credentials | School tokens/session | `200`, `401`, `500` |
| POST | `/school/refresh` | Public | Refresh token | New school access token | `200`, `401`, `403`, `500` |
| POST | `/school/logout` | Public | Refresh token if present | Logout confirmation | `200`, `500` |
| POST | `/school/forgot-password` | Public | School email payload | Reset email confirmation | `200`, `400`, `404`, `500` |
| POST | `/school/reset-password` | Public | Reset token and new password | Reset confirmation | `200`, `400`, `500` |
| GET | `/school/me` | School account | None | Current school profile | `200`, `400`, `404`, `500` |
| PUT | `/school/me` | School account | School profile fields | Updated school profile | `200`, `400`, `404`, `500` |
| PUT | `/school/me/image` | School account | Multipart file `image` | Updated logo/image metadata | `200`, `400`, `404`, `500` |
| PUT | `/school/me/id-card-logo` | School account | Multipart file `logo` | Updated ID-card logo | `200`, `400`, `404`, `500` |
| PUT | `/school/me/principal-signature` | School account | Multipart file `signature` | Updated signature asset | `200`, `400`, `404`, `500` |
| GET | `/school/:id` | Public or route-level access | Path `id` | School profile by id | `200`, `400`, `404`, `500` |

## 2. attendanceRoutes.js

Base path: `/api/attendance`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/mark` | Authenticated admin/teacher/staff | Attendance record payload | Attendance create result | `201`, `400`, `403`, `404`, `409`, `500` |
| POST | `/update` | Authenticated admin/teacher/staff | Attendance update payload | Attendance update result | `200`, `400`, `403`, `404`, `500` |
| GET | `` | Authenticated admin/teacher/staff/student | Query `userId`, `month`, `year` | Attendance list or summary | `200`, `403`, `500` |
| GET | `/class` | Authenticated admin/teacher | Query `classId`, `month`, `year` | Class attendance result | `200`, `400`, `403`, `404`, `500` |
| GET | `/staff` | Authenticated admin | Query `staffId`, `month`, `year` | Staff attendance result | `200`, `400`, `403`, `404`, `500` |
| GET | `/teacher` | Authenticated admin | Query `teacherId`, `month`, `year` | Teacher attendance result | `200`, `400`, `403`, `404`, `500` |
| GET | `/dashboard/summary` | Authenticated admin/teacher | Date-range filters | Attendance summary metrics | `200`, `400`, `403`, `404`, `500` |
| GET | `/dashboard/matrix` | Authenticated admin/teacher | Date-range and filter params | Attendance matrix analytics | `200`, `400`, `403`, `404`, `500` |
| GET | `/dashboard/trend` | Authenticated admin/teacher | Date-range and filter params | Trend analytics | `200`, `400`, `403`, `404`, `500` |
| GET | `/dashboard/status-breakdown` | Authenticated admin/teacher | Date-range and filter params | Status breakdown analytics | `200`, `400`, `403`, `404`, `500` |
| GET | `/today/role/:role` | Authenticated admin | Path `role` | Today's attendance for a role | `200`, `400`, `402`, `403`, `404`, `500` |
| GET | `/today/class/:classId` | Authenticated admin/teacher | Path `classId` | Today's class attendance | `200`, `400`, `403`, `404`, `500` |
| POST | `/bulk-mark` | Authenticated admin/teacher | `records` array and optional `date` | Bulk attendance result | `200`, `400`, `403`, `404`, `500` |
| GET | `/export/class` | Authenticated admin/teacher | Query `classId`, `startDate`, `endDate` | CSV download stream | `200`, `400`, `403`, `500` |
| GET | `/get-today/:id` | Authenticated via router middleware | Path `id` | Today's attendance for the provided id | `200`, `403`, `404`, `500` |

## 3. classRoutes.js

Base path: `/api/class`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/create` | Authenticated admin/teacher | Class payload | Created class | `201`, `400`, `500` |
| POST | `/assign-teacher` | Authenticated admin | Class id and teacher id | Teacher assignment result | `200`, `403`, `404`, `500` |
| POST | `/assign-student` | Authenticated admin/teacher | Class id and student id | Student assignment result | `200`, `403`, `404`, `500` |
| POST | `/remove-student` | Authenticated admin/teacher | Class id and student id | Student removal result | `200`, `403`, `404`, `500` |
| GET | `/all` | Authenticated admin/teacher/student | None | Class list | `200`, `500` |
| GET | `/:classId/info` | Authenticated admin/teacher | Path `classId` | Class info payload | `200`, `400`, `403`, `404`, `500` |
| GET | `/:classId/students` | Authenticated admin/teacher/student | Path `classId` | Students in class | `200`, `403`, `404`, `500` |
| GET | `/:id` | Authenticated admin/teacher/student | Path `id` | Class by id | `200`, `403`, `404`, `500` |

## 4. subjectRoutes.js

Base path: `/api/subject`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/create` | Authenticated admin/teacher | Subject payload | Created subject | `201`, `400`, `403`, `404`, `500` |
| POST | `/assign-to-class` | Authenticated admin/teacher | Subject/class mapping | Assignment result | `200`, `400`, `403`, `404`, `500` |
| GET | `/class/:classId` | Authenticated admin/teacher/student | Path `classId` | Subjects for class | `200`, `400`, `403`, `404`, `500` |
| GET | `/dashboard` | Authenticated admin/teacher | None | Subject dashboard analytics | `200`, `400`, `403`, `500` |
| GET | `/:subjectId/details` | Authenticated admin/teacher | Path `subjectId` | Subject detail payload | `200`, `400`, `403`, `404`, `500` |
| PUT | `/:id` | Authenticated admin/teacher | Path `id`, subject fields | Updated subject | `200`, `403`, `404`, `500` |
| GET | `/all` | Authenticated admin/teacher | None | Subject list | `200`, `400`, `403`, `404`, `500` |
| DELETE | `/:id` | Authenticated admin | Path `id` | Subject delete result | `200`, `403`, `404`, `500` |

## 5. teacherRoutes.js

Base path: `/api/teacher`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/add-to-subject` | Authenticated admin/teacher | Teacher id and subject id | Teacher-subject assignment | `201`, `400`, `403`, `404`, `500` |
| GET | `/all` | Authenticated admin/teacher/student/staff | None | Teacher list | `200`, `500` |
| GET | `/:id` | Authenticated admin/teacher/student | Path `id` | Teacher detail | `200`, `403`, `404`, `500` |

## 6. studentRoutes.js

Base path: `/api/student`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| GET | `/id-card/classes` | Authenticated admin/teacher | None | Classes available for ID cards | `200`, `500` |
| GET | `/id-card/class/:classId/students` | Authenticated admin/teacher | Path `classId` | Students for ID cards | `200`, `403`, `404`, `500` |
| POST | `/id-card/upload-school-logo` | Authenticated admin/teacher | Multipart file `logo` | Uploaded school logo metadata | `200`, `400`, `404`, `500` |
| POST | `/id-card/upload-principal-signature` | Authenticated admin/teacher | Multipart file `signature` | Uploaded signature metadata | `200`, `400`, `404`, `500` |
| POST | `/id-card/upload-student-photo/:studentId` | Authenticated admin/teacher | Path `studentId`, multipart file `photo` | Uploaded student photo metadata | `200`, `400`, `403`, `404`, `500` |
| POST | `/id-card/generate-single` | Authenticated admin/teacher | Single student ID card payload | PDF generation result | `200`, `400`, `403`, `404`, `500` |
| POST | `/id-card/generate-bulk` | Authenticated admin/teacher | Bulk ID card payload | Bulk PDF generation result | `200`, `400`, `403`, `404`, `500` |
| POST | `/id-card/generate-single-html` | Authenticated admin/teacher | Single student HTML payload | HTML output | `200`, `400`, `403`, `404`, `500` |
| POST | `/id-card/generate-bulk-html` | Authenticated admin/teacher | Bulk HTML payload | HTML output | `200`, `400`, `403`, `404`, `500` |
| POST | `/add-to-class` | Authenticated admin/teacher | Student id and class id | Student-class assignment | `201`, `403`, `404`, `500` |
| PUT | `/update/:id` | Authenticated admin/teacher/student | Path `id`, profile fields | Updated student profile | `200`, `403`, `404`, `500` |
| POST | `/remove-from-class` | Authenticated admin/teacher | Student id and class id | Removal result | `200`, `403`, `404`, `500` |
| GET | `/:id` | Authenticated admin/teacher/student | Path `id` | Student detail payload | `200`, `403`, `404`, `500` |

## 7. progressRoutes.js

Base path: `/api/progress`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/create` | Authenticated admin/teacher | Progress payload | Created progress record | `201`, `400`, `403`, `404`, `500` |
| POST | `/bulk-create` | Authenticated admin/teacher | `rows` array | Bulk create result | `200` or `201`, `400`, `403`, `404`, `500` |
| PUT | `/bulk-update` | Authenticated admin/teacher | `rows` array | Bulk update result | `200`, `400`, `403`, `404`, `500` |
| GET | `/exam/:examId/template` | Authenticated admin/teacher | Path `examId`, optional `academicYear` | Template for marks entry | `200`, `400`, `403`, `404`, `500` |
| GET | `/valid-subjects/:studentId` | Authenticated admin/teacher | Path `studentId` | Valid subject list | `200`, `400`, `403`, `404`, `500` |
| GET | `/:progressId` | Authenticated admin/teacher | Path `progressId` | Single progress record | `200`, `403`, `404`, `500` |
| PUT | `/:progressId` | Authenticated admin/teacher | Path `progressId`, marks fields | Updated progress record | `200`, `400`, `403`, `404`, `500` |
| DELETE | `/:progressId` | Authenticated admin/teacher | Path `progressId` | Delete confirmation | `200`, `403`, `404`, `500` |
| GET | `/student/:studentId` | Authenticated admin/teacher/student | Path `studentId` | Student performance data | `200`, `403`, `404`, `500` |
| GET | `/student-dashboard/:studentId` | Authenticated admin/teacher/student | Path `studentId` | Student dashboard analytics | `200`, `403`, `404`, `500` |
| GET | `/class-dashboard/:classId` | Authenticated admin/teacher | Path `classId` | Class dashboard analytics | `200`, `403`, `404`, `500` |
| GET | `/export/csv/:studentId` | Authenticated admin/teacher/student | Path `studentId` | CSV export | `200`, `403`, `404`, `500` |
| GET | `/export/excel/:studentId` | Authenticated admin/teacher/student | Path `studentId` | Excel export | `200`, `403`, `404`, `500` |
| GET | `/class/:classId` | Authenticated admin/teacher | Path `classId` | Class result report | `200`, `403`, `404`, `500` |
| GET | `/subject/:subjectId/ranking` | Authenticated admin/teacher | Path `subjectId` | Subject ranking | `200`, `403`, `404`, `500` |
| GET | `/subject/:subjectId` | Authenticated admin/teacher | Path `subjectId` | Subject performance | `200`, `403`, `404`, `500` |
| GET | `/report/:studentId` | Authenticated admin/teacher | Path `studentId` | Student report PDF/summary | `200`, `403`, `404`, `500` |
| GET | `/result/student/:studentId` | Authenticated admin/teacher/student | Path `studentId` | Student result by year | `200`, `403`, `404`, `500` |
| GET | `/advanced-report/:studentId` | Authenticated admin/teacher | Path `studentId` | Advanced report | `200`, `403`, `404`, `500` |
| GET | `/advanced-report-html/:studentId` | Authenticated admin/teacher | Path `studentId` | Advanced report HTML | `200`, `403`, `404`, `500` |
| GET | `/report-card/:studentId` | Authenticated admin/teacher | Path `studentId` | Styled report card | `200`, `403`, `404`, `500` |
| GET | `/report-card-html/:studentId` | Authenticated admin/teacher | Path `studentId` | Styled report card HTML | `200`, `403`, `404`, `500` |
| GET | `/report-card-cbsc/:studentId` | Authenticated admin/teacher | Path `studentId` | CBSE-style report card | `200`, `403`, `404`, `500` |
| GET | `/report-card-cbsc-html/:studentId` | Authenticated admin/teacher | Path `studentId` | CBSE-style report card HTML | `200`, `403`, `404`, `500` |

## 8. examRoutes.js

Base path: `/api/exam`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/create` | Authenticated admin | Exam payload | Created exam | `201`, `400`, `403`, `404`, `500` |
| GET | `/` | Public or route-level access | Query filters/pagination | Exam list | `200`, `400`, `500` |
| GET | `/:examId` | Public or route-level access | Path `examId` | Exam detail | `200`, `400`, `403`, `404`, `500` |
| GET | `/class/:classId/subject/:subjectId` | Public or route-level access | Path `classId`, `subjectId` | Exams for class/subject | `200`, `400`, `500` |
| PUT | `/:examId` | Authenticated admin | Path `examId`, exam fields | Updated exam | `200`, `400`, `403`, `404`, `500` |
| DELETE | `/:examId` | Authenticated admin | Path `examId` | Delete confirmation | `200`, `400`, `403`, `404`, `500` |

## 9. dashboardRoutes.js

Base path: `/api/dashboard`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| GET | `/overview` | Authenticated user with active subscription | None | School overview counts and subscription | `200`, `400`, `500` |

## 10. noticeRoutes.js

Base path: `/api/notice`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| GET | `/valid` | Authenticated user with active subscription | None or query filters | Valid notices | `200`, `400`, `500` |
| POST | `/` | Authenticated user with active subscription | Notice payload | Created notice | `201`, `400`, `403`, `500` |
| PUT | `/:id` | Authenticated user with active subscription | Path `id`, notice fields | Updated notice | `200`, `400`, `403`, `404`, `500` |
| DELETE | `/:id` | Authenticated user with active subscription | Path `id` | Delete confirmation | `200`, `400`, `403`, `404`, `500` |

## 11. timeTableRoutes.js

Base path: `/api/timetable`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| GET | `/` | Public or route-level access | None | All timetables for school | `200`, `400`, `500` |
| GET | `/day/:day` | Public or route-level access | Path `day` | Timetable for day | `200`, `400`, `500` |
| GET | `/class/:classId` | Public or route-level access | Path `classId` | Timetable for class | `200`, `400`, `404`, `500` |
| POST | `/` | Authenticated admin | Timetable payload | Created timetable | `201`, `400`, `403`, `404`, `500` |
| PUT | `/:id` | Authenticated admin | Path `id`, timetable fields | Updated timetable | `200`, `400`, `403`, `404`, `500` |
| DELETE | `/:id` | Authenticated admin | Path `id` | Delete confirmation | `200`, `400`, `403`, `404`, `500` |

## 12. feedbackRoutes.js

Base path: `/api/feedback`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/public/contact` | Public | Contact/feedback payload | Created feedback record | `201`, `400`, `500` |
| POST | `/public/review` | Public | Review payload | Created review record | `201`, `400`, `500` |
| GET | `/` | Authenticated via `validateUser` | None | Feedback list | `200`, `500` |

## 13. chatRoutes.js

Base path: `/api/chat`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/create` | Route-level access | Chat payload | Created chat | `201`, `400`, `500` |
| DELETE | `/:id` | Route-level access | Path `id` | Delete confirmation | `200`, `400`, `403`, `404`, `500` |
| GET | `/my` | Route-level access | None | Current user's chats | `200`, `500` |
| GET | `/` | Route-level access | Query pagination/filter params | School chat list | `200`, `400`, `500` |

## 14. replyRoutes.js

Base path: `/api/reply`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/create` | Route-level access | Reply payload and `chatId` | Created reply | `201`, `400`, `403`, `404`, `500` |
| DELETE | `/:id` | Route-level access | Path `id` | Delete confirmation | `200`, `400`, `403`, `404`, `500` |
| GET | `/my` | Route-level access | None | Current user's replies | `200`, `500` |
| GET | `/chat/:chatId` | Route-level access | Path `chatId`, query pagination | Replies by chat | `200`, `400`, `403`, `404`, `500` |

## 15. feeStructureRoutes.js

Base path: `/api/fee-structure`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/create` | Route-level access | Class id and fee components | Created fee structure | `201`, `400`, `403`, `404`, `500` |
| GET | `/all` | Route-level access | None | Fee structure list | `200`, `400`, `403`, `404`, `500` |
| GET | `/class/:classId` | Route-level access | Path `classId` | Fee structure for class | `200`, `400`, `403`, `404`, `500` |
| GET | `/:id` | Route-level access | Path `id` | Fee structure by id | `200`, `400`, `403`, `404`, `500` |
| PUT | `/:id` | Route-level access | Path `id`, fee structure fields | Updated fee structure | `200`, `400`, `403`, `404`, `500` |

## 16. salaryStructureRoutes.js

Base path: `/api/salary-structure`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/create` | Public or route-level access | Role and salary components | Created salary structure | `201`, `400`, `404`, `500` |
| GET | `/all` | Public or route-level access | None | Salary structure list | `200`, `500` |
| GET | `/role/:role` | Public or route-level access | Path `role` | Salary structure by role | `200`, `400`, `404`, `500` |
| GET | `/:id` | Public or route-level access | Path `id` | Salary structure by id | `200`, `400`, `404`, `500` |
| PUT | `/:id` | Public or route-level access | Path `id`, salary structure fields | Updated salary structure | `200`, `400`, `404`, `500` |

## 17. feeManagementRoutes.js

Base path: `/api/fee-management`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/payment/create` | Public or route-level access | Student id, fee structure id, month, year, payment details | Created fee payment | `201`, `400`, `403`, `404`, `409`, `500` |
| GET | `/payment/:id` | Public or route-level access | Path `id` | Fee payment detail | `200`, `400`, `403`, `404`, `500` |
| GET | `/payment/:id/slip-html` | Public or route-level access | Path `id` | Payment slip HTML | `200`, `400`, `403`, `404`, `500` |
| DELETE | `/payment/:id` | Public or route-level access | Path `id` | Delete confirmation | `200`, `400`, `403`, `404`, `500` |
| GET | `/summary/student/:studentId/month/:month/:year` | Public or route-level access | Path `studentId`, `month`, `year` | Monthly fee summary | `200`, `400`, `500` |
| GET | `/summary/student/:studentId/history` | Public or route-level access | Path `studentId` | Payment history | `200`, `400`, `500` |
| GET | `/analytics/class-wise` | Public or route-level access | Query class and period filters | Class-wise fee analytics | `200`, `400`, `403`, `404`, `500` |
| GET | `/analytics/school-wise` | Public or route-level access | Query period filters | School-wise fee analytics | `200`, `400`, `500` |

## 18. salaryManagementRoutes.js

Base path: `/api/salary-management`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/payment/create` | Authenticated admin | Staff salary payment payload | Created salary payment | `201`, `400`, `403`, `404`, `409`, `500` |
| GET | `/payment/:id` | Authenticated admin | Path `id` | Salary payment detail | `200`, `400`, `403`, `404`, `500` |
| GET | `/payment/:id/slip-html` | Authenticated admin | Path `id` | Salary slip HTML | `200`, `400`, `403`, `404`, `500` |
| DELETE | `/payment/:id` | Authenticated admin | Path `id` | Delete confirmation | `200`, `400`, `403`, `404`, `500` |
| GET | `/summary/staff/:staffId/month/:month/:year` | Authenticated admin/teacher/staff | Path `staffId`, `month`, `year` | Monthly salary summary | `200`, `400`, `500` |
| GET | `/summary/staff/:staffId/history` | Authenticated admin/teacher/staff | Path `staffId` | Salary payment history | `200`, `400`, `500` |
| GET | `/analytics/matrix-month` | Authenticated admin | Query period filters | Salary analytics matrix | `200`, `400`, `500` |

## 19. alertRoutes.js

Base path: `/api/alert`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/create` | Authenticated admin | Alert payload | Created alert | `201`, `400`, `403`, `404`, `500` |
| GET | `/unviewed` | Public or route-level access | None | Unviewed alerts | `200`, `500` |
| PUT | `/:alertId/mark-viewed` | Public or route-level access | Path `alertId` | Mark viewed confirmation | `200`, `400`, `403`, `404`, `500` |

## 20. broadcastRoutes.js

Base path: `/api/broadcast`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/preview-recipients` | Public or route-level access | Audience filter payload | Recipient preview | `200`, `400`, `500` |
| POST | `/send` | Public or route-level access | Broadcast payload | Created broadcast | `201`, `400`, `404`, `500` |
| GET | `/history` | Public or route-level access | None | Broadcast history | `200`, `400`, `500` |
| GET | `/:broadcastId/deliveries` | Public or route-level access | Path `broadcastId` | Delivery list | `200`, `400`, `404`, `500` |
| GET | `/:broadcastId` | Public or route-level access | Path `broadcastId` | Broadcast detail | `200`, `400`, `404`, `500` |

## 21. messagingRoutes.js

Base path: `/api/messaging`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| GET | `/contacts` | Public or route-level access | None | Messaging contacts list | `200`, `500` |
| POST | `/conversations/direct` | Public or route-level access | Target user payload | Direct conversation result | `200`, `400`, `403`, `404`, `409`, `500` |
| POST | `/conversations/groups` | Public or route-level access | Group name and member ids | Group conversation result | `201`, `400`, `500` |
| GET | `/conversations` | Public or route-level access | Query pagination/filter params | Conversation list | `200`, `500` |
| GET | `/conversations/:id/messages` | Public or route-level access | Path `id`, query pagination | Message list | `200`, `400`, `403`, `404`, `500` |
| POST | `/conversations/:id/messages` | Public or route-level access | Path `id`, message payload | Created message | `201`, `400`, `500` |
| POST | `/conversations/:id/read` | Public or route-level access | Path `id` | Read receipt confirmation | `200`, `400`, `500` |
| GET | `/broadcast` | Public or route-level access | None | School broadcast conversation | `200`, `500` |
| POST | `/uploads` | Public or route-level access | Multipart asset upload | Uploaded asset metadata | `201`, `400`, `500` |

## 22. profileRoutes.js

Base path: `/api/profile`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| GET | `/me` | Authenticated user | None | Current profile | `200`, `404`, `500` |
| PUT | `/me` | Authenticated user | Profile fields | Updated profile | `200`, `400`, `404`, `500` |
| PUT | `/update` | Authenticated user | Same payload as `/me` | Updated profile | `200`, `400`, `404`, `500` |
| POST | `/me/avatar` | Authenticated user | Multipart file `image` | Updated avatar metadata | `200`, `400`, `404`, `500` |
| GET | `/search/users` | Authenticated user | Query search term and filters | Matching users | `200`, `400`, `500` |
| GET | `/:id` | Authenticated user | Path `id` | Basic profile info | `200`, `403`, `404`, `500` |

## 23. subscriptionRoutes.js

Base path: `/api/subscription`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| GET | `/status` | Authenticated user | None | Current school subscription | `200`, `400`, `500` |
| POST | `/create` | Authenticated admin | Subscription payload | Created subscription | `201`, `400`, `500` |
| PUT | `/renew` | Authenticated admin | Renewal payload | Renewed subscription | `200`, `400`, `404`, `500` |
| GET | `/school/:schoolId` | Authenticated admin | Path `schoolId` | Subscription by school | `200`, `400`, `403`, `500` |

## 24. leaveRoutes.js

Base path: `/api/leave`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| POST | `/apply` | Authenticated user | Leave request payload | Leave application created | `201`, `400`, `409`, `500` |
| GET | `/my` | Authenticated user | Query filters validated by middleware | My leave list | `200`, `400`, `500` |
| DELETE | `/my/:id` | Authenticated user | Path `id` | Pending leave delete confirmation | `200`, `400`, `404`, `409`, `500` |
| GET | `/admin` | Authenticated admin | Query filters validated by middleware | Admin leave list | `200`, `400`, `500` |
| PATCH | `/admin/:id/review` | Authenticated admin | Path `id`, review decision payload | Leave review result | `200`, `400`, `403`, `404`, `409`, `500` |

## 25. calendarRoutes.js

Base path: `/api/calendar`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| GET | `/` | Public or route-level access | Query filters validated by middleware | Calendar events list | `200`, `400`, `500` |
| GET | `/:id` | Public or route-level access | Path `id` | Calendar event detail | `200`, `403`, `404`, `500` |
| POST | `/` | Public or route-level access | Event payload | Created calendar event | `201`, `400`, `500` |
| PUT | `/:id` | Public or route-level access | Path `id`, event updates | Updated event | `200`, `400`, `403`, `404`, `500` |
| DELETE | `/:id` | Public or route-level access | Path `id` | Delete confirmation | `200`, `403`, `404`, `500` |
| PATCH | `/:id/attendees` | Public or route-level access | Path `id`, attendee payload | Updated attendees | `200`, `403`, `404`, `500` |
| PATCH | `/:id/reminders` | Public or route-level access | Path `id`, reminder payload | Updated reminders | `200`, `403`, `404`, `500` |
| PATCH | `/:id/recurrence` | Public or route-level access | Path `id`, recurrence payload | Updated recurrence | `200`, `403`, `404`, `500` |
| PATCH | `/:id/status` | Public or route-level access | Path `id`, status payload | Updated status | `200`, `403`, `404`, `500` |
| PATCH | `/:id/visibility` | Public or route-level access | Path `id`, visibility payload | Updated visibility | `200`, `403`, `404`, `500` |
| POST | `/cleanup/expired` | Authenticated admin | None | Cleanup confirmation | `200`, `403`, `500` |

## 26. schoolManagementRoutes.js

Base path: `/api/school-management`

| Method | Endpoint | Access | Request | Success response | Status codes |
| --- | --- | --- | --- | --- | --- |
| GET | `/overview` | Route-level access | None | School overview dashboard | `200`, `400`, `500` |

### Admin resource endpoints

| Method | Endpoint | Request | Success response | Status codes |
| --- | --- | --- | --- | --- |
| POST | `/admins` | Admin payload | Created admin | `201`, `400`, `409`, `500` |
| GET | `/admins` | None | Admin list | `200`, `400`, `500` |
| GET | `/admins/:id` | Path `id` | Admin detail | `200`, `400`, `404`, `500` |
| PUT | `/admins/:id` | Path `id`, admin fields | Updated admin | `200`, `400`, `404`, `500` |
| PATCH | `/admins/:id/password` | Path `id`, password payload | Password update confirmation | `200`, `400`, `404`, `500` |
| PATCH | `/admins/:id/deactivate` | Path `id` | Soft delete confirmation | `200`, `400`, `404`, `500` |
| PATCH | `/admins/:id/restore` | Path `id` | Restore confirmation | `200`, `400`, `404`, `500` |
| DELETE | `/admins/:id` | Path `id` | Permanent delete confirmation | `200`, `400`, `404`, `500` |

### Teacher resource endpoints

| Method | Endpoint | Request | Success response | Status codes |
| --- | --- | --- | --- | --- |
| GET | `/teachers` | None | Teacher list | `200`, `500` |
| GET | `/teachers/:id` | Path `id` | Teacher detail | `200`, `400`, `404`, `500` |
| PUT | `/teachers/:id` | Path `id`, teacher fields | Updated teacher | `200`, `400`, `404`, `500` |
| PATCH | `/teachers/:id/password` | Path `id`, password payload | Password update confirmation | `200`, `400`, `404`, `500` |
| PATCH | `/teachers/:id/deactivate` | Path `id` | Soft delete confirmation | `200`, `400`, `404`, `500` |
| PATCH | `/teachers/:id/restore` | Path `id` | Restore confirmation | `200`, `400`, `404`, `500` |
| DELETE | `/teachers/:id` | Path `id` | Permanent delete confirmation | `200`, `400`, `404`, `500` |

### Staff resource endpoints

| Method | Endpoint | Request | Success response | Status codes |
| --- | --- | --- | --- | --- |
| GET | `/staffs` | None | Staff list | `200`, `500` |
| GET | `/staffs/:id` | Path `id` | Staff detail | `200`, `400`, `404`, `500` |
| PUT | `/staffs/:id` | Path `id`, staff fields | Updated staff | `200`, `400`, `404`, `500` |
| PATCH | `/staffs/:id/password` | Path `id`, password payload | Password update confirmation | `200`, `400`, `404`, `500` |
| PATCH | `/staffs/:id/deactivate` | Path `id` | Soft delete confirmation | `200`, `400`, `404`, `500` |
| PATCH | `/staffs/:id/restore` | Path `id` | Restore confirmation | `200`, `400`, `404`, `500` |
| DELETE | `/staffs/:id` | Path `id` | Permanent delete confirmation | `200`, `400`, `404`, `500` |

### Student resource endpoints

| Method | Endpoint | Request | Success response | Status codes |
| --- | --- | --- | --- | --- |
| GET | `/students` | None | Student list | `200`, `500` |
| GET | `/students/:id` | Path `id` | Student detail | `200`, `400`, `404`, `500` |
| PUT | `/students/:id` | Path `id`, student fields | Updated student | `200`, `400`, `404`, `500` |
| PATCH | `/students/:id/password` | Path `id`, password payload | Password update confirmation | `200`, `400`, `404`, `500` |
| PATCH | `/students/:id/deactivate` | Path `id` | Soft delete confirmation | `200`, `400`, `404`, `500` |
| PATCH | `/students/:id/restore` | Path `id` | Restore confirmation | `200`, `400`, `404`, `500` |
| DELETE | `/students/:id` | Path `id` | Permanent delete confirmation | `200`, `400`, `404`, `500` |

### Class resource endpoints

| Method | Endpoint | Request | Success response | Status codes |
| --- | --- | --- | --- | --- |
| GET | `/classes` | None | Class list | `200`, `500` |
| PUT | `/classes/:id` | Path `id`, class fields | Updated class | `200`, `400`, `404`, `500` |
| PATCH | `/classes/:id/deactivate` | Path `id` | Soft delete confirmation | `200`, `400`, `404`, `500` |
| PATCH | `/classes/:id/restore` | Path `id` | Restore confirmation | `200`, `400`, `404`, `500` |
| DELETE | `/classes/:id` | Path `id` | Permanent delete confirmation | `200`, `400`, `404`, `500` |

### Subject resource endpoints

| Method | Endpoint | Request | Success response | Status codes |
| --- | --- | --- | --- | --- |
| GET | `/subjects` | None | Subject list | `200`, `500` |
| PUT | `/subjects/:id` | Path `id`, subject fields | Updated subject | `200`, `400`, `404`, `500` |
| PATCH | `/subjects/:id/deactivate` | Path `id` | Soft delete confirmation | `200`, `400`, `404`, `500` |
| PATCH | `/subjects/:id/restore` | Path `id` | Restore confirmation | `200`, `400`, `404`, `500` |
| DELETE | `/subjects/:id` | Path `id` | Permanent delete confirmation | `200`, `400`, `404`, `500` |

### Subscription endpoints

| Method | Endpoint | Request | Success response | Status codes |
| --- | --- | --- | --- | --- |
| GET | `/subscription` | None | Current subscription | `200`, `400`, `500` |
| PUT | `/subscription` | Subscription fields | Updated subscription | `200`, `404`, `500` |
| PUT | `/subscription/renew` | Renewal payload | Renewed subscription | `200`, `404`, `500` |

## Notes

- `progressRoutes.js` contains the path `/report-card-cbsc/:studentId` exactly as written in code.
- `attendanceRoutes.js` includes both `GET /api/attendance` and `GET /api/attendance/get-today/:id`.
- `profileRoutes.js` exposes two update routes: `PUT /me` and `PUT /update`, both wired to the same controller.
- `feedbackRoutes.js` exposes two public create routes that share the same controller, so payload shape is the main difference.
- `schoolManagementRoutes.js` is the broad administrative surface for users, classes, subjects, and subscriptions.
