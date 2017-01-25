'use strict';

const request = require('request');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./config.json'));
const slackToken = config.slackToken;

module.exports.notifyUser = function(username, header, attachments) {
    attachments = attachments || [];
    attachments = attachments.filter(e => !!e);

    console.log(`Slacking ${username} '${header}' and ${attachments.length} attachments`);
    const payload = {
        token: slackToken,
        channel: `@${username}`,
        as_user: true,
        text: header,
        parse: 'full',
        attachments: JSON.stringify(attachments)
    };

    request.post('https://slack.com/api/chat.postMessage', {form: payload}, (err, resp, body) => {
        if (err) { console.log(`Error sending slack message to ${username}: ${err}`); };
        if (resp.statusCode !== 200) { console.log(`Error sending slack message to ${username}: Slack responded with ${resp.statusCode}`); };

        body = JSON.parse(body);
        if (!body.ok) { console.log(`Error sending slack message to ${username}: ${JSON.stringify(body)}`); }
    });
};
