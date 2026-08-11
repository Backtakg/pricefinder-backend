const axios = require("axios");
const cheerio = require("cheerio");

async function searchMudita(searchTerm) {
  console.log(
    `Mudita Store: searching for "${searchTerm}"`
  );

  try {
    const url =
      `https://mudita.com.np/?s=${encodeURIComponent(searchTerm)}`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36"
      },
      timeout: 20000
    });

    const $ = cheerio.load(response.data);
    const results = [];

    $("article, .product, .product-item, .card").each(
      (i, el) => {
        const item = $(el);

        const name =
          item.find(
            "h2,h3,h4,.product-title,.product-name"
          ).first().text().trim();

        const text = item.text();

        const match =
          text.match(
            /(?:NPR|Rs\.?|रु\.?)\s*[\d,]+/i
          );

        if (!name || !match) return;

        const price =
          Number(
            match[0].replace(/[^\d]/g, "")
          );

        if (!price) return;

        results.push({
          name,
          store: "Mudita Store",
          price,
          shipping: 0,
          total: price,
          availability: "Check store",
          url:
            item.find("a[href]").first().attr("href") ||
            url,
          image:
            item.find("img").first().attr("src") ||
            null,
          source: "Mudita Store",
          lastUpdated: new Date().toISOString()
        });
      }
    );

    return results.slice(0, 20);

  } catch (error) {
    console.error(
      `Mudita search error: ${error.message}`
    );

    return [];
  }
}

module.exports = searchMudita;
