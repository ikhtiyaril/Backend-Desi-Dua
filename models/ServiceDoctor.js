'use strict';
module.exports = (sequelize, DataTypes) => {
  const ServiceDoctor = sequelize.define('ServiceDoctor', {
    service_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'service_doctors',
    underscored: true
  });

  return ServiceDoctor;
};
