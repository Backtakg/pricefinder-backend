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
      product.type
    ].join(" ")
  );
}

// ============================================================
// PRODUCT CATEGORY DETECTION
// ============================================================

function detectProductCategory(product) {
  const text =
    getProductText(product);

  // ----------------------------------------------------------
  // SMARTPHONES / MOBILE PHONES
  // ----------------------------------------------------------

  if (
    /\b(
      smartphone|
      smart phone|
      mobile phone|
      mobile|
      smartphone phone|
      android phone|
      iphone|
      iphone|
      galaxy|
      pixel|
      redmi|
      poco|
      oneplus|
      oppo|
      vivo|
      realme|
      infinix|
      tecno|
      nothing phone|
      motorola|
      nokia|
      honor|
      xiaomi phone|
      samsung phone
    )\b/ix.test(text)
  ) {
    return "phone";
  }

  // ----------------------------------------------------------
  // HEADPHONES
  // ----------------------------------------------------------

  if (
    /\b(
      headphone|
      headphones|
      headset|
      gaming headset|
      over ear|
      over ear headphone|
      wireless headphone
    )\b/ix.test(text)
  ) {
    return "headphone";
  }

  // ----------------------------------------------------------
  // EARPHONES / EARBUDS
  // ----------------------------------------------------------

  if (
    /\b(
      earphone|
      earphones|
      earbuds|
      earbud|
      tws|
      in ear|
      in ear headphone|
      airpods|
      buds
    )\b/ix.test(text)
  ) {
    return "earphone";
  }

  // ----------------------------------------------------------
  // LAPTOP
  // ----------------------------------------------------------

  if (
    /\b(
      laptop|
      notebook|
      macbook|
      chromebook|
      gaming laptop
    )\b/ix.test(text)
  ) {
    return "laptop";
  }

  // ----------------------------------------------------------
  // DESKTOP / COMPUTER
  // ----------------------------------------------------------

  if (
    /\b(
      desktop|
      desktop computer|
      pc|
      personal computer|
      gaming pc|
      all in one|
      aio computer
    )\b/ix.test(text)
  ) {
    return "computer";
  }

  // ----------------------------------------------------------
  // TABLET
  // ----------------------------------------------------------

  if (
    /\b(
      tablet|
      ipad|
      galaxy tab|
      mi pad|
      xiaomi pad|
      redmi pad
    )\b/ix.test(text)
  ) {
    return "tablet";
  }

  // ----------------------------------------------------------
  // SMARTWATCH
  // ----------------------------------------------------------

  if (
    /\b(
      smartwatch|
      smart watch|
      smartband|
      fitness band|
      watch
    )\b/ix.test(text)
  ) {
    return "watch";
  }

  // ----------------------------------------------------------
  // MONITOR
  // ----------------------------------------------------------

  if (
    /\b(
      monitor|
      display|
      computer monitor|
      gaming monitor
    )\b/ix.test(text)
  ) {
    return "monitor";
  }

  // ----------------------------------------------------------
  // KEYBOARD
  // ----------------------------------------------------------

  if (
    /\b(
      keyboard|
      mechanical keyboard|
      gaming keyboard
    )\b/ix.test(text)
  ) {
    return "keyboard";
  }

  // ----------------------------------------------------------
  // MOUSE
  // ----------------------------------------------------------

  if (
    /\b(
      mouse|
      wireless mouse|
      gaming mouse
    )\b/ix.test(text)
  ) {
    return "mouse";
  }

  // ----------------------------------------------------------
  // POWER BANK
  // ----------------------------------------------------------

  if (
    /\b(
      powerbank|
      power bank|
      portable charger
    )\b/ix.test(text)
  ) {
    return "powerbank";
  }

  // ----------------------------------------------------------
  // CHARGER
  // ----------------------------------------------------------

  if (
    /\b(
      charger|
      charging adapter|
      power adapter|
      adapter
    )\b/ix.test(text)
  ) {
    return "charger";
  }

  // ----------------------------------------------------------
  // ROUTER
  // ----------------------------------------------------------

  if (
    /\b(
      router|
      wifi router|
      wi fi router|
      wireless router|
      modem
    )\b/ix.test(text)
  ) {
    return "router";
  }

  // ----------------------------------------------------------
  // PRINTER
  // ----------------------------------------------------------

  if (
    /\b(
      printer|
      laser printer|
      inkjet|
      scanner
    )\b/ix.test(text)
  ) {
    return "printer";
  }

  // ----------------------------------------------------------
  // CAMERA
  // ----------------------------------------------------------

  if (
    /\b(
      camera|
      digital camera|
      mirrorless|
      dslr|
      webcam|
      action camera
    )\b/ix.test(text)
  ) {
    return "camera";
  }

  // ----------------------------------------------------------
  // TV
  // ----------------------------------------------------------

  if (
    /\b(
      television|
      tv|
      smart tv|
      led tv|
      oled tv|
      qled tv
    )\b/ix.test(text)
  ) {
    return "tv";
  }

  // ----------------------------------------------------------
  // STORAGE
  // ----------------------------------------------------------

  if (
    /\b(
      ssd|
      nvme|
      hard drive|
      hdd|
      external hard drive|
      usb drive|
      flash drive|
      memory card|
      microsd|
      sd card
    )\b/ix.test(text)
  ) {
    return "storage";
  }

  // ----------------------------------------------------------
  // RAM
  // ----------------------------------------------------------

  if (
    /\b(
      ram|
      memory module|
      ddr4|
      ddr5
    )\b/ix.test(text)
  ) {
    return "ram";
  }

  // ----------------------------------------------------------
  // GRAPHICS CARD
  // ----------------------------------------------------------

  if (
    /\b(
      graphics card|
      gpu|
      geforce|
      rtx|
      gtx|
      radeon
    )\b/ix.test(text)
  ) {
    return "gpu";
  }

  // ----------------------------------------------------------
  // PROCESSOR
  // ----------------------------------------------------------

  if (
    /\b(
      processor|
      cpu|
      core i3|
      core i5|
      core i7|
      core i9|
      ryzen|
      threadripper
    )\b/ix.test(text)
  ) {
    return "cpu";
  }

  return "other";
}

