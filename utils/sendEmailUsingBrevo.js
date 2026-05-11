// // const brevo = require("@getbrevo/brevo");

// // const apiInstance = new brevo.TransactionalEmailsApi();

// // apiInstance.setApiKey(
// //   brevo.TransactionalEmailsApiApiKeys.apiKey,
// //   process.env.BREVO_API_KEY
// // );

// // /**
// //  * Send Email Function
// //  */

// // const sendEmail = async (
// //   to,
// //   subject,
// //   htmlContent,
// //   senderName = "Manage School",
// //   senderEmail = "....................@gmail.com",
// // ) => {
// //   try {
// //     const sendSmtpEmail = new brevo.SendSmtpEmail();

// //     sendSmtpEmail.subject = subject;

// //     sendSmtpEmail.htmlContent = htmlContent;

// //     sendSmtpEmail.sender = {
// //       name: senderName,
// //       email: senderEmail,
// //     };

// //     sendSmtpEmail.to = [
// //       {
// //         email: to,
// //       },
// //     ];

// //     const response = await apiInstance.sendTransacEmail(
// //       sendSmtpEmail
// //     );

// //     console.log("✅ Email Sent:", response);

// //     return {
// //       success: true,
// //       data: response,
// //     };
// //   } catch (error) {
// //     console.error("❌ Email Error:", error);

// //     return {
// //       success: false,
// //       error,
// //     };
// //   }
// // };

// // module.exports = sendEmail;

// const SibApiV3Sdk = require("@getbrevo/brevo");

// const apiInstance =
//   new SibApiV3Sdk.TransactionalEmailsApi();

// const apiKey =
//   apiInstance.authentications["apiKey"];

// apiKey.apiKey = process.env.BREVO_API_KEY;

// const sendEmailUsingBrevo = async ({
//   to,
//   subject,
//   htmlContent,
// }) => {
//   try {
//     const sendSmtpEmail =
//       new SibApiV3Sdk.SendSmtpEmail();

//     sendSmtpEmail.sender = {
//       name: "Manage School",
//       email: "....................@gmail.com",
//     };

//     sendSmtpEmail.to = [
//       {
//         email: to,
//       },
//     ];

//     sendSmtpEmail.subject = subject;

//     sendSmtpEmail.htmlContent = htmlContent;

//     const data =
//       await apiInstance.sendTransacEmail(
//         sendSmtpEmail
//       );

//     console.log("✅ Email sent");

//     console.log(data);

//     return data;

//   } catch (error) {
//     console.log("❌ Error sending email");

//     console.log(error.response?.body || error);
//   }
// };

// module.exports = sendEmailUsingBrevo;