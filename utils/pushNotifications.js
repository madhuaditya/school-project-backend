const axios = require('axios');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const isExpoPushToken = (value) =>
  typeof value === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(value.trim());

const chunkArray = (items, chunkSize) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
};

const sendExpoPushNotifications = async ({ pushTokens = [], title, body, data = {} }) => {
  const tokens = [...new Set(pushTokens)].filter(isExpoPushToken);
  if (!tokens.length) {
    return { success: false, skipped: true, msg: 'No valid Expo push tokens found' };
  }

  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data,
  }));

  const responses = [];
  for (const chunk of chunkArray(messages, 100)) {
    const response = await axios.post(EXPO_PUSH_URL, chunk, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
    responses.push(response.data);
  }

  return { success: true, skipped: false, data: responses };
};

module.exports = {
  sendExpoPushNotifications,
};