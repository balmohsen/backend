// models/COC.js

const mongoose = require('mongoose');

const COCSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  manager_id: { type: String },
  vp_id: { type: String },
  finance_reviewer_id: { type: String },
  course_name: { type: String, required: true },
  completion_date: { type: Date, required: true },
  score: { type: String, required: true },
  comments: { type: String, required: true },
  status: { type: String, default: 'Submitted' },
  finance_status: { type: String, default: 'Pending' },
  manager_status: { type: String, default: 'Pending' },
  vp_status: { type: String, default: 'Pending' },
  current_approver: { 
    type: String, 
    enum: ['finance', 'manager', 'vp', 'completed'], 
    default: 'finance' 
  },
}, { timestamps: true });

module.exports = mongoose.model('COC', COCSchema);
