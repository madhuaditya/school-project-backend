const mongoose = require("mongoose");
const SalaryPayment = require("../models/salaryPayment");
const SalaryStructure = require("../models/salaryStructure");
const User = require("../models/user");

const SALARY_METHODS = ["BANK", "UPI", "CASH"];

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

const mapUserRoleToSalaryRole = (role) => {
  const normalized = (role || "").toString().trim().toLowerCase();
  if (normalized === "teacher") return "TEACHER";
  if (normalized === "accountant") return "ACCOUNTANT";
  if (normalized === "driver") return "DRIVER";
  if (normalized === "admin") return "ADMIN";
  return "OTHER";
};

const getSalaryStructureNet = (structure) => {
  const earnings = toMoney(
    Object.values(structure?.components || {}).reduce((acc, value) => acc + toMoney(value || 0), 0)
  );
  const deductions = toMoney(
    Object.values(structure?.deductions || {}).reduce((acc, value) => acc + toMoney(value || 0), 0)
  );
  return toMoney(Math.max(0, earnings - deductions));
};

const deriveStatus = ({ paymentCount, expectedAmount, paidAmount }) => {
  if (paymentCount === 0) return "PENDING";
  if (toMoney(paidAmount) >= toMoney(expectedAmount)) return "PAID";
  return "PARTIAL";
};

const getStaffContext = async (schoolId, staffId) => {
  const user = await User.findById(staffId).populate("role", "role").populate("school", "_id schoolName");

  if (!user) {
    return { error: { code: 404, message: "Staff user not found" } };
  }

  if (!user.school || user.school._id.toString() !== schoolId.toString()) {
    return { error: { code: 403, message: "Unauthorized school access" } };
  }

  const roleName = user?.role?.role;
  const salaryRole = mapUserRoleToSalaryRole(roleName);

  return {
    user,
    salaryRole,
  };
};

const getPeriodPayments = async ({ schoolId, staffId, month, year }) => {
  return SalaryPayment.find({
    school: schoolId,
    staffId,
    month,
    year,
  })
    .populate("salaryStructureId", "_id role components deductions")
    .sort({ paidAt: -1, createdAt: -1 });
};

const buildMonthSummary = async ({ schoolId, staffId, month, year }) => {
  const payments = await getPeriodPayments({ schoolId, staffId, month, year });

  if (payments.length === 0) {
    return {
      month,
      year,
      staffId,
      structureLocked: false,
      salaryStructureId: null,
      expectedAmount: 0,
      paidAmount: 0,
      dueAmount: 0,
      status: "PENDING",
      paymentCount: 0,
      payments: [],
    };
  }

  const lockedStructure = payments[0].salaryStructureId;
  const expectedAmount = getSalaryStructureNet(lockedStructure);
  const paidAmount = toMoney(payments.reduce((acc, payment) => acc + toMoney(payment.amount), 0));
  const dueAmount = toMoney(Math.max(0, expectedAmount - paidAmount));

  return {
    month,
    year,
    staffId,
    structureLocked: true,
    salaryStructureId: lockedStructure?._id || null,
    expectedAmount,
    paidAmount,
    dueAmount,
    status: deriveStatus({ paymentCount: payments.length, expectedAmount, paidAmount }),
    paymentCount: payments.length,
    payments,
  };
};

const recordSalaryPayment = async (req, res) => {
  try {
    const {
      staffId,
      salaryStructureId,
      month,
      year,
      amount,
      method,
      transactionId = "",
      remarks = "",
    } = req.body;

    if (!staffId || !mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json(formatResponse(false, "Valid staffId is required"));
    }

    if (!salaryStructureId || !mongoose.Types.ObjectId.isValid(salaryStructureId)) {
      return res.status(400).json(formatResponse(false, "Valid salaryStructureId is required"));
    }

    const parsedMonth = Number(month);
    const parsedYear = Number(year);

    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      return res.status(400).json(formatResponse(false, "Month must be between 1 and 12"));
    }

    if (!Number.isInteger(parsedYear) || parsedYear < 2000) {
      return res.status(400).json(formatResponse(false, "Valid year is required"));
    }

    if (!method || !SALARY_METHODS.includes(method)) {
      return res.status(400).json(formatResponse(false, "Invalid payment method"));
    }

    const normalizedAmount = toMoney(amount);
    if (normalizedAmount <= 0) {
      return res.status(400).json(formatResponse(false, "Payment amount must be greater than zero"));
    }

    const staffContext = await getStaffContext(req.user.school._id, staffId);
    if (staffContext.error) {
      return res.status(staffContext.error.code).json(formatResponse(false, staffContext.error.message));
    }

    const salaryStructure = await SalaryStructure.findById(salaryStructureId);
    if (!salaryStructure) {
      return res.status(404).json(formatResponse(false, "Salary structure not found"));
    }

    if (salaryStructure.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Salary structure not in your school"));
    }

    if (salaryStructure.role !== staffContext.salaryRole) {
      return res.status(400).json(
        formatResponse(
          false,
          `Salary structure role mismatch. Staff role maps to ${staffContext.salaryRole}.`
        )
      );
    }

    const periodPayments = await getPeriodPayments({
      schoolId: req.user.school._id,
      staffId,
      month: parsedMonth,
      year: parsedYear,
    });

    if (
      periodPayments.length > 0 &&
      periodPayments[0].salaryStructureId &&
      periodPayments[0].salaryStructureId._id.toString() !== salaryStructureId
    ) {
      return res.status(409).json(
        formatResponse(
          false,
          "Salary structure is already locked for this staff member and month. Use the same structure for additional payments."
        )
      );
    }

    const expectedAmount = getSalaryStructureNet(salaryStructure);
    const alreadyPaid = toMoney(periodPayments.reduce((acc, payment) => acc + toMoney(payment.amount), 0));

    if (toMoney(alreadyPaid + normalizedAmount) > expectedAmount) {
      return res
        .status(400)
        .json(formatResponse(false, "Payment exceeds expected net salary for the selected structure"));
    }

    const created = await SalaryPayment.create({
      staffId,
      school: req.user.school._id,
      salaryStructureId,
      month: parsedMonth,
      year: parsedYear,
      amount: normalizedAmount,
      method,
      transactionId,
      remarks,
      status: "SUCCESS",
      paidAt: new Date(),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const payment = await SalaryPayment.findById(created._id)
      .populate("staffId", "_id name email")
      .populate("salaryStructureId", "_id role components deductions");

    const summary = await buildMonthSummary({
      schoolId: req.user.school._id,
      staffId,
      month: parsedMonth,
      year: parsedYear,
    });

    return res.status(201).json(
      formatResponse(true, "Salary payment recorded successfully", {
        payment,
        monthSummary: summary,
      })
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error recording salary payment", null, error.message));
  }
};

const getSalaryPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid payment id is required"));
    }

    const payment = await SalaryPayment.findById(id)
      .populate("staffId", "_id name email")
      .populate("salaryStructureId", "_id role components deductions")
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
      staffId: payment.staffId._id,
      month: payment.month,
      year: payment.year,
    });

    return res.status(200).json(
      formatResponse(true, "Salary payment fetched successfully", {
        payment,
        monthSummary: summary,
      })
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching salary payment", null, error.message));
  }
};

