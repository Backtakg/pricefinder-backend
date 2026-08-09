async function searchThulo(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  try {
    const searchUrl =
      "https://thulo.com.np/search?q=" +
      encodeURIComponent(searchTerm);

    console.log(`Thulo: searching for "${searchTerm}"`);

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":
          "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      console.log(
        "Thulo search status:",
        response.status
      );
      return [];
    }

    const html = await response.text();

    console.log(
      `Thulo: received ${html.length} characters`
    );

    // =========================================
    // FIND PRODUCT LINKS
    // =========================================

    const matches = [
      ...html.matchAll(
        /href\s*=\s*["']([^"']+)["']/gi
      )
    ];

    const productUrls = [];
    const seen = new Set();

    for (const match of matches) {
      let url = decodeHtml(match[1]);

      if (url.startsWith("/")) {
        url = "https://thulo.com.np" + url;
      }

      if (!url.startsWith("http")) {
        continue;
      }

      if (!url.includes("thulo.com.np")) {
        continue;
      }

      url = url.split("#")[0];

      // Ignore obvious non-product pages
      if (
        url.includes("/search") ||
        url.includes("/cart") ||
        url.includes("/checkout") ||
        url.includes("/login") ||
        url.includes("/category")
      ) {
        continue;
      }

      // Avoid treating marketplace navigation pages
      // as products.
      if (
        url === "https://thulo.com.np/" ||
        url === "https://thulo.com.np"
      ) {
        continue;
      }

      if (!seen.has(url)) {
        seen.add(url);
        productUrls.push(url);
      }
    }

    console.log(
      `Thulo: found ${productUrls.length} possible product links`
    );

    const results = [];

    // Limit requests
    const urlsToCheck =
      productUrls.slice(0, 15);

    // =========================================
    // OPEN PRODUCT PAGES
    // =========================================

    for (const productUrl of urlsToCheck) {
      try {
        const productResponse =
          await fetch(productUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
              "Accept":
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language":
                "en-US,en;q=0.9"
            }
          });

        if (!productResponse.ok) {
          console.log(
            "Thulo product status:",
            productResponse.status
          );
          continue;
        }

        const productHtml =
          await productResponse.text();

        // =====================================
        // PRODUCT NAME
        // =====================================

        let name = "";

        const h1Match =
          productHtml.match(
            /<h1[^>]*>([\s\S]*?)<\/h1>/i
          );

        if (h1Match) {
          name = cleanText(
            h1Match[1]
          );
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
                .replace(
                  /\s*[-|].*$/,
                  ""
                )
            );
          }
        }

        if (!name) {
          continue;
        }

        // =====================================
        // SEARCH MATCH
        // =====================================

        const nameLower =
          name.toLowerCase();

        const searchLower =
          searchTerm.toLowerCase();

        const searchWords =
          searchLower
            .split(/\s+/)
            .filter(Boolean);

        const matchesSearch =
          nameLower.includes(searchLower) ||
          searchWords.some(
            word =>
              word.length >= 3 &&
              nameLower.includes(word)
          );

        if (!matchesSearch) {
          continue;
        }

        // =====================================
        // PRICE
        // =====================================

        const price =
          extractThuloPrice(
            productHtml
          );

        if (!price) {
          console.log(
            `Thulo: price not found for ${name}`
          );
          continue;
        }

        // =====================================
        // IMAGE
        // =====================================

        const image =
          extractThuloImage(
            productHtml
          );

        // =====================================
        // AVAILABILITY
        // =====================================

        let availability =
          "Check store";

        const lowerHtml =
          productHtml.toLowerCase();

        if (
          lowerHtml.includes(
            "out of stock"
          )
        ) {
          availability =
            "Out of stock";
        } else if (
          lowerHtml.includes(
            "in stock"
          ) ||
          lowerHtml.includes(
            "add to cart"
          ) ||
          lowerHtml.includes(
            "available"
          )
        ) {
          availability =
            "Available";
        }

        console.log(
          `Thulo: ${name} -> price: ${price}`
        );

        results.push({
          name: name,
          store: "Thulo",
          price: price,
          shipping: 0,
          total: price,
          availability: availability,
          url: productUrl,
          image: image,
          source: "Thulo",
          lastUpdated:
            new Date().toISOString()
        });

      } catch (error) {
        console.log(
          "Thulo product error:",
          error.message
        );
      }
    }

    console.log(
      `Thulo: returning ${results.length} results`
    );

    return results;

  } catch (error) {
    console.error(
      "Thulo search error:",
      error.message
    );

    return [];
  }
}


