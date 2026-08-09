const stores = {};

function registerStore(name, searchFunction) {
  stores[name] = searchFunction;
}

async function searchAllStores(query) {
  const results = [];

  for (const [storeName, searchFunction] of Object.entries(stores)) {
    try {
      const storeResults = await searchFunction(query);

      if (Array.isArray(storeResults)) {
        results.push(...storeResults);
      }

    } catch (error) {
      console.error(`${storeName} search failed:`, error);
    }
  }

  return results;
}

module.exports = {
  registerStore,
  searchAllStores
};
