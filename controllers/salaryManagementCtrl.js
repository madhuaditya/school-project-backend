const mongoose = require("mongoose");
const SalaryRecord = require("../models/salaryRecord");
const SalaryPayment = require("../models/salaryPayment");
const Staff = require("../models/staff");
const User = require("../models/user");

const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

// ==================== SALARY RECORD MANAGEMENT ====================

const createSalaryRecord = async (req, res) => {
  try {
    const {
      staffId,
      month,
      year,
      baseSalary,
      earnings = {},
      deductions = {},
      remarks = "",
    } = req.body;

    if (!staffId || !month || !year) {
      return res.status(400).json(formatResponse(false, "staffId, month, and year are required"));
    }

    if (month < 1 || month > 12) {
      return res.status(400).json(formatResponse(false, "Month must be 1-12"));
    }

    const staff = await Staff.findById(staffId).populate("user", "_id school");
    if (!staff) {
      return res.status(404).json(formatResponse(false, "Staff not found"));
    }

    if (staff.user.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Staff not in your school"));
    }

    const existing = await SalaryRecord.findOne({
      staffId,
      month,
      year,
      school: req.user.school._id,
    }).select("_id");

    if (existing) {
      return res
        .status(409)
        .json(formatResponse(false, "Salary record already exists for this staff, month and year"));
    }

    const earningsValues = {
      basic: earnings.basic || 0,
      hra: earnings.hra || 0,
      da: earnings.da || 0,
      bonus: earnings.bonus || 0,
    };

    const deductionsValues = {
      pf: deductions.pf || 0,
      tax: deductions.tax || 0,
      other: deductions.other || 0,
      leaveDeduction: deductions.leaveDeduction || 0,
    };

    const totalEarnings =
      earningsValues.basic +
      earningsValues.hra +
      earningsValues.da +
      earningsValues.bonus;
    const totalDeductions =
      deductionsValues.pf +
      deductionsValues.tax +
      deductionsValues.other +
      deductionsValues.leaveDeduction;
    const netSalary = totalEarnings - totalDeductions;

    const record = await SalaryRecord.create({
      staffId,
      school: req.user.school._id,
      user: staff.user._id,
      month,
      year,
      baseSalary: baseSalary || 0,
      earnings: earningsValues,
      deductions: deductionsValues,
      totalEarnings,
      totalDeductions,
      netSalary,
      remarks,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const populated = await SalaryRecord.findById(record._id)
      .populate("staffId", "_id")
      .populate("user", "_id name email")
      .populate("school", "_id schoolName");

    return res
      .status(201)
      .json(formatResponse(true, "Salary record created successfully", populated));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error creating salary record", null, error.message));
  }
};

const updateSalaryRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { baseSalary, earnings, deductions, status, remarks, paymentDate } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid id is required"));
    }

    const record = await SalaryRecord.findById(id);
    if (!record) {
      return res.status(404).json(formatResponse(false, "Salary record not found"));
    }

    if (record.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    if (baseSalary !== undefined) record.baseSalary = baseSalary;
    if (remarks !== undefined) record.remarks = remarks;
    if (paymentDate !== undefined) record.paymentDate = paymentDate ? new Date(paymentDate) : null;
    if (status && ["PAID", "PARTIAL", "UNPAID"].includes(status)) record.status = status;

    if (earnings && typeof earnings === "object") {
      const newEarnings = {
        basic: earnings.basic !== undefined ? earnings.basic : record.earnings.basic,
        hra: earnings.hra !== undefined ? earnings.hra : record.earnings.hra,
        da: earnings.da !== undefined ? earnings.da : record.earnings.da,
        bonus: earnings.bonus !== undefined ? earnings.bonus : record.earnings.bonus,
      };
      record.earnings = newEarnings;
    }

    if (deductions && typeof deductions === "object") {
      const newDeductions = {
        pf: deductions.pf !== undefined ? deductions.pf : record.deductions.pf,
        tax: deductions.tax !== undefined ? deductions.tax : record.deductions.tax,
        other: deductions.other !== undefined ? deductions.other : record.deductions.other,
        leaveDeduction:
          deductions.leaveDeduction !== undefined
            ? deductions.leaveDeduction
            : record.deductions.leaveDeduction,
      };
      record.deductions = newDeductions;
    }

    const totalEarnings =
      record.earnings.basic +
      record.earnings.hra +
      record.earnings.da +
      record.earnings.bonus;
    const totalDeductions =
      record.deductions.pf +
      record.deductions.tax +
      record.deductions.other +
      record.deductions.leaveDeduction;

    record.totalEarnings = totalEarnings;
    record.totalDeductions = totalDeductions;
    record.netSalary = totalEarnings - totalDeductions;
    record.updatedBy = req.user._id;

    await record.save();

    const populated = await SalaryRecord.findById(record._id)
      .populate("staffId", "_id")
      .populate("user", "_id name email")
      .populate("school", "_id schoolName");

    return res
      .status(200)
      .json(formatResponse(true, "Salary record updated successfully", populated));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error updating salary record", null, error.message));
  }
};

