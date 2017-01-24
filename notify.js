/**
 * Created by jlaver on 1/23/17.
 */
'use strict';

const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const config = JSON.parse(fs.readFileSync('./config.json'));
const accountSid = config.accountSid;
const authToken = config.authToken;
const notifyServiceSid = config.notifyServiceSid;
const copilotServiceSid = config.copilotServiceSid;

var client = new twilio(accountSid, authToken);
var service = client.notify.v1.services(notifyServiceSid);
//var service = client.notifications .v1.services(notifyServiceSid);

function UserBindInfo(id, sms, slack, gcm, apn) {
    identity = id;
    smsBindSid = sms;
    slackEndpoint = slack;
    gcmBindSid = gcm;
    apnBindSid = apn;
}

//read in all users from JSON file
function getUsers() {
    //TODO: hard coding is bad

}

module.exports.testNotify = function () {
  service.notifications.create({
    identity: 'test@twilio.com', 
    body: 'Testing tests tesst',
    sms: JSON.stringify({
      from: copilotServiceSid 
    })
  }).then(function(response) {
    console.log(response);
  }).catch(function(error) {
    console.log(error);
  });
};

module.exports.notifyUser = function(username, message) {

};
