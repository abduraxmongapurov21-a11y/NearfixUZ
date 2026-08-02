const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  {
    ignores: [
      "admin-web/**",
      "backend/**",
      "dist-test/**",
      "dist-test-ios/**",
      "dist-test-web/**",
      "node_modules/**"
    ]
  },
  ...expoConfig,
  {
    rules: {
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off"
    }
  }
];
