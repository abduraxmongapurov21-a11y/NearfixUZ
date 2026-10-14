const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  {
    ignores: [
      "artifacts/**",
      "dist-test*/**",
      "admin-web/**",
      "backend/**",
      "dist-test/**",
      "dist-test-ios/**",
      "dist-test-store/**",
      "dist-test-web/**",
      "dist-test-client-ui/**",
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