const deleteSalaryPayment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid payment id is required"));
    }

    const payment = await SalaryPayment.findById(id).select("_id school staffId month year");
    if (!payment) {
      return res.status(404).json(formatResponse(false, "Payment not found"));
    }

    if (payment.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    await payment.deleteOne();

    const summary = await buildMonthSummary({
      schoolId: req.user.school._id,
      staffId: payment.staffId,
      month: payment.month,
      year: payment.year,
    });

    return res.status(200).json(
      formatResponse(true, "Salary payment deleted successfully", {
        monthSummary: summary,
      })
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error deleting salary payment", null, error.message));
  }
};

const getStaffSalaryByMonth = async (req, res) => {
  try {
    const { staffId, month, year } = req.params;
    const requesterRole = req.user?.role?.role || req.user?.role;
    const requesterId = req.user?._id?.toString();

    if (!staffId || !mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json(formatResponse(false, "Valid staffId is required"));
    }

    const parsedMonth = Number(month);
    const parsedYear = Number(year);

    if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      return res.status(400).json(formatResponse(false, "Month must be between 1 and 12"));
    }

    if (!Number.isInteger(parsedYear) || parsedYear < 2000) {
      return res.status(400).json(formatResponse(false, "Valid year is required"));
    }

    if (requesterRole !== 'admin' && requesterId !== String(staffId)) {
      return res.status(403).json(formatResponse(false, 'You can only access your own salary summary'));
    }

    const staffContext = await getStaffContext(req.user.school._id, staffId);
    if (staffContext.error) {
      return res.status(staffContext.error.code).json(formatResponse(false, staffContext.error.message));
    }

    const summary = await buildMonthSummary({
      schoolId: req.user.school._id,
      staffId,
      month: parsedMonth,
      year: parsedYear,
    });

    return res.status(200).json(formatResponse(true, "Salary summary fetched successfully", summary));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching salary summary", null, error.message));
  }
};

const getStaffPaymentHistory = async (req, res) => {
  try {
    const { staffId } = req.params;
    const requesterRole = req.user?.role?.role || req.user?.role;
    const requesterId = req.user?._id?.toString();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    if (!staffId || !mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json(formatResponse(false, "Valid staffId is required"));
    }

    if (requesterRole !== 'admin' && requesterId !== String(staffId)) {
      return res.status(403).json(formatResponse(false, 'You can only access your own salary history'));
    }

    const staffContext = await getStaffContext(req.user.school._id, staffId);
    if (staffContext.error) {
      return res.status(staffContext.error.code).json(formatResponse(false, staffContext.error.message));
    }

    const paymentQuery = {
      school: req.user.school._id,
      staffId,
    };

    const totalRecords = await SalaryPayment.countDocuments(paymentQuery);

    const payments = await SalaryPayment.find(paymentQuery)
      .populate("salaryStructureId", "_id role components deductions")
      .sort({ year: -1, month: -1, paidAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return res.status(200).json(
      formatResponse(true, "Staff payment history fetched successfully", {
        staffId,
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

const getSalaryMatrixByMonth = async (req, res) => {
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

    const users = await User.find({ school: req.user.school._id })
      .populate("role", "role")
      .select("_id name email role");

    const eligibleUsers = users.filter((user) => {
      const roleName = (user?.role?.role || "").toLowerCase();
      return roleName !== "student";
    });

    const records = [];

    for (const user of eligibleUsers) {
      const summary = await buildMonthSummary({
        schoolId: req.user.school._id,
        staffId: user._id,
        month: parsedMonth,
        year: parsedYear,
      });

      records.push({
        staffId: user._id,
        staffName: user.name,
        role: user?.role?.role || "",
        ...summary,
      });
    }

    const payload = {
      month: parsedMonth,
      year: parsedYear,
      totalStaff: records.length,
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
      .json(formatResponse(true, "Monthly salary matrix fetched successfully", payload));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching salary matrix", null, error.message));
  }
};

module.exports = {
  recordSalaryPayment,
  getSalaryPaymentById,
  deleteSalaryPayment,
  getStaffSalaryByMonth,
  getStaffPaymentHistory,
  getSalaryMatrixByMonth,
};
