// =================================================
// IT MONSTER STORE SCRAPER
// =================================================

async function searchITMonster(query) {
  const searchTerm = String(query || "").trim().toLowerCase();

  if (!searchTerm) {
    return [];
  }

  console.log(
    `IT Monster: searching for "${searchTerm}"`
  );

  try {
    // IT Monster category pages
    const categoryUrls = [
      "https://itmonster.com.np/accessories/audio-devices",
      "https://itmonster.com.np/accessories/computer-accessories",
      "https://itmonster.com.np/accessories/laptop-accessories",
      "https://itmonster.com.np/accessories",
      "https://itmonster.com.np/pc-components",
      "https://itmonster.com.np/gaming",
      "https://itmonster.com.np/desktop",
      "https://itmonster.com.np/laptops"
    ];

    const allProducts = [];
    const seen = new Set();

    // ==========================================
    // FETCH CATEGORY PAGES
    // ==========================================

    for (const categoryUrl of categoryUrls) {
      try {
        const response = await fetch(categoryUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
            "Accept":
              "text/html,application/xhtml+xml"
          }
        });

        if (!response.ok) {
          console.log(
            `IT Monster category status: ${response.status} ${categoryUrl}`
          );
          continue;
        }

        const html = await response.text();

        console.log(
          `IT Monster: received ${html.length} characters from ${categoryUrl}`
        );

        // ======================================
        // FIND PRODUCT LINKS
        // ======================================

        const matches = [
          ...html.matchAll(
            /href\s*=\s*["']([^"']*\/product\/[^"']+)["']/gi
          )
        ];

        for (const match of matches) {
          let url = decodeHtml(match[1]);

          if (!url.startsWith("http")) {
            url =
              "https://itmonster.com.np" +
              (url.startsWith("/") ? url : "/" + url);
          }

          url = url.split("?")[0];

          if (!seen.has(url)) {
            seen.add(url);
            allProducts.push(url);
          }
        }

      } catch (error) {
        console.log(
          "IT Monster category error:",
          error.message
        );
      }
    }

    console.log(
      `IT Monster: found ${allProducts.length} possible product links`
    );

    const results = [];

    // Don't overload the site
    const urlsToCheck =
      allProducts.slice(0, 40);

    // ==========================================
    // OPEN PRODUCT PAGES
    // ==========================================

    for (const productUrl of urlsToCheck) {
      try {
        const response = await fetch(productUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
            "Accept":
              "text/html,application/xhtml+xml"
          }
        });

        if (!response.ok) {
          console.log(
            `IT Monster product status: ${response.status} ${productUrl}`
          );
          continue;
        }

        const html = await response.text();

        // ======================================
        // PRODUCT NAME
        // ======================================

        let name = "";

        const h1Match =
          html.match(
            /<h1[^>]*>([\s\S]*?)<\/h1>/i
          );

        if (h1Match) {
          name = cleanText(
            h1Match[1]
          );
        }

        // Fallback: title
        if (!name) {
          const titleMatch =
            html.match(
              /<title[^>]*>([\s\S]*?)<\/title>/i
            );

          if (titleMatch) {
            name = cleanText(
              titleMatch[1]
            )
              .replace(
                /\s*[-|].*$/,
                ""
              );
          }
        }

        if (!name) {
          continue;
        }

        // ======================================
        // CHECK QUERY MATCH
        // ======================================

        const nameLower =
          name.toLowerCase();

        const words =
          searchTerm
            .split(/\s+/)
            .filter(Boolean);

        const matchesQuery =
          nameLower.includes(searchTerm) ||
          words.some(
            word =>
              word.length >= 3 &&
              nameLower.includes(word)
          );

        if (!matchesQuery) {
          continue;
        }

        // ======================================
        // PRICE
        // ======================================

        const price =
          extractProductPrice(html);

        if (!price) {
          console.log(
            `IT Monster: no price -> ${name}`
          );
          continue;
        }

        // ======================================
        // IMAGE
        // ======================================

        const image =
          extractProductImage(
            html
          );

        // ======================================
        // AVAILABILITY
        // ======================================

        const availability =
          extractAvailability(
            html
          );

        console.log(
          `IT Monster: ${name} -> price: ${price}`
        );

        if (image) {
          console.log(
            `IT Monster image: ${image}`
          );
        }

        // ======================================
        // ADD RESULT
        // ======================================

        results.push({
          name: name,
          store: "IT Monster",
          price: price,
          shipping: 0,
          total: price,
          currency: "NPR",
          availability: availability,
          url: productUrl,
          image: image,
          source: "IT Monster",
          lastUpdated:
            new Date().toISOString()
        });

      } catch (error) {
        console.log(
          "IT Monster product error:",
          error.message
        );
      }
    }

    console.log(
      `IT Monster: returning ${results.length} results for "${searchTerm}"`
    );

    return results;

  } catch (error) {
    console.error(
      "IT Monster search error:",
      error.message
    );

    return [];
  }
}


