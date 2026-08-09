// ============================================================
// OLIZ STORE SEARCH
// ============================================================

async function searchOliz(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  try {
    const searchUrl =
      "https://www.olizstore.com/products?search=" +
      encodeURIComponent(searchTerm);

    console.log(
      `Oliz Store: searching for "${searchTerm}"`
    );

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
        "Oliz search status:",
        response.status
      );

      return [];
    }

    const html = await response.text();

    const results = [];
    const seen = new Set();

    // ========================================================
    // FIND PRODUCT LINKS
    // ========================================================

    const linkMatches = [
      ...html.matchAll(
        /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
      )
    ];

    const productUrls = [];

    for (const match of linkMatches) {
      let url = decodeHtml(match[1]);

      if (!url.startsWith("http")) {
        if (url.startsWith("/")) {
          url =
            "https://www.olizstore.com" +
            url;
        } else {
          continue;
        }
      }

      if (
        !url.includes(
          "olizstore.com"
        )
      ) {
        continue;
      }

      url = url.split("?")[0];

      if (
        url ===
        "https://www.olizstore.com/products"
      ) {
        continue;
      }

      if (
        url.includes("/products/")
      ) {
        if (!seen.has(url)) {
          seen.add(url);
          productUrls.push(url);
        }
      }
    }

    console.log(
      `Oliz Store: found ${productUrls.length} product links`
    );

    // ========================================================
    // OPEN PRODUCT PAGES
    // ========================================================

    const urlsToCheck =
      productUrls.slice(0, 15);

    for (
      const productUrl
      of urlsToCheck
    ) {
      try {
        const productResponse =
          await fetch(
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

        if (
          !productResponse.ok
        ) {
          console.log(
            "Oliz product status:",
            productResponse.status
          );

          continue;
        }

        const productHtml =
          await productResponse.text();

        // ====================================================
        // PRODUCT NAME
        // ====================================================

        let name = "";

        const h1Match =
          productHtml.match(
            /<h1[^>]*>([\s\S]*?)<\/h1>/i
          );

        if (h1Match) {
          name =
            cleanText(
              h1Match[1]
            );
        }

        if (!name) {
          const titleMatch =
            productHtml.match(
              /<title[^>]*>([\s\S]*?)<\/title>/i
            );

          if (titleMatch) {
            name =
              cleanText(
                titleMatch[1]
              );
          }
        }

        if (!name) {
          continue;
        }

        // ====================================================
        // CHECK SEARCH MATCH
        // ====================================================

        const nameLower =
          name.toLowerCase();

        const searchLower =
          searchTerm.toLowerCase();

        const searchWords =
          searchLower
            .split(/\s+/)
            .filter(
              word =>
                word.length > 1
            );

        const matchesQuery =
          nameLower.includes(
            searchLower
          ) ||
          searchWords.some(
            word =>
              nameLower.includes(
                word
              )
          );

        if (!matchesQuery) {
          continue;
        }

        // ====================================================
        // PRICE
        // ====================================================

        const price =
          extractOlizPrice(
            productHtml
          );

        console.log(
          `Oliz Store: ${name} -> price: ${price}`
        );

        if (
          !validPrice(price)
        ) {
          continue;
        }

        // ====================================================
        // IMAGE
        // ====================================================

        const image =
          extractOlizImage(
            productHtml
          );

        // ====================================================
        // AVAILABILITY
        // ====================================================

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

        // ====================================================
        // ADD RESULT
        // ====================================================

        results.push({
          name:
            name,

          store:
            "Oliz Store",

          price:
            price,

          shipping:
            0,

          total:
            price,

          availability:
            availability,

          url:
            productUrl,

          image:
            image,

          source:
            "Oliz Store",

          lastUpdated:
            new Date().toISOString()
        });

      } catch (error) {
        console.log(
          "Oliz product error:",
          error.message
        );
      }
    }

    console.log(
      `Oliz Store: returning ${results.length} results for "${searchTerm}"`
    );

    return results;

  } catch (error) {
    console.error(
      "Oliz search error:",
      error.message
    );

    return [];
  }
}


// ============================================================
// EXTRACT PRICE
// ============================================================

function extractOlizPrice(html) {

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
        const obj
        of objects
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
              )
                .replace(
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

        if (
          obj &&
          Array.isArray(
            obj.offers
          )
        ) {
          for (
            const offer
            of obj.offers
          ) {
            if (
              offer &&
              offer.price
            ) {
              const price =
                Number(
                  String(
                    offer.price
                  )
                    .replace(
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
      // Ignore invalid JSON
    }
  }

  // ----------------------------------------------------------
  // itemprop price
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

    if (
      validPrice(price)
    ) {
      return price;
    }
  }

  // ----------------------------------------------------------
  // meta price
  // ----------------------------------------------------------

  const metaPrice =
    html.match(
      /<meta[^>]*(?:property|name)=["'](?:product:price:amount|price)["'][^>]*content=["']([\d,.]+)["']/i
    );

  if (metaPrice) {
    const price =
      Number(
        metaPrice[1]
          .replace(
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

  // ----------------------------------------------------------
  // Rs / रु / ₨
  // ----------------------------------------------------------

  const rupeeMatches = [
    ...html.matchAll(
      /(?:Rs\.?|₨|रु\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi
    )
  ];

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
      return price;
    }
  }

  return null;
}


// ============================================================
// EXTRACT IMAGE
// ============================================================

function extractOlizImage(html) {

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
        const obj
        of objects
      ) {
        if (
          obj &&
          obj.image
        ) {
          if (
            typeof obj.image ===
            "string"
          ) {
            return makeAbsoluteUrl(
              obj.image
            );
          }

          if (
            Array.isArray(
              obj.image
            ) &&
            obj.image.length
          ) {
            return makeAbsoluteUrl(
              obj.image[0]
            );
          }

          if (
            obj.image.url
          ) {
            return makeAbsoluteUrl(
              obj.image.url
            );
          }
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
    return makeAbsoluteUrl(
      decodeHtml(
        ogImage[1]
      )
    );
  }

  // ----------------------------------------------------------
  // Reverse og:image
  // ----------------------------------------------------------

  const ogImageReverse =
    html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
    );

  if (
    ogImageReverse &&
    ogImageReverse[1]
  ) {
    return makeAbsoluteUrl(
      decodeHtml(
        ogImageReverse[1]
      )
    );
  }

  // ----------------------------------------------------------
  // Product images
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
      makeAbsoluteUrl(
        decodeHtml(
          match[1]
        )
      );

    if (
      imageUrl &&
      (
        imageUrl.includes(
          "olizstore"
        ) ||
        imageUrl.match(
          /\.(jpg|jpeg|png|webp)/i
        )
      )
    ) {
      return imageUrl;
    }
  }

  return "";
}


// ============================================================
// ABSOLUTE URL
// ============================================================

function makeAbsoluteUrl(url) {

  if (!url) {
    return "";
  }

  if (
    url.startsWith("//")
  ) {
    return "https:" + url;
  }

  if (
    url.startsWith("/")
  ) {
    return (
      "https://www.olizstore.com" +
      url
    );
  }

  return url;
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

  return String(
    text || ""
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
      /\s+/g,
      " "
    )
    .trim();
}


// ============================================================
// DECODE HTML
// ============================================================

function decodeHtml(text) {

  return String(
    text || ""
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
  searchOliz;
