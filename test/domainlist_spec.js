'use strict';

const path = require('path');
const test = require('tap').test;
const DomainList = require('..').DomainList;

test('domainlist should load from file', (t) => {
  const domains = DomainList.fromFile(path.resolve(__dirname, 'domainlist.txt'));
  t.ok(domains.contains('wildcard.com'), 'wildcard should match base domain');
  t.ok(domains.contains('www.wildcard.com'), 'wildcard should match sub-domain');
  t.ok(!domains.contains('mate.com'), 'wildcard should not match partial version of itself');

  t.ok(domains.contains('fixed.com'), 'fixed should match domain');
  t.ok(!domains.contains('www.fixed.com'), 'fixed should not match sub-domain');

  t.ok(!domains.contains('banned.com'), 'should not match unlisted domain');

  t.end();
});

test('domainlist should load from file into existing list', (t) => {
  const domains = new DomainList();
  DomainList.fromFile(path.resolve(__dirname, 'domainlist.txt'), domains);
  t.ok(domains.contains('wildcard.com'), 'wildcard should match base domain');
  t.ok(domains.contains('www.wildcard.com'), 'wildcard should match sub-domain');
  t.ok(!domains.contains('mate.com'), 'wildcard should not match partial version of itself');

  t.ok(domains.contains('fixed.com'), 'fixed should match domain');
  t.ok(!domains.contains('www.fixed.com'), 'fixed should not match sub-domain');

  t.ok(!domains.contains('banned.com'), 'should not match unlisted domain');

  t.end();
});

test('domainlist should clear existing list', (t) => {
  const domains = new DomainList();
  DomainList.fromFile(path.resolve(__dirname, 'domainlist.txt'), domains);
  domains.clear();
  t.ok(!domains.contains('wildcard.com'), 'wildcard should not match base domain');
  t.ok(!domains.contains('www.wildcard.com'), 'wildcard should not match sub-domain');
  t.ok(!domains.contains('fixed.com'), 'fixed should not match domain');

  t.end();
});

test('domainlist should allow adding domains dynamically', (t) => {
  const domains = new DomainList();
  domains.addMany(['a.com', '.b.com']);
  t.ok(domains.contains('a.com'), 'contains addMany fixed');
  t.ok(domains.contains('b.com'), 'contains addMany wildcard-fixed');
  t.ok(domains.contains('www.b.com'), 'contains addMany wildcard');

  t.end();
});

test('domainlist should allow adding domains dynamically', (t) => {
  const domains = new DomainList();
  t.ok(!domains.contains('wildcard.com'), 'should not match unlisted domain');
  domains.add('fixed.com');
  t.ok(domains.contains('fixed.com'), 'should match added domain');

  domains.add('.wildcard.com');
  t.ok(domains.contains('wildcard.com'), 'wildcard should match base domain');
  t.ok(domains.contains('www.wildcard.com'), 'wildcard should match sub-domain');
  t.ok(!domains.contains('mate.com'), 'wildcard should not match partial version of itself');

  t.end();
});

test('domainlist should remove fixed/wildcard version of fixed domains', (t) => {
  const domains = DomainList.fromFile(path.resolve(__dirname, 'domainlist.txt'));
  domains.remove('wildcard.com');
  t.ok(!domains.contains('wildcard.com'), 'should not match base domain of removed wildcard');
  t.ok(!domains.contains('www.wildcard.com'), 'should not match sub-domain of removed wildcard');

  domains.remove('fixed.com');
  t.ok(!domains.contains('fixed.com'), 'should not match fixed domain');
  t.ok(!domains.contains('www.fixed.com'), 'should not match sub-domain of fixed domain');

  t.end();
});

test('domainlist should remove fixed/wildcard version of wildcard domains', (t) => {
  const domains = DomainList.fromFile(path.resolve(__dirname, 'domainlist.txt'));
  domains.remove('.wildcard.com');
  t.ok(!domains.contains('wildcard.com'), 'should not match base domain of removed wildcard');
  t.ok(!domains.contains('www.wildcard.com'), 'should not match sub-domain of removed wildcard');

  domains.remove('.fixed.com');
  t.ok(!domains.contains('fixed.com'), 'should not match fixed domain');
  t.ok(!domains.contains('www.fixed.com'), 'should not match sub-domain of fixed domain');

  t.end();
});
test('domainlist should handle domains beyond the sorted match indexes', (t) => {
  const domains = new DomainList();

  domains.add('.b.com');
  t.ok(!domains.contains('a.com'), 'should not match lesser');
  t.ok(!domains.contains('c.com'), 'should not match greater');
  t.ok(!domains.contains('www.a.com'), 'should not match lesser sub-domain');
  t.ok(!domains.contains('www.c.com'), 'should not match greater');
  t.ok(domains.contains('www.b.com'), 'should match sub-domain');

  t.end();
});


