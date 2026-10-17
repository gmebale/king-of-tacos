from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image, HRFlowable
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'kot-frontend' / 'public' / 'output' / 'pdf' / 'guide-utilisation-king-of-tacos.pdf'
LOGO = ROOT / 'kot-frontend' / 'public' / 'Images' / 'LOGO-KING-OF-TACOS.jpg'
OUT.parent.mkdir(parents=True, exist_ok=True)

FONT_REG = Path('C:/Windows/Fonts/arial.ttf')
FONT_BOLD = Path('C:/Windows/Fonts/arialbd.ttf')
if FONT_REG.exists() and FONT_BOLD.exists():
    pdfmetrics.registerFont(TTFont('Guide', str(FONT_REG)))
    pdfmetrics.registerFont(TTFont('Guide-Bold', str(FONT_BOLD)))
    FONT, BOLD = 'Guide', 'Guide-Bold'
else:
    FONT, BOLD = 'Helvetica', 'Helvetica-Bold'

GOLD = colors.HexColor('#E9A400')
DARK = colors.HexColor('#172033')
INK = colors.HexColor('#243044')
MUTED = colors.HexColor('#64748B')
PALE = colors.HexColor('#FFF7E3')
LINE = colors.HexColor('#E2E8F0')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverTitle', fontName=BOLD, fontSize=27, leading=33, textColor=DARK, alignment=TA_CENTER, spaceAfter=8))
styles.add(ParagraphStyle(name='CoverSub', fontName=FONT, fontSize=12, leading=18, textColor=MUTED, alignment=TA_CENTER))
styles.add(ParagraphStyle(name='Section', fontName=BOLD, fontSize=19, leading=24, textColor=DARK, spaceBefore=4, spaceAfter=10, keepWithNext=True))
styles.add(ParagraphStyle(name='Subsection', fontName=BOLD, fontSize=12, leading=16, textColor=colors.HexColor('#9A5B00'), spaceBefore=9, spaceAfter=4, keepWithNext=True))
styles.add(ParagraphStyle(name='BodyKOT', fontName=FONT, fontSize=9.3, leading=14, textColor=INK, spaceAfter=5))
styles.add(ParagraphStyle(name='SmallKOT', fontName=FONT, fontSize=8, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name='BulletKOT', fontName=FONT, fontSize=9.2, leading=13.5, textColor=INK, leftIndent=12, firstLineIndent=-8, bulletIndent=0, spaceAfter=3))
styles.add(ParagraphStyle(name='TableHeadKOT', fontName=BOLD, fontSize=8.2, leading=10, textColor=colors.white))
styles.add(ParagraphStyle(name='TableKOT', fontName=FONT, fontSize=8, leading=11, textColor=INK))
styles.add(ParagraphStyle(name='CalloutKOT', fontName=FONT, fontSize=9, leading=13, textColor=DARK))

def P(text, style='BodyKOT'):
    return Paragraph(text, styles[style])

def bullets(items):
    return [P('• ' + item, 'BulletKOT') for item in items]

def heading(title, intro=None):
    out = [P(title, 'Section'), HRFlowable(width='100%', thickness=1.1, color=GOLD, spaceAfter=9)]
    if intro:
        out.append(P(intro))
    return out

def callout(title, text, bg=PALE):
    cell = [P(f'<b>{title}</b><br/>{text}', 'CalloutKOT')]
    t = Table([[cell]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg), ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#F1D28D')),
        ('LEFTPADDING', (0,0), (-1,-1), 10), ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ('TOPPADDING', (0,0), (-1,-1), 8), ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    return t

def make_table(rows, widths):
    data = [[P(str(value), 'TableHeadKOT') for value in rows[0]]]
    for row in rows[1:]:
        data.append([P(str(value), 'TableKOT') for value in row])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK), ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.35, LINE), ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    return t

