const mongoose = require("mongoose");
const FeeRecord = require("../models/feeRecord");
const Payment = require("../models/payment");
const Alert = require("../models/alert");
const Student = require("../models/student");
const Class = require("../models/class");
const User = require("../models/user");

const formatResponse = (success, msg, data = null, error = null) => {
  return {
    success,
    msg,
    ...(data && { data }),
    ...(error && { error }),
  };
};

// ==================== FEE RECORD MANAGEMENT ====================

const createFeeRecord = async (req, res) => {
  try {
    const {
      userId,
      month,
      year,
      totalFee,
      dueAmount,
      discount = 0,
      fine = 0,
      dueDate,
      notes = "",
    } = req.body;

    if (!userId || !month || !year || !totalFee || dueAmount === undefined) {
      return res
        .status(400)
        .json(formatResponse(false, "Missing required fields"));
    }

    if (month < 1 || month > 12) {
      return res.status(400).json(formatResponse(false, "Month must be 1-12"));
    }

    const student = await Student.findOne({ user: userId }).populate(
      "class",
      "_id school"
    );
    if (!student || !student.class) {
      return res.status(404).json(formatResponse(false, "Student not found or not assigned to a class"));
    }

    if (student.class.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Student not in your school"));
    }

    const existing = await FeeRecord.findOne({
      user: userId,
      month,
      year,
      school: req.user.school._id,
    }).select("_id");

    if (existing) {
      return res
        .status(409)
        .json(formatResponse(false, "Fee record already exists for this student, month and year"));
    }

    const feeRecord = await FeeRecord.create({
      user: userId,
      school: req.user.school._id,
      class: student.class._id,
      month,
      year,
      totalFee,
      dueAmount,
      discount,
      fine,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes,
      status: "PENDING",
      paidAmount: 0,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const populated = await FeeRecord.findById(feeRecord._id)
      .populate("user", "_id name email")
      .populate("class", "_id name")
      .populate("school", "_id schoolName");

    return res
      .status(201)
      .json(formatResponse(true, "Fee record created successfully", populated));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error creating fee record", null, error.message));
  }
};

const updateFeeRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { totalFee, dueAmount, discount, fine, dueDate, notes, status } =
      req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid id is required"));
    }

    const feeRecord = await FeeRecord.findById(id);
    if (!feeRecord) {
      return res.status(404).json(formatResponse(false, "Fee record not found"));
    }

    if (feeRecord.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    if (totalFee !== undefined) feeRecord.totalFee = totalFee;
    if (dueAmount !== undefined) feeRecord.dueAmount = dueAmount;
    if (discount !== undefined) feeRecord.discount = discount;
    if (fine !== undefined) feeRecord.fine = fine;
    if (dueDate !== undefined) feeRecord.dueDate = dueDate ? new Date(dueDate) : null;
    if (notes !== undefined) feeRecord.notes = notes;
    if (status && ["PAID", "PARTIAL", "PENDING"].includes(status))
      feeRecord.status = status;

    feeRecord.updatedBy = req.user._id;
    await feeRecord.save();

    const populated = await FeeRecord.findById(feeRecord._id)
      .populate("user", "_id name email")
      .populate("class", "_id name")
      .populate("school", "_id schoolName");

    return res
      .status(200)
      .json(formatResponse(true, "Fee record updated successfully", populated));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error updating fee record", null, error.message));
  }
};

const deleteFeeRecord = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid id is required"));
    }

    const feeRecord = await FeeRecord.findById(id);
    if (!feeRecord) {
      return res.status(404).json(formatResponse(false, "Fee record not found"));
    }

    if (feeRecord.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    await Payment.deleteMany({ feeRecordId: id });
    await feeRecord.deleteOne();

    return res
      .status(200)
      .json(formatResponse(true, "Fee record deleted successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error deleting fee record", null, error.message));
  }
};

const getFeeRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role?.role || req.user?.role;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(formatResponse(false, "Valid id is required"));
    }

    const feeRecord = await FeeRecord.findById(id)
      .populate("user", "_id name email phone")
      .populate("class", "_id name grade section")
      .populate("school", "_id schoolName")
      .populate("createdBy", "_id name")
      .populate("updatedBy", "_id name")
      .populate({
        path: "history.paymentId",
        select: "_id amount method transactionId status",
      });

    if (!feeRecord) {
      return res.status(404).json(formatResponse(false, "Fee record not found"));
    }

    // Student can only see own fee records
    if (userRole === "student" && feeRecord.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, "Access denied"));
    }

    // Admin must have same school
    if (feeRecord.school._id.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    return res
      .status(200)
      .json(formatResponse(true, "Fee record fetched successfully", feeRecord));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching fee record", null, error.message));
  }
};

const getStudentFeeByMonthYear = async (req, res) => {
  try {
    const { studentId, month, year } = req.params;
    const userRole = req.user?.role?.role || req.user?.role;

    if (!studentId || !month || !year) {
      return res
        .status(400)
        .json(formatResponse(false, "studentId, month and year are required"));
    }

    if (month < 1 || month > 12) {
      return res.status(400).json(formatResponse(false, "Month must be 1-12"));
    }

    const student = await Student.findOne({ user: studentId }).populate(
      "user",
      "_id school name email"
    );
    if (!student) {
      return res.status(404).json(formatResponse(false, "Student not found"));
    }

    // Student can only see own records
    if (userRole === "student" && student.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, "Access denied"));
    }

    if (student.user.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    const feeRecord = await FeeRecord.findOne({
      user: studentId,
      month: parseInt(month),
      year: parseInt(year),
      school: req.user.school._id,
    })
      .populate("user", "_id name email")
      .populate("class", "_id name grade section")
      .populate("school", "_id schoolName")
      .populate({
        path: "history.paymentId",
        select: "_id amount method transactionId status",
      });

    if (!feeRecord) {
      return res.status(404).json(formatResponse(false, "No fee record found for this month and year"));
    }

    return res
      .status(200)
      .json(formatResponse(true, "Fee record fetched successfully", feeRecord));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching fee record", null, error.message));
  }
};

