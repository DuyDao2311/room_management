function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function passwordResetTemplate({ userName, resetUrl }) {
  const safeName = escapeHtml(userName);
  const safeUrl = escapeHtml(resetUrl);

  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;
  padding: 20px;">
        <h2 style="color: #333;">Đặt lại mật khẩu</h2>
        <p>Xin chào ${safeName},</p>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu. Click nút bên dưới để tạo mật khẩu
  mới:</p>

        <p style="text-align: center; margin: 30px 0;">
          <a href="${safeUrl}"
             style="background: #4CAF50; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 4px; display:
  inline-block;">
            Đặt lại mật khẩu
          </a>
        </p>

        <p style="color: #666; font-size: 14px;">
          Nếu nút không hoạt động, copy link sau vào trình duyệt:<br>
          <a href="${safeUrl}">${safeUrl}</a>
        </p>

        <p style="color: #d9534f; font-size: 14px;">
          ⚠️  Link có hiệu lực trong <b>15 phút</b>.
        </p>

        <p style="color: #666; font-size: 14px;">
          Nếu bạn KHÔNG yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          Email tự động, vui lòng không trả lời.
        </p>
      </div>
    `;

  const text = `
  Đặt lại mật khẩu

  Xin chào ${userName},

  Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản.
  Click link sau để đặt mật khẩu mới (có hiệu lực 15 phút):

  ${resetUrl}

  Nếu bạn KHÔNG yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.

  ---
  Email tự động, vui lòng không trả lời.
    `.trim();

  return { html, text };
}

function passwordChangedTemplate({ userName }) {
  const safeName = escapeHtml(userName);
  const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;
  padding: 20px;">
        <h2 style="color: #333;">Mật khẩu vừa được đổi</h2>
        <p>Xin chào ${safeName},</p>
        <p>Mật khẩu tài khoản của bạn vừa được đổi thành công lúc <b>${now}</b>.</p>

        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px;
                    margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #856404;">
            ⚠️ <b>Bạn không phải là người vừa đổi mật khẩu?</b><br>
            Tài khoản của bạn có thể đã bị xâm nhập. Vui lòng:
          </p>
          <ol style="color: #856404; margin: 8px 0 0;">
            <li>Liên hệ ngay với quản trị viên hệ thống.</li>
            <li>Đổi mật khẩu các tài khoản khác có dùng chung password.</li>
          </ol>
        </div>

        <p style="color: #666; font-size: 14px;">
          Nếu bạn chính là người thao tác, bạn có thể bỏ qua email này.
        </p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          Email tự động, vui lòng không trả lời.
        </p>
      </div>
    `;

  const text = `
  Mật khẩu vừa được đổi

  Xin chào ${userName},

  Mật khẩu tài khoản của bạn vừa được đổi thành công lúc ${now}.

  ⚠️ Nếu bạn KHÔNG phải là người vừa đổi mật khẩu, tài khoản có thể đã bị xâm nhập.
  Vui lòng liên hệ quản trị viên hệ thống ngay.

  ---
  Email tự động, vui lòng không trả lời.
    `.trim();

  return { html, text };
}

module.exports = { passwordResetTemplate, passwordChangedTemplate, escapeHtml };
