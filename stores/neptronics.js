const fetch = require("node-fetch");
const cheerio = require("cheerio");

const BASE_URL = "https://neptronics.com.np";

async function searchNeptronics(query) {
  try {
    console.log(`Neptronics: searching for "${query}"`);

    const searchUrl =
      `${BASE_URL}/?s=${encodeURIComponent(query)}&post_type=product`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":
          "en-US,en;q=0.9"
      },
      timeout: 15000
    });

    console.log(
      `Neptronics search status: ${response.status}`
    );

    if (!response.ok) {
      throw new Error(
        `Neptronics search returned ${response.status}`
      );
    }

    const html = await response.text();

    console.log(
      `Neptronics: received ${html.length} characters`
    );

    const $ = cheerio.load(html);

    const products = [];

    /*
     * Try several common WooCommerce product selectors.
     * This makes the scraper less dependent on one exact
     * HTML class name.
     */

    const selectors = [
      "li.product",
      ".product",
      ".type-product",
      ".products .product",
      ".product-grid-item",
      ".product-item"
    ];

    const seen = new Set();

    for (const selector of selectors) {

      $(selector).each((index, element) => {

        const el = $(element);

        const link =
          el.find("a").first().attr("href") ||
          el.attr("href");

        if (!link) return;

        const url =
          link.startsWith("http")
            ? link
            : new URL(link, BASE_URL).href;

        if (seen.has(url)) return;

        const name =
          el.find(
            ".woocommerce-loop-product__title, " +
            ".product-title, " +
            ".woocommerce-loop-product__title a, " +
            "h2, h3"
          )
          .first()
          .text()
          .trim();

        const priceText =
          el.find(
            ".price, " +
            ".woocommerce-Price-amount, " +
            ".amount"
          )
          .first()
          .text()
          .trim();

        const price = parsePrice(priceText);

        if (
          name &&
          price > 0
        ) {
          seen.add(url);

          products.push({
            name,
            price,
            shipping: 0,
            total: price,
            store: "Neptronics",
            availability: "Check store",
            url
          });
        }
      });

      if (products.length >= 10) {
        break;
      }
    }

    /*
     * Fallback: collect product links and visit individual
     * product pages if listing cards did not contain prices.
     */

    if (products.length === 0) {

      const links = [];

      $("a[href]").each((index, element) => {

        const href =
          $(element).attr("href");

        if (!href) return;

        const url =
          href.startsWith("http")
            ? href
            : new URL(href, BASE_URL).href;

        if (
          url.includes("/product/") &&
          !links.includes(url)
        ) {
          links.push(url);
        }
      });

      console.log(
        `Neptronics: found ${links.length} product links`
      );

      for (
        const url of links.slice(0, 10)
      ) {

        try {

          const productResponse =
            await fetch(url, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
              },
              timeout: 15000
            });

          if (!productResponse.ok) {
            console.log(
              `Neptronics product status ${productResponse.status}: ${url}`
            );
            continue;
          }

          const productHtml =
            await productResponse.text();

          const page =
            cheerio.load(productHtml);

          const name =
            page(
              "h1.product_title, " +
              "h1.entry-title, " +
              "h1"
            )
            .first()
            .text()
            .trim();

          const priceText =
            page(
              ".summary .price, " +
              ".woocommerce-Price-amount, " +
              "p.price, " +
              ".price"
            )
            .first()
            .text()
            .trim();

          const price =
            parsePrice(priceText);

          if (
            name &&
            price > 0
          ) {

            products.push({
              name,
              price,
              shipping: 0,
              total: price,
              store: "Neptronics",
              availability: "Check store",
              url
            });

          }

        } catch (error) {

          console.log(
            `Neptronics product error: ${error.message}`
          );

        }
      }
    }

    console.log(
      `Neptronics: returning ${products.length} results for "${query}"`
    );

    return products;

  } catch (error) {

    console.error(
      "Neptronics search error:",
      error.message
    );

    return [];
  }
}


function parsePrice(text) {

  if (!text) return 0;

  const cleaned =
    String(text)
      .replace(/,/g, "")
      .replace(/[^\d.]/g, " ");

  const matches =
    cleaned.match(/\d+(?:\.\d+)?/g);

  if (!matches || !matches.length) {
    return 0;
  }

  /*
   * Use the first sensible price.
   */

  for (const value of matches) {

    const number =
      Number(value);

    if (
      Number.isFinite(number) &&
      number > 0
    ) {
      return number;
    }
  }

  return 0;
}


