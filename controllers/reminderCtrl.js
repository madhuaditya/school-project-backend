// const Reminder = require('../models/reminder');

// // ➕ CREATE REMINDER
// const createReminder = async (req, res) => {
//   const { title, description, remindAt } = req.body;

//   if (!title || !remindAt) {
//     return res.status(400).json({ msg: 'Title and remind time required' });
//   }

//   const r = await Reminder.create({
//     title,
//     description,
//     remindAt,
//     user: req.user.id,
//   });

//   res.status(201).json(r);
// };

// // 👀 GET OWN REMINDERS
// const getMyReminders = async (req, res) => {
//   const list = await Reminder.find({ user: req.user.id })
//     .sort({ remindAt: 1 });

//   res.json(list);
// };

// // ✏️ UPDATE OWN REMINDER
// const updateReminder = async (req, res) => {
//   const r = await Reminder.findOne({
//     _id: req.params.id,
//     user: req.user.id,
//   });

//   if (!r) return res.sendStatus(404);

//   Object.assign(r, req.body);
//   await r.save();

//   res.json(r);
// };

// // ❌ DELETE OWN REMINDER
// const deleteReminder = async (req, res) => {
//   const r = await Reminder.findOneAndDelete({
//     _id: req.params.id,
//     user: req.user.id,
//   });

//   if (!r) return res.sendStatus(404);

//   res.json({ msg: 'Reminder deleted' });
// };

// module.exports = {
//   createReminder,
//   getMyReminders,
//   updateReminder,
//   deleteReminder,
// };
