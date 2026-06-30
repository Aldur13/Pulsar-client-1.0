const MS_AUTHORIZE_URL =
  "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const MS_TOKEN_URL =
  "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const XBL_AUTH_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTHORIZE_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN_WITH_XBOX_URL =
  "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile";

class MinecraftAuthError extends Error {
  constructor(message, { code, userMessage } = {}) {
    super(message);
    this.name = "MinecraftAuthError";
    this.code = code;
    this.userMessage = userMessage || message;
  }
}

function getAuthorizationUrl() {
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.MS_REDIRECT_URI,
    scope: "XboxLive.signin offline_access",
    response_mode: "query",
  });
  return `${MS_AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.MS_REDIRECT_URI,
  });

  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new MinecraftAuthError(
      `Microsoft token exchange failed (${res.status}): ${text}`,
      { code: "MS_TOKEN_EXCHANGE_FAILED", userMessage: "Microsoft sign-in failed. Please try again." }
    );
  }

  const data = await res.json();
  return data.access_token;
}

async function authenticateWithXboxLive(msAccessToken) {
  const res = await fetch(XBL_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${msAccessToken}`,
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new MinecraftAuthError(`Xbox Live authentication failed (${res.status}): ${text}`, {
      code: "XBL_AUTH_FAILED",
      userMessage: "Could not authenticate with Xbox Live. Please try again.",
    });
  }

  const data = await res.json();
  return {
    xblToken: data.Token,
    userHash: data.DisplayClaims.xui[0].uhs,
  };
}

async function getXSTSToken(xblToken) {
  const res = await fetch(XSTS_AUTHORIZE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [xblToken],
      },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const xErr = data?.XErr;
    if (xErr === 2148916233) {
      throw new MinecraftAuthError("Account has no Xbox Live profile", {
        code: "NO_XBOX_ACCOUNT",
        userMessage:
          "This Microsoft account doesn't have an Xbox Live profile. Create one at xbox.com and try again.",
      });
    }
    if (xErr === 2148916238) {
      throw new MinecraftAuthError("Account is a child account requiring family supervision", {
        code: "UNDER_18_REGION_RESTRICTED",
        userMessage:
          "This account belongs to someone under 18. An adult needs to add it to a Microsoft Family before it can sign in.",
      });
    }
    throw new MinecraftAuthError(`XSTS authorization failed (${res.status}): ${JSON.stringify(data)}`, {
      code: "XSTS_AUTH_FAILED",
      userMessage: "Xbox authorization failed. Please try again.",
    });
  }

  return data.Token;
}

async function loginWithXbox(xstsToken, userHash) {
  const res = await fetch(MC_LOGIN_WITH_XBOX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new MinecraftAuthError(`Minecraft login failed (${res.status}): ${text}`, {
      code: "MC_LOGIN_FAILED",
      userMessage: "Could not log in to Minecraft services. Please try again.",
    });
  }

  const data = await res.json();
  return data.access_token;
}

async function getMinecraftProfile(mcAccessToken) {
  const res = await fetch(MC_PROFILE_URL, {
    headers: { Authorization: `Bearer ${mcAccessToken}` },
  });

  if (res.status === 404) {
    throw new MinecraftAuthError("Account does not own Minecraft", {
      code: "NO_MINECRAFT_LICENSE",
      userMessage: "This Microsoft account doesn't own Minecraft.",
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new MinecraftAuthError(`Fetching Minecraft profile failed (${res.status}): ${text}`, {
      code: "MC_PROFILE_FAILED",
      userMessage: "Could not load your Minecraft profile. Please try again.",
    });
  }

  const data = await res.json();
  return { id: data.id, name: data.name };
}

async function fullLoginChain(code) {
  const msAccessToken = await exchangeCodeForToken(code);
  const { xblToken, userHash } = await authenticateWithXboxLive(msAccessToken);
  const xstsToken = await getXSTSToken(xblToken);
  const mcAccessToken = await loginWithXbox(xstsToken, userHash);
  const profile = await getMinecraftProfile(mcAccessToken);
  return { mcAccessToken, profile };
}

export {
  MinecraftAuthError,
  getAuthorizationUrl,
  exchangeCodeForToken,
  authenticateWithXboxLive,
  getXSTSToken,
  loginWithXbox,
  getMinecraftProfile,
  fullLoginChain,
};
