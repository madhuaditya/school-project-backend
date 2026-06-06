const axios = require('axios');
const Alert = require('../models/alert');
const sendMail = require('./mailer');
const { sendExpoPushNotifications } = require('./pushNotifications');

const buildWebhookHeaders = (token) => {
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
};

const buildSuccessResult = ({ provider, destination, responsePayload, providerMessageId = '' }) => ({
  status: 'sent',
  provider,
  destination,
  providerMessageId,
  responsePayload,
  sentAt: new Date(),
});

const buildFailureResult = ({ provider, destination, errorMessage, responsePayload = null, status = 'failed' }) => ({
  status,
  provider,
  destination,
  errorMessage,
  responsePayload,
  sentAt: status === 'sent' ? new Date() : null,
});

const sendPushNotifications = async (pushtokens , userId , title , message,id,screen)=> {

  if(pushtokens.length > 0){
    try {     
      await sendExpoPushNotifications({
        pushTokens: pushtokens || [],
        title,
        body: message,
        data: {
          type: 'alert',
          screen: screen || 'my-alerts',
          alertId: String(id),
        },
      });
    } catch (error) {
      console.warn('Expo push delivery failed for direct alert:', error.message);
    }
  }else {
    console.warn(`No push tokens available for user ${userId}, skipping push notification`);
  }

}

const sendAlert = async ({ schoolId, createdBy, recipient, title, message }) => {
  const alert = await Alert.create({
    school: schoolId,
    createdFor: recipient._id,
    createdBy,
    title,
    message,
    viewed: false,
    viewedAt: null,
  });

  sendPushNotifications(recipient?.pushTokens, recipient._id, title, message, alert._id);

  return buildSuccessResult({
    provider: 'internal-alert',
    destination: String(recipient._id),
    providerMessageId: String(alert._id),
    responsePayload: { alertId: alert._id },
  });

  try {
    await sendExpoPushNotifications({
      pushTokens: recipient?.pushTokens || [],
      title,
      body: message,
      data: {
        type: 'alert',
        screen: 'my-alerts',
        alertId: String(alert._id),
        schoolId: String(schoolId),
      },
    });
  } catch (error) {
    console.warn('Expo push delivery failed for alert broadcast:', error.message);
  }
};

const sendEmail = async ({ recipient, subject, title, message }) => {
  const destination = recipient.email || '';
  if (!destination) {
    return buildFailureResult({
      provider: 'nodemailer',
      destination,
      errorMessage: 'Recipient email not available',
      status: 'skipped',
    });
  }

  const result = await sendMail(
    destination,
    subject || title,
    `<p>${title}</p><p>${message}</p>`
  );

  if (result?.skipped) {
    return buildFailureResult({
      provider: 'nodemailer',
      destination,
      errorMessage: result.reason || 'Email service not configured',
      responsePayload: result,
      status: 'failed',
    });
  }

  return buildSuccessResult({
    provider: 'nodemailer',
    destination,
    providerMessageId: result?.messageId || '',
    responsePayload: {
      accepted: result?.accepted || [],
      rejected: result?.rejected || [],
      response: result?.response || '',
    },
  });
};

const sendSms = async ({ schoolId, recipient, title, message }) => {
  const destination = recipient.smsPhone || recipient.phone || '';
  if (!destination) {
    return buildFailureResult({
      provider: 'sms-webhook',
      destination,
      errorMessage: 'Recipient phone not available for SMS',
      status: 'skipped',
    });
  }

  if (!process.env.SMS_WEBHOOK_URL) {
    return buildFailureResult({
      provider: 'sms-webhook',
      destination,
      errorMessage: 'SMS_WEBHOOK_URL is not configured',
    });
  }

  const response = await axios.post(
    process.env.SMS_WEBHOOK_URL,
    {
      to: destination,
      title,
      message,
      schoolId,
      userId: recipient._id,
      channel: 'sms',
    },
    {
      headers: buildWebhookHeaders(process.env.SMS_WEBHOOK_TOKEN),
      timeout: 15000,
    }
  );

  return buildSuccessResult({
    provider: 'sms-webhook',
    destination,
    providerMessageId: response?.data?.messageId || response?.data?.sid || '',
    responsePayload: response.data,
  });
};

const sendWhatsapp = async ({ schoolId, recipient, title, message }) => {
  const destination = recipient.whatsappPhone || recipient.phone || '';
  if (!destination) {
    return buildFailureResult({
      provider: 'whatsapp-webhook',
      destination,
      errorMessage: 'Recipient phone not available for WhatsApp',
      status: 'skipped',
    });
  }

  if (!process.env.WHATSAPP_WEBHOOK_URL) {
    return buildFailureResult({
      provider: 'whatsapp-webhook',
      destination,
      errorMessage: 'WHATSAPP_WEBHOOK_URL is not configured',
    });
  }

  const response = await axios.post(
    process.env.WHATSAPP_WEBHOOK_URL,
    {
      to: destination,
      title,
      message,
      schoolId,
      userId: recipient._id,
      channel: 'whatsapp',
    },
    {
      headers: buildWebhookHeaders(process.env.WHATSAPP_WEBHOOK_TOKEN),
      timeout: 15000,
    }
  );

  return buildSuccessResult({
    provider: 'whatsapp-webhook',
    destination,
    providerMessageId: response?.data?.messageId || '',
    responsePayload: response.data,
  });
};

const sendTelegram = async ({ recipient, title, message }) => {
  const destination = recipient.telegramChatId || '';
  if (!destination) {
    return buildFailureResult({
      provider: 'telegram',
      destination,
      errorMessage: 'Recipient telegramChatId not available',
      status: 'skipped',
    });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return buildFailureResult({
      provider: 'telegram',
      destination,
      errorMessage: 'TELEGRAM_BOT_TOKEN is not configured',
    });
  }

  const response = await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      chat_id: destination,
      text: `${title}\n\n${message}`,
    },
    {
      timeout: 15000,
    }
  );

  return buildSuccessResult({
    provider: 'telegram',
    destination,
    providerMessageId: String(response?.data?.result?.message_id || ''),
    responsePayload: response.data,
  });
};

const sendByChannel = async ({ channel, schoolId, createdBy, recipient, title, subject, message }) => {
  switch (channel) {
    case 'alert':
      return sendAlert({ schoolId, createdBy, recipient, title, message });
    case 'email':
      return sendEmail({ recipient, subject, title, message });
    case 'sms':
      return sendSms({ schoolId, recipient, title, message });
    case 'whatsapp':
      return sendWhatsapp({ schoolId, recipient, title, message });
    case 'telegram':
      return sendTelegram({ recipient, title, message });
    default:
      return buildFailureResult({
        provider: 'unknown',
        destination: '',
        errorMessage: `Unsupported channel: ${channel}`,
      });
  }
};

module.exports = {
  sendByChannel,
};
