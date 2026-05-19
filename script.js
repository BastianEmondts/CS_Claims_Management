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

let lastAnalysis = null;

const form = document.getElementById("claim-form");
const dashboard = document.getElementById("dashboard");
const drafts = document.getElementById("drafts");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const claim = collectClaimInput();
  lastAnalysis = analyzeClaimWithAI(claim);
  renderDashboard(lastAnalysis);

  dashboard.classList.remove("hidden");
  drafts.classList.remove("hidden");
  document.getElementById("draftOutput").value = "";
});

document.getElementById("btnNegotiation").addEventListener("click", () => {
  if (!lastAnalysis) return;
  document.getElementById("draftOutput").value = generateNegotiationDraft(lastAnalysis);
});

document.getElementById("btnRejection").addEventListener("click", () => {
  if (!lastAnalysis) return;
  document.getElementById("draftOutput").value = generateRejectionDraft(lastAnalysis);
});

document.getElementById("btnAcceptance").addEventListener("click", () => {
  if (!lastAnalysis) return;
  document.getElementById("draftOutput").value = generateAcceptanceDraft(lastAnalysis);
});

function collectClaimInput() {
  const selectedDocuments = Array.from(document.querySelectorAll('#documents input[type="checkbox"]:checked')).map(
    (entry) => entry.value
  );

  return {
    claimName: document.getElementById("claimName").value.trim(),
    contractSection: document.getElementById("contractSection").value.trim(),
    claimAmount: Number(document.getElementById("claimAmount").value),
    claimQuantity: Number(document.getElementById("claimQuantity").value),
    justification: document.getElementById("justification").value.trim(),
    documents: selectedDocuments
  };
}

function analyzeClaimWithAI(claim) {
  // TODO: Integrate Azure OpenAI here.
  const lowerText = `${claim.claimName} ${claim.justification}`.toLowerCase();

  let priceSource = CONTRACT_REFERENCE.preise.kabeltrasse;
  if (lowerText.includes("aushub")) priceSource = CONTRACT_REFERENCE.preise.bodenaushub;
  if (lowerText.includes("planung") || lowerText.includes("umplanung")) priceSource = CONTRACT_REFERENCE.preise.umplanung;

  const unitClaimed = claim.claimQuantity > 0 ? claim.claimAmount / claim.claimQuantity : claim.claimAmount;
  const basisLikelyValid = lowerText.includes("änderung") || lowerText.includes("zusatz") || lowerText.includes("umplanung");
  const amountPlausible = unitClaimed >= priceSource.marktMin && unitClaimed <= priceSource.marktMax;

  const matchedRisks = RISK_REGISTER.filter((risk) => risk.tags.some((tag) => lowerText.includes(tag)));
  const risks = matchedRisks.length > 0 ? matchedRisks : [RISK_REGISTER[0]];

  const scheduleImpact =
    lowerText.includes("termin") || lowerText.includes("verzug")
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
