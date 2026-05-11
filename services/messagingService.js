const mongoose = require('mongoose');
const Conversation = require('../models/conversation');
const ConversationMember = require('../models/conversationMember');
const Message = require('../models/message');
const User = require('../models/user');

const BROADCAST_NAME = 'School Broadcast';
const BROADCAST_DESCRIPTION = 'School-wide announcements and updates';

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const getSchoolIdFromUser = (user) => {
  if (!user?.school) return null;
  if (typeof user.school === 'string') return user.school.toString();
  return user.school?._id?.toString?.() || user.school?.toString?.() || null;
};

const getRoleName = (user) => {
  if (!user?.role) return '';
  if (typeof user.role === 'string') return user.role;
  return user.role?.role || '';
};

const isValidObjectId = (value) => Boolean(value) && mongoose.Types.ObjectId.isValid(value);

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildDirectKey = (a, b) => [a.toString(), b.toString()].sort().join(':');

const sanitizeAttachments = (attachments = []) =>
  Array.isArray(attachments)
    ? attachments
        .filter((item) => item && typeof item === 'object' && item.url)
        .map((item) => ({
          url: String(item.url || '').trim(),
          publicId: String(item.publicId || '').trim(),
          mimeType: String(item.mimeType || 'application/octet-stream').trim(),
          fileName: String(item.fileName || 'attachment').trim(),
          fileSize: Number(item.fileSize || 0),
          duration: item.duration == null ? null : Number(item.duration),
          width: item.width == null ? null : Number(item.width),
          height: item.height == null ? null : Number(item.height),
        }))
    : [];

const detectMessageType = ({ type, attachments, bodyPlain }) => {
  if (type && ['text', 'image', 'video', 'audio', 'file', 'system'].includes(type)) {
    return type;
  }

  if (attachments?.length) {
    const firstType = attachments[0]?.mimeType || '';
    if (firstType.startsWith('image/')) return 'image';
    if (firstType.startsWith('video/')) return 'video';
    if (firstType.startsWith('audio/')) return 'audio';
    return 'file';
  }

  return bodyPlain ? 'text' : 'file';
};

const ensureBroadcastMembership = async ({ conversation, userId, schoolId }) => {
  let member = await ConversationMember.findOne({
    conversation: conversation._id,
    user: userId,
  });

  if (!member) {
    member = await ConversationMember.create({
      conversation: conversation._id,
      user: userId,
      school: schoolId,
      roleInGroup: 'participant',
    });

    await Conversation.updateOne(
      { _id: conversation._id },
      { $inc: { memberCount: 1 } }
    );
    conversation.memberCount = (conversation.memberCount || 0) + 1;
  }

  return member;
};

const ensureSchoolBroadcastConversation = async ({ schoolId, userId }) => {
  let conversation = await Conversation.findOne({
    school: schoolId,
    type: 'school_broadcast',
  });

  if (!conversation) {
    conversation = await Conversation.create({
      school: schoolId,
      type: 'school_broadcast',
      name: BROADCAST_NAME,
      description: BROADCAST_DESCRIPTION,
      createdBy: userId,
      memberCount: 0,
      directKey: `broadcast:${schoolId}`,
    });
  }

  const member = await ensureBroadcastMembership({
    conversation,
    userId,
    schoolId,
  });

  return { conversation, member };
};

const serializeUser = (userDoc) => {
  if (!userDoc) return null;
  const role = typeof userDoc.role === 'string' ? userDoc.role : userDoc.role?.role;

  return {
    _id: userDoc._id?.toString?.() || userDoc._id,
    name: userDoc.name,
    email: userDoc.email,
    image: userDoc.image,
    username: userDoc.username,
    role: role || '',
  };
};

const serializeReplyPreview = (messageDoc) => {
  if (!messageDoc) return null;

  return {
    _id: messageDoc._id?.toString?.() || messageDoc._id,
    bodyPlain: messageDoc.bodyPlain || '',
    type: messageDoc.type,
    sender: serializeUser(messageDoc.sender),
    createdAt: messageDoc.createdAt,
  };
};

const serializeMessage = (messageDoc) => {
  if (!messageDoc) return null;

  return {
    _id: messageDoc._id?.toString?.() || messageDoc._id,
    conversation: messageDoc.conversation?.toString?.() || messageDoc.conversation,
    school: messageDoc.school?.toString?.() || messageDoc.school,
    sender: serializeUser(messageDoc.sender),
    type: messageDoc.type,
    bodyPlain: messageDoc.bodyPlain || '',
    bodyMarkdown: messageDoc.bodyMarkdown || '',
    attachments: Array.isArray(messageDoc.attachments) ? messageDoc.attachments : [],
    replyToMessage: serializeReplyPreview(messageDoc.replyToMessage),
    editedAt: messageDoc.editedAt,
    deletedAt: messageDoc.deletedAt,
    createdAt: messageDoc.createdAt,
    updatedAt: messageDoc.updatedAt,
  };
};

