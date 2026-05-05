/**
 * Random email address generator
 * Generates human-friendly addresses like: neon-voi-42@kurumi.vn
 */

const ADJECTIVES = [
  // English
  'silent', 'swift', 'dark', 'neon', 'frost', 'iron', 'solar', 'lunar',
  'cyber', 'ghost', 'wild', 'cool', 'bold', 'free', 'deep', 'sharp',
  'bright', 'calm', 'keen', 'nova', 'pure', 'sage', 'azure', 'crisp',
  'dusk', 'echo', 'flux', 'glow', 'haze', 'jade', 'lime', 'mist',
  'opal', 'pine', 'rose', 'snow', 'storm', 'void', 'amber', 'cobalt',
  // Vietnamese-flavored (ASCII-safe for email)
  'xanh', 'hong', 'vang', 'trang', 'den', 'tim', 'cam', 'nau',
  'sang', 'toi', 'nhanh', 'cham', 'manh', 'nhe', 'cao', 'thap',
];

const NOUNS = [
  // Animals (English)
  'fox', 'wolf', 'hawk', 'bear', 'lynx', 'crow', 'stag', 'seal',
  'orca', 'puma', 'ibis', 'wren', 'finch', 'pike', 'dove', 'lark',
  'crane', 'heron', 'robin', 'mink', 'vole', 'newt', 'moth', 'fawn',
  'ram', 'doe', 'buck', 'colt', 'foal', 'calf', 'koi', 'carp',
  // Vietnamese animals (ASCII-safe)
  'voi', 'cop', 'nai', 'tho', 'ga', 'vit', 'cho', 'meo',
  'ca', 'chim', 'ran', 'ech', 'khi', 'lon', 'trau', 'ngua',
];

const DOMAINS = (process.env.MAIL_DOMAINS || 'kurumi.vn,hopthu.vn,mailtam.vn,nhanh.vn')
  .split(',')
  .map((d) => d.trim());

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random email address
 * @param {string|null} domain - specific domain or null for random
 * @returns {{ local: string, domain: string, address: string }}
 */
function generateAddress(domain = null) {
  const adj = randomChoice(ADJECTIVES);
  const noun = randomChoice(NOUNS);
  const num = randomInt(10, 9999);
  const local = `${adj}-${noun}-${num}`;
  const dom = domain && DOMAINS.includes(domain) ? domain : randomChoice(DOMAINS);
  return {
    local,
    domain: dom,
    address: `${local}@${dom}`,
  };
}

/**
 * Validate that an address belongs to a supported domain
 * @param {string} address
 * @returns {boolean}
 */
function isValidDomain(address) {
  const parts = address.split('@');
  if (parts.length !== 2) return false;
  return DOMAINS.includes(parts[1]);
}

/**
 * Validate local part format
 * @param {string} local
 * @returns {boolean}
 */
function isValidLocal(local) {
  // Allow alphanumeric, dots, hyphens, underscores, 3-40 chars
  return /^[a-z0-9][a-z0-9._-]{1,38}[a-z0-9]$/i.test(local);
}

module.exports = {
  generateAddress,
  isValidDomain,
  isValidLocal,
  DOMAINS,
};