def page_chrome(canvas, doc):
    canvas.saveState()
    width, height = A4
    if doc.page > 1:
        canvas.setFillColor(DARK)
        canvas.rect(0, height - 13*mm, width, 13*mm, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont(BOLD, 8)
        canvas.drawString(19*mm, height - 8.5*mm, 'KING OF TACOS  /  GUIDE ÉQUIPE')
        canvas.setFillColor(GOLD)
        canvas.rect(0, 0, width, 8*mm, fill=1, stroke=0)
        canvas.setFillColor(DARK)
        canvas.setFont(FONT, 7.5)
        canvas.drawString(19*mm, 3*mm, 'Document interne - Utiliser les droits attribués à votre compte')
        canvas.drawRightString(width - 19*mm, 3*mm, f'{doc.page}')
    canvas.restoreState()

doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=15*mm,
                      title='Guide utilisation - King Of Tacos', author='King Of Tacos')
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')
doc.addPageTemplates([PageTemplate(id='guide', frames=[frame], onPage=page_chrome)])
story = []

# Cover
story.append(Spacer(1, 17*mm))
if LOGO.exists():
    logo = Image(str(LOGO), width=42*mm, height=42*mm, kind='proportional')
    logo.hAlign = 'CENTER'
    story.extend([logo, Spacer(1, 12*mm)])
story.append(P('GUIDE D’UTILISATION', 'CoverTitle'))
story.append(P('Les postes, les procédures et les fonctionnalités de King Of Tacos', 'CoverSub'))
story.append(Spacer(1, 9*mm))
story.append(callout('À qui s’adresse ce guide ?', 'Aux équipes de salle, de caisse, de cuisine, du bar et à la Direction. Les menus et opérations disponibles dépendent toujours des permissions accordées à chaque compte.'))
story.append(Spacer(1, 11*mm))
story.append(P('<b>Dans ce guide</b>', 'Subsection'))
for item in ['Parcours de commande client et commande au comptoir', 'Service, cuisine, bar et caisse', 'Produits, inventaire et finances', 'Comptes, permissions, fidélité, avis et réglages']:
    story.append(P('• ' + item, 'BulletKOT'))
story.append(Spacer(1, 25*mm))
story.append(P('Version du 17 octobre 2026  ·  FCFA', 'CoverSub'))
story.append(PageBreak())

# Getting started and roles
story += heading('1. Accès, postes et règles communes', 'Ouvrez votre session avec le compte attribué. Depuis le profil, utilisez « Accéder à l’administration » si votre compte a au moins un accès opérationnel. Le menu latéral n’affiche que les modules autorisés.')
story.append(P('Les postes ci-dessous décrivent les profils par défaut. La Direction peut ajuster chaque droit individuellement : deux personnes portant le même poste peuvent donc voir des écrans différents.', 'BodyKOT'))
story.append(make_table([
    ['Poste', 'Utilisation principale'],
    ['Serveur', 'Prendre des commandes, ajouter ou modifier les lignes avant envoi, envoyer en préparation, transférer une commande et consulter ses ventes personnelles.'],
    ['Cuisinier', 'Traiter la file cuisine, démarrer et terminer les préparations, consulter les temps et certains outils de stock selon ses droits.'],
    ['Bar', 'Traiter les commandes affectées au poste bar et mettre à jour leur préparation.'],
    ['Caissier', 'Gérer les commandes, encaisser, ouvrir et clôturer une session, compter la caisse et saisir les dépenses autorisées.'],
    ['Responsable de service', 'Superviser le service, les commandes, les paiements, les remises, la caisse, le stock et les rapports prévus par son profil.'],
    ['Manager', 'Consulter et gérer la plupart des opérations et rapports ; certaines actions sensibles restent réservées à la Direction.'],
    ['Administrateur / Direction', 'Gérer les comptes, les permissions, les paramètres et l’ensemble des opérations.']
], [35*mm, 135*mm]))
story.append(Spacer(1, 7))
story.append(callout('Code personnel pour action sensible', 'Lorsqu’une action le demande, saisissez votre code personnel de six lettres ou chiffres. La Direction le définit ou le réinitialise dans Personnel et droits > Modifier un compte. Ne partagez jamais votre code.'))
story.append(P('À retenir', 'Subsection'))
story += bullets([
    'L’accès à un module et le droit d’effectuer une action sont séparés : ouvrir la caisse ne donne pas automatiquement le droit de la clôturer.',
    'Un bouton absent ou une opération refusée signifie généralement que le droit correspondant n’est pas attribué. Contactez la Direction.',
    'Les actions de caisse, les clôtures, les annulations et les remboursements doivent être vérifiés avant validation.'
])
story.append(PageBreak())

