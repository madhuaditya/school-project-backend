const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Conversation = require('../models/conversation');
const ConversationMember = require('../models/conversationMember');
const Message = require('../models/message');
const User = require('../models/user');
const {
  formatResponse,
  getSchoolIdFromUser,
  buildDirectKey,
  ensureSchoolBroadcastConversation,
  buildConversationSummary,
  createMessage,
  markConversationRead,
  getConversationContext,
  getMessagingContacts,
  sanitizeAttachments,
  isValidObjectId,
  getRoleName,
  serializeMessage,
} = require('../services/messagingService');
const { getIO, emitConversationUpdates } = require('../sockets/messagingSocket');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const uploadChatFile = upload.single('file');

const withUpload = (req, res, next) =>
  uploadChatFile(req, res, (error) => {
    if (error) {
      return res.status(400).json(formatResponse(false, 'Upload failed', null, error.message));
    }
    return next();
  });

const getMessagingContactsList = async (req, res) => {
  try {
    const q = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
    const roles = typeof req.query?.roles === 'string'
      ? req.query.roles.split(',').map((entry) => entry.trim()).filter(Boolean)
      : [];

    const contacts = await getMessagingContacts({
      user: req.user,
      q,
      roles,
    });

    return res.status(200).json(formatResponse(true, 'Messaging contacts fetched successfully', contacts));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching messaging contacts', null, error.message));
  }
};

const createOrGetDirectConversation = async (req, res) => {
  try {
    const { targetUserId } = req.body || {};
    const schoolId = getSchoolIdFromUser(req.user);

    if (!isValidObjectId(targetUserId)) {
      return res.status(400).json(formatResponse(false, 'Valid targetUserId is required'));
    }

    if (req.user._id.toString() === targetUserId.toString()) {
      return res.status(400).json(formatResponse(false, 'You cannot create a direct conversation with yourself'));
    }

    const targetUser = await User.findById(targetUserId).populate('role', 'role').populate('school', '_id schoolName');
    if (!targetUser || !targetUser.active) {
      return res.status(404).json(formatResponse(false, 'Target user not found'));
    }

    if (targetUser.school?._id?.toString() !== schoolId) {
      return res.status(403).json(formatResponse(false, 'Target user is not in your school'));
    }

    const directKey = buildDirectKey(req.user._id, targetUserId);

    let conversation = await Conversation.findOne({
      school: schoolId,
      type: 'direct',
      directKey,
    }).populate({
      path: 'lastMessage',
      populate: {
        path: 'sender',
        select: '_id name email image username role',
      },
    });

    let currentMember = null;

    if (!conversation) {
      conversation = await Conversation.create({
        school: schoolId,
        type: 'direct',
        createdBy: req.user._id,
        directKey,
        memberCount: 2,
      });

      await ConversationMember.insertMany([
        {
          conversation: conversation._id,
          user: req.user._id,
          school: schoolId,
          roleInGroup: 'participant',
        },
        {
          conversation: conversation._id,
          user: targetUserId,
          school: schoolId,
          roleInGroup: 'participant',
        },
      ]);
    }

    currentMember = await ConversationMember.findOne({
      conversation: conversation._id,
      user: req.user._id,
    }).populate('user', '_id name email image username role');

    const members = await ConversationMember.find({
      conversation: conversation._id,
    })
      .populate('user', '_id name email image username role')
      .sort({ joinedAt: 1 });

    const summary = await buildConversationSummary({
      conversation,
      member: currentMember,
      currentUserId: req.user._id,
      currentUserRole: getRoleName(req.user),
      preloadedMembers: members,
    });

    return res.status(200).json(formatResponse(true, 'Direct conversation ready', summary));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json(formatResponse(false, 'Direct conversation already exists'));
    }
    return res.status(500).json(formatResponse(false, 'Error preparing direct conversation', null, error.message));
  }
};

