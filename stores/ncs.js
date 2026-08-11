const axios = require("axios");
const cheerio = require("cheerio");

async function searchNCS(searchTerm) {
  console.log(`NCS: searching for "${searchTerm}"`);

  return searchStore(
    "NCS",
    "https://www.nepalcomputer.com.np",
    searchTerm
  );
}

async function searchStore(store, baseUrl, searchTerm) {
  try {
    const response = await axios.get(
      `${baseUrl}/?s=${encodeURIComponent(searchTerm)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36"
        },
        timeout: 20000
      }
    );

    const $ = cheerio.load(response.data);
    const results = [];

    $("article, .product, .product-item, .card").each(
      (i, el) => {
        const item = $(el);

        const name =
          item.find(
            "h2,h3,h4,.product-title,.product-name"
          ).first().text().trim();

        const priceText =
          item.find(
            ".price,.product-price,[class*='price']"
          ).first().text();

        const match =
          priceText.match(/[\d,]+/);

        if (!name || !match) return;

        const price =
          Number(match[0].replace(/,/g, ""));

        if (!price) return;

        const href =
          item.find("a[href]").first().attr("href");

        results.push({
          name,
          store,
          price,
          shipping: 0,
          total: price,
          availability: "Check store",
          url: href || baseUrl,
          image:
            item.find("img").first().attr("src") ||
            null,
          source: store,
          lastUpdated: new Date().toISOString()
        });
      }
    );

    console.log(
      `NCS: returning ${results.length} results`
    );

    return results.slice(0, 20);

  } catch (error) {
    console.error(
      `NCS search error: ${error.message}`
    );

    return [];
  }
}

module.exports = searchNCS;
