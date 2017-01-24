const request = require('request');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json'));
const slackToken = config.slackToken;

module.exports.notifyUser = function(username, message) {
    console.log(`Slacking ${username} '${message}'`);
    const payload = {
        token: slackToken,
        channel: `@${username}`,
        as_user: true,
        text: message
    };
    request.post('https://slack.com/api/chat.postMessage', {form: payload}, (err, resp, body) => {
        if (err) { console.log(`Error sending slack message to ${username}: ${err}`); };
        if (resp.statusCode !== 200) { console.log(`Error sending slack message to ${username}: Slack responded with ${resp.statusCode}`); };
    });
};
