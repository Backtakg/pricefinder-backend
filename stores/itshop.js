const genericSearch =
  require("./genericstore");

module.exports =
  function searchITShop(searchTerm) {

    return genericSearch(
      searchTerm,
      {

        storeName:
          "IT Shop",

        logName:
          "IT Shop",

        baseUrl:
          "https://itshop.com.np",

        searchUrl:
          query =>
            `https://itshop.com.np/?s=${encodeURIComponent(query)}&post_type=product`,

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
