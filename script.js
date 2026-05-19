const PROCESS_STEPS = [
  "Claimprüfung durchführen",
  "(Fach-)Technische Prüfung durchführen",
  "Kostenverfolgung",
  "Prüfung dem Grunde nach",
  "Terminliche Prüfung durchführen",
  "Prüfung der Höhe nach",
  "Risikoangaben eintragen",
  "Verhandlung durchführen",
  "Annahme-/Ablehnungsschreiben"
];

const CONTRACT_REFERENCE = {
  klauseln: [
    { id: "K-12", text: "Nebenleistungen sind im Einheitspreis enthalten." },
    { id: "K-27", text: "Besondere Leistungen sind gesondert zu vergüten." },
    { id: "K-31", text: "Preisfortschreibung nach Marktindex möglich." }
  ],
  preise: {
    kabeltrasse: { vertrag: 120, marktMin: 110, marktMax: 150 },
    bodenaushub: { vertrag: 85, marktMin: 75, marktMax: 95 },
    umplanung: { vertrag: 150, marktMin: 130, marktMax: 180 }
  }
};

const RISK_REGISTER = [
  { id: "R-04", name: "Genehmigungsverzug", level: "hoch", tags: ["termin", "behörde", "verzug"] },
  { id: "R-09", name: "Materialpreissteigerung", level: "mittel", tags: ["preis", "teuerung", "markt"] },
  { id: "R-15", name: "Planungsänderung", level: "hoch", tags: ["änderung", "umplanung", "zusatz"] },
  { id: "R-21", name: "Schnittstellenkonflikt", level: "mittel", tags: ["koordination", "schnittstelle"] }
];
const DEFAULT_RISK = RISK_REGISTER[0];

let lastAnalysis = null;
let currentStep = 1;

const processBar = document.getElementById("processBar");
const currentStepLabel = document.getElementById("currentStepLabel");
const form = document.getElementById("claim-form");

renderProcessBar();
setCurrentStep(1);

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const claim = collectClaimInput();
  lastAnalysis = analyzeClaimWithAI(claim);
  renderDashboard(lastAnalysis);
  document.getElementById("draftOutput").value = "";
  setCurrentStep(6);
});

document.getElementById("btnNegotiation").addEventListener("click", () => {
  if (!lastAnalysis) return;
  document.getElementById("draftOutput").value = generateNegotiationDraft(lastAnalysis);
  setCurrentStep(8);
});

document.getElementById("btnRejection").addEventListener("click", () => {
  if (!lastAnalysis) return;
  document.getElementById("draftOutput").value = generateRejectionDraft(lastAnalysis);
  setCurrentStep(9);
});

document.getElementById("btnAcceptance").addEventListener("click", () => {
  if (!lastAnalysis) return;
  document.getElementById("draftOutput").value = generateAcceptanceDraft(lastAnalysis);
  setCurrentStep(9);
});

document.getElementById("btnPrevStep").addEventListener("click", () => setCurrentStep(currentStep - 1));
document.getElementById("btnNextStep").addEventListener("click", () => setCurrentStep(currentStep + 1));

document.querySelectorAll(".workflow-section").forEach((section) => {
  section.addEventListener("click", () => {
    const step = Number(section.dataset.step);
    if (step) setCurrentStep(step);
  });
});

function renderProcessBar() {
  processBar.innerHTML = "";
  PROCESS_STEPS.forEach((label, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "process-step";
    button.dataset.step = String(index + 1);
    button.textContent = `${index + 1}. ${label}`;
    button.addEventListener("click", () => setCurrentStep(index + 1));
    processBar.appendChild(button);
  });
}

function setCurrentStep(step) {
  currentStep = Math.min(PROCESS_STEPS.length, Math.max(1, step));

  document.querySelectorAll(".process-step").forEach((entry) => {
    entry.classList.toggle("active", Number(entry.dataset.step) === currentStep);
  });

  document.querySelectorAll(".process-detail").forEach((entry) => {
    entry.classList.toggle("active", Number(entry.dataset.step) === currentStep);
  });

  currentStepLabel.textContent = `${currentStep}. ${PROCESS_STEPS[currentStep - 1]}`;
}

function collectClaimInput() {
  const selectedDocuments = Array.from(document.querySelectorAll('#documents input[type="checkbox"]:checked')).map(
    (entry) => entry.value
  );

  return {
    claimName: document.getElementById("claimName").value.trim(),
    contractSection: document.getElementById("contractSection").value.trim(),
    claimAmount: Number(document.getElementById("claimAmount").value),
    claimQuantity: Number(document.getElementById("claimQuantity").value),
    technicalReview: document.getElementById("technicalReview").value.trim(),
    justification: document.getElementById("justification").value.trim(),
    documents: selectedDocuments
  };
}

