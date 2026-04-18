const mongoose = require("mongoose");
const Payment = require("../models/payment");
const FeeStructure = require("../models/feeStructure");
const Student = require("../models/student");
const Class = require("../models/class");

const FEE_METHODS = ["UPI", "CARD", "NETBANKING","BANK", "CASH"];

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const toMoney = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

const sumObjectValues = (obj = {}) =>
  Object.values(obj).reduce((acc, value) => acc + toMoney(value || 0), 0);

const getFeeStructureTotal = (structure) =>
  toMoney(sumObjectValues(structure?.components || {}));

const deriveStatus = ({ paymentCount, expectedAmount, paidAmount }) => {
  if (paymentCount === 0) return "PENDING";
  if (toMoney(paidAmount) >= toMoney(expectedAmount)) return "PAID";
  return "PARTIAL";
};

const getStudentContext = async (schoolId, studentId) => {
  const student = await Student.findOne({ user: studentId })
    .populate("class", "_id school name grade section")
    .populate("user", "_id school name email");

  if (!student || !student.user) {
    return { error: { code: 404, message: "Student not found" } };
  }

  if (student.user.school.toString() !== schoolId.toString()) {
    return { error: { code: 403, message: "Unauthorized school access" } };
  }

  if (!student.class) {
    return { error: { code: 400, message: "Student is not assigned to a class" } };
  }

  if (student.class.school.toString() !== schoolId.toString()) {
    return { error: { code: 403, message: "Student class not in your school" } };
  }

  return { student };
};

const getPeriodPayments = async ({ schoolId, studentId, month, year }) => {
  const query = {
    school: schoolId,
    user: studentId,
    month,
    year,
  };

  const payments = await Payment.find(query)
    .populate("feeStructureId", "_id class components")
    .populate("class", "_id name grade section")
    .sort({ paidAt: -1, createdAt: -1 });

  return payments;
};

const buildMonthSummary = async ({ schoolId, studentId, month, year }) => {
  const payments = await getPeriodPayments({ schoolId, studentId, month, year });

  if (payments.length === 0) {
    return {
      month,
      year,
      studentId,
      structureLocked: false,
      feeStructureId: null,
      expectedAmount: 0,
      paidAmount: 0,
      dueAmount: 0,
      status: "PENDING",
      paymentCount: 0,
      payments: [],
    };
  }

  const lockedStructure = payments[0].feeStructureId;
  const expectedAmount = getFeeStructureTotal(lockedStructure);
  const paidAmount = toMoney(
    payments.reduce((acc, payment) => acc + toMoney(payment.amount) + toMoney(payment.lateFee || 0), 0)
  );
  const dueAmount = toMoney(Math.max(0, expectedAmount - paidAmount));

  return {
    month,
    year,
    studentId,
    structureLocked: true,
    feeStructureId: lockedStructure?._id || null,
    expectedAmount,
    paidAmount,
    dueAmount,
    status: deriveStatus({ paymentCount: payments.length, expectedAmount, paidAmount }),
    paymentCount: payments.length,
    payments,
  };
};

