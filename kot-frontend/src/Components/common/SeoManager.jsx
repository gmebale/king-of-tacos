import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://kingoftacos.com';
const SHARE_IMAGE = `${SITE_URL}/Images/LOGO-KING-OF-TACOS.jpg`;

const publicPages = {
  '/': {
    title: 'Fast-food à Libreville | King Of Tacos',
    description: 'Fast-food à Libreville : tacos français, burgers et repas King Of Tacos. Découvrez le menu et commandez en ligne en retrait ou en livraison selon disponibilité.'
  },
  '/menu': {
    title: 'Menu fast-food à Libreville | Tacos et burgers King Of Tacos',
    description: 'Découvrez le menu de notre fast-food à Libreville : tacos, burgers, burritos, accompagnements, boissons et desserts. Personnalisez votre commande en ligne.'
  },
  '/mentions-legales': {
    title: 'Mentions légales | King Of Tacos',
    description: 'Informations sur l’éditeur et l’hébergement du site King Of Tacos.'
  },
  '/conditions-generales': {
    title: 'Conditions générales de commande | King Of Tacos',
    description: 'Consultez les conditions de commande, de paiement, de retrait, de livraison et d’annulation de King Of Tacos.'
  },
  '/confidentialite': {
    title: 'Politique de confidentialité | King Of Tacos',
    description: 'Découvrez comment King Of Tacos utilise les informations nécessaires aux comptes, commandes et au programme de fidélité.'
  },
  '/livraison-annulation': {
    title: 'Retrait, livraison et annulation | King Of Tacos',
    description: 'Informations pratiques sur le retrait, la livraison et l’annulation des commandes King Of Tacos.'
  }
};

const noIndexPrefixes = [
  '/cart', '/checkout', '/payment', '/order-success', '/orders-page', '/profile',
  '/login', '/register', '/admin'
];

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

export default function SeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    const page = publicPages[normalizedPath];
    const canonical = `${SITE_URL}${normalizedPath}`;
    const shouldNoIndex = !page || noIndexPrefixes.some(prefix => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
    const title = page?.title || 'King Of Tacos';
    const description = page?.description || 'Commandez en ligne auprès de King Of Tacos.';

    document.documentElement.lang = 'fr';
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', shouldNoIndex ? 'noindex,follow' : 'index,follow');
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', 'King Of Tacos');
    setMeta('property', 'og:locale', 'fr_GA');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:image', SHARE_IMAGE);
    setMeta('name', 'twitter:card', 'summary');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', SHARE_IMAGE);
    setLink('canonical', canonical);

    const structuredDataId = 'kot-organization-schema';
    let structuredData = document.getElementById(structuredDataId);
    if (normalizedPath === '/') {
      if (!structuredData) {
        structuredData = document.createElement('script');
        structuredData.id = structuredDataId;
        structuredData.type = 'application/ld+json';
        document.head.appendChild(structuredData);
      }
      structuredData.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name: 'King Of Tacos',
        url: SITE_URL,
        logo: SHARE_IMAGE,
        image: SHARE_IMAGE,
        telephone: '+24162937292',
        email: 'kingoftacoslbv@gmail.com',
        servesCuisine: ['French tacos', 'Mexican', 'Fast food'],
        address: { '@type': 'PostalAddress', streetAddress: 'Camp de Gaulle, section VH1, Impasse des Paletuviers N64', addressLocality: 'Libreville', addressRegion: 'Estuaire', addressCountry: 'GA' },
        hasMenu: `${SITE_URL}/menu`,
        areaServed: { '@type': 'City', name: 'Libreville' }
      });
    } else {
      structuredData?.remove();
    }
  }, [pathname]);

  return null;
}
