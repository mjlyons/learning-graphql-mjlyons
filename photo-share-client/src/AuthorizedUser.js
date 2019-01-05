import React, { Component } from "react";
import { withRouter, NavLink } from "react-router-dom";
import { ROOT_QUERY } from "./App";
import { Mutation, Query, compose, withApollo } from "react-apollo";
import { gql } from "apollo-boost";

const GITHUB_AUTH_MUTATION = gql`
  mutation githubAuth($code: String!) {
    githubAuth(code: $code) {
      token
    }
  }
`;

const Me = ({ logout, requestCode, signingIn }) => (
  <Query query={ROOT_QUERY}>
    {({ loading, data }) =>
      data.me ? (
        <CurrentUser {...data.me} logout={logout} />
      ) : loading ? (
        <p>loading...</p>
      ) : (
        <button onClick={requestCode} disabled={signingIn}>
          Sign in with GitHub
        </button>
      )
    }
  </Query>
);

const CurrentUser = ({ name, avatar, logout }) => (
  <div>
    <img src={avatar} width={48} height={48} alt="" />
    <h1>{name}</h1>
    <button onClick={logout}>logout</button>
    <NavLink to="/newPhoto">Post Photo</NavLink>
  </div>
);

class AuthorizedUser extends Component {
  state = { signingIn: false };

  authorizationComplete = (cache, { data }) => {
    localStorage.setItem("githubAuthToken", data.githubAuth.token);
    this.props.history.replace("/");
    this.setState({ signingIn: false });
  };

  componentDidMount() {
    if (window.location.search.match(/code=/)) {
      this.setState({ signingIn: true });
      const code = window.location.search.replace("?code=", "");
      this.githubAuthMutation({ variables: { code } });
    }
  }

  requestCode() {
    const clientID = "4abd958a75f02ff96f29";
    window.location = `https://github.com/login/oauth/authorize?client_id=${clientID}&scope=read:user`;
  }

  logout = () => {
    localStorage.removeItem("githubAuthToken");
    const data = this.props.client.readQuery({ query: ROOT_QUERY });
    data.me = null;
    this.props.client.writeQuery({ query: ROOT_QUERY, data });
  };

  render() {
    return (
      <Mutation
        mutation={GITHUB_AUTH_MUTATION}
        update={this.authorizationComplete}
        refetchQueries={[{ query: ROOT_QUERY }]}
      >
        {mutation => {
          this.githubAuthMutation = mutation;
          return (
            <Me
              signingIn={this.state.signingIn}
              requestCode={this.requestCode}
              logout={this.logout}
            />
          );
        }}
      </Mutation>
    );
  }
}

export default compose(
  withRouter,
  withApollo
)(AuthorizedUser);
