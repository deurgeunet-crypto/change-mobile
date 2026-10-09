# WECCO — Prototype

Prototype responsive de demandes d’échange entre Wave et Orange Money, préparé
pour présenter un projet de pilote au Sénégal. L’interface peut être utilisée
dans un navigateur web et installée comme application web sur les appareils
compatibles.

## Démarrer

Ouvrir `index.html` dans un navigateur. Pour tester l’installation PWA et le
mode hors ligne, servir le dossier via HTTPS ou depuis `localhost` (le service
worker ne fonctionne pas depuis une URL `file://`).

## Installer sur iPhone

L’application est une PWA (application web installable), pas un fichier IPA
publié sur l’App Store. Pour l’ajouter à l’écran d’accueil :

1. Publier les fichiers du projet sur un hébergement web avec HTTPS.
2. Ouvrir l’adresse HTTPS dans **Safari** sur l’iPhone.
3. Toucher **Partager**, puis **Sur l’écran d’accueil**.
4. Activer **Ouvrir comme app web** si cette option apparaît, puis toucher
   **Ajouter**.

Le lien doit être publiquement accessible et utiliser HTTPS ; ouvrir directement
`index.html` depuis un ordinateur ou un dossier de fichiers ne permet pas
l’installation PWA sur iPhone. Aucun hébergement n’est configuré par ce projet.
Après une mise à jour, si l’ancienne icône reste affichée, supprimer le raccourci
de l’écran d’accueil et l’ajouter à nouveau depuis Safari.

## Publication publique avec GitHub Pages

La configuration de déploiement automatique est dans
`.github/workflows/pages.yml`. Pour publier :

1. Créer un dépôt GitHub **public** vide. Le code source et le prototype seront
   visibles publiquement. Ne jamais ajouter de numéro privé, mot de passe, clé
   API, PIN ou OTP au dépôt.
2. Dans les paramètres du dépôt, ouvrir **Pages** et choisir **GitHub Actions**
   comme source de déploiement.
3. Relier ce projet local au dépôt public, créer un commit contenant les fichiers
   du projet, puis pousser la branche `main`. Le workflow publiera le site et
   affichera son adresse dans GitHub, sous **Actions** puis dans le déploiement
   `github-pages`.
4. Ouvrir cette adresse en HTTPS dans Safari sur l’iPhone et suivre les étapes
   « Sur l’écran d’accueil » ci-dessus.

Le premier déploiement peut nécessiter quelques minutes. Les futures mises à
jour de la branche `main` seront publiées automatiquement.

Le dossier [presentation-partenaire.html](./presentation-partenaire.html) présente
WECCO à un bureau de développement d’applications : vision produit, périmètre
MVP, parcours, exigences techniques et questions pour chiffrer la réalisation.
Il peut être imprimé ou enregistré en PDF depuis le navigateur.

## Limites de cette version

- L’inscription demande une confirmation Twilio par SMS ou WhatsApp lorsque le
  Worker Cloudflare est déployé et que son URL est configurée dans `index.html`.
  Sans ces étapes, aucun code n’est envoyé.
- L’inscription comme la connexion demandent un code SMS/WhatsApp et établissent
  seulement que la personne peut recevoir le code au numéro fourni. Cette
  version ne crée pas de compte permanent : le profil est conservé temporairement
  dans la session du navigateur. Ne pas utiliser cette vérification comme
  authentification pour des paiements.
- Les demandes sont uniquement affichées dans le navigateur; elles ne sont pas
  envoyées à un serveur ni enregistrées.
- Wave et Orange Money ne sont pas connectés; aucun transfert ou paiement réel
  n’est déclenché.
- Aucun compte bénéficiaire n’est configuré : l’estimation affichée n’est pas
  collectée et ne doit pas être présentée comme un frais déjà facturé.
- Les frais affichés sont indicatifs : 0 FCFA en dessous de 2 000 FCFA, puis
  1 % à partir de 2 000 FCFA. L’hypothèse de travail est de les ajouter au
  montant débité; le débit et son arrondi doivent être confirmés avec le
  prestataire.
- Aucun taux de change n’est calculé. Le montant reçu doit être confirmé avant
  d’envisager une intégration réelle.
