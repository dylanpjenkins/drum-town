'use strict';

const { PostHog } = require('posthog-node');

let _client = null;

function getPostHogClient() {
  if (!_client) {
    _client = new PostHog(
      process.env.POSTHOG_PROJECT_TOKEN,
      { host: process.env.POSTHOG_HOST }
    );
  }
  return _client;
}

module.exports = { getPostHogClient };