// ============================================================
// QUERY CATEGORY DETECTION
// ============================================================

function detectQueryCategory(query) {
  const text =
    normalizeText(query);

  // Phone must be checked BEFORE generic "phone"
  // substring matching.
  if (
    /\b(
      phone|
      smartphone|
      smart phone|
      mobile|
      mobile phone|
      android phone|
      iphone|
      iphone
    )\b/.test(text)
  ) {
    return "phone";
  }

  if (
    /\b(
      headphone|
      headphones|
      headset
    )\b/.test(text)
  ) {
    return "headphone";
  }

  if (
    /\b(
      earphone|
      earphones|
      earbuds|
      earbud|
      tws|
      airpods
    )\b/.test(text)
  ) {
    return "earphone";
  }

  if (
    /\b(
      laptop|
      notebook|
      macbook|
      chromebook
    )\b/.test(text)
  ) {
    return "laptop";
  }

  if (
    /\b(
      desktop|
      computer|
      pc
    )\b/.test(text)
  ) {
    return "computer";
  }

  if (
    /\b(
      tablet|
      ipad|
      galaxy tab|
      mi pad
    )\b/.test(text)
  ) {
    return "tablet";
  }

  if (
    /\b(
      smartwatch|
      smart watch|
      smartband|
      watch
    )\b/.test(text)
  ) {
    return "watch";
  }

  if (
    /\b(
      monitor|
      display
    )\b/.test(text)
  ) {
    return "monitor";
  }

  if (
    /\b(
      keyboard
    )\b/.test(text)
  ) {
    return "keyboard";
  }

  if (
    /\b(
      mouse
    )\b/.test(text)
  ) {
    return "mouse";
  }

  if (
    /\b(
      powerbank|
      power bank|
      portable charger
    )\b/.test(text)
  ) {
    return "powerbank";
  }

  if (
    /\b(
      charger|
      charging adapter
    )\b/.test(text)
  ) {
    return "charger";
  }

  if (
    /\b(
      router|
      modem|
      wifi|
      wi fi
    )\b/.test(text)
  ) {
    return "router";
  }

  if (
    /\b(
      printer|
      scanner
    )\b/.test(text)
  ) {
    return "printer";
  }

  if (
    /\b(
      camera|
      webcam|
      dslr|
      mirrorless
    )\b/.test(text)
  ) {
    return "camera";
  }

  if (
    /\b(
      tv|
      television|
      smart tv
    )\b/.test(text)
  ) {
    return "tv";
  }

  if (
    /\b(
      ssd|
      nvme|
      hdd|
      hard drive|
      memory card|
      sd card|
      usb drive
    )\b/.test(text)
  ) {
    return "storage";
  }

  if (
    /\b(
      ram|
      ddr4|
      ddr5
    )\b/.test(text)
  ) {
    return "ram";
  }

  if (
    /\b(
      gpu|
      graphics card|
      rtx|
      gtx|
      radeon
    )\b/.test(text)
  ) {
    return "gpu";
  }

  if (
    /\b(
      cpu|
      processor|
      ryzen|
      intel
    )\b/.test(text)
  ) {
    return "cpu";
  }

  return "other";
}

