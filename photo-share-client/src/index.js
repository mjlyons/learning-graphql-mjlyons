import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { ApolloProvider } from "react-apollo";
import { InMemoryCache, ApolloLink, ApolloClient, split } from "apollo-boost";
import { WebSocketLink } from "apollo-link-ws";
import { getMainDefinition } from "apollo-utilities";
import { persistCache } from "apollo-cache-persist";
import { createUploadLink } from "apollo-upload-client";

const cache = new InMemoryCache();
//persistCache({ cache, storage: localStorage });

if (false && localStorage["apollo-cache-persist"]) {
  const cacheData = JSON.parse(localStorage["apollo-cache-persist"]);
  cache.restore(cacheData);
}

const httpLink = createUploadLink({ uri: "http://localhost:4000/graphql" });
const authLink = new ApolloLink((operation, forward) => {
  operation.setContext(context => ({
    headers: {
      ...context.headers,
      authorization: localStorage.getItem("githubAuthToken")
    }
  }));
  return forward(operation);
});
const httpAuthLink = authLink.concat(httpLink);

const wsLink = new WebSocketLink({
  uri: "ws://localhost:4000/graphql",
  options: {
    reconnect: true,
    connectionParams: localStorage.getItem("githubAuthToken")
  }
});

const link = split(
  ({ query }) => {
    const { kind, operation } = getMainDefinition(query);
    return kind === "OperationDefinition" && operation === "subscription";
  },
  wsLink,
  httpAuthLink
);

const client = new ApolloClient({
  cache,
  link
});

ReactDOM.render(
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>,
  document.getElementById("root")
);
