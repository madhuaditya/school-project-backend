const twilio = require("twilio");
const {TEST_ADMIN_ROLE,TEST_TEACHER_ROLE,TEST_STUDENT_ROLE,TEST_STAFF_ROLE} = require("./constant")
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;


// Send OTP
const sendOTP = async (phone) => {
  try {
    if(phone==TEST_ADMIN_ROLE || phone === TEST_TEACHER_ROLE || phone===TEST_STUDENT_ROLE || phone ==TEST_STAFF_ROLE ){
      return true;
    }
    const response = await client.verify.v2
      .services(serviceSid)
      .verifications.create({
        to: phone,
        channel: "sms",
      });

    return response;
  } catch (error) {
    throw new Error(error.message);
  }
};


// Verify OTP
const verifyOTP = async (phone, code) => {
  try {
    if(phone==TEST_ADMIN_ROLE || phone === TEST_TEACHER_ROLE || phone===TEST_STUDENT_ROLE || phone ==TEST_STAFF_ROLE ){
      return {status:'approved',success:true};
    }
    const response = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({
        to: phone,
        code,
      });

    return response;
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
};