// ==========================================
// EXTRACT PRICE
// ==========================================

function extractThuloPrice(html) {

  // ----------------------------------------
  // METHOD 1: JSON-LD
  // ----------------------------------------

  const jsonMatches = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  for (const match of jsonMatches) {
    try {
      const data =
        JSON.parse(
          match[1].trim()
        );

      const objects =
        Array.isArray(data)
          ? data
          : [data];

      for (const obj of objects) {

        if (!obj || !obj.offers) {
          continue;
        }

        const offers =
          Array.isArray(obj.offers)
            ? obj.offers
            : [obj.offers];

        for (const offer of offers) {

          const price =
            Number(
              String(
                offer.price || ""
              ).replace(/,/g, "")
            );

          if (validPrice(price)) {
            return price;
          }
        }
      }

    } catch (error) {
      // Ignore invalid JSON-LD
    }
  }

  // ----------------------------------------
  // METHOD 2: itemprop price
  // ----------------------------------------

  const itemPrice =
    html.match(
      /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i
    );

  if (itemPrice) {
    const price =
      Number(
        itemPrice[1]
          .replace(/,/g, "")
      );

    if (validPrice(price)) {
      return price;
    }
  }

  // ----------------------------------------
  // METHOD 3: Rs / NPR / ₨
  // ----------------------------------------

  const priceMatches = [
    ...html.matchAll(
      /(?:Rs\.?|NPR|₨|रु\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi
    )
  ];

  const prices = [];

  for (const match of priceMatches) {
    const price =
      Number(
        match[1]
          .replace(/,/g, "")
      );

    if (validPrice(price)) {
      prices.push(price);
    }
  }

  if (prices.length > 0) {
    return prices[0];
  }

  return null;
}


// ==========================================
// EXTRACT IMAGE
// ==========================================

function extractThuloImage(html) {

  // og:image
  const ogImage =
    html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    );

  if (ogImage) {
    return makeAbsoluteImage(
      decodeHtml(
        ogImage[1]
      )
    );
  }

  // twitter:image
  const twitterImage =
    html.match(
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i
    );

  if (twitterImage) {
    return makeAbsoluteImage(
      decodeHtml(
        twitterImage[1]
      )
    );
  }

  // Regular images
  const images = [
    ...html.matchAll(
      /<img[^>]*src=["']([^"']+)["']/gi
    )
  ];

  for (const match of images) {

    const image =
      makeAbsoluteImage(
        decodeHtml(
          match[1]
        )
      );

    if (
      image &&
      !image.includes("logo") &&
      !image.includes("icon") &&
      !image.includes("placeholder")
    ) {
      return image;
    }
  }

  return "";
}


// ==========================================
// ABSOLUTE IMAGE URL
// ==========================================

function makeAbsoluteImage(url) {

  if (!url) {
    return "";
  }

  if (url.startsWith("//")) {
    return "https:" + url;
  }

  if (url.startsWith("/")) {
    return (
      "https://thulo.com.np" +
      url
    );
  }

  return url;
}


// ==========================================
// VALID PRICE
// ==========================================

function validPrice(price) {

  return (
    Number.isFinite(price) &&
    price > 10 &&
    price < 10000000
  );
}


// ==========================================
// CLEAN TEXT
// ==========================================

function cleanText(text) {

  return String(text)
    .replace(
      /<[^>]*>/g,
      " "
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#8377;/gi,
      "₨"
    )
    .replace(
      /&#x20B9;/gi,
      "₨"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


// ==========================================
// DECODE HTML
// ==========================================

function decodeHtml(text) {

  return String(text)
    .replace(
      /&amp;/g,
      "&"
    )
    .replace(
      /&quot;/g,
      '"'
    )
    .replace(
      /&#39;/g,
      "'"
    )
    .replace(
      /&lt;/g,
      "<"
    )
    .replace(
      /&gt;/g,
      ">"
    );
}


// ==========================================
// EXPORT
// ==========================================

module.exports = searchThulo;
