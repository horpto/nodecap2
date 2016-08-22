'use strict';

let _id = 0;
function uniqueId() {
  _id ++;
  return '' + _id;
}

function noop() {
  return;
}

module.exports = {
  uniqueId,
  noop
};
