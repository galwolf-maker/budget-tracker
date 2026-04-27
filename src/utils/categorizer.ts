/**
 * Keyword-based auto-categorizer for merchant names extracted from statements.
 * Rules are evaluated in order; first match wins.
 * Add entries to RULES to improve accuracy.
 */

interface CategoryRule {
  category: string;
  keywords: string[];
}

const RULES: CategoryRule[] = [
  {
    category: 'Food',
    keywords: [
      'starbucks', "mcdonald's", 'mcdonalds', 'mcdonald', 'burger king',
      "wendy's", 'wendys', 'subway', "domino's", 'dominos', 'pizza hut',
      "papa john's", 'papa johns', 'chipotle', 'panera', 'taco bell',
      'chick-fil-a', 'chick fil a', 'popeyes', 'kfc', 'dunkin',
      'tim horton', 'five guys', 'shake shack', 'in-n-out', 'wingstop',
      'panda express', 'olive garden', "applebee's", "applebees", "chili's",
      "denny's", 'dennys', 'ihop', 'waffle house', 'jersey mike',
      'jimmy john', 'firehouse subs', 'potbelly', 'whataburger',
      'sonic drive', 'culver', 'raising cane', "jack in the box",
      'doordash', 'grubhub', 'uber eat', 'ubereats', 'postmates',
      'seamless', 'instacart', 'gopuff', 'wolt', 'ten bis', 'tenbis',
      'whole foods', 'wholefds', 'safeway', 'kroger', 'aldi', 'trader joe',
      'publix', 'wegmans', 'sprouts', 'fresh market', 'food lion',
      'harris teeter', 'meijer', 'hyvee', 'hy-vee',
      'restaurant', 'cafe', 'bistro', 'kitchen', 'grill', 'diner',
      'sushi', 'ramen', 'thai', 'chinese', 'indian', 'taproom', 'brewery',
      // Israeli merchants
      'רמי לוי', 'שופרסל', 'יינות ביתן', 'מגה', 'ויקטורי', 'AM:PM',
      'am pm', 'cofix', 'קופיקס', 'aroma', 'ארומה', 'café café', 'cafe cafe',
      'roladin', 'רולדין', 'dr. lek', 'dr lek', 'pizza hut israel',
    ],
  },
  {
    category: 'Transport',
    keywords: [
      'uber', 'lyft', 'grab', 'taxi', 'yellow cab',
      'metro', 'mta', 'bart', 'cta', 'septa', 'wmata', 'mbta',
      'amtrak', 'greyhound', 'megabus', 'flixbus',
      'delta', 'united air', 'american air', 'southwest air', 'jetblue',
      'spirit airlines', 'frontier airlines', 'alaska air',
      'shell', 'bp ', ' bp', 'exxon', 'mobil', 'chevron', 'sunoco',
      'speedway', 'circle k', 'wawa', 'casey', 'marathon petro',
      'gulf oil', 'valero', 'pilot flying', 'love travel',
      'parking', 'parkwhiz', 'spothero', 'lazerspot',
      'enterprise rent', 'hertz', 'avis', 'budget rent', 'national car',
      'alamo', 'zipcar', 'turo',
      'toll ', 'ezpass', 'e-zpass', 'fastrak', 'sunpass',
      // Israeli
      'רב-קו', 'rav kav', 'ravkav', 'אגד', 'egged', 'dan ', 'דן ',
      'רכבת ישראל', 'israel railways', 'נתיבי ישראל', 'dor alon', 'דור אלון',
      'paz ', 'פז ', 'sonol', 'סונול', 'ten', 'טן ', 'menta', 'מנטה',
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'netflix', 'hulu', 'spotify', 'apple.com/bill', 'itunes',
      'disney', 'hbo', 'amazon prime', 'amazon video', 'prime video',
      'youtube', 'twitch', 'crunchyroll', 'peacock', 'paramount',
      'discovery plus', 'sling tv', 'fubo', 'directv', 'apple tv',
      'amc theatre', 'regal cinema', 'cinemark', 'imax',
      'ticketmaster', 'stubhub', 'eventbrite', 'seatgeek', 'vivid seat',
      'playstation', 'xbox', 'nintendo', 'steam ', 'epic game',
      'gamestop', 'best buy game',
      'bowling', 'escape room', 'mini golf', 'arcade', 'dave & buster',
      'topgolf', 'laser tag',
      // Israeli
      'yes ', 'hot ', 'cellcom tv', 'partner tv', 'sting tv',
      'yes planet', 'סינמה סיטי', 'cinema city', 'lev cinema', 'לב סינמה',
    ],
  },
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'amzn', 'walmart', 'target', 'best buy', 'costco',
      'ebay', 'etsy', 'aliexpress', 'temu ', 'shein', 'wish ',
      'gap ', 'h&m', 'zara', 'nike', 'adidas', 'under armour', 'lululemon',
      'tjmaxx', 'tj maxx', 'marshalls', 'homegoods', 'ross store',
      'burlington', 'old navy', 'banana republic', 'j.crew', 'jcrew',
      'anthropologie', 'urban outfitter', 'forever 21', 'hollister',
      'nordstrom', "macy's", 'macys', 'bloomingdale', 'saks', 'neiman',
      'kohls', "kohl's", 'jcpenney', 'dillard',
      'ikea', 'home depot', 'lowes', 'bed bath', 'crate and barrel',
      'pottery barn', 'williams sonoma', 'restoration hardware',
      'apple store', 'microsoft store',
      'chewy', 'petco', 'petsmart',
      'dollar tree', 'dollar general', 'family dollar', 'five below',
      // Israeli
      'ksp', 'קי.אס.פי', 'ivory', 'איוורי', 'bug', 'באג', 'castro',
      'קסטרו', 'fox ', 'פוקס', 'terminalx', 'next', 'נקסט', 'golf',
      'גולף', 'ace hardware', 'ace ישראל', 'home center', 'הום סנטר',
      'ikea israel', 'איקאה',
    ],
  },
  {
    category: 'Health',
    keywords: [
      'cvs', 'walgreen', 'rite aid', 'duane reade', 'pharmacy', 'rx ',
      'urgent care', 'hospital', 'medical center', 'health system',
      'dental', 'dentist', 'orthodont', 'optometr', 'ophthalmol',
      'vision ', 'eye care', 'eye exam',
      'doctor', 'dr.', 'clinic', 'labcorp', 'quest diagnostic',
      'planet fitness', 'anytime fitness', 'la fitness', 'gold gym',
      '24 hour fitness', 'crunch fitness', 'equinox', 'ymca', 'blink fitness',
      'yoga', 'pilates', 'crossfit', 'orangetheory',
      'gnc', 'vitamin shoppe', 'supplement',
      'insurance premium', 'health ins',
      // Israeli
      'מכבי', 'maccabi', 'קופת חולים', 'clalit', 'כללית', 'leumit', 'לאומית',
      'super-pharm', 'סופר פארם', 'be pharmacy', 'גודפארמה', 'goodpharm',
      'holmes place', 'הולמס פלייס', 'gold gym israel', 'mcfit',
    ],
  },
  {
    category: 'Rent',
    keywords: [
      'rent payment', 'rental payment', 'apartment', 'lease payment',
      'property management',
      'con ed', 'comed', 'pge ', 'pg&e', 'duke energy', 'dominion energy',
      'national grid', 'entergy', 'xcel energy',
      'water bill', 'electric bill', 'utility',
      'comcast', 'xfinity', 'verizon fios', 'spectrum ', 'cox comm',
      'optimum online', 'att internet', 'centurylink', 'frontier comm',
      // Israeli
      'חברת חשמל', 'iec ', 'מקורות', 'mekorot', 'hot mobile', 'פרטנר',
      'partner ', 'cellcom', 'סלקום', 'yes mobile', '019 mobile',
      'bezeq', 'בזק', 'hot net', ' 012', ' 013', 'irt ', 'irm ',
    ],
  },
  {
    category: 'Freelance',
    keywords: [
      'paypal transfer', 'venmo payment', 'zelle payment', 'cash app',
      'stripe payout', 'square payout', 'wise transfer',
      'upwork', 'fiverr', 'toptal', 'freelancer',
    ],
  },
];

