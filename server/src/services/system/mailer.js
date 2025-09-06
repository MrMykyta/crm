const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465, secure: true,
    auth: { 
        user: process.env.GMAIL_USER, 
        pass: process.env.GMAIL_APP_PASSWORD 
    }
});

module.exports.sendMail = async ({ to, subject, html }) => {
  const from = `"${process.env.MAIL_FROM_NAME || 'CRM'}" <${process.env.MAIL_FROM_ADDR || process.env.GMAIL_USER}>`;
  return transporter.sendMail({ from, to, subject, html });
};