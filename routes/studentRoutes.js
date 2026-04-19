const express = require("express");
const {
  addStudentToClass,
  removeStudentFromClass,
  getStudentById,
  updateStudentProfile,
  getIdCardClasses,
  getStudentsForIdCards,
  uploadSchoolIdCardLogo,
  uploadSchoolPrincipalSignature,
  uploadStudentIdCardPhoto,
  generateSingleIdCardPdf,
  generateBulkIdCardPdf,
} = require("../controllers/studentCtrl");

const { validateUser } = require("../middleware/auth");
const { allow } = require("../middleware/role");
const { checkSubscriptionActive } = require("../middleware/subscriptionCheck");
const upload = require('../middleware/upload');

const router = express.Router();

router.use(validateUser, checkSubscriptionActive);

// ID CARD DASHBOARD SOURCES
router.get('/id-card/classes', allow('admin', 'teacher'), getIdCardClasses);
router.get('/id-card/class/:classId/students', allow('admin', 'teacher'), getStudentsForIdCards);

// ID CARD UPLOADS
router.post('/id-card/upload-school-logo', allow('admin', 'teacher'), upload.single('logo'), uploadSchoolIdCardLogo);
router.post('/id-card/upload-principal-signature', allow('admin', 'teacher'), upload.single('signature'), uploadSchoolPrincipalSignature);
router.post('/id-card/upload-student-photo/:studentId', allow('admin', 'teacher'), upload.single('photo'), uploadStudentIdCardPhoto);

// ID CARD PDF GENERATION
router.post('/id-card/generate-single', allow('admin', 'teacher'), generateSingleIdCardPdf);
router.post('/id-card/generate-bulk', allow('admin', 'teacher'), generateBulkIdCardPdf);

// ADD STUDENT TO CLASS
router.post("/add-to-class", allow("admin", "teacher"), addStudentToClass);

// UPDATE STUDENT PROFILE
router.put("/update/:id", allow('admin', 'teacher', 'student'), updateStudentProfile);

// REMOVE STUDENT FROM CLASS
router.post("/remove-from-class", allow("admin", "teacher"), removeStudentFromClass);

// GET STUDENT DETAILS
router.get("/:id", allow("admin", "teacher", "student"), getStudentById);

module.exports = router;
