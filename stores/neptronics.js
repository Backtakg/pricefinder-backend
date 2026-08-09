async function searchNeptronics(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  try {
    const url =
      "https://neptronics.com/shop/?s=" +
      encodeURIComponent(searchTerm) +
      "&post_type=product";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "PriceFinderNepal/1.0"
      }
    });

    if (!response.ok) {
      console.log(
        "Neptronics returned status:",
        response.status
      );

      return [];
    }

    const html = await response.text();

    const results = [];

    /*
     * Neptronics uses WooCommerce-style product
     * pages. We look for product links and then
     * extract the visible product name and price.
     */

    const productLinks = [
      ...html.matchAll(
        /<a[^>]+href=["']([^"']*\/product\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
      )
    ];

    const seen = new Set();

    for (const match of productLinks) {
      const productUrl = match[1];
      const linkContent = match[2];

      const cleanText = linkContent
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&#8377;/gi, "Rs.")
        .replace(/&#x20B9;/gi, "Rs.")
        .replace(/\s+/g, " ")
        .trim();

      if (!cleanText) {
        continue;
      }

      const lowerName = cleanText.toLowerCase();
      const lowerQuery = searchTerm.toLowerCase();

      if (!lowerName.includes(lowerQuery)) {
        continue;
      }

      if (seen.has(productUrl)) {
        continue;
      }

      seen.add(productUrl);

      /*
       * Try to find a rupee price near the product.
       */

      const priceMatch = cleanText.match(
        /(?:₨|Rs\.?|रु\.?)\s*[\d,]+(?:\.\d{1,2})?/i
      );

      let price = null;

      if (priceMatch) {
        price = Number(
          priceMatch[0]
            .replace(/[^\d.]/g, "")
        );
      }

      const name = cleanText
        .replace(
          /(?:₨|Rs\.?|रु\.?)\s*[\d,]+(?:\.\d{1,2})?/gi,
          ""
        )
        .trim();

      results.push({
        name: name || cleanText,
        store: "Neptronics",
        price: price,
        shipping: 0,
        total: price,
        url: productUrl.startsWith("http")
          ? productUrl
          : "https://neptronics.com" + productUrl,
        source: "Neptronics",
        lastUpdated: new Date().toISOString()
      });
    }

    console.log(
      `Neptronics: found ${results.length} result(s) for "${searchTerm}"`
    );

    return results;

  } catch (error) {

    console.error(
      "Neptronics search error:",
      error.message
    );

    return [];
  }
}

module.exports = searchNeptronics;
