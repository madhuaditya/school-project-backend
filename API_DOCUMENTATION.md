# School Management System - Complete API Documentation

**Base URL**: `http://localhost:5000/api`  
**API Version**: 1.0  
**Last Updated**: March 26, 2026

---

## Table of Contents

1. [Authentication APIs](#authentication-apis)
2. [User Management APIs](#user-management-apis)
3. [Class Management APIs](#class-management-apis)
4. [Subject Management APIs](#subject-management-apis)
5. [Teacher Management APIs](#teacher-management-apis)
6. [Student Management APIs](#student-management-apis)
7. [Attendance APIs](#attendance-apis)
8. [Progress & Performance APIs](#progress--performance-apis)
9. [Profile APIs](#profile-apis)

---

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "msg": "Operation successful",
  "data": { /* optional - data object */ }
}
```

### Error Response
```json
{
  "success": false,
  "msg": "Error message",
  "error": "Detailed error message (optional)"
}
```

### HTTP Status Codes
- `200`: OK - Successful GET/POST operation
- `201`: Created - Successful resource creation
- `400`: Bad Request - Validation error
- `401`: Unauthorized - Invalid credentials
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `409`: Conflict - Duplicate resource
- `500`: Server Error - Internal server error

---

## Common Headers

All protected endpoints require:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

---

## Authentication APIs

### 1. User Registration

**Endpoint**: `POST /auth/register`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher, or School

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "SecurePass123",
  "role": "teacher",
  "school": "schoolId",
  "image": "https://example.com/image.jpg",
  "studentId": "STU001",
  "gradeLevel": "10",
  "rollNumber": 5,
  "section": "A",
  "dateOfAdmission": "2023-04-15",
  "fatherName": "Father Name",
  "motherName": "Mother Name",
  "parentContact": "9876543211",
  "dateOfBirth": "2010-01-15"
}
```

*Note: Required fields vary by role. For students, include student-specific fields.*

**Response (201 Created)**:
```json
{
  "success": true,
  "msg": "User created successfully",
  "data": {
    "userId": "507f1f77bcf86cd799439011"
  }
}
```

**Error Responses**:
- `400`: Validation error / Invalid role
- `403`: Unauthorized role / Different school assignment
- `409`: User already exists

---

### 2. User Login

**Endpoint**: `POST /auth/login`

**Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": { "_id": "...", "role": "teacher" },
    "_id": "507f1f77bcf86cd799439011",
    "phone": "9876543210",
    "school": { "_id": "...", "schoolName": "..." }
  }
}
```

**Error Responses**:
- `401`: Invalid credentials
- `500`: Server error

---

### 3. Refresh Access Token

**Endpoint**: `POST /auth/refresh`

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Token refreshed",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error Responses**:
- `401`: Refresh token required
- `403`: Invalid refresh token

---

### 4. User Logout

**Endpoint**: `POST /auth/logout`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Logout successful"
}
```

---

### 5. Change Password

**Endpoint**: `POST /auth/change-password`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request Body**:
```json
{
  "oldPassword": "OldPass123",
  "newPassword": "NewPass456"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Password changed successfully"
}
```

**Error Responses**:
- `400`: Password validation errors
- `401`: Wrong old password
- `404`: User not found

---

### 6. Forgot Password

**Endpoint**: `POST /auth/forgot-password`

**Request Body**:
```json
{
  "email": "john@example.com"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Reset link sent to email"
}
```

**Error Responses**:
- `404`: User not found

---

### 7. Reset Password

**Endpoint**: `POST /auth/reset-password`

**Request Body**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "password": "NewPassword123"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Password reset successful"
}
```

**Error Responses**:
- `400`: Invalid/expired token or password validation error
- `500`: Server error

---

### 8. Change User Role

**Endpoint**: `POST /auth/change-role`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin only

**Request Body**:
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "role": "teacherId"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Role updated successfully",
  "data": { /* User object */ }
}
```

---

### 9. School Registration

**Endpoint**: `POST /auth/school/register`

**Request Body**:
```json
{
  "schoolId": "SCHOOL001",
  "email": "admin@school.com",
  "password": "SchoolPass123",
  "schoolName": "Central High School",
  "address": "123 Main Street",
  "city": "New York",
  "state": "NY",
  "pinCode": "10001"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "msg": "School registered successfully",
  "data": {
    "schoolId": "507f1f77bcf86cd799439011"
  }
}
```

---

### 10. School Login

**Endpoint**: `POST /auth/school/login`

**Request Body**:
```json
{
  "email": "admin@school.com",
  "password": "SchoolPass123"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "School login successful",
  "data": {
    "school": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "admin@school.com",
      "schoolName": "Central High School",
      "image": "...",
      "role": { "_id": "...", "role": "admin" }
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### 11. School Refresh Token

**Endpoint**: `POST /auth/school/refresh`

**Request Body**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Token refreshed",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### 12. School Logout

**Endpoint**: `POST /auth/school/logout`

**Request Body**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "School logout successful"
}
```

---

### 13. School Forgot Password

**Endpoint**: `POST /auth/school/forgot-password`

**Request Body**:
```json
{
  "school": "school@example.com"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Reset link sent"
}
```

---

### 14. School Reset Password

**Endpoint**: `POST /auth/school/reset-password`

**Request Body**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "password": "NewSchoolPass123"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "School password reset successful"
}
```

---

## User Management APIs

### 1. Update User Details

**Endpoint**: `POST /auth/update-user/:id`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher, Staff, Student

**URL Parameters**:
- `id`: User ID to update

**Request Body**:
```json
{
  "name": "Updated Name",
  "email": "newemail@example.com",
  "phone": "9876543210",
  "address": "456 New Street",
  "city": "Boston",
  "state": "MA",
  "pinCode": "02101"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "User updated successfully"
}
```

---

### 2. Soft Delete User (Deactivate)

**Endpoint**: `POST /auth/delete-user/:id`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin only

**URL Parameters**:
- `id`: User ID to deactivate

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "User deleted temporarily",
  "data": { /* User object */ }
}
```

---

### 3. Permanently Delete User

**Endpoint**: `POST /auth/delete-user-permanent/:id`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin only

**URL Parameters**:
- `id`: User ID to permanently delete

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "User permanently deleted"
}
```

---

### 4. Reinstate User

**Endpoint**: `POST /auth/reinstate-user/:id`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin only

**URL Parameters**:
- `id`: User ID to reactivate

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "User reinstated successfully",
  "data": { /* User object */ }
}
```

---

## Class Management APIs

### 1. Create Class

**Endpoint**: `POST /class/create`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher

**Request Body**:
```json
{
  "name": "10A",
  "grade": "10",
  "section": "A",
  "capacity": 50,
  "room": "R101"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "msg": "Class created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "10A",
    "grade": "10",
    "section": "A",
    "capacity": 50,
    "room": "R101",
    "school": "507f1f77bcf86cd799439012"
  }
}
```

---

### 2. Assign Class Teacher

**Endpoint**: `POST /class/assign-teacher`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin only

**Request Body**:
```json
{
  "classId": "507f1f77bcf86cd799439011",
  "teacherId": "507f1f77bcf86cd799439020"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Class teacher assigned successfully"
}
```

---

### 3. Assign Student to Class

**Endpoint**: `POST /class/assign-student`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher

**Request Body**:
```json
{
  "studentId": "507f1f77bcf86cd799439030",
  "classId": "507f1f77bcf86cd799439011"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Student assigned to class successfully"
}
```

---

### 4. Remove Student from Class

**Endpoint**: `POST /class/remove-student`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher

**Request Body**:
```json
{
  "studentId": "507f1f77bcf86cd799439030"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Student removed from class successfully"
}
```

---

### 5. Get Class Details

**Endpoint**: `GET /class/:id`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin, Teacher, Student

**URL Parameters**:
- `id`: Class ID

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Class fetched successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "10A",
    "grade": "10",
    "section": "A",
    "capacity": 50,
    "students": [
      { "_id": "...", "name": "Student 1" }
    ],
    "classTeacher": { "_id": "...", "name": "Teacher Name" },
    "subjects": [...]
  }
}
```

---

### 6. Get All Classes

**Endpoint**: `GET /class/all`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin, Teacher

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Classes fetched successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "10A",
      "grade": "10",
      "section": "A"
    }
  ]
}
```

---

## Subject Management APIs

### 1. Create Subject

**Endpoint**: `POST /subject/create`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher

**Request Body**:
```json
{
  "name": "Mathematics",
  "code": "MATH101",
  "classId": "507f1f77bcf86cd799439011",
  "teacherId": "507f1f77bcf86cd799439020",
  "maxMarks": 100
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "msg": "Subject created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439040",
    "name": "Mathematics",
    "code": "MATH101",
    "class": "507f1f77bcf86cd799439011",
    "teacher": "507f1f77bcf86cd799439020",
    "maxMarks": 100
  }
}
```

---

### 2. Get Subjects by Class

**Endpoint**: `GET /subject/class/:classId`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin, Teacher, Student

**URL Parameters**:
- `classId`: Class ID

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Subjects fetched successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439040",
      "name": "Mathematics",
      "code": "MATH101",
      "teacher": {
        "_id": "507f1f77bcf86cd799439020",
        "user": {
          "_id": "...",
          "name": "Teacher Name"
        }
      }
    }
  ]
}
```

---

### 3. Assign Subject to Class

**Endpoint**: `POST /subject/assign-to-class`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher

**Request Body**:
```json
{
  "subjectId": "507f1f77bcf86cd799439040",
  "classId": "507f1f77bcf86cd799439011"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Subject assigned to class successfully",
  "data": {
    "subject": "507f1f77bcf86cd799439040",
    "class": "507f1f77bcf86cd799439011"
  }
}
```

---

### 4. Update Subject

**Endpoint**: `PUT /subject/:id`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher

**URL Parameters**:
- `id`: Subject ID

**Request Body**:
```json
{
  "name": "Mathematics Advanced",
  "teacherId": "507f1f77bcf86cd799439021",
  "maxMarks": 120
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Subject updated successfully"
}
```

---

### 5. Delete Subject

**Endpoint**: `DELETE /subject/:id`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin

**URL Parameters**:
- `id`: Subject ID

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Subject deleted successfully"
}
```

