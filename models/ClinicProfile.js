module.exports = (sequelize, DataTypes) => {
  const ClinicProfile = sequelize.define(
    "ClinicProfile",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      bannerCards: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        // [
        //   { title: "", description: "", image: "" }
        // ]
      },

      serviceCards: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        // [
        //   { title: "", description: "", image: "" }
        // ]
      },

      backstory: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      contact: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
          email: "",
          phone: "",
          address: "",
        },
      },

      operationalHours: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {
          monday: "",
          tuesday: "",
          wednesday: "",
          thursday: "",
          friday: "",
          saturday: "",
          sunday: "",
        },
      },

      shortDescription: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      longDescription: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      tableName: "clinic_profiles",
    }
  );

  return ClinicProfile;
};
