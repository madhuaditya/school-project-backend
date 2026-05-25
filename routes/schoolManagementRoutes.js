const express = require('express');
const { validateUser } = require('../middleware/auth');
const { allow } = require('../middleware/role');
const { checkSubscriptionActive } = require('../middleware/subscriptionCheck');
const { requireSchoolAccount } = require('../middleware/schoolAccount');
const controller = require('../controllers/schoolManagementCtrl');

const router = express.Router();

router.use(validateUser, checkSubscriptionActive, requireSchoolAccount, allow('admin'));

router.get('/overview', controller.getSchoolOverview);

router.post('/admins', controller.createAdmin);
router.get('/admins', controller.listAdmins);
router.get('/admins/:id', controller.getAdminById);
router.put('/admins/:id', controller.updateAdmin);
router.patch('/admins/:id/password', controller.changeAdminPassword);
router.patch('/admins/:id/deactivate', controller.softDeleteAdmin);
router.patch('/admins/:id/restore', controller.restoreAdmin);
router.delete('/admins/:id', controller.hardDeleteAdmin);

router.get('/teachers', controller.listTeachers);
router.get('/teachers/:id', controller.getTeacherById);
router.put('/teachers/:id', controller.updateTeacher);
router.patch('/teachers/:id/password', controller.changeTeacherPassword);
router.patch('/teachers/:id/deactivate', controller.softDeleteTeacher);
router.patch('/teachers/:id/restore', controller.restoreTeacher);
router.delete('/teachers/:id', controller.hardDeleteTeacher);

router.get('/staffs', controller.listStaff);
router.get('/staffs/:id', controller.getStaffById);
router.put('/staffs/:id', controller.updateStaff);
router.patch('/staffs/:id/password', controller.changeStaffPassword);
router.patch('/staffs/:id/deactivate', controller.softDeleteStaff);
router.patch('/staffs/:id/restore', controller.restoreStaff);
router.delete('/staffs/:id', controller.hardDeleteStaff);

router.get('/students', controller.listStudents);
router.get('/students/:id', controller.getStudentById);
router.put('/students/:id', controller.updateStudent);
router.patch('/students/:id/password', controller.changeStudentPassword);
router.patch('/students/:id/deactivate', controller.softDeleteStudent);
router.patch('/students/:id/restore', controller.restoreStudent);
router.delete('/students/:id', controller.hardDeleteStudent);

router.get('/classes', controller.listClasses);
router.put('/classes/:id', controller.updateClassById);
router.patch('/classes/:id/deactivate', controller.softDeleteClass);
router.patch('/classes/:id/restore', controller.restoreClass);
router.delete('/classes/:id', controller.hardDeleteClass);

router.get('/subjects', controller.listSubjects);
router.put('/subjects/:id', controller.updateSubjectById);
router.patch('/subjects/:id/deactivate', controller.softDeleteSubject);
router.patch('/subjects/:id/restore', controller.restoreSubject);
router.delete('/subjects/:id', controller.hardDeleteSubject);

router.get('/subscription', controller.getSchoolSubscription);
router.put('/subscription', controller.updateSchoolSubscription);
router.put('/subscription/renew', controller.renewSchoolSubscription);

module.exports = router;