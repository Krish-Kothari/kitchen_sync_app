const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { listCatalog, getCommodityById } = require('../controllers/catalog.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', listCatalog);
router.get('/:commodityId', getCommodityById);

module.exports = router;
