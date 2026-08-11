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
  // Run stores one by one
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
        `\n[${storeName}] Starting search...`
      );

      const storeResults =
        await searchFunction(query);

      // ------------------------------------------------------
      // Validate results
      // ------------------------------------------------------

      if (
        Array.isArray(storeResults)
      ) {

        results.push(
          ...storeResults
        );

        console.log(
          `[${storeName}] ✓ ${storeResults.length} results`
        );

      } else {

        console.log(
          `[${storeName}] ⚠ Invalid result`
        );

      }

    } catch (error) {

      // ------------------------------------------------------
      // Store failure should NOT stop other stores
      // ------------------------------------------------------

      console.error(
        `[${storeName}] ✗ Search failed:`,
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
  // COMPLETE
  // ==========================================================

  console.log(
    "\n=========================================="
  );

  console.log(
    `Total results: ${uniqueResults.length}`
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
