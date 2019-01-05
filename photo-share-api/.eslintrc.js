module.exports = {
  extends: ['airbnb', 'prettier'],
  rules: {
    'no-console': 'off',
    'max-len': [2, 100, 2],
    'no-underscore-dangle': 'off',
  },
  plugins: ['import-order-autofix'],
};
