// Clé du stockage de session utilisé pour conserver le profil temporaire.
const PROFILE_KEY = "WECCO-demo-profile";
// Définition des parcours supportés par la démonstration.
const routes = {
  "wave-orange": { source: "Wave", destination: "Orange Money" },
  "orange-wave": { source: "Orange Money", destination: "Wave" },
};

// Références des écrans du parcours de demande d’échange.
const screens = {
  auth: document.querySelector("#auth-screen"),
  direction: document.querySelector("#direction-screen"),
  details: document.querySelector("#details-screen"),
  confirmation: document.querySelector("#confirmation-screen"),
};
// Éléments visuels qui indiquent l’état du parcours d’étapes.
const stepCaption = document.querySelector("#step-caption");
const stepIndicator = document.querySelector("#step-indicator");
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const authError = document.querySelector("#auth-error");
const exchangeForm = document.querySelector("#exchange-form");
const amountInput = document.querySelector("#amount");
const errorMessage = document.querySelector("#form-error");
const requestSummary = document.querySelector("#request-summary");
const feeAmount = document.querySelector("#fee-amount");
const feeNote = document.querySelector("#fee-note");
const totalDebit = document.querySelector("#total-debit");
const alternatePhone = document.querySelector("#alternate-phone");
const alternatePhoneWrap = document.querySelector("#alternate-phone-wrap");
const logoutButton = document.querySelector("#logout-button");
const verificationForm = document.querySelector("#verification-form");

// Profil courant de l’utilisateur et accès en attente de vérification.
let profile = null;
let pendingSignup = null;

