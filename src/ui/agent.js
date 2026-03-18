const contactMethod = document.getElementById("contactMethod");
const contactValue = document.getElementById("contactValue");
const createSessionButton = document.getElementById("createSession");
const sendLinkButton = document.getElementById("sendLink");
const createVerifierQrButton = document.getElementById("createVerifierQr");
const resetSessionsButton = document.getElementById("resetSessions");
const sessionMeta = document.getElementById("sessionMeta");
const paneVerification = document.getElementById("paneVerification");
const paneNzbn = document.getElementById("paneNzbn");
const paneCompanies = document.getElementById("paneCompanies");
const sessionTimeline = document.getElementById("sessionTimeline");
const verifierQrStatus = document.getElementById("verifierQrStatus");
const verifierQrLink = document.getElementById("verifierQrLink");
const verifierQrImage = document.getElementById("verifierQrImage");

const WALT_PRESET_OPTIONS = {
  openbadge_jwt_vc_json: [{ format: "jwt_vc_json", type: "OpenBadgeCredential" }],
  identity_sd_jwt: [{ format: "vc+sd-jwt", vct: "http://localhost:7002/identity_credential" }]
};

let activeSessionId = "";
let sse = null;

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function renderSession(session) {
  sessionMeta.textContent = `Session ${session.sessionId} • status: ${session.status} • expires: ${session.expiresAt} • holder link: ${session.holderLink}`;
  paneVerification.textContent = pretty({
    presentedCredential: session.presentedCredential ?? null,
    verificationResult: session.verificationResult ?? null
  });
  paneNzbn.textContent = pretty(
    session.nzbnContext ??
      (session.nzbnLookupError
        ? { message: session.nzbnLookupError }
        : { message: "No NZBN context yet." })
  );
  paneCompanies.textContent = pretty(session.companiesContext ?? { message: "No Companies context yet." });
  sessionTimeline.textContent = pretty(session.events ?? []);
}

function resetVerifierQr() {
  if (verifierQrStatus) {
    verifierQrStatus.textContent = "No Walt.id presentation request yet.";
  }
  if (verifierQrLink) {
    verifierQrLink.href = "#";
    verifierQrLink.textContent = "";
  }
  if (verifierQrImage) {
    verifierQrImage.removeAttribute("src");
    verifierQrImage.alt = "";
    verifierQrImage.style.display = "none";
  }
}

function ensureVerifierPresetControl() {
  if (!createVerifierQrButton || document.getElementById("verifierPreset")) {
    return;
  }

  const row = document.createElement("div");
  row.className = "row";

  const label = document.createElement("label");
  label.setAttribute("for", "verifierPreset");
  label.textContent = "Credential preset";

  const select = document.createElement("select");
  select.id = "verifierPreset";
  const presets = [
    { value: "openbadge_jwt_vc_json", label: "OpenBadge (jwt_vc_json)" },
    { value: "identity_sd_jwt", label: "Identity (vc+sd-jwt)" }
  ];
  for (const preset of presets) {
    const option = document.createElement("option");
    option.value = preset.value;
    option.textContent = preset.label;
    select.append(option);
  }

  row.append(label, select);
  if (verifierQrStatus?.parentElement) {
    verifierQrStatus.parentElement.insertBefore(row, verifierQrStatus);
  }
}

function selectedRequestCredentials() {
  const select = document.getElementById("verifierPreset");
  if (!(select instanceof HTMLSelectElement)) {
    return WALT_PRESET_OPTIONS.openbadge_jwt_vc_json;
  }

  return WALT_PRESET_OPTIONS[select.value] ?? WALT_PRESET_OPTIONS.openbadge_jwt_vc_json;
}

async function createSession() {
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contactMethod: contactMethod.value,
      contactValue: contactValue.value
    })
  });

  if (!response.ok) {
    sessionMeta.textContent = `Failed to create session (${response.status})`;
    return;
  }

  const data = await response.json();
  activeSessionId = data.session.sessionId;
  renderSession(data.session);
  resetVerifierQr();
  connectSessionEvents();
}

async function createVerifierQr() {
  if (!activeSessionId) {
    if (verifierQrStatus) {
      verifierQrStatus.textContent = "Create a support session first.";
    }
    return;
  }

  if (verifierQrStatus) {
    verifierQrStatus.textContent = "Creating Walt.id presentation request...";
  }

  const response = await fetch("/api/dev/verifier/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: activeSessionId,
      requestCredentials: selectedRequestCredentials()
    })
  });

  const payload = await response.json().catch(() => ({ message: "Unable to parse verifier response." }));
  if (!response.ok) {
    if (verifierQrStatus) {
      verifierQrStatus.textContent = `Failed to create verifier request (${response.status}): ${payload.message ?? "Unknown error"}`;
    }
    return;
  }

  const holderUrl = payload?.session?.holderUrl;
  const requestId = payload?.session?.requestId;
  if (!holderUrl) {
    if (verifierQrStatus) {
      verifierQrStatus.textContent = "Verifier session created but holder URL is missing from provider response.";
    }
    return;
  }

  const qrDataUrl = payload?.qrDataUrl;
  const qrUrl =
    typeof qrDataUrl === "string" && qrDataUrl.startsWith("data:image")
      ? qrDataUrl
      : `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(holderUrl)}`;
  if (verifierQrStatus) {
    verifierQrStatus.textContent = `Walt.id request ready for session ${activeSessionId}${requestId ? ` (request ${requestId})` : ""}.`;
  }
  if (verifierQrLink) {
    verifierQrLink.href = holderUrl;
    verifierQrLink.textContent = holderUrl;
  }
  if (verifierQrImage) {
    verifierQrImage.src = qrUrl;
    verifierQrImage.alt = "QR code for Walt.id wallet presentation request";
    verifierQrImage.style.display = "block";
  }
}

async function sendLink() {
  if (!activeSessionId) {
    sessionMeta.textContent = "Create a session first.";
    return;
  }

  const response = await fetch(`/api/sessions/${activeSessionId}/send-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contactMethod: contactMethod.value,
      contactValue: contactValue.value
    })
  });

  if (!response.ok) {
    sessionMeta.textContent = `Failed to send link (${response.status})`;
    return;
  }

  const data = await response.json();
  renderSession(data.session);
}

async function resetMemory() {
  await fetch("/api/sessions/reset", { method: "POST" });
  activeSessionId = "";
  if (sse) {
    sse.close();
    sse = null;
  }

  sessionMeta.textContent = "Session memory cleared.";
  paneVerification.textContent = "No presentation yet.";
  paneNzbn.textContent = "No NZBN lookup yet.";
  paneCompanies.textContent = "No Companies lookup yet.";
  sessionTimeline.textContent = "No events yet.";
  resetVerifierQr();
}

function connectSessionEvents() {
  if (!activeSessionId) {
    return;
  }

  if (sse) {
    sse.close();
  }

  sse = new EventSource(`/api/sessions/${activeSessionId}/events`);
  sse.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload?.type === "session_updated") {
      renderSession(payload.session);
    }
  };
}

createSessionButton.addEventListener("click", createSession);
sendLinkButton.addEventListener("click", sendLink);
createVerifierQrButton?.addEventListener("click", createVerifierQr);
resetSessionsButton.addEventListener("click", resetMemory);
ensureVerifierPresetControl();