const getStudentAllFees = async (req, res) => {
  try {
    const { studentId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const userRole = req.user?.role?.role || req.user?.role;

    if (!studentId) {
      return res.status(400).json(formatResponse(false, "studentId is required"));
    }

    const student = await Student.findOne({ user: studentId }).populate(
      "user",
      "_id school name email"
    );
    if (!student) {
      return res.status(404).json(formatResponse(false, "Student not found"));
    }

    // Student can only see own records
    if (userRole === "student" && student.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, "Access denied"));
    }

    if (student.user.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    const baseQuery = {
      user: studentId,
      school: req.user.school._id,
    };

    const totalRecords = await FeeRecord.countDocuments(baseQuery);

    const feeRecords = await FeeRecord.find(baseQuery)
      .populate("user", "_id name email")
      .populate("class", "_id name grade section")
      .populate("school", "_id schoolName")
      .sort({ year: -1, month: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return res
      .status(200)
      .json(
        formatResponse(true, "Student fee records fetched successfully", {
          records: feeRecords,
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
      .json(formatResponse(false, "Error fetching student fee records", null, error.message));
  }
};

// ==================== ADMIN ANALYTICS ====================

const getClassWiseFeeMatrix = async (req, res) => {
  try {
    const { classId, month, year } = req.query;

    if (!classId || !month || !year) {
      return res
        .status(400)
        .json(formatResponse(false, "classId, month and year are required"));
    }

    const cls = await Class.findById(classId).select("_id school");
    if (!cls) {
      return res.status(404).json(formatResponse(false, "Class not found"));
    }

    if (cls.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Class not in your school"));
    }

    const feeRecords = await FeeRecord.find({
      class: classId,
      month: parseInt(month),
      year: parseInt(year),
      school: req.user.school._id,
    })
      .populate("user", "_id name email")
      .select("user status totalFee paidAmount dueAmount");

    const summary = {
      class: classId,
      month: parseInt(month),
      year: parseInt(year),
      totalRecords: feeRecords.length,
      totalFeeCollection: 0,
      totalDue: 0,
      paidCount: 0,
      partialCount: 0,
      pendingCount: 0,
      records: [],
    };

    feeRecords.forEach((record) => {
      summary.totalFeeCollection += record.paidAmount;
      summary.totalDue += record.dueAmount;

      if (record.status === "PAID") summary.paidCount++;
      else if (record.status === "PARTIAL") summary.partialCount++;
      else if (record.status === "PENDING") summary.pendingCount++;

      summary.records.push({
        studentId: record.user._id,
        studentName: record.user.name,
        status: record.status,
        totalFee: record.totalFee,
        paidAmount: record.paidAmount,
        dueAmount: record.dueAmount,
      });
    });

    return res
      .status(200)
      .json(formatResponse(true, "Class fee matrix fetched successfully", summary));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching class fee matrix", null, error.message));
  }
};

const getSchoolWiseFeeMatrix = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res
        .status(400)
        .json(formatResponse(false, "month and year are required"));
    }

    const feeRecords = await FeeRecord.find({
      school: req.user.school._id,
      month: parseInt(month),
      year: parseInt(year),
    })
      .populate("class", "_id name")
      .select("class status totalFee paidAmount dueAmount");

    const classMap = {};
    let totalFeeCollection = 0;
    let totalDue = 0;

    feeRecords.forEach((record) => {
      const className = record.class?.name || "Unknown";
      if (!classMap[className]) {
        classMap[className] = {
          className,
          totalRecords: 0,
          totalFeeCollection: 0,
          totalDue: 0,
          paidCount: 0,
          partialCount: 0,
          pendingCount: 0,
        };
      }

      classMap[className].totalRecords++;
      classMap[className].totalFeeCollection += record.paidAmount;
      classMap[className].totalDue += record.dueAmount;

      if (record.status === "PAID") classMap[className].paidCount++;
      else if (record.status === "PARTIAL") classMap[className].partialCount++;
      else if (record.status === "PENDING") classMap[className].pendingCount++;

      totalFeeCollection += record.paidAmount;
      totalDue += record.dueAmount;
    });

    const summary = {
      month: parseInt(month),
      year: parseInt(year),
      school: req.user.school._id,
      totalRecords: feeRecords.length,
      totalFeeCollection,
      totalDue,
      classWiseBreakdown: Object.values(classMap),
    };

    return res
      .status(200)
      .json(formatResponse(true, "School fee matrix fetched successfully", summary));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching school fee matrix", null, error.message));
  }
};

const getPendingFeesByClass = async (req, res) => {
  try {
    const { classId, month, year } = req.query;

    if (!classId) {
      return res.status(400).json(formatResponse(false, "classId is required"));
    }

    const cls = await Class.findById(classId).select("_id school");
    if (!cls) {
      return res.status(404).json(formatResponse(false, "Class not found"));
    }

    if (cls.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Class not in your school"));
    }

    const query = {
      class: classId,
      school: req.user.school._id,
      status: { $in: ["PENDING", "PARTIAL"] },
    };

    if (month && year) {
      query.month = parseInt(month);
      query.year = parseInt(year);
    }

    const pendingRecords = await FeeRecord.find(query)
      .populate("user", "_id name email")
      .select("user status totalFee paidAmount dueAmount month year")
      .sort({ year: -1, month: -1 });

    return res
      .status(200)
      .json(formatResponse(true, "Pending fees fetched successfully", pendingRecords));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching pending fees", null, error.message));
  }
};

const getYearlyFeeMatrix = async (req, res) => {
  try {
    const { classId, year } = req.query;

    if (!classId || !year) {
      return res
        .status(400)
        .json(formatResponse(false, "classId and year are required"));
    }

    const cls = await Class.findById(classId).select("_id school");
    if (!cls) {
      return res.status(404).json(formatResponse(false, "Class not found"));
    }

    if (cls.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Class not in your school"));
    }

    const records = await FeeRecord.find({
      class: classId,
      year: parseInt(year),
      school: req.user.school._id,
    })
      .populate("user", "_id name")
      .select("user month status totalFee paidAmount dueAmount");

    const monthlyData = {};
    let yearlyTotal = 0;
    let yearlyCollection = 0;

    records.forEach((record) => {
      const month = record.month;
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          totalFee: 0,
          collected: 0,
          due: 0,
          count: 0,
        };
      }
      monthlyData[month].totalFee += record.totalFee;
      monthlyData[month].collected += record.paidAmount;
      monthlyData[month].due += record.dueAmount;
      monthlyData[month].count++;

      yearlyTotal += record.totalFee;
      yearlyCollection += record.paidAmount;
    });

    return res.status(200).json(
      formatResponse(true, "Yearly fee matrix fetched successfully", {
        class: classId,
        year: parseInt(year),
        yearlyTotal,
        yearlyCollection,
        yearlyDue: yearlyTotal - yearlyCollection,
        monthlyBreakdown: Object.values(monthlyData),
      })
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error fetching yearly fee matrix", null, error.message));
  }
};

// ==================== PAYMENT MANAGEMENT ====================

const createPayment = async (req, res) => {
  try {
    const { feeRecordId, amount, lateFee = 0, method, transactionId = "", remarks = "" } = req.body;
    const userRole = req.user?.role?.role || req.user?.role;

    if (!feeRecordId || !amount || !method) {
      return res.status(400).json(formatResponse(false, "Missing required fields"));
    }

    if (!["UPI", "CARD", "NETBANKING", "CASH"].includes(method)) {
      return res.status(400).json(formatResponse(false, "Invalid payment method"));
    }

    const feeRecord = await FeeRecord.findById(feeRecordId).populate("user", "_id");
    if (!feeRecord) {
      return res.status(404).json(formatResponse(false, "Fee record not found"));
    }

    // Student can only pay their own fees
    if (userRole === "student" && feeRecord.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, "Access denied"));
    }

    if (feeRecord.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    const payment = await Payment.create({
      user: feeRecord.user._id,
      school: req.user.school._id,
      feeRecordId,
      amount,
      lateFee,
      method,
      transactionId,
      remarks,
      status: "SUCCESS",
      paidAt: new Date(),
      createdBy: userRole === "student" ? req.user._id : req.user._id,
      updatedBy: req.user._id,
    });

    // Update fee record
    const newPaidAmount = feeRecord.paidAmount + amount + lateFee;
    const newDueAmount = Math.max(0, feeRecord.dueAmount - amount);

    let newStatus = "PENDING";
    if (newDueAmount === 0) {
      newStatus = "PAID";
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIAL";
    }

    feeRecord.paidAmount = newPaidAmount;
    feeRecord.dueAmount = newDueAmount;
    feeRecord.status = newStatus;
    feeRecord.history.push({
      amount,
      lateFee,
      method,
      transactionId,
      paymentId: payment._id,
      date: new Date(),
    });
    feeRecord.updatedBy = req.user._id;
    await feeRecord.save();

    const populated = await Payment.findById(payment._id)
      .populate("user", "_id name email")
      .populate("feeRecordId", "_id month year totalFee");

    return res
      .status(201)
      .json(formatResponse(true, "Payment recorded successfully", populated));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error recording payment", null, error.message));
  }
};

