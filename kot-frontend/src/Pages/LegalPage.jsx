import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck, Truck, Scale } from 'lucide-react';

const legalDate = '15 octobre 2026';

const sections = {
  legal: {
    title: 'Mentions légales',
    icon: Scale,
    intro: 'Informations sur l’exploitant du site, son activité et son hébergement.',
    content: (
      <>
        <h2>Éditeur et exploitant</h2>
        <dl className="legal-facts">
          <Fact label="Nom commercial" value="King Of Tacos" />
          <Fact label="Exploitant" value="King Of Tacos — restauration, entreprise individuelle" />
          <Fact label="Adresse de l’établissement" value="Camp de Gaulle, section VH1, Impasse des Palétuviers N64, Libreville, Gabon" />
          <Fact label="RCCM" value="RG LBV2018A46347" />
          <Fact label="NIF" value="395310 T" />
          <Fact label="Téléphone" value="062 93 72 92" />
          <Fact label="E-mail" value="kingoftacoslbv@gmail.com" />
          <Fact label="Directeur de publication" value="Karl BIRINDA, propriétaire et exploitant individuel de King Of Tacos" />
        </dl>
        <h2>Hébergement</h2>
        <p>Le site et les données associées sont hébergés sur un serveur VPS Hostinger situé à Vilnius, en Lituanie. Hébergeur légal : HOSTINGER INTERNATIONAL LIMITED, société chypriote, 61 Lordou Vironos str., 6023 Larnaca, Chypre. Courriel : compliance@hostinger.com. Téléphone : +33 50 27 49 31.</p>
        <h2>Propriété intellectuelle</h2>
        <p>Les textes, visuels, logos, photographies et éléments de l’interface sont protégés. Toute réutilisation doit être autorisée par leur titulaire, sauf exception prévue par la loi.</p>
        <h2>Contact</h2>
        <p>Pour toute question relative au site ou à son contenu, contactez King Of Tacos au 062 93 72 92 ou à kingoftacoslbv@gmail.com.</p>
      </>
    )
  },
  terms: {
    title: 'Conditions générales de commande',
    icon: FileText,
    intro: 'Conditions applicables aux commandes en ligne de King Of Tacos.',
    content: (
      <>
        <p><strong>Mise à jour : {legalDate}.</strong> Les présentes conditions s’appliquent aux commandes de repas et boissons passées sur le site King Of Tacos. Avant de confirmer, le client peut vérifier le récapitulatif de sa commande et corriger les informations saisies.</p>
        <h2>1. Produits, disponibilité et prix</h2>
        <p>Le menu présente les produits, leurs prix et, le cas échéant, les choix et suppléments disponibles. Les prix des produits affichés par King Of Tacos sont en FCFA et taxes incluses. Les choix effectués et le montant dû à King Of Tacos sont récapitulés avant confirmation. La disponibilité peut évoluer selon le stock ; si un produit commandé ne peut être fourni, le restaurant contacte le client pour convenir d’une solution ou procéder au remboursement correspondant lorsqu’un paiement a déjà été encaissé.</p>
        <h2>2. Commande et confirmation</h2>
        <p>Le client renseigne les informations nécessaires, choisit le retrait ou la livraison, puis confirme sa commande. La commande est prise en compte après l’accusé de réception du site. Lorsqu’un paiement en ligne est choisi, la commande ne passe en préparation qu’après confirmation effective du paiement par le prestataire. Une demande en attente ou un échec de paiement ne constitue pas un paiement confirmé et ne permet pas au restaurant de commencer la préparation. Le service en ligne dépend des horaires et disponibilités indiqués par le restaurant.</p>
        <h2>3. Retrait et livraison par partenaire</h2>
        <p>Le retrait s’effectue auprès du restaurant selon les indications communiquées. Pour une livraison, le client fournit une adresse complète et un numéro de téléphone joignable. Les livreurs partenaires assurent la remise physique de la commande. Les frais de livraison sont fixés et réglés directement au livreur partenaire ; ils ne sont ni inclus dans le chiffre d’affaires de King Of Tacos ni facturés dans le paiement des produits à King Of Tacos. Le restaurant reste l’interlocuteur du client pour la commande alimentaire et suit son exécution jusqu’à la remise.</p>
        <h2>4. Paiement</h2>
        <p>Les moyens de paiement effectivement disponibles sont affichés lors de la commande. Pour un paiement Mobile Money en ligne, le client valide la demande sur son téléphone. Le site n’a pas besoin de son code secret Mobile Money. Le statut de paiement affiché par le prestataire détermine si le paiement est confirmé. Les frais du livreur partenaire sont réglés séparément au livreur.</p>
        <h2>5. Annulation, réclamation et remboursement</h2>
        <p>Un client connecté peut demander l’annulation depuis son espace de commandes tant que la commande est encore en attente et non payée. Pour une commande passée sans compte, déjà payée ou déjà en préparation, contactez rapidement le restaurant au 062 93 72 92 ou à kingoftacoslbv@gmail.com, en indiquant le numéro de commande. En cas d’erreur, d’article manquant, de problème de qualité ou de retard, le restaurant examine la réclamation et propose une solution adaptée aux circonstances et aux règles applicables. Tout remboursement d’un paiement encaissé est effectué par le moyen approprié selon le statut de la commande et les règles applicables.</p>
        <h2>6. Rétractation</h2>
        <p>Les droits de rétractation sont déterminés par la législation gabonaise applicable aux contrats à distance. La loi prévoit notamment des exceptions pour certains biens susceptibles de se détériorer ou de se périmer rapidement et pour des prestations de restauration prévues à une date ou une période déterminée. L’application d’une exception dépend du produit et du service concernés et n’écarte pas les autres droits impératifs du client.</p>
        <h2>7. Compte et fidélité</h2>
        <p>Un compte permet notamment de retrouver les commandes et, lorsque le programme est activé, de consulter les points et récompenses. Les conditions visibles dans l’application s’appliquent aux points et récompenses. Une opération liée à une commande annulée ou corrigée peut être ajustée.</p>
        <h2>8. Contact et droit applicable</h2>
        <p>Les présentes conditions sont destinées aux commandes exécutées au Gabon et sont interprétées selon le droit gabonais applicable. Toute difficulté peut d’abord être signalée au restaurant afin de rechercher une solution amiable, sans priver le client des recours prévus par la loi.</p>
        <p>King Of Tacos — Camp de Gaulle, section VH1, Impasse des Palétuviers N64, Libreville, Gabon — 062 93 72 92 — kingoftacoslbv@gmail.com.</p>
      </>
    )
  },
  privacy: {
    title: 'Politique de confidentialité',
    icon: ShieldCheck,
    intro: 'Informations sur les données utilisées pour les comptes, commandes, paiements et livraisons.',
    content: (
      <>
        <p><strong>Mise à jour : {legalDate}.</strong> King Of Tacos, exploité sous forme d’entreprise individuelle, utilise les données décrites ci-dessous pour fournir le service de commande et assurer le suivi des clients.</p>
        <h2>Responsable et contact</h2>
        <p>Responsable du traitement : l’exploitant de King Of Tacos, Camp de Gaulle, section VH1, Impasse des Palétuviers N64, Libreville, Gabon. Contact pour les demandes relatives aux données : kingoftacoslbv@gmail.com ou 062 93 72 92.</p>
        <h2>Données traitées et finalités</h2>
        <ul>
          <li>Compte : nom, e-mail, téléphone et données de connexion, pour créer le compte et gérer l’authentification. Si le client choisit Google pour se connecter, le nom et l’adresse e-mail transmis par Google sont utilisés pour cette connexion.</li>
          <li>Commande : produits, quantités, personnalisations, montant, mode de remise, adresse, heure souhaitée et instructions, pour enregistrer, préparer et suivre la commande.</li>
          <li>Livraison : pour remettre une commande au livreur partenaire, King Of Tacos lui transmet le nom, le numéro de téléphone, l’adresse de livraison et les détails nécessaires de la commande.</li>
          <li>Suivi du service : demandes d’annulation et motifs, avis, historique de fidélité et échanges avec le restaurant, pour traiter les réclamations, administrer le programme et assurer le service.</li>
          <li>Données techniques et de session, pour faire fonctionner le site, conserver le panier et protéger les comptes et commandes.</li>
        </ul>
        <h2>Paiement et autres destinataires</h2>
        <p>Les données nécessaires au paiement sont transmises au prestataire de paiement choisi et affiché au moment du règlement, notamment MyPVIT lorsqu’il est utilisé. King Of Tacos ne demande pas et ne doit pas recevoir le code secret Mobile Money du client. Les données sont également accessibles aux personnes habilitées du restaurant et aux prestataires techniques nécessaires à l’hébergement et à l’authentification. Elles ne sont pas vendues.</p>
        <h2>Hébergement et transferts</h2>
        <p>Le serveur VPS du site est situé à Vilnius, en Lituanie. Une copie de toutes les données du site et des transactions est hébergée à Libreville, au Gabon. Google, les prestataires de paiement et les prestataires techniques peuvent également traiter les données selon leurs services et leurs propres conditions. Le transfert des données et les garanties applicables doivent respecter les règles gabonaises de protection des données.</p>
        <h2>Durée de conservation</h2>
        <p>Les données de compte sont conservées tant que le compte est actif, puis supprimées ou anonymisées sur demande lorsque leur conservation n’est pas nécessaire. Les données liées aux commandes et pièces justificatives sont conservées pendant les durées nécessaires au suivi des commandes, aux obligations légales et à la preuve des transactions. La législation gabonaise sur les transactions électroniques prévoit une conservation des documents électroniques pendant dix ans ; les données soumises à cette obligation ne peuvent pas être effacées avant l’échéance applicable. Les données techniques de session sont conservées pour la durée nécessaire au fonctionnement et à la sécurité du service.</p>
        <h2>Vos droits</h2>
        <p>Le client peut demander l’accès à ses données, leur rectification, leur mise à jour ou leur effacement lorsque les règles de conservation le permettent. Il peut également demander des informations sur les traitements et destinataires. Pour exercer ces droits, écrire à kingoftacoslbv@gmail.com en précisant la demande et un moyen de retrouver le compte ou la commande concernée.</p>
        <h2>Stockage local et cookies</h2>
        <p>Le navigateur utilise des stockages techniques nécessaires au fonctionnement du site, notamment pour le panier et la session. Cette politique devra être actualisée si des outils d’audience, de publicité ou des cookies non essentiels sont ajoutés.</p>
      </>
    )
  },
  delivery: {
    title: 'Retrait, livraison et annulation',
    icon: Truck,
    intro: 'Modalités pratiques de remise des commandes King Of Tacos.',
    content: (
      <>
        <h2>Retrait</h2>
        <p>Choisissez « À emporter » et indiquez, si nécessaire, l’heure souhaitée. Attendez la confirmation ou le suivi de la commande avant de vous déplacer. Le restaurant peut vous contacter au numéro indiqué pour préciser le retrait.</p>
        <h2>Livraison par un partenaire</h2>
        <p>Choisissez « Livraison », indiquez une adresse complète et restez joignable au téléphone. Les livreurs partenaires assurent la remise physique de la commande. Les frais de livraison sont convenus et réglés directement au livreur ; ils ne sont pas inclus dans le montant à payer à King Of Tacos. Les produits commandés et leur paiement sont gérés par King Of Tacos, qui reste le contact pour toute réclamation concernant les produits ou la commande.</p>
        <p>Pour organiser la remise, le restaurant communique au livreur partenaire le nom, le téléphone, l’adresse de livraison et les détails nécessaires de la commande. Le client doit vérifier l’adresse et rester disponible pour faciliter la livraison.</p>
        <h2>Horaires et disponibilité</h2>
        <p>Les commandes en ligne sont soumises aux horaires d’acceptation et à la disponibilité configurés par le restaurant. Si une commande ne peut être honorée, le restaurant contacte le client pour convenir de la suite.</p>
        <h2>Annulation et problème de commande</h2>
        <p>Une commande non payée peut être annulée depuis l’espace de suivi lorsqu’elle est encore « En attente ». Pour une commande payée ou déjà en préparation, contactez le restaurant au 062 93 72 92 ou à kingoftacoslbv@gmail.com avec le numéro de commande. En cas d’article manquant, de commande incorrecte ou de problème de qualité, signalez-le dès que possible afin que l’équipe puisse vérifier la situation et proposer une solution adaptée.</p>
        <h2>Contact</h2>
        <p>King Of Tacos — 062 93 72 92 — kingoftacoslbv@gmail.com.</p>
      </>
    )
  }
};

