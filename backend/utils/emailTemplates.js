function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Shell chung cho mọi email transactional. Giữ header/footer thống nhất —
// khi đổi branding chỉ sửa 1 chỗ.
function wrapHtml({ heading, bodyHtml }) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #333; line-height: 1.6;">
      <h2 style="color: #0f67e3; margin: 0 0 24px; font-size: 22px;">${heading}</h2>
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;">
      <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
        Email tự động, vui lòng không trả lời.
      </p>
    </div>
  `;
}

function wrapText({ heading, body }) {
  return `${heading}\n\n${body}\n\n---\nEmail tự động, vui lòng không trả lời.`;
}

function passwordResetTemplate({ userName, resetUrl, requestedAt }) {
  const safeName = escapeHtml(userName);
  const safeUrl = escapeHtml(resetUrl);
  const requestedAtStr = (requestedAt || new Date()).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });

  const bodyHtml = `
    <p style="margin: 0 0 12px;">Xin chào ${safeName},</p>
    <p style="margin: 0 0 24px;">Bạn vừa yêu cầu đặt lại mật khẩu. Click nút bên dưới để tạo mật khẩu mới:</p>

    <p style="text-align: center; margin: 0 0 24px;">
      <a href="${safeUrl}"
         style="background: #0f67e3; color: #fff; padding: 12px 32px;
                text-decoration: none; border-radius: 6px; display: inline-block;
                font-weight: 600;">
        Đặt lại mật khẩu
      </a>
    </p>

    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 16px;
                margin: 0 0 24px; border-radius: 4px;">
      <p style="margin: 0; color: #856404; font-size: 14px;">
        ⚠️ Link có hiệu lực trong <b>15 phút</b>.
      </p>
    </div>

    <p style="color: #666; font-size: 13px; margin: 0 0 6px;">
      Nếu nút không hoạt động, copy link sau vào trình duyệt:
    </p>
    <p style="margin: 0 0 24px; word-break: break-all;">
      <a href="${safeUrl}" style="color: #0f67e3; font-size: 13px;">${safeUrl}</a>
    </p>

    <p style="color: #666; font-size: 14px; margin: 0 0 20px;">
      Nếu bạn KHÔNG yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
    </p>

    <p style="color: #999; font-size: 12px; margin: 0;">
      Yêu cầu lúc: ${requestedAtStr}
    </p>
  `;

  const body = `Xin chào ${userName},

Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản.
Click link sau để đặt mật khẩu mới (có hiệu lực 15 phút):

${resetUrl}

Nếu bạn KHÔNG yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.`;

  return {
    html: wrapHtml({ heading: "Đặt lại mật khẩu", bodyHtml }),
    text: wrapText({ heading: "Đặt lại mật khẩu", body }),
  };
}

function passwordChangedTemplate({ userName }) {
  const safeName = escapeHtml(userName);
  const now = new Date().toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });

  const bodyHtml = `
    <p style="margin: 0 0 12px;">Xin chào ${safeName},</p>
    <p style="margin: 0 0 24px;">Mật khẩu tài khoản của bạn vừa được đổi thành công lúc <b>${now}</b>.</p>

    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 16px;
                margin: 0 0 24px; border-radius: 4px;">
      <p style="margin: 0 0 8px; color: #856404;">
        ⚠️ <b>Bạn không phải là người vừa đổi mật khẩu?</b><br>
        Tài khoản của bạn có thể đã bị xâm nhập. Vui lòng:
      </p>
      <ol style="color: #856404; margin: 0; padding-left: 20px;">
        <li>Liên hệ ngay với quản trị viên hệ thống.</li>
        <li>Đổi mật khẩu các tài khoản khác có dùng chung password.</li>
      </ol>
    </div>

    <p style="color: #666; font-size: 14px; margin: 0 0 20px;">
      Nếu bạn chính là người thao tác, bạn có thể bỏ qua email này.
    </p>

    <p style="color: #999; font-size: 12px; margin: 0;">
      Thời điểm đổi: ${now}
    </p>
  `;

  const body = `Xin chào ${userName},

Mật khẩu tài khoản của bạn vừa được đổi thành công lúc ${now}.

⚠️ Nếu bạn KHÔNG phải là người vừa đổi mật khẩu, tài khoản có thể đã bị xâm nhập.
Vui lòng liên hệ quản trị viên hệ thống ngay.`;

  return {
    html: wrapHtml({ heading: "Mật khẩu vừa được đổi", bodyHtml }),
    text: wrapText({ heading: "Mật khẩu vừa được đổi", body }),
  };
}

module.exports = {
  passwordResetTemplate,
  passwordChangedTemplate,
  escapeHtml,
};
