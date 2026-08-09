// ============================================================
// NEPTRONICS STORE SEARCH
// ============================================================

const BASE_URL = "https://neptronics.com";

async function searchNeptronics(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  console.log(
    `Neptronics: searching for "${searchTerm}"`
  );

  try {
    // --------------------------------------------------------
    // SEARCH URL
    // --------------------------------------------------------

    const searchUrl =
      `${BASE_URL}/shop/?s=${encodeURIComponent(searchTerm)}&post_type=product`;

    console.log(
      `Neptronics URL: ${searchUrl}`
    );

    const response = await fetch(searchUrl, {
      method: "GET",

      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",

        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

        "Accept-Language":
          "en-US,en;q=0.9",

        "Cache-Control":
          "no-cache",

        "Pragma":
          "no-cache"
      },

      redirect: "follow",

      signal: AbortSignal.timeout(20000)
    });

    console.log(
      `Neptronics search status: ${response.status}`
    );

    if (!response.ok) {
      console.log(
        `Neptronics search failed: HTTP ${response.status}`
      );

      return [];
    }

    const html = await response.text();

    console.log(
      `Neptronics: received ${html.length} characters`
    );

    if (!html || html.length < 100) {
      console.log(
        "Neptronics: search response is empty or too small"
      );

      return [];
    }

    // --------------------------------------------------------
    // FIND PRODUCT LINKS
    // --------------------------------------------------------

    const productUrls = extractProductUrls(html);

    console.log(
      `Neptronics: found ${productUrls.length} product links`
    );

    if (productUrls.length === 0) {
      console.log(
        "Neptronics: no product links found in search HTML"
      );

      return [];
    }

    const results = [];

    // Check up to 15 products
    const urlsToCheck =
      productUrls.slice(0, 15);

    // --------------------------------------------------------
    // OPEN PRODUCT PAGES
    // --------------------------------------------------------

    for (const productUrl of urlsToCheck) {
      try {
        console.log(
          `Neptronics: checking ${productUrl}`
        );

        const productResponse =
          await fetch(productUrl, {
            method: "GET",

            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",

              "Accept":
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

              "Accept-Language":
                "en-US,en;q=0.9"
            },

            redirect: "follow",

            signal: AbortSignal.timeout(20000)
          });

        console.log(
          `Neptronics product status: ${productResponse.status}`
        );

        if (!productResponse.ok) {
          console.log(
            `Neptronics: product page failed ${productResponse.status}: ${productUrl}`
          );

          continue;
        }

        const productHtml =
          await productResponse.text();

        if (!productHtml) {
          console.log(
            `Neptronics: empty product page: ${productUrl}`
          );

          continue;
        }

        // ----------------------------------------------------
        // PRODUCT NAME
        // ----------------------------------------------------

        const productName =
          extractProductName(productHtml);

        if (!productName) {
          console.log(
            `Neptronics: product name not found: ${productUrl}`
          );

          continue;
        }

        console.log(
          `Neptronics product name: ${productName}`
        );

        // ----------------------------------------------------
        // PRODUCT PRICE
        // ----------------------------------------------------

        const productPrice =
          extractProductPrice(productHtml);

        console.log(
          `Neptronics price: ${productPrice}`
        );

        if (!validPrice(productPrice)) {
          console.log(
            `Neptronics: no valid price found for "${productName}"`
          );

          continue;
        }

        // ----------------------------------------------------
        // SEARCH MATCH
        // ----------------------------------------------------

        if (!isSearchMatch(
          searchTerm,
          productName
        )) {
          console.log(
            `Neptronics: "${productName}" did not match "${searchTerm}"`
          );

          continue;
        }

        // ----------------------------------------------------
        // AVAILABILITY
        // ----------------------------------------------------

        const availability =
          extractAvailability(productHtml);

        // ----------------------------------------------------
        // IMAGE
        // ----------------------------------------------------

        const image =
          extractProductImage(productHtml);

        // ----------------------------------------------------
        // RESULT
        // ----------------------------------------------------

        results.push({
          name: productName,

          store: "Neptronics",

          price: productPrice,

          shipping: 0,

          total: productPrice,

          availability: availability,

          url: productUrl,

          image: image,

          source: "Neptronics",

          lastUpdated:
            new Date().toISOString()
        });

        console.log(
          `Neptronics: FOUND "${productName}" - Rs. ${productPrice}`
        );

      } catch (error) {
        console.error(
          `Neptronics product error for ${productUrl}:`,
          error.message
        );

        if (error.cause) {
          console.error(
            "Neptronics product error cause:",
            error.cause
          );
        }
      }
    }

    console.log(
      `Neptronics: returning ${results.length} results for "${searchTerm}"`
    );

    return results;

  } catch (error) {

    console.error(
      "=========================================="
    );

    console.error(
      "NEPTRONICS SEARCH ERROR"
    );

    console.error(
      "Message:",
      error.message
    );

    console.error(
      "Name:",
      error.name
    );

    console.error(
      "Code:",
      error.code
    );

    console.error(
      "Cause:",
      error.cause
    );

    console.error(
      "Full error:",
      error
    );

    console.error(
      "=========================================="
    );

    return [];
  }
}


