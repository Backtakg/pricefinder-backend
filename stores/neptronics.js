async function searchNeptronics(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  try {
    const searchUrl =
      "https://neptronics.com/shop/?s=" +
      encodeURIComponent(searchTerm) +
      "&post_type=product";

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml"
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

    // -----------------------------------------
    // FIND PRODUCT LINKS
    // -----------------------------------------

    const matches = [
      ...html.matchAll(
        /href\s*=\s*["']([^"']*\/product\/[^"']+)["']/gi
      )
    ];

    const productUrls = [];
    const seen = new Set();

    for (const match of matches) {
      let url = match[1];

      url = decodeHtml(url);

      if (!url.startsWith("http")) {
        url = "https://neptronics.com" + url;
      }

      // Remove query parameters
      url = url.split("?")[0];

      if (!seen.has(url)) {
        seen.add(url);
        productUrls.push(url);
      }
    }

    console.log(
      `Neptronics: found ${productUrls.length} product links`
    );

    const results = [];

    // Don't make too many requests
    const urlsToCheck = productUrls.slice(0, 10);

    // -----------------------------------------
    // OPEN EACH PRODUCT
    // -----------------------------------------

    for (const productUrl of urlsToCheck) {
      try {
        const productResponse = await fetch(
          productUrl,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
              "Accept":
                "text/html,application/xhtml+xml"
            }
          }
        );

        if (!productResponse.ok) {
          console.log(
            "Product page status:",
            productResponse.status,
            productUrl
          );
          continue;
        }

        const productHtml =
          await productResponse.text();

        // -----------------------------------------
        // PRODUCT NAME
        // -----------------------------------------

        let name = "";

        const h1Match = productHtml.match(
          /<h1[^>]*>([\s\S]*?)<\/h1>/i
        );

        if (h1Match) {
          name = cleanText(h1Match[1]);
        }

        // Fallback to title
        if (!name) {
          const titleMatch =
            productHtml.match(
              /<title[^>]*>([\s\S]*?)<\/title>/i
            );

          if (titleMatch) {
            name = cleanText(
              titleMatch[1]
                .replace(/\s*[-|].*$/, "")
            );
          }
        }

        if (!name) {
          continue;
        }

        // -----------------------------------------
        // MAKE SURE PRODUCT MATCHES QUERY
        // -----------------------------------------

        if (
          !name
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        ) {
          continue;
        }

        // -----------------------------------------
        // FIND PRICE
        // -----------------------------------------

        const price =
          extractProductPrice(productHtml);

        console.log(
          `Neptronics: ${name} -> price: ${price}`
        );

        // -----------------------------------------
        // AVAILABILITY
        // -----------------------------------------

        let availability = "Available";

        if (
          /out[\s-]?of[\s-]?stock/i.test(
            productHtml
          )
        ) {
          availability = "Out of stock";
        }

        // -----------------------------------------
        // ADD RESULT
        // -----------------------------------------

        results.push({
          name: name,
          store: "Neptronics",
          price: price,
          shipping: 0,
          total: price,
          availability: availability,
          url: productUrl,
          source: "Neptronics",
          lastUpdated: new Date().toISOString()
        });

      } catch (error) {
        console.log(
          "Neptronics product error:",
          error.message
        );
      }
    }

    console.log(
      `Neptronics: returning ${results.length} results for "${searchTerm}"`
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


// =================================================
// EXTRACT PRODUCT PRICE
// =================================================

function extractProductPrice(html) {

  // -----------------------------------------
  // METHOD 1: JSON-LD PRODUCT DATA
  // -----------------------------------------

  const jsonLdMatches = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  for (const match of jsonLdMatches) {

    try {
      const data = JSON.parse(
        match[1].trim()
      );

      const objects = Array.isArray(data)
        ? data
        : [data];

      for (const obj of objects) {

        // Direct product price
        if (
          obj &&
          obj.offers &&
          !Array.isArray(obj.offers) &&
          obj.offers.price
        ) {
          const price = Number(
            String(obj.offers.price)
              .replace(/,/g, "")
          );

          if (validPrice(price)) {
            return price;
          }
        }

        // Multiple offers
        if (
          obj &&
          Array.isArray(obj.offers)
        ) {
          for (const offer of obj.offers) {

            if (offer && offer.price) {

              const price = Number(
                String(offer.price)
                  .replace(/,/g, "")
              );

              if (validPrice(price)) {
                return price;
              }
            }
          }
        }
      }

    } catch (error) {
      // Ignore invalid JSON-LD
    }
  }


  // -----------------------------------------
  // METHOD 2: itemprop="price"
  // -----------------------------------------

  const itemPropMatch = html.match(
    /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i
  );

  if (itemPropMatch) {

    const price = Number(
      itemPropMatch[1]
        .replace(/,/g, "")
    );

    if (validPrice(price)) {
      return price;
    }
  }


  // -----------------------------------------
  // METHOD 3: content BEFORE itemprop
  // -----------------------------------------

  const itemPropReverse = html.match(
    /content=["']([\d,.]+)["'][^>]*itemprop=["']price["']/i
  );

  if (itemPropReverse) {

    const price = Number(
      itemPropReverse[1]
        .replace(/,/g, "")
    );

    if (validPrice(price)) {
      return price;
    }
  }


  // -----------------------------------------
  // METHOD 4: WooCommerce price block
  // -----------------------------------------

  const priceBlock = html.match(
    /class=["'][^"']*(?:price|woocommerce-Price-amount)[^"']*["'][^>]*>([\s\S]{0,500})<\/(?:p|span|div)>/i
  );

  if (priceBlock) {

    const prices =
      extractNumbers(priceBlock[1]);

    if (prices.length) {

      // Usually the last number is sale price
      const price =
        prices[prices.length - 1];

      if (validPrice(price)) {
        return price;
      }
    }
  }


  // -----------------------------------------
  // METHOD 5: Search for ₨ / Rs around price
  // -----------------------------------------

  const rupeeMatches = [
    ...html.matchAll(
      /(?:₨|Rs\.?|रु\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi
    )
  ];

  const rupeePrices = [];

  for (const match of rupeeMatches) {

    const price = Number(
      match[1]
        .replace(/,/g, "")
    );

    if (validPrice(price)) {
      rupeePrices.push(price);
    }
  }

  if (rupeePrices.length) {

    // Remove obvious non-product numbers
    return rupeePrices[0];
  }


  // -----------------------------------------
  // METHOD 6: WooCommerce bdi element
  // -----------------------------------------

  const bdiMatch = html.match(
    /<bdi[^>]*>([\s\S]*?)<\/bdi>/i
  );

  if (bdiMatch) {

    const prices =
      extractNumbers(bdiMatch[1]);

    if (prices.length) {

      const price =
        prices[prices.length - 1];

      if (validPrice(price)) {
        return price;
      }
    }
  }


  // Nothing found
  return null;
}


// =================================================
// EXTRACT NUMBERS
// =================================================

function extractNumbers(html) {

  const text = cleanText(html);

  const matches = text.match(
    /[\d]+(?:,[\d]{3})*(?:\.\d{1,2})?/g
  );

  if (!matches) {
    return [];
  }

  return matches
    .map(value =>
      Number(
        value.replace(/,/g, "")
      )
    )
    .filter(validPrice);
}


// =================================================
// VALID PRICE
// =================================================

function validPrice(price) {

  return (
    Number.isFinite(price) &&
    price > 10 &&
    price < 10000000
  );
}


// =================================================
// CLEAN HTML
// =================================================

function cleanText(text) {

  return String(text)

    .replace(/<[^>]*>/g, " ")

    .replace(/&nbsp;/gi, " ")

    .replace(/&amp;/gi, "&")

    .replace(/&quot;/gi, '"')

    .replace(/&#8377;/gi, "₨")

    .replace(/&#x20B9;/gi, "₨")

    .replace(/&#8211;/gi, "-")

    .replace(/&#8212;/gi, "-")

    .replace(/\s+/g, " ")

    .trim();
}


// =================================================
// DECODE HTML ENTITIES
// =================================================

function decodeHtml(text) {

  return String(text)

    .replace(/&amp;/g, "&")

    .replace(/&quot;/g, '"')

    .replace(/&#39;/g, "'")

    .replace(/&lt;/g, "<")

    .replace(/&gt;/g, ">");
}


// =================================================
// EXPORT
// =================================================

module.exports = searchNeptronics;
