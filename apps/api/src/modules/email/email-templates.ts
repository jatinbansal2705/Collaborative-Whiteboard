interface LinkEmailData {
  name?: string;
  link: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function baseLayout({
  headline,
  body,
  buttonLabel,
  buttonUrl,
}: {
  headline: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
}): string {
  const safeButtonUrl = escapeHtml(buttonUrl);
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:#18181b;">${escapeHtml(headline)}</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:22px;color:#3f3f46;">${body}</p>
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="border-radius:6px;background-color:#18181b;">
                      <a href="${safeButtonUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;font-size:15px;line-height:20px;color:#ffffff;text-decoration:none;">${escapeHtml(buttonLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#71717a;">
                  If the button does not work, copy and paste this link into your browser:
                  <br />
                  <a href="${safeButtonUrl}" style="color:#2563eb;word-break:break-all;">${safeButtonUrl}</a>
                </p>
              </td>
            </tr>
          </table>
          <p style="font-size:12px;line-height:16px;color:#71717a;margin:16px 0 0;">You are receiving this email because an action was requested on the Collaborative Whiteboard account for this address. If you did not request it, you can safely ignore this message.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const verificationEmailSubject = (): string =>
  'Verify your Collaborative Whiteboard email';

export const renderVerificationEmail = (data: LinkEmailData): string =>
  baseLayout({
    headline: data.name !== undefined ? `Hi ${data.name},` : 'Hi there,',
    body: 'Thanks for signing up for Collaborative Whiteboard. Please verify your email address to activate your account.',
    buttonLabel: 'Verify email',
    buttonUrl: data.link,
  });

export const passwordResetEmailSubject = (): string =>
  'Reset your Collaborative Whiteboard password';

export const renderPasswordResetEmail = (data: LinkEmailData): string =>
  baseLayout({
    headline: data.name !== undefined ? `Hi ${data.name},` : 'Hi there,',
    body: 'We received a request to reset the password for your Collaborative Whiteboard account. This link expires in one hour and can only be used once.',
    buttonLabel: 'Reset password',
    buttonUrl: data.link,
  });

export const mentionEmailSubject = (): string =>
  'You were mentioned on a whiteboard';

export const renderMentionEmail = (data: {
  name?: string;
  actorName: string | null;
  bodyPreview: string;
  link: string;
}): string => {
  const actor = escapeHtml(data.actorName ?? 'Someone');
  const preview = escapeHtml(data.bodyPreview);
  return baseLayout({
    headline: data.name !== undefined ? `Hi ${data.name},` : 'Hi there,',
    body: `${actor} mentioned you in a comment on a whiteboard.<br /><br />“${preview}”`,
    buttonLabel: 'View comment',
    buttonUrl: data.link,
  });
};
