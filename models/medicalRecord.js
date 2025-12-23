// models/MedicalRecord.js
'use strict';

module.exports = (sequelize, DataTypes) => {
  const MedicalRecord = sequelize.define('MedicalRecord', {
    booking_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    // SOAP FORMAT
    subjective: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    objective: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    assessment: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    plan: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    consultation_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  });

  MedicalRecord.associate = (models) => {
    MedicalRecord.belongsTo(models.Booking, {
      foreignKey: 'booking_id',
      as: 'booking'
    });

    MedicalRecord.belongsTo(models.User, {
      foreignKey: 'patient_id',
      as: 'patient'
    });

    MedicalRecord.belongsTo(models.Doctor, {
      foreignKey: 'doctor_id',
      as: 'doctor'
    });
  };

  return MedicalRecord;
};
