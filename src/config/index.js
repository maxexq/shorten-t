module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/shorten-t',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
};
