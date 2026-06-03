const express = require('express');
const router = express.Router();
const { runDailyCronJobs } = require('../utils/cronJobs');

// POST /api/cron/daily-check
// Webhook được gọi từ Render Cron Job
router.post('/daily-check', async (req, res) => {
  // Lấy secret key từ header Authorization
  // Render sẽ gửi header: "Authorization: Bearer <CRON_SECRET>"
  const authHeader = req.headers.authorization;
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

  // Bảo mật: Nếu secret không khớp hoặc chưa được set trong .env, từ chối request
  if (!process.env.CRON_SECRET || authHeader !== expectedSecret) {
    return res.status(401).json({ message: 'Unauthorized. Invalid CRON_SECRET.' });
  }

  // Lấy instance Socket.io đã được lưu trong app ở server.js
  const io = req.app.get('io');

  try {
    // Thực thi các hàm của cron job
    await runDailyCronJobs(io);
    res.status(200).json({ message: 'Cron jobs executed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to execute cron jobs', error: err.message });
  }
});

module.exports = router;
