const Subscription = require('../models/subscription');

const formatResponse = (success, msg, data = null, error = null) => ({
  success,
  msg,
  ...(data && { data }),
  ...(error && { error }),
});

const getSchoolIdFromRequest = (req) => {
  const schoolId = req.user?.school?._id || req.user?.school || req.user?._id;
  return schoolId ? schoolId.toString() : null;
};

const getSubscriptionState = (subscription) => {
  if (!subscription) {
    return {
      isActive: false,
      status: 'inactive',
      expiresAt: null,
      daysRemaining: 0,
    };
  }

  const isTrial = subscription.status === 'trial';
  const effectiveEndDate = isTrial
    ? (subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : (subscription.endsAt ? new Date(subscription.endsAt) : null))
    : (subscription.endsAt ? new Date(subscription.endsAt) : null);
  const now = new Date();
  const activeByDate = !effectiveEndDate || effectiveEndDate.getTime() >= now.getTime();
  const isActive = (subscription.status === 'active' || isTrial) && activeByDate;

  const daysRemaining = effectiveEndDate
    ? Math.max(0, Math.ceil((effectiveEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    isActive,
    status: isActive ? (isTrial ? 'trial' : 'active') : (subscription.status === 'expired' || !activeByDate ? 'expired' : subscription.status),
    expiresAt: effectiveEndDate || null,
    daysRemaining,
  };
};

const checkSubscriptionActive = async (req, res, next) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context is required'));
    }

    const subscription = await Subscription.findOne({ school: schoolId }).populate('school', '_id schoolName schoolId');
    const state = getSubscriptionState(subscription);

    req.subscription = subscription;
    req.subscriptionState = state;

    if (!state.isActive) {
      return res.status(402).json(
        formatResponse(false, 'Your school subscription plan is inactive or expired. Please renew to continue.', {
          subscription: subscription
            ? {
                _id: subscription._id,
                school: subscription.school,
                planName: subscription.planName,
                status: state.status,
                startsAt: subscription.startsAt,
                endsAt: subscription.endsAt,
                daysRemaining: state.daysRemaining,
              }
            : null,
        })
      );
    }

    return next();
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error validating subscription', null, error.message));
  }
};

module.exports = {
  checkSubscriptionActive,
  getSchoolIdFromRequest,
  getSubscriptionState,
};