const createPayment = async (req, res) => {
  try {
    const {
      studentId,
      feeStructureId,
      month,
      year,
      amount,
      lateFee = 0,
      method,
      transactionId = "",
      remarks = "",
    } = req.body;

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json(formatResponse(false, "Valid studentId is required"));
    }

    if (!feeStructureId || !mongoose.Types.ObjectId.isValid(feeStructureId)) {
      return res.status(400).json(formatResponse(false, "Valid feeStructureId is required"));
    }

    const parsedMonth = Number(month);
    const parsedYear = Number(year);

    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      return res.status(400).json(formatResponse(false, "Month must be between 1 and 12"));
    }

    if (!Number.isInteger(parsedYear) || parsedYear < 2000) {
      return res.status(400).json(formatResponse(false, "Valid year is required"));
    }

    if (!method || !FEE_METHODS.includes(method)) {
      return res.status(400).json(formatResponse(false, "Invalid payment method"));
    }

    const normalizedAmount = toMoney(amount);
    const normalizedLateFee = toMoney(lateFee);

    if (normalizedAmount <= 0) {
      return res.status(400).json(formatResponse(false, "Payment amount must be greater than zero"));
    }

    if (normalizedLateFee < 0) {
      return res.status(400).json(formatResponse(false, "lateFee cannot be negative"));
    }

    const studentContext = await getStudentContext(req.user.school._id, studentId);
    if (studentContext.error) {
      return res
        .status(studentContext.error.code)
        .json(formatResponse(false, studentContext.error.message));
    }

    const feeStructure = await FeeStructure.findById(feeStructureId).populate(
      "class",
      "_id school name grade section"
    );

    if (!feeStructure || !feeStructure.class) {
      return res.status(404).json(formatResponse(false, "Fee structure not found"));
    }

    if (feeStructure.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Fee structure not in your school"));
    }

    if (feeStructure.class._id.toString() !== studentContext.student.class._id.toString()) {
      return res
        .status(400)
        .json(formatResponse(false, "Fee structure class does not match student's class"));
    }

    const periodPayments = await getPeriodPayments({
      schoolId: req.user.school._id,
      studentId,
      month: parsedMonth,
      year: parsedYear,
    });

    if (
      periodPayments.length > 0 &&
      periodPayments[0].feeStructureId &&
      periodPayments[0].feeStructureId._id.toString() !== feeStructureId
    ) {
      return res.status(409).json(
        formatResponse(
          false,
          "Fee structure is already locked for this student and month. Use the same structure for additional payments."
        )
      );
    }

    const expectedAmount = getFeeStructureTotal(feeStructure);
    const alreadyPaid = toMoney(
      periodPayments.reduce((acc, payment) => acc + toMoney(payment.amount) + toMoney(payment.lateFee || 0), 0)
    );
    const incomingTotal = toMoney(normalizedAmount + normalizedLateFee);

    if (toMoney(alreadyPaid + incomingTotal) > expectedAmount) {
      return res
        .status(400)
        .json(formatResponse(false, "Payment exceeds expected amount for the selected fee structure"));
    }

    const created = await Payment.create({
      user: studentId,
      school: req.user.school._id,
      class: studentContext.student.class._id,
      feeStructureId,
      month: parsedMonth,
      year: parsedYear,
      amount: normalizedAmount,
      lateFee: normalizedLateFee,
      method,
      transactionId,
      remarks,
      status: "SUCCESS",
      paidAt: new Date(),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const populated = await Payment.findById(created._id)
      .populate("user", "_id name email")
      .populate("class", "_id name grade section")
      .populate("feeStructureId", "_id class components");

    const summary = await buildMonthSummary({
      schoolId: req.user.school._id,
      studentId,
      month: parsedMonth,
      year: parsedYear,
    });

    return res.status(201).json(
      formatResponse(true, "Payment recorded successfully", {
        payment: populated,
        monthSummary: summary,
      })
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error recording fee payment", null, error.message));
  }
};

const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid payment id is required"));
    }

    const payment = await Payment.findById(id)
      .populate("user", "_id name email")
      .populate("class", "_id name grade section school")
      .populate("feeStructureId", "_id class components")
      .populate("createdBy", "_id name email")
      .populate("updatedBy", "_id name email");

    if (!payment) {
      return res.status(404).json(formatResponse(false, "Payment not found"));
    }

    if (payment.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    const summary = await buildMonthSummary({
      schoolId: req.user.school._id,
      studentId: payment.user._id,
      month: payment.month,
      year: payment.year,
    });

    return res.status(200).json(
      formatResponse(true, "Payment fetched successfully", {
        payment,
        monthSummary: summary,
      })
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching payment", null, error.message));
  }
};

