var dgram = require('dgram')

function Client (options) {
  var queue = {}, client, id

  var defaults = {
    host: '127.0.0.1',
    port: 2003,
    type: 'udp4',
    maxPacketSize: 4096,
    prefix: '',
    suffix: '',
    verbose: false,
    interval: 5000,
    callback: null
  }

  function init () {
    options = extend(defaults, options)

    createClient()

    id = setInterval(send, options.interval)

    return {
      add: add,
      put: put,
      close: close,
      options: options
    }
  }

  function createClient () {
    client = dgram.createSocket(options.type)

    client.on('close', function () {
      log('UDP socket closed')
    })

    client.on('error', function (err) {
      log('UDP socket error: '+ err)
    })

    log('Creating new Graphite UDP client')
  }

  function close () {
    client.close()
    clearInterval(id)
  }

  function put (name, value) {
    add(name, value, true)
  }

  function add (name, value, replace) {
    if (!name || isNaN(parseFloat(value)) || value === Infinity)
      return log('Skipping invalid name/value: '+ name +' '+ value)

    if (options.prefix)
      name = options.prefix +'.'+ name

    if (options.suffix)
      name = name +'.'+ options.suffix

    if (queue[name] === undefined || replace)
      queue[name] = { value: value }
    else
      queue[name].value += value

    queue[name].timestamp = String(Date.now()).substr(0, 10)

    log('Adding metric to queue: '+ name +' '+ value)
  }

  function sendPacket (metrics, count) {
    log('Sending '+ count +' metrics to '+ options.host +':'+ options.port)

    client.send(metrics, 0, metrics.length, options.port,
    options.host, function (err) {
      if (err)
        return log('Error sending metrics: '+ err)

      log('Metrics sent:'+ metrics.toString().replace(/^|\n/g, '\n\t'))

      if (options.callback)
        options.callback(err, metrics.toString())
    })
  }

  function send () {
    if (Object.keys(queue).length === 0)
      return // log('Queue is empty. Nothing to send')

    var buffer = '', count = 0, line

    for (var name in queue) {
      line = name +' '+ queue[name].value +' '+ queue[name].timestamp +'\n'

      if (line.length + buffer.length > options.maxPacketSize
      && buffer.length > 0) {
        sendPacket(new Buffer(buffer), count)
        buffer = line
        count = 1
      }
      else {
        buffer += line
        count += 1
      }
    }

    if (buffer.length > 0)
      sendPacket(new Buffer(buffer), count)

    queue = {}
  }

  function log (line) {
    if (options.verbose)
      console.log('[graphite-udp]', line)
  }

  function extend (origin, add) {
    for (var key in add)
      origin[key] = add[key]
    return origin
  }

  return init()
}

module.exports = {
  createClient: function (options) {
    return new Client(options)
  }
}
