
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send Email Function
 */

  console.log(process.env.RESEND_API_KEY ? "✅ Resend API Key is set" : "⚠️ Resend API Key is missing");
    console.log(process.env.RESEND_FROM_EMAIL ? "✅ Resend From Email is set" : "⚠️ Resend From Email is missing");
 

const sendEmail = async (
  to,
  subject,
  html,
  from = "Manage School <onboarding@resend.dev>",
) => {
    console.log("📧 Sending Email:", { to, subject });
    console.log(process.env.RESEND_API_KEY ? "✅ Resend API Key is set" : "⚠️ Resend API Key is missing");
    console.log(process.env.RESEND_FROM_EMAIL ? "✅ Resend From Email is set" : "⚠️ Resend From Email is missing");
    if(!to || !subject || !html) {
        console.warn("⚠️ Missing email parameters. Email not sent.", { to, subject });
        return { success: false, error: "Missing required email parameters" };
    }
  try {
    const response = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    console.log("✅ Email Sent: to ", to, " | subject: ", subject);
    // console.log("✅ Email Sent: to ", to, " | subject: ", subject , response);
    return {
      success: true,
      data: response,
    };
    
  } catch (error) {
    console.error("❌ Email Error:", error);

    return {
      success: false,
      error,
    };
  }
};

module.exports = sendEmail;