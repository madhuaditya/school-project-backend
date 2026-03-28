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
const dashboardRoutes = require('./routes/dashboardRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const timeTableRoutes = require('./routes/timeTableRoutes');
const sanitizeResponse = require("./middleware/sanitizeResponse")
const profileRoutes = require('./routes/profileRoutes');
const dotenv = require("dotenv")
dotenv.config();
const app = express();

// Disable ETag generation to avoid conditional 304 responses on API endpoints.
// app.set('etag', false);

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
// app.use('/api', (req, res, next) => {
//   res.set({
//     'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
//     Pragma: 'no-cache',
//     Expires: '0',
//     'Surrogate-Control': 'no-store',
//   });
//   next();
// });
app.use('/api/auth', authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/class", classRoutes)
app.use('/api/subject', subjectRoutes)
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notice', noticeRoutes);
app.use('/api/timetable', timeTableRoutes);
app.use(sanitizeResponse)
// app.use('/test',testRouts);
app.use('/api/profile', profileRoutes);
// app.use('/sales', saleRoutes);
// app.use('/invoice', require('./routes/invoiceRoutes'));
// app.use('/transport', require('./routes/transportRoutes'));
// app.use('/materials', require('./routes/rawMaterialRoutes'));
// app.use('/material-alerts', require('./routes/materialAlertRoutes'));
// app.use('/workers', require('./routes/workerRoutes'));
// app.use('/maintenance', require('./routes/maintenanceRoutes'));
// app.use('/sales-analytics', require('./routes/salesAnalyticsRoutes'));
// app.use('/stock', require('./routes/stockRoutes'));
// app.use('/reminders', require('./routes/reminderRoutes'));


app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

module.exports = app;
