
const cheerio = require("cheerio");

const BASE_URL = "https://hukut.com";

async function searchHukut(query) {
  try {
    console.log(`Hukut: searching for "${query}"`);

    const searchUrl =
      `${BASE_URL}/search?q=${encodeURIComponent(query)}`;

    console.log(`Hukut URL: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
      timeout: 15000
    });

    console.log(
      `Hukut search status: ${response.status}`
    );

    if (!response.ok) {
      throw new Error(
        `Hukut returned ${response.status}`
      );
    }

    const html = await response.text();

    console.log(
      `Hukut: received ${html.length} characters`
    );

    const $ = cheerio.load(html);

    const results = [];
    const seen = new Set();

    /*
     * First try to extract product cards directly
     */

    const selectors = [
      "[class*='product']",
      "[class*='Product']",
      "[data-product]",
      "article"
    ];

    for (const selector of selectors) {

      $(selector).each((index, element) => {

        const el = $(element);

        const href =
          el.find("a[href]").first().attr("href");

        if (!href) return;

        const url =
          href.startsWith("http")
            ? href
            : new URL(href, BASE_URL).href;

        if (seen.has(url)) return;

        const name =
          el.find(
            "h1,h2,h3,h4," +
            "[class*='title'], " +
            "[class*='Title'], " +
            "[class*='name'], " +
            "[class*='Name']"
          )
          .first()
          .text()
          .trim();

        const priceText =
          el.find(
            "[class*='price'], " +
            "[class*='Price'], " +
            "[class*='amount'], " +
            "[class*='Amount']"
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

          seen.add(url);

          results.push({
            name,
            price,
            shipping: 0,
            total: price,
            store: "Hukut",
            availability: "Check store",
            url
          });

        }
      });

      if (results.length >= 10) {
        break;
      }
    }


    /*
     * If cards don't expose the price,
     * visit the product pages.
     */

    if (results.length === 0) {

      const productLinks = [];

      $("a[href]").each((index, element) => {

        const href =
          $(element).attr("href");

        if (!href) return;

        const url =
          href.startsWith("http")
            ? href
            : new URL(href, BASE_URL).href;

        if (
          url.startsWith(BASE_URL) &&
          !productLinks.includes(url) &&
          !url.includes("/search")
        ) {
          productLinks.push(url);
        }

      });

      console.log(
        `Hukut: found ${productLinks.length} possible product links`
      );

      for (
        const url of productLinks.slice(0, 15)
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
              `Hukut product status ${productResponse.status}: ${url}`
            );
            continue;
          }

          const productHtml =
            await productResponse.text();

          const page =
            cheerio.load(productHtml);

          const name =
            page(
              "h1, " +
              "[class*='product-title'], " +
              "[class*='ProductTitle'], " +
              "[class*='product-name']"
            )
            .first()
            .text()
            .trim();

          const priceText =
            page(
              "[class*='price'], " +
              "[class*='Price'], " +
              "[class*='amount'], " +
              "[class*='Amount']"
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

            results.push({
              name,
              price,
              shipping: 0,
              total: price,
              store: "Hukut",
              availability: "Check store",
              url
            });

          }

        } catch (error) {

          console.log(
            `Hukut product error: ${error.message}`
          );

        }
      }
    }


    /*
     * Remove duplicates
     */

    const uniqueResults =
      results.filter(
        (item, index, array) =>
          index ===
          array.findIndex(
            other =>
              other.url === item.url
          )
      );

    console.log(
      `Hukut: returning ${uniqueResults.length} results for "${query}"`
    );

    return uniqueResults;

  } catch (error) {

    console.error(
      "Hukut search error:",
      error.message
    );

    return [];
  }
}


function parsePrice(text) {

  if (!text) return 0;

  const matches =
    String(text)
      .replace(/,/g, "")
      .match(/\d+(?:\.\d+)?/g);

  if (!matches) return 0;

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


module.exports = searchHukut;
