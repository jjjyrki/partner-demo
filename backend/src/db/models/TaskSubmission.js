'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TaskSubmission extends Model {
    static associate(models) {
      TaskSubmission.belongsTo(models.Task, { foreignKey: 'task_id' });
      TaskSubmission.belongsTo(models.User, { foreignKey: 'completer_user_id' });
    }
  }
  TaskSubmission.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      task_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'tasks', key: 'id' },
      },
      completer_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      completed_step_ids: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      submitted_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'TaskSubmission',
      tableName: 'task_submissions',
      underscored: true,
      timestamps: false,
    }
  );
  return TaskSubmission;
};
