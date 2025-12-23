'use strict';

const express = require('express');
const router = express.Router();

const {
  MedicalRecord,
  Booking,
  User,
  Doctor
} = require('../models');

const verifyToken = require('../middleware/verifyToken');

/**
 * ======================================
 * GET ALL MEDICAL RECORDS (DOCTOR LOGIN)
 * ======================================
 * GET /doctor/medical-records
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('=== GET /doctor/medical-records ===');

    // 1. DEBUG USER
    console.log('Auth user:', req.user);

    const doctorId = req.user.id;
    console.log('Doctor ID:', doctorId);

    // 2. QUERY
    const records = await MedicalRecord.findAll({
      include: [
        {
          model: Booking,
          as: 'booking',
          where: { doctor_id: doctorId },
          attributes: ['id', 'date', 'time_start', 'time_end', 'status']
        },
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'name']
        }
      ],
      order: [['consultation_date', 'DESC']]
    });

    // 3. DEBUG RESULT
    console.log('Medical Records Count:', records.length);

    if (records.length > 0) {
      console.log('First Record Snapshot:', {
        id: records[0].id,
        booking_id: records[0].booking_id,
        patient_id: records[0].patient_id,
        hasPatient: !!records[0].patient,
        hasBooking: !!records[0].booking,
      });
    } else {
      console.log('No medical records found for doctor:', doctorId);
    }

    return res.json(records);
  } catch (error) {
    console.error('❌ ERROR GET MEDICAL RECORDS');
    console.error(error);

    return res.status(500).json({
      message: 'Failed to fetch medical records',
      error: error.message
    });
  }
});


/**
 * ======================================
 * GET MEDICAL RECORD DETAIL (DOCTOR)
 * ======================================
 * GET /doctor/medical-records/:id
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;

    const record = await MedicalRecord.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Booking,
          as: 'booking',
          where: { doctor_id: doctorId }
        },
        {
          model: User,
          as: 'patient',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!record) {
      return res.status(404).json({
        message: 'Medical record not found or unauthorized'
      });
    }

    return res.json(record);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch medical record',
      error: error.message
    });
  }
});

/**
 * ======================================
 * CREATE MEDICAL RECORD (DOCTOR)
 * ======================================
 * POST /doctor/medical-records
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { booking_id, patient_id } = req.body;

    const booking = await Booking.findOne({
      where: {
        id: booking_id,
        doctor_id: doctorId
      }
    });

    if (!booking) {
      return res.status(403).json({
        message: 'Booking not found or unauthorized'
      });
    }

    const existing = await MedicalRecord.findOne({
      where: { booking_id }
    });

    if (existing) {
      return res.status(400).json({
        message: 'Medical record already exists for this booking'
      });
    }

    const record = await MedicalRecord.create({
      booking_id,
      patient_id,
      doctor_id: doctorId,
      subjective: null,
      objective: null,
      assessment: null,
      plan: null
    });

    return res.status(201).json({
      message: 'Medical record created successfully',
      record
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to create medical record',
      error: error.message
    });
  }
});

/**
 * ======================================
 * UPDATE SOAP (DOCTOR ONLY)
 * ======================================
 * PATCH /doctor/medical-records/:id
 */
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { subjective, objective, assessment, plan } = req.body;

    const record = await MedicalRecord.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Booking,
          as: 'booking',
          where: { doctor_id: doctorId }
        }
      ]
    });

    if (!record) {
      return res.status(404).json({
        message: 'Medical record not found or unauthorized'
      });
    }

    record.subjective = subjective ?? record.subjective;
    record.objective = objective ?? record.objective;
    record.assessment = assessment ?? record.assessment;
    record.plan = plan ?? record.plan;

    await record.save();

    return res.json({
      message: 'Medical record updated successfully',
      record
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to update medical record',
      error: error.message
    });
  }
});

/**
 * ======================================
 * DELETE MEDICAL RECORD (DOCTOR)
 * ======================================
 * DELETE /doctor/medical-records/:id
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const doctorId = req.user.id;

    const record = await MedicalRecord.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Booking,
          as: 'booking',
          where: { doctor_id: doctorId }
        }
      ]
    });

    if (!record) {
      return res.status(404).json({
        message: 'Medical record not found or unauthorized'
      });
    }

    await record.destroy();

    return res.json({
      message: 'Medical record deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to delete medical record',
      error: error.message
    });
  }
});

module.exports = router;
