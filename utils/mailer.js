const nodemailer = require('nodemailer');

// console.log("Mailer config:", {
//   host: process.env.MAIL_HOST,
//   port: process.env.MAIL_PORT,
//   user: process.env.MAIL_USER,
//   pass: process.env.MAIL_PASS ? "****" : undefined, // Don't log the actual password
// });
const t = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendMail = async (to, subject, html) => {
  // return ;
  await t.sendMail({
    from: `"Schook App" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = sendMail;
