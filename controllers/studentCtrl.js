const Student = require('../models/student');
const Class = require('../models/class');
const User = require('../models/user');
const School = require('../models/school');
const cloudinary = require('../config/cloudinary');
const ejs = require('ejs');
const path = require('path');
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');

// ==================== RESPONSE FORMAT ====================
const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

const getSchoolIdFromUser = (user) => {
  if (!user || !user.school) return null;
  if (typeof user.school === 'string') return user.school;
  return user.school._id?.toString() || user.school.toString();
};

const uploadBufferToCloudinary = (buffer, folderName) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );

    stream.end(buffer);
  });
};

const buildClassLabel = (classDoc) => {
  if (!classDoc) return 'N/A';
  const name = classDoc.name || classDoc.grade || 'Class';
  const section = classDoc.section ? ` ${classDoc.section}` : '';
  return `${name}${section}`.trim();
};

const buildIdCardPayload = ({ student, school, schoolOverrides = {}, studentOverrides = {} }) => {
  const user = student.user || {};
  const classDoc = student.class || null;
  const now = new Date();

  const payload = {
    studentId: student._id.toString(),
    admissionNo: student.admissionNo || student._id.toString().slice(-8).toUpperCase(),
    name: studentOverrides.name || user.name || 'Student Name',
    fatherName: studentOverrides.fatherName || student.fatherName || 'N/A',
    motherName: studentOverrides.motherName || student.motherName || 'N/A',
    classLabel: studentOverrides.classLabel || buildClassLabel(classDoc),
    rollNumber: studentOverrides.rollNumber || student.rollNumber || 'N/A',
    bloodGroup: studentOverrides.bloodGroup || student.bloodGroup || 'N/A',
    dateOfBirth: studentOverrides.dateOfBirth || (student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-GB') : 'N/A'),
    parentContact: studentOverrides.parentContact || student.parentContact || user.phone || 'N/A',
    address: studentOverrides.address || student.address || user.address || 'N/A',
    schoolName: schoolOverrides.schoolName || school.schoolName || school.name || 'School Name',
    schoolAddress: schoolOverrides.schoolAddress || school.address || 'N/A',
    schoolPhone: schoolOverrides.schoolPhone || school.phone || 'N/A',
    schoolEmail: schoolOverrides.schoolEmail || school.email || 'N/A',
    logoUrl: schoolOverrides.logoUrl || school.idCardLogo || school.image || null,
    studentPhoto: studentOverrides.studentPhoto || student.idCardPhoto || user.image || null,
    principalName: schoolOverrides.principalName || school.idCardSettings?.principalName || 'Principal',
    signatureLabel: schoolOverrides.signatureLabel || school.idCardSettings?.signatureLabel || 'Principal Signature',
    principalSignatureUrl: schoolOverrides.principalSignatureUrl || school.idCardSettings?.principalSignatureUrl || null,
    validUntil: studentOverrides.validUntil || `${now.getFullYear() + 1}-03-31`,
    qrText: studentOverrides.qrText || [
      `Student: ${studentOverrides.name || user.name || 'N/A'}`,
      `Admission No: ${student.admissionNo || 'N/A'}`,
      `Class: ${buildClassLabel(classDoc)}`,
      `School: ${school.schoolName || school.name || 'N/A'}`
    ].join(' | '),
  };

  return payload;
};

const renderIdCardsPdf = async ({ cards, templateId }) => {
  const cardsWithQr = await Promise.all(cards.map(async (card) => {
    let qrCodeDataUrl = null;

    try {
      qrCodeDataUrl = await QRCode.toDataURL(card.qrText || card.studentId, {
        errorCorrectionLevel: 'M',
        margin: 0,
        width: 220,
      });
    } catch {
      qrCodeDataUrl = null;
    }

    return {
      ...card,
      qrCodeDataUrl,
    };
  }));

  const html = await ejs.renderFile(
    path.join(__dirname, '../templates/studentIdCards.ejs'),
    { cards: cardsWithQr, templateId }
  );

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '8mm',
      right: '8mm',
      bottom: '8mm',
      left: '8mm',
    },
  });

  await browser.close();

  return pdfBuffer;
};

