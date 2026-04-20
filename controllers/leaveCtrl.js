const mongoose = require("mongoose");
const Leave = require("../models/leave");
const Attendance = require("../models/attendance");
const Student = require("../models/student");
const Alert = require("../models/alert");

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const getSchoolIdFromRequest = (req) => req.user?.school?._id || req.user?.school || null;

const normalizeDateToStartOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const normalizeDateToEndOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const listDatesInRange = (startDate, endDate) => {
  const dates = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const getMonthDateRange = (month, year) => {
  const startDate = new Date(year, month - 1, 1);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(year, month, 0);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
};

const getLeaveList = async ({ match, page, size, includeApplicant }) => {
  const skip = (page - 1) * size;

  const pipeline = [
    { $match: match },
    {
      $addFields: {
        statusOrder: {
          $switch: {
            branches: [
              { case: { $eq: ["$status", "pending"] }, then: 1 },
              { case: { $eq: ["$status", "approved"] }, then: 2 },
              { case: { $eq: ["$status", "declined"] }, then: 3 },
            ],
            default: 4,
          },
        },
      },
    },
    { $sort: { statusOrder: 1, createdAt: -1 } },
    { $skip: skip },
    { $limit: size },
  ];

  if (includeApplicant) {
    pipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "applicantUser",
          foreignField: "_id",
          as: "applicantUser",
        },
      },
      {
        $unwind: {
          path: "$applicantUser",
          preserveNullAndEmptyArrays: true,
        },
      }
    );
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "reviewedBy",
        foreignField: "_id",
        as: "reviewedBy",
      },
    },
    {
      $unwind: {
        path: "$reviewedBy",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        statusOrder: 0,
        "reviewedBy.password": 0,
        "reviewedBy.refreshToken": 0,
        "reviewedBy.resetToken": 0,
        "applicantUser.password": 0,
        "applicantUser.refreshToken": 0,
        "applicantUser.resetToken": 0,
      },
    }
  );

  const [items, totalCount] = await Promise.all([
    Leave.aggregate(pipeline),
    Leave.countDocuments(match),
  ]);

  return {
    items,
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / size),
  };
};

const syncAttendanceForApprovedLeave = async ({ leaveDoc, reviewedBy }) => {
  const startDate = normalizeDateToStartOfDay(leaveDoc.startDate);
  const endDate = normalizeDateToStartOfDay(leaveDoc.endDate);
  const dateRange = listDatesInRange(startDate, endDate);

  const studentProfile = await Student.findOne({ user: leaveDoc.applicantUser }).select("class").lean();
  const studentClassId = studentProfile?.class || null;

  const bulkOperations = dateRange.map((date) => {
    const remarks = `Auto-marked as leave via leave approval (${leaveDoc.leaveType})`;
    const updateFields = {
      status: "leave",
      remarks,
      updatedBy: reviewedBy,
    };

    if (studentClassId) {
      updateFields.class = studentClassId;
    }

    const insertFields = {
      user: leaveDoc.applicantUser,
      school: leaveDoc.school,
      date,
      createdBy: reviewedBy,
    };

    return {
      updateOne: {
        filter: {
          user: leaveDoc.applicantUser,
          school: leaveDoc.school,
          date,
        },
        update: {
          $set: updateFields,
          $setOnInsert: insertFields,
        },
        upsert: true,
      },
    };
  });

  const bulkResult = bulkOperations.length > 0
    ? await Attendance.bulkWrite(bulkOperations, { ordered: false })
    : null;

  return {
    totalDays: dateRange.length,
    matchedCount: bulkResult?.matchedCount || 0,
    modifiedCount: bulkResult?.modifiedCount || 0,
    upsertedCount: bulkResult?.upsertedCount || 0,
  };
};

const applyLeave = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);

    if (!schoolId) {
      return res.status(400).json(formatResponse(false, "Your account is not associated with any school"));
    }

    const applicantUserId = req.user._id;
    const { leaveType, startDate, endDate, purpose } = req.body;

    const normalizedStartDate = normalizeDateToStartOfDay(startDate);
    const normalizedEndDate = normalizeDateToStartOfDay(endDate);

    const overlapLeave = await Leave.findOne({
      applicantUser: applicantUserId,
      school: schoolId,
      status: { $in: ["pending", "approved"] },
      startDate: { $lte: normalizedEndDate },
      endDate: { $gte: normalizedStartDate },
    }).select("_id status startDate endDate");

    if (overlapLeave) {
      return res.status(409).json(
        formatResponse(false, "An overlapping leave request already exists", {
          leaveId: overlapLeave._id,
          status: overlapLeave.status,
          startDate: overlapLeave.startDate,
          endDate: overlapLeave.endDate,
        })
      );
    }

    const leaveDoc = await Leave.create({
      applicantUser: applicantUserId,
      school: schoolId,
      leaveType,
      purpose,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      submittedAt: new Date(),
      createdBy: applicantUserId,
      updatedBy: applicantUserId,
    });

    return res.status(201).json(formatResponse(true, "Leave request submitted successfully", leaveDoc));
  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error submitting leave request", null, error.message));
  }
};

