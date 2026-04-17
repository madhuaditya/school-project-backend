const mongoose = require('mongoose');
const School = require('../models/school');
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

const normalizeFeatures = (features) => {
  if (!features) return [];
  if (Array.isArray(features)) return features.map((item) => String(item).trim()).filter(Boolean);
  if (typeof features === 'string') {
    return features
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const resolveDurationDays = (billingCycle, durationDays) => {
  const parsed = Number(durationDays);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }

  if (billingCycle === 'yearly') return 365;
  if (billingCycle === 'custom') return 30;
  return 30;
};

const computeEndDate = (startDate, billingCycle, durationDays) => {
  const duration = resolveDurationDays(billingCycle, durationDays);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + duration);
  return endDate;
};

const getState = (subscription) => {
  if (!subscription) {
    return {
      isActive: false,
      status: 'inactive',
      daysRemaining: 0,
    };
  }

  const now = new Date();
  const isTrial = subscription.status === 'trial';
  const effectiveEndDate = isTrial
    ? (subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : (subscription.endsAt ? new Date(subscription.endsAt) : null))
    : (subscription.endsAt ? new Date(subscription.endsAt) : null);
  const activeByDate = !effectiveEndDate || effectiveEndDate.getTime() >= now.getTime();
  const isActive = (subscription.status === 'active' || isTrial) && activeByDate;

  return {
    isActive,
    status: isActive ? (isTrial ? 'trial' : 'active') : (subscription.status === 'expired' || !activeByDate ? 'expired' : subscription.status),
    daysRemaining: effectiveEndDate ? Math.max(0, Math.ceil((effectiveEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0,
  };
};

const serializeSubscription = (subscription) => {
  if (!subscription) return null;

  const state = getState(subscription);
  return {
    _id: subscription._id,
    school: subscription.school,
    planName: subscription.planName,
    status: state.status,
    billingCycle: subscription.billingCycle,
    price: subscription.price,
    currency: subscription.currency,
    startsAt: subscription.startsAt,
    endsAt: subscription.endsAt,
    trialEndsAt: subscription.trialEndsAt,
    autoRenew: subscription.autoRenew,
    features: subscription.features || [],
    notes: subscription.notes,
    lastPaymentAt: subscription.lastPaymentAt,
    nextBillingAt: subscription.nextBillingAt,
    daysRemaining: state.daysRemaining,
    isActive: state.isActive,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
};

const getCurrentSchoolSubscription = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context is required'));
    }

    const subscription = await Subscription.findOne({ school: schoolId }).populate('school', '_id schoolName schoolId');

    return res.status(200).json(
      formatResponse(true, 'Subscription status fetched successfully', {
        schoolId,
        subscription: serializeSubscription(subscription),
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching subscription status', null, error.message));
  }
};

const createSubscription = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context is required'));
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json(formatResponse(false, 'School not found'));
    }

    const billingCycle = req.body.billingCycle || 'monthly';
    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : new Date();
    const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : computeEndDate(startsAt, billingCycle, req.body.durationDays);
    const subscriptionData = {
      school: school._id,
      planName: req.body.planName || 'Basic',
      status: req.body.status || 'active',
      billingCycle,
      price: Number(req.body.price || 0),
      currency: req.body.currency || 'INR',
      startsAt,
      endsAt,
      trialEndsAt: req.body.trialEndsAt ? new Date(req.body.trialEndsAt) : null,
      autoRenew: Boolean(req.body.autoRenew),
      features: normalizeFeatures(req.body.features),
      notes: req.body.notes || '',
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
      lastPaymentAt: req.body.lastPaymentAt ? new Date(req.body.lastPaymentAt) : startsAt,
      nextBillingAt: endsAt,
    };

    const subscription = await Subscription.findOneAndUpdate(
      { school: school._id },
      { $set: subscriptionData },
      { new: true, upsert: true, runValidators: true }
    ).populate('school', '_id schoolName schoolId');

    school.subscription = subscription._id;
    await school.save();

    return res.status(201).json(
      formatResponse(true, 'Subscription created successfully', {
        subscription: serializeSubscription(subscription),
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error creating subscription', null, error.message));
  }
};

const renewSubscription = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);
    if (!schoolId) {
      return res.status(400).json(formatResponse(false, 'School context is required'));
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json(formatResponse(false, 'School not found'));
    }

    const existing = await Subscription.findOne({ school: school._id });
    const billingCycle = req.body.billingCycle || existing?.billingCycle || 'monthly';
    const baseStart = existing?.endsAt && new Date(existing.endsAt).getTime() > Date.now()
      ? new Date(existing.endsAt)
      : new Date();
    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : baseStart;
    const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : computeEndDate(startsAt, billingCycle, req.body.durationDays);

    const subscription = await Subscription.findOneAndUpdate(
      { school: school._id },
      {
        $set: {
          planName: req.body.planName || existing?.planName || 'Basic',
          status: req.body.status || 'active',
          billingCycle,
          price: Number(req.body.price ?? existing?.price ?? 0),
          currency: req.body.currency || existing?.currency || 'INR',
          startsAt,
          endsAt,
          trialEndsAt: req.body.trialEndsAt ? new Date(req.body.trialEndsAt) : existing?.trialEndsAt || null,
          autoRenew: req.body.autoRenew !== undefined ? Boolean(req.body.autoRenew) : Boolean(existing?.autoRenew),
          features: normalizeFeatures(req.body.features).length ? normalizeFeatures(req.body.features) : existing?.features || [],
          notes: req.body.notes !== undefined ? req.body.notes : existing?.notes || '',
          updatedBy: req.user?._id || null,
          lastPaymentAt: new Date(),
          nextBillingAt: endsAt,
        },
      },
      { new: true, upsert: true, runValidators: true }
    ).populate('school', '_id schoolName schoolId');

    school.subscription = subscription._id;
    await school.save();

    return res.status(200).json(
      formatResponse(true, 'Subscription renewed successfully', {
        subscription: serializeSubscription(subscription),
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error renewing subscription', null, error.message));
  }
};

const getSubscriptionBySchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json(formatResponse(false, 'Invalid school id'));
    }

    const currentSchoolId = getSchoolIdFromRequest(req);
    if (currentSchoolId !== schoolId) {
      return res.status(403).json(formatResponse(false, 'Cannot access subscription from a different school'));
    }

    const subscription = await Subscription.findOne({ school: schoolId }).populate('school', '_id schoolName schoolId');

    return res.status(200).json(
      formatResponse(true, 'Subscription fetched successfully', {
        subscription: serializeSubscription(subscription),
      })
    );
  } catch (error) {
    return res.status(500).json(formatResponse(false, 'Error fetching subscription', null, error.message));
  }
};

module.exports = {
  createSubscription,
  renewSubscription,
  getCurrentSchoolSubscription,
  getSubscriptionBySchool,
};