// ================= ADD STUDENT TO CLASS =================
const addStudentToClass = async (req, res) => {
  try {
    const { studentId, classId } = req.body;
    const adminInfo = req.user; // authenticated user (admin or teacher)

    // Validate student exists
    const student = await Student.findById(studentId).populate({
      path: 'user',
      select: 'school'
    });
    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    // Validate class exists
    const cls = await Class.findById(classId).populate('school');
    if (!cls) return res.status(404).json(formatResponse(false, "Class not found"));

    // Check if both are in same school
    if (student.user.school.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Student not in your school"));

    if (cls.school._id.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Class not in your school"));

    // Check authorization - only admin and teacher allowed
    if (!(['admin', 'teacher'].includes(adminInfo.role.role)))
      return res.status(403).json(formatResponse(false, "Unauthorized"));

    // Assign student to class
    student.class = classId;
    student.section = cls.section;
    
    await student.save();

    return res.status(201).json(formatResponse(true, "Student added to class successfully", {
      student: student._id,
      class: cls._id
    }));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error adding student to class", null, e.message));
  }
};

// ================= REMOVE STUDENT FROM CLASS =================
const removeStudentFromClass = async (req, res) => {
  try {
    const { studentId } = req.body;
    const adminInfo = req.user;

    const student = await Student.findById(studentId).populate({
      path: 'user',
      select: 'school'
    });
    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    // Check authorization
    if (student.user.school.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));

    if (!(['admin', 'teacher'].includes(adminInfo.role.role)))
      return res.status(403).json(formatResponse(false, "Unauthorized"));

    student.class = null;
    await student.save();

    return res.status(200).json(formatResponse(true, "Student removed from class successfully"));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error removing student from class", null, e.message));
  }
};

// ================= GET STUDENT DETAILS =================
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req?.user?.role?.role;

    const student = await Student.findOne({ $or: [{ _id: id }, { user: id }] })
      .populate({
        path: 'user',
        select: '-password -refreshToken -resetToken -resetTokenExp -v',
      })
      .populate({
        path: 'class',
        select: 'name grade section'
      });

    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    if (!student.user || !student.user.school || !req.user || !req.user.school || !req.user.school._id) {
      return res.status(400).json(formatResponse(false, "School context missing"));
    }

    // Check school authorization
    if (student.user.school.toString() !== req.user.school._id.toString())
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));

    if (role === 'student' && student.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, 'Students can view only their own profile'));
    }

    return res.status(200).json(formatResponse(true, "Student fetched successfully", { ...student.user.toObject(), ...student.toObject() }));

  } catch (e) {
    return res.status(500).json(formatResponse(false, "Error fetching student", null, e.message));
  }
};

const updateStudentProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { fatherName, motherName, parentContact, address, dateOfBirth, gpa, gradeLevel, rollNumber, status } = req.body;
    const adminInfo = req.user;

    // Validate student exists
    const student = await Student.findById(id).populate({
      path: 'user',
      select: 'school _id'
    });
    if (!student) return res.status(404).json(formatResponse(false, "Student not found"));

    // Check school authorization
    if (student.user.school.toString() !== adminInfo.school._id.toString())
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));

    // Authorization check
    const isAdmin = adminInfo.role.role === 'admin';
    const isTeacher = adminInfo.role.role === 'teacher';
    const isOwnProfile = student.user._id.toString() === adminInfo._id.toString();

    if (!isAdmin && !isTeacher && !isOwnProfile)
      return res.status(403).json(formatResponse(false, "Unauthorized"));

    // Students can only update their own profile with limited fields
    if (!isAdmin && !isTeacher && isOwnProfile) {
      // Student can only update certain fields
      if (fatherName) student.fatherName = fatherName;
      if (motherName) student.motherName = motherName;
      if (parentContact) student.parentContact = parentContact;
      if (address) student.address = address;
      if (dateOfBirth) student.dateOfBirth = dateOfBirth;
    } else {
      // Admin and teacher can update all fields
      if (fatherName) student.fatherName = fatherName;
      if (motherName) student.motherName = motherName;
      if (parentContact) student.parentContact = parentContact;
      if (address) student.address = address;
      if (dateOfBirth) student.dateOfBirth = dateOfBirth;
      if (gpa !== undefined) student.gpa = gpa;
      if (gradeLevel) student.gradeLevel = gradeLevel;
      if (rollNumber) student.rollNumber = rollNumber;
      if (status) student.status = status;
    }

    await student.save();

    return res.status(200).json(formatResponse(true, "Student profile updated successfully", {
      studentId: student._id,
      updatedFields: {
        fatherName,
        motherName,
        parentContact,
        address,
        dateOfBirth,
        gpa,
        gradeLevel,
        rollNumber,
        status
      }
    }));

  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error updating student profile", null, error.message));
  }
};

