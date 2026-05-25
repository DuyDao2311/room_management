/**
 * Mẫu email xác minh địa chỉ email
 */
module.exports.emailVerificationTemplate = ({ userName, verificationUrl }) => {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr><td style="padding:36px 40px 24px;text-align:center;background:linear-gradient(135deg,#0f5cc7,#0d4ba8);">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Xác minh Email</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Room Management</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 40px 28px;">
          <p style="margin:0 0 16px;font-size:16px;color:#1a2332;font-weight:600;">Xin chào <strong>${userName}</strong>,</p>
          <p style="margin:0 0 20px;font-size:14px;color:#475467;line-height:1.7;">
            Bạn nhận được email này vì đã yêu cầu xác minh địa chỉ email cho tài khoản Room Management.
            Vui lòng nhấn nút bên dưới để hoàn tất xác minh.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:24px auto;">
            <tr>
              <td align="center" style="background:#0f5cc7;border-radius:10px;padding:14px 36px;">
                <a href="${verificationUrl}" target="_blank" style="color:#fff;font-size:15px;font-weight:700;text-decoration:none;display:inline-block;">
                  Xác minh email ngay
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0;font-size:13px;color:#98a2b3;line-height:1.6;">
            Hoặc copy và dán đường dẫn sau vào trình duyệt:<br/>
            <span style="color:#0f5cc7;word-break:break-all;">${verificationUrl}</span>
          </p>
          <hr style="margin:24px 0 16px;border:none;border-top:1px solid #eaecf0;"/>
          <p style="margin:0;font-size:12px;color:#98a2b3;line-height:1.5;">
            Liên kết có hiệu lực trong <strong>24 giờ</strong>. Nếu bạn không yêu cầu xác minh này, vui lòng bỏ qua email này.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px;background:#f8f9fb;text-align:center;border-top:1px solid #eaecf0;">
          <p style="margin:0;font-size:12px;color:#98a2b3;">© Room Management. Bảo vệ tài khoản của bạn.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Xác minh Email - Room Management\n\nXin chào ${userName},\n\nBạn nhận được email này vì đã yêu cầu xác minh địa chỉ email.\n\nVui lòng truy cập đường dẫn sau để xác minh:\n${verificationUrl}\n\nLiên kết có hiệu lực trong 24 giờ.\n\n© Room Management`;

  return { html, text };
};

/**
 * Mẫu email thông báo xác minh thành công
 */
module.exports.emailVerifiedTemplate = ({ userName }) => {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f7fa;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.06);">
        <tr><td style="padding:36px 40px 24px;text-align:center;background:linear-gradient(135deg,#16a34a,#15803d);">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">✅ Xác minh thành công</h1>
        </td></tr>
        <tr><td style="padding:32px 40px 28px;text-align:center;">
          <p style="margin:0 0 16px;font-size:16px;color:#1a2332;font-weight:600;">Chúc mừng <strong>${userName}</strong>!</p>
          <p style="margin:0;font-size:14px;color:#475467;line-height:1.7;">
            Địa chỉ email của bạn đã được xác minh thành công. Tài khoản của bạn giờ đây an toàn hơn.
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px;background:#f8f9fb;text-align:center;border-top:1px solid #eaecf0;">
          <p style="margin:0;font-size:12px;color:#98a2b3;">© Room Management</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Xác minh Email thành công!\n\nChúc mừng ${userName}, địa chỉ email của bạn đã được xác minh thành công.\n\n© Room Management`;

  return { html, text };
};