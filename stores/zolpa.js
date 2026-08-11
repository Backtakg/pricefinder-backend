const genericSearch =
  require("./genericstore");

module.exports =
  function searchZolpa(searchTerm) {

    return genericSearch(
      searchTerm,
      {

        storeName:
          "Zolpa Store",

        logName:
          "Zolpa Store",

        baseUrl:
          "https://zolpastore.com",

        searchUrl:
          query =>
            `https://zolpastore.com/?s=${encodeURIComponent(query)}&post_type=product`,

        cardSelectors: [

          "li.product",

          ".product",

          ".product-item",

          ".product-card",

          "[class*='product-item']",

          "[class*='product-card']"

        ],

        nameSelectors: [

          ".woocommerce-loop-product__title",

          ".product-title",

          "h2",

          "h3",

          "h4",

          "[class*='product-name']",

          "[class*='product-title']"

        ],

        priceSelectors: [

          ".price",

          ".woocommerce-Price-amount",

          "[class*='price']"

        ]

      }
    );

  };
