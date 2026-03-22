const APP_NAME = "Lloyds Pullet Sales";

function baseLayout(content: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
    .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 32px; }
    .header h1 { color: #18181b; font-size: 20px; margin: 0; }
    .content { color: #3f3f46; font-size: 15px; line-height: 1.6; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 24px 0; }
    .footer { text-align: center; color: #a1a1aa; font-size: 12px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>${APP_NAME}</h1></div>
    <div class="content">${content}</div>
    <div class="footer"><p>&copy; ${APP_NAME}. All rights reserved.</p></div>
  </div>
</body>
</html>`;
}

export function inviteUserEmail(params: { userName: string; inviteUrl: string }) {
  const html = baseLayout(`
    <p>Hello ${params.userName},</p>
    <p>You've been invited to the ${APP_NAME} system. Click the button below to set your password and get started.</p>
    <p style="text-align:center"><a href="${params.inviteUrl}" class="btn">Set Your Password</a></p>
    <p>If you didn't expect this email, you can safely ignore it.</p>
  `);

  return {
    subject: `You're invited to ${APP_NAME}`,
    html,
    text: `Hello ${params.userName}, you've been invited to ${APP_NAME}. Set your password here: ${params.inviteUrl}`,
  };
}

export function resetPasswordEmail(params: { userName: string; resetUrl: string }) {
  const html = baseLayout(`
    <p>Hello ${params.userName},</p>
    <p>We received a request to reset your password. Click the button below to choose a new password.</p>
    <p style="text-align:center"><a href="${params.resetUrl}" class="btn">Reset Password</a></p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `);

  return {
    subject: `Reset your ${APP_NAME} password`,
    html,
    text: `Hello ${params.userName}, reset your password here: ${params.resetUrl}`,
  };
}