const createPrivateGroupConversation = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromUser(req.user);
    const { name, description = '', memberIds = [] } = req.body || {};

    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return res.status(400).json(formatResponse(false, 'Group name is required'));
    }

    const normalizedIds = [...new Set(
      Array.isArray(memberIds)
        ? memberIds.map((entry) => String(entry || '').trim()).filter(Boolean)
        : []
    )].filter((entry) => entry !== req.user._id.toString());

    if (!normalizedIds.length) {
      return res.status(400).json(formatResponse(false, 'At least one member is required'));
    }

    if (normalizedIds.some((entry) => !isValidObjectId(entry))) {
      return res.status(400).json(formatResponse(false, 'All memberIds must be valid user ids'));
    }

    const users = await User.find({
      _id: { $in: normalizedIds },
      school: schoolId,
      active: true,
    })
      .populate('role', 'role')
      .select('_id name email image username role school');

    if (users.length !== normalizedIds.length) {
      return res.status(400).json(formatResponse(false, 'All group members must be active users in the same school'));
    }

    const conversation = await Conversation.create({
      school: schoolId,
      type: 'private_group',
      name: cleanName,
      description: String(description || '').trim(),
      createdBy: req.user._id,
      memberCount: users.length + 1,
      directKey: `group:${schoolId}:${req.user._id}:${Date.now()}`,
    });

    const membersToCreate = [
      {
        conversation: conversation._id,
        user: req.user._id,
        school: schoolId,
        roleInGroup: 'owner',
      },
      ...users.map((entry) => ({
        conversation: conversation._id,
        user: entry._id,
        school: schoolId,
        roleInGroup: 'member',
      })),
    ];

    await ConversationMember.insertMany(membersToCreate);

    const members = await ConversationMember.find({
      conversation: conversation._id,
    })
      .populate('user', '_id name email image username role')
      .sort({ joinedAt: 1 });

    const currentMember = members.find(
      (entry) => entry.user?._id?.toString() === req.user._id.toString()
    );

    const summary = await buildConversationSummary({
      conversation,
      member: currentMember,
      currentUserId: req.user._id,
      currentUserRole: getRoleName(req.user),
      preloadedMembers: members,
    });

    return res.status(201).json(formatResponse(true, 'Private group created successfully', summary));
  } catch (error) {
    console.log(error);
    return res.status(500).json(formatResponse(false, 'Error creating private group', null, error.message));
  }
};

const listConversations = async (req, res) => {
  try {
    await ensureSchoolBroadcastConversation({
      schoolId: getSchoolIdFromUser(req.user),
      userId: req.user._id,
    });

    const memberships = await ConversationMember.find({
      user: req.user._id,
    })
      .populate({
        path: 'conversation',
        populate: {
          path: 'lastMessage',
          populate: {
            path: 'sender',
            select: '_id name email image username role',
          },
        },
      })
      .sort({ updatedAt: -1 });

    const conversationIds = memberships
      .map((entry) => entry.conversation?._id)
      .filter(Boolean);

    const allMembers = await ConversationMember.find({
      conversation: { $in: conversationIds },
    })
      .populate('user', '_id name email image username role')
      .sort({ joinedAt: 1 });

    const memberMap = allMembers.reduce((acc, entry) => {
      const key = entry.conversation.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(entry);
      return acc;
    }, {});

    const summaries = [];
    for (const membership of memberships) {
      if (!membership.conversation || membership.conversation.isArchived) continue;
      const summary = await buildConversationSummary({
        conversation: membership.conversation,
        member: membership,
        currentUserId: req.user._id,
        currentUserRole: getRoleName(req.user),
        preloadedMembers: memberMap[membership.conversation._id.toString()] || [],
      });
      summaries.push(summary);
    }

    summaries.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return res.status(200).json(formatResponse(true, 'Conversations fetched successfully', summaries));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching conversations', null, error.message));
  }
};

const getConversationMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(Number(req.query?.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query?.limit) || 30, 1), 100);

    const { conversation } = await getConversationContext({
      conversationId: id,
      user: req.user,
    });

    const total = await Message.countDocuments({
      conversation: conversation._id,
      deletedAt: null,
    });

    const messages = await Message.find({
      conversation: conversation._id,
      deletedAt: null,
    })
      .populate('sender', '_id name email image username role')
      .populate({
        path: 'replyToMessage',
        select: '_id bodyPlain type sender createdAt',
        populate: {
          path: 'sender',
          select: '_id name image role',
        },
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json(
      formatResponse(true, 'Conversation messages fetched successfully', {
        records: messages.map((entry) => ({
          ...serializeMessage(entry),
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    );
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json(formatResponse(false, 'Error fetching conversation messages', null, error.message));
  }
};

const uploadMessagingAsset = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(formatResponse(false, 'File is required'));
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'school-messaging',
          resource_type: 'auto',
        },
        (error, uploadResult) => {
          if (error) return reject(error);
          return resolve(uploadResult);
        }
      );

      stream.end(req.file.buffer);
    });

    const attachment = sanitizeAttachments([
      {
        url: result.secure_url,
        publicId: result.public_id,
        mimeType: req.file.mimetype,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        duration: result.duration || null,
        width: result.width || null,
        height: result.height || null,
      },
    ])[0];

    return res.status(201).json(formatResponse(true, 'Messaging file uploaded successfully', attachment));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error uploading messaging file', null, error.message));
  }
};

const createConversationMessage = async (req, res) => {
  try {
    const result = await createMessage({
      conversationId: req.params.id,
      user: req.user,
      type: req.body?.type,
      bodyPlain: req.body?.bodyPlain,
      bodyMarkdown: req.body?.bodyMarkdown,
      attachments: req.body?.attachments,
      replyToMessageId: req.body?.replyToMessageId,
    });

    const io = getIO();
    if (io) {
      io.to(`conversation:${result.conversationId}`).emit('message:new', result.message);
      await emitConversationUpdates({
        io,
        conversationId: result.conversationId,
        memberIds: result.memberIds,
      });
    }

    return res.status(201).json(formatResponse(true, 'Message sent successfully', result.message));
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json(formatResponse(false, 'Error sending message', null, error.message));
  }
};

const markConversationAsRead = async (req, res) => {
  try {
    const result = await markConversationRead({
      conversationId: req.params.id,
      user: req.user,
      messageId: req.body?.messageId,
    });

    const io = getIO();
    if (io) {
      io.to(`user:${req.user._id.toString()}`).emit('conversation:unread', result);
    }

    return res.status(200).json(formatResponse(true, 'Conversation marked as read', result));
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    return res.status(statusCode).json(formatResponse(false, 'Error updating read state', null, error.message));
  }
};

const getSchoolBroadcastConversation = async (req, res) => {
  try {
    const { conversation, member } = await ensureSchoolBroadcastConversation({
      schoolId: getSchoolIdFromUser(req.user),
      userId: req.user._id,
    });

    const members = await ConversationMember.find({
      conversation: conversation._id,
    })
      .populate('user', '_id name email image username role')
      .sort({ joinedAt: 1 });

    const summary = await buildConversationSummary({
      conversation,
      member,
      currentUserId: req.user._id,
      currentUserRole: getRoleName(req.user),
      preloadedMembers: members,
    });

    return res.status(200).json(formatResponse(true, 'School broadcast conversation fetched successfully', summary));
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching school broadcast conversation', null, error.message));
  }
};

module.exports = {
  withUpload,
  getMessagingContactsList,
  createOrGetDirectConversation,
  createPrivateGroupConversation,
  listConversations,
  getConversationMessages,
  uploadMessagingAsset,
  createConversationMessage,
  markConversationAsRead,
  getSchoolBroadcastConversation,
};
