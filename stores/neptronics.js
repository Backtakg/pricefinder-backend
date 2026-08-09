async function searchNeptronics(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  try {
    // Search Neptronics public product catalog
    const searchUrl =
      "https://neptronics.com/shop/?s=" +
      encodeURIComponent(searchTerm) +
      "&post_type=product";

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "PriceFinderNepal/1.0"
      }
    });

    if (!response.ok) {
      console.log(
        "Neptronics search status:",
        response.status
      );

      return [];
    }

    const html = await response.text();

    // Find product URLs
    const matches = [
      ...html.matchAll(
        /href=["']([^"']*\/product\/[^"']+)["']/gi
      )
    ];

    const productUrls = [];
    const seen = new Set();

    for (const match of matches) {
      let productUrl = match[1];

      // Decode HTML entities
      productUrl = productUrl
        .replace(/&amp;/g, "&");

      // Make absolute URL
      if (!productUrl.startsWith("http")) {
        productUrl =
          "https://neptronics.com" +
          productUrl;
      }

      if (!seen.has(productUrl)) {
        seen.add(productUrl);
        productUrls.push(productUrl);
      }
    }

    const results = [];

    // Limit requests so we don't hit the site with
    // too many requests at once.
    const limitedUrls =
      productUrls.slice(0, 10);

    for (const productUrl of limitedUrls) {

      try {

        const productResponse = await fetch(
          productUrl,
          {
            headers: {
              "User-Agent": "PriceFinderNepal/1.0"
            }
          }
        );

        if (!productResponse.ok) {
          continue;
        }

        const productHtml =
          await productResponse.text();

        // ------------------------------------------
        // PRODUCT NAME
        // ------------------------------------------

        let name = "";

        const titleMatch =
          productHtml.match(
            /<h1[^>]*class=["'][^"']*product_title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i
          );

        if (titleMatch) {
          name = cleanText(titleMatch[1]);
        }

        // Fallback to page title
        if (!name) {

          const pageTitle =
            productHtml.match(
              /<title[^>]*>([\s\S]*?)<\/title>/i
            );

          if (pageTitle) {
            name = cleanText(
              pageTitle[1]
                .replace(/\s*[-|].*$/, "")
            );
          }
        }

        if (!name) {
          continue;
        }

        // ------------------------------------------
        // CHECK SEARCH TERM
        // ------------------------------------------

        const nameLower =
          name.toLowerCase();

        const queryLower =
          searchTerm.toLowerCase();

        if (!nameLower.includes(queryLower)) {
          continue;
        }

        // ------------------------------------------
        // PRICE
        // ------------------------------------------

        let price = null;

        // WooCommerce price section
        const priceSection =
          productHtml.match(
            /<p[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
          );

        if (priceSection) {

          const prices =
            extractPrices(
              priceSection[1]
            );

          if (prices.length > 0) {
            // Last price is normally the current
            // sale price when both old and new
            // prices are shown.
            price =
              prices[prices.length - 1];
          }
        }

        // Fallback: search the product page
        if (price === null) {

          const prices =
            extractPrices(productHtml);

          if (prices.length > 0) {

            // Prefer the first reasonable price.
            price = prices[0];
          }
        }

        // ------------------------------------------
        // AVAILABILITY
        // ------------------------------------------

        let availability =
          "Available";

        if (
          /out[-\s]?of[-\s]?stock/i.test(
            productHtml
          )
        ) {
          availability =
            "Out of stock";
        }

        // ------------------------------------------
        // RESULT
        // ------------------------------------------

        results.push({

          name: name,

          store: "Neptronics",

          price: price,

          shipping: 0,

          total:
            price !== null
              ? price
              : null,

          availability:
            availability,

          url: productUrl,

          source: "Neptronics",

          lastUpdated:
            new Date().toISOString()

        });

      } catch (productError) {

        console.log(
          "Neptronics product error:",
          productError.message
        );

      }

    }

    console.log(
      `Neptronics: ${results.length} result(s) for "${searchTerm}"`
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


// ==========================================
// CLEAN HTML TEXT
// ==========================================

function cleanText(text) {

  return text

    .replace(/<[^>]*>/g, " ")

    .replace(/&nbsp;/gi, " ")

    .replace(/&amp;/gi, "&")

    .replace(/&#8377;/gi, "₨")

    .replace(/&#x20B9;/gi, "₨")

    .replace(/&#8211;/gi, "-")

    .replace(/&#8212;/gi, "-")

    .replace(/\s+/g, " ")

    .trim();
}


// ==========================================
// EXTRACT NEPALI/RUPEE PRICES
// ==========================================

function extractPrices(html) {

  const text =
    cleanText(html);

  const matches = text.match(
    /(?:₨|Rs\.?|रु\.?)\s*[\d,]+(?:\.\d{1,2})?/gi
  );

  if (!matches) {
    return [];
  }

  return matches

    .map(priceText => {

      const number =
        priceText.replace(
          /[^\d.]/g,
          ""
        );

      return Number(number);

    })

    .filter(price =>
      Number.isFinite(price) &&
      price > 0
    );

}


module.exports = searchNeptronics;