const getPaymentsByFeeRecord = async (req, res) => {
  try {
    const { feeRecordId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const userRole = req.user?.role?.role || req.user?.role;

    if (!feeRecordId || !mongoose.Types.ObjectId.isValid(feeRecordId)) {
      return res.status(400).json(formatResponse(false, "Valid feeRecordId is required"));
    }

    const feeRecord = await FeeRecord.findById(feeRecordId).populate("user", "_id");
    if (!feeRecord) {
      return res.status(404).json(formatResponse(false, "Fee record not found"));
    }

    // Student can only see own payments
    if (userRole === "student" && feeRecord.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, "Access denied"));
    }

    if (feeRecord.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    const paymentQuery = { feeRecordId };
    const totalRecords = await Payment.countDocuments(paymentQuery);

    const payments = await Payment.find(paymentQuery)
      .populate("user", "_id name email")
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

const getStudentPaymentHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const userRole = req.user?.role?.role || req.user?.role;

    if (!studentId) {
      return res.status(400).json(formatResponse(false, "studentId is required"));
    }

    const student = await Student.findOne({ user: studentId }).populate(
      "user",
      "_id school name email"
    );
    if (!student) {
      return res.status(404).json(formatResponse(false, "Student not found"));
    }

    // Student can only see own payments
    if (userRole === "student" && student.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatResponse(false, "Access denied"));
    }

    if (student.user.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Unauthorized school access"));
    }

    const paymentQuery = {
      user: studentId,
      school: req.user.school._id,
    };

    const totalRecords = await Payment.countDocuments(paymentQuery);

    const payments = await Payment.find(paymentQuery)
      .populate("feeRecordId", "_id month year totalFee")
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

// ==================== ALERT CREATION FOR UNPAID FEES ====================

const createAlertForStudentUnpaidFees = async (req, res) => {
  try {
    const { studentId, month, year } = req.body;

    if (!studentId || !month || !year) {
      return res
        .status(400)
        .json(formatResponse(false, "studentId, month, and year are required"));
    }

    if (month < 1 || month > 12) {
      return res.status(400).json(formatResponse(false, "Month must be 1-12"));
    }

    const student = await Student.findOne({ user: studentId }).populate(
      "user",
      "_id school name email"
    );
    if (!student) {
      return res.status(404).json(formatResponse(false, "Student not found"));
    }

    if (student.user.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Student not in your school"));
    }

    const feeRecord = await FeeRecord.findOne({
      user: studentId,
      month: parseInt(month),
      year: parseInt(year),
      school: req.user.school._id,
      status: { $in: ["PENDING", "PARTIAL"] },
    }).populate("user", "_id name email");

    if (!feeRecord) {
      return res
        .status(404)
        .json(formatResponse(false, "No unpaid fee record found for this student, month and year"));
    }

    // Check if due date has passed
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!feeRecord.dueDate || new Date(feeRecord.dueDate) >= today) {
      return res
        .status(400)
        .json(formatResponse(false, "Due date has not passed yet. No alert needed"));
    }

    // Check if alert already exists for this fee record
    const existingAlert = await Alert.findOne({
      school: req.user.school._id,
      createdFor: studentId,
      title: { $regex: `Fee Due Reminder.*${month}.*${year}` },
    }).select("_id");

    if (existingAlert) {
      return res.status(409).json(formatResponse(false, "Alert already created for this student"));
    }

    const alert = await Alert.create({
      school: req.user.school._id,
      createdFor: studentId,
      createdBy: req.user._id,
      title: `Fee Due Reminder - ${new Date(feeRecord.dueDate).toLocaleDateString()}`,
      message: `Your fee payment for ${feeRecord.month}/${feeRecord.year} was due on ${new Date(
        feeRecord.dueDate
      ).toLocaleDateString()}. Outstanding amount: Rs. ${feeRecord.dueAmount}. Please pay immediately.`,
      viewed: false,
      viewedAt: null,
    });

    const populated = await Alert.findById(alert._id)
      .populate("createdFor", "_id name email")
      .populate("createdBy", "_id name email")
      .populate("school", "_id schoolName");

    return res
      .status(201)
      .json(formatResponse(true, "Alert created successfully for student", populated));
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error creating alert", null, error.message));
  }
};

