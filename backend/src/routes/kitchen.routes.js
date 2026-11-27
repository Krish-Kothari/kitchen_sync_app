const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  getMyProfile,
  verifyKitchenLocation,
  updatePushToken,
  getNearbyKitchens,
} = require('../controllers/kitchen.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/me', getMyProfile);
router.patch('/me/location', verifyKitchenLocation);
router.patch('/me/push-token', updatePushToken);
router.get('/nearby', getNearbyKitchens);

module.exports = router;