---

## Teacher Management APIs

### 1. Add Teacher to Subject

**Endpoint**: `POST /teacher/add-to-subject`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher

**Request Body**:
```json
{
  "teacherId": "507f1f77bcf86cd799439020",
  "subjectId": "507f1f77bcf86cd799439040"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "msg": "Teacher added to subject successfully",
  "data": {
    "teacher": "507f1f77bcf86cd799439020",
    "subject": "507f1f77bcf86cd799439040"
  }
}
```

---

### 2. Get Teacher Details

**Endpoint**: `GET /teacher/:id`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin, Teacher, Student

**URL Parameters**:
- `id`: Teacher ID

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Teacher fetched successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "user": {
      "_id": "...",
      "name": "Teacher Name",
      "email": "teacher@example.com",
      "phone": "9876543210",
      "image": "..."
    },
    "teachSubjects": [
      {
        "_id": "507f1f77bcf86cd799439040",
        "name": "Mathematics",
        "class": { "name": "10A" }
      }
    ]
  }
}
```

---

## Student Management APIs

### 1. Add Student to Class

**Endpoint**: `POST /student/add-to-class`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher

**Request Body**:
```json
{
  "studentId": "507f1f77bcf86cd799439030",
  "classId": "507f1f77bcf86cd799439011"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "msg": "Student added to class successfully",
  "data": {
    "student": "507f1f77bcf86cd799439030",
    "class": "507f1f77bcf86cd799439011"
  }
}
```

---

### 2. Remove Student from Class

**Endpoint**: `POST /student/remove-from-class`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher

**Request Body**:
```json
{
  "studentId": "507f1f77bcf86cd799439030"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Student removed from class successfully"
}
```

---

### 3. Get Student Details

**Endpoint**: `GET /student/:id`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin, Teacher, Student

**URL Parameters**:
- `id`: Student ID

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Student fetched successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "user": {
      "_id": "...",
      "name": "Student Name",
      "email": "student@example.com",
      "school": "..."
    },
    "class": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "10A",
      "grade": "10"
    },
    "studentId": "STU001"
  }
}
```