test('domainlist should handle domains beyond the sorted match indexes', (t) => {
  const domains = new DomainList();

  domains.add('b.com');
  t.ok(!domains.contains('a.com'), 'should not match lesser');
  t.ok(!domains.contains('c.com'), 'should not match greater');
  t.ok(!domains.contains('www.a.com'), 'should not match lesser sub-domain');
  t.ok(!domains.contains('www.c.com'), 'should not match greater');
  t.ok(domains.contains('b.com'), 'should match exact');
  t.ok(!domains.contains('www.b.com'), 'should not match sub-domain');

  t.end();
});


test('domainlist should handle domains beyond the sorted match indexes', (t) => {
  const domains = new DomainList();

  domains.add('c.com');
  domains.add('.b.com');
  domains.add('.d.com');

  t.ok(!domains.contains('a.com'), 'should not match lesser');
  t.ok(domains.contains('c.com'), 'should match');
  t.ok(!domains.contains('www.z.com'), 'should not match greater');
  t.ok(!domains.contains('z.com'), 'should not match greater sub-domain');
  t.ok(domains.contains('www.d.com'), 'should not match greater');

  t.ok(domains.contains('www.b.com'), 'should match sub-domain');

  t.end();
});

test('domainlist should handle adding subdomains of wildcard domains', (t) => {
  const domains = new DomainList();
  domains.add('a.com');
  domains.add('b.com');
  domains.add('.b.com');
  domains.add('fixed.b.com');
  domains.add('.wildcard.b.com');
  domains.add('c.com');

  console.dir(domains.toArray());
  console.dir(domains.matchDomains);

  t.ok(domains.contains('a.com'), 'should include lowest domain');
  t.ok(domains.contains('c.com'), 'should include hightest domain');
  t.ok(domains.contains('b.com'), 'should include top-level wildcard domain');
  t.ok(domains.contains('sub.b.com'), 'should include sub domain of wildcard domain');
  t.ok(domains.contains('aixed.b.com'), 'should include lower sub domain of wildcard domain');
  t.ok(domains.contains('zixed.b.com'), 'should include higher sub domain of wildcard domain');
  t.ok(domains.contains('sub.wildcard.b.com'), 'should include sub of wildcard wildcard');


  domains.add('e.com');
  domains.add('bbb.e.com');
  domains.add('.f.com');
  domains.add('bbb.g.com');
  domains.add('g.com');
  domains.add('bbb.i.com');

  t.notOk(domains.contains('aaa.e.com'), 'should not contain subdomain if not parent wildcard');
  t.notOk(domains.contains('aaa.g.com'), 'should not container lower subdomain if lower non-parent wildcard');
  t.notOk(domains.contains('zzz.g.com'), 'should not container higher subdomain if lower non-parent wildcard');
  t.notOk(domains.contains('aaa.i.com'), 'should not container lower subdomain if lower non-parent fixed');
  t.notOk(domains.contains('zzz.i.com'), 'should not container higher subdomain if lower non-parent fixed');

  t.end();
});

test('domainlist should expire domains', (t) => {
  let now = Date.now();
  const nowFn = Date.now;
  Date.now = function() {
    return now;
  };
  const domains = new DomainList();
  domains.add('fixed.com', 1000);
  domains.add('.wildcard.com', 1000);
  t.ok(domains.contains('fixed.com'), 'should not expire yet');
  t.ok(domains.contains('wildcard.com'), 'should not expire yet');
  t.ok(domains.contains('www.wildcard.com'), 'should not expire yet');

  now = now += 1000;
  t.ok(domains.contains('fixed.com'), 'should not expire yet');
  t.ok(domains.contains('wildcard.com'), 'should not expire yet');
  t.ok(domains.contains('www.wildcard.com'), 'should not expire yet');

  now = now += 1;
  t.ok(!domains.contains('fixed.com'), 'should be expired');
  t.ok(!domains.contains('wildcard.com'), 'should be expired');
  t.ok(!domains.contains('www.wildcard.com'), 'should be expired');

  Date.now = nowFn;
  t.end();
});

test('domainlist should return domains as array', (t) => {
  const domains = new DomainList();
  domains.add('fixed.com');
  domains.add('.wildcard.com');
  const domainsArray = domains.toArray();
  t.equal(domainsArray.length, 3, 'should be 3 domains');
  t.ok(domainsArray.indexOf('fixed.com') >= 0, 'should have fixed input in toArray()');
  t.ok(domainsArray.indexOf('wildcard.com') >= 0, 'should have fixed version of wildcard input in toArray()');
  t.ok(domainsArray.indexOf('.wildcard.com') >= 0, 'should have wildcard input in toArray()');
  t.end();
});