# Customer ordering
story += heading('2. Commander depuis le site', 'Le site public permet de consulter la carte et de préparer une commande à emporter, sur place ou en livraison lorsque ces options sont ouvertes.')
story.append(P('Parcours du client', 'Subsection'))
story += bullets([
    'Ouvrir Menu, choisir les produits et sélectionner les options proposées (tailles, suppléments ou formules). Le prix affiché tient compte des choix.',
    'Vérifier le panier, les quantités et le montant, puis poursuivre vers le paiement.',
    'Renseigner le nom et les coordonnées demandés. Une commande invitée ne nécessite pas obligatoirement de compte.',
    'Choisir un moyen de paiement disponible. Les moyens proposés dépendent de la configuration du restaurant et de la commande.',
    'Après validation, conserver le numéro de commande. Le suivi invité se fait avec le numéro de commande et le téléphone utilisé ; un compte connecté retrouve ses commandes dans son espace.'
])
story.append(P('Compte client et profil', 'Subsection'))
story.append(P('Les clients peuvent créer un compte, se connecter, modifier leur nom et téléphone, consulter leurs points de fidélité et retrouver l’historique associé à leur compte. La création d’un compte n’est pas requise pour chaque commande.'))
story.append(P('Livraison', 'Subsection'))
story.append(P('Les frais de livraison peuvent être réglés directement au livreur partenaire. Vérifiez l’adresse, la zone desservie et les consignes de livraison avant de confirmer. Les paramètres publics du restaurant affichent les informations disponibles, mais une zone ou un tarif peut nécessiter une confirmation auprès de l’équipe.'))
story.append(callout('Commande indisponible ?', 'La Direction peut désactiver les commandes en ligne ou définir des jours et heures de prise de commande. En dehors des heures, le site peut fermer la commande ou proposer le prochain créneau selon le réglage choisi.'))
story.append(PageBreak())

# Staff order flow
story += heading('3. Prise de commande et suivi', 'Les commandes en salle et au comptoir sont accessibles depuis Prendre une commande et Commandes, selon les droits du compte.')
story.append(P('Créer une commande de service', 'Subsection'))
story += bullets([
    'Saisir ou associer le client, choisir le type de commande et préciser la table ou le lieu quand demandé.',
    'Ajouter les produits, régler les options obligatoires et vérifier les quantités et le prix total.',
    'Valider la commande puis l’envoyer en cuisine ou au bar. Avant cet envoi, les modifications sont généralement plus simples.',
    'Pour une commande prise par un serveur, un code serveur peut être demandé afin d’attribuer correctement l’opération.'
])
story.append(P('Suivre et faire évoluer les statuts', 'Subsection'))
story.append(make_table([
    ['État / action', 'Ce que cela signifie'],
    ['À traiter / en attente', 'La commande doit être examinée ou transmise au poste de préparation.'],
    ['En préparation', 'La cuisine ou le bar a commencé le travail.'],
    ['Prête', 'Le poste indique que la commande peut être servie ou remise.'],
    ['Servie / récupérée / livrée', 'La remise au client est enregistrée selon le type de commande.'],
    ['Clôturée', 'La commande traitée est clôturée selon le flux autorisé. La clôture de commande est distincte de la clôture de session de caisse.'],
    ['Annulée / remboursée', 'L’opération est annulée ou remboursée ; un motif et une autorisation peuvent être exigés.']
], [43*mm, 127*mm]))
story.append(P('Modifier, transférer ou annuler', 'Subsection'))
story += bullets([
    'Avant envoi en préparation, corrigez les articles, quantités ou choix depuis la commande.',
    'Après envoi, seules les personnes disposant des droits après envoi peuvent modifier, transférer, fusionner ou annuler.',
    'Pour annuler, sélectionnez un motif. Une confirmation par code personnel peut être demandée.',
    'N’utilisez pas une annulation pour corriger un paiement déjà encaissé : suivez le parcours de remboursement autorisé.'
])
story.append(PageBreak())

