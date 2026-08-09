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
        Accept: "text/html,application/xhtml+xml"
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

    // ==========================================
    // FIND PRODUCT LINKS
    // ==========================================

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

    // Check maximum 10 products
    const urlsToCheck = productUrls.slice(0, 10);

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
              Accept:
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

        if (
          !name
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        ) {
          continue;
        }

        // ==========================================
        // FIND PRICE
        // ==========================================

        const price =
          extractProductPrice(productHtml);

        console.log(
          `Neptronics: ${name} -> price: ${price}`
        );

        // ==========================================
        // FIND PRODUCT IMAGE
        // ==========================================

        const image =
          extractProductImage(
            productHtml,
            productUrl
          );

        console.log(
          `Neptronics: ${name} -> image: ${image}`
        );

        // ==========================================
        // AVAILABILITY
        // ==========================================

        let availability = "Check store";

        const stockMatch = productHtml.match(
          /<p[^>]*class=["'][^"']*stock[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
        );

        if (stockMatch) {
          const stockText =
            cleanText(stockMatch[1]).toLowerCase();

          if (
            stockText.includes("out of stock") ||
            stockText.includes("out-of-stock")
          ) {
            availability = "Out of stock";
          } else if (
            stockText.includes("in stock") ||
            stockText.includes("available")
          ) {
            availability = "Available";
          }
        }

        // ==========================================
        // ADD RESULT
        // ==========================================

      // -----------------------------------------
// PRODUCT IMAGE
// -----------------------------------------

let image = "";

// Try Open Graph image first
const ogImageMatch = productHtml.match(
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
);

if (ogImageMatch) {
  image = decodeHtml(ogImageMatch[1]);
}

// Try WooCommerce product image
if (!image) {
  const productImageMatch = productHtml.match(
    /<img[^>]+class=["'][^"']*(?:wp-post-image|woocommerce-product-gallery__image)[^"']*["'][^>]+src=["']([^"']+)["']/i
  );

  if (productImageMatch) {
    image = decodeHtml(productImageMatch[1]);
  }
}

// Try data-src for lazy-loaded images
if (!image) {
  const lazyImageMatch = productHtml.match(
    /<img[^>]+(?:data-src|data-lazy-src)=["']([^"']+)["']/i
  );

  if (lazyImageMatch) {
    image = decodeHtml(lazyImageMatch[1]);
  }
}

// Make relative image URL absolute
if (
  image &&
  !image.startsWith("http")
) {
  image =
    "https://neptronics.com" +
    (image.startsWith("/") ? "" : "/") +
    image;
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
  image: image,
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
// EXTRACT PRODUCT IMAGE
// =================================================

function extractProductImage(html, productUrl) {

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

        if (!obj) {
          continue;
        }

        // Direct image
        if (obj.image) {

          let image = obj.image;

          if (Array.isArray(image)) {
            image = image[0];
          }

          if (
            typeof image === "object" &&
            image.url
          ) {
            image = image.url;
          }

          if (typeof image === "string") {
            return makeAbsoluteUrl(
              decodeHtml(image),
              productUrl
            );
          }
        }

        // Product object inside @graph
        if (Array.isArray(obj["@graph"])) {

          for (const graphItem of obj["@graph"]) {

            if (
              graphItem &&
              graphItem.image
            ) {

              let image =
                graphItem.image;

              if (Array.isArray(image)) {
                image = image[0];
              }

              if (
                typeof image === "object" &&
                image.url
              ) {
                image = image.url;
              }

              if (
                typeof image === "string"
              ) {
                return makeAbsoluteUrl(
                  decodeHtml(image),
                  productUrl
                );
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
  // METHOD 2: OG IMAGE
  // -----------------------------------------

  const ogImageMatch = html.match(
    /<meta[^>]*(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );

  if (ogImageMatch) {
    return makeAbsoluteUrl(
      decodeHtml(ogImageMatch[1]),
      productUrl
    );
  }

  // Alternative order of attributes
  const ogImageReverse = html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["'][^>]*>/i
  );

  if (ogImageReverse) {
    return makeAbsoluteUrl(
      decodeHtml(ogImageReverse[1]),
      productUrl
    );
  }


  // -----------------------------------------
  // METHOD 3: TWITTER IMAGE
  // -----------------------------------------

  const twitterImageMatch = html.match(
    /<meta[^>]*(?:property|name)=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );

  if (twitterImageMatch) {
    return makeAbsoluteUrl(
      decodeHtml(twitterImageMatch[1]),
      productUrl
    );
  }

  const twitterImageReverse = html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']twitter:image["'][^>]*>/i
  );

  if (twitterImageReverse) {
    return makeAbsoluteUrl(
      decodeHtml(twitterImageReverse[1]),
      productUrl
    );
  }


  // -----------------------------------------
  // METHOD 4: WOOCOMMERCE PRODUCT IMAGE
  // -----------------------------------------

  const wooImageMatch = html.match(
    /<img[^>]*(?:class=["'][^"']*(?:wp-post-image|woocommerce-product-gallery__image|attachment-woocommerce_thumbnail)[^"']*["'])[^>]*>/i
  );

  if (wooImageMatch) {

    const image =
      extractImageFromTag(
        wooImageMatch[0]
      );

    if (image) {
      return makeAbsoluteUrl(
        image,
        productUrl
      );
    }
  }


  // -----------------------------------------
  // METHOD 5: PRODUCT IMAGE CONTAINER
  // -----------------------------------------

  const productImageMatch = html.match(
    /<div[^>]*class=["'][^"']*(?:woocommerce-product-gallery|product-image|product-thumbnail)[^"']*["'][^>]*>[\s\S]{0,5000}?<img[^>]*>/i
  );

  if (productImageMatch) {

    const imageTag =
      productImageMatch[0].match(
        /<img[^>]*>/i
      );

    if (imageTag) {

      const image =
        extractImageFromTag(
          imageTag[0]
        );

      if (image) {
        return makeAbsoluteUrl(
          image,
          productUrl
        );
      }
    }
  }


  // -----------------------------------------
  // METHOD 6: FIRST LARGE JPG/PNG/WEBP IMAGE
  // -----------------------------------------

  const imageMatches = [
    ...html.matchAll(
      /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["'][^>]*>/gi
    )
  ];

  for (const match of imageMatches) {

    const image =
      decodeHtml(match[1]);

    // Ignore obvious logos/icons
    const lower =
      image.toLowerCase();

    if (
      lower.includes("logo") ||
      lower.includes("icon") ||
      lower.includes("avatar") ||
      lower.includes("facebook") ||
      lower.includes("instagram")
    ) {
      continue;
    }

    return makeAbsoluteUrl(
      image,
      productUrl
    );
  }


  // -----------------------------------------
  // NOTHING FOUND
  // -----------------------------------------

  return null;
}


// =================================================
// EXTRACT IMAGE FROM IMG TAG
// =================================================

function extractImageFromTag(tag) {

  // src
  let match = tag.match(
    /\bsrc=["']([^"']+)["']/i
  );

  if (match) {
    return decodeHtml(match[1]);
  }

  // data-src
  match = tag.match(
    /\bdata-src=["']([^"']+)["']/i
  );

  if (match) {
    return decodeHtml(match[1]);
  }

  // data-lazy-src
  match = tag.match(
    /\bdata-lazy-src=["']([^"']+)["']/i
  );

  if (match) {
    return decodeHtml(match[1]);
  }

  // srcset
  match = tag.match(
    /\bsrcset=["']([^"']+)["']/i
  );

  if (match) {

    const firstImage =
      match[1]
        .split(",")[0]
        .trim()
        .split(/\s+/)[0];

    if (firstImage) {
      return decodeHtml(firstImage);
    }
  }

  return null;
}


// =================================================
// MAKE ABSOLUTE URL
// =================================================

function makeAbsoluteUrl(
  imageUrl,
  productUrl
) {

  if (!imageUrl) {
    return null;
  }

  imageUrl = imageUrl.trim();

  // Ignore data URLs
  if (
    imageUrl.startsWith("data:")
  ) {
    return null;
  }

  // Already absolute
  if (
    imageUrl.startsWith("http://") ||
    imageUrl.startsWith("https://")
  ) {
    return imageUrl;
  }

  // Protocol-relative
  if (imageUrl.startsWith("//")) {
    return "https:" + imageUrl;
  }

  try {

    return new URL(
      imageUrl,
      productUrl
    ).href;

  } catch (error) {
    return null;
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

        if (!obj) {
          continue;
        }

        // Direct product price
        if (
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
          Array.isArray(obj.offers)
        ) {

          for (const offer of obj.offers) {

            if (
              offer &&
              offer.price
            ) {

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

      const price =
        prices[prices.length - 1];

      if (validPrice(price)) {
        return price;
      }
    }
  }


  // -----------------------------------------
  // METHOD 5: Rs / ₨ price
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
    return rupeePrices[0];
  }


  // -----------------------------------------
  // METHOD 6: WooCommerce bdi
  // -----------------------------------------

  const bdiMatch = html.match(
    /<bdi[^>]*>([\s\S]*?)<\/bdi>/i
  );

  if (bdiMatch) {

    const prices =
      extractNumbers(
        bdiMatch[1]
      );

    if (prices.length) {

      const price =
        prices[prices.length - 1];

      if (validPrice(price)) {
        return price;
      }
    }
  }


  return null;
}


// =================================================
// EXTRACT NUMBERS
// =================================================

function extractNumbers(html) {

  const text =
    cleanText(html);

  const matches =
    text.match(
      /\d+(?:,\d{3})*(?:\.\d{1,2})?/g
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
