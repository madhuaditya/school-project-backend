const mongoose = require('mongoose');
const School = require('../models/school');
const User = require('../models/user');
const Admin = require('../models/admin');

const validateStudentOfSchool = async (student_id, school_id) => {
    try {
        const student = await User.findById(student_id).populate('school', 'id');
        if (!student) {
            return false;
        }
        return student.school.id.toString() === school_id.toString();
    } catch (err) {
        console.error('Error validating student of school:', err);
        return false;
    }
}

const validateStudentAndAdminofSchool = async (student_id, admin_id, school_id) => {
    try {
        const student = await User.findById(student_id).populate('school', 'id');
        const admin = await Admin.findById(admin_id).populate('user', 'school');
        if (!student || !admin) {
            return false;
        }
        return student.school.id.toString() === school_id.toString() && admin.user.school.toString() === school_id.toString();
    } catch (err) {
        console.error('Error validating student and admin of school:', err);
        return false;
    }
}


const validateStudentAndTeacherOfSchool = async (student_id, teacher_id, school_id) => {
    try {
        const student = await User.findById(student_id).populate('school', 'id');
        const teacher = await User.findById(teacher_id).populate('school', 'id');
        if (!student || !teacher) {
            return false;
        }
        return student.school.id.toString() === school_id.toString() && teacher.school.id.toString() === school_id.toString();
    } catch (err) {
        console.error('Error validating student and teacher of school:', err);
        return false;
    }
}

const validateStudentandClassTeacherOfSchool = async (student_id, teacher_id, sclass_id, school_id) => {
    try {
        const student = await User.findById(student_id).populate('school', 'id');
        const teacher = await User.findById(teacher_id).populate('school', 'id');
        const sclass = await Sclass.findById(sclass_id).populate('school', 'id');
        if (!student || !teacher || !sclass) {
            return false;
        }
        return student.school.id.toString() === school_id.toString() && teacher.school.id.toString() === school_id.toString() && sclass.school.id.toString() === school_id.toString();
    } catch (err) {
        console.error('Error validating student, teacher and class of school:', err);
        return false;
    }
}


const validateSchoolAndAdmin = async (school_id, admin_id) => {
    try {
        const school = await School.findById(school_id).populate('admin', 'id');
        if (!school) {
            return false;
        }
        return school.admin && school.admin.id.toString() === admin_id.toString();
    } catch (err) {
        console.error('Error validating school and admin:', err);
        return false;
    }
}



const validateAdminOfSchool = async (admin_id, school_id) => {
    try {
        const admin = await Admin.findById(admin_id).populate('user', 'school');
        if (!admin) {
            return false;
        }
        return admin.user.school.toString() === school_id.toString();
    } catch (err) {
        console.error('Error validating admin of school:', err);
        return false;
    }
}

const validateOfTeacherOfSchool = async (teacher_id, school_id) => {
    return false;
}

const validateOfSubjectOfSchool = async (subject_id, school_id) => {
    return false;
}

const validateOfClassOfSchool = async (sclass_id, school_id) => {
    return false;
}

module.exports = {
    validateStudentOfSchool,
    validateStudentAndAdminofSchool,
    validateStudentAndTeacherOfSchool,
    validateStudentandClassTeacherOfSchool,
    validateSchoolAndAdmin,
    validateAdminOfSchool,
    validateOfTeacherOfSchool,
    validateOfSubjectOfSchool,
    validateOfClassOfSchool
};