// ============================================================
// EXTRACT PRODUCT URLS
// ============================================================

function extractProductUrls(html) {
  const urls = [];
  const seen = new Set();

  // ----------------------------------------------------------
  // Method 1: normal href="/product/..."
  // ----------------------------------------------------------

  const hrefMatches = [
    ...html.matchAll(
      /href\s*=\s*["']([^"']+)["']/gi
    )
  ];

  for (const match of hrefMatches) {
    let url = match[1];

    if (!url) {
      continue;
    }

    url = decodeHtml(url);

    try {
      url =
        new URL(
          url,
          BASE_URL
        ).href;
    } catch (error) {
      continue;
    }

    url =
      url.split("?")[0];

    url =
      url.split("#")[0];

    if (
      !url.startsWith(BASE_URL)
    ) {
      continue;
    }

    /*
     * Neptronics may expose product URLs using
     * different WooCommerce structures.
     */

    const isProductUrl =
      url.includes("/product/") ||
      url.includes("/shop/") &&
      !url.endsWith("/shop/");

    if (
      isProductUrl &&
      !seen.has(url)
    ) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}


// ============================================================
// EXTRACT PRODUCT NAME
// ============================================================

function extractProductName(html) {

  // ----------------------------------------------------------
  // Method 1: WooCommerce product title
  // ----------------------------------------------------------

  const productTitleMatch =
    html.match(
      /<h1[^>]*class=["'][^"']*(?:product_title|entry-title)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i
    );

  if (productTitleMatch) {
    const name =
      cleanText(
        productTitleMatch[1]
      );

    if (name) {
      return name;
    }
  }

  // ----------------------------------------------------------
  // Method 2: any H1
  // ----------------------------------------------------------

  const h1Match =
    html.match(
      /<h1[^>]*>([\s\S]*?)<\/h1>/i
    );

  if (h1Match) {
    const name =
      cleanText(
        h1Match[1]
      );

    if (name) {
      return name;
    }
  }

  // ----------------------------------------------------------
  // Method 3: Open Graph title
  // ----------------------------------------------------------

  const ogTitle =
    html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
    );

  if (
    ogTitle &&
    ogTitle[1]
  ) {
    return cleanText(
      decodeHtml(
        ogTitle[1]
      )
    );
  }

  // ----------------------------------------------------------
  // Method 4: title tag
  // ----------------------------------------------------------

  const titleMatch =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

  if (titleMatch) {
    let title =
      cleanText(
        titleMatch[1]
      );

    title =
      title.replace(
        /\s*[-|–—]\s*Neptronics.*$/i,
        ""
      );

    if (title) {
      return title;
    }
  }

  return "";
}


// ============================================================
// SEARCH MATCH
// ============================================================

function isSearchMatch(
  searchTerm,
  productName
) {
  const search =
    String(searchTerm)
      .toLowerCase()
      .trim();

  const name =
    String(productName)
      .toLowerCase()
      .trim();

  if (!search || !name) {
    return false;
  }

  // Exact phrase
  if (
    name.includes(search)
  ) {
    return true;
  }

  // Individual words
  const words =
    search
      .split(/\s+/)
      .filter(
        word =>
          word.length >= 2
      );

  if (!words.length) {
    return false;
  }

  const matchedWords =
    words.filter(
      word =>
        name.includes(word)
    );

  /*
   * For multi-word searches, require at least
   * half the words to match.
   */

  return (
    matchedWords.length >=
    Math.ceil(words.length / 2)
  );
}


// ============================================================
// EXTRACT PRODUCT PRICE
// ============================================================

function extractProductPrice(html) {

  // ----------------------------------------------------------
  // Method 1: JSON-LD
  // ----------------------------------------------------------

  const jsonLdMatches = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  for (const match of jsonLdMatches) {

    try {
      const data =
        JSON.parse(
          match[1].trim()
        );

      const objects =
        Array.isArray(data)
          ? data
          : [data];

      for (const object of objects) {

        if (!object) {
          continue;
        }

        if (
          object.offers &&
          !Array.isArray(object.offers) &&
          object.offers.price
        ) {
          const price =
            Number(
              String(
                object.offers.price
              ).replace(/,/g, "")
            );

          if (validPrice(price)) {
            return price;
          }
        }

        if (
          Array.isArray(
            object.offers
          )
        ) {
          for (
            const offer
            of object.offers
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
                validPrice(price)
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

  // ----------------------------------------------------------
  // Method 2: itemprop price
  // ----------------------------------------------------------

  const itemPropMatches = [
    /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i,
    /content=["']([\d,.]+)["'][^>]*itemprop=["']price["']/i
  ];

  for (
    const pattern
    of itemPropMatches
  ) {

    const match =
      html.match(pattern);

    if (match) {

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
  }

  // ----------------------------------------------------------
  // Method 3: WooCommerce price classes
  // ----------------------------------------------------------

  const priceBlocks = [
    ...html.matchAll(
      /class=["'][^"']*(?:price|woocommerce-Price-amount|amount)[^"']*["'][^>]*>([\s\S]{0,1000})<\/(?:p|span|div|bdi|ins|del)>/gi
    )
  ];

  for (
    const block
    of priceBlocks
  ) {

    const prices =
      extractNumbers(
        block[1]
      );

    for (
      const price
      of prices
    ) {

      if (
        validPrice(price)
      ) {
        return price;
      }
    }
  }

  // ----------------------------------------------------------
  // Method 4: Rs / NPR / rupee symbols
  // ----------------------------------------------------------

  const rupeeMatches = [
    ...html.matchAll(
      /(?:₨|Rs\.?|NPR|रु\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi
    )
  ];

  for (
    const match
    of rupeeMatches
  ) {

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

  // ----------------------------------------------------------
  // Method 5: BDI
  // ----------------------------------------------------------

  const bdiMatches = [
    ...html.matchAll(
      /<bdi[^>]*>([\s\S]*?)<\/bdi>/gi
    )
  ];

  for (
    const match
    of bdiMatches
  ) {

    const prices =
      extractNumbers(
        match[1]
      );

    for (
      const price
      of prices
    ) {

      if (
        validPrice(price)
      ) {
        return price;
      }
    }
  }

  return null;
}


// ============================================================
// EXTRACT AVAILABILITY
// ============================================================

function extractAvailability(html) {

  const stockMatch =
    html.match(
      /<[^>]*class=["'][^"']*stock[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i
    );

  if (!stockMatch) {
    return "Check store";
  }

  const text =
    cleanText(
      stockMatch[1]
    ).toLowerCase();

  if (
    text.includes("out of stock") ||
    text.includes("out-of-stock") ||
    text.includes("unavailable")
  ) {
    return "Out of stock";
  }

  if (
    text.includes("in stock") ||
    text.includes("available")
  ) {
    return "Available";
  }

  return "Check store";
}


// ============================================================
// EXTRACT PRODUCT IMAGE
// ============================================================

function extractProductImage(html) {

  // ----------------------------------------------------------
  // JSON-LD
  // ----------------------------------------------------------

  const jsonLdMatches = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  for (
    const match
    of jsonLdMatches
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
        const object
        of objects
      ) {

        if (
          !object ||
          !object.image
        ) {
          continue;
        }

        if (
          typeof object.image ===
          "string" &&
          object.image.startsWith("http")
        ) {
          return object.image;
        }

        if (
          Array.isArray(object.image) &&
          object.image.length
        ) {
          const image =
            object.image[0];

          if (
            typeof image === "string" &&
            image.startsWith("http")
          ) {
            return image;
          }
        }

        if (
          object.image &&
          typeof object.image === "object" &&
          object.image.url
        ) {
          return object.image.url;
        }
      }

    } catch (error) {
      // Ignore invalid JSON
    }
  }

  // ----------------------------------------------------------
  // og:image
  // ----------------------------------------------------------

  const ogImage =
    html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    );

  if (
    ogImage &&
    ogImage[1]
  ) {
    return decodeHtml(
      ogImage[1]
    );
  }

  // ----------------------------------------------------------
  // Reverse og:image order
  // ----------------------------------------------------------

  const ogImageReverse =
    html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
    );

  if (
    ogImageReverse &&
    ogImageReverse[1]
  ) {
    return decodeHtml(
      ogImageReverse[1]
    );
  }

  // ----------------------------------------------------------
  // WooCommerce image
  // ----------------------------------------------------------

  const imageMatches = [
    ...html.matchAll(
      /<img[^>]*>/gi
    )
  ];

  for (
    const match
    of imageMatches
  ) {

    const tag =
      match[0];

    if (
      !(
        tag.includes("wp-post-image") ||
        tag.includes("woocommerce") ||
        tag.includes("product")
      )
    ) {
      continue;
    }

    const srcMatch =
      tag.match(
        /\s(?:src|data-src)=["']([^"']+)["']/i
      );

    if (
      srcMatch &&
      srcMatch[1]
    ) {
      return decodeHtml(
        srcMatch[1]
      );
    }

    const srcsetMatch =
      tag.match(
        /\ssrcset=["']([^"']+)["']/i
      );

    if (
      srcsetMatch &&
      srcsetMatch[1]
    ) {

      const first =
        srcsetMatch[1]
          .split(",")[0]
          .trim()
          .split(/\s+/)[0];

      if (first) {
        return decodeHtml(first);
      }
    }
  }

  return "";
}


// ============================================================
// EXTRACT NUMBERS
// ============================================================

function extractNumbers(text) {

  const cleaned =
    cleanText(text);

  const matches =
    cleaned.match(
      /\d+(?:,\d{3})*(?:\.\d{1,2})?/g
    );

  if (!matches) {
    return [];
  }

  return matches
    .map(
      value =>
        Number(
          value.replace(
            /,/g,
            ""
          )
        )
    )
    .filter(
      validPrice
    );
}


// ============================================================
// VALID PRICE
// ============================================================

function validPrice(price) {

  return (
    Number.isFinite(price) &&
    price > 10 &&
    price < 10000000
  );
}


// ============================================================
// CLEAN HTML
// ============================================================

function cleanText(text) {

  return String(text || "")
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
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
      /&#39;/gi,
      "'"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


// ============================================================
// DECODE HTML ENTITIES
// ============================================================

function decodeHtml(text) {

  return String(text || "")
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    );
}


// ============================================================
// EXPORT
// ============================================================

module.exports =
  searchNeptronics;
