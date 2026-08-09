async function searchBigbyte(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  try {
    const searchUrl =
      "https://bigbyte.com.np/shop/?s=" +
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
        "Bigbyte search status:",
        response.status
      );
      return [];
    }

    const html = await response.text();
    console.log("BIGBYTE STATUS:", response.status);
console.log("BIGBYTE URL:", response.url);
console.log("BIGBYTE HTML LENGTH:", html.length);
console.log(
  "BIGBYTE HTML START:",
  html.substring(0, 1000)
);

    // ==========================================
    // FIND PRODUCT LINKS
    // ==========================================

    const matches = [
      ...html.matchAll(
        /href\s*=\s*["']([^"']+)["']/gi
      )
    ];

    const productUrls = [];
    const seen = new Set();

    for (const match of matches) {
      let url = decodeHtml(match[1]);

      if (!url.startsWith("http")) {
        if (url.startsWith("/")) {
          url = "https://bigbyte.com.np" + url;
        } else {
          continue;
        }
      }

      url = url.split("?")[0];

      // Bigbyte product URLs are usually direct pages,
      // so only accept links that look like product pages.
      if (
        !url.includes("bigbyte.com.np") ||
        url === "https://bigbyte.com.np/"
      ) {
        continue;
      }

      // Ignore obvious non-product pages
      if (
        url.includes("/shop") ||
        url.includes("/cart") ||
        url.includes("/checkout") ||
        url.includes("/my-account") ||
        url.includes("/category") ||
        url.includes("/brand") ||
        url.includes("/blog") ||
        url.includes("/contact")
      ) {
        continue;
      }

      if (!seen.has(url)) {
        seen.add(url);
        productUrls.push(url);
      }
    }

    console.log(
      `Bigbyte: found ${productUrls.length} possible product links`
    );

    const results = [];

    // Don't make too many requests
    const urlsToCheck = productUrls.slice(0, 12);

    // ==========================================
    // OPEN EACH PRODUCT
    // ==========================================

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
          continue;
        }

        const productHtml =
          await productResponse.text();

        // ==========================================
        // PRODUCT NAME
        // ==========================================

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

        // ==========================================
        // MAKE SURE PRODUCT MATCHES QUERY
        // ==========================================

        const nameLower =
          name.toLowerCase();

        const searchLower =
          searchTerm.toLowerCase();

        const searchWords =
          searchLower
            .split(/\s+/)
            .filter(
              word => word.length > 1
            );

        const matchesQuery =
          nameLower.includes(searchLower) ||
          searchWords.some(
            word =>
              nameLower.includes(word)
          );

        if (!matchesQuery) {
          continue;
        }

        // ==========================================
        // FIND PRICE
        // ==========================================

        const price =
          extractBigbytePrice(
            productHtml
          );

        if (!price) {
          console.log(
            `Bigbyte: no price found for ${name}`
          );
          continue;
        }

        // ==========================================
        // FIND IMAGE
        // ==========================================

        let image = "";

        const imagePatterns = [
          /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
          /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
          /<img[^>]*class=["'][^"']*wp-post-image[^"']*["'][^>]*src=["']([^"']+)["']/i,
          /<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*wp-post-image[^"']*["']/i
        ];

        for (
          const pattern of imagePatterns
        ) {
          const imageMatch =
            productHtml.match(pattern);

          if (imageMatch) {
            image =
              decodeHtml(
                imageMatch[1]
              );

            break;
          }
        }

        if (
          image &&
          !image.startsWith("http")
        ) {
          if (image.startsWith("//")) {
            image =
              "https:" + image;
          } else if (
            image.startsWith("/")
          ) {
            image =
              "https://bigbyte.com.np" +
              image;
          }
        }

        // ==========================================
        // AVAILABILITY
        // ==========================================

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
          )
        ) {
          availability =
            "Available";
        }

        // ==========================================
        // ADD RESULT
        // ==========================================

        results.push({
          name: name,
          store: "Bigbyte IT World",
          price: price,
          shipping: 0,
          total: price,
          availability: availability,
          url: productUrl,
          source: "Bigbyte IT World",
          image: image,
          lastUpdated:
            new Date().toISOString()
        });

      } catch (error) {
        console.log(
          "Bigbyte product error:",
          error.message
        );
      }
    }

    console.log(
      `Bigbyte: returning ${results.length} results for "${searchTerm}"`
    );

    return results;

  } catch (error) {
    console.error(
      "Bigbyte search error:",
      error.message
    );

    return [];
  }
}