// Formatte les montants selon le style local du Sénégal (espace et décimales).
const formatAmount = (amount, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(amount);

// Frais simulés de la démo : gratuit sous 2 000 FCFA, puis 1 %.
const getServiceFee = (amount) => (amount >= 2000 ? amount / 100 : 0);
const getSelectedRoute = () =>
  routes[document.querySelector('input[name="route"]:checked').value];

// Gère la vue active et l’indicateur d’étapes du parcours de demande.
const showScreen = (screenName, step, caption) => {
  Object.entries(screens).forEach(([name, screen]) => {
    screen.hidden = name !== screenName;
  });
  stepCaption.textContent = `Étape ${step} sur 3 · ${caption}`;
  stepIndicator.setAttribute("aria-label", `Étape ${step} sur 3`);
  stepIndicator.querySelectorAll(".step-dot").forEach((dot, index) => {
    dot.classList.toggle("is-active", index < step);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// Met à jour le calcul des frais et du débit total selon le montant saisi.
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

// Active l’état de session après validation du code.
const setProfile = (nextProfile) => {
  profile = nextProfile;
  document.querySelector("#registered-phone-label").textContent = profile.phone;
  document.querySelector("#login-phone").value = profile.phone;
  logoutButton.hidden = false;
  authError.textContent = "";
  showScreen("direction", 2, "Sens du change");
};

// Validation simple des numéros pour la démo front-end.
const isValidPhone = (phone) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
};

const normalizePhone = (phone) => phone.trim().replace(/[\s().-]/g, "");
const isValidE164Phone = (phone) => /^\+[1-9]\d{7,14}$/.test(phone);

// Envoie les requêtes d’inscription / vérification au worker auth configuré.
const postAuthRequest = async (path, payload) => {
  const authApiBaseUrl = document
    .querySelector('meta[name="auth-api-base-url"]')
    .content.trim()
    .replace(/\/$/, "");
  if (!authApiBaseUrl) {
    throw new Error(
      "L’envoi du code n’est pas encore configuré. Le serveur de vérification doit être déployé.",
    );
  }

  let response;
  try {
    response = await fetch(`${authApiBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Le serveur de vérification est injoignable. Vérifiez votre connexion et réessayez.",
    );
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "Le serveur de vérification a renvoyé une réponse illisible. Réessayez plus tard.",
    );
  }

  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "La vérification a échoué. Réessayez plus tard.",
    );
  }
  return result;
};

// Demande un code de vérification et affiche ensuite le formulaire de confirmation.
const requestVerificationCode = async (signup, isResend = false) => {
  authError.textContent = "";
  const button = isResend
    ? document.querySelector("#resend-code")
    : signup.mode === "login"
      ? loginForm.querySelector('button[type="submit"]')
      : signupForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await postAuthRequest("/auth/start", {
      phone: signup.phone,
      channel: signup.channel,
    });
    pendingSignup = signup;
    verificationForm.reset();
    verificationForm.hidden = false;
    signupForm.hidden = true;
    loginForm.hidden = true;
    document.querySelector("#auth-title").textContent =
      "Confirmez votre numéro";
    document.querySelector("#verification-destination").textContent =
      `Un code a été demandé par ${signup.channel === "sms" ? "SMS" : "WhatsApp"} pour ${signup.phone}.`;
    document.querySelector("#confirm-code").textContent =
      signup.mode === "login"
        ? "Confirmer et continuer →"
        : "Confirmer mon numéro →";
    document.querySelector("#verification-code").focus();
  } catch (error) {
    authError.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};

document.querySelector("#login-tab").addEventListener("click", () => {
  pendingSignup = null;
  document.querySelector("#auth-title").textContent = "Connectez-vous";
  document.querySelector("#login-tab").classList.add("is-selected");
  document.querySelector("#signup-tab").classList.remove("is-selected");
  document.querySelector("#login-tab").setAttribute("aria-selected", "true");
  document.querySelector("#signup-tab").setAttribute("aria-selected", "false");
  loginForm.hidden = false;
  signupForm.hidden = true;
  verificationForm.hidden = true;
  authError.textContent = "";
});

document.querySelector("#signup-tab").addEventListener("click", () => {
  pendingSignup = null;
  document.querySelector("#auth-title").textContent = "Créer un compte démo";
  document.querySelector("#signup-tab").classList.add("is-selected");
  document.querySelector("#login-tab").classList.remove("is-selected");
  document.querySelector("#signup-tab").setAttribute("aria-selected", "true");
  document.querySelector("#login-tab").setAttribute("aria-selected", "false");
  signupForm.hidden = false;
  loginForm.hidden = true;
  verificationForm.hidden = true;
  authError.textContent = "";
});

// Toute connexion vérifie le contrôle du numéro avant d’ouvrir une session.
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  const phone = normalizePhone(String(new FormData(loginForm).get("phone")));
  if (!isValidE164Phone(phone)) {
    authError.textContent =
      "Saisissez un numéro au format international, par exemple +221770000000.";
    return;
  }

  requestVerificationCode({
    firstName: "",
    lastName: "",
    phone,
    channel: "sms",
    mode: "login",
  });
});

// Inscription de la démo : validation du prénom, nom, numéro et canal.
signupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  authError.textContent = "";
  const formData = new FormData(signupForm);
  const firstName = String(formData.get("firstName")).trim();
  const lastName = String(formData.get("lastName")).trim();
  const phone = normalizePhone(String(formData.get("phone")));
  const channel = String(formData.get("channel"));
  if (
    !firstName ||
    !lastName ||
    !isValidE164Phone(phone) ||
    !["sms", "whatsapp"].includes(channel)
  ) {
    authError.textContent =
      "Vérifiez le prénom, le nom, le numéro au format international (+221…) et le canal choisi.";
    return;
  }

  requestVerificationCode({ firstName, lastName, phone, channel, mode: "signup" });
});

// Vérifie le code reçu avant d’enregistrer le profil temporaire.
verificationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  if (!pendingSignup) {
    authError.textContent =
      "Aucune inscription à confirmer. Recommencez l’inscription.";
    return;
  }

  const code = String(new FormData(verificationForm).get("code")).trim();
  if (!/^\d{4,10}$/.test(code)) {
    authError.textContent = "Saisissez le code reçu (4 à 10 chiffres).";
    return;
  }

  const submitButton = verificationForm.querySelector(
    'button[type="submit"]',
  );
  submitButton.disabled = true;
  try {
    const result = await postAuthRequest("/auth/check", {
      phone: pendingSignup.phone,
      code,
    });
    if (result.verified !== true) {
      authError.textContent =
        "Le code n’a pas été confirmé. Vérifiez-le ou demandez-en un nouveau.";
      return;
    }

    const nextProfile = {
      firstName: pendingSignup.firstName,
      lastName: pendingSignup.lastName,
      phone: pendingSignup.phone,
    };
    try {
      sessionStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    } catch {
      authError.textContent =
        "Le numéro est confirmé, mais le profil temporaire n’a pas pu être enregistré dans cette session.";
      return;
    }
    verificationForm.reset();
    pendingSignup = null;
    setProfile(nextProfile);
  } catch (error) {
    authError.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#resend-code").addEventListener("click", () => {
  if (!pendingSignup) {
    authError.textContent =
      "Aucune inscription à confirmer. Recommencez l’inscription.";
    return;
  }
  requestVerificationCode(pendingSignup, true);
});

document.querySelector("#change-phone").addEventListener("click", () => {
  const returnToLogin = pendingSignup?.mode === "login";
  pendingSignup = null;
  verificationForm.reset();
  verificationForm.hidden = true;
  loginForm.hidden = !returnToLogin;
  signupForm.hidden = returnToLogin;
  document.querySelector("#auth-title").textContent = returnToLogin
    ? "Connectez-vous"
    : "Créer un compte démo";
  authError.textContent = "";
  document.querySelector(returnToLogin ? "#login-tab" : "#signup-tab").focus();
});

// Prépare les détails du parcours à partir du sens sélectionné.
document.querySelector("#to-details").addEventListener("click", () => {
  const route = getSelectedRoute();
  document.querySelector("#route-summary").textContent =
    `${route.source} → ${route.destination}`;
  document.querySelector("#source-wallet-name").textContent = route.source;
  const sourceLogo = document.querySelector("#source-wallet-logo");
  sourceLogo.textContent = route.source === "Wave" ? "W" : "O";
  sourceLogo.className = `wallet-logo ${route.source === "Wave" ? "wave-logo" : "orange-logo"}`;
  document.querySelector("#registered-phone-label").textContent = profile.phone;
  showScreen("details", 3, "Détails de l’échange");
});

document.querySelectorAll('input[name="route"]').forEach((input) => {
  input.addEventListener("change", () => {
    const route = getSelectedRoute();
    document.querySelector("#route-summary").textContent =
      `${route.source} → ${route.destination}`;
  });
});

document.querySelectorAll('input[name="numberChoice"]').forEach((input) => {
  input.addEventListener("change", () => {
    const useAlternate =
      document.querySelector('input[name="numberChoice"]:checked').value ===
      "alternate";
    alternatePhoneWrap.hidden = !useAlternate;
    alternatePhone.required = useAlternate;
    if (!useAlternate) alternatePhone.value = "";
  });
});

amountInput.addEventListener("input", updateFeeEstimate);

// Récapitulatif final de la demande avant validation visuelle du prototype.
exchangeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.textContent = "";

  const formData = new FormData(exchangeForm);
  const amount = Number(formData.get("amount"));
  const destinationPhone = String(formData.get("destinationPhone")).trim();
  const senderPhone =
    formData.get("numberChoice") === "alternate"
      ? String(formData.get("alternatePhone")).trim()
      : profile.phone;

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    errorMessage.textContent = "Saisissez un montant entier supérieur à zéro.";
    return;
  }
  if (!isValidPhone(senderPhone) || !isValidPhone(destinationPhone)) {
    errorMessage.textContent =
      "Saisissez un numéro valide pour le portefeuille de départ et celui de réception.";
    return;
  }

  const route = getSelectedRoute();
  const fee = getServiceFee(amount);
  const formattedFee = formatAmount(fee, 3);
  const formattedDebit = formatAmount(amount + fee, 3);
  const customerName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(" ");
  const greeting = customerName ? `, ${customerName}` : "";
  requestSummary.textContent =
    `Bonjour${greeting}. ${formatAmount(amount)} FCFA à échanger de ` +
    `${route.source} (${senderPhone}) vers ${route.destination} ` +
    `(${destinationPhone}). Frais estimés : ${formattedFee} FCFA. ` +
    `Débit total théorique : ${formattedDebit} FCFA, avant arrondi.`;
  showScreen("confirmation", 3, "Récapitulatif");
});

document.querySelector("#back-to-direction").addEventListener("click", () => {
  showScreen("direction", 2, "Sens du change");
});

document.querySelector("#new-exchange").addEventListener("click", () => {
  exchangeForm.reset();
  alternatePhoneWrap.hidden = true;
  alternatePhone.required = false;
  errorMessage.textContent = "";
  updateFeeEstimate();
  showScreen("direction", 2, "Sens du change");
});

// Supprime le profil temporaire et revient à l’écran d’authentification.
const logout = () => {
  try {
    sessionStorage.removeItem(PROFILE_KEY);
  } catch {
    authError.textContent =
      "Le profil n’a pas pu être effacé de cette session de démonstration.";
    return;
  }
  profile = null;
  logoutButton.hidden = true;
  authError.textContent = "";
  loginForm.reset();
  signupForm.reset();
  verificationForm.reset();
  verificationForm.hidden = true;
  pendingSignup = null;
  showScreen("auth", 1, "Accès");
};

logoutButton.addEventListener("click", logout);
document.querySelector("#logout-from-route").addEventListener("click", logout);
