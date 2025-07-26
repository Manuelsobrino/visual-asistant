const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

router.post('/device-login', async (req, res) => {
  const { deviceId } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID required' });
  }

  const token = jwt.sign(
    { deviceId, type: 'device' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token, deviceId });
});

module.exports = router;