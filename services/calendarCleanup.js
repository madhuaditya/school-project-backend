const CalendarEvent = require('../models/calendar');

const CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 24;

const cleanupExpiredCalendarEvents = async () => {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 4);
  const result = await CalendarEvent.deleteMany({ endDate: { $lt: cutoffDate } });

  return {
    cutoffDate,
    deletedCount: result.deletedCount || 0,
  };
};

const startCalendarCleanupScheduler = () => {
  const runCleanup = async () => {
    try {
      const result = await cleanupExpiredCalendarEvents();
      if (result.deletedCount > 0) {
        console.log(`Calendar cleanup removed ${result.deletedCount} expired events`);
      }
    } catch (error) {
      console.error('Calendar cleanup failed:', error.message);
    }
  };

  runCleanup();
  setInterval(runCleanup, CLEANUP_INTERVAL_MS);
};

module.exports = {
  cleanupExpiredCalendarEvents,
  startCalendarCleanupScheduler,
};