# Kitchen/bar
story += heading('4. Cuisine et bar', 'Les postes affichent les commandes à préparer. La cuisine peut être séparée en cuisine chaude et cuisine froide ; le bar dispose de sa propre file.')
story.append(P('Routine de préparation', 'Subsection'))
story += bullets([
    'Ouvrir le poste affiché dans le menu latéral et prendre connaissance des nouvelles commandes.',
    'Vérifier les articles, options, quantités, notes et éventuelles allergies ou précisions transmises.',
    'Démarrer la préparation au moment où elle commence, puis terminer chaque préparation lorsqu’elle est prête.',
    'Si une ligne ou une commande pose problème, prévenir le service avant de la marquer prête.',
    'Le temps de préparation peut être consulté uniquement si le compte dispose de l’autorisation correspondante.'
])
story.append(P('Stocks côté production', 'Subsection'))
story.append(P('Selon le profil, un cuisinier peut consulter les produits, déclarer une perte ou réaliser un inventaire. La réception de marchandises et la correction manuelle restent attribuées aux personnes habilitées.'))
story.append(callout('Prêt ne signifie pas remis', 'La cuisine ou le bar marque une préparation prête. Le serveur ou le caissier confirme ensuite le service, le retrait ou la livraison dans le flux de commande.'))
story.append(PageBreak())

# Cashier and payments
story += heading('5. Caisse, encaissements et Mobile Money', 'La caisse suit une session de travail. Les droits d’ouverture, de fond de caisse, de comptage, de dépenses et de clôture sont indépendants.')
story.append(P('Ouvrir une session', 'Subsection'))
story += bullets([
    'Accéder à Caissier et vérifier l’état de la caisse.',
    'Ouvrir une session si elle est fermée. Saisir le fond de caisse uniquement si le droit cash.opening_amount est attribué.',
    'Si le fond de caisse n’est pas autorisé, l’ouverture peut être faite avec le montant prévu par le paramétrage du système.',
    'Une session déjà ouverte peut être consultée sans que le compte ait nécessairement le droit de la clôturer.'
])
story.append(P('Encaisser une commande', 'Subsection'))
story += bullets([
    'Sélectionner la commande et confirmer les articles et le montant avant paiement.',
    'Choisir espèces, carte, Mobile Money ou paiement mixte lorsque le moyen et le droit sont disponibles.',
    'Pour un paiement en espèces, saisir le montant reçu et vérifier la monnaie à rendre.',
    'Réimprimer un ticket seulement avec le droit de réimpression. Un remboursement ou une modification de moyen de paiement validé peut demander une permission renforcée et le code personnel.'
])
story.append(P('Compter et clôturer', 'Subsection'))
story += bullets([
    'Compter le fonds réel par moyen de paiement avec la personne responsable du poste.',
    'Si le droit de consulter le montant théorique est activé, comparer le montant théorique au montant compté.',
    'Enregistrer les écarts et motifs conformément à la procédure interne.',
    'Clôturer la session uniquement avec le droit de clôture. Une session clôturée ne se rouvre pas depuis le parcours normal.'
])
story.append(P('Mobile Money', 'Subsection'))
story.append(P('Le module Mobile Money liste les paiements à vérifier. Contrôlez la commande, la référence et le statut du paiement avant approbation ou rejet. Ne confirmez pas un paiement sur la seule base d’une capture d’écran si le statut officiel n’est pas vérifié.'))
story.append(P('Dépenses de session', 'Subsection'))
story.append(P('Depuis la caisse, un compte doté de cash.expense.record peut enregistrer une dépense liée à la session ouverte. Renseignez le poste, le montant et les produits concernés pour un achat de stock. Les mouvements sont repris dans les rapports.'))
story.append(callout('Réouverture d’urgence', 'La réouverture exceptionnelle d’une caisse clôturée le même jour suit un code d’urgence configuré par la Direction dans Paramètres. Chaque utilisation est journalisée.'))
story.append(PageBreak())

