const { nanoid } = require('nanoid');

const generateShortCode = (length = 7) => {
  return nanoid(length);
};

module.exports = { generateShortCode };