module.exports = searchNeptronics;      console.log(
        "Neptronics search status:",
        response.status
      );

      return [];
    }

    const html = await response.text();

    // --------------------------------------------------------
    // FIND PRODUCT LINKS
    // --------------------------------------------------------

    const matches = [
      ...html.matchAll(
        /href\s*=\s*["']([^"']*\/product\/[^"']+)["']/gi
      )
    ];

    const productUrls = [];
    const seen = new Set();

    for (const match of matches) {
      let productUrl = match[1];

      productUrl = decodeHtml(productUrl);

      if (!productUrl.startsWith("http")) {
        productUrl =
          "https://neptronics.com" +
          productUrl;
      }

      // Remove query parameters
      productUrl =
        productUrl.split("?")[0];

      if (!seen.has(productUrl)) {
        seen.add(productUrl);
        productUrls.push(productUrl);
      }
    }

    console.log(
      `Neptronics: found ${productUrls.length} product links`
    );

    const results = [];

    // Check maximum 15 products
    const urlsToCheck =
      productUrls.slice(0, 15);

    // --------------------------------------------------------
    // OPEN PRODUCT PAGES
    // --------------------------------------------------------

    for (const productUrl of urlsToCheck) {
      try {
        const productResponse =
          await fetch(productUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",

              "Accept":
                "text/html,application/xhtml+xml"
            }
          });

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

        // ----------------------------------------------------
        // PRODUCT NAME
        // ----------------------------------------------------

        let productName = "";

        const h1Match =
          productHtml.match(
            /<h1[^>]*>([\s\S]*?)<\/h1>/i
          );

        if (h1Match) {
          productName =
            cleanText(h1Match[1]);
        }

        // Fallback to title
        if (!productName) {
          const titleMatch =
            productHtml.match(
              /<title[^>]*>([\s\S]*?)<\/title>/i
            );

          if (titleMatch) {
            productName =
              cleanText(
                titleMatch[1]
                  .replace(/\s*[-|].*$/, "")
              );
          }
        }

        if (!productName) {
          continue;
        }

        // ----------------------------------------------------
        // CHECK PRODUCT MATCHES SEARCH
        // ----------------------------------------------------

        const nameLower =
          productName.toLowerCase();

        const searchLower =
          searchTerm.toLowerCase();

        const searchWords =
          searchLower
            .split(/\s+/)
            .filter(word => word.length > 0);

        const matchesSearch =
          nameLower.includes(searchLower) ||
          searchWords.some(word =>
            nameLower.includes(word)
          );

        if (!matchesSearch) {
          continue;
        }

        // ----------------------------------------------------
        // PRODUCT PRICE
        // ----------------------------------------------------

        const productPrice =
          extractProductPrice(productHtml);

        console.log(
          `Neptronics: ${productName} -> price: ${productPrice}`
        );

        // ----------------------------------------------------
        // AVAILABILITY
        // ----------------------------------------------------

        let availability =
          "Check store";

        const stockMatch =
          productHtml.match(
            /<p[^>]*class=["'][^"']*stock[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
          );

        if (stockMatch) {
          const stockText =
            cleanText(
              stockMatch[1]
            ).toLowerCase();

          if (
            stockText.includes(
              "out of stock"
            ) ||
            stockText.includes(
              "out-of-stock"
            )
          ) {
            availability =
              "Out of stock";
          } else if (
            stockText.includes(
              "in stock"
            ) ||
            stockText.includes(
              "available"
            )
          ) {
            availability =
              "Available";
          }
        }

        // ----------------------------------------------------
        // PRODUCT IMAGE
        // ----------------------------------------------------

        const productImage =
          extractProductImage(
            productHtml
          );

        console.log(
          `Neptronics image: ${productImage || "not found"}`
        );

        // ----------------------------------------------------
        // TOTAL
        // ----------------------------------------------------

        const shipping = 0;

        const total =
          Number.isFinite(
            Number(productPrice)
          )
            ? Number(productPrice) +
              shipping
            : null;

        // ----------------------------------------------------
        // ADD RESULT
        // ----------------------------------------------------

        results.push({
          name: productName,

          store: "Neptronics",

          price:
            productPrice,

          shipping:
            shipping,

          total:
            total,

          availability:
            availability,

          url:
            productUrl,

          image:
            productImage,

          source:
            "Neptronics",

          lastUpdated:
            new Date().toISOString()
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


// ============================================================
// EXTRACT PRODUCT PRICE
// ============================================================

function extractProductPrice(html) {

  // ----------------------------------------------------------
  // METHOD 1: JSON-LD
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

        if (
          object &&
          object.offers &&
          !Array.isArray(
            object.offers
          ) &&
          object.offers.price
        ) {

          const price =
            Number(
              String(
                object.offers.price
              ).replace(
                /,/g,
                ""
              )
            );

          if (validPrice(price)) {
            return price;
          }
        }

        if (
          object &&
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
                  ).replace(
                    /,/g,
                    ""
                  )
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
  // METHOD 2: itemprop price
  // ----------------------------------------------------------

  const itemPropMatch =
    html.match(
      /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i
    );

  if (itemPropMatch) {

    const price =
      Number(
        itemPropMatch[1]
          .replace(
            /,/g,
            ""
          )
      );

    if (validPrice(price)) {
      return price;
    }
  }


  // ----------------------------------------------------------
  // METHOD 3: content before itemprop
  // ----------------------------------------------------------

  const itemPropReverse =
    html.match(
      /content=["']([\d,.]+)["'][^>]*itemprop=["']price["']/i
    );

  if (itemPropReverse) {

    const price =
      Number(
        itemPropReverse[1]
          .replace(
            /,/g,
            ""
          )
      );

    if (validPrice(price)) {
      return price;
    }
  }


  // ----------------------------------------------------------
  // METHOD 4: WooCommerce price
  // ----------------------------------------------------------

  const priceBlocks = [
    ...html.matchAll(
      /class=["'][^"']*(?:price|woocommerce-Price-amount)[^"']*["'][^>]*>([\s\S]{0,500})<\/(?:p|span|div)>/gi
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

    if (
      prices.length > 0
    ) {

      const price =
        prices[
          prices.length - 1
        ];

      if (
        validPrice(price)
      ) {
        return price;
      }
    }
  }


  // ----------------------------------------------------------
  // METHOD 5: Rs / ₨ / रु
  // ----------------------------------------------------------

  const rupeeMatches = [
    ...html.matchAll(
      /(?:₨|Rs\.?|रु\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi
    )
  ];

  const rupeePrices = [];

  for (
    const match
    of rupeeMatches
  ) {

    const price =
      Number(
        match[1]
          .replace(
            /,/g,
            ""
          )
      );

    if (
      validPrice(price)
    ) {
      rupeePrices.push(
        price
      );
    }
  }

  if (
    rupeePrices.length > 0
  ) {
    return rupeePrices[0];
  }


  // ----------------------------------------------------------
  // METHOD 6: BDI
  // ----------------------------------------------------------

  const bdiMatches = [
    ...html.matchAll(
      /<bdi[^>]*>([\s\S]*?)<\/bdi>/gi
    )
  ];

  for (
    const bdiMatch
    of bdiMatches
  ) {

    const prices =
      extractNumbers(
        bdiMatch[1]
      );

    if (
      prices.length > 0
    ) {

      const price =
        prices[
          prices.length - 1
        ];

      if (
        validPrice(price)
      ) {
        return price;
      }
    }
  }


  // Nothing found
  return null;
}


// ============================================================
// EXTRACT PRODUCT IMAGE
// ============================================================

function extractProductImage(html) {

  // ----------------------------------------------------------
  // METHOD 1: JSON-LD IMAGE
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
          object &&
          object.image
        ) {

          let imageUrl = "";

          if (
            typeof object.image ===
            "string"
          ) {
            imageUrl =
              object.image;
          }

          else if (
            Array.isArray(
              object.image
            ) &&
            object.image.length > 0
          ) {
            imageUrl =
              object.image[0];
          }

          else if (
            object.image.url
          ) {
            imageUrl =
              object.image.url;
          }

          if (
            imageUrl &&
            imageUrl.startsWith(
              "http"
            )
          ) {
            return imageUrl;
          }
        }
      }

    } catch (error) {
      // Ignore invalid JSON
    }
  }


  // ----------------------------------------------------------
  // METHOD 2: og:image
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
  // METHOD 3: content before property
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
  // METHOD 4: WooCommerce product image
  // ----------------------------------------------------------

  const productImage =
    html.match(
      /<img[^>]*(?:wp-post-image|woocommerce-product-gallery__image|attachment-woocommerce_thumbnail)[^>]*>/i
    );

  if (
    productImage &&
    productImage[0]
  ) {

    const imageTag =
      productImage[0];

    const srcMatch =
      imageTag.match(
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

    // srcset fallback
    const srcsetMatch =
      imageTag.match(
        /\ssrcset=["']([^"']+)["']/i
      );

    if (
      srcsetMatch &&
      srcsetMatch[1]
    ) {

      const firstImage =
        srcsetMatch[1]
          .split(",")[0]
          .trim()
          .split(/\s+/)[0];

      if (firstImage) {
        return decodeHtml(
          firstImage
        );
      }
    }
  }


  // ----------------------------------------------------------
  // METHOD 5: Any product image
  // ----------------------------------------------------------

  const imageMatches = [
    ...html.matchAll(
      /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi
    )
  ];

  for (
    const match
    of imageMatches
  ) {

    const imageUrl =
      decodeHtml(
        match[1]
      );

    if (
      imageUrl &&
      imageUrl.startsWith(
        "http"
      ) &&
      (
        imageUrl.includes(
          "neptronics"
        ) ||
        imageUrl.match(
          /\.(jpg|jpeg|png|webp)/i
        )
      )
    ) {

      return imageUrl;
    }
  }


  // No image found
  return "";
}


// ============================================================
// EXTRACT NUMBERS
// ============================================================

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
