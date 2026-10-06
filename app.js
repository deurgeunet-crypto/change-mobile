const countrySettings = {
  SN: { name: "Sénégal", prefix: "+221", placeholder: "+221 77 000 00 00" },
  CI: { name: "Côte d’Ivoire", prefix: "+225", placeholder: "+225 07 00 00 00 00" },
  ML: { name: "Mali", prefix: "+223", placeholder: "+223 70 00 00 00" },
};

const form = document.querySelector("#exchange-form");
const countrySelect = document.querySelector("#country");
const amountInput = document.querySelector("#amount");
const senderPhoneInput = document.querySelector("#sender-phone");
const phoneInput = document.querySelector("#phone");
const errorMessage = document.querySelector("#form-error");
const requestSection = document.querySelector("#request-section");
const requestSummary = document.querySelector("#request-summary");
const feeAmount = document.querySelector("#fee-amount");
const feeNote = document.querySelector("#fee-note");
const totalDebit = document.querySelector("#total-debit");

const formatAmount = (amount, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(amount);

const getServiceFee = (amount) => (amount >= 2000 ? amount / 100 : 0);

const updateFeeEstimate = () => {
  const amount = Number(amountInput.value);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    feeAmount.textContent = "Saisissez un montant";
    totalDebit.textContent = "Saisissez un montant";
    feeNote.textContent =
      "Gratuit en dessous de 2 000 FCFA. À partir de 2 000 FCFA : 1 %.";
    return;
  }

  const fee = getServiceFee(amount);
  feeAmount.textContent = `${formatAmount(fee, 3)} FCFA`;
  totalDebit.textContent = `${formatAmount(amount + fee, 3)} FCFA`;
  feeNote.textContent =
    amount < 2000
      ? "Aucun frais pour un transfert inférieur à 2 000 FCFA."
      : "Calculé à 1 % ; frais ajoutés au débit théorique, avant arrondi.";
};

amountInput.addEventListener("input", updateFeeEstimate);

countrySelect.addEventListener("change", () => {
  const settings = countrySettings[countrySelect.value];
  senderPhoneInput.placeholder = settings.placeholder;
  phoneInput.placeholder = settings.placeholder;
  senderPhoneInput.value = "";
  phoneInput.value = "";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.textContent = "";

  const formData = new FormData(form);
  const source = formData.get("source");
  const destination = formData.get("destination");
  const amount = Number(formData.get("amount"));
  const senderPhone = String(formData.get("senderPhone")).trim();
  const destinationPhone = String(formData.get("phone")).trim();

  if (source === destination) {
    errorMessage.textContent = "Choisissez deux portefeuilles différents.";
    return;
  }

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    errorMessage.textContent = "Saisissez un montant entier supérieur à zéro.";
    return;
  }

  if (senderPhone.length < 8 || destinationPhone.length < 8) {
    errorMessage.textContent =
      "Saisissez un numéro valide pour le portefeuille d’envoi et celui de destination.";
    return;
  }

  const country = countrySettings[countrySelect.value];
  const formattedAmount = formatAmount(amount);
  const formattedFee = formatAmount(getServiceFee(amount), 3);
  const formattedDebit = formatAmount(amount + getServiceFee(amount), 3);

  requestSummary.textContent =
    `${formattedAmount} FCFA à échanger de ${source} (${senderPhone}) vers ` +
    `${destination} (${destinationPhone}) · ${country.name} · ` +
    `frais théoriques : ${formattedFee} FCFA · débit total théorique avant ` +
    `arrondi : ${formattedDebit} FCFA. Aucun paiement n’est effectué.`;
  requestSection.hidden = false;
  requestSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
