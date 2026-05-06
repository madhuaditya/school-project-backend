const ejs = require('ejs');
const path = require('path');
const School = require('../models/school');
const Student = require('../models/student');

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const toMoney = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

const formatMoney = (value) => toMoney(value).toFixed(2);

const toTitleCase = (value = '') =>
  String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getSchoolIdFromUser = (user) => {
  if (!user || !user.school) return null;
  if (typeof user.school === 'string') return user.school;
  return user.school._id?.toString() || user.school.toString();
};

const buildReceiptNumber = (prefix, payment) => {
  const paidAt = payment?.paidAt ? new Date(payment.paidAt) : new Date();
  const year = paidAt.getFullYear();
  const month = String(paidAt.getMonth() + 1).padStart(2, '0');
  const token = String(payment?._id || '').slice(-8).toUpperCase();
  return `${prefix}-${year}${month}-${token}`;
};

const getSchoolPayload = async (schoolId) => {
  const school = await School.findById(schoolId)
    .select('schoolName name address city state pinCode phone email schoolId')
    .lean();

  if (!school) return null;

  return {
    schoolName: school.schoolName || school.name || 'School',
    phone: school.phone || 'N/A',
    email: school.email || 'N/A',
    schoolId: school.schoolId || 'N/A',
    addressLine: [school.address, school.city, school.state, school.pinCode].filter(Boolean).join(', ') || 'N/A',
  };
};

const buildFeeComponents = (components = {}) =>
  Object.entries(components).map(([key, value]) => ({
    label: toTitleCase(key),
    amount: formatMoney(value || 0),
  }));

const buildSalaryEntries = (items = {}) =>
  Object.entries(items).map(([key, value]) => ({
    label: toTitleCase(key),
    amount: formatMoney(value || 0),
  }));

const getStudentMeta = async (studentUserId) => {
  const student = await Student.findOne({ user: studentUserId })
    .populate('class', '_id name grade section')
    .select('_id studentId rollNumber fatherName parentContact')
    .lean();

  return {
    studentId: student?.studentId || 'N/A',
    rollNumber: student?.rollNumber || 'N/A',
    fatherName: student?.fatherName || 'N/A',
    contact: student?.parentContact || 'N/A',
    classLabel: student?.class
      ? [student.class.name || `Grade ${student.class.grade || ''}`, student.class.section || ''].filter(Boolean).join(' ')
      : 'N/A',
  };
};

const renderFeeSlipHtml = async ({ payment, monthSummary, schoolId }) => {
  const school = await getSchoolPayload(schoolId);
  if (!school) throw new Error('School not found');

  const studentMeta = await getStudentMeta(payment?.user?._id || payment?.user);
  const feeStructure = payment?.feeStructureId || {};

  const templateData = {
    school,
    student: {
      name: payment?.user?.name || 'Student',
      studentId: studentMeta.studentId,
      classLabel: payment?.class
        ? [payment.class.name || `Grade ${payment.class.grade || ''}`, payment.class.section || ''].filter(Boolean).join(' ')
        : studentMeta.classLabel,
      rollNumber: studentMeta.rollNumber,
      fatherName: studentMeta.fatherName,
      contact: studentMeta.contact,
    },
    slip: {
      receiptNumber: buildReceiptNumber('FEE', payment),
      paymentDate: payment?.paidAt ? new Date(payment.paidAt).toLocaleString() : 'N/A',
      periodLabel: `${monthNames[(payment?.month || 1) - 1] || payment?.month}/${payment?.year || ''}`,
      method: payment?.method || 'N/A',
      transactionId: payment?.transactionId || 'N/A',
      expectedAmount: formatMoney(monthSummary?.expectedAmount || 0),
      amountPaidThisTime: formatMoney(toMoney(payment?.amount || 0) + toMoney(payment?.lateFee || 0)),
      lateFee: formatMoney(payment?.lateFee || 0),
      totalPaid: formatMoney(monthSummary?.paidAmount || 0),
      remainingDue: formatMoney(monthSummary?.dueAmount || 0),
      status: monthSummary?.status || payment?.status || 'PENDING',
      remarks: payment?.remarks || 'N/A',
      receivedBy: payment?.createdBy?.name || 'Admin',
    },
    feeComponents: buildFeeComponents(feeStructure?.components || {}),
  };

  const html = await ejs.renderFile(
    path.join(__dirname, '../templates/feePaymentSlip.ejs'),
    templateData
  );

  return {
    html,
    meta: templateData,
  };
};

const renderSalarySlipHtml = async ({ payment, monthSummary, schoolId }) => {
  const school = await getSchoolPayload(schoolId);
  if (!school) throw new Error('School not found');

  const salaryStructure = payment?.salaryStructureId || {};

  const templateData = {
    school,
    staff: {
      name: payment?.staffId?.name || 'Staff',
      role: payment?.staffId?.role?.role || salaryStructure?.role || 'N/A',
      email: payment?.staffId?.email || 'N/A',
      phone: payment?.staffId?.phone || 'N/A',
    },
    slip: {
      receiptNumber: buildReceiptNumber('SAL', payment),
      paymentDate: payment?.paidAt ? new Date(payment.paidAt).toLocaleString() : 'N/A',
      periodLabel: `${monthNames[(payment?.month || 1) - 1] || payment?.month}/${payment?.year || ''}`,
      method: payment?.method || 'N/A',
      transactionId: payment?.transactionId || 'N/A',
      expectedAmount: formatMoney(monthSummary?.expectedAmount || 0),
      amountPaidThisTime: formatMoney(payment?.amount || 0),
      totalPaid: formatMoney(monthSummary?.paidAmount || 0),
      remainingDue: formatMoney(monthSummary?.dueAmount || 0),
      status: monthSummary?.status || payment?.status || 'PENDING',
      remarks: payment?.remarks || 'N/A',
      receivedBy: payment?.createdBy?.name || 'Admin',
    },
    earnings: buildSalaryEntries(salaryStructure?.components || {}),
    deductions: buildSalaryEntries(salaryStructure?.deductions || {}),
  };

  const html = await ejs.renderFile(
    path.join(__dirname, '../templates/salaryPaymentSlip.ejs'),
    templateData
  );

  return {
    html,
    meta: templateData,
  };
};

module.exports = {
  formatMoney,
  getSchoolIdFromUser,
  renderFeeSlipHtml,
  renderSalarySlipHtml,
};
