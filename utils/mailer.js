const nodemailer = require('nodemailer');

const getTransport = () =>
  nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

const sendMail = async (to, subject, html) => {
  if (!to) {
    return { skipped: true, reason: 'Recipient email is required' };
  }

  if (!process.env.MAIL_HOST || !process.env.MAIL_PORT || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
    return { skipped: true, reason: 'Mail service is not configured' };
  }

  const transport = getTransport();

  return ;

  return transport.sendMail({
    from: `"School App" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = sendMail;