---

### 4. Update Student Profile

**Endpoint**: `PUT /student/update/:id`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher, Student

**URL Parameters**:
- `id`: Student ID

**Request Body**:
```json
{
  "name": "Updated Student Name",
  "phone": "9876543210",
  "dateOfAdmission": "2023-04-15",
  "rollNumber": 10
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Student profile updated successfully"
}
```

---

## Attendance APIs

### 1. Mark Attendance

**Endpoint**: `POST /attendance/mark`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher, Staff

**Request Body**:
```json
{
  "userId": "507f1f77bcf86cd799439030",
  "date": "2024-03-26",
  "status": "present",
  "remarks": "Regular attendance",
  "classId": "507f1f77bcf86cd799439011"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "msg": "Attendance marked successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439050",
    "user": "507f1f77bcf86cd799439030",
    "date": "2024-03-26T00:00:00.000Z",
    "status": "present",
    "remarks": "Regular attendance"
  }
}
```

**Allowed Status Values**: `present`, `absent`, `leave`

---

### 2. Get Attendance

**Endpoint**: `GET /attendance`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin, Teacher, Staff, Student

**Query Parameters**:
- `userId` (optional): User ID to get attendance for
- `month` (optional): Month (1-12)
- `year` (optional): Year (YYYY)

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Attendance fetched successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439050",
      "user": "507f1f77bcf86cd799439030",
      "date": "2024-03-26T00:00:00.000Z",
      "status": "present"
    }
  ]
}
```

---

### 3. Get Class Attendance

**Endpoint**: `GET /attendance/class`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin, Teacher

**Query Parameters**:
- `classId`: Class ID (required)
- `month` (optional): Month (1-12)
- `year` (optional): Year (YYYY)

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Class attendance fetched successfully",
  "data": [
    {
      "student": { "name": "Student 1" },
      "totalDays": 20,
      "presentDays": 18,
      "absentDays": 2,
      "leavesDays": 0
    }
  ]
}
```