// =================================================
// EXTRACT PRICE
// =================================================

function extractProductPrice(html) {

  // ==========================================
  // METHOD 1: JSON-LD
  // ==========================================

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

      for (const obj of objects) {

        if (
          obj &&
          obj.offers &&
          !Array.isArray(
            obj.offers
          ) &&
          obj.offers.price
        ) {

          const price =
            Number(
              String(
                obj.offers.price
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
                  ).replace(
                    /,/g,
                    ""
                  )
                );

              if (
                validPrice(
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
      // Ignore invalid JSON
    }
  }


  // ==========================================
  // METHOD 2: itemprop price
  // ==========================================

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
      validPrice(price)
    ) {
      return price;
    }
  }


  // ==========================================
  // METHOD 3: Reverse itemprop
  // ==========================================

  const reverseMatch =
    html.match(
      /content=["']([\d,.]+)["'][^>]*itemprop=["']price["']/i
    );

  if (reverseMatch) {

    const price =
      Number(
        reverseMatch[1]
          .replace(/,/g, "")
      );

    if (
      validPrice(price)
    ) {
      return price;
    }
  }


  // ==========================================
  // METHOD 4: NPR PRICE
  // ==========================================

  const rupeeMatches = [
    ...html.matchAll(
      /(?:NPR|Rs\.?|रु\.?|₨)\s*([\d,]+(?:\.\d{1,2})?)/gi
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


  // ==========================================
  // METHOD 5: PRICE CLASS
  // ==========================================

  const priceBlocks = [
    ...html.matchAll(
      /class=["'][^"']*(?:price|amount)[^"']*["'][^>]*>([\s\S]{0,500})<\/[^>]+>/gi
    )
  ];

  for (
    const match
    of priceBlocks
  ) {

    const numbers =
      extractNumbers(
        match[1]
      );

    if (
      numbers.length
    ) {

      for (
        const price
        of numbers
      ) {

        if (
          validPrice(price)
        ) {
          return price;
        }
      }
    }
  }

  return null;
}


// =================================================
// EXTRACT IMAGE
// =================================================

function extractProductImage(html) {

  // ==========================================
  // OG IMAGE
  // ==========================================

  const ogMatch =
    html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    );

  if (ogMatch) {
    return decodeHtml(
      ogMatch[1]
    );
  }


  // ==========================================
  // TWITTER IMAGE
  // ==========================================

  const twitterMatch =
    html.match(
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i
    );

  if (twitterMatch) {
    return decodeHtml(
      twitterMatch[1]
    );
  }


  // ==========================================
  // PRODUCT IMAGE
  // ==========================================

  const imageMatch =
    html.match(
      /<img[^>]+src=["']([^"']+)["'][^>]*>/i
    );

  if (imageMatch) {

    let image =
      decodeHtml(
        imageMatch[1]
      );

    if (
      !image.startsWith("http")
    ) {

      image =
        "https://itmonster.com.np" +
        (
          image.startsWith("/")
            ? image
            : "/" + image
        );
    }

    return image;
  }

  return "";
}


// =================================================
// AVAILABILITY
// =================================================

function extractAvailability(html) {

  const text =
    cleanText(html)
      .toLowerCase();

  if (
    text.includes(
      "out of stock"
    ) ||
    text.includes(
      "out-of-stock"
    )
  ) {
    return "Out of stock";
  }

  if (
    text.includes(
      "in stock"
    ) ||
    text.includes(
      "available"
    )
  ) {
    return "Available";
  }

  return "Check store";
}


// =================================================
// EXTRACT NUMBERS
// =================================================

function extractNumbers(text) {

  const matches =
    String(text)
      .match(
        /[\d]+(?:,[\d]{3})*(?:\.\d{1,2})?/g
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
// CLEAN TEXT
// =================================================

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


// =================================================
// DECODE HTML
// =================================================

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


// =================================================
// EXPORT
// =================================================

module.exports =
  searchITMonster;