# Stock & products
story += heading('6. Produits, carte et inventaire', 'Le module Stock permet aux personnes autorisées de gérer les produits et leurs disponibilités. Les options et menus peuvent être configurés depuis les fiches produits.')
story.append(P('Catalogue produits', 'Subsection'))
story += bullets([
    'Créer ou modifier les informations du produit : nom, catégorie, description, prix, image, disponibilité et taxes applicables.',
    'Pour une formule ou un produit configurable, renseigner les groupes de choix, les options, le nombre minimum/maximum et les suppléments.',
    'Vérifier les produits liés aux options : une option indisponible peut rendre le choix impossible à la commande.',
    'Désactiver un produit temporairement plutôt que le supprimer lorsque son historique doit être conservé.'
])
story.append(P('Mouvements de stock', 'Subsection'))
story += bullets([
    'Consulter les niveaux actuels et les alertes de stock faible.',
    'Enregistrer une réception lors d’un achat ; pour les produits de stock, indiquer quantités et coûts unitaires si le formulaire les demande.',
    'Déclarer rapidement les pertes ou la casse avec une quantité et un motif exacts.',
    'Faire un inventaire à partir du comptage physique puis enregistrer les écarts selon les droits accordés.',
    'Réserver les corrections manuelles aux personnes habilitées et conserver le justificatif associé.'
])
story.append(P('Prix, remises et disponibilité', 'Subsection'))
story.append(P('Le prix envoyé à la commande est revérifié par le serveur. Si le prix ou les options ont changé, actualisez le panier ou la commande avant de valider. Les remises libres, remises prédéfinies et produits offerts nécessitent des droits différents.'))
story.append(PageBreak())

# Finance, staff
story += heading('7. Finances et dépenses', 'Les rapports visibles dépendent des autorisations de consultation : chiffre d’affaires global, détails de vente, annulations, remises, marges et exports peuvent être gérés séparément.')
story.append(P('Lire les rapports', 'Subsection'))
story += bullets([
    'Choisir une période. Les ventes encaissées sont rattachées à la clôture de la commande ; les commandes annulées ou remboursées sont suivies à leur date de création.',
    'Utiliser les filtres par lieu ou serveur seulement si le droit de détail des ventes est actif.',
    'Le résultat après charges rapproche les ventes hors taxes, les coûts matière et les dépenses d’exploitation. Une quantité non chiffrée peut apparaître si son coût n’est pas disponible.',
    'Les dépenses enregistrées depuis la caisse sont liées à une session ; les anciens historiques restent consultables séparément. Les rapports de caisse peuvent aussi être imprimés ou exportés selon les droits et formats disponibles.'
])
story.append(P('Catalogue de dépenses', 'Subsection'))
story.append(P('La Direction ou les personnes autorisées peuvent ajouter ou désactiver les postes du catalogue. L’enregistrement effectif d’une nouvelle dépense se fait depuis une session de caisse ouverte, et non depuis l’ancien écran d’historique.'))
story.append(P('Personnel et droits d’accès', 'Subsection'))
story += bullets([
    'Dans Personnel, créer et mettre à jour un compte, choisir son rôle, l’activer ou le désactiver.',
    'Dans Personnel et droits, sélectionner le compte puis accorder les modules et actions individuellement.',
    'Un module donne accès à un écran ; les actions comme ouvrir, compter ou clôturer la caisse restent des droits séparés.',
    'Le code personnel des actions sensibles est défini ou réinitialisé par la Direction dans la fiche du compte. Le code n’est pas récupérable en clair après enregistrement.'
])
story.append(PageBreak())

