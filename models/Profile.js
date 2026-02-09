const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  link: String
}, { _id: false });

const ProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: String,
  bio: String,
  skills: [String],
  projects: [ProjectSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Profile', ProfileSchema);