const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid payment id is required"));
    }

    const payment = await Payment.findById(id).select("_id school user month year");
    if (!payment) {
      return res.status(404).json(formatResponse(false, "Payment not found"));
    }

    if (payment.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    await payment.deleteOne();

    const summary = await buildMonthSummary({
      schoolId: req.user.school._id,
      studentId: payment.user,
      month: payment.month,
      year: payment.year,
    });

    return res.status(200).json(
      formatResponse(true, "Payment deleted successfully", {
        monthSummary: summary,
      })
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error deleting payment", null, error.message));
  }
};

const getStudentFeeByMonthYear = async (req, res) => {
  try {
    const { studentId, month, year } = req.params;

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json(formatResponse(false, "Valid studentId is required"));
    }

    const parsedMonth = Number(month);
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      return res.status(400).json(formatResponse(false, "Month must be between 1 and 12"));
    }
    if (!Number.isInteger(parsedYear) || parsedYear < 2000) {
      return res.status(400).json(formatResponse(false, "Valid year is required"));
    }

    const studentContext = await getStudentContext(req.user.school._id, studentId);
    if (studentContext.error) {
      return res
        .status(studentContext.error.code)
        .json(formatResponse(false, studentContext.error.message));
    }

    const summary = await buildMonthSummary({
      schoolId: req.user.school._id,
      studentId,
      month: parsedMonth,
      year: parsedYear,
    });

    return res.status(200).json(formatResponse(true, "Fee summary fetched successfully", summary));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching fee summary", null, error.message));
  }
};

const getStudentPaymentHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json(formatResponse(false, "Valid studentId is required"));
    }

    const studentContext = await getStudentContext(req.user.school._id, studentId);
    if (studentContext.error) {
      return res
        .status(studentContext.error.code)
        .json(formatResponse(false, studentContext.error.message));
    }

    const paymentQuery = {
      school: req.user.school._id,
      user: studentId,
    };

    const totalRecords = await Payment.countDocuments(paymentQuery);

    const payments = await Payment.find(paymentQuery)
      .populate("class", "_id name grade section")
      .populate("feeStructureId", "_id class components")
      .sort({ year: -1, month: -1, paidAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return res.status(200).json(
      formatResponse(true, "Payment history fetched successfully", {
        studentId,
        totalPayments: totalRecords,
        records: payments,
        pagination: {
          page,
          limit,
          totalRecords,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      })
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching payment history", null, error.message));
  }
};

const getClassWiseFeeMatrix = async (req, res) => {
  try {
    const { classId, month, year } = req.query;

    if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json(formatResponse(false, "Valid classId is required"));
    }

    const parsedMonth = Number(month);
    const parsedYear = Number(year);

    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      return res.status(400).json(formatResponse(false, "Month must be between 1 and 12"));
    }

    if (!Number.isInteger(parsedYear) || parsedYear < 2000) {
      return res.status(400).json(formatResponse(false, "Valid year is required"));
    }

    const cls = await Class.findById(classId).select("_id school name grade section");
    if (!cls) {
      return res.status(404).json(formatResponse(false, "Class not found"));
    }

    if (cls.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Class not in your school"));
    }

    const students = await Student.find({ class: classId })
      .populate("user", "_id name email school")
      .select("_id user");

    const payments = await Payment.find({
      school: req.user.school._id,
      class: classId,
      month: parsedMonth,
      year: parsedYear,
    })
      .populate("feeStructureId", "_id components")
      .sort({ paidAt: -1 });

    const grouped = new Map();
    for (const payment of payments) {
      const key = payment.user.toString();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(payment);
    }

    const records = students
      .filter((student) => student.user && student.user.school.toString() === req.user.school._id.toString())
      .map((student) => {
        const studentPayments = grouped.get(student.user._id.toString()) || [];

        if (studentPayments.length === 0) {
          return {
            studentId: student.user._id,
            studentName: student.user.name,
            status: "PENDING",
            expectedAmount: 0,
            paidAmount: 0,
            dueAmount: 0,
            feeStructureId: null,
            paymentCount: 0,
          };
        }

        const lockedStructure = studentPayments[0].feeStructureId;
        const expectedAmount = getFeeStructureTotal(lockedStructure);
        const paidAmount = toMoney(
          studentPayments.reduce(
            (acc, payment) => acc + toMoney(payment.amount) + toMoney(payment.lateFee || 0),
            0
          )
        );

        return {
          studentId: student.user._id,
          studentName: student.user.name,
          status: deriveStatus({
            paymentCount: studentPayments.length,
            expectedAmount,
            paidAmount,
          }),
          expectedAmount,
          paidAmount,
          dueAmount: toMoney(Math.max(0, expectedAmount - paidAmount)),
          feeStructureId: lockedStructure?._id || null,
          paymentCount: studentPayments.length,
        };
      });

    const summary = {
      classId: cls._id,
      className: cls.name,
      month: parsedMonth,
      year: parsedYear,
      totalStudents: records.length,
      paidCount: records.filter((item) => item.status === "PAID").length,
      partialCount: records.filter((item) => item.status === "PARTIAL").length,
      pendingCount: records.filter((item) => item.status === "PENDING").length,
      expectedAmount: toMoney(records.reduce((acc, item) => acc + item.expectedAmount, 0)),
      paidAmount: toMoney(records.reduce((acc, item) => acc + item.paidAmount, 0)),
      dueAmount: toMoney(records.reduce((acc, item) => acc + item.dueAmount, 0)),
      records,
    };

    return res
      .status(200)
      .json(formatResponse(true, "Class fee summary fetched successfully", summary));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching class fee summary", null, error.message));
  }
};

