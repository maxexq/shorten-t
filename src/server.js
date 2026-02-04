require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');
const config = require('./config');

const startServer = async () => {
  await connectDB();

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Base URL: ${config.baseUrl}`);
  });
};

startServer();
