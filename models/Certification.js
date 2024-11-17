// backend/models/Certification.js

const mongoose = require('mongoose');

// Define the schema for each description entry
const DescriptionSchema = new mongoose.Schema({
    description: {
        type: String,
        required: [true, 'Description is required.'],
        trim: true,
    },
    quantityRequested: {
        type: Number,
        required: [true, 'Quantity Requested is required.'],
        min: [0, 'Quantity Requested cannot be negative.'],
    },
    quantitySupplied: {
        type: Number,
        required: [true, 'Quantity Supplied is required.'],
        min: [0, 'Quantity Supplied cannot be negative.'],
    },
    totalBeforeVAT: {
        type: Number,
        required: [true, 'Total Before VAT is required.'],
        min: [0, 'Total Before VAT cannot be negative.'],
    },
    totalAfterVAT: {
        type: Number,
        required: [true, 'Total After VAT is required.'],
        min: [0, 'Total After VAT cannot be negative.'],
    },
}, { _id: false });

// Define the main Certification schema
const CertificationSchema = new mongoose.Schema({
    // --- General Information ---
    manager: {
        type: String,
        required: [true, 'Manager field is required.'],
        trim: true,
    },
    vendorName: {
        type: String,
        required: [true, 'Vendor Name is required.'],
        trim: true,
    },
    contractName: {
        type: String,
        required: [true, 'Contract Name is required.'],
        trim: true,
    },
    contractPeriod: {
        type: Number,
        required: [true, 'Contract Period is required.'],
        min: [0, 'Contract Period cannot be negative.'],
    },
    contractNumber: {
        type: String,
        required: [true, 'Contract Number is required.'],
        trim: true,
    },
    invoiceNumber: {
        type: String,
        required: [true, 'Invoice Number is required.'],
        trim: true,
    },
    invoicePeriodFrom: {
        type: Date,
        required: [true, 'Invoice Period From is required.'],
    },
    invoicePeriodTo: {
        type: Date,
        required: [true, 'Invoice Period To is required.'],
    },
    claimAmountNumber: {
        type: Number,
        required: [true, 'Claim Amount (Number) is required.'],
        min: [0, 'Claim Amount cannot be negative.'],
    },
    claimAmountText: {
        type: String,
        required: [true, 'Claim Amount (Text) is required.'],
        trim: true,
    },
    pages: {
        type: Number,
        required: [true, 'Pages field is required.'],
        min: [1, 'Pages must be at least 1.'],
    },
    departmentName: {
        type: String,
        required: [true, 'Department Name is required.'],
        trim: true,
    },
    adminSignature: {
        type: String,
        required: [true, 'Admin Signature is required.'],
        trim: true,
    },
    projectManager: {
        type: String,
        required: [true, 'Project Manager is required.'],
        trim: true,
    },
    vpName: {
        type: String,
        required: [true, 'VP Name is required.'],
        trim: true,
    },
    ssvpName: {
        type: String,
        required: [true, 'SSVP Name is required.'],
        trim: true,
    },

    // --- Detailed Breakdown ---
    descriptions: {
        type: [DescriptionSchema],
        validate: {
            validator: function(v) {
                return v.length === 4;
            },
            message: 'There must be exactly 4 description entries.',
        },
        required: [true, 'Descriptions are required.'],
    },

    // --- File Uploads ---
    projectManagerSignatureFile: {
        type: String,
        required: false, // Optional
        trim: true,
    },
    vpSignatureFile: {
        type: String,
        required: false, // Optional
        trim: true,
    },
    ssvpSignatureFile: {
        type: String,
        required: false, // Optional
        trim: true,
    },

    // --- Submission Details ---
    submittedBy: {
        type: String,
        required: [true, 'Submitted By is required.'],
        trim: true,
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },

    // --- Approval Workflow ---
    status: {
        type: String,
        enum: ['Pending Manager', 'Pending Finance', 'Pending SSVP', 'Approved', 'Rejected'],
        default: 'Pending Manager',
    },
    currentApprover: {
        type: String,
        required: true,
        trim: true,
    },
    rejectionReason: {
        type: String,
        required: false,
        trim: true,
    },

    // --- Audit Trail ---
    auditTrail: [
        {
            role: String,
            action: String, // 'Approved' or 'Rejected'
            timestamp: { type: Date, default: Date.now },
            performedBy: String,
            reason: String, // For rejection
        }
    ],
}, {
    timestamps: true, // Adds createdAt and updatedAt timestamps
});

module.exports = mongoose.model('Certification', CertificationSchema);
