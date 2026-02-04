const express = require('express');
const urlRoutes = require('./urlRoutes');

const router = express.Router();

router.use('/api', urlRoutes);

module.exports = router;
