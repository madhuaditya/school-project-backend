const mongoose = require("mongoose");

const attendeeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  name: String,

  email: String,

  status: {
    type: String,
    enum: [
      "pending",
      "accepted",
      "declined",
      "tentative",
    ],
    default: "pending",
  },
});


const reminderSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["email", "notification", "sms"],
    default: "notification",
  },

  minutesBefore: {
    type: Number,
    default: 30,
  },
});


const recurrenceSchema = new mongoose.Schema({
  frequency: {
    type: String,
    enum: [
      "daily",
      "weekly",
      "monthly",
      "yearly",
    ],
  },

  interval: {
    type: Number,
    default: 1,
  },

  endDate: Date,

  daysOfWeek: [Number],
});


const calendarEventSchema = new mongoose.Schema({

  title: {
    type: String,
    required: true,
    trim: true,
  },

  school : {
    type: mongoose.Schema.Types.ObjectId,
    ref: "School",
    required: true,
  },

  description: {
    type: String,
    default: "",
  },

  location: {
    type: String,
    default: "",
  },

  startDate: {
    type: Date,
    required: true,
  },

  endDate: {
    type: Date,
    required: true,
  },

  timezone: {
    type: String,
    default: "Asia/Kolkata",
  },

  allDay: {
    type: Boolean,
    default: false,
  },

  color: {
    type: String,
    default: "#2563eb",
  },

  meetingLink: {
    type: String,
    default: "",
  },

  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  attendees: [attendeeSchema],

  reminders: [reminderSchema],

  recurrence: recurrenceSchema,

  visibility: {
    type: String,
    enum: [
      "private",
      "public",
      "team",
    ],
    default: "private",
  },

  status: {
    type: String,
    enum: [
      "confirmed",
      "cancelled",
      "draft",
    ],
    default: "confirmed",
  },

  source: {
    type: String,
    enum: [
      "internal",
      "google",
      "outlook",
      "apple",
    ],
    default: "internal",
  },

}, {
  timestamps: true,
});

module.exports = mongoose.model(
  "CalendarEvent",
  calendarEventSchema
);