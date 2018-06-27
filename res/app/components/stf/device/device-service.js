var oboe = require('oboe')
var _ = require('lodash')
var EventEmitter = require('eventemitter3')

module.exports = function DeviceServiceFactory($http, socket, EnhanceDeviceService,$window) {
  var deviceService = {}

  function Tracker($scope, options) {
    var devices = []
    var devicesBySerial = Object.create(null)
    var scopedSocket = socket.scoped($scope)
    var digestTimer, lastDigest

    $scope.$on('$destroy', function() {
      clearTimeout(digestTimer)
    })

    function digest() {
      // Not great. Consider something else
      if (!$scope.$$phase) {
        $scope.$digest()
      }

      lastDigest = Date.now()
      digestTimer = null
    }

    function notify(event) {
      if (!options.digest) {
        return
      }

      if (event.important) {
        // Handle important updates immediately.
        //digest()
        window.requestAnimationFrame(digest)
      }
      else {
        if (!digestTimer) {
          var delta = Date.now() - lastDigest
          if (delta > 1000) {
            // It's been a while since the last update, so let's just update
            // right now even though it's low priority.
            digest()
          }
          else {
            // It hasn't been long since the last update. Let's wait for a
            // while so that the UI doesn't get stressed out.
            digestTimer = setTimeout(digest, delta)
          }
        }
      }
    }

    function sync(data) {
      // usable IF device is physically present AND device is online AND
      // preparations are ready AND the device has no owner or we are the
      // owner
      data.usable = data.present && data.status === 3 && data.ready &&
        (!data.owner || data.using)

      // Make sure we don't mistakenly think we still have the device
      if (!data.usable || !data.owner) {
        data.using = false
      }

      EnhanceDeviceService.enhance(data)
    }

    function get(data) {
      return devices[devicesBySerial[data.serial]]
    }

    var insert = function insert(data) {
      devicesBySerial[data.serial] = devices.push(data) - 1
      sync(data)
      this.emit('add', data)
    }.bind(this)

    var modify = function modify(data, newData) {
      _.merge(data, newData, function(a, b) {
        // New Arrays overwrite old Arrays
        if (_.isArray(b)) {
          return b
        }
      })
      sync(data)
      this.emit('change', data)
    }.bind(this)

    var remove = function remove(data) {
      var index = devicesBySerial[data.serial]
      if (index >= 0) {
        devices.splice(index, 1)
        delete devicesBySerial[data.serial]
        this.emit('remove', data)
      }
    }.bind(this)

    function fetch(data) {
      deviceService.load(data.serial)
        .then(function(device) {
          return changeListener({
            important: true
          , data: device
          })
        })
        .catch(function() {})
    }

    function addListener(event) {
      var device = get(event.data)
      if (device) {
        modify(device, event.data)
        notify(event)
      }
      else {
        if (options.filter(event.data)) {
          insert(event.data)
          notify(event)
        }
      }
    }

    function changeListener(event) {
      var device = get(event.data)
      if (device) {
        modify(device, event.data)
        if (!options.filter(device)) {
          remove(device)
        }
        notify(event)
      }
      else {
        if (options.filter(event.data)) {
          insert(event.data)
          // We've only got partial data
          fetch(event.data)
          notify(event)
        }
      }
    }

    scopedSocket.on('device.add', addListener)
    scopedSocket.on('device.remove', changeListener)
    scopedSocket.on('device.change', changeListener)

    this.add = function(device) {
      addListener({
        important: true
      , data: device
      })
    }

    this.devices = devices
  }

  Tracker.prototype = new EventEmitter()

  deviceService.trackAll = function($scope) {
    var tracker = new Tracker($scope, {
      filter: function() {
        return true
      }
    , digest: false
    })

    oboe('/api/v1/devices')
      .node('devices[*]', function(device) {
        console.log("All device Call..");
        tracker.add(device)
      })

    return tracker
  }

  deviceService.trackGroup = function($scope) {
    var tracker = new Tracker($scope, {
      filter: function(device) {
        return device.using
      }
    , digest: true
    })

    oboe('/api/v1/user/devices')
      .node('devices[*]', function(device) {
        tracker.add(device)
      })

    return tracker
  }

  deviceService.load = function(serial) {
    return $http.get('/api/v1/devices/' + serial)
      .then(function(response) {
        console.log("responce ", response)
        return response.data.device
      })

  }

  deviceService.load1 = function(serial) {
    console.log("On device page load");

    return $http.get('/api/v1/devices/' + serial)
      .success(function(response) {
        console('Sucess');
          return response;
      })
      .error(function(){
        console.log('Failuer')
        $window.location.href = 'https://www.amazon.in/';
      })
    

     // console.log("1->", response);

      /*
          
          console.log("2->", response.error);
          console.log("3->", response["$$state"]);    
          var test = response["$$state"];
          console.log("4->", test.status);    
          console.log("5->", test["status"]);    
          console.log("6->", test[0]);    
          console.log("7->", response["d"].status);    
          console.log("8->", response["$$state"].processScheduled);    
          console.log("9->", response["$$state"]["processScheduled"]);    
          console.log("10->", response["$$state"].value);    
          */

        response = new Promise(function(resolve, reject) {
          //resolve("done");
        
          reject(new Error("…")); // ignored
          //setTimeout(() => resolve("…")); // ignored
            });

          return response;
  }

  deviceService.get = function(serial, $scope) {
    console.log("deviceService Calling ........");
    var tracker = new Tracker($scope, {
      filter: function(device) {
        return device.serial === serial
      }
    , digest: true
    })

    return deviceService.load(serial)
      .then(function(device) {
        tracker.add(device)
        return device
      })
  }

  deviceService.updateNote = function(serial, note) {
    socket.emit('device.note', {
      serial: serial,
      note: note
    })
  }

  return deviceService
}
