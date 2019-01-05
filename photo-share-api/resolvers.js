const { GraphQLScalarType } = require('graphql');
const fetch = require('node-fetch');
const path = require('path');
const { authorizeWithGithub } = require('./github');
const { uploadStream } = require('./upload');
const { performance } = require('perf_hooks');

const githubAuth = async (parent, { code }, { db, pubsub }) => {
  const {
    message,
    accessToken,
    avatarUrl,
    login,
    name,
  } = await authorizeWithGithub({
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    code,
  });
  if (message) {
    throw new Error(`message (accessToken=${accessToken})`);
  }
  const latestUserInfo = {
    name,
    githubLogin: login,
    githubToken: accessToken,
    avatar: avatarUrl,
  };
  const {
    ops: [user],
  } = await db
    .collection('users')
    .replaceOne({ githubLogin: login }, latestUserInfo, { upsert: true });
  pubsub.publish('user-added', { newUser: user });
  return { user, token: accessToken };
};

module.exports.resolvers = {
  Query: {
    me: (_, __, { currentUser }) => currentUser,
    totalPhotos: (parent, args, { db }) =>
      db.collection('photos').estimatedDocumentCount(),
    allPhotos: (parent, args, { db, timestamp }) => {
      console.log(`allPhotos took ${performance.now() - timestamp}ms`);
      return db
        .collection('photos')
        .find()
        .toArray();
    },
    totalUsers: (parent, args, { db }) =>
      db.collection('users').estimatedDocumentCount(),
    allUsers: (parent, args, { db }) =>
      db
        .collection('users')
        .find()
        .toArray(),
  },
  Mutation: {
    githubAuth,
    postPhoto: async (parent, args, { db, currentUser, pubsub }) => {
      if (!currentUser) {
        throw new Error('only an authorized user can post a photo');
      }

      const newPhoto = {
        ...args.input,
        userID: currentUser.githubLogin,
        created: new Date(),
      };

      const { insertedId } = await db.collection('photos').insertOne(newPhoto);
      newPhoto.id = insertedId.toString();

      const toPath = path.join(
        __dirname,
        'assets',
        'photos',
        `${newPhoto.id.toString()}.jpg`,
      );
      const { createReadStream } = await args.input.file;
      const stream = createReadStream();
      await uploadStream(stream, toPath);

      pubsub.publish('photo-added', { newPhoto });

      return newPhoto;
    },
    addFakeUsers: async (root, { count }, { db, pubsub }) => {
      const randomUserApi = `https://randomuser.me/api/?results=${count}`;
      const { results } = await fetch(randomUserApi).then(res => res.json());
      const users = results.map(r => ({
        githubLogin: r.login.username,
        name: `${r.name.first} ${r.name.last}`,
        avatar: r.picture.thumbnail,
        githubToken: r.login.sha1,
      }));
      await db.collection('users').insertMany(users);

      users.forEach(user => {
        pubsub.publish('user-added', { newUser: user });
      });

      return users;
    },
    fakeUserAuth: async (parent, { githubLogin }, { db }) => {
      const user = await db.collection('users').findOne({ githubLogin });
      if (!user) {
        throw new Error(`Cannot find user with githubLogin "${githubLogin}"`);
      }
      return {
        token: user.githubToken,
        user,
      };
    },
  },
  Subscription: {
    newPhoto: {
      subscribe: (parent, args, { pubsub }) =>
        pubsub.asyncIterator('photo-added'),
    },
    newUser: {
      subscribe: (parent, args, { pubsub }) =>
        pubsub.asyncIterator('user-added'),
    },
  },
  Photo: {
    id: parent => parent.id || parent._id.toString(),
    url: parent =>
      `http://localhost:4000/img/photos/${parent._id.toString()}.jpg`,
    postedBy: (parent, args, { db }) =>
      db.collection('users').findOne({ githubLogin: parent.userID }),
    // taggedUsers: parent => getUsersTaggedInPhoto(parent.id),
  },
  User: {
    // postedPhotos: parent => getPhotosPostedByUser(parent.githubLogin),
    // inPhotos: parent => getPhotosUserTaggedIn(parent.githubLogin),
  },
  DateTime: new GraphQLScalarType({
    name: 'DateTime',
    description: 'A valid date time value.',
    parseValue: value => new Date(value),
    parseLiteral: ast => new Date(ast.value),
    serialize: value => new Date(value).toISOString(),
  }),
};
