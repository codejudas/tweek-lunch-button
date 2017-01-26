/**
 * Created by jlaver on 1/23/17.
 */
'use strict';

const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const log4js = require('log4js');

const config = JSON.parse(fs.readFileSync('./config.json'));
const accountSid = config.accountSid;
const authToken = config.authToken;
const notifyServiceSid = config.notifyServiceSid;
const copilotServiceSid = config.copilotServiceSid;

var logger = log4js.getLogger('notify');
var client = new twilio(accountSid, authToken);
var service = client.notify.v1.services(notifyServiceSid);

module.exports.testNotify = function () {
  service.notifications.create({
    identity: 'test@twilio.com', 
    body: 'Testing tests test',
    sms: JSON.stringify({
      from: copilotServiceSid 
    })
  }).then(function(response) {
    console.log(response);
  }).catch(function(error) {
    console.log(error);
  });
};

//Right now only supports sms
module.exports.notifyUserByIdentity = function(identity, message) {
  service.notifications.create({
    identity: identity, 
    body: message,
    sms: JSON.stringify({
      from: copilotServiceSid
    })
  }).then(function(response) {
    console.log(response);
  }).catch(function(error) {
    console.log(error);
  });
};

module.exports.notifyUserByTag = function(tags, message) {
	service.notifications.create({
    tag: tags, 
    body: message,
    sms: JSON.stringify({
      from: copilotServiceSid
    })
  }).then(function(response) {
    console.log(response);
  }).catch(function(error) {
    console.log(error);
  });
};

module.exports.addBinding = function(identity, bindType, bindAddress, tag) {
	return new Promise((resolve, reject) => {
      console.log(`creating biding for ${identity}, ${bindType}`);
      service.bindings.create({
          endpoint: `${identity}:${bindType}`,
          identity: identity,
          bindingType: bindType,
          address: bindAddress,
          tag: tag
      }).then(function(response) {
        //get binding sid from response
        var bindSid = response.sid;
        console.log(bindSid);
        resolve(bindSid);
      }).catch(function(error) {
        console.log(error);
        reject(error);
      });
	});
}

module.exports.deleteBinding = function(bindSid) {
    console.log(`deleteBindind ${bindSid}`);
    service.bindings(bindSid).remove()
        .then(function(response) {
            logger.info('Response: %s', response);
        })
        .catch(function(error) {
            logger.info('Error: %s', error);
    });
}


