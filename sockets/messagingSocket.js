const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const User = require('../models/user');
const ConversationMember = require('../models/conversationMember');
const Conversation = require('../models/conversation');
const {
  createMessage,
  getConversationContext,
  buildConversationSummary,
  markConversationRead,
  getRoleName,
} = require('../services/messagingService');

let ioInstance = null;

const getSocketToken = (socket) => {
  const authToken = socket.handshake?.auth?.token;
  const queryToken = socket.handshake?.query?.token;
  const header = socket.handshake?.headers?.authorization;

  if (authToken) return authToken;
  if (queryToken) return queryToken;
  if (header?.startsWith('Bearer ')) return header.split(' ')[1];
  return null;
};

const emitConversationUpdates = async ({ io, conversationId, memberIds = [] }) => {
  const conversation = await Conversation.findById(conversationId).populate({
    path: 'lastMessage',
    populate: {
      path: 'sender',
      select: '_id name email image username role',
    },
  });

  if (!conversation) return;

  const members = await ConversationMember.find({ conversation: conversationId })
    .populate('user', '_id name email image username role')
    .sort({ joinedAt: 1 });

  const memberMap = new Map(members.map((entry) => [entry.user?._id?.toString?.(), entry]));

  for (const userId of memberIds) {
    const member = memberMap.get(userId.toString());
    if (!member) continue;

    const summary = await buildConversationSummary({
      conversation,
      member,
      currentUserId: userId,
      currentUserRole: getRoleName(member.user),
      preloadedMembers: members,
    });

    io.to(`user:${userId}`).emit('conversation:updated', summary);
    io.to(`user:${userId}`).emit('conversation:unread', {
      conversationId: summary._id,
      unreadCount: summary.unreadCount,
    });
  }
};

const initMessagingSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);
      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded._id)
        .populate('role', 'role')
        .populate('school', '_id schoolName');

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      return next();
    } catch (error) {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    socket.join(`user:${user._id.toString()}`);

    socket.on('conversation:join', async (payload = {}, ack) => {
      try {
        const { conversationId } = payload;
        const { conversation } = await getConversationContext({
          conversationId,
          user,
        });

        socket.join(`conversation:${conversation._id.toString()}`);
        ack?.({
          success: true,
          conversationId: conversation._id.toString(),
        });
      } catch (error) {
        ack?.({
          success: false,
          msg: error.message || 'Failed to join conversation',
        });
      }
    });

    socket.on('conversation:leave', async (payload = {}, ack) => {
      const conversationId = payload?.conversationId;
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
      }
      ack?.({ success: true, conversationId });
    });

    socket.on('message:send', async (payload = {}, ack) => {
      try {
        const result = await createMessage({
          conversationId: payload.conversationId,
          user,
          type: payload.type,
          bodyPlain: payload.bodyPlain,
          bodyMarkdown: payload.bodyMarkdown,
          attachments: payload.attachments,
          replyToMessageId: payload.replyToMessageId,
        });

        io.to(`conversation:${result.conversationId}`).emit('message:new', {
          ...result.message,
          clientTempId: payload.clientTempId || null,
        });

        await emitConversationUpdates({
          io,
          conversationId: result.conversationId,
          memberIds: result.memberIds,
        });

        ack?.({
          success: true,
          data: result.message,
        });
      } catch (error) {
        ack?.({
          success: false,
          msg: error.message || 'Failed to send message',
        });
      }
    });

    socket.on('message:read', async (payload = {}, ack) => {
      try {
        const result = await markConversationRead({
          conversationId: payload.conversationId,
          user,
          messageId: payload.messageId,
        });

        io.to(`user:${user._id.toString()}`).emit('conversation:unread', result);
        ack?.({
          success: true,
          data: result,
        });
      } catch (error) {
        ack?.({
          success: false,
          msg: error.message || 'Failed to update read state',
        });
      }
    });

    socket.on('typing:start', async (payload = {}, ack) => {
      try {
        const { conversation } = await getConversationContext({
          conversationId: payload.conversationId,
          user,
        });

        socket.to(`conversation:${conversation._id.toString()}`).emit('typing:update', {
          conversationId: conversation._id.toString(),
          user: {
            _id: user._id.toString(),
            name: user.name,
            image: user.image,
          },
          isTyping: true,
        });

        ack?.({ success: true });
      } catch (error) {
        ack?.({ success: false, msg: error.message || 'Typing failed' });
      }
    });

    socket.on('typing:stop', async (payload = {}, ack) => {
      try {
        const { conversation } = await getConversationContext({
          conversationId: payload.conversationId,
          user,
        });

        socket.to(`conversation:${conversation._id.toString()}`).emit('typing:update', {
          conversationId: conversation._id.toString(),
          user: {
            _id: user._id.toString(),
            name: user.name,
            image: user.image,
          },
          isTyping: false,
        });

        ack?.({ success: true });
      } catch (error) {
        ack?.({ success: false, msg: error.message || 'Typing failed' });
      }
    });
  });

  ioInstance = io;
  return io;
};

const getIO = () => ioInstance;

module.exports = {
  initMessagingSocket,
  getIO,
  emitConversationUpdates,
};
