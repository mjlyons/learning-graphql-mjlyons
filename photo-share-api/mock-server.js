const { ApolloServer, MockList } = require('apollo-server');
const { readFileSync } = require('fs');

const typeDefs = readFileSync('./schema.graphql', 'UTF-8').replace(
  'scalar Upload\n',
  '',
);

const resolvers = {};

const mocks = {
  Query: () => ({
    totalPhotos: () => 42,
    allPhotos: () => new MockList([5, 10]),
  }),
  Photo: () => ({
    name: 'sample photo',
    description: null,
  }),
};

const server = new ApolloServer({ typeDefs, resolvers, mocks });
server.listen({ port: 4000 }, () =>
  console.log(`Mock Photo Share GraphQL Service`),
);