const canPostToConversation = (conversation, user) => {
  if (conversation.type !== 'school_broadcast') return true;
  const role = getRoleName(user);
  return role === 'admin' || role === 'teacher';
};

const getConversationContext = async ({ conversationId, user, ensureBroadcast = true }) => {
  const schoolId = getSchoolIdFromUser(user);
  if (!schoolId) {
    const error = new Error('School context is required');
    error.statusCode = 400;
    throw error;
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    const error = new Error('Conversation not found');
    error.statusCode = 404;
    throw error;
  }

  if (conversation.school.toString() !== schoolId) {
    const error = new Error('Unauthorized school access');
    error.statusCode = 403;
    throw error;
  }

  let member = await ConversationMember.findOne({
    conversation: conversation._id,
    user: user._id,
  });

  if (!member && conversation.type === 'school_broadcast' && ensureBroadcast) {
    member = await ensureBroadcastMembership({
      conversation,
      userId: user._id,
      schoolId,
    });
  }

  if (!member) {
    const error = new Error('You are not a member of this conversation');
    error.statusCode = 403;
    throw error;
  }

  return {
    conversation,
    member,
    schoolId,
  };
};

const populateMessageById = async (messageId) =>
  Message.findById(messageId)
    .populate('sender', '_id name email image username role')
    .populate({
      path: 'replyToMessage',
      select: '_id bodyPlain type sender createdAt',
      populate: {
        path: 'sender',
        select: '_id name image role',
      },
    });

const getUnreadCount = async ({ conversationId, userId, lastReadAt }) => {
  const query = {
    conversation: conversationId,
    deletedAt: null,
    sender: { $ne: userId },
  };

  if (lastReadAt) {
    query.createdAt = { $gt: lastReadAt };
  }

  return Message.countDocuments(query);
};

const buildConversationSummary = async ({
  conversation,
  member,
  currentUserId,
  currentUserRole = '',
  preloadedMembers = null,
}) => {
  const members =
    preloadedMembers ||
    (await ConversationMember.find({ conversation: conversation._id })
      .populate('user', '_id name email image username role')
      .sort({ joinedAt: 1 }));

  const serializedMembers = members
    .filter((entry) => entry.user)
    .map((entry) => ({
      _id: entry._id?.toString?.() || entry._id,
      roleInGroup: entry.roleInGroup,
      isMuted: entry.isMuted,
      joinedAt: entry.joinedAt,
      user: serializeUser(entry.user),
    }));

  const otherMember = conversation.type === 'direct'
    ? serializedMembers.find((entry) => entry.user?._id !== currentUserId?.toString())
    : null;

  const title =
    conversation.type === 'direct'
      ? otherMember?.user?.name || 'Direct Chat'
      : conversation.name || BROADCAST_NAME;

  const image =
    conversation.type === 'direct'
      ? otherMember?.user?.image || null
      : null;

  let lastMessage = null;
  if (conversation.lastMessage) {
    const lastMessageDoc =
      typeof conversation.lastMessage?.type === 'string' && conversation.lastMessage?.sender
        ? conversation.lastMessage
        : await populateMessageById(conversation.lastMessage);
    lastMessage = serializeMessage(lastMessageDoc);
  }

  return {
    _id: conversation._id?.toString?.() || conversation._id,
    school: conversation.school?.toString?.() || conversation.school,
    type: conversation.type,
    name: conversation.name || '',
    description: conversation.description || '',
    title,
    image,
    isArchived: conversation.isArchived,
    memberCount: conversation.memberCount,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    lastMessage,
    unreadCount: await getUnreadCount({
      conversationId: conversation._id,
      userId: currentUserId,
      lastReadAt: member?.lastReadAt || null,
    }),
    currentMember: member
      ? {
          _id: member._id?.toString?.() || member._id,
          roleInGroup: member.roleInGroup,
          lastReadAt: member.lastReadAt,
          lastReadMessage: member.lastReadMessage?.toString?.() || member.lastReadMessage || null,
          isMuted: member.isMuted,
        }
      : null,
    members: serializedMembers,
    canPost: canPostToConversation(conversation, {
      _id: currentUserId,
      role: { role: currentUserRole || '' },
    }),
  };
};

const listConversationMemberIds = async (conversationId) => {
  const members = await ConversationMember.find({ conversation: conversationId }).select('user').lean();
  return members.map((item) => item.user.toString());
};