// ==========================================
// EXTRACT PRODUCT PRICE
// ==========================================

function extractBigbytePrice(html) {

  // ------------------------------------------
  // METHOD 1: JSON-LD
  // ------------------------------------------

  const jsonLdMatches = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  for (
    const match of jsonLdMatches
  ) {
    try {
      const data =
        JSON.parse(
          match[1].trim()
        );

      const objects =
        Array.isArray(data)
          ? data
          : [data];

      for (
        const obj of objects
      ) {
        if (
          obj &&
          obj.offers &&
          obj.offers.price
        ) {
          const price =
            Number(
              String(
                obj.offers.price
              ).replace(/,/g, "")
            );

          if (validBigbytePrice(price)) {
            return price;
          }
        }

        if (
          obj &&
          Array.isArray(
            obj.offers
          )
        ) {
          for (
            const offer of obj.offers
          ) {
            if (
              offer &&
              offer.price
            ) {
              const price =
                Number(
                  String(
                    offer.price
                  ).replace(/,/g, "")
                );

              if (
                validBigbytePrice(
                  price
                )
              ) {
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

  // ------------------------------------------
  // METHOD 2: itemprop price
  // ------------------------------------------

  const itemPropMatch =
    html.match(
      /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i
    );

  if (itemPropMatch) {
    const price =
      Number(
        itemPropMatch[1]
          .replace(/,/g, "")
      );

    if (
      validBigbytePrice(price)
    ) {
      return price;
    }
  }

  // ------------------------------------------
  // METHOD 3: WooCommerce price
  // ------------------------------------------

  const priceBlock =
    html.match(
      /class=["'][^"']*(?:price|woocommerce-Price-amount)[^"']*["'][^>]*>([\s\S]{0,500})<\/(?:span|p|div)>/i
    );

  if (priceBlock) {
    const prices =
      extractBigbyteNumbers(
        priceBlock[1]
      );

    if (prices.length) {
      const price =
        prices[
          prices.length - 1
        ];

      if (
        validBigbytePrice(price)
      ) {
        return price;
      }
    }
  }

  // ------------------------------------------
  // METHOD 4: Rupee symbol
  // ------------------------------------------

  const rupeeMatches = [
    ...html.matchAll(
      /(?:₨|Rs\.?|रु\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi
    )
  ];

  for (
    const match of rupeeMatches
  ) {
    const price =
      Number(
        match[1]
          .replace(/,/g, "")
      );

    if (
      validBigbytePrice(price)
    ) {
      return price;
    }
  }

  return null;
}

// ==========================================
// EXTRACT NUMBERS
// ==========================================

function extractBigbyteNumbers(
  html
) {
  const text =
    cleanText(html);

  const matches =
    text.match(
      /[\d]+(?:,[\d]{3})*(?:\.\d{1,2})?/g
    );

  if (!matches) {
    return [];
  }

  return matches
    .map(
      value =>
        Number(
          value.replace(/,/g, "")
        )
    )
    .filter(
      validBigbytePrice
    );
}

// ==========================================
// VALID PRICE
// ==========================================

function validBigbytePrice(
  price
) {
  return (
    Number.isFinite(price) &&
    price > 10 &&
    price < 10000000
  );
}

// ==========================================
// CLEAN HTML
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
      /&#8211;/gi,
      "-"
    )
    .replace(
      /&#8212;/gi,
      "-"
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

module.exports =
  searchBigbyte;
