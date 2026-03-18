const scenarioSelect = document.getElementById("scenario");
const presentButton = document.getElementById("present");
const holderResult = document.getElementById("holderResult");

function getSessionIdFromPath() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

async function presentCredential() {
  const sessionId = getSessionIdFromPath();
  if (!sessionId) {
    holderResult.textContent = "Missing session ID.";
    return;
  }

  const response = await fetch(`/api/sessions/${sessionId}/present`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scenario: scenarioSelect.value
    })
  });

  if (!response.ok) {
    holderResult.textContent = `Presentation failed (${response.status})`;
    return;
  }

  holderResult.textContent = "Credential presented successfully. You can now return to the agent call.";
}

presentButton.addEventListener("click", presentCredential);