const deleteSalaryRecord = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid id is required"));
    }

    const record = await SalaryRecord.findById(id);
    if (!record) {
      return res.status(404).json(formatResponse(false, "Salary record not found"));
    }

    if (record.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    await SalaryPayment.deleteMany({ salaryRecordId: id });
    await record.deleteOne();

    return res
      .status(200)
      .json(formatResponse(true, "Salary record deleted successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error deleting salary record", null, error.message));
  }
};

const getSalaryRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role?.role || req.user?.role;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid id is required"));
    }

    const record = await SalaryRecord.findById(id)
      .populate("staffId", "_id")
      .populate("user", "_id name email")
      .populate("school", "_id schoolName")
      .populate("createdBy", "_id name")
      .populate("updatedBy", "_id name");

    if (!record) {
      return res.status(404).json(formatResponse(false, "Salary record not found"));
    }

    // Staff/Teacher can only view own records
    if ((userRole === "staff" || userRole === "teacher") && record.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, "Access denied"));
    }

    if (record.school._id.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    return res
      .status(200)
      .json(formatResponse(true, "Salary record fetched successfully", record));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching salary record", null, error.message));
  }
};

const getStaffSalaryByMonth = async (req, res) => {
  try {
    const { staffId, month, year } = req.params;
    const userRole = req.user?.role?.role || req.user?.role;

    if (!staffId || !month || !year) {
      return res.status(400).json(formatResponse(false, "staffId, month and year are required"));
    }

    if (month < 1 || month > 12) {
      return res.status(400).json(formatResponse(false, "Month must be 1-12"));
    }

    const staff = await Staff.findById(staffId).populate("user", "_id school name email");
    if (!staff) {
      return res.status(404).json(formatResponse(false, "Staff not found"));
    }

    // Staff/Teacher can only view own records
    if ((userRole === "staff" || userRole === "teacher") && staff.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, "Access denied"));
    }

    if (staff.user.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    const record = await SalaryRecord.findOne({
      staffId,
      month: parseInt(month),
      year: parseInt(year),
      school: req.user.school._id,
    })
      .populate("staffId", "_id")
      .populate("user", "_id name email")
      .populate("school", "_id schoolName");

    if (!record) {
      return res.status(404).json(formatResponse(false, "No salary record found for this month and year"));
    }

    return res
      .status(200)
      .json(formatResponse(true, "Salary record fetched successfully", record));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching salary record", null, error.message));
  }
};

