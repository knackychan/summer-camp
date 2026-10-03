// Kitchen Quest v0.6.0 core, imported from the user-supplied source.
// TypeScript transpiled to ES2019 modules; gameplay rules preserved.
export const INGREDIENTS = ['patty', 'cheese', 'tomato', 'lettuce', 'pickles', 'sauce'];
export const ALL_INGREDIENTS = [...INGREDIENTS, 'lasagna'];
export const MATERIALS = {
    patty: { label: 'Patty', thickness: 39, weight: 1.0, softness: .35, color: '#ab5a37', accent: '#f6dfbf', word: 'THUP!' },
    cheese: { label: 'Cheese', thickness: 13, weight: .36, softness: 1, color: '#f7be3f', accent: '#fff0b8', word: 'FLOUP!' },
    tomato: { label: 'Tomato', thickness: 25, weight: .65, softness: .68, color: '#ed7060', accent: '#ffe0d0', word: 'PLIP!' },
    lettuce: { label: 'Lettuce', thickness: 21, weight: .24, softness: 1.2, color: '#70b986', accent: '#e0f1bc', word: 'FRFF!' },
    pickles: { label: 'Pickle', thickness: 12, weight: .34, softness: .65, color: '#86a757', accent: '#eff2c5', word: 'POP!' },
    lasagna: { label: 'Lasagna', thickness: 68, weight: 1.1, softness: .55, color: '#dfa34d', accent: '#ffe9b3', word: 'YUM!' },
    sauce: { label: 'Sauce', thickness: 7, weight: .2, softness: .85, color: '#dc6551', accent: '#f9d5bf', word: 'SPLOUIT!' }
};
