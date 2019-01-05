const fetch = require('node-fetch');

const fromJSON = res => res.json();

const throwError = error => {
  throw new Error(error);
};

const requestGithubToken = credentials =>
  fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(credentials),
  })
    .then(fromJSON)
    .catch(throwError);

const requestGithubUserAccount = token =>
  fetch(`https://api.github.com/user?access_token=${token}`)
    .then(fromJSON)
    .catch(throwError);

const authorizeWithGithub = async credentials => {
  const { access_token: accessToken } = await requestGithubToken(credentials);
  const githubUser = await requestGithubUserAccount(accessToken);
  return { ...githubUser, avatarUrl: githubUser.avatar_url, accessToken };
};

module.exports = { authorizeWithGithub };
