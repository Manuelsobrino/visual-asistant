const express = require('express');
const router = express.Router();

router.post('/process', async (req, res) => {
  res.json({ 
    message: 'Vision endpoint placeholder - will be implemented in future sprints'
  });
});

module.exports = router;