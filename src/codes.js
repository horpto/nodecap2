'use strict';

module.exports = {
  100: ['Continue', 'Request received, please continue'],
  101: ['Switching Protocols',
      'Switching to new protocol; obey Upgrade header'],
  102: ['Processing',
      'This code indicates that the server has received and is processing the request, but no response is available yet.'],

  200: ['OK', 'Request fulfilled, document follows'],
  201: ['Created', 'Document created, URL follows'],
  202: ['Accepted',
      'Request accepted, processing continues off-line'],
  203: ['Non-Authoritative Information', 'Request fulfilled from cache'],
  204: ['No Content', 'Request fulfilled, nothing follows'],
  205: ['Reset Content', 'Clear input form for further input.'],
  206: ['Partial Content', 'Partial content follows.'],
  207: ['Multi-Status',
      'The message body that follows is an XML message and can contain a number of separate response codes, depending on how many sub-requests were made.'],
  208: ['Already Reported',
      'The members of a DAV binding have already been enumerated in a previous reply to this request, and are not being included again.'],
  226: ['IM Used',
      'The server has fulfilled a request for the resource, and the response is a representation of the result of one or more instance-manipulations applied to the current instance.'],

  300: ['Multiple Choices',
      'Object has several resources -- see URI list'],
  301: ['Moved Permanently', 'Object moved permanently -- see URI list'],
  302: ['Found', 'Object moved temporarily -- see URI list'],
  303: ['See Other', 'Object moved -- see Method and URL list'],
  304: ['Not Modified',
      'Document has not changed since given time'],
  305: ['Use Proxy',
      'You must use proxy specified in Location to access this resource.'],
  306: ['Switch Proxy',
      'Subsequent requests should use the specified proxy.'],
  307: ['Temporary Redirect',
      'Object moved temporarily -- see URI list'],
  308: ['Permanent Redirect',
      'The request, and all future requests should be repeated using another URI. 307 and 308 parallel the behaviours of 302 and 301, but do not allow the HTTP method to change.'],

  400: ['Bad Request',
      'Bad request syntax or unsupported method'],
  401: ['Unauthorized',
      'No permission -- see authorization schemes'],
  402: ['Payment Required',
      'No payment -- see charging schemes'],
  403: ['Forbidden',
      'Request forbidden -- authorization will not help'],
  404: ['Not Found', 'Nothing matches the given URI'],
  405: ['Method Not Allowed',
      'Specified method is invalid for this resource.'],
  406: ['Not Acceptable', 'URI not available in preferred format.'],
  407: ['Proxy Authentication Required', 'You must authenticate with this proxy before proceeding.'],
  408: ['Request Timeout', 'Request timed out; try again later.'],
  409: ['Conflict', 'Request conflict.'],
  410: ['Gone',
      'URI no longer exists and has been permanently removed.'],
  411: ['Length Required', 'Client must specify Content-Length.'],
  412: ['Precondition Failed', 'Precondition in headers is false.'],
  413: ['Request Entity Too Large', 'Entity is too large.'],
  414: ['Request-URI Too Long', 'URI is too long.'],
  415: ['Unsupported Media Type', 'Entity body in unsupported format.'],
  416: ['Requested Range Not Satisfiable',
      'Cannot satisfy request range.'],
  417: ['Expectation Failed',
      'Expect condition could not be satisfied.'],
  419: ['Authentication Timeout',
      '419 Authentication Timeout denotes that previously valid authentication has expired.'],
  421: ['Misdirected Request',
      'The request was directed at a server that is not able to produce a response'],
  422: ['Unprocessable Entity',
      'The request was well-formed but was unable to be followed due to semantic errors.'],
  423: ['Locked',
      'The resource that is being accessed is locked.'],
  424: ['Failed Dependency',
      'The request failed due to failure of a previous request.'],
  426: ['Upgrade Required',
      'The client should switch to a different protocol such as TLS/1.0, given in the Upgrade header field.'],
  428: ['Precondition Required',
      'The origin server requires the request to be conditional.'],
  429: ['Too Many Requests',
      'The user has sent too many requests in a given amount of time. Intended for use with rate limiting schemes.'],
  431: ['Request Header Fields Too Large',
      'The server is unwilling to process the request because either an individual header field, or all the header fields collectively, are too large.'],
  451: ['Unavailable For Legal Reasons', 'Resource access is denied due to legal demands.'],

  500: ['Internal Server Error', 'Server got itself in trouble'],
  501: ['Not Implemented',
      'Server does not support this operation'],
  502: ['Bad Gateway', 'Invalid responses from another server/proxy.'],
  503: ['Service Unavailable',
      'The server cannot process the request due to a high load'],
  504: ['Gateway Timeout',
      'The gateway server did not receive a timely response'],
  505: ['Protocol Version Not Supported', 'Cannot fulfill request.'],
  506: ['Variant Also Negotiates',
      'Transparent content negotiation for the request results in a circular reference.'],
  507: ['Insufficient Storage',
      'The server is unable to store the representation needed to complete the request.'],
  508: ['Loop Detected',
      'The server detected an infinite loop while processing the request.'],
  510: ['Not Extended',
      'Further extensions to the request are required for the server to fulfil it.'],
  511: ['Network Authentication Required',
      'The client needs to authenticate to gain network access.'],

  // Unofficial HTTP Codes
  418: ['I\'m a teapot',
      'The RFC specifies this code should be returned by tea pots requested to brew coffee.'],
  440: ['Login Timeout',
      'The client\'s session has expired and must log in again.'],
  449: ['Retry With',
      'The server cannot honour the request as the user has not provided the required information.'],
  450: ['Blocked by Parental Controls',
      'A Custom extension. This error is given when Parental Controls are turned on and are blocking access to the given webpage.'],

  // NGINX Error Codes
  444: ['No Response',
  'Used to indicate that the server has returned no information to the client and closed the connection.'],
  495: ['SSL Certificate Error',
  'An expansion of the 400 Bad Request response code, used when the client has provided an invalid client certificate.'],
  496: ['SSL Certificate Required',
  'An expansion of the 400 Bad Request response code, used when a client certificate is required but not provided.'],
  497: ['HTTP Request Sent to HTTPS Port',
  'An expansion of the 400 Bad Request response code, used when the client has made a HTTP request to a port listening for HTTPS requests.'],
  499: ['Client Closed Request',
  'Used when the client has closed the request before the server could send a response.'],

  // Apache Error code
  509: ['Bandwidth Limit Exceeded',
      'The server has exceeded the bandwidth specified by the server administrator'],
};
