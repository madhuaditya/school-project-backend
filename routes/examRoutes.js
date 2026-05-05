const express = require('express');
const {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
  getExamsForSubject,
} = require('../controllers/examCtrl');

const { validateUser } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { checkSubscriptionActive } = require('../middleware/subscriptionCheck');

const router = express.Router();

// Apply middleware to all routes
router.use(validateUser, checkSubscriptionActive);

// ==================== CREATE ====================
// POST /api/exam/create - Admin only
router.post('/create', allow('admin'), createExam);

// ==================== READ ====================
// GET /api/exam - All users (paginated, filtered)
router.get('/', getExams);

// GET /api/exam/:examId - All users
router.get('/:examId', getExamById);

// GET /api/exam/class/:classId/subject/:subjectId - All users
// Get all exams for a specific subject in a specific class
router.get('/class/:classId/subject/:subjectId', getExamsForSubject);

// ==================== UPDATE ====================
// PUT /api/exam/:examId - Admin only
router.put('/:examId', allow('admin'), updateExam);

// ==================== DELETE ====================
// DELETE /api/exam/:examId - Admin only
router.delete('/:examId', allow('admin'), deleteExam);

module.exports = router;
