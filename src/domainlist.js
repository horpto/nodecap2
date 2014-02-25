var fs = require('fs');
var path = require('path');

// http://jsperf.com/string-reverse-methods-performance
// lame_reverse:
var reverse = function (s) {
    for (var i = s.length, o = ''; i--; o += s[i]);
    return o;
};

// For a sorted list, binary search:
// Find the index + 1 of the exact matching element
// or negative (index + 1) preceding element.
var binaryIndexNear = function(arr, searchElement) {
  var minIndex = 0;
  var maxIndex = arr.length - 1;
  var currentIndex = 0;
  var currentElement;

  while (minIndex <= maxIndex) {
    currentIndex = (minIndex + maxIndex) / 2 | 0;
    currentElement = arr[currentIndex];

    if (currentElement < searchElement) {
        minIndex = currentIndex + 1;
    }
    else if (currentElement > searchElement) {
        maxIndex = currentIndex - 1;
    }
    else {
        return (currentIndex + 1);
    }
  }
  return -(maxIndex <= 0 ? 1 : (maxIndex + 1));
};


var DomainList = module.exports = function(domainList) {
  var ix;
  domainList = domainList || [];
  this.matchDomains = [];
  this.domainExpiry = {};
  this.addMany(domainList);
};

DomainList.prototype = {
  constructor: DomainList,

  contains: function(domain) {
    var nearIdx, reversed, expireDomain, now;

    if (this.matchDomains.length === 0) {
      return false;
    }

    now = Date.now();
    // check wildcard domains by comparing the reverse of the string
    reversed = reverse(domain);
    expireDomain = domain[0] === '.' ? domain.slice(1) : domain;

    nearIdx = binaryIndexNear(this.matchDomains, reversed);
    if (nearIdx <= 0) {
      var part = this.matchDomains[-(nearIdx + 1)];
      if (part[part.length - 1] !== '.' || reversed.indexOf(part) !== 0) {
        return false;
      }
    }
    // non-expiring domain or not-yet expired domain
    if (!(expireDomain in this.domainExpiry) || this.domainExpiry[expireDomain] >= now) {
      return true;
    }
    // expired domain
    this.remove(expireDomain);
    return false;
  },

  clear: function() {
    this.matchDomains = [];
    this.domainExpiry = {};
  },

  addMany: function(domains, ttl) {
    domains = domains || [];
    ttl = ttl || 0;
    for (var ix = 0; ix < domains.length; ix++) {
      this.add(domains[ix], ttl, true);
    }
    this.matchDomains.sort();
  },

  add: function(domain, ttl, skipSort) {
    var expireDomain, now;
    domain = (domain || '').trim();
    if (!domain) {
      return;
    }
    if (domain[0] === '.') {
      expireDomain = domain.slice(1);
      this.matchDomains.push(reverse(expireDomain));
    } else {
      expireDomain = domain;
    }
    this.matchDomains.push(reverse(domain));

    if (ttl > 0) {
      this.domainExpiry[expireDomain] = Date.now() + ttl;
    }

    if (!skipSort) {
      this.matchDomains.sort();
    }
  },

  remove: function(domain) {
    var fixed, wildcard, bakfixed;
    domain = (domain || '').trim();
    if (!domain) {
      return;
    }
    if (domain[0] === '.') {
      fixed = domain.slice(1);
      bakfixed = reverse(fixed);
      wildcard = reverse(domain);
    } else {
      fixed = domain;
      bakfixed = reverse(fixed);
      wildcard = reverse('.' + domain);
    }
    this.matchDomains = this.matchDomains.filter(function(existingDomain) {
      return existingDomain !== wildcard && existingDomain !== bakfixed;
    });
    delete this.domainExpiry[fixed];
  },

  toArray: function() {
    var domains = [];
    this.matchDomains.forEach(function(domain) {
      domains.push(reverse(domain));
    });
    return domains;
  }
};

/*
 *  DomainList.fromFile(domainFile[, domainList])
 *  @param domainFile: string file path, absolute or relative to cwd
 *  @param domainList: optional domainlist
 *  Create a new DomainList (or use passed domainList) and add all of the domain patterns
 *  contained in domainFile as non-expiring.
 */
DomainList.fromFile = function(domainFile, domainList) {
  domainList = domainList || new DomainList();
  var domainText = fs.readFileSync(path.resolve(process.cwd(), domainFile), 'utf8').trim();
  if (!domainText) {
    return null;
  }
  var domains = domainText.split('\n');
  domainList.addMany(domains);
  return domainList;
};
