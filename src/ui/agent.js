const contactMethod = document.getElementById("contactMethod");
const contactValue = document.getElementById("contactValue");
const createSessionButton = document.getElementById("createSession");
const sendLinkButton = document.getElementById("sendLink");
const resetSessionsButton = document.getElementById("resetSessions");
const sessionMeta = document.getElementById("sessionMeta");
const paneVerification = document.getElementById("paneVerification");
const paneNzbn = document.getElementById("paneNzbn");
const paneCompanies = document.getElementById("paneCompanies");
const sessionTimeline = document.getElementById("sessionTimeline");

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
  paneNzbn.textContent = pretty(session.nzbnContext ?? { message: "No NZBN context yet." });
  paneCompanies.textContent = pretty(session.companiesContext ?? { message: "No Companies context yet." });
  sessionTimeline.textContent = pretty(session.events ?? []);
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
  connectSessionEvents();
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
resetSessionsButton.addEventListener("click", resetMemory);