const createMessage = async ({
  conversationId,
  user,
  type,
  bodyPlain,
  bodyMarkdown,
  attachments,
  replyToMessageId,
}) => {
  const { conversation, schoolId } = await getConversationContext({
    conversationId,
    user,
  });

  if (conversation.isArchived) {
    const error = new Error('Conversation is archived');
    error.statusCode = 400;
    throw error;
  }

  if (!canPostToConversation(conversation, user)) {
    const error = new Error('You cannot post in this conversation');
    error.statusCode = 403;
    throw error;
  }

  const plainText = String(bodyPlain || '').trim();
  const markdownText = String(bodyMarkdown || bodyPlain || '').trim();
  const cleanAttachments = sanitizeAttachments(attachments);

  if (!plainText && !cleanAttachments.length) {
    const error = new Error('Message text or attachment is required');
    error.statusCode = 400;
    throw error;
  }

  let replyToMessage = null;
  if (replyToMessageId) {
    if (!isValidObjectId(replyToMessageId)) {
      const error = new Error('Invalid replyToMessageId');
      error.statusCode = 400;
      throw error;
    }

    replyToMessage = await Message.findOne({
      _id: replyToMessageId,
      conversation: conversation._id,
      deletedAt: null,
    });

    if (!replyToMessage) {
      const error = new Error('Reply target not found in this conversation');
      error.statusCode = 404;
      throw error;
    }
  }

  const nextType = detectMessageType({
    type,
    attachments: cleanAttachments,
    bodyPlain: plainText,
  });

  const message = await Message.create({
    conversation: conversation._id,
    school: schoolId,
    sender: user._id,
    type: nextType,
    bodyPlain: plainText,
    bodyMarkdown: markdownText,
    attachments: cleanAttachments,
    replyToMessage: replyToMessage ? replyToMessage._id : null,
  });

  await Conversation.findByIdAndUpdate(conversation._id, {
    lastMessage: message._id,
    updatedAt: new Date(),
  });

  const populatedMessage = await populateMessageById(message._id);
  return {
    message: serializeMessage(populatedMessage),
    conversationId: conversation._id.toString(),
    memberIds: await listConversationMemberIds(conversation._id),
  };
};

const markConversationRead = async ({ conversationId, user, messageId = null }) => {
  const { conversation, member } = await getConversationContext({
    conversationId,
    user,
  });

  let targetMessageId = messageId;
  let targetTimestamp = new Date();

  if (targetMessageId) {
    if (!isValidObjectId(targetMessageId)) {
      const error = new Error('Invalid messageId');
      error.statusCode = 400;
      throw error;
    }

    const message = await Message.findOne({
      _id: targetMessageId,
      conversation: conversation._id,
      deletedAt: null,
    }).select('_id createdAt');

    if (!message) {
      const error = new Error('Message not found in this conversation');
      error.statusCode = 404;
      throw error;
    }

    targetTimestamp = message.createdAt || targetTimestamp;
  } else if (conversation.lastMessage) {
    targetMessageId = conversation.lastMessage;
    const lastMessage = await Message.findById(conversation.lastMessage).select('_id createdAt');
    if (lastMessage?.createdAt) {
      targetTimestamp = lastMessage.createdAt;
    }
  }

  member.lastReadMessage = targetMessageId || null;
  member.lastReadAt = targetTimestamp;
  await member.save();

  return {
    conversationId: conversation._id.toString(),
    lastReadMessage: targetMessageId?.toString?.() || targetMessageId || null,
    lastReadAt: member.lastReadAt,
    unreadCount: 0,
  };
};

const getMessagingContacts = async ({ user, q = '', roles = [] }) => {
  const schoolId = getSchoolIdFromUser(user);
  const currentUserId = user?._id?.toString?.();

  const cleanQ = String(q || '').trim();

  // Short-circuit for very small queries to avoid expensive DB calls
  if (cleanQ.length > 0 && cleanQ.length < 3) return [];

  const regex = cleanQ ? new RegExp(escapeRegex(cleanQ), 'i') : null;

  const users = await User.find({
    school: schoolId,
    active: true,
    _id: { $ne: currentUserId },
    ...(regex
      ? {
          $or: [
            { name: { $regex: regex } },
            { username: { $regex: regex } },
            { email: { $regex: regex } },
            { phone: { $regex: regex } },
          ],
        }
      : {}),
  })
    .populate('role', 'role')
    .select('_id name email phone image username role school')
    .sort({ name: 1 })
    .limit(6)
    .lean();

  const normalizedRoles = Array.isArray(roles)
    ? roles.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)
    : [];

  return users
    .map((entry) => ({
      _id: entry._id.toString(),
      name: entry.name,
      email: entry.email,
      phone: entry.phone,
      image: entry.image,
      username: entry.username,
      role: entry.role?.role || '',
      school: entry.school?.toString?.() || entry.school,
    }))
    .filter((entry) => !normalizedRoles.length || normalizedRoles.includes(entry.role));
};

module.exports = {
  BROADCAST_NAME,
  formatResponse,
  getSchoolIdFromUser,
  getRoleName,
  isValidObjectId,
  toObjectId,
  buildDirectKey,
  ensureSchoolBroadcastConversation,
  ensureBroadcastMembership,
  getConversationContext,
  serializeMessage,
  serializeUser,
  buildConversationSummary,
  createMessage,
  markConversationRead,
  getMessagingContacts,
  listConversationMemberIds,
  canPostToConversation,
  sanitizeAttachments,
};