const getSchoolWiseFeeMatrix = async (req, res) => {
  try {
    const { month, year } = req.query;

    const parsedMonth = Number(month);
    const parsedYear = Number(year);

    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      return res.status(400).json(formatResponse(false, "Month must be between 1 and 12"));
    }

    if (!Number.isInteger(parsedYear) || parsedYear < 2000) {
      return res.status(400).json(formatResponse(false, "Valid year is required"));
    }

    const classes = await Class.find({ school: req.user.school._id }).select("_id name grade section");

    const classSummaries = [];
    for (const cls of classes) {
      const fakeReq = {
        query: { classId: cls._id.toString(), month: parsedMonth, year: parsedYear },
        user: req.user,
      };

      const capture = {};
      const fakeRes = {
        status(code) {
          capture.code = code;
          return this;
        },
        json(payload) {
          capture.payload = payload;
          return this;
        },
      };

      await getClassWiseFeeMatrix(fakeReq, fakeRes);
      if (capture.code === 200 && capture.payload?.data) {
        classSummaries.push(capture.payload.data);
      }
    }

    const summary = {
      month: parsedMonth,
      year: parsedYear,
      totalClasses: classSummaries.length,
      expectedAmount: toMoney(classSummaries.reduce((acc, item) => acc + item.expectedAmount, 0)),
      paidAmount: toMoney(classSummaries.reduce((acc, item) => acc + item.paidAmount, 0)),
      dueAmount: toMoney(classSummaries.reduce((acc, item) => acc + item.dueAmount, 0)),
      paidCount: classSummaries.reduce((acc, item) => acc + item.paidCount, 0),
      partialCount: classSummaries.reduce((acc, item) => acc + item.partialCount, 0),
      pendingCount: classSummaries.reduce((acc, item) => acc + item.pendingCount, 0),
      classWiseBreakdown: classSummaries,
    };

    return res
      .status(200)
      .json(formatResponse(true, "School fee summary fetched successfully", summary));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching school fee summary", null, error.message));
  }
};

module.exports = {
  createPayment,
  getPaymentById,
  deletePayment,
  getStudentFeeByMonthYear,
  getStudentPaymentHistory,
  getClassWiseFeeMatrix,
  getSchoolWiseFeeMatrix,
};
