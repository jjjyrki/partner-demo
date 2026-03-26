"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasOne(models.Wallet, { foreignKey: "user_id" });
      User.hasMany(models.Task, { foreignKey: "owner_user_id" });
      User.hasMany(models.TaskSubmission, { foreignKey: "completer_user_id" });
      User.hasMany(models.TaskMessage, { foreignKey: "author_user_id" });
    }
  }
  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      username: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      password_salt: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      kyc_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "approved",
      },
      partner_user_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
      },
      partner_card_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
      },
      partner_wallet_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );
  return User;
};
