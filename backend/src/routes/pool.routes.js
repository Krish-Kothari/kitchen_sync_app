const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { idempotencyGuard } = require('../middleware/idempotency');
const {
  getNearbyPools,
  getPoolById,
  createSeedPool,
} = require('../controllers/pool.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/nearby', getNearbyPools);
router.get('/:poolId', getPoolById);
router.post('/seed', idempotencyGuard({ required: false }), createSeedPool);

module.exports = router;
