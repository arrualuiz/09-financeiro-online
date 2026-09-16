// Autenticação com Google (OAuth 2.0 Implicit Flow via Google Identity Services).
// Não usa backend: o token de acesso fica só na memória do navegador do usuário.

const AUTH = (() => {
  const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";
  const TOKEN_STORAGE_KEY = "gsheets_dashboard_token";

  let tokenClient = null;
  let accessToken = null;
  let onSignedInCallback = null;

  function saveToken(token, expiresInSeconds) {
    const expiresAt = Date.now() + expiresInSeconds * 1000 - 60_000; // margem de 1 min
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token, expiresAt }));
  }

  function loadToken() {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    try {
      const { token, expiresAt } = JSON.parse(raw);
      if (Date.now() < expiresAt) return token;
    } catch (_) {}
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    accessToken = null;
  }

  function waitForGoogleIdentity(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function poll() {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          reject(new Error("GOOGLE_SCRIPT_TIMEOUT"));
        } else {
          setTimeout(poll, 100);
        }
      })();
    });
  }

  async function init(onSignedIn) {
    onSignedInCallback = onSignedIn;

    try {
      await waitForGoogleIdentity();
    } catch (_) {
      showError("Não foi possível carregar o script de login do Google. Verifique sua conexão e recarregue a página.");
      return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: window.APP_CONFIG.GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error("Erro de autenticação:", response);
          showError("Não foi possível entrar com o Google. Tente novamente.");
          return;
        }
        accessToken = response.access_token;
        saveToken(accessToken, response.expires_in);
        onSignedInCallback(accessToken);
      },
    });

    // Se já existe um token válido na sessão, usa direto sem pedir login de novo.
    const existing = loadToken();
    if (existing) {
      accessToken = existing;
      onSignedInCallback(accessToken);
    }
  }

  function signIn() {
    if (!tokenClient) return;
    tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  }

  function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    clearToken();
    window.location.reload();
  }

  function getToken() {
    return accessToken;
  }

  function showError(message) {
    const el = document.getElementById("auth-error");
    if (el) {
      el.textContent = message;
      el.hidden = false;
    }
  }

  return { init, signIn, signOut, getToken };
})();