- L’utilisation de services de paiement nécessite les intégrations, accords et
  autorisations applicables dans chaque pays.

## Préparer la confirmation du numéro (Twilio + Cloudflare Workers)

L’application reste hébergée sur GitHub Pages. Le Worker relaie les demandes
vers Twilio Verify; les clés Twilio ne sont jamais placées dans le JavaScript
public.

1. Dans Twilio, crée un service **Verify**, puis une clé API de type
   **Restricted** (SID `SK…` et secret). Dans les permissions Verify, autorise
   uniquement **Create** pour `verification` et `verification-check`.
   Configure les canaux nécessaires. Un compte d’essai Twilio ne peut envoyer
   des codes qu’aux numéros préalablement vérifiés dans Twilio.
2. Sur un ordinateur avec Node.js/npm installé, ouvre PowerShell à la racine du
   projet et connecte Wrangler à ton compte Cloudflare :

   ```powershell
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put TWILIO_API_KEY_SID
   npx wrangler secret put TWILIO_API_KEY_SECRET
   npx wrangler deploy
   ```

   Copie le SID et le secret de la clé restreinte directement aux invites
   Wrangler. Wrangler demande chaque secret de façon interactive. Ne les écris
   jamais dans `app.js`, `index.html`, GitHub ou une commande enregistrée. Le
   SID du service Verify est déjà configuré comme variable non secrète dans
   `wrangler.toml`.
   Si Wrangler signale que les identifiants `namespace_id` des limiteurs sont
   déjà utilisés dans ton compte, remplace `91026001` et `91026002` par deux
   identifiants entiers uniques dans `wrangler.toml`.
3. Après le déploiement, Cloudflare affiche une adresse en
   `*.workers.dev`. Copie-la dans l’attribut `content` de
   `<meta name="auth-api-base-url">` dans `index.html`, sans barre oblique finale.
   La liste `ALLOWED_ORIGINS` de `wrangler.toml` doit contenir l’origine exacte
   du site web (actuellement `https://deurgeunet-crypto.github.io`, sans le
   chemin `/change-mobile/`). Redéploie ensuite le site GitHub Pages.
4. Essaie l’envoi avec un numéro dont tu contrôles la réception. Les demandes
   d’envoi sont limitées à 3 par minute et les vérifications à 10 par minute,
   par adresse IP et numéro haché dans une région Cloudflare. Ces limites ne
   remplacent pas la protection anti-fraude de Twilio ni une revue de sécurité
   avant une mise en production.

Références : [Twilio Verify](https://www.twilio.com/docs/verify),
[envoi WhatsApp](https://www.twilio.com/docs/verify/whatsapp) et
[limitation de débit Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Préparation d’un pilote réel au Sénégal

Ne pas activer la collecte ni publier cette démo comme service de paiement. Avant
un pilote :

1. Faire valider le modèle d’échange, les frais, les remboursements et les
   obligations applicables au Sénégal par un professionnel local qualifié et
   les interlocuteurs réglementaires compétents.
2. Obtenir l’accord écrit d’un prestataire de paiement autorisé pour le modèle
   d’activité et ouvrir un compte marchand adapté. Ne pas utiliser un compte
   personnel comme compte de collecte.
3. Valider avec le prestataire l’hypothèse de frais ajoutés au débit du client;
   afficher et faire accepter le montant total avant confirmation. Définir
   l’arrondi en FCFA et le traitement des remboursements.
4. Construire un serveur qui calcule et vérifie les frais, crée les opérations
   et conserve la configuration du compte bénéficiaire dans un gestionnaire de
   secrets. Ne jamais placer ce numéro, des clés API, des PIN ou des OTP dans le
   navigateur, l’application mobile, le dépôt Git ou les journaux.
5. N’accepter un paiement qu’après vérification serveur du retour signé du
   prestataire; appliquer l’idempotence contre les doublons, les contrôles de
   rapprochement, les reçus et une procédure de litige/remboursement.
6. Tester en mode bac à sable avec le prestataire, puis faire une mise en
   production contrôlée après validation. Ne jamais demander le PIN ou l’OTP du
   client.
