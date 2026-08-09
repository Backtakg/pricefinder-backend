async function searchHukut(query) {
  const searchTerm = String(query || "").trim();

  if (!searchTerm) {
    return [];
  }

  try {
    const searchUrl =
      "https://hukut.com/search?q=" +
      encodeURIComponent(searchTerm);

    console.log(`Hukut: searching for "${searchTerm}"`);
    console.log(`Hukut URL: ${searchUrl}`);

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
        "Hukut search status:",
        response.status
      );
      return [];
    }

    const html = await response.text();

    console.log(
      `Hukut: received ${html.length} characters`
    );

    const results = [];

    // -----------------------------------------
    // FIND PRODUCT LINKS
    // -----------------------------------------

    const linkMatches = [
      ...html.matchAll(
        /href\s*=\s*["']([^"']+)["']/gi
      )
    ];

    const productUrls = [];
    const seen = new Set();

    for (const match of linkMatches) {
      let url = match[1];

      url = decodeHtml(url);

      if (
        !url.startsWith("http://") &&
        !url.startsWith("https://")
      ) {
        if (url.startsWith("/")) {
          url = "https://hukut.com" + url;
        } else {
          continue;
        }
      }

      if (!url.includes("hukut.com")) {
        continue;
      }

      url = url.split("?")[0];

      // Ignore non-product pages
      if (
        url.includes("/search") ||
        url.includes("/category") ||
        url.includes("/product-category") ||
        url.includes("/about") ||
        url.includes("/contact") ||
        url.includes("/compare") ||
        url.includes("/cart") ||
        url.includes("/login")
      ) {
        continue;
      }

      if (
        url === "https://hukut.com/" ||
        url === "https://hukut.com"
      ) {
        continue;
      }

      if (!seen.has(url)) {
        seen.add(url);
        productUrls.push(url);
      }
    }

    console.log(
      `Hukut: found ${productUrls.length} possible product links`
    );

    // -----------------------------------------
    // CHECK PRODUCT PAGES
    // -----------------------------------------

    const urlsToCheck =
      productUrls.slice(0, 15);

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
          continue;
        }

        const productHtml =
          await productResponse.text();

        // -----------------------------------------
        // PRODUCT NAME
        // -----------------------------------------

        let name = "";

        const h1Match =
          productHtml.match(
            /<h1[^>]*>([\s\S]*?)<\/h1>/i
          );

        if (h1Match) {
          name = cleanText(h1Match[1]);
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

        // -----------------------------------------
        // MATCH SEARCH TERM
        // -----------------------------------------

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

        // -----------------------------------------
        // PRICE
        // -----------------------------------------

        const price =
          extractHukutPrice(productHtml);

        if (!price) {
          console.log(
            `Hukut: no price found for ${name}`
          );
          continue;
        }

        // -----------------------------------------
        // IMAGE
        // -----------------------------------------

        const image =
          extractHukutImage(productHtml);

        // -----------------------------------------
        // AVAILABILITY
        // -----------------------------------------

        let availability =
          "Check store";

        const lowerHtml =
          productHtml.toLowerCase();

        if (
          lowerHtml.includes(
            "out of stock"
          ) ||
          lowerHtml.includes(
            "currently unavailable"
          ) ||
          lowerHtml.includes(
            "currently unavailable"
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
          `Hukut: ${name} -> price: ${price}`
        );

        if (image) {
          console.log(
            `Hukut image: ${image}`
          );
        }

        // -----------------------------------------
        // ADD RESULT
        // -----------------------------------------

        results.push({
          name: name,
          store: "Hukut",
          price: price,
          shipping: 0,
          total: price,
          availability: availability,
          url: productUrl,
          image: image,
          source: "Hukut",
          lastUpdated:
            new Date().toISOString()
        });

      } catch (error) {
        console.log(
          "Hukut product error:",
          error.message
        );
      }
    }

    console.log(
      `Hukut: returning ${results.length} results for "${searchTerm}"`
    );

    return results;

  } catch (error) {
    console.error(
      "Hukut search error:",
      error.message
    );

    return [];
  }
}


// =================================================
// EXTRACT HUKUT PRICE
// =================================================

function extractHukutPrice(html) {

  // -----------------------------------------
  // METHOD 1: JSON-LD
  // -----------------------------------------

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
          obj.offers &&
          !Array.isArray(obj.offers)
        ) {

          const price =
            Number(
              String(
                obj.offers.price || ""
              )
                .replace(/,/g, "")
            );

          if (validPrice(price)) {
            return price;
          }
        }

        if (
          obj &&
          Array.isArray(obj.offers)
        ) {

          for (
            const offer of obj.offers
          ) {

            const price =
              Number(
                String(
                  offer.price || ""
                )
                  .replace(/,/g, "")
              );

            if (validPrice(price)) {
              return price;
            }
          }
        }
      }

    } catch (error) {
      // Ignore invalid JSON
    }
  }

  // -----------------------------------------
  // METHOD 2: Rs. / NPR price
  // -----------------------------------------

  const priceMatches = [
    ...html.matchAll(
      /(?:Rs\.?|NPR|₨)\s*([\d,]+(?:\.\d{1,2})?)/gi
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

  if (prices.length) {
    return prices[0];
  }

  // -----------------------------------------
  // METHOD 3: itemprop price
  // -----------------------------------------

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

  return null;
}


// =================================================
// EXTRACT HUKUT IMAGE
// =================================================

function extractHukutImage(html) {

  // -----------------------------------------
  // METHOD 1: og:image
  // -----------------------------------------

  const ogImage =
    html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    );

  if (ogImage) {
    return decodeHtml(
      ogImage[1]
    );
  }

  // -----------------------------------------
  // METHOD 2: twitter:image
  // -----------------------------------------

  const twitterImage =
    html.match(
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i
    );

  if (twitterImage) {
    return decodeHtml(
      twitterImage[1]
    );
  }

  // -----------------------------------------
  // METHOD 3: first large image
  // -----------------------------------------

  const imageMatches = [
    ...html.matchAll(
      /<img[^>]*src=["']([^"']+)["']/gi
    )
  ];

  for (const match of imageMatches) {

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
        "https://hukut.com" + image;
    }

    if (
      image.startsWith("http") &&
      !image.includes("logo") &&
      !image.includes("icon")
    ) {
      return image;
    }
  }

  return "";
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

module.exports = searchHukut;
