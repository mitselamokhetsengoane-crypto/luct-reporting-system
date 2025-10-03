// Backend routes for monitoring
// routes/monitoring.js

router.get('/performance', async (req, res) => {
  try {
    // Get real performance metrics from your system
    const performanceData = await MonitoringService.getPerformanceMetrics();
    res.json(performanceData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/health', async (req, res) => {
  try {
    // Get system health status
    const healthData = await MonitoringService.getSystemHealth();
    res.json(healthData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/activity', async (req, res) => {
  try {
    const { range } = req.query;
    const activityData = await MonitoringService.getActivityLogs(range);
    res.json(activityData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/trends', async (req, res) => {
  try {
    const trendData = await MonitoringService.getTrendData();
    res.json(trendData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/alerts', async (req, res) => {
  try {
    const alerts = await MonitoringService.getAlerts();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});