const createAlertForClassUnpaidFees = async (req, res) => {
  try {
    const { classId, month, year } = req.body;

    if (!classId || !month || !year) {
      return res
        .status(400)
        .json(formatResponse(false, "classId, month, and year are required"));
    }

    if (month < 1 || month > 12) {
      return res.status(400).json(formatResponse(false, "Month must be 1-12"));
    }

    const cls = await Class.findById(classId).select("_id school");
    if (!cls) {
      return res.status(404).json(formatResponse(false, "Class not found"));
    }

    if (cls.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Class not in your school"));
    }

    // Find all unpaid fees for the class in the given month and year
    const unpaidFees = await FeeRecord.find({
      class: classId,
      month: parseInt(month),
      year: parseInt(year),
      school: req.user.school._id,
      status: { $in: ["PENDING", "PARTIAL"] },
      dueDate: { $lt: new Date() },
    }).populate("user", "_id name email");

    if (unpaidFees.length === 0) {
      return res
        .status(400)
        .json(formatResponse(false, "No overdue unpaid fees found in this class"));
    }

    const alerts = [];

    for (const feeRecord of unpaidFees) {
      // Check if alert already exists
      const existingAlert = await Alert.findOne({
        school: req.user.school._id,
        createdFor: feeRecord.user._id,
        title: { $regex: `Fee Due Reminder.*${month}.*${year}` },
      }).select("_id");

      if (!existingAlert) {
        const alert = await Alert.create({
          school: req.user.school._id,
          createdFor: feeRecord.user._id,
          createdBy: req.user._id,
          title: `Fee Due Reminder - ${new Date(feeRecord.dueDate).toLocaleDateString()}`,
          message: `Your fee payment for ${feeRecord.month}/${feeRecord.year} was due on ${
            new Date(feeRecord.dueDate).toLocaleDateString()
          }. Outstanding amount: Rs. ${feeRecord.dueAmount}. Please pay immediately.`,
          viewed: false,
          viewedAt: null,
        });
        alerts.push(alert._id);
      }
    }

    return res.status(201).json(
      formatResponse(
        true,
        `Alerts created for ${alerts.length} students with overdue fees`,
        {
          totalStudents: unpaidFees.length,
          alertsCreated: alerts.length,
          alertIds: alerts,
        }
      )
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error creating alerts", null, error.message));
  }
};

const createAlertForSchoolUnpaidFees = async (req, res) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json(formatResponse(false, "month and year are required"));
    }

    if (month < 1 || month > 12) {
      return res.status(400).json(formatResponse(false, "Month must be 1-12"));
    }

    // Find all unpaid fees for the school in the given month and year
    const unpaidFees = await FeeRecord.find({
      month: parseInt(month),
      year: parseInt(year),
      school: req.user.school._id,
      status: { $in: ["PENDING", "PARTIAL"] },
      dueDate: { $lt: new Date() },
    }).populate("user", "_id name email");

    if (unpaidFees.length === 0) {
      return res
        .status(400)
        .json(formatResponse(false, "No overdue unpaid fees found in the school"));
    }

    const alerts = [];

    for (const feeRecord of unpaidFees) {
      // Check if alert already exists
      const existingAlert = await Alert.findOne({
        school: req.user.school._id,
        createdFor: feeRecord.user._id,
        title: { $regex: `Fee Due Reminder.*${month}.*${year}` },
      }).select("_id");

      if (!existingAlert) {
        const alert = await Alert.create({
          school: req.user.school._id,
          createdFor: feeRecord.user._id,
          createdBy: req.user._id,
          title: `Fee Due Reminder - ${new Date(feeRecord.dueDate).toLocaleDateString()}`,
          message: `Your fee payment for ${feeRecord.month}/${feeRecord.year} was due on ${
            new Date(feeRecord.dueDate).toLocaleDateString()
          }. Outstanding amount: Rs. ${feeRecord.dueAmount}. Please pay immediately.`,
          viewed: false,
          viewedAt: null,
        });
        alerts.push(alert._id);
      }
    }

    return res.status(201).json(
      formatResponse(
        true,
        `Alerts created for ${alerts.length} students with overdue fees`,
        {
          totalStudents: unpaidFees.length,
          alertsCreated: alerts.length,
          alertIds: alerts,
        }
      )
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error creating alerts", null, error.message));
  }
};

