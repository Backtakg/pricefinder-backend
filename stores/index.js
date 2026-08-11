```js
// ============================================================
// STORE REGISTRY
// ============================================================

const stores = {};

// ============================================================
// REGISTER STORE
// ============================================================

function registerStore(name, searchFunction) {

  if (
    !name ||
    typeof searchFunction !== "function"
  ) {

    console.error(
      `Invalid store registration: ${name}`
    );

    return;
  }

  stores[name] = searchFunction;

  console.log(
    `Store registered: ${name}`
  );
}

// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText(value) {

  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

}

// ============================================================
// GET PRODUCT TEXT
// ============================================================

function getProductText(product) {

  return normalizeText(
    [
      product.name,
      product.title,
      product.description,
      product.category,
      product.brand,
      product.type,
      product.productType
    ].join(" ")
  );

}

// ============================================================
// WORD TOKENIZER
// ============================================================

function tokenize(value) {

  return normalizeText(value)
    .split(" ")
    .filter(
      word =>
        word.length >= 2
    );

}

// ============================================================
// PRODUCT CATEGORY DEFINITIONS
// ============================================================

const CATEGORY_RULES = {

  // ----------------------------------------------------------
  // PHONES
  // ----------------------------------------------------------

  phone: {

    aliases: [
      "phone",
      "phones",
      "mobile",
      "mobiles",
      "smartphone",
      "smartphones",
      "mobile phone",
      "mobile phones"
    ],

    positive: [

      "iphone",
      "galaxy",
      "redmi",
      "poco",
      "xiaomi",
      "pixel",
      "oneplus",
      "realme",
      "oppo",
      "vivo",
      "tecno",
      "infinix",
      "motorola",
      "nothing phone",
      "smartphone",
      "mobile phone",
      "mobile"

    ],

    negative: [

      "headphone",
      "headphones",
      "earphone",
      "earphones",
      "earbud",
      "earbuds",
      "airpod",
      "airpods",
      "speaker",
      "speakers",
      "power bank",
      "powerbank",
      "charger",
      "charging cable",
      "usb cable",
      "phone case",
      "mobile case",
      "phone cover",
      "mobile cover",
      "screen protector",
      "tempered glass",
      "phone holder",
      "mobile holder",
      "phone stand",
      "mobile stand",
      "phone tripod",
      "phone mount",
      "tablet",
      "ipad",
      "smartwatch",
      "smart watch"

    ]

  },

  // ----------------------------------------------------------
  // LAPTOPS
  // ----------------------------------------------------------

  laptop: {

    aliases: [
      "laptop",
      "laptops",
      "notebook",
      "notebooks"
    ],

    positive: [

      "laptop",
      "notebook",
      "macbook",
      "thinkpad",
      "ideapad",
      "vivobook",
      "zenbook",
      "aspire",
      "inspiron",
      "latitude",
      "precision",
      "pavilion",
      "envy",
      "spectre",
      "omen",
      "legion",
      "nitro",
      "tuf gaming",
      "rog",
      "chromebook"

    ],

    negative: [

      "laptop bag",
      "laptop backpack",
      "laptop sleeve",
      "laptop stand",
      "laptop cooler",
      "cooling pad",
      "laptop skin",
      "laptop case",
      "laptop charger",
      "laptop adapter",
      "laptop table",
      "laptop desk"

    ]

  },

  // ----------------------------------------------------------
  // TABLETS
  // ----------------------------------------------------------

  tablet: {

    aliases: [
      "tablet",
      "tablets",
      "ipad",
      "ipads"
    ],

    positive: [

      "tablet",
      "ipad",
      "galaxy tab",
      "redmi pad",
      "xiaomi pad",
      "lenovo tab",
      "tab s"

    ],

    negative: [

      "tablet case",
      "tablet cover",
      "tablet stand",
      "tablet keyboard",
      "tablet screen protector",
      "tablet holder",
      "tablet bag"

    ]

  },

  // ----------------------------------------------------------
  // HEADPHONES
  // ----------------------------------------------------------

  headphone: {

    aliases: [
      "headphone",
      "headphones",
      "headset",
      "headsets"
    ],

    positive: [

      "headphone",
      "headphones",
      "headset",
      "gaming headset",
      "wireless headset",
      "bluetooth headset"

    ],

    negative: [

      "headphone stand",
      "headphone case",
      "headphone cover",
      "headphone cable"

    ]

  },

  // ----------------------------------------------------------
  // EARBUDS
  // ----------------------------------------------------------

  earbuds: {

    aliases: [
      "earbud",
      "earbuds",
      "earphone",
      "earphones",
      "tws"
    ],

    positive: [

      "earbud",
      "earbuds",
      "earphone",
      "earphones",
      "tws",
      "airpods",
      "galaxy buds",
      "redmi buds",
      "nothing ear",
      "oneplus buds"

    ],

    negative: [

      "earbud case",
      "earbuds case",
      "earphone case",
      "earphone cable",
      "replacement earbud"

    ]

  },

  // ----------------------------------------------------------
  // SMARTWATCH
  // ----------------------------------------------------------

  smartwatch: {

    aliases: [
      "watch",
      "watches",
      "smartwatch",
      "smartwatches",
      "smart watch",
      "smart watches"
    ],

    positive: [

      "smartwatch",
      "smart watch",
      "apple watch",
      "galaxy watch",
      "redmi watch",
      "xiaomi watch",
      "amazfit",
      "garmin",
      "fitbit"

    ],

    negative: [

      "watch strap",
      "watch band",
      "watch case",
      "watch protector",
      "watch charger",
      "watch stand",
      "watch holder"

    ]

  },

  // ----------------------------------------------------------
  // TV
  // ----------------------------------------------------------

  tv: {

    aliases: [
      "tv",
      "television",
      "televisions",
      "smart tv",
      "smart tvs"
    ],

    positive: [

      "tv",
      "television",
      "smart tv",
      "android tv",
      "google tv",
      "oled tv",
      "qled tv",
      "led tv"

    ],

    negative: [

      "tv stand",
      "tv wall mount",
      "tv mount",
      "tv remote",
      "tv remote control",
      "tv box",
      "android tv box",
      "tv cable",
      "tv antenna",
      "tv cover"

    ]

  },

  // ----------------------------------------------------------
  // MONITOR
  // ----------------------------------------------------------

  monitor: {

    aliases: [
      "monitor",
      "monitors",
      "computer monitor",
      "display"
    ],

    positive: [

      "monitor",
      "computer monitor",
      "gaming monitor",
      "display",
      "ultrawide monitor",
      "curved monitor"

    ],

    negative: [

      "monitor stand",
      "monitor arm",
      "monitor mount",
      "monitor light",
      "monitor riser",
      "monitor cover"

    ]

  },

  // ----------------------------------------------------------
  // KEYBOARD
  // ----------------------------------------------------------

  keyboard: {

    aliases: [
      "keyboard",
      "keyboards"
    ],

    positive: [

      "keyboard",
      "mechanical keyboard",
      "gaming keyboard",
      "wireless keyboard",
      "bluetooth keyboard"

    ],

    negative: [

      "keyboard cover",
      "keyboard skin",
      "keyboard case",
      "keyboard wrist rest",
      "keyboard stand"

    ]

  },

  // ----------------------------------------------------------
  // MOUSE
  // ----------------------------------------------------------

  mouse: {

    aliases: [
      "mouse",
      "mice",
      "computer mouse"
    ],

    positive: [

      "mouse",
      "wireless mouse",
      "gaming mouse",
      "computer mouse",
      "bluetooth mouse"

    ],

    negative: [

      "mouse pad",
      "mousepad",
      "mouse mat",
      "mouse bungee",
      "mouse grip"

    ]

  },

  // ----------------------------------------------------------
  // CAMERA
  // ----------------------------------------------------------

  camera: {

    aliases: [
      "camera",
      "cameras",
      "digital camera",
      "dslr"
    ],

    positive: [

      "camera",
      "dslr",
      "mirrorless camera",
      "digital camera",
      "action camera",
      "webcam",
      "security camera",
      "cctv camera"

    ],

    negative: [

      "camera bag",
      "camera case",
      "camera strap",
      "camera tripod",
      "camera mount",
      "camera lens cap",
      "camera protector"

    ]

  },

  // ----------------------------------------------------------
  // PRINTER
  // ----------------------------------------------------------

  printer: {

    aliases: [
      "printer",
      "printers"
    ],

    positive: [

      "printer",
      "laser printer",
      "inkjet printer",
      "multifunction printer",
      "all in one printer",
      "thermal printer"

    ],

    negative: [

      "printer ink",
      "printer cartridge",
      "printer toner",
      "printer paper",
      "printer cable",
      "printer stand"

    ]

  },

  // ----------------------------------------------------------
  // CHARGER
  // ----------------------------------------------------------

  charger: {

    aliases: [
      "charger",
      "chargers",
      "phone charger",
      "mobile charger"
    ],

    positive: [

      "charger",
      "charging adapter",
      "power adapter",
      "wall charger",
      "fast charger",
      "usb charger",
      "wireless charger"

    ],

    negative: [

      "charging cable",
      "usb cable",
      "data cable",
      "phone cable",
      "power bank",
      "powerbank",
      "charger case"

    ]

  },

  // ----------------------------------------------------------
  // POWER BANK
  // ----------------------------------------------------------

  powerbank: {

    aliases: [
      "power bank",
      "powerbank",
      "power banks"
    ],

    positive: [

      "power bank",
      "powerbank",
      "portable charger",
      "portable power bank"

    ],

    negative: [

      "power bank case",
      "powerbank case",
      "power bank cable"

    ]

  }

};

// ============================================================
// DETECT CATEGORY
// ============================================================

function detectCategory(query) {

  const normalized =
    normalizeText(query);

  for (
    const [
      category,
      rule
    ]
    of Object.entries(
      CATEGORY_RULES
    )
  ) {

    for (
      const alias
      of rule.aliases
    ) {

      const normalizedAlias =
        normalizeText(alias);

      if (
        normalized ===
        normalizedAlias
      ) {

        return category;

      }

    }

  }

  return null;

}

// ============================================================
// CHECK WHOLE PHRASE
// ============================================================

function containsPhrase(
  text,
  phrase
) {

  const normalizedText =
    ` ${normalizeText(text)} `;

  const normalizedPhrase =
    ` ${normalizeText(phrase)} `;

  return normalizedText.includes(
    normalizedPhrase
  );

}

// ============================================================
// CHECK CATEGORY RELEVANCE
// ============================================================

function categoryMatches(
  productText,
  category
) {

  const rule =
    CATEGORY_RULES[category];

  if (!rule) {

    return {
      matched: false,
      score: 0,
      excluded: false
    };

  }

  // ----------------------------------------------------------
  // EXCLUDED PRODUCT
  // ----------------------------------------------------------

  for (
    const negative
    of rule.negative
  ) {

    if (
      containsPhrase(
        productText,
        negative
      )
    ) {

      return {

        matched: false,

        score: -1000,

        excluded: true

      };

    }

  }

  // ----------------------------------------------------------
  // POSITIVE MATCH
  // ----------------------------------------------------------

  let score = 0;

  let matched = false;

  for (
    const positive
    of rule.positive
  ) {

    if (
      containsPhrase(
        productText,
        positive
      )
    ) {

      matched = true;

      // Longer/more specific phrases
      // receive more weight.
      score +=
        20 +
        normalizeText(
          positive
        ).split(" ").length * 5;

    }

  }

  return {

    matched,

    score,

    excluded: false

  };

}

// ============================================================
// CALCULATE PRODUCT SCORE
// ============================================================

function calculateRelevance(
  product,
  query
) {

  if (!product) {

    return {
      relevant: false,
      score: -Infinity,
      category: null
    };

  }

  const normalizedQuery =
    normalizeText(query);

  if (!normalizedQuery) {

    return {
      relevant: true,
      score: 0,
      category: null
    };

  }

  const productName =
    normalizeText(
      [
        product.name,
        product.title
      ].join(" ")
    );

  const productText =
    getProductText(product);

  const queryWords =
    tokenize(
      normalizedQuery
    );

  // ----------------------------------------------------------
  // DETECT SPECIAL CATEGORY
  // ----------------------------------------------------------

  const category =
    detectCategory(
      normalizedQuery
    );

  // ----------------------------------------------------------
  // CATEGORY SEARCH
  // ----------------------------------------------------------

  if (category) {

    const categoryResult =
      categoryMatches(
        productText,
        category
      );

    if (
      categoryResult.excluded
    ) {

      return {

        relevant: false,

        score:
          categoryResult.score,

        category

      };

    }

    if (
      !categoryResult.matched
    ) {

      return {

        relevant: false,

        score: -100,

        category

      };

    }

    return {

      relevant: true,

      score:
        categoryResult.score,

      category

    };

  }

  // ----------------------------------------------------------
  // EXACT PRODUCT NAME
  // ----------------------------------------------------------

  if (
    productName ===
    normalizedQuery
  ) {

    return {

      relevant: true,

      score: 1000,

      category: null

    };

  }

  // ----------------------------------------------------------
  // FULL QUERY IN PRODUCT NAME
  // ----------------------------------------------------------

  if (
    containsPhrase(
      productName,
      normalizedQuery
    )
  ) {

    return {

      relevant: true,

      score: 800,

      category: null

    };

  }

  // ----------------------------------------------------------
  // WORD MATCHING
  // ----------------------------------------------------------

  let matchedWords = 0;

  let nameMatches = 0;

  for (
    const word
    of queryWords
  ) {

    if (
      containsPhrase(
        productName,
        word
      )
    ) {

      matchedWords++;

      nameMatches++;

      continue;

    }

    if (
      containsPhrase(
        productText,
        word
      )
    ) {

      matchedWords++;

    }

  }

  // ----------------------------------------------------------
  // ALL SEARCH WORDS MUST MATCH
  // ----------------------------------------------------------

  if (
    matchedWords ===
    queryWords.length
  ) {

    return {

      relevant: true,

      score:
        400 +
        nameMatches * 50,

      category: null

    };

  }

  // ----------------------------------------------------------
  // MULTI-WORD QUERY
  //
  // Do not return a product merely because
  // one word happens to match.
  // ----------------------------------------------------------

  if (
    queryWords.length > 1
  ) {

    const percentage =
      matchedWords /
      queryWords.length;

    if (
      percentage >= 0.5 &&
      nameMatches > 0
    ) {

      return {

        relevant: true,

        score:
          200 +
          matchedWords * 30 +
          nameMatches * 50,

        category: null

      };

    }

    return {

      relevant: false,

      score: 0,

      category: null

    };

  }

  // ----------------------------------------------------------
  // SINGLE WORD SEARCH
  // ----------------------------------------------------------

  if (
    queryWords.length === 1 &&
    matchedWords === 1
  ) {

    return {

      relevant: true,

      score:
        nameMatches > 0
          ? 250
          : 100,

      category: null

    };

  }

  return {

    relevant: false,

    score: 0,

    category: null

  };

}

// ============================================================
// CHECK PRODUCT RELEVANCE
// ============================================================

function isRelevantProduct(
  product,
  query
) {

  const result =
    calculateRelevance(
      product,
      query
    );

  return result.relevant;

}

// ============================================================
// FILTER + SCORE STORE RESULTS
// ============================================================

function filterResults(
  storeResults,
  query,
  storeName
) {

  if (
    !Array.isArray(storeResults)
  ) {

    console.log(
      `[${storeName}] invalid results`
    );

    return [];

  }

  const filtered = [];

  for (
    const product
    of storeResults
  ) {

    const relevance =
      calculateRelevance(
        product,
        query
      );

    if (
      relevance.relevant
    ) {

      filtered.push({

        ...product,

        _relevanceScore:
          relevance.score,

        _matchedCategory:
          relevance.category

      });

    }

  }

  // ----------------------------------------------------------
  // SORT RELEVANCE WITHIN STORE
  // ----------------------------------------------------------

  filtered.sort(
    (a, b) =>
      b._relevanceScore -
      a._relevanceScore
  );

  console.log(
    `[${storeName}] ${storeResults.length} found → ${filtered.length} relevant`
  );

  return filtered;

}

// ============================================================
// REMOVE DUPLICATES
// ============================================================

function removeDuplicates(
  results
) {

  const uniqueResults = [];

  const seen = new Set();

  for (
    const product
    of results
  ) {

    if (!product) {
      continue;
    }

    const name =
      normalizeText(
        product.name ||
        product.title
      );

    const store =
      normalizeText(
        product.store ||
        product.source
      );

    const url =
      String(
        product.url ||
        product.link ||
        ""
      )
        .trim()
        .toLowerCase();

    const key =
      url
        ? `${store}|${url}`
        : `${store}|${name}`;

    if (
      seen.has(key)
    ) {

      continue;

    }

    seen.add(key);

    uniqueResults.push(
      product
    );

  }

  return uniqueResults;

}

// ============================================================
// REMOVE INTERNAL FIELDS
// ============================================================

function cleanResults(
  results
) {

  return results.map(
    product => {

      const cleaned = {
        ...product
      };

      delete cleaned._relevanceScore;

      delete cleaned._matchedCategory;

      return cleaned;

    }
  );

}

// ============================================================
// SEARCH ALL STORES
// ============================================================

async function searchAllStores(
  query
) {

  const results = [];

  console.log(
    "=========================================="
  );

  console.log(
    `Searching ${Object.keys(stores).length} stores for "${query}"`
  );

  console.log(
    "=========================================="
  );

  // ----------------------------------------------------------
  // SEARCH EVERY STORE
  // ----------------------------------------------------------

  for (
    const [
      storeName,
      searchFunction
    ]
    of Object.entries(stores)
  ) {

    try {

      console.log(
        `\n[${storeName}] Searching for "${query}"...`
      );

      const storeResults =
        await searchFunction(
          query
        );

      const relevantResults =
        filterResults(
          storeResults,
          query,
          storeName
        );

      results.push(
        ...relevantResults
      );

    } catch (error) {

      console.error(
        `[${storeName}] Search failed:`,
        error.message
      );

    }

  }

  // ----------------------------------------------------------
  // REMOVE DUPLICATES
  // ----------------------------------------------------------

  let uniqueResults =
    removeDuplicates(
      results
    );

  // ----------------------------------------------------------
  // GLOBAL SORT
  //
  // Relevance first.
  // Price second.
  // ----------------------------------------------------------

  uniqueResults.sort(
    (a, b) => {

      const relevanceA =
        Number(
          a._relevanceScore
        ) || 0;

      const relevanceB =
        Number(
          b._relevanceScore
        ) || 0;

      // Strong relevance difference
      if (
        relevanceA !==
        relevanceB
      ) {

        return (
          relevanceB -
          relevanceA
        );

      }

      // ------------------------------------------------------
      // Same relevance → lowest price first
      // ------------------------------------------------------

      const priceA =
        Number(
          a.total
        );

      const priceB =
        Number(
          b.total
        );

      const validA =
        Number.isFinite(priceA) &&
        priceA > 0;

      const validB =
        Number.isFinite(priceB) &&
        priceB > 0;

      if (
        !validA &&
        !validB
      ) {

        return 0;

      }

      if (!validA) {

        return 1;

      }

      if (!validB) {

        return -1;

      }

      return (
        priceA -
        priceB
      );

    }
  );

  // ----------------------------------------------------------
  // CLEAN INTERNAL FIELDS
  // ----------------------------------------------------------

  uniqueResults =
    cleanResults(
      uniqueResults
    );

  // ==========================================================
  // COMPLETE
  // ==========================================================

  console.log(
    "\n=========================================="
  );

  console.log(
    `Total relevant results: ${uniqueResults.length}`
  );

  console.log(
    "=========================================="
  );

  return uniqueResults;

}

// ============================================================
// GET REGISTERED STORES
// ============================================================

function getRegisteredStores() {

  return Object.keys(
    stores
  );

}

// ============================================================
// EXPORT
// ============================================================

module.exports = {

  registerStore,

  searchAllStores,

  getRegisteredStores,

  // Useful if you want to test
  // individual products later.
  isRelevantProduct

};
```
