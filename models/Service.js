'use strict';

module.exports = (sequelize, DataTypes) => {
  const Service = sequelize.define('Service', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    require_doctor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    allow_walkin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },

    // LiveKit
    livekit_room_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    is_live: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },

    // Doctor Exclusive
    is_doctor_service: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    exclusive_doctor_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    // ⬇⬇⬇ ARTICLE RELATION
    article_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
   image_url :{
 type: DataTypes.STRING
//buat tes aja
 },
 active : {
  type: DataTypes.BOOLEAN,
  defaultValue: true
 }

  }, {
    tableName: 'services',
    underscored: true,
    timestamps: true
  });

  Service.associate = function(models) {
    Service.belongsToMany(models.Doctor, {
      through: models.ServiceDoctor,
      foreignKey: 'service_id'
    });

    Service.belongsTo(models.Post, {
      foreignKey: 'article_id',
      as: 'article'
    });
  };

  return Service;
};
