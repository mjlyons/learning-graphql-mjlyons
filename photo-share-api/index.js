const { importSchema } = require('graphql-import');
const { ApolloServer, PubSub } = require('apollo-server-express');
const express = require('express');
const expressPlayground = require('graphql-playground-middleware-express')
  .default;
const { createServer } = require('http');
const { MongoClient } = require('mongodb');
const path = require('path');
const { resolvers } = require('./resolvers');
const { performance } = require('perf_hooks');
const depthLimit = require('graphql-depth-limit');
const { createComplexityLimitRule } = require('graphql-validation-complexity');

require('dotenv').config();

async function start() {
  const app = express();
  const MONGO_DB = process.env.DB_HOST;

  const client = await MongoClient.connect(
    MONGO_DB,
    { useNewUrlParser: true },
  );
  const db = client.db();

  const pubsub = new PubSub();
  const server = new ApolloServer({
    typeDefs: importSchema('./schema.graphql').replace('scalar Upload\n', ''),
    resolvers,
    validationRules: [
      depthLimit(3),
      createComplexityLimitRule(1000, {
        onCost: cost => console.log('query cost: ', cost),
      }),
    ],
    context: async ({ req, connection }) => {
      const githubToken = req
        ? req.headers.authorization
        : connection.context.Authorization;
      const currentUser = await db.collection('users').findOne({ githubToken });
      const timestamp = performance.now();
      return { db, currentUser, pubsub, timestamp };
    },
    engine: true,
  });
  server.applyMiddleware({ app });

  app.get('/', (req, res) => res.end('Welcome to the PhotoShare API'));
  app.get(
    '/playground',
    expressPlayground({ endpoint: 'http://localhost:4000/graphql' }),
  );
  app.use(
    '/img/photos',
    express.static(path.join(__dirname, 'assets', 'photos')),
  );
  const httpServer = createServer(app);
  server.installSubscriptionHandlers(httpServer);

  // Limit requests to 5 sec
  httpServer.timeout = 5000;

  httpServer.listen({ port: 4000 }, () =>
    console.log(
      `GraphQL Server running @ http://localhost:4000${server.graphqlPath}`,
    ),
  );
}

start();