function Fact({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

export default function LegalPage({ page }) {
  const content = sections[page] || sections.legal;
  const Icon = content.icon;
  return (
    <div className="min-h-screen px-4 py-10 sm:px-6">
      <article className="mx-auto max-w-4xl rounded-2xl border border-amber-100 bg-white p-6 shadow-sm sm:p-10">
        <Link to="/" className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-900">
          <ArrowLeft className="h-4 w-4" /> Retour à l’accueil
        </Link>
        <div className="mb-7 flex items-start gap-4 border-b border-gray-200 pb-6">
          <div className="rounded-xl bg-amber-100 p-3 text-amber-700"><Icon className="h-6 w-6" /></div>
          <div><h1 className="text-3xl font-bold text-gray-900">{content.title}</h1><p className="mt-2 text-gray-600">{content.intro}</p></div>
        </div>
        <div className="legal-copy">{content.content}</div>
        <nav aria-label="Autres pages d’information" className="mt-10 border-t border-gray-200 pt-6">
          <p className="mb-3 font-semibold text-gray-900">Autres informations</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-amber-700">
            <Link to="/mentions-legales">Mentions légales</Link>
            <Link to="/conditions-generales">Conditions générales</Link>
            <Link to="/confidentialite">Confidentialité</Link>
            <Link to="/livraison-annulation">Retrait, livraison et annulation</Link>
          </div>
        </nav>
      </article>
    </div>
  );
}