const getMyLeaves = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);

    if (!schoolId) {
      return res.status(400).json(formatResponse(false, "Your account is not associated with any school"));
    }

    const userId = req.user._id;
    const { page = 1, size = 10, month, year, status = "all" } = req.query;

    const match = {
      school: new mongoose.Types.ObjectId(schoolId),
      applicantUser: new mongoose.Types.ObjectId(userId),
    };

    if (status !== "all") {
      match.status = status;
    }

    if (month && year) {
      const monthRange = getMonthDateRange(Number(month), Number(year));
      match.startDate = { $lte: monthRange.endDate };
      match.endDate = { $gte: monthRange.startDate };
    }

    const listResult = await getLeaveList({
      match,
      page: Number(page),
      size: Number(size),
      includeApplicant: false,
    });

    return res.status(200).json(
      formatResponse(true, "My leave requests fetched successfully", {
        leaves: listResult.items,
        totalCount: listResult.totalCount,
        currentPage: listResult.currentPage,
        totalPages: listResult.totalPages,
        filters: {
          month: month || null,
          year: year || null,
          status,
        },
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error fetching my leave requests", null, error.message));
  }
};

const deleteMyPendingLeave = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);

    if (!schoolId) {
      return res.status(400).json(formatResponse(false, "Your account is not associated with any school"));
    }

    const { id } = req.params;
    const userId = req.user._id;

    const leaveDoc = await Leave.findOne({
      _id: id,
      school: schoolId,
      applicantUser: userId,
    });

    if (!leaveDoc) {
      return res.status(404).json(formatResponse(false, "Leave request not found"));
    }

    if (leaveDoc.status !== "pending") {
      return res.status(409).json(formatResponse(false, "Only pending leave requests can be deleted"));
    }

    await leaveDoc.deleteOne();

    return res.status(200).json(formatResponse(true, "Leave request deleted successfully"));
  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error deleting leave request", null, error.message));
  }
};

const getAdminLeaves = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);

    if (!schoolId) {
      return res.status(400).json(formatResponse(false, "Your account is not associated with any school"));
    }

    const { page = 1, size = 10, month, year, status = "all" } = req.query;

    const match = {
      school: new mongoose.Types.ObjectId(schoolId),
    };

    if (status !== "all") {
      match.status = status;
    }

    if (month && year) {
      const monthRange = getMonthDateRange(Number(month), Number(year));
      match.startDate = { $lte: monthRange.endDate };
      match.endDate = { $gte: monthRange.startDate };
    }

    const listResult = await getLeaveList({
      match,
      page: Number(page),
      size: Number(size),
      includeApplicant: true,
    });

    return res.status(200).json(
      formatResponse(true, "Leave requests fetched successfully", {
        leaves: listResult.items,
        totalCount: listResult.totalCount,
        currentPage: listResult.currentPage,
        totalPages: listResult.totalPages,
        filters: {
          month: month || null,
          year: year || null,
          status,
        },
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error fetching leave requests", null, error.message));
  }
};

const reviewLeave = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);

    if (!schoolId) {
      return res.status(400).json(formatResponse(false, "Your account is not associated with any school"));
    }

    const { id } = req.params;
    const { action, reviewRemark } = req.body;
    const reviewerId = req.user._id;

    const leaveDoc = await Leave.findOne({
      _id: id,
      school: schoolId,
    });

    if (!leaveDoc) {
      return res.status(404).json(formatResponse(false, "Leave request not found"));
    }

    if (leaveDoc.status !== "pending") {
      return res.status(409).json(formatResponse(false, "Only pending leave requests can be reviewed"));
    }

    if (leaveDoc.applicantUser.toString() === reviewerId.toString()) {
      return res.status(403).json(formatResponse(false, "You cannot approve or decline your own leave request"));
    }

    let syncMeta = null;

    if (action === "approved") {
      syncMeta = await syncAttendanceForApprovedLeave({ leaveDoc, reviewedBy: reviewerId });
      leaveDoc.status = "approved";
      leaveDoc.attendanceSyncMeta = {
        ...syncMeta,
        syncedAt: new Date(),
      };
    }

    if (action === "declined") {
      leaveDoc.status = "declined";
      leaveDoc.attendanceSyncMeta = null;
    }

    leaveDoc.reviewRemark = reviewRemark || "";
    leaveDoc.reviewedBy = reviewerId;
    leaveDoc.reviewedAt = new Date();
    leaveDoc.updatedBy = reviewerId;

    await leaveDoc.save();

    const leavePeriod = `${new Date(leaveDoc.startDate).toLocaleDateString()} - ${new Date(leaveDoc.endDate).toLocaleDateString()}`;
    const alertTitle = action === "approved" ? "Leave Approved" : "Leave Declined";
    const alertMessage =
      action === "approved"
        ? `Your ${leaveDoc.leaveType} leave request (${leavePeriod}) has been approved.${reviewRemark ? ` Remark: ${reviewRemark}` : ""}`
        : `Your ${leaveDoc.leaveType} leave request (${leavePeriod}) has been declined.${reviewRemark ? ` Remark: ${reviewRemark}` : ""}`;

    await Alert.create({
      school: leaveDoc.school,
      createdFor: leaveDoc.applicantUser,
      createdBy: reviewerId,
      title: alertTitle,
      message: alertMessage,
      viewed: false,
      viewedAt: null,
    });

    return res.status(200).json(
      formatResponse(true, `Leave request ${leaveDoc.status} successfully`, {
        leave: leaveDoc,
        attendanceSync: syncMeta,
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, "Error reviewing leave request", null, error.message));
  }
};

module.exports = {
  applyLeave,
  getMyLeaves,
  deleteMyPendingLeave,
  getAdminLeaves,
  reviewLeave,
};