// ── Hebrew sector (ענף) → English category ──────────────────────────────────
// These are the standard sector codes used by Israeli credit card issuers
// (Leumi Card / Max, Cal, Isracard, Visa Cal, etc.).

const HEBREW_SECTOR_MAP: Record<string, string> = {
  // Food
  'מסעדות': 'Food',
  'מסעדות ובתי קפה': 'Food',
  'בתי קפה': 'Food',
  'קפה': 'Food',
  'בתי אוכל': 'Food',
  'מזון ומשקאות': 'Food',
  'סופרמרקט': 'Food',
  'מרכולים': 'Food',
  'חנויות מזון': 'Food',
  'חנויות מזון ומרכולים': 'Food',
  'מכולות': 'Food',
  'קיוסקים': 'Food',
  'מאפיות': 'Food',
  'ממתקים וחטיפים': 'Food',

  // Transport
  'תחבורה': 'Transport',
  'תחבורה ציבורית': 'Transport',
  'תחבורה ושינוע': 'Transport',
  'גז ודלק': 'Transport',
  'תחנות דלק': 'Transport',
  'דלק': 'Transport',
  'חניה': 'Transport',
  'חניונים': 'Transport',
  'השכרת רכב': 'Transport',
  'רכב': 'Transport',
  'מוסכים': 'Transport',
  'חלפים לרכב': 'Transport',
  'טיסות': 'Transport',
  'תעופה': 'Transport',
  'נסיעות': 'Transport',
  'סוכנויות נסיעות': 'Transport',

  // Entertainment
  'בילוי': 'Entertainment',
  'בילוי ופנאי': 'Entertainment',
  'תרבות': 'Entertainment',
  'תרבות ובידור': 'Entertainment',
  'ספורט ופנאי': 'Entertainment',
  'ספורט': 'Entertainment',
  'קולנוע': 'Entertainment',
  'תיאטרון': 'Entertainment',
  'אמנות': 'Entertainment',
  'מוזיקה': 'Entertainment',
  'מלונות': 'Entertainment',
  'מלונות ואירוח': 'Entertainment',
  'מלונות ונופש': 'Entertainment',
  'נופש': 'Entertainment',
  'טיולים': 'Entertainment',

  // Shopping
  'קניות': 'Shopping',
  'ביגוד': 'Shopping',
  'ביגוד והנעלה': 'Shopping',
  'הנעלה': 'Shopping',
  'ריהוט': 'Shopping',
  'ריהוט ועיצוב': 'Shopping',
  'עיצוב הבית': 'Shopping',
  'כלי בית': 'Shopping',
  'חשמל ואלקטרוניקה': 'Shopping',
  'אלקטרוניקה': 'Shopping',
  'מחשבים': 'Shopping',
  'טלפונים': 'Shopping',
  'בית ומשק': 'Shopping',
  'ספרים': 'Shopping',
  'משחקים וצעצועים': 'Shopping',
  'תכשיטים': 'Shopping',
  'מתנות': 'Shopping',
  'חנויות כלבו': 'Shopping',
  'מרכזי קניות': 'Shopping',

  // Health
  'בריאות': 'Health',
  'בריאות וסטייל': 'Health',
  'בריאות ויופי': 'Health',
  'רפואה': 'Health',
  'תרופות': 'Health',
  'בתי מרקחת': 'Health',
  'תרופות ובתי מרקחת': 'Health',
  'ספא ויופי': 'Health',
  'ספא': 'Health',
  'יופי': 'Health',
  'מספרות': 'Health',
  'כושר': 'Health',
  'חדרי כושר': 'Health',
  'אופטיקה': 'Health',
  'רופאים': 'Health',
  'מרפאות': 'Health',
  'בתי חולים': 'Health',

  // Rent / Utilities
  'תקשורת': 'Rent',
  'טלפון': 'Rent',
  'אינטרנט': 'Rent',
  'טלויזיה': 'Rent',
  'דיור': 'Rent',
  'שירותי דיור': 'Rent',
  'ארנונה': 'Rent',
  'חשמל': 'Rent',
  'מים': 'Rent',
  'גז ביתי': 'Rent',
  'ביטוח': 'Rent',

  // Other
  'בנקים': 'Other',
  'בנקים ומוסדות פיננסים': 'Other',
  'מוסדות פיננסים': 'Other',
  'מוסדות ממשלתיים': 'Other',
  'חינוך': 'Other',
  'לימודים': 'Other',
  'תשלומי מסים': 'Other',
  'שירותים': 'Other',
  'שונות': 'Other',
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the best matching category for a merchant name.
 * Checks learned merchant rules first, then keyword rules.
 * Falls back to 'Other' if nothing matches.
 */
export function categorize(
  merchantName: string,
  available: string[],
  learnedRules?: Record<string, string>
): string {
  const lower = merchantName.toLowerCase().trim().replace(/\s+/g, ' ');

  if (learnedRules) {
    const learned = learnedRules[lower];
    if (learned && available.includes(learned)) return learned;
  }

  for (const rule of RULES) {
    if (!available.includes(rule.category)) continue;
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }

  return available.includes('Other') ? 'Other' : (available[0] ?? 'Other');
}

/**
 * Maps a Hebrew sector name (ענף) — as it appears in Israeli bank CSV exports —
 * to one of our English category names.
 *
 * Falls back to keyword-matching the sector string against the standard RULES,
 * then to 'Other'.
 */
export function categorizeFromSector(
  hebrewSector: string,
  available: string[],
  learnedRules?: Record<string, string>
): string {
  const trimmed = hebrewSector.trim();

  // 1. Direct lookup in the sector map
  const direct = HEBREW_SECTOR_MAP[trimmed];
  if (direct && available.includes(direct)) return direct;

  // 2. Partial match — e.g. "מסעדות ובתי קפה - ירושלים" still matches "מסעדות"
  for (const [key, cat] of Object.entries(HEBREW_SECTOR_MAP)) {
    if (trimmed.includes(key) && available.includes(cat)) return cat;
  }

  // 3. Fall back to keyword matching (covers transliterated / English sector names)
  return categorize(trimmed, available, learnedRules);
}
