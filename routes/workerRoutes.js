// const express = require('express');
// const { validateUser } = require('../middleware/auth');
// const { allow } = require('../middleware/role');
// const { assignWorker,getUserAreNotAdmin } = require('../controllers/workerAdminCtrl');
// const { markAttendance, getAttendance,getAttendanceByWorkerId,getTodayAttendanceByWorkerId ,getWorkersByManagerId} = require('../controllers/attendanceCtrl');
// const { addSalary, getSalaryLogs } = require('../controllers/salaryCtrl');

// const r = express.Router();

// r.post('/assign', validateUser, allow('admin'), assignWorker);
// // r.get('/assign-workers', validateUser, allow('admin'), getWokerAssignments);
// r.get('/users', validateUser, allow('admin'), getUserAreNotAdmin);

// r.post('/attendance', validateUser, allow('admin', 'manager'), markAttendance);
// r.get('/attendance', validateUser, allow('admin', 'manager'), getAttendance);
// r.get('/attendance/:workerId', validateUser, allow('admin', 'manager','worker'), getAttendanceByWorkerId);
// r.get('/attendance/today/:workerId', validateUser, allow('admin', 'manager','worker'), getTodayAttendanceByWorkerId);

// r.get('/worker-under-manager', validateUser, allow('admin','manager'), getWorkersByManagerId);

// r.post('/salary', validateUser, allow('admin', 'manager'), addSalary);
// r.get('/salary', validateUser, allow('admin', 'manager'), getSalaryLogs);

// module.exports = r;
