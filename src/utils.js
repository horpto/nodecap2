"use strict";
var cluster = require('cluster');

var assign = Object.assign != null ? Object.assign : require('util')._extend;

var _id = 0;
function uniqueId() {
  _id ++;
  return '' + _id;
}

function noop() {
  return;
}

module.exports = {
  "uniqueId": uniqueId,
  "assign": assign,
  "noop": noop
};
