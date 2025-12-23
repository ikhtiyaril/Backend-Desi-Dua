'use strict';
module.exports = (sequelize, DataTypes) => {
  const Booking = sequelize.define('Booking', {
    booking_code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    patient_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    service_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    time_start: {
      type: DataTypes.TIME,
      allowNull: false
    },
    time_end: {
      type: DataTypes.TIME,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    payment_status: {
      type: DataTypes.ENUM('unpaid', 'paid'),
      allowNull: false,
      defaultValue: 'unpaid'
    },
    payment_method: {
      type: DataTypes.STRING,
      allowNull: true
    },

    
  

  }, {
    tableName: 'bookings',
    underscored: true
  });

  Booking.associate = function (models) {
    Booking.belongsTo(models.User, {
      foreignKey: 'patient_id'
    });

    Booking.belongsTo(models.Service, {
      foreignKey: 'service_id'
    });

    Booking.belongsTo(models.Doctor, {
      foreignKey: 'doctor_id'
    });

    Booking.belongsTo(models.BlockedTime, {
      foreignKey: 'blocked_time_id',
      allowNull: true
    });
    Booking.hasOne(models.MedicalRecord, {
      foreignKey: 'booking_id',
      as: 'medicalRecord'
    });
  };

  return Booking;
};
