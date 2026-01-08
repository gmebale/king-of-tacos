// Utility functions for handling product customizations

/**
 * Parse and format customization selections for display
 * @param {Object} customization - The customization JSON from order item
 * @param {Object} productCustomization - The product's customization config (optional)
 * @returns {string} Formatted customization summary
 */
export function formatCustomization(customization, productCustomization = null) {
  if (!customization || typeof customization !== 'object') {
    return '';
  }

  const parts = [];

  // Check if it's the flat tacos customization format
  if (customization.size || customization.selectedMeats || customization.sauces) {
    // Handle tacos customization
    if (customization.size) {
      const sizeNames = {
        'S': 'SOLO',
        'M': 'DOBLE',
        'L': 'TRIO',
        'XL': 'PATRON'
      };
      parts.push(`Taille: ${sizeNames[customization.size] || customization.size}`);
    }

    if (customization.selectedMeats && customization.selectedMeats.length > 0) {
      parts.push(`Viandes: ${customization.selectedMeats.join(', ')}`);
    }

    if (customization.sauces && customization.sauces.length > 0) {
      const sauceNames = {
        'algerienne': 'Algérienne',
        'blanche': 'Blanche',
        'harissa': 'Harissa',
        'ketchup': 'Ketchup',
        'mayonnaise': 'Mayonnaise',
        'bbq': 'BBQ',
        'samourai': 'Samouraï',
        'curry': 'Curry'
      };
      const sauceDisplay = customization.sauces.map(id => sauceNames[id] || id).join(', ');
      parts.push(`Sauces: ${sauceDisplay}`);
    }

    if (customization.extras && customization.extras.length > 0) {
      const extraNames = {
        'frites_simple': 'Frites simple',
        'frites_cheddar': 'Frites au cheddar',
        'frites_paprika': 'Frites au paprika',
        'alloco': 'Alloco',
        'riz_blanc': 'Riz Blanc',
        'oeuf': 'Oeuf',
        'poulet_pane': 'Poulet Pané',
        'poulet_braise': 'Poulet Braisé',
        'cordon_bleu': 'Cordon Bleu',
        'boeuf_marine': 'Boeuf mariné',
        'des_poisson': 'Dés de poisson',
        'crevettes_marinees': 'Crevettes marinées'
      };
      const extraDisplay = customization.extras.map(id => extraNames[id] || id).join(', ');
      parts.push(`Extras: ${extraDisplay}`);
    }

    if (customization.gratin) {
      parts.push('Gratiné');
    }
  } else if (productCustomization && productCustomization.optionGroups) {
    // Handle standard customization with groups
    productCustomization.optionGroups.forEach(group => {
      let selection = customization[group.id];

      // If no selection made, use defaults
      if (!selection || (Array.isArray(selection) && selection.length === 0)) {
        if (group.type === 'single') {
          const defaultOption = group.options.find(opt => opt.default);
          if (defaultOption) {
            selection = defaultOption.id;
          }
        } else if (group.type === 'multiple') {
          // For multiple, defaults are not typically used, but we can show included items
          selection = [];
        }
      }

      if (selection) {
        const selectedOptions = [];

        if (group.type === 'single' && typeof selection === 'string') {
          const option = group.options.find(opt => opt.id === selection);
          if (option) {
            selectedOptions.push(option.name);
          }
        } else if (group.type === 'multiple' && Array.isArray(selection)) {
          selection.forEach(optionId => {
            const option = group.options.find(opt => opt.id === optionId);
            if (option) {
              selectedOptions.push(option.name);
            }
          });
        }

        if (selectedOptions.length > 0) {
          parts.push(`${group.name}: ${selectedOptions.join(', ')}`);
        }
      }
    });
  } else {
    // Fallback: display raw selections
    Object.entries(customization).forEach(([groupId, selection]) => {
      if (Array.isArray(selection)) {
        parts.push(`${groupId}: ${selection.join(', ')}`);
      } else if (typeof selection === 'string') {
        parts.push(`${groupId}: ${selection}`);
      }
    });
  }

  return parts.join(' | ');
}

/**
 * Get customization summary for cart/reorder purposes
 * @param {Object} customization - The customization JSON
 * @param {Object} productCustomization - The product's customization config
 * @returns {string} Summary string
 */
export function getCustomizationSummary(customization, productCustomization) {
  return formatCustomization(customization, productCustomization);
}