function analyzeClaimWithAI(claim) {
  // TODO: Replace mock logic with Azure OpenAI integration (prompt + claim payload, auth header handling,
  // structured JSON response mapping for clauses/risks/recommendation, plus timeout and error fallback strategy).
  const lowerText = `${claim.claimName} ${claim.technicalReview} ${claim.justification}`.toLowerCase();

  let priceSource = CONTRACT_REFERENCE.preise.kabeltrasse;
  if (containsAny(lowerText, ["aushub"])) priceSource = CONTRACT_REFERENCE.preise.bodenaushub;
  if (containsAny(lowerText, ["planung", "umplanung"])) priceSource = CONTRACT_REFERENCE.preise.umplanung;

  const unitClaimed = claim.claimQuantity > 0 ? claim.claimAmount / claim.claimQuantity : claim.claimAmount;
  const basisLikelyValid = containsAny(lowerText, ["änderung", "zusatz", "umplanung"]);
  const amountPlausible = unitClaimed >= priceSource.marktMin && unitClaimed <= priceSource.marktMax;

  const matchedRisks = RISK_REGISTER.filter((risk) => risk.tags.some((tag) => lowerText.includes(tag)));
  const risks = matchedRisks.length > 0 ? matchedRisks : [DEFAULT_RISK];

  const scheduleImpact =
    containsAny(lowerText, ["termin", "verzug"])
      ? "Voraussichtliche Terminwirkung: kritisch – Meilensteinverschiebung wahrscheinlich."
      : "Voraussichtliche Terminwirkung: moderat – keine kritischen Meilensteine direkt betroffen.";

  let recommendation = "Verhandlung empfohlen: Anspruchslage und Preisansatz gemischt bewerten.";
  if (basisLikelyValid && amountPlausible) {
    recommendation = "Annahme (ganz/teilweise) empfohlen: Anspruch und Höhe erscheinen plausibel.";
  } else if (!basisLikelyValid && !amountPlausible) {
    recommendation = "Ablehnung empfohlen: weder vertragliche Grundlage noch angemessene Höhe erkennbar.";
  }

  return {
    claim,
    basis: {
      verdict: basisLikelyValid
        ? "Anspruch dem Grunde nach voraussichtlich gerechtfertigt (besondere Leistung)."
        : "Anspruch dem Grunde nach eher nicht gerechtfertigt (Nebenleistung möglich).",
      clauses: CONTRACT_REFERENCE.klauseln
    },
    amount: {
      verdict: amountPlausible
        ? "Forderungsbetrag erscheint innerhalb marktüblicher Bandbreite plausibel."
        : "Forderungsbetrag erscheint unplausibel (außerhalb marktüblicher Bandbreite).",
      details: `Gefordert: ${unitClaimed.toFixed(2)} €/Einheit | Vertrag: ${priceSource.vertrag.toFixed(2)} €/Einheit | Markt: ${priceSource.marktMin.toFixed(2)}–${priceSource.marktMax.toFixed(2)} €/Einheit`
    },
    risks,
    scheduleImpact,
    recommendation
  };
}

function renderDashboard(analysis) {
  document.getElementById("basisResult").textContent = analysis.basis.verdict;
  document.getElementById("amountResult").textContent = analysis.amount.verdict;
  document.getElementById("amountDetails").textContent = analysis.amount.details;
  document.getElementById("scheduleResult").textContent = analysis.scheduleImpact;
  document.getElementById("recommendation").textContent = analysis.recommendation;

  const clauses = document.getElementById("clauseMatches");
  clauses.innerHTML = "";
  analysis.basis.clauses.forEach((clause) => {
    const li = document.createElement("li");
    li.textContent = `${clause.id}: ${clause.text}`;
    clauses.appendChild(li);
  });

  const riskResult = document.getElementById("riskResult");
  riskResult.innerHTML = "";
  analysis.risks.forEach((risk) => {
    const li = document.createElement("li");
    li.textContent = `${risk.id} – ${risk.name} (Risikostufe: ${risk.level})`;
    riskResult.appendChild(li);
  });
}

function generateNegotiationDraft(analysis) {
  return [
    "Verhandlungsvorbereitung (Mock):",
    `- Claim: ${analysis.claim.claimName}`,
    `- Vertragsbezug: ${analysis.claim.contractSection}`,
    `- Kernaussage dem Grunde nach: ${analysis.basis.verdict}`,
    `- Kernaussage der Höhe nach: ${analysis.amount.verdict}`,
    "- Argumente zur Reduktion: Bezug auf vertragliche Einheitspreise und Marktbandbreite.",
    "- Zielbild: Teilanerkennung mit klaren Termin- und Kostengrenzen."
  ].join("\n");
}

function generateRejectionDraft(analysis) {
  return [
    "Betreff: Entwurf Ablehnung Nachtragsforderung (Mock)",
    "",
    "Sehr geehrte Damen und Herren,",
    "nach Prüfung Ihres Claims teilen wir mit, dass wir die geltend gemachte Forderung derzeit nicht anerkennen können.",
    `Begründung: ${analysis.basis.verdict} ${analysis.amount.verdict}`,
    "Wir verweisen auf die einschlägigen Vertragsklauseln (siehe interne Prüfung) und bitten bei Bedarf um ergänzende Nachweise.",
    "",
    "Mit freundlichen Grüßen"
  ].join("\n");
}

function generateAcceptanceDraft(analysis) {
  return [
    "Betreff: Entwurf Zustimmung Nachtragsforderung (Mock)",
    "",
    "Sehr geehrte Damen und Herren,",
    "nach Prüfung Ihres Claims stimmen wir einer Annahme dem Grunde nach zu.",
    `Einschätzung: ${analysis.amount.verdict}`,
    "Die Zustimmung erfolgt vorbehaltlich finaler kaufmännischer Prüfung und Terminabstimmung.",
    "",
    "Mit freundlichen Grüßen"
  ].join("\n");
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}
