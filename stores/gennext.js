const genericSearch =
  require("./genericstore");

module.exports =
  function searchGenNext(searchTerm) {

    return genericSearch(
      searchTerm,
      {

        storeName:
          "GenNext",

        logName:
          "GenNext",

        baseUrl:
          "https://gennext.com.np",

        searchUrl:
          query =>
            `https://gennext.com.np/?s=${encodeURIComponent(query)}&post_type=product`,

        cardSelectors: [

          ".product",

          "li.product",

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
