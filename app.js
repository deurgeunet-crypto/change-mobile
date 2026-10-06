const countrySettings = {
  SN: { name: "Sénégal", prefix: "+221", placeholder: "+221 77 000 00 00" },
  CI: { name: "Côte d’Ivoire", prefix: "+225", placeholder: "+225 07 00 00 00 00" },
  ML: { name: "Mali", prefix: "+223", placeholder: "+223 70 00 00 00" },
};

const form = document.querySelector("#exchange-form");
const countrySelect = document.querySelector("#country");
const amountInput = document.querySelector("#amount");
const phoneInput = document.querySelector("#phone");
const errorMessage = document.querySelector("#form-error");
const requestSection = document.querySelector("#request-section");
const requestSummary = document.querySelector("#request-summary");
const feeAmount = document.querySelector("#fee-amount");
const feeNote = document.querySelector("#fee-note");

const formatAmount = (amount, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(amount);

const getServiceFee = (amount) => (amount >= 2000 ? amount / 100 : 0);

const updateFeeEstimate = () => {
  const amount = Number(amountInput.value);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    feeAmount.textContent = "Saisissez un montant";
    feeNote.textContent =
      "Gratuit en dessous de 2 000 FCFA. À partir de 2 000 FCFA : 1 %.";
    return;
  }

  const fee = getServiceFee(amount);
  feeAmount.textContent = `${formatAmount(fee, 3)} FCFA`;
  feeNote.textContent =
    amount < 2000
      ? "Aucun frais pour un transfert inférieur à 2 000 FCFA."
      : "Calculé à 1 % du montant. Affichage indicatif.";
};

amountInput.addEventListener("input", updateFeeEstimate);

countrySelect.addEventListener("change", () => {
  const settings = countrySettings[countrySelect.value];
  phoneInput.placeholder = settings.placeholder;
  phoneInput.value = "";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.textContent = "";

  const formData = new FormData(form);
  const source = formData.get("source");
  const destination = formData.get("destination");
  const amount = Number(formData.get("amount"));
  const phone = String(formData.get("phone")).trim();

  if (source === destination) {
    errorMessage.textContent = "Choisissez deux portefeuilles différents.";
    return;
  }

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    errorMessage.textContent = "Saisissez un montant entier supérieur à zéro.";
    return;
  }

  if (phone.length < 8) {
    errorMessage.textContent = "Saisissez un numéro de téléphone valide.";
    return;
  }

  const country = countrySettings[countrySelect.value];
  const formattedAmount = formatAmount(amount);
  const formattedFee = formatAmount(getServiceFee(amount), 3);

  requestSummary.textContent =
    `${formattedAmount} FCFA de ${source} vers ${destination} · ` +
    `${country.name} · destination ${phone} · ` +
    `frais théoriques : ${formattedFee} FCFA. Aucun frais collecté : ` +
    `le compte bénéficiaire et les paiements ne sont pas configurés.`;
  requestSection.hidden = false;
  requestSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
