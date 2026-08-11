const genericSearch =
  require("./genericstore");

module.exports =
  function searchITShopNepal(searchTerm) {

    return genericSearch(
      searchTerm,
      {

        storeName:
          "ITShop Nepal",

        logName:
          "ITShop Nepal",

        baseUrl:
          "https://itshopnepal.com",

        searchUrl:
          query =>
            `https://itshopnepal.com/?s=${encodeURIComponent(query)}&post_type=product`,

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