# Settings, loyalty, reviews
story += heading('8. Paramètres, fidélité et avis', 'Ces fonctionnalités de gestion sont réservées aux comptes auxquels la Direction a accordé les accès adaptés.')
story.append(P('Paramètres du restaurant', 'Subsection'))
story += bullets([
    'Informations : nom, coordonnées, adresse et informations affichées au public.',
    'Commandes en ligne : activation générale, jours ouverts, heure d’ouverture, dernière heure de commande et comportement hors horaires.',
    'Lieux de service : créer, activer ou désactiver les lieux proposés pour les commandes sur place.',
    'Taxes : maintenir les taux applicables. Les commandes enregistrées conservent leur calcul historique.',
    'Moyens de paiement : activer les options qui sont réellement opérationnelles.',
    'Bannière d’accueil : téléverser un média, ajuster le contenu et enregistrer les modifications après téléversement.',
    'Code d’urgence de caisse : le configurer et le conserver dans un emplacement sûr, réservé à la Direction.'
])
story.append(P('Fidélité et promotions', 'Subsection'))
story += bullets([
    'Configurer les niveaux et seuils de points ; les seuils sont évalués selon le solde actuel du client.',
    'Créer les récompenses disponibles : remise, produit offert ou autre avantage prévu par l’écran.',
    'Attribuer ou corriger des points avec un motif ; consulter ensuite le journal des ajustements.',
    'Créer des codes promo avec type, valeur, minimum de commande, limite d’utilisation, expiration et état actif.',
    'Le client connecté consulte ses points et ses récompenses ; une récompense réclamée peut être soumise à une expiration.'
])
story.append(P('Avis et retours clients', 'Subsection'))
story.append(P('Le module Avis permet de consulter les avis soumis et de gérer leur statut. Vérifiez le contenu avant publication ou masquage. Les avis Google externes ne sont pas automatiquement synchronisés par ce module, sauf si une intégration dédiée a été configurée.'))
story.append(PageBreak())

# Troubleshooting
story += heading('9. Résoudre les situations courantes')
story.append(make_table([
    ['Situation', 'À vérifier / action conseillée'],
    ['Je ne vois pas un module', 'Vérifier que le compte est actif puis demander à la Direction l’accès au module voulu.'],
    ['Le module s’ouvre, mais une action est refusée', 'Demander le droit précis de l’action ; l’accès au module ne l’accorde pas automatiquement.'],
    ['Un code personnel est demandé', 'Saisir le code à six caractères attribué par la Direction. Si le compte n’en a pas, la Direction l’initialise ou le réinitialise dans Personnel > Modifier.'],
    ['La commande ne peut pas être envoyée', 'Vérifier les options obligatoires, les produits indisponibles, le prix actualisé, le code serveur ou l’ouverture requise de la caisse.'],
    ['Le paiement n’apparaît pas comme confirmé', 'Vérifier la transaction dans le moyen de paiement et le module Mobile Money avant toute nouvelle tentative ou remise de commande.'],
    ['La caisse ne peut pas être clôturée', 'Confirmer que cash.close_session est accordé ; compter la caisse si demandé. Le code personnel ne remplace pas le droit de clôture.'],
    ['Un produit ne peut pas être choisi', 'Contrôler disponibilité, stock, configuration des groupes et disponibilité de chaque option.'],
    ['Un rapport ne montre pas les chiffres attendus', 'Vérifier les dates, le statut encaissé, le lieu/serveur sélectionné et les permissions de ventes globales ou détaillées.']
], [53*mm, 117*mm]))
story.append(P('Bonnes pratiques', 'Subsection'))
story += bullets([
    'Ne partagez ni mot de passe, ni code personnel, ni code d’urgence.',
    'Avant de confirmer une opération irréversible, relisez son bénéficiaire, son montant et son motif.',
    'Signalez rapidement les erreurs ou doublons à la Direction ; évitez de répéter une opération de paiement tant que son état est incertain.',
    'En fin de service, transmettez les écarts de caisse et incidents de stock selon la procédure interne.'
])
story.append(Spacer(1, 12))
story.append(callout('Besoin d’aide ?', 'Contactez la Direction en indiquant le module, l’heure, le numéro de commande ou de session concerné et le message affiché. Ne transmettez pas de mot de passe ni de code personnel.'))

doc.build(story)
print(OUT)

