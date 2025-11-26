'use strict';
module.exports = (sequelize, DataTypes) => {
  const DoctorSchedule = sequelize.define('DoctorSchedule', {
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    day_of_week: {
      type: DataTypes.INTEGER,   // 0–6 (0 = Sunday)
      allowNull: false,
      validate: {
        min: 0,
        max: 6
      }
    },
    start_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    break_start: {
      type: DataTypes.TIME,
      allowNull: true
    },
    break_end: {
      type: DataTypes.TIME,
      allowNull: true
    }
  }, {
    tableName: 'doctor_schedules',
    underscored: true
  });

  DoctorSchedule.associate = function(models) {
    DoctorSchedule.belongsTo(models.Doctor, {
      foreignKey: 'doctor_id'
    });
  };

  return DoctorSchedule;
};
