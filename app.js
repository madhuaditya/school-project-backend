// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require("./routes/attendanceRoutes");
const classRoutes = require('./routes/classRoutes')
const subjectRoutes = require('./routes/subjectRoutes')
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');
const progressRoutes = require('./routes/progressRoutes');
const examRoutes = require('./routes/examRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const timeTableRoutes = require('./routes/timeTableRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const chatRoutes = require('./routes/chatRoutes');
const replyRoutes = require('./routes/replyRoutes');
const feeStructureRoutes = require('./routes/feeStructureRoutes');
const salaryStructureRoutes = require('./routes/salaryStructureRoutes');
const feeManagementRoutes = require('./routes/feeManagementRoutes');
const salaryManagementRoutes = require('./routes/salaryManagementRoutes');
const alertRoutes = require('./routes/alertRoutes');
const broadcastRoutes = require('./routes/broadcastRoutes');
const messagingRoutes = require('./routes/messagingRoutes');
const sanitizeResponse = require("./middleware/sanitizeResponse")
const profileRoutes = require('./routes/profileRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const schoolManagementRoutes = require('./routes/schoolManagementRoutes');
const dotenv = require("dotenv")
dotenv.config();
const app = express();

// Disable ETag generation to avoid conditional 304 responses on API endpoints.
app.set('etag', false);

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
  });
  next();
});
app.use('/api/auth', authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/class", classRoutes)
app.use('/api/subject', subjectRoutes)
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notice', noticeRoutes);
app.use('/api/timetable', timeTableRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reply', replyRoutes);
app.use('/api/fee-structure', feeStructureRoutes);
app.use('/api/salary-structure', salaryStructureRoutes);
app.use('/api/fee-management', feeManagementRoutes);
app.use('/api/salary-management', salaryManagementRoutes);
app.use('/api/alert', alertRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/messaging', messagingRoutes);
// app.use(sanitizeResponse)
app.use('/api/profile', profileRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/school-management', schoolManagementRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

module.exports = app;
