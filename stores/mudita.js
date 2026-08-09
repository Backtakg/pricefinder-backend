async function searchMudita(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  try {
    const searchUrl =
      "https://mudita.com.np/catalogsearch/result/?q=" +
      encodeURIComponent(searchTerm);

    console.log(`Mudita: searching for "${searchTerm}"`);
    console.log(`Mudita URL: ${searchUrl}`);

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
        "Mudita search status:",
        response.status
      );
      return [];
    }

    const html = await response.text();

    console.log(
      `Mudita: received ${html.length} characters`
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

      if (
        url.startsWith("/")
      ) {
        url =
          "https://mudita.com.np" +
          url;
      }

      if (
        !url.startsWith("http")
      ) {
        continue;
      }

      if (
        !url.includes("mudita.com.np")
      ) {
        continue;
      }

      url = url.split("?")[0];

      // Ignore obvious non-product pages
      if (
        url.includes("/blog") ||
        url.includes("/contact") ||
        url.includes("/customer") ||
        url.includes("/wishlist") ||
        url.includes("/checkout") ||
        url.includes("/cart") ||
        url.includes("/catalogsearch") ||
        url.includes("/category")
      ) {
        continue;
      }

      // Mudita product URLs commonly end in .html
      if (!url.endsWith(".html")) {
        continue;
      }

      if (!seen.has(url)) {
        seen.add(url);
        productUrls.push(url);
      }
    }

    console.log(
      `Mudita: found ${productUrls.length} possible product links`
    );

    const urlsToCheck =
      productUrls.slice(0, 15);

    const results = [];

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
            "Mudita product status:",
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

        // Fallback title
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
        // CHECK SEARCH MATCH
        // =====================================

        const nameLower =
          name.toLowerCase();

        const searchLower =
          searchTerm.toLowerCase();

        const words =
          searchLower
            .split(/\s+/)
            .filter(Boolean);

        const matchesSearch =
          nameLower.includes(searchLower) ||
          words.some(
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
          extractMuditaPrice(
            productHtml
          );

        if (!price) {
          console.log(
            `Mudita: price not found for ${name}`
          );
          continue;
        }

        // =====================================
        // IMAGE
        // =====================================

        const image =
          extractMuditaImage(
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
          )
        ) {
          availability =
            "Available";
        }

        console.log(
          `Mudita: ${name} -> price: ${price}`
        );

        if (image) {
          console.log(
            `Mudita image: ${image}`
          );
        }

        results.push({
          name: name,
          store: "Mudita Store",
          price: price,
          shipping: 0,
          total: price,
          availability: availability,
          url: productUrl,
          image: image,
          source: "Mudita Store",
          lastUpdated:
            new Date().toISOString()
        });

      } catch (error) {
        console.log(
          "Mudita product error:",
          error.message
        );
      }
    }

    console.log(
      `Mudita: returning ${results.length} results for "${searchTerm}"`
    );

    return results;

  } catch (error) {
    console.error(
      "Mudita search error:",
      error.message
    );

    return [];
  }
}


// ==========================================
// EXTRACT PRICE
// ==========================================

function extractMuditaPrice(html) {

  // ----------------------------------------
  // JSON-LD
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

        if (
          obj &&
          obj.offers
        ) {

          const offers =
            Array.isArray(
              obj.offers
            )
              ? obj.offers
              : [obj.offers];

          for (
            const offer of offers
          ) {

            const price =
              Number(
                String(
                  offer.price || ""
                )
                  .replace(/,/g, "")
              );

            if (
              validPrice(price)
            ) {
              return price;
            }
          }
        }
      }

    } catch (error) {
      // Ignore invalid JSON-LD
    }
  }

  // ----------------------------------------
  // Rs / NPR / रु price
  // ----------------------------------------

  const matches = [
    ...html.matchAll(
      /(?:Rs\.?|NPR|रु\.?|₨)\s*([\d,]+(?:\.\d{1,2})?)/gi
    )
  ];

  for (const match of matches) {

    const price =
      Number(
        match[1]
          .replace(/,/g, "")
      );

    if (
      validPrice(price)
    ) {
      return price;
    }
  }

  // ----------------------------------------
  // itemprop price
  // ----------------------------------------

  const itemProp =
    html.match(
      /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i
    );

  if (itemProp) {

    const price =
      Number(
        itemProp[1]
          .replace(/,/g, "")
      );

    if (
      validPrice(price)
    ) {
      return price;
    }
  }

  return null;
}


// ==========================================
// EXTRACT IMAGE
// ==========================================

function extractMuditaImage(html) {

  // ----------------------------------------
  // og:image
  // ----------------------------------------

  const ogImage =
    html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    );

  if (ogImage) {
    return decodeHtml(
      ogImage[1]
    );
  }

  // ----------------------------------------
  // twitter:image
  // ----------------------------------------

  const twitterImage =
    html.match(
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i
    );

  if (twitterImage) {
    return decodeHtml(
      twitterImage[1]
    );
  }

  // ----------------------------------------
  // product image
  // ----------------------------------------

  const images = [
    ...html.matchAll(
      /<img[^>]*src=["']([^"']+)["']/gi
    )
  ];

  for (const match of images) {

    let image =
      decodeHtml(match[1]);

    if (
      image.startsWith("//")
    ) {
      image =
        "https:" + image;
    }

    if (
      image.startsWith("/")
    ) {
      image =
        "https://mudita.com.np" +
        image;
    }

    if (
      image.startsWith("http") &&
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

module.exports = searchMudita;
