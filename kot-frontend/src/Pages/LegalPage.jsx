import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck, Truck, Scale } from 'lucide-react';

const sections = {
  legal: {
    title: 'Mentions légales',
    icon: Scale,
    intro: 'Informations relatives à l’éditeur du site et à son hébergement.',
    content: (
      <>
        <Notice />
        <h2>Éditeur du site</h2>
        <dl className="legal-facts">
          <Fact label="Nom commercial" value="King Of Tacos" />
          <Fact label="Exploitant / raison sociale" value="À compléter par l’exploitant" />
          <Fact label="Forme juridique et capital social" value="À compléter, le cas échéant" />
          <Fact label="Adresse du siège ou de l’établissement" value="À compléter par l’exploitant" />
          <Fact label="RCCM et NIF" value="À compléter par l’exploitant" />
          <Fact label="Téléphone et adresse e-mail de contact" value="À confirmer dans les paramètres du restaurant" />
          <Fact label="Directeur de publication" value="À compléter par l’exploitant" />
        </dl>
        <h2>Hébergement</h2>
        <p>Le site est hébergé sur un serveur VPS fourni par Hostinger. Les coordonnées contractuelles complètes de l’hébergeur seront ajoutées après vérification du contrat d’hébergement.</p>
        <h2>Propriété intellectuelle</h2>
        <p>Les textes, visuels, logos, photographies et éléments de l’interface sont protégés. Toute réutilisation doit être autorisée par leur titulaire, sauf exception prévue par la loi.</p>
        <h2>Contact</h2>
        <p>Pour toute question relative au site ou à son contenu, contactez le restaurant aux coordonnées affichées dans la rubrique Contact, une fois celles-ci confirmées par l’exploitant.</p>
      </>
    )
  },
  terms: {
    title: 'Conditions générales de commande',
    icon: FileText,
    intro: 'Règles proposées pour les commandes passées depuis King Of Tacos.',
    content: (
      <>
        <Notice />
        <p><strong>Version de travail — 8 octobre 2026.</strong> Les présentes conditions s’appliquent aux commandes en ligne de repas et boissons proposées sur King Of Tacos. Les commandes sur place sont enregistrées par le personnel du restaurant.</p>
        <h2>1. Produits, choix et prix</h2>
        <p>Le menu présente les produits, leurs prix et, lorsque le produit est configurable, les choix et suppléments disponibles. Les choix effectués par le client sont récapitulés avant l’envoi de la commande. La disponibilité peut évoluer selon le stock et l’activité du restaurant. Le prix confirmé au récapitulatif est celui appliqué à la commande.</p>
        <h2>2. Commande et horaires</h2>
        <p>Le client renseigne les informations nécessaires, choisit le retrait ou la livraison, puis confirme sa commande. Le service de commande en ligne suit les horaires et disponibilités publiés par le restaurant. Lorsque la planification au prochain créneau est proposée, l’heure de préparation peut être décalée au prochain horaire d’ouverture.</p>
        <h2>3. Retrait et livraison</h2>
        <p>Le retrait s’effectue auprès du restaurant à l’heure communiquée. Pour une livraison, le client fournit une adresse exploitable et un numéro de téléphone joignable. Les frais applicables et le montant total doivent être affichés avant la confirmation. Le restaurant contacte le client si une information empêche l’exécution de la commande.</p>
        <h2>4. Paiement</h2>
        <p>Les modes de paiement effectivement disponibles sont indiqués lors de la commande. Le paiement Mobile Money en ligne, lorsqu’il est activé, est confirmé après validation par le prestataire de paiement. Une demande de paiement en attente ne vaut pas confirmation de paiement. Lorsque le paiement en ligne n’est pas proposé, les modalités de règlement au retrait ou à la livraison sont indiquées au client.</p>
        <h2>5. Annulation et réclamation</h2>
        <p>Un client connecté peut demander l’annulation depuis son espace de commandes tant que sa commande est encore en attente et non payée. Le motif d’annulation est demandé et conservé pour le suivi du service. Pour une commande passée sans compte, déjà payée ou déjà prise en charge, contactez directement le restaurant. Cette règle décrit le fonctionnement du bouton d’annulation et ne prétend pas écarter les droits qui seraient applicables dans une situation particulière. En cas d’erreur, d’article manquant, de problème de qualité ou de retard important, contactez rapidement le restaurant avec le numéro de commande.</p>
        <p>Tout remboursement d’un paiement confirmé doit être examiné par le restaurant selon la situation et les règles applicables. Aucune promesse automatique de remboursement n’est faite par la présente page.</p>
        <h2>6. Rétractation et denrées alimentaires</h2>
        <p>Le régime de rétractation applicable aux contrats à distance est celui prévu par les textes gabonais. La loi gabonaise sur les transactions électroniques prévoit un délai général et des exceptions, dont certaines concernent les biens susceptibles de se détériorer ou de se périmer et les prestations de restauration prévues pour une période déterminée. La situation dépend du produit et du service concernés ; cette page ne limite pas les droits impératifs du client.</p>
        <h2>7. Compte et fidélité</h2>
        <p>La création d’un compte permet notamment de retrouver ses commandes et, si le programme est activé, de consulter ses points et récompenses. Les points, seuils et récompenses suivent les règles visibles dans l’application et peuvent être corrigés en cas d’annulation ou d’opération erronée.</p>
        <h2>8. Droit applicable et contact</h2>
        <p>Les présentes conditions sont destinées à être appliquées au Gabon. Les coordonnées de l’exploitant et du service client doivent être complétées et vérifiées avant publication définitive. Les parties rechercheront d’abord une solution amiable à toute difficulté.</p>
      </>
    )
  },
  privacy: {
    title: 'Politique de confidentialité',
    icon: ShieldCheck,
    intro: 'Comment les informations nécessaires au compte, aux commandes et à la fidélité sont utilisées.',
    content: (
      <>
        <Notice />
        <p><strong>Version de travail — 8 octobre 2026.</strong> Cette politique décrit les traitements visibles dans l’application King Of Tacos. Les coordonnées du responsable du traitement et les durées de conservation restent à confirmer par l’exploitant.</p>
        <h2>Informations traitées</h2>
        <ul>
          <li>Informations de compte : nom, adresse e-mail, téléphone et données de connexion. La connexion Google peut transmettre le nom et l’adresse e-mail associés au compte Google.</li>
          <li>Informations de commande : produits, personnalisations, montant, mode de remise, adresse de livraison, heure souhaitée et instructions fournies.</li>
          <li>Informations liées au service : demandes d’annulation et leur motif, avis publiés, historique de points et de récompenses fidélité.</li>
          <li>Informations techniques nécessaires au fonctionnement, à la sécurité et au maintien de la session.</li>
        </ul>
        <h2>Utilisation</h2>
        <p>Ces informations servent à créer et gérer le compte, préparer et remettre les commandes, contacter le client au sujet d’une commande, traiter les demandes et réclamations, administrer la fidélité et protéger le service contre les erreurs ou les usages abusifs. Les motifs d’annulation peuvent aussi être agrégés pour améliorer le service.</p>
        <h2>Destinataires et prestataires</h2>
        <p>Les informations utiles sont accessibles au personnel autorisé du restaurant. Elles peuvent être traitées par les prestataires techniques indispensables à l’hébergement, à l’authentification ou au paiement lorsqu’un tel service est utilisé. Les informations de paiement sont traitées par le prestataire correspondant ; le site ne doit pas demander au client son code secret Mobile Money.</p>
        <h2>Conservation et demandes</h2>
        <p>Les données sont conservées pendant la durée nécessaire à la gestion des comptes, commandes, obligations de l’exploitant et réclamations. Les durées précises et les coordonnées permettant d’exercer une demande d’accès, de rectification ou d’effacement doivent être confirmées par l’exploitant avant publication.</p>
        <h2>Stockage local et cookies</h2>
        <p>L’application utilise le stockage du navigateur pour des fonctions essentielles, notamment conserver temporairement le panier et maintenir la session. Cette page devra être mise à jour avant l’ajout éventuel d’outils d’analyse d’audience, de publicité ou de cookies non indispensables.</p>
        <h2>Responsable du traitement</h2>
        <p>Responsable : exploitant légal de King Of Tacos — identité, adresse et contact à compléter avant publication définitive.</p>
      </>
    )
  },
  delivery: {
    title: 'Retrait, livraison et annulation',
    icon: Truck,
    intro: 'Informations pratiques correspondant aux options de remise proposées dans le parcours de commande.',
    content: (
      <>
        <Notice />
        <h2>Retrait</h2>
        <p>Choisissez « À emporter » et indiquez, si nécessaire, l’heure souhaitée. Attendez la confirmation ou le suivi de la commande avant de vous déplacer. Le restaurant peut vous contacter au numéro indiqué pour préciser le retrait.</p>
        <h2>Livraison</h2>
        <p>Choisissez « Livraison », renseignez l’adresse complète et restez joignable. Les zones desservies, le délai estimatif et les frais doivent être vérifiés dans le récapitulatif avant confirmation. Une adresse incomplète ou inaccessible peut retarder la remise ; le restaurant vous contactera pour convenir de la suite.</p>
        <h2>Horaires</h2>
        <p>Les commandes en ligne sont soumises aux horaires d’acceptation configurés par le restaurant. Si la planification est proposée hors créneau, la commande peut être programmée au prochain créneau d’ouverture indiqué au client.</p>
        <h2>Annulation et problème de commande</h2>
        <p>Une commande non payée peut être annulée depuis l’espace de suivi lorsqu’elle est encore « En attente ». Un motif est demandé. Pour une commande payée ou déjà en préparation, appelez ou écrivez au restaurant en indiquant le numéro de commande ; l’équipe examinera la demande et toute éventuelle correction ou demande de remboursement.</p>
        <p>En cas d’article manquant, de commande incorrecte ou de problème de qualité, contactez le restaurant dès que possible après réception afin qu’il puisse vérifier les faits et proposer une solution adaptée.</p>
        <h2>Contact</h2>
        <p>Les coordonnées et horaires de contact doivent être confirmés par l’exploitant avant publication de cette page.</p>
      </>
    )
  }
};

function Notice() {
  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <strong>À valider avant publication :</strong> certaines informations d’entreprise et modalités opérationnelles ne sont pas encore connues. Les passages concernés sont explicitement marqués ci-dessous.
    </div>
  );
}

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