// ==================== BULK FEE RECORD CREATION ====================

const createFeeRecordForClassStudents = async (req, res) => {
  try {
    const {
      classId,
      month,
      year,
      totalFee,
      dueAmount,
      discount = 0,
      fine = 0,
      dueDate,
      notes = "",
    } = req.body;

    if (!classId || !month || !year || !totalFee || dueAmount === undefined) {
      return res.status(400).json(formatResponse(false, "classId, month, year, totalFee, and dueAmount are required"));
    }

    if (month < 1 || month > 12) {
      return res.status(400).json(formatResponse(false, "Month must be 1-12"));
    }

    const cls = await Class.findById(classId).select("_id school");
    if (!cls) {
      return res.status(404).json(formatResponse(false, "Class not found"));
    }

    if (cls.school.toString() !== req.user.school._id.toString()) {
      return res.status(403).json(formatResponse(false, "Class not in your school"));
    }

    // Get all students in the class
    const students = await Student.find({ class: classId }).populate(
      "user",
      "_id school"
    );

    if (students.length === 0) {
      return res.status(400).json(formatResponse(false, "No students found in this class"));
    }

    const created = [];
    const skipped = [];
    const errors = [];

    for (const student of students) {
      try {
        // Check if record already exists
        const existing = await FeeRecord.findOne({
          user: student.user._id,
          month: parseInt(month),
          year: parseInt(year),
          school: req.user.school._id,
        }).select("_id");

        if (existing) {
          skipped.push({
            studentId: student.user._id,
            reason: "Record already exists",
          });
          continue;
        }

        // Create fee record
        const feeRecord = await FeeRecord.create({
          user: student.user._id,
          school: req.user.school._id,
          class: classId,
          month: parseInt(month),
          year: parseInt(year),
          totalFee,
          dueAmount,
          discount,
          fine,
          dueDate: dueDate ? new Date(dueDate) : null,
          notes,
          status: "PENDING",
          paidAmount: 0,
          createdBy: req.user._id,
          updatedBy: req.user._id,
        });

        created.push(feeRecord._id);
      } catch (err) {
        errors.push({
          studentId: student.user._id,
          error: err.message,
        });
      }
    }

    return res.status(201).json(
      formatResponse(true, "Bulk fee records creation completed", {
        totalStudents: students.length,
        created: created.length,
        skipped: skipped.length,
        errors: errors.length,
        createdIds: created,
        skippedDetails: skipped.length > 0 ? skipped : undefined,
        errorDetails: errors.length > 0 ? errors : undefined,
      })
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error creating bulk fee records", null, error.message));
  }
};

const createFeeRecordForSchoolStudents = async (req, res) => {
  try {
    const {
      month,
      year,
      totalFee,
      dueAmount,
      discount = 0,
      fine = 0,
      dueDate,
      notes = "",
    } = req.body;

    if (!month || !year || !totalFee || dueAmount === undefined) {
      return res.status(400).json(formatResponse(false, "month, year, totalFee, and dueAmount are required"));
    }

    if (month < 1 || month > 12) {
      return res.status(400).json(formatResponse(false, "Month must be 1-12"));
    }

    // Get all students in the school
    const students = await Student.find().populate({
      path: "user",
      select: "_id school",
      match: { school: req.user.school._id },
    });

    // Filter out students where user population failed (not in this school)
    const schoolStudents = students.filter((s) => s.user !== null);

    if (schoolStudents.length === 0) {
      return res.status(400).json(formatResponse(false, "No students found in this school"));
    }

    const created = [];
    const skipped = [];
    const errors = [];

    for (const student of schoolStudents) {
      try {
        // Check if record already exists
        const existing = await FeeRecord.findOne({
          user: student.user._id,
          month: parseInt(month),
          year: parseInt(year),
          school: req.user.school._id,
        }).select("_id");

        if (existing) {
          skipped.push({
            studentId: student.user._id,
            reason: "Record already exists",
          });
          continue;
        }

        // Create fee record
        const feeRecord = await FeeRecord.create({
          user: student.user._id,
          school: req.user.school._id,
          class: student.class,
          month: parseInt(month),
          year: parseInt(year),
          totalFee,
          dueAmount,
          discount,
          fine,
          dueDate: dueDate ? new Date(dueDate) : null,
          notes,
          status: "PENDING",
          paidAmount: 0,
          createdBy: req.user._id,
          updatedBy: req.user._id,
        });

        created.push(feeRecord._id);
      } catch (err) {
        errors.push({
          studentId: student.user._id,
          error: err.message,
        });
      }
    }

    return res.status(201).json(
      formatResponse(true, "Bulk fee records creation completed for school", {
        totalStudents: schoolStudents.length,
        created: created.length,
        skipped: skipped.length,
        errors: errors.length,
        createdIds: created,
        skippedDetails: skipped.length > 0 ? skipped : undefined,
        errorDetails: errors.length > 0 ? errors : undefined,
      })
    );
  } catch (error) {
    return res
      .status(500)
      .json(formatResponse(false, "Error creating bulk fee records for school", null, error.message));
  }
};

module.exports = {
  // Fee Records
  createFeeRecord,
  updateFeeRecord,
  deleteFeeRecord,
  getFeeRecordById,
  getStudentFeeByMonthYear,
  getStudentAllFees,
  // Bulk Fee Records
  createFeeRecordForClassStudents,
  createFeeRecordForSchoolStudents,
  // Analytics
  getClassWiseFeeMatrix,
  getSchoolWiseFeeMatrix,
  getPendingFeesByClass,
  getYearlyFeeMatrix,
  // Payments
  createPayment,
  getPaymentsByFeeRecord,
  getStudentPaymentHistory,
  // Alerts
  createAlertForStudentUnpaidFees,
  createAlertForClassUnpaidFees,
  createAlertForSchoolUnpaidFees,
};
