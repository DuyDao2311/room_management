const nodemailer = require("nodemailer");
// 1. Tạo transporter (1 lần, dùng nhiều lần)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

//2. Hàm gửi email (async vì gửi mạng cần đợi)
async function sendEmail({ to, subject, html, text }) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
    text,
  });
}

module.exports = sendEmail;
