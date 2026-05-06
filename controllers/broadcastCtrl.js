const mongoose = require('mongoose');
const User = require('../models/user');
const Role = require('../models/role');
const Student = require('../models/student');
const Teacher = require('../models/teacher');
const ClassModel = require('../models/class');
const BroadcastCampaign = require('../models/broadcastCampaign');
const BroadcastDelivery = require('../models/broadcastDelivery');
const { sendByChannel } = require('../utils/broadcastProviders');

const ALLOWED_CHANNELS = ['alert', 'email', 'sms', 'whatsapp', 'telegram'];

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const getSchoolIdFromReq = (req) => {
  if (req?.user?.school?._id) return req.user.school._id.toString();
  if (req?.user?.school) return req.user.school.toString();
  return null;
};

const normalizeObjectIdList = (values = []) =>
  [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim())
      .filter((value) => mongoose.Types.ObjectId.isValid(value))
  )];

const normalizeStringList = (values = []) =>
  [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
  )];

const validateAudience = ({ userIds, roleNames, classIds }) =>
  userIds.length > 0 || roleNames.length > 0 || classIds.length > 0;

const resolveRecipients = async ({ schoolId, userIds, roleNames, classIds }) => {
  const recipientsMap = new Map();

  const attachUsers = (users = []) => {
    users.forEach((user) => {
      recipientsMap.set(String(user._id), user);
    });
  };

  if (userIds.length) {
    const directUsers = await User.find({
      _id: { $in: userIds },
      school: schoolId,
      active: true,
    })
      .populate('role', 'role')
      .select('_id name email phone smsPhone whatsappPhone telegramChatId role school active')
      .lean();
    attachUsers(directUsers);
  }

  if (roleNames.length) {
    const roleDocs = await Role.find({ role: { $in: roleNames } }).select('_id role').lean();
    const roleIds = roleDocs.map((role) => role._id);

    if (roleIds.length) {
      const roleUsers = await User.find({
        school: schoolId,
        role: { $in: roleIds },
        active: true,
      })
        .populate('role', 'role')
        .select('_id name email phone smsPhone whatsappPhone telegramChatId role school active')
        .lean();
      attachUsers(roleUsers);
    }
  }

  if (classIds.length) {
    const classDocs = await ClassModel.find({
      _id: { $in: classIds },
      school: schoolId,
    }).select('_id classTeacher');

    const validClassIds = classDocs.map((classDoc) => classDoc._id);
    const classTeacherIds = classDocs
      .map((classDoc) => classDoc.classTeacher)
      .filter(Boolean)
      .map((value) => String(value));

    const studentUserIds = validClassIds.length
      ? await Student.find({ class: { $in: validClassIds } }).select('user').lean()
      : [];

    const teacherUserDocs = [];
    if (classTeacherIds.length || validClassIds.length) {
      const teacherDocs = await Teacher.find({
        $or: [
          { _id: { $in: classTeacherIds } },
          { class: { $in: validClassIds } },
          { classTeacher: { $in: validClassIds } },
          { teachSclass: { $in: validClassIds } },
        ],
      })
        .select('user')
        .lean();
      teacherUserDocs.push(...teacherDocs);
    }

    const classUserIds = [
      ...studentUserIds.map((row) => String(row.user)),
      ...teacherUserDocs.map((row) => String(row.user)),
    ];

    const uniqueClassUserIds = [...new Set(classUserIds)].filter((value) => mongoose.Types.ObjectId.isValid(value));

    if (uniqueClassUserIds.length) {
      const classUsers = await User.find({
        _id: { $in: uniqueClassUserIds },
        school: schoolId,
        active: true,
      })
        .populate('role', 'role')
        .select('_id name email phone smsPhone whatsappPhone telegramChatId role school active')
        .lean();
      attachUsers(classUsers);
    }
  }

  return Array.from(recipientsMap.values());
};

const summarizeDeliveries = (deliveries = []) =>
  deliveries.reduce(
    (summary, delivery) => {
      summary.total += 1;
      if (delivery.status === 'sent') summary.sent += 1;
      if (delivery.status === 'failed') summary.failed += 1;
      if (delivery.status === 'skipped') summary.skipped += 1;
      return summary;
    },
    { total: 0, sent: 0, failed: 0, skipped: 0 }
  );

const previewRecipients = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const userIds = normalizeObjectIdList(req.body?.userIds);
    const classIds = normalizeObjectIdList(req.body?.classIds);
    const roleNames = normalizeStringList(req.body?.roleNames);

    if (!validateAudience({ userIds, roleNames, classIds })) {
      return res.status(400).json(formatResponse(false, 'At least one audience filter is required'));
    }

    const recipients = await resolveRecipients({ schoolId, userIds, roleNames, classIds });

    return res.status(200).json(
      formatResponse(true, 'Broadcast recipients preview generated successfully', {
        count: recipients.length,
        recipients: recipients.slice(0, 50).map((recipient) => ({
          _id: recipient._id,
          name: recipient.name,
          email: recipient.email || '',
          phone: recipient.phone || '',
          role: recipient?.role?.role || '',
          telegramChatId: recipient.telegramChatId || '',
        })),
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error previewing recipients', null, error.message));
  }
};

const createBroadcast = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const { title, subject = '', message } = req.body || {};
    const channels = normalizeStringList(req.body?.channels);
    const userIds = normalizeObjectIdList(req.body?.userIds);
    const classIds = normalizeObjectIdList(req.body?.classIds);
    const roleNames = normalizeStringList(req.body?.roleNames);

    if (!title || !message) {
      return res.status(400).json(formatResponse(false, 'title and message are required'));
    }

    if (!channels.length) {
      return res.status(400).json(formatResponse(false, 'At least one channel is required'));
    }

    const invalidChannels = channels.filter((channel) => !ALLOWED_CHANNELS.includes(channel));
    if (invalidChannels.length) {
      return res.status(400).json(formatResponse(false, `Invalid channels: ${invalidChannels.join(', ')}`));
    }

    if (!validateAudience({ userIds, roleNames, classIds })) {
      return res.status(400).json(formatResponse(false, 'At least one audience filter is required'));
    }

    const recipients = await resolveRecipients({ schoolId, userIds, roleNames, classIds });
    if (!recipients.length) {
      return res.status(404).json(formatResponse(false, 'No recipients found for the selected school audience'));
    }

    const broadcast = await BroadcastCampaign.create({
      school: schoolId,
      createdBy: req.user._id,
      title: String(title).trim(),
      subject: String(subject || '').trim(),
      message: String(message).trim(),
      channels,
      audience: {
        userIds,
        roleNames,
        classIds,
      },
      recipientCount: recipients.length,
      deliverySummary: {
        total: recipients.length * channels.length,
        sent: 0,
        failed: 0,
        skipped: 0,
      },
      status: 'processing',
    });

    const deliveryDocs = [];

    for (const recipient of recipients) {
      for (const channel of channels) {
        try {
          const result = await sendByChannel({
            channel,
            schoolId,
            createdBy: req.user._id,
            recipient,
            title: broadcast.title,
            subject: broadcast.subject || broadcast.title,
            message: broadcast.message,
          });

          deliveryDocs.push({
            broadcast: broadcast._id,
            school: schoolId,
            createdBy: req.user._id,
            createdFor: recipient._id,
            channel,
            destination: result.destination || '',
            status: result.status,
            provider: result.provider || '',
            providerMessageId: result.providerMessageId || '',
            errorMessage: result.errorMessage || '',
            responsePayload: result.responsePayload || null,
            sentAt: result.status === 'sent' ? (result.sentAt || new Date()) : null,
          });
        } catch (error) {
          deliveryDocs.push({
            broadcast: broadcast._id,
            school: schoolId,
            createdBy: req.user._id,
            createdFor: recipient._id,
            channel,
            destination: '',
            status: 'failed',
            provider: channel,
            providerMessageId: '',
            errorMessage: error.message,
            responsePayload: null,
            sentAt: null,
          });
        }
      }
    }

    if (deliveryDocs.length) {
      await BroadcastDelivery.insertMany(deliveryDocs);
    }

    const deliverySummary = summarizeDeliveries(deliveryDocs);
    let status = 'completed';

    if (deliverySummary.sent === 0 && (deliverySummary.failed > 0 || deliverySummary.skipped > 0)) {
      status = 'failed';
    } else if (deliverySummary.failed > 0 || deliverySummary.skipped > 0) {
      status = 'completed_with_failures';
    }

    broadcast.deliverySummary = deliverySummary;
    broadcast.status = status;
    await broadcast.save();

    const populatedBroadcast = await BroadcastCampaign.findById(broadcast._id)
      .populate('createdBy', '_id name email')
      .populate('school', '_id schoolName')
      .lean();

    return res.status(201).json(
      formatResponse(true, 'Broadcast created and processed successfully', populatedBroadcast)
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error creating broadcast', null, error.message));
  }
};

const getBroadcastHistory = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromReq(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    const broadcasts = await BroadcastCampaign.find({ school: schoolId })
      .populate('createdBy', '_id name email')
      .populate('school', '_id schoolName')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(
      formatResponse(true, 'Broadcast history fetched successfully', broadcasts)
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching broadcast history', null, error.message));
  }
};

const getBroadcastById = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromReq(req);
    const { broadcastId } = req.params;

    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    if (!broadcastId || !mongoose.Types.ObjectId.isValid(broadcastId)) {
      return res.status(400).json(formatResponse(false, 'Valid broadcastId is required'));
    }

    const broadcast = await BroadcastCampaign.findOne({
      _id: broadcastId,
      school: schoolId,
    })
      .populate('createdBy', '_id name email')
      .populate('school', '_id schoolName')
      .lean();

    if (!broadcast) {
      return res.status(404).json(formatResponse(false, 'Broadcast not found'));
    }

    return res.status(200).json(
      formatResponse(true, 'Broadcast fetched successfully', broadcast)
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching broadcast', null, error.message));
  }
};

const getBroadcastDeliveries = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromReq(req);
    const { broadcastId } = req.params;

    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context not found'));
    }

    if (!broadcastId || !mongoose.Types.ObjectId.isValid(broadcastId)) {
      return res.status(400).json(formatResponse(false, 'Valid broadcastId is required'));
    }

    const broadcastExists = await BroadcastCampaign.exists({
      _id: broadcastId,
      school: schoolId,
    });

    if (!broadcastExists) {
      return res.status(404).json(formatResponse(false, 'Broadcast not found'));
    }

    const deliveries = await BroadcastDelivery.find({
      broadcast: broadcastId,
      school: schoolId,
    })
      .populate('createdFor', '_id name email phone role')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(
      formatResponse(true, 'Broadcast deliveries fetched successfully', deliveries)
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching broadcast deliveries', null, error.message));
  }
};

module.exports = {
  previewRecipients,
  createBroadcast,
  getBroadcastHistory,
  getBroadcastById,
  getBroadcastDeliveries,
};