const getStaffAllSalaries = async (req, res) => {
  try {
    const { staffId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const userRole = req.user?.role?.role || req.user?.role;

    if (!staffId) {
      return res.status(400).json(formatResponse(false, "staffId is required"));
    }

    const staff = await Staff.findById(staffId).populate("user", "_id school name email");
    if (!staff) {
      return res.status(404).json(formatResponse(false, "Staff not found"));
    }

    // Staff/Teacher can only view own records
    if ((userRole === "staff" || userRole === "teacher") && staff.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, "Access denied"));
    }

    if (staff.user.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    const baseQuery = {
      staffId,
      school: req.user.school._id,
    };

    const totalRecords = await SalaryRecord.countDocuments(baseQuery);

    const records = await SalaryRecord.find(baseQuery)
      .populate("staffId", "_id")
      .populate("user", "_id name email")
      .populate("school", "_id schoolName")
      .sort({ year: -1, month: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return res
      .status(200)
      .json(
        formatResponse(true, "Staff salary records fetched successfully", {
          records,
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
      .json(formatResponse(false, "Error fetching staff salary records", null, error.message));
  }
};

// ==================== ADMIN ANALYTICS ====================

const getSalaryMatrixByMonth = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json(formatResponse(false, "month and year are required"));
    }

    if (month < 1 || month > 12) {
      return res.status(400).json(formatResponse(false, "Month must be 1-12"));
    }

    const records = await SalaryRecord.find({
      school: req.user.school._id,
      month: parseInt(month),
      year: parseInt(year),
    })
      .populate("user", "_id name email")
      .populate("staffId", "_id")
      .select(
        "user status totalEarnings totalDeductions netSalary paidAmount"
      );

    const summary = {
      month: parseInt(month),
      year: parseInt(year),
      school: req.user.school._id,
      totalRecords: records.length,
      totalSalaryPayable: 0,
      totalSalaryPaid: 0,
      totalSalaryPending: 0,
      paidCount: 0,
      partialCount: 0,
      unpaidCount: 0,
      staffDetails: [],
    };

    records.forEach((record) => {
      summary.totalSalaryPayable += record.netSalary;
      summary.totalSalaryPaid += record.paidAmount;
      summary.totalSalaryPending += record.netSalary - record.paidAmount;

      if (record.status === "PAID") summary.paidCount++;
      else if (record.status === "PARTIAL") summary.partialCount++;
      else if (record.status === "UNPAID") summary.unpaidCount++;

      summary.staffDetails.push({
        staffId: record.staffId._id,
        staffName: record.user.name,
        email: record.user.email,
        status: record.status,
        netSalary: record.netSalary,
        totalEarnings: record.totalEarnings,
        totalDeductions: record.totalDeductions,
        paidAmount: record.paidAmount,
        pendingAmount: record.netSalary - record.paidAmount,
      });
    });

    return res
      .status(200)
      .json(formatResponse(true, "Salary matrix fetched successfully", summary));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching salary matrix", null, error.message));
  }
};

const getYearlySalaryMatrix = async (req, res) => {
  try {
    const { staffId, year } = req.query;

    if (!staffId || !year) {
      return res.status(400).json(formatResponse(false, "staffId and year are required"));
    }

    const staff = await Staff.findById(staffId).populate("user", "_id school");
    if (!staff) {
      return res.status(404).json(formatResponse(false, "Staff not found"));
    }

    if (staff.user.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Staff not in your school"));
    }

    const records = await SalaryRecord.find({
      staffId,
      year: parseInt(year),
      school: req.user.school._id,
    })
      .populate("user", "_id name")
      .select("month status totalEarnings totalDeductions netSalary paidAmount")
      .sort({ month: 1 });

    const monthlyData = {};
    let yearlyPayable = 0;
    let yearlyPaid = 0;

    records.forEach((record) => {
      const month = record.month;
      monthlyData[month] = {
        month,
        netSalary: record.netSalary,
        paidAmount: record.paidAmount,
        pendingAmount: record.netSalary - record.paidAmount,
        status: record.status,
        totalEarnings: record.totalEarnings,
        totalDeductions: record.totalDeductions,
      };
      yearlyPayable += record.netSalary;
      yearlyPaid += record.paidAmount;
    });

    return res.status(200).json(
      formatResponse(true, "Yearly salary matrix fetched successfully", {
        staffId,
        year: parseInt(year),
        staffName: staff.user.name,
        yearlyPayable,
        yearlyPaid,
        yearlyPending: yearlyPayable - yearlyPaid,
        monthlyBreakdown: Object.values(monthlyData),
      })
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching yearly salary matrix", null, error.message));
  }
};

const getPendingSalaries = async (req, res) => {
  try {
    const { month, year } = req.query;

    const query = {
      school: req.user.school._id,
      status: { $in: ["UNPAID", "PARTIAL"] },
    };

    if (month && year) {
      query.month = parseInt(month);
      query.year = parseInt(year);
    }

    const records = await SalaryRecord.find(query)
      .populate("user", "_id name email")
      .populate("staffId", "_id")
      .select(
        "user month year status netSalary paidAmount totalEarnings totalDeductions"
      )
      .sort({ year: -1, month: -1 });

    return res
      .status(200)
      .json(formatResponse(true, "Pending salaries fetched successfully", records));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching pending salaries", null, error.message));
  }
};

// ==================== SALARY PAYMENT MANAGEMENT ====================

const recordSalaryPayment = async (req, res) => {
  try {
    const { salaryRecordId, amount, method, transactionId = "" } = req.body;

    if (!salaryRecordId || !amount || !method) {
      return res.status(400).json(formatResponse(false, "Missing required fields"));
    }

    if (!["BANK", "UPI", "CASH"].includes(method)) {
      return res.status(400).json(formatResponse(false, "Invalid payment method"));
    }

    const record = await SalaryRecord.findById(salaryRecordId);
    if (!record) {
      return res.status(404).json(formatResponse(false, "Salary record not found"));
    }

    if (record.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    const payment = await SalaryPayment.create({
      staffId: record.staffId,
      salaryRecordId,
      amount,
      method,
      transactionId,
      status: "SUCCESS",
      paidAt: new Date(),
      createdBy: req.user._id,
      updatedBy: req.user._id,
      school: req.user.school._id,
    });

    const newPaidAmount = record.paidAmount + amount;
    const pendingAmount = record.netSalary - newPaidAmount;

    let newStatus = "UNPAID";
    if (pendingAmount <= 0) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL";
    }

    record.paidAmount = newPaidAmount;
    record.status = newStatus;
    record.updatedBy = req.user._id;
    await record.save();

    const populated = await SalaryPayment.findById(payment._id)
      .populate("staffId", "_id")
      .populate("salaryRecordId", "_id month year netSalary");

    return res
      .status(201)
      .json(formatResponse(true, "Salary payment recorded successfully", populated));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error recording payment", null, error.message));
  }
};

const getSalaryPaymentsByRecord = async (req, res) => {
  try {
    const { salaryRecordId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    if (!salaryRecordId || !mongoose.Types.ObjectId.isValid(salaryRecordId)) {
      return res.status(400).json(formatResponse(false, "Valid salaryRecordId is required"));
    }

    const record = await SalaryRecord.findById(salaryRecordId);
    if (!record) {
      return res.status(404).json(formatResponse(false, "Salary record not found"));
    }

    if (record.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    const paymentQuery = { salaryRecordId };
    const totalRecords = await SalaryPayment.countDocuments(paymentQuery);

    const payments = await SalaryPayment.find(paymentQuery)
      .populate("staffId", "_id")
      .sort({ paidAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return res
      .status(200)
      .json(
        formatResponse(true, "Payments fetched successfully", {
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
      .json(formatResponse(false, "Error fetching payments", null, error.message));
  }
};

const getStaffPaymentHistory = async (req, res) => {
  try {
    const { staffId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const userRole = req.user?.role?.role || req.user?.role;

    if (!staffId) {
      return res.status(400).json(formatResponse(false, "staffId is required"));
    }

    const staff = await Staff.findById(staffId).populate("user", "_id school name email");
    if (!staff) {
      return res.status(404).json(formatResponse(false, "Staff not found"));
    }

    // Staff/Teacher can only view own payment history
    if ((userRole === "staff" || userRole === "teacher") && staff.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, "Access denied"));
    }

    if (staff.user.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    const paymentQuery = {
      staffId,
      school: req.user.school._id,
    };

    const totalRecords = await SalaryPayment.countDocuments(paymentQuery);

    const payments = await SalaryPayment.find(paymentQuery)
      .populate("salaryRecordId", "_id month year netSalary")
      .sort({ paidAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return res
      .status(200)
      .json(
        formatResponse(true, "Payment history fetched successfully", {
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

module.exports = {
  // Salary Records
  createSalaryRecord,
  updateSalaryRecord,
  deleteSalaryRecord,
  getSalaryRecordById,
  getStaffSalaryByMonth,
  getStaffAllSalaries,
  // Analytics
  getSalaryMatrixByMonth,
  getYearlySalaryMatrix,
  getPendingSalaries,
  // Payments
  recordSalaryPayment,
  getSalaryPaymentsByRecord,
  getStaffPaymentHistory,
};