// ============================================================
// CHECK PRODUCT RELEVANCE
// ============================================================

function isRelevantProduct(
  product,
  query
) {
  if (!product) {
    return false;
  }

  const searchText =
    normalizeText(query);

  if (!searchText) {
    return true;
  }

  const productText =
    getProductText(product);

  const queryCategory =
    detectQueryCategory(query);

  const productCategory =
    detectProductCategory(product);

  // ==========================================================
  // CATEGORY-BASED FILTERING
  // ==========================================================

  // If the user searched for a specific category,
  // the product must belong to that category.
  if (
    queryCategory !== "other"
  ) {

    if (
      productCategory !==
      queryCategory
    ) {
      return false;
    }

  }

  // ==========================================================
  // EXACT FULL QUERY
  // ==========================================================

  if (
    productText.includes(
      searchText
    )
  ) {
    return true;
  }

  // ==========================================================
  // MULTI-WORD SEARCH
  // ==========================================================

  const words =
    searchText
      .split(" ")
      .filter(
        word =>
          word.length >= 2
      );

  if (
    !words.length
  ) {
    return false;
  }

  // For a specific category, category
  // filtering above already protects us.
  //
  // For normal searches, require ALL meaningful
  // search words instead of only one.
  return words.every(
    word =>
      productText.includes(
        word
      )
  );
}

// ============================================================
// FILTER STORE RESULTS
// ============================================================

function filterResults(
  storeResults,
  query,
  storeName
) {
  if (
    !Array.isArray(
      storeResults
    )
  ) {
    return [];
  }

  const filtered =
    storeResults.filter(
      product =>
        isRelevantProduct(
          product,
          query
        )
    );

  console.log(
    `[${storeName}] ${storeResults.length} found → ${filtered.length} relevant`
  );

  return filtered;
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
    "Query category:",
    detectQueryCategory(query)
  );

  console.log(
    "=========================================="
  );

  // ==========================================================
  // SEARCH EVERY STORE
  // ==========================================================

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

    } catch (
      error
    ) {

      console.error(
        `[${storeName}] Search failed:`,
        error.message
      );

    }
  }

  // ==========================================================
  // REMOVE DUPLICATES
  // ==========================================================

  const uniqueResults =
    [];

  const seen =
    new Set();

  for (
    const product
    of results
  ) {

    if (!product) {
      continue;
    }

    const key =
      [
        normalizeText(
          product.name
        ),
        normalizeText(
          product.store
        ),
        product.url || ""
      ]
        .join("|");

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

  // ==========================================================
  // SORT BY PRICE
  // ==========================================================

  uniqueResults.sort(
    (a, b) => {

      const priceA =
        Number(
          a.total
        );

      const priceB =
        Number(
          b.total
        );

      const validA =
        Number.isFinite(
          priceA
        ) &&
        priceA > 0;

      const validB =
        Number.isFinite(
          priceB
        ) &&
        priceB > 0;

      if (
        !validA &&
        !validB
      ) {
        return 0;
      }

      if (
        !validA
      ) {
        return 1;
      }

      if (
        !validB
      ) {
        return -1;
      }

      return (
        priceA -
        priceB
      );
    }
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
  getRegisteredStores
};
```