---

### 4. Get Staff Attendance

**Endpoint**: `GET /attendance/staff`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin

**Query Parameters**:
- `staffId`: Staff ID (required)
- `month` (optional): Month (1-12)
- `year` (optional): Year (YYYY)

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Staff attendance fetched successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439050",
      "user": "507f1f77bcf86cd799439030",
      "date": "2024-03-26T00:00:00.000Z",
      "status": "present"
    }
  ]
}
```

---

### 5. Get Teacher Attendance

**Endpoint**: `GET /attendance/teacher`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin

**Query Parameters**:
- `teacherId`: Teacher ID (required)
- `month` (optional): Month (1-12)
- `year` (optional): Year (YYYY)

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Teacher attendance fetched successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439050",
      "user": "507f1f77bcf86cd799439020",
      "date": "2024-03-26T00:00:00.000Z",
      "status": "present"
    }
  ]
}
```

---

### 6. Update Attendance

**Endpoint**: `POST /attendance/update`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher, Staff

**Request Body**:
```json
{
  "attendanceId": "507f1f77bcf86cd799439050",
  "status": "leave",
  "remarks": "Medical leave"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Attendance updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439050",
    "status": "leave",
    "remarks": "Medical leave"
  }
}
```

---

### 7. Get Today's Attendance

**Endpoint**: `GET /attendance/get-today/:id`

**URL Parameters**:
- `id`: User ID

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Today's attendance fetched successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439050",
    "user": "507f1f77bcf86cd799439030",
    "date": "2024-03-26T00:00:00.000Z",
    "status": "present"
  }
}
```

---

## Progress & Performance APIs

### 1. Add Progress/Marks

**Endpoint**: `POST /progress/create`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Authorization**: Admin, Teacher

**Request Body**:
```json
{
  "studentId": "507f1f77bcf86cd799439030",
  "subjectId": "507f1f77bcf86cd799439040",
  "type": "exam",
  "title": "Mid-term Exam",
  "marksObtained": 85,
  "totalMarks": 100,
  "academicYear": "2023-2024"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "msg": "Progress added successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439060",
    "marksObtained": 85,
    "totalMarks": 100,
    "percentage": 85,
    "grade": "A"
  }
}
```

---

### 2. Get Student Performance

**Endpoint**: `GET /progress/student/:studentId`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin, Teacher

**URL Parameters**:
- `studentId`: Student ID

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Student performance fetched successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439060",
      "subject": { "name": "Mathematics" },
      "marksObtained": 85,
      "totalMarks": 100,
      "percentage": 85,
      "grade": "A"
    }
  ]
}
```

---

### 3. Get Class Result

**Endpoint**: `GET /progress/class/:classId`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin, Teacher

**URL Parameters**:
- `classId`: Class ID

**Query Parameters**:
- `type` (optional): Type of assessment (exam, assignment, etc.)
- `academicYear` (optional): Academic year (2023-2024)

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Class result fetched successfully",
  "data": [
    {
      "studentName": "Student 1",
      "totalMarks": 500,
      "obtained": 425,
      "percentage": 85
    }
  ]
}
```

---

### 4. Get Subject Performance

**Endpoint**: `GET /progress/subject/:subjectId`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin, Teacher

**URL Parameters**:
- `subjectId`: Subject ID

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Subject performance fetched successfully",
  "data": [
    {
      "student": "507f1f77bcf86cd799439030",
      "marksObtained": 85,
      "totalMarks": 100,
      "percentage": 85
    }
  ]
}
```

---

### 5. Generate Student Report (PDF)

