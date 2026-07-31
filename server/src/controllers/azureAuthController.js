import { ConfidentialClientApplication } from "@azure/msal-node";
import axios from "axios";
import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";
import { logMsLoginStep } from "../utils/activityLog.js";

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_AD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
  },
};

const getMsalClient = () => new ConfidentialClientApplication(msalConfig);

const isTrustedDomain = (email = "") =>
  Boolean(process.env.TRUSTED_EMAIL_DOMAIN) &&
  email.toLowerCase().endsWith(`@${process.env.TRUSTED_EMAIL_DOMAIN.toLowerCase()}`);

export const redirectToAzure = async (req, res) => {
  const url = await getMsalClient().getAuthCodeUrl({
    scopes: ["user.read"],
    redirectUri: process.env.AZURE_AD_REDIRECT_URI,
  });
  res.redirect(url);
};

export const handleAzureCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=missing_code`);
  }

  let tokenResponse;
  try {
    tokenResponse = await getMsalClient().acquireTokenByCode({
      code,
      scopes: ["user.read"],
      redirectUri: process.env.AZURE_AD_REDIRECT_URI,
    });
  } catch (error) {
    await logMsLoginStep("unknown", "token_received", { status: "failed", errorCode: error.message });
    return res.redirect(`${process.env.CLIENT_URL}/login?error=azure_token_exchange_failed`);
  }
  await logMsLoginStep("unknown", "token_received", { status: "success" });

  const { data: profile } = await axios.get("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
  });

  const email = (profile.mail || profile.userPrincipalName || "").toLowerCase();
  if (!email) {
    return res.redirect(`${process.env.CLIENT_URL}/login?error=no_email_on_profile`);
  }
  await logMsLoginStep(email, "profile_fetched", { status: "success" });

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: profile.displayName || email,
      email,
      authProvider: "azure",
      azureAdId: profile.id,
      approvalStatus: isTrustedDomain(email) ? "Approved" : "Pending",
      approvedAt: isTrustedDomain(email) ? new Date() : null,
    });
    await logMsLoginStep(email, "user_created", { status: "success", microsoftId: profile.id });
  } else {
    if (!user.azureAdId) {
      user.azureAdId = profile.id;
      user.authProvider = "azure";
      await user.save();
    }
    await logMsLoginStep(email, "user_found", { status: "success", microsoftId: profile.id });
  }

  await logMsLoginStep(email, "approval_check", { status: "success", approvalStatus: user.approvalStatus });
  if (user.approvalStatus !== "Approved") {
    return res.redirect(`${process.env.CLIENT_URL}/waiting-approval`);
  }

  const token = signToken(user, { expiresIn: process.env.JWT_EXPIRES_IN_AZURE || "15d" });
  await logMsLoginStep(email, "jwt_generated", { status: "success" });
  return res.redirect(
    `${process.env.CLIENT_URL}/hub?token=${token}&user=${encodeURIComponent(
      JSON.stringify({ id: user._id, _id: user._id, name: user.name, email: user.email, role: user.roles.tracker, roles: user.roles }),
    )}`,
  );
};