const getIdCardClasses = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromUser(req.user);
    if (!schoolId) return res.status(400).json(formatResponse(false, 'School context missing'));

    const [classes, school] = await Promise.all([
      Class.find({ school: schoolId }).select('_id name section grade').sort({ name: 1, section: 1 }).lean(),
      School.findById(schoolId).select('schoolName schoolID address phone email idCardLogo image idCardSettings').lean(),
    ]);

    const classIds = classes.map((item) => item._id);
    const studentCounts = await Student.aggregate([
      { $match: { class: { $in: classIds } } },
      { $group: { _id: '$class', count: { $sum: 1 } } },
    ]);

    const countMap = studentCounts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    const enriched = classes.map((item) => ({
      ...item,
      studentCount: countMap[item._id.toString()] || 0,
      label: `${item.name}${item.section ? ` - ${item.section}` : ''}`,
    }));

    return res.status(200).json(formatResponse(true, 'ID card classes fetched successfully', {
      classes: enriched,
      school,
    }));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching ID card classes', null, error.message));
  }
};

const getStudentsForIdCards = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromUser(req.user);
    const { classId } = req.params;

    const classDoc = await Class.findById(classId).select('_id name section school').lean();
    if (!classDoc) return res.status(404).json(formatResponse(false, 'Class not found'));
    if (classDoc.school.toString() !== schoolId) return res.status(403).json(formatResponse(false, 'Unauthorized school access'));

    const students = await Student.find({ class: classId })
      .populate({ path: 'user', select: 'name image phone school address city state pinCode' })
      .select('_id admissionNo rollNumber fatherName motherName dateOfBirth parentContact address bloodGroup class idCardPhoto')
      .sort({ rollNumber: 1, createdAt: 1 })
      .lean();

    const sanitized = students
      .filter((student) => student?.user?.school?.toString() === schoolId)
      .map((student) => ({
        _id: student._id,
        name: student.user?.name || 'N/A',
        admissionNo: student.admissionNo || 'N/A',
        rollNumber: student.rollNumber || 'N/A',
        fatherName: student.fatherName || '',
        motherName: student.motherName || '',
        dateOfBirth: student.dateOfBirth || null,
        parentContact: student.parentContact || student.user?.phone || '',
        address: student.address || student.user?.address || '',
        bloodGroup: student.bloodGroup || '',
        photo: student.idCardPhoto || student.user?.image || null,
      }));

    return res.status(200).json(formatResponse(true, 'Class students fetched successfully', {
      classInfo: {
        _id: classDoc._id,
        name: classDoc.name,
        section: classDoc.section,
      },
      students: sanitized,
    }));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching class students', null, error.message));
  }
};

const uploadSchoolIdCardLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json(formatResponse(false, 'Logo file is required'));

    const schoolId = getSchoolIdFromUser(req.user);
    const school = await School.findById(schoolId);
    if (!school) return res.status(404).json(formatResponse(false, 'School not found'));

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, 'schools/id-cards/logos');

    school.idCardLogo = uploadResult.secure_url;
    await school.save();

    return res.status(200).json(formatResponse(true, 'School logo uploaded successfully', {
      logoUrl: uploadResult.secure_url,
    }));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error uploading school logo', null, error.message));
  }
};

const uploadSchoolPrincipalSignature = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json(formatResponse(false, 'Principal signature file is required'));

    const schoolId = getSchoolIdFromUser(req.user);
    const school = await School.findById(schoolId);
    if (!school) return res.status(404).json(formatResponse(false, 'School not found'));

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, 'schools/id-cards/signatures');

    if (!school.idCardSettings) school.idCardSettings = {};
    school.idCardSettings.principalSignatureUrl = uploadResult.secure_url;
    await school.save();

    return res.status(200).json(formatResponse(true, 'Principal signature uploaded successfully', {
      principalSignatureUrl: uploadResult.secure_url,
    }));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error uploading principal signature', null, error.message));
  }
};

const uploadStudentIdCardPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json(formatResponse(false, 'Student photo is required'));

    const schoolId = getSchoolIdFromUser(req.user);
    const { studentId } = req.params;
    const student = await Student.findById(studentId).populate({ path: 'user', select: 'school' });

    if (!student) return res.status(404).json(formatResponse(false, 'Student not found'));
    if (!student.user?.school || student.user.school.toString() !== schoolId) {
      return res.status(403).json(formatResponse(false, 'Unauthorized school access'));
    }

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, 'schools/id-cards/students');
    student.idCardPhoto = uploadResult.secure_url;
    await student.save();

    return res.status(200).json(formatResponse(true, 'Student photo uploaded successfully', {
      photoUrl: uploadResult.secure_url,
      studentId: student._id,
    }));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error uploading student photo', null, error.message));
  }
};

const generateSingleIdCardPdf = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromUser(req.user);
    const {
      studentId,
      templateId = 'template-1',
      schoolOverrides = {},
      studentOverrides = {},
    } = req.body;

    if (!studentId) return res.status(400).json(formatResponse(false, 'studentId is required'));

    const [school, student] = await Promise.all([
      School.findById(schoolId).select('schoolName name address phone email idCardLogo image idCardSettings').lean(),
      Student.findById(studentId)
        .populate({ path: 'user', select: 'name image phone address school' })
        .populate({ path: 'class', select: 'name section grade' }),
    ]);

    if (!student) return res.status(404).json(formatResponse(false, 'Student not found'));
    if (!school) return res.status(404).json(formatResponse(false, 'School not found'));

    if (!student.user?.school || student.user.school.toString() !== schoolId) {
      return res.status(403).json(formatResponse(false, 'Unauthorized school access'));
    }

    const cardData = buildIdCardPayload({
      student,
      school,
      schoolOverrides,
      studentOverrides,
    });

    const pdfBuffer = await renderIdCardsPdf({ cards: [cardData], templateId });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=id-card-${cardData.admissionNo || cardData.studentId}.pdf`,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error generating student ID card', null, error.message));
  }
};

const generateBulkIdCardPdf = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromUser(req.user);
    const {
      templateId = 'template-1',
      schoolOverrides = {},
      studentIds = [],
      classId,
      includeWholeClass = false,
      overridesByStudent = {},
    } = req.body;

    const school = await School.findById(schoolId).select('name address phone email idCardLogo image idCardSettings').lean();
    
    if (school && !school.schoolName && school.name) {
      school.schoolName = school.name;
    }

    if (!school) return res.status(404).json(formatResponse(false, 'School not found'));

    let finalStudentIds = Array.isArray(studentIds) ? [...new Set(studentIds.filter(Boolean))] : [];

    if (includeWholeClass) {
      if (!classId) return res.status(400).json(formatResponse(false, 'classId is required for class bulk generation'));

      const classDoc = await Class.findById(classId).select('_id school').lean();
      if (!classDoc) return res.status(404).json(formatResponse(false, 'Class not found'));
      if (classDoc.school.toString() !== schoolId) {
        return res.status(403).json(formatResponse(false, 'Unauthorized school access'));
      }

      const classStudents = await Student.find({ class: classId }).select('_id').lean();
      finalStudentIds = classStudents.map((item) => item._id.toString());
    }

    if (!finalStudentIds.length) {
      return res.status(400).json(formatResponse(false, 'No students selected for bulk generation'));
    }

    if (finalStudentIds.length > 300) {
      return res.status(400).json(formatResponse(false, 'Bulk generation limit is 300 students per request'));
    }

    const students = await Student.find({ _id: { $in: finalStudentIds } })
      .populate({ path: 'user', select: 'name image phone address school' })
      .populate({ path: 'class', select: 'name section grade' });

    const authorizedStudents = students.filter((student) => student?.user?.school?.toString() === schoolId);

    if (!authorizedStudents.length) {
      return res.status(404).json(formatResponse(false, 'No valid students found in your school'));
    }

    const cards = authorizedStudents.map((student) =>
      buildIdCardPayload({
        student,
        school,
        schoolOverrides,
        studentOverrides: overridesByStudent?.[student._id.toString()] || {},
      })
    );

    const pdfBuffer = await renderIdCardsPdf({ cards, templateId });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=id-cards-merged-${Date.now()}.pdf`,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error generating bulk ID cards', null, error.message));
  }
};

module.exports = {
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
};