**Endpoint**: `GET /progress/report/:studentId`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin, Teacher

**URL Parameters**:
- `studentId`: Student ID

**Response**: PDF file download

---

### 6. Get Student Result by Year

**Endpoint**: `GET /progress/result/student/:studentId`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Authorization**: Admin, Teacher

**URL Parameters**:
- `studentId`: Student ID

**Query Parameters**:
- `academicYear` (optional): Academic year

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Student results fetched successfully",
  "data": [
    {
      "academicYear": "2023-2024",
      "totalSubjects": 5,
      "totalMarks": 500,
      "obtained": 425,
      "percentage": 85
    }
  ]
}
```

---

## Profile APIs

### 1. Get Own Profile

**Endpoint**: `GET /profile/me`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Profile fetched successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "image": "https://example.com/image.jpg",
    "address": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "pinCode": "10001",
    "role": { "_id": "...", "role": "teacher" },
    "school": { "_id": "...", "schoolName": "..." }
  }
}
```

---

### 2. Update Own Profile

**Endpoint**: `PUT /profile/me`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Updated Name",
  "phone": "9876543211",
  "address": "456 New Street",
  "city": "Boston",
  "state": "MA",
  "pinCode": "02101"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Profile updated successfully"
}
```

---

### 3. Upload Profile Image

**Endpoint**: `POST /profile/me/avatar`

**Required Headers**:
```
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

**Request Body** (multipart/form-data):
- `image`: File (JPG, PNG, etc.)

**Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Profile image uploaded successfully",
  "data": {
    "image": "https://cloudinary.example.com/image.jpg"
  }
}
```

---

### 4. Get Any User Basic Profile

**Endpoint**: `GET /profile/:id`

**Required Headers**:
```
Authorization: Bearer <accessToken>
```

**URL Parameters**:
- `id`: User ID to view profile

**Response (200 OK)**:

**If viewing own profile**:
```json
{
  "success": true,
  "msg": "Profile fetched successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "image": "...",
    "address": "...",
    "role": { ... },
    "school": { ... }
  }
}
```

**If viewing other user's profile (same school)**:
```json
{
  "success": true,
  "msg": "Profile fetched successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439030",
    "name": "Another User",
    "email": "another@example.com",
    "school": { "_id": "...", "schoolName": "..." },
    "role": { "role": "student" },
    "image": "..."
  }
}
```

**Error Responses**:
- `403`: Cannot view profile from different school
- `404`: User not found

---

## Authentication Details

### Token Structure

**Access Token (AT)**:
- Expires in: 1 hour
- Used for: API endpoint access
- Claimed in request header as: `Authorization: Bearer <accessToken>`

**Refresh Token (RT)**:
- Expires in: 7 days
- Used for: Obtaining new access tokens
- Stored in database for validation

### Token Refresh Flow

1. Client receives both AT and RT on login
2. When AT expires, use RT to request new AT
3. If RT expires, user must login again

---

## Error Handling

### Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400  | Bad Request | Check request format and required fields |
| 401  | Unauthorized | Check credentials or token |
| 403  | Forbidden | Check user role/permissions |
| 404  | Not Found | Check resource ID |
| 409  | Conflict | Resource already exists |
| 500  | Server Error | Contact support |

---

## Authorization Rules

### Role-Based Access Control

| Endpoint | Admin | Teacher | Staff | Student | School |
|----------|-------|---------|-------|---------|--------|
| Register User | ✅ | ✅ | ❌ | ❌ | ✅ |
| Change Role | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Class | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Subject | ✅ | ✅ | ❌ | ❌ | ❌ |
| Mark Attendance | ✅ | ✅ | ✅ | ❌ | ❌ |
| Add Progress | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Reports | ✅ | ✅ | ❌ | ❌ | ❌ |

### School Boundary Validation

All endpoints validate that users can only access resources within their own school. Cross-school operations return `403 Forbidden`.

---

## Best Practices

1. **Always include Authorization header** for protected endpoints
2. **Use HTTPS** in production
3. **Store tokens securely** in client (HttpOnly cookies recommended)
4. **Refresh tokens proactively** before expiration
5. **Handle 401 responses** by redirecting to login
6. **Validate input** on client before sending
7. **Log errors** for debugging

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-26 | Initial API documentation with 8 controllers standardized |

---

## Support

For API support or issues, please contact the development team or create an issue in the repository.

**Last Updated**: March 26, 2026  
**API Base URL**: `http://localhost:5000/api`  
**Authentication**: JWT Bearer Token
