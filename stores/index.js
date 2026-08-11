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
// CHECK PRODUCT RELEVANCE
// ============================================================

function isRelevantProduct(product, query) {

  if (!product) {
    return false;
  }

  const searchText =
    normalizeText(query);

  if (!searchText) {
    return true;
  }

  const productText =
    normalizeText(
      [
        product.name,
        product.title,
        product.description,
        product.category,
        product.brand
      ].join(" ")
    );

  // ----------------------------------------------------------
  // Exact full query
  // ----------------------------------------------------------

  if (
    productText.includes(searchText)
  ) {
    return true;
  }

  // ----------------------------------------------------------
  // Check individual search words
  // ----------------------------------------------------------

  const words =
    searchText
      .split(" ")
      .filter(
        word => word.length >= 2
      );

  if (!words.length) {
    return false;
  }

  // At least one meaningful search word must match
  return words.some(
    word =>
      productText.includes(word)
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
    !Array.isArray(storeResults)
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

async function searchAllStores(query) {

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
        await searchFunction(query);

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

  // ==========================================================
  // REMOVE DUPLICATES
  // ==========================================================

  const uniqueResults = [];

  const seen = new Set();

  for (
    const product
    of results
  ) {

    if (!product) {
      continue;
    }

    const key =
      [
        product.name,
        product.store,
        product.url
      ]
        .join("|")
        .toLowerCase();

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
        Number(a.total);

      const priceB =
        Number(b.total);

      const validA =
        Number.isFinite(priceA) &&
        priceA > 0;

      const validB =
        Number.isFinite(priceB) &&
        priceB > 0;

      if (!validA && !validB) {
        return 0;
      }

      if (!validA) {
        return 1;
      }

      if (!validB) {
        return -1;
      }

      return priceA - priceB;

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

  return Object.keys(stores);

}

// ============================================================
// EXPORT
// ============================================================

module.exports = {

  registerStore,

  searchAllStores,

  getRegisteredStores

};
