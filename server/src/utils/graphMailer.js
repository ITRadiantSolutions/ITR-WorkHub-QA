// Ported from ITR_TimeFlow_Production's mail_utils.py — sends mail as
// SENDER_EMAIL via Microsoft Graph app-only (client-credentials) auth.
import axios from "axios";

const tokenCache = { token: null, expiresAt: 0 };

export async function getGraphAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${process.env.OAUTH_TENANT_ID}/oauth2/v2.0/token`;
  const { data } = await axios.post(
    tokenUrl,
    new URLSearchParams({
      client_id: process.env.OAUTH_CLIENT_ID,
      client_secret: process.env.OAUTH_CLIENT_SECRET,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
    { timeout: 10_000 },
  );

  tokenCache.token = data.access_token;
  tokenCache.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return tokenCache.token;
}

// `attachments`: [{ filename, content: Buffer, contentType }] — converted to
// Graph's fileAttachment shape (base64 contentBytes) here so callers just
// deal with plain Buffers.
export async function sendMail(toEmail, subject, body, { html = true, attachments = [] } = {}) {
  const accessToken = await getGraphAccessToken();
  const url = `https://graph.microsoft.com/v1.0/users/${process.env.SENDER_EMAIL}/sendMail`;

  await axios.post(
    url,
    {
      message: {
        subject,
        body: { contentType: html ? "HTML" : "Text", content: body },
        toRecipients: [{ emailAddress: { address: toEmail } }],
        attachments: attachments.map((a) => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: a.filename,
          contentType: a.contentType || "application/octet-stream",
          contentBytes: a.content.toString("base64"),
        })),
      },
      saveToSentItems: true,
    },
    { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10_000 },
  );
}
