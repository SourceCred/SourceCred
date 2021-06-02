// @flow
module.exports = {
  parser: "babel-eslint",
  plugins: ["flowtype", "react"],
  env: {
    browser: true,
    es6: true,
    node: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:flowtype/recommended",
  ],
  rules: {
    "prefer-const": ["warn"],
    camelcase: [
      "error",
      {properties: "never", allow: ["^_unused_.*", "(_\\d+)+"]},
    ],
    eqeqeq: ["error", "always", {null: "ignore"}],
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_$|^_unused_",
        varsIgnorePattern: "^_$|^_unused_",
        caughtErrorsIgnorePattern: "^_$|^_unused_",
      },
    ],
    "no-constant-condition": ["warn", {checkLoops: false}],
    "no-inner-declarations": ["off"],
    "no-use-before-define": ["off"],
    "no-useless-constructor": ["off"],
    "no-case-declarations": ["off"],
    "react/prop-types": ["off"],
    "flowtype/generic-spacing": ["off"],
    "flowtype/space-after-type-colon": ["off"],
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  globals: {
    BigInt: "readonly",
  },
};
