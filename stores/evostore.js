const genericSearch =
  require("./genericstore");

module.exports =
  function searchEvoStore(searchTerm) {

    return genericSearch(
      searchTerm,
      {

        storeName:
          "EvoStore",

        logName:
          "EvoStore",

        baseUrl:
          "https://evostore.com.np",

        searchUrl:
          query =>
            `https://evostore.com.np/?s=${encodeURIComponent(query)}&post_type=product`,

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
