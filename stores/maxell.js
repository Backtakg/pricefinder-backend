const axios = require("axios");
const cheerio = require("cheerio");

async function searchMaxell(searchTerm) {
  return searchGeneric(
    "Maxell",
    "https://maxell.com.np",
    searchTerm
  );
}

async function searchGeneric(store, baseUrl, searchTerm) {
  console.log(`${store}: searching for "${searchTerm}"`);

  try {
    const url =
      `${baseUrl}/?s=${encodeURIComponent(searchTerm)}`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36"
      },
      timeout: 20000
    });

    const $ = cheerio.load(response.data);
    const results = [];

    $("a").each((i, el) => {
      const link = $(el).attr("href");
      const name = $(el).text().replace(/\s+/g, " ").trim();

      if (!link || !name) return;

      if (
        name.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        const parent = $(el).closest(
          "article, .product, .product-item, .card"
        );

        const text = parent.length
          ? parent.text()
          : $(el).parent().text();

        const match = text.match(
          /(?:Rs\.?|NPR|रु\.?)\s*[\d,]+/i
        );

        if (!match) return;

        const price =
          Number(
            match[0]
              .replace(/[^\d]/g, "")
          );

        if (!price) return;

        results.push({
          name,
          store,
          price,
          shipping: 0,
          total: price,
          availability: "Check store",
          url: link.startsWith("http")
            ? link
            : baseUrl + link,
          image: null,
          source: store,
          lastUpdated: new Date().toISOString()
        });
      }
    });

    console.log(
      `${store}: returning ${results.length} results`
    );

    return results.slice(0, 20);

  } catch (error) {
    console.error(
      `${store} search error:`,
      error.message
    );

    return [];
  }
}

module.exports = searchMaxell;
