// Open Food Facts country tags (en:<slug>) for the 27 EU member states.
// Source: https://world.openfoodfacts.org/countries
export const EU_COUNTRY_TAGS = new Set([
  'en:austria', 'en:belgium', 'en:bulgaria', 'en:croatia', 'en:cyprus',
  'en:czech-republic', 'en:czechia', 'en:denmark', 'en:estonia', 'en:finland',
  'en:france', 'en:germany', 'en:greece', 'en:hungary', 'en:ireland',
  'en:italy', 'en:latvia', 'en:lithuania', 'en:luxembourg', 'en:malta',
  'en:netherlands', 'en:poland', 'en:portugal', 'en:romania', 'en:slovakia',
  'en:slovenia', 'en:spain', 'en:sweden'
]);

// Tags that directly assert EU membership without naming a specific country.
export const EU_GENERIC_TAGS = new Set([
  'en:european-union', 'en:eu'
]);

const DISPLAY_NAMES = {
  'en:austria': 'Áustria', 'en:belgium': 'Bélgica', 'en:bulgaria': 'Bulgária',
  'en:croatia': 'Croácia', 'en:cyprus': 'Chipre', 'en:czech-republic': 'Chéquia',
  'en:czechia': 'Chéquia', 'en:denmark': 'Dinamarca', 'en:estonia': 'Estónia',
  'en:finland': 'Finlândia', 'en:france': 'França', 'en:germany': 'Alemanha',
  'en:greece': 'Grécia', 'en:hungary': 'Hungria', 'en:ireland': 'Irlanda',
  'en:italy': 'Itália', 'en:latvia': 'Letónia', 'en:lithuania': 'Lituânia',
  'en:luxembourg': 'Luxemburgo', 'en:malta': 'Malta', 'en:netherlands': 'Países Baixos',
  'en:poland': 'Polónia', 'en:portugal': 'Portugal', 'en:romania': 'Roménia',
  'en:slovakia': 'Eslováquia', 'en:slovenia': 'Eslovénia', 'en:spain': 'Espanha',
  'en:sweden': 'Suécia'
};

export function euCountryDisplayName(tag) {
  return DISPLAY_NAMES[tag] || tag.replace(/^en:/, '');
}

export function isEuTag(tag) {
  return EU_COUNTRY_TAGS.has(tag) || EU_GENERIC_TAGS.has(tag);
}
