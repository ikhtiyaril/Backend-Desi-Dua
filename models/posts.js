// models/Post.js
const slugify = require('slugify');

module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define(
    'Post',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      excerpt: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      // Editor.js biasanya keluarkan JSON — kamu bisa simpan sebagai TEXT('long')
      // atau pakai DataTypes.JSON jika MySQL/MariaDB kamu support JSON type.
      content: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
      },
      thumbnail: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      author_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('draft', 'published', 'archived'),
        allowNull: false,
        defaultValue: 'draft',
      },
      published_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'posts',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      // paranoid: true, // kalau mau soft-delete: uncomment
    }
  );

  /**
   * Associations — sesuaikan nama model User/Category di index.js model kamu
   * (biasanya models.User, models.Category)
   */
  Post.associate = function (models) {
    Post.belongsTo(models.User, { foreignKey: 'author_id', as: 'author' });
    Post.belongsTo(models.Category, { foreignKey: 'category_id', as: 'category' });
  };

  /**
   * Hook: generate slug dari title jika belum diisi.
   * Pastikan slug unik — jika ada duplikat, tambahkan suffix -1, -2, dst.
   */
  Post.addHook('beforeValidate', async (post, options) => {
    if (!post.slug && post.title) {
      const base = slugify(post.title, { lower: true, strict: true });
      let candidate = base;
      let i = 1;

      // loop cek unik (simple). Jika table besar, bisa diganti strategi lain.
      // Gunakan model dari sequelize instance.
      const Op = sequelize.Sequelize.Op;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const exists = await sequelize.models.Post.count({
          where: { slug: candidate },
        });
        if (!exists) break;
        candidate = `${base}-${i++}`;
      }

      post.slug = candidate;
    }
  });

  return Post;
};
