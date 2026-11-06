(function() {
  'use strict';

  function gpbayLegacyCompat(root) {
    if (!root) return;

    try {
      if (!Date.now) Date.now = function() { return new Date().getTime(); };
    } catch (e) {}

    try {
      if (!String.prototype.trim) {
        String.prototype.trim = function() { return String(this).replace(/^\s+|\s+$/g, ''); };
      }
    } catch (e2) {}

    try {
      if (!Array.isArray) {
        Array.isArray = function(value) { return Object.prototype.toString.call(value) == '[object Array]'; };
      }
    } catch (e3) {}

    try {
      if (!Object.keys) {
        Object.keys = function(obj) {
          var out = [];
          if (obj == null) return out;
          for (var k in Object(obj)) {
            if (Object.prototype.hasOwnProperty.call(obj, k)) out.push(k);
          }
          return out;
        };
      }
    } catch (e4) {}

    try {
      if (!Function.prototype.bind) {
        Function.prototype.bind = function(ctx) {
          var fn = this;
          var base = Array.prototype.slice.call(arguments, 1);
          return function() {
            return fn.apply(ctx, base.concat(Array.prototype.slice.call(arguments)));
          };
        };
      }
    } catch (e5) {}

    try {
      if (!Date.prototype.toISOString) {
        Date.prototype.toISOString = function() {
          function pad(n) { return n < 10 ? '0' + n : String(n); }
          return this.getUTCFullYear() + '-' + pad(this.getUTCMonth() + 1) + '-' + pad(this.getUTCDate()) +
            'T' + pad(this.getUTCHours()) + ':' + pad(this.getUTCMinutes()) + ':' + pad(this.getUTCSeconds()) +
            '.' + ('00' + this.getUTCMilliseconds()).slice(-3) + 'Z';
        };
      }
    } catch (e6) {}

    if (!root.Promise) {
      (function() {
        function asap(fn) { setTimeout(fn, 0); }

        function LegacyPromise(executor) {
          if (!(this instanceof LegacyPromise)) throw new TypeError('Promise must be constructed');
          if (typeof executor != 'function') throw new TypeError('Promise executor is not a function');

          this._s = 0;
          this._v = undefined;
          this._h = [];

          var self = this;
          var done = false;

          function resolve(value) {
            if (done) return;
            done = true;
            resolveValue(self, value);
          }

          function reject(reason) {
            if (done) return;
            done = true;
            settle(self, 2, reason);
          }

          try { executor(resolve, reject); }
          catch (err) { reject(err); }
        }

        function settle(promise, state, value) {
          if (promise._s) return;
          promise._s = state;
          promise._v = value;
          flush(promise);
        }

        function resolveValue(promise, value) {
          if (value === promise) {
            settle(promise, 2, new TypeError('Promise cycle'));
            return;
          }

          if (value && (typeof value == 'object' || typeof value == 'function')) {
            var then;
            try { then = value.then; }
            catch (err) { settle(promise, 2, err); return; }

            if (typeof then == 'function') {
              var called = false;
              try {
                then.call(value, function(next) {
                  if (called) return;
                  called = true;
                  resolveValue(promise, next);
                }, function(reason) {
                  if (called) return;
                  called = true;
                  settle(promise, 2, reason);
                });
              } catch (err2) {
                if (!called) settle(promise, 2, err2);
              }
              return;
            }
          }

          settle(promise, 1, value);
        }

        function flush(promise) {
          if (!promise._s || !promise._h.length) return;
          var list = promise._h.slice(0);
          promise._h.length = 0;
          asap(function() {
            for (var i = 0; i < list.length; i++) runHandler(promise, list[i]);
          });
        }

        function runHandler(promise, handler) {
          var cb = promise._s == 1 ? handler.ok : handler.fail;
          if (typeof cb != 'function') {
            if (promise._s == 1) handler.resolve(promise._v);
            else handler.reject(promise._v);
            return;
          }

          try { handler.resolve(cb(promise._v)); }
          catch (err) { handler.reject(err); }
        }

        LegacyPromise.prototype.then = function(ok, fail) {
          var self = this;
          return new LegacyPromise(function(resolve, reject) {
            var handler = { ok: ok, fail: fail, resolve: resolve, reject: reject };
            if (!self._s) self._h.push(handler);
            else asap(function() { runHandler(self, handler); });
          });
        };

        LegacyPromise.prototype['catch'] = function(fail) {
          return this.then(null, fail);
        };

        LegacyPromise.resolve = function(value) {
          if (value instanceof LegacyPromise) return value;
          return new LegacyPromise(function(resolve) { resolve(value); });
        };

        LegacyPromise.reject = function(reason) {
          return new LegacyPromise(function(resolve, reject) { reject(reason); });
        };

        LegacyPromise.all = function(values) {
          return new LegacyPromise(function(resolve, reject) {
            if (!values || typeof values.length == 'undefined') {
              reject(new TypeError('Promise.all expects array-like value'));
              return;
            }

            var len = Number(values.length) || 0;
            var out = new Array(len);
            if (!len) { resolve(out); return; }
            var left = len;

            function capture(index) {
              LegacyPromise.resolve(values[index]).then(function(value) {
                out[index] = value;
                left--;
                if (!left) resolve(out);
              }, reject);
            }

            for (var i = 0; i < len; i++) capture(i);
          });
        };

        root.Promise = LegacyPromise;
      })();
    }
  }

  gpbayLegacyCompat(window);

  function gpbayWindowOrigin() {
    try {
      if (window.location && window.location.origin) return String(window.location.origin);
      if (window.location) return String(window.location.protocol || '') + '//' + String(window.location.host || '');
    } catch (e) {}
    return '';
  }

  var Defined = {
    api: 'lampac',
    localhost: 'https://gpbx.me/',
    apn: ''
  };

  var balansers_with_search;
  var unic_id = '';

  function gpbayUidClean(value) {
    var uid = '';

    try {
      uid = value == null ? '' : String(value);
    } catch (e) {
      uid = '';
    }

    try {
      uid = uid.replace(/^\s+|\s+$/g, '').toLowerCase();
    } catch (e2) {}

    if (!uid || /^\{[^}]+\}$/.test(uid)) return '';
    if (uid == 'undefined' || uid == 'null' || uid == 'false') return '';
    if (!/^[a-z0-9]{8}$/.test(uid)) return '';
    return uid;
  }

  function gpbayCreateUid() {
    try {
      if (Lampa && Lampa.Utils && typeof Lampa.Utils.uid == 'function') {
        return gpbayUidClean(Lampa.Utils.uid(8).toLowerCase());
      }
    } catch (e) {}

    try {
      return gpbayUidClean(((Date.now ? Date.now() : new Date().getTime()).toString(36) + Math.random().toString(36).replace(/[^a-z0-9]+/g, '')).slice(-8));
    } catch (e2) {}

    return 'uid' + (new Date().getTime() + '').slice(-5);
  }

  function gpbayLocalStorageGet(key) {
    try {
      if (typeof window != 'undefined' && window.localStorage)
        return gpbayUidClean(window.localStorage.getItem(key));
    } catch (e) {}

    return '';
  }

  function gpbayLocalStorageSet(key, value) {
    try {
      if (typeof window != 'undefined' && window.localStorage)
        window.localStorage.setItem(key, value);
    } catch (e) {}
  }

  function gpbayStorageGet(key) {
    try {
      if (Lampa && Lampa.Storage)
        return gpbayUidClean(Lampa.Storage.get(key, ''));
    } catch (e) {}

    return '';
  }

  function gpbayStorageSet(key, value) {
    try {
      if (Lampa && Lampa.Storage)
        Lampa.Storage.set(key, value);
    } catch (e) {}
  }

  function gpbaySaveUid(uid) {
    uid = gpbayUidClean(uid);
    if (!uid) return '';

    gpbayStorageSet('lampac_unic_id', uid);
    gpbayLocalStorageSet('lampac_unic_id', uid);
    gpbayLocalStorageSet('gpbay_lampac_unic_id', uid);

    unic_id = uid;
    return uid;
  }

  function gpbayEnsureUid() {
    var uid = gpbayStorageGet('lampac_unic_id');

    if (!uid) uid = gpbayUidClean(unic_id);
    if (!uid) uid = gpbayLocalStorageGet('lampac_unic_id');
    if (!uid) uid = gpbayLocalStorageGet('gpbay_lampac_unic_id');
    if (!uid) uid = gpbayCreateUid();

    return gpbaySaveUid(uid);
  }

  function gpbayRotateUid() {
    var previous = gpbayEnsureUid();
    var next = '';
    var i;

    for (i = 0; i < 12; i++) {
      next = gpbayCreateUid();
      if (next && next != previous) break;
    }

    if (!next || next == previous) return '';
    return gpbaySaveUid(next);
  }

  unic_id = gpbayEnsureUid();

  try {
    if (typeof window != 'undefined' && typeof window.globalThis == 'undefined') {
      window.globalThis = window;
    }
  } catch (e) {}

  // [PATCH] Аналітика повністю вимкнена
  var GPBAY_PAGE_TITLE = 'GProjectBay';
  var GPBAY_ANALYTICS_SETTING = 'gpbay_analytics_enabled';
  var gpbay_analytics_runtime_enabled = false;

  function gpbayAnalyticsEnabled() {
    return false;
  }

  function gpbayCleanText(value) {
    try {
      return (value || '').toString().replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    } catch (e) {
      return '';
    }
  }

  function gpbayMovieTitle(movie) {
    try {
      movie = movie || {};
      return gpbayCleanText(movie.title || movie.name || movie.original_title || movie.original_name || movie.search || '');
    } catch (e) {
      return '';
    }
  }

  function gpbayMovieYear(movie) {
    try {
      movie = movie || {};
      var year = ((movie.release_date || movie.first_air_date || movie.year || '0000') + '').slice(0, 4);
      return year && year != '0000' ? year : '';
    } catch (e) {
      return '';
    }
  }

  function gpbayMovieParams(movie) {
    return {};
  }

  function gpbayQualityValue(element) {
    try {
      if (!element) return '';
      if (typeof element.quality == 'string') return element.quality;
      if (element.quality && typeof element.quality == 'object') {
        for (var q in element.quality) {
          if (Object.prototype.hasOwnProperty.call(element.quality, q)) return q;
        }
      }
      if (typeof element.qualitys == 'string') return element.qualitys;
      if (element.qualitys && typeof element.qualitys == 'object') {
        for (var k in element.qualitys) {
          if (Object.prototype.hasOwnProperty.call(element.qualitys, k)) return k;
        }
      }
    } catch (e) {}
    return '';
  }

  function gpbayMediaBadges(element) {
    try {
      if (!element) return '';

      var parts = [];
      var skip = {
        url: 1,
        stream: 1,
        file: 1,
        playlist: 1,
        subtitles: 1,
        subtitle: 1,
        img: 1,
        image: 1,
        thumbnail: 1,
        vast_url: 1
      };

      for (var key in element) {
        if (!Object.prototype.hasOwnProperty.call(element, key)) continue;
        if (skip[key]) continue;

        var value = element[key];
        if (typeof value == 'string' && value.length && value.length <= 500)
          parts.push(value);
      }

      var text = parts.join(' ').toUpperCase();
      if (!text) return '';

      var token = function(value) {
        return new RegExp('(^|[^A-Z0-9])' + value + '([^A-Z0-9]|$)').test(text);
      };

      var badges = [];
      var hasDv = text.indexOf('DOLBY VISION') >= 0 || token('DV');
      var hdr = '';
      var codec = '';

      if (text.indexOf('HDR10+') >= 0 || text.indexOf('HDR10 PLUS') >= 0)
        hdr = 'HDR10+';
      else if (text.indexOf('HDR10') >= 0)
        hdr = 'HDR10';
      else if (!hasDv && token('HDR'))
        hdr = 'HDR';

      if (token('AV1'))
        codec = 'AV1';
      else if (token('HEVC') || text.indexOf('H.265') >= 0 || token('H265'))
        codec = 'HEVC';

      if (hasDv) badges.push(['DV', 'dv']);
      if (hdr) badges.push([hdr, 'hdr']);
      if (codec) badges.push([codec, 'codec']);

      if (badges.length < 3 && (text.indexOf('60FPS') >= 0 || text.indexOf('60 FPS') >= 0))
        badges.push(['60FPS', 'video']);

      if (badges.length < 3 && !hdr && (text.indexOf('10BIT') >= 0 || text.indexOf('10-BIT') >= 0 || text.indexOf('10 BIT') >= 0))
        badges.push(['10BIT', 'video']);

      if (!badges.length) return '';
      if (badges.length > 3) badges.length = 3;

      return badges.map(function(badge) {
        return '<span class="online-prestige__badge online-prestige__badge--' + badge[1] + '">' + badge[0] + '</span>';
      }).join('');
    } catch (e) {}

    return '';
  }

  // Заглушки аналітики
  function gpbayYmInit() {}
  function gpbayYmEvent() {}
  function gpbayYmPage() {}
  function gpbayGaInit() {}
  function gpbayGtag() {}
  function gpbayGaEvent() {}
  function gpbayGaPage() {}
  function gpbayAnalyticsOpen() {}
  function gpbayAnalyticsEvent() {}

  function getAndroidVersion() {
    if (Lampa.Platform.is('android')) {
      try {
        var current = AndroidJS.appVersion().split('-');
        return parseInt(current.pop());
      } catch (e) {
        return 0;
      }
    } else {
      return 0;
    }
  }

  var hostkey = 'https://gpbx.me'.replace('http://', '').replace('https://', '');

  if (!window.rch_nws || !window.rch_nws[hostkey]) {
    if (!window.rch_nws) window.rch_nws = {};

    window.rch_nws[hostkey] = {
      type: Lampa.Platform.is('android') ? 'apk' : Lampa.Platform.is('tizen') ? 'cors' : undefined,
      startTypeInvoke: false,
      rchRegistry: false,
      apkVersion: getAndroidVersion()
    };
  }

  window.rch_nws[hostkey].typeInvoke = function rchtypeInvoke(host, call) {
    if (!window.rch_nws[hostkey].startTypeInvoke) {
      window.rch_nws[hostkey].startTypeInvoke = true;

      var check = function check(good) {
        window.rch_nws[hostkey].type = Lampa.Platform.is('android') ? 'apk' : good ? 'cors' : 'web';
        call();
      };

      if (Lampa.Platform.is('android') || Lampa.Platform.is('tizen')) check(true);
      else {
        var net = new Lampa.Reguest();
        net.silent('https://gpbx.me'.indexOf(location.host) >= 0 ? 'https://github.com/' : host + '/cors/check', function() {
          check(true);
        }, function() {
          check(false);
        }, false, {
          dataType: 'text'
        });
      }
    } else call();
  };

  window.rch_nws[hostkey].Registry = function RchRegistry(client, startConnection) {
    window.rch_nws[hostkey].typeInvoke('https://gpbx.me', function() {

      client.invoke("RchRegistry", JSON.stringify({
        version: 151,
        host: location.host,
        rchtype: Lampa.Platform.is('android') ? 'apk' : Lampa.Platform.is('tizen') ? 'cors' : (window.rch_nws[hostkey].type || 'web'),
        apkVersion: window.rch_nws[hostkey].apkVersion,
        player: Lampa.Storage.field('player'),
        account_email: Lampa.Storage.get('account_email', ''),
        unic_id: Lampa.Storage.get('lampac_unic_id', ''),
        profile_id: Lampa.Storage.get('lampac_profile_id', ''),
        token: ''
      }));

      if (client._shouldReconnect && window.rch_nws[hostkey].rchRegistry) {
        if (startConnection) startConnection();
        return;
      }

      window.rch_nws[hostkey].rchRegistry = true;

      client.on('RchRegistry', function(clientIp) {
        if (startConnection) startConnection();
      });

      client.on("RchClient", function(rchId, url, data, headers, returnHeaders) {
        var network = new Lampa.Reguest();

        function sendResult(uri, html) {
          $.ajax({
            url: 'https://gpbx.me/rch/' + uri + '?id=' + rchId,
            type: 'POST',
            data: html,
            async: true,
            cache: false,
            contentType: false,
            processData: false,
            success: function(j) {},
            error: function() {
              client.invoke("RchResult", rchId, '');
            }
          });
        }

        function result(html) {
          if (Lampa.Arrays.isObject(html) || Lampa.Arrays.isArray(html)) {
            html = JSON.stringify(html);
          }

          if (typeof CompressionStream !== 'undefined' && html && html.length > 1000) {
            var compressionStream = new CompressionStream('gzip');
            var encoder = new TextEncoder();
            var readable = new ReadableStream({
              start: function(controller) {
                controller.enqueue(encoder.encode(html));
                controller.close();
              }
            });
            var compressedStream = readable.pipeThrough(compressionStream);
            new Response(compressedStream).arrayBuffer()
              .then(function(compressedBuffer) {
                var compressedArray = new Uint8Array(compressedBuffer);
                if (compressedArray.length > html.length) {
                  sendResult('result', html);
                } else {
                  sendResult('gzresult', compressedArray);
                }
              })
              .catch(function() {
                sendResult('result', html);
              });

          } else {
            sendResult('result', html);
          }
        }

        // [PATCH] Заблоковано виконання довільного JS-коду (eval / evalrun)
        if (url == 'eval' || url == 'evalrun') {
          console.warn('[GPBAY SECURITY] Blocked remote RCH eval request:', url);
          result('');
        } else if (url == 'ping') {
          result('pong');
        } else {
          network["native"](url, result, function(e) {
            result('');
          }, data, {
            dataType: 'text',
            timeout: 1000 * 8,
            headers: headers,
            returnHeaders: returnHeaders
          });
        }
      });

      client.on('Connected', function(connectionId) {
        window.rch_nws[hostkey].connectionId = connectionId;
      });
      client.on('Closed', function() {});
      client.on('Error', function(err) {});
    });
  };
  window.rch_nws[hostkey].typeInvoke('https://gpbx.me', function() {});

  function rchInvoke(json, call) {
    if (window.nwsClient && window.nwsClient[hostkey] && window.nwsClient[hostkey]._shouldReconnect){
      call();
      return;
    }
    if (!window.nwsClient) window.nwsClient = {};
    if (window.nwsClient[hostkey] && window.nwsClient[hostkey].socket)
      window.nwsClient[hostkey].socket.close();
    window.nwsClient[hostkey] = new NativeWsClient(json.nws, {
      autoReconnect: false
    });
    window.nwsClient[hostkey].on('Connected', function(connectionId) {
      window.rch_nws[hostkey].Registry(window.nwsClient[hostkey], function() {
        call();
      });
    });
    window.nwsClient[hostkey].connect();
  }

  function rchRun(json, call) {
    if (typeof NativeWsClient == 'undefined') {
      Lampa.Utils.putScript(["https://gpbx.me/js/nws-client-es5.js?v18112025"], function() {}, false, function() {
        rchInvoke(json, call);
      }, true);
    } else {
      rchInvoke(json, call);
    }
  }

  function account(url) {
    url = url + '';
    if (url.indexOf('account_email=') == -1) {
      var email = Lampa.Storage.get('account_email');
      if (email) url = Lampa.Utils.addUrlComponent(url, 'account_email=' + encodeURIComponent(email));
    }
    if (url.indexOf('uid=') == -1) {
      var uid = gpbayEnsureUid();
      if (uid) url = Lampa.Utils.addUrlComponent(url, 'uid=' + encodeURIComponent(uid));
    }
    if (url.indexOf('token=') == -1) {
      var token = '';
      if (token != '') url = Lampa.Utils.addUrlComponent(url, 'token=');
    }
    if (url.indexOf('nws_id=') == -1 && window.rch_nws && window.rch_nws[hostkey]) {
      var nws_id = window.rch_nws[hostkey].connectionId || Lampa.Storage.get('lampac_nws_id', '');
      if (nws_id) url = Lampa.Utils.addUrlComponent(url, 'nws_id=' + encodeURIComponent(nws_id));
    }
    return url;
  }

  var gpbay_pairing_state = {
    timer: 0,
    refreshTimer: 0,
    active: false,
    locked: false,
    pairingId: '',
    refreshCooldown: 0,
    startRetryCount: 0,
    uidRotated: false,
    reconnectActive: false
  };

  function templateValueOrEmpty(value) {
    var v = (value || '') + '';
    return /^\{[^}]+\}$/.test(v.trim()) ? '' : v;
  }

  function pairingBase() {
    var external = templateValueOrEmpty('{pairing_host}');
    var host = external || Defined.localhost;
    return (host + '').replace(/\/+$/, '');
  }

  function pairingUrl(path) {
    return pairingBase() + '/pair/v1/' + (path || '').replace(/^\/+/, '');
  }

  function getPairingUid() {
    return gpbayEnsureUid();
  }

  function getPairingProfileId() {
    return Lampa.Storage.get('lampac_profile_id', '');
  }

  function getPairingPlatform() {
    if (Lampa.Platform.is('android')) return 'android';
    if (Lampa.Platform.is('tizen')) return 'tizen';
    if (Lampa.Platform.is('webos')) return 'webos';
    if (Lampa.Platform.is('apple')) return 'apple';
    if (Lampa.Platform.is('browser')) return 'browser';
    return 'unknown';
  }

  function getPairingAppVersion() {
    try {
      if (Lampa.Platform.is('android')) return String(getAndroidVersion() || '');
      if (Lampa.Manifest && Lampa.Manifest.app_digital) return String(Lampa.Manifest.app_digital);
    } catch (e) {}
    return '';
  }

  function getLampacRchType() {
    try {
      return ((window.rch_nws && window.rch_nws[hostkey]) ? window.rch_nws[hostkey].type : (window.rch && window.rch[hostkey]) ? window.rch[hostkey].type : '') || '';
    } catch (e) {}
    return '';
  }

  function getPairingRchType() {
    return getLampacRchType();
  }

  function getPairingDeviceName() {
    var platform = getPairingPlatform();
    switch (platform) {
      case 'android': return 'Android device';
      case 'tizen': return 'Samsung TV';
      case 'webos': return 'LG TV';
      case 'apple': return 'Apple device';
      case 'browser': return 'Browser';
      default: return 'Lampa device';
    }
  }

  function escapePairingHtml(value) {
    return (value == null ? '' : String(value))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getPairingBotLink(pairing, allowFallback) {
    try {
      var direct = pairing && (pairing.botLink || pairing.bot_link || pairing.reconnectLink || pairing.reconnect_link);
      if (direct) return String(direct).trim();
    } catch (e) {}

    if (allowFallback) {
      try {
        if (typeof GPBAY_GOLD_BOT_LINK != 'undefined' && GPBAY_GOLD_BOT_LINK) {
          var fallbackLink = String(GPBAY_GOLD_BOT_LINK);
          if (/([?&]start=)[^&#]*/i.test(fallbackLink))
            return fallbackLink.replace(/([?&]start=)[^&#]*/i, '$1restore');
          return fallbackLink + (fallbackLink.indexOf('?') >= 0 ? '&' : '?') + 'start=restore';
        }
      } catch (e2) {}
    }

    return '';
  }

  function getPairingBotHandle(pairing, allowFallback) {
    if (pairing && (pairing.botHandle || pairing.bot_handle))
      return pairing.botHandle || pairing.bot_handle;
    var link = getPairingBotLink(pairing, allowFallback);
    var match = link.match(/t\.me\/([^\/?#]+)/i);
    return match && match[1] ? '@' + match[1] : 'Telegram-бот';
  }

  function getPairingBadgeText(pairing) {
    if (pairing && pairing.badgeText) return pairing.badgeText;
    return 'Telegram · подключение';
  }

  function getPairingQrImage(pairing, allowFallback) {
    if (pairing && (pairing.qrDataUri || pairing.qr_data_uri))
      return pairing.qrDataUri || pairing.qr_data_uri;
    if (pairing && (pairing.qrImageUrl || pairing.qr_image_url))
      return pairing.qrImageUrl || pairing.qr_image_url;
    var link = getPairingBotLink(pairing, allowFallback);
    if (link)
      return 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(link);
    return '';
  }

  var GPBAY_FOREIGN_SETTING = 'gpbay_foreign_sources_enabled';
  var gpbay_foreign_available = null;
  var gpbay_foreign_check_inflight = false;
  var gpbay_foreign_check_time = 0;

  function gpbayForeignSourcesEnabled() {
    var value = 'true';
    try { value = Lampa.Storage.get(GPBAY_FOREIGN_SETTING, 'true'); } catch (e) {}
    return !(value === false || value === 0 || value === '0' || value === 'false' || value === 'off');
  }

  function gpbayIsForeignSource(item) {
    return !!(item && item.eng === true);
  }

  function gpbayFilterForeignSources(items) {
    if (!items || !Array.isArray(items) || gpbayForeignSourcesEnabled()) return items;
    return items.filter(function(item) { return !gpbayIsForeignSource(item); });
  }

  function gpbaySyncForeignSettingUi(item) {
    var target = item && item.length ? item : $('[data-name="' + GPBAY_FOREIGN_SETTING + '"]');
    if (!target || !target.length) return;

    target.each(function() {
      var row = $(this);
      if (gpbay_foreign_available !== true) {
        row.hide().removeClass('focus');
        return;
      }

      row.show();
      row.find('.settings-param__value').text(gpbayForeignSourcesEnabled() ? 'Вкл' : 'Выкл');
      setTimeout(function() {
        row.off('hover:enter').off('hover:enter.gpbayForeignSetting');
        row.on('hover:enter.gpbayForeignSetting', function(event) {
          if (event && event.preventDefault) event.preventDefault();
          if (event && event.stopImmediatePropagation) event.stopImmediatePropagation();
          if (gpbay_foreign_available !== true) return false;
          gpbayApplyForeignSetting(gpbayForeignSourcesEnabled() ? 'false' : 'true');
          return false;
        });
      }, 0);
    });
  }

  function gpbayCheckForeignAvailability() {
    var now = Date.now();
    if (gpbay_foreign_check_inflight ||
        (gpbay_foreign_check_time && now - gpbay_foreign_check_time < 60000)) return;

    gpbay_foreign_check_inflight = true;
    gpbay_foreign_check_time = now;

    var url = Defined.localhost + 'lite/events?gpbaymeta=true&source=tmdb&original_language=en&tmdb_id=1&serial=0';
    var rchtype = '';
    try { rchtype = getLampacRchType() || ''; } catch (ignore) {}
    if (rchtype) url += '&rchtype=' + encodeURIComponent(rchtype);
    try {
      var req = new Lampa.Reguest();
      if (req.timeout) req.timeout(12000);
      req.silent(account(url), function(response) {
        gpbay_foreign_check_inflight = false;
        var json = gpbayParseJsonResponse(response);
        var available = json && json.online;
        if (!Array.isArray(available)) return;

        var found = false;
        for (var i = 0; i < available.length; i++) {
          if (gpbayIsForeignSource(available[i])) {
            found = true;
            break;
          }
        }

        gpbay_foreign_available = found;
        gpbaySyncForeignSettingUi();
      }, function() {
        gpbay_foreign_check_inflight = false;
        gpbay_foreign_check_time = 0;
      }, false, {
        dataType: 'json',
        headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
      });
    } catch (e) {
      gpbay_foreign_check_inflight = false;
      gpbay_foreign_check_time = 0;
    }
  }

  function gpbayApplyForeignSetting(value) {
    var enabled = !(value === false || value === 0 || value === '0' || value === 'false' || value === 'off');
    try { Lampa.Storage.set(GPBAY_FOREIGN_SETTING, enabled ? 'true' : 'false'); } catch (e) {}
    gpbaySyncForeignSettingUi();
  }

  // [PATCH] Промо-блоки вимкнені, статус користувача для UI завжди 'platinum'
  var GPBAY_GOLD_PROMO_SETTING = 'gpbay_gold_promo_enabled';
  var GPBAY_SETTINGS_COMPONENT = 'lampac';
  var GPBAY_SETTINGS_ICON_MARKER = 'gpbay-settings-component-marker';
  var gpbay_gold_settings_name = 'Lampac';
  var gpbay_gold_promo_component = null;
  var gpbay_gold_settings_retry_timer = 0;
  var gpbay_gold_settings_order_timer = 0;
  var gpbay_gold_settings_order_interval = 0;
  var gpbay_gold_settings_order_observer = null;
  var gpbay_gold_settings_order_hooked = false;
  var gpbay_gold_settings_order_guard = false;
  var GPBAY_GOLD_BOT_LINK = 'https://t.me/gpbx_bot?start=gold';
  var gpbay_user_tier = 'platinum';
  var gpbay_source_request_generation = 0;

  function gpbaySetUserTier(value) {
    gpbay_user_tier = 'platinum';
  }

  function gpbayGoldUserGroupKnown() {
    return true;
  }

  function gpbayGoldUserHasGroup() {
    return true;
  }

  function gpbayGoldPromoEnabled() {
    return false;
  }

  function gpbayStopGoldPromoRefresh() {}
  function gpbayRequestGoldPromoRefresh() {}
  function gpbaySyncGoldPromoSettingUi() {}
  function gpbayApplyGoldPromoSetting() {}

  function gpbayGoldSettingsIcon() {
    return '<svg class="' + GPBAY_SETTINGS_ICON_MARKER + '" data-gpbay-settings-icon="1" width="24" height="24" viewBox="0 0 28 29" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<g transform="translate(1.2 0)">' +
        '<path d="M22.4 8.55A10.55 10.55 0 1 0 22.4 20.45V14.5H18.55" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"></path>' +
        '<path d="M18.55 13.72C19.22 14.11 19.22 14.89 18.55 15.28L13.25 18.34C12.58 18.73 11.75 18.24 11.75 17.46V11.54C11.75 10.76 12.58 10.27 13.25 10.66L18.55 13.72Z" fill="currentColor"></path>' +
      '</g>' +
    '</svg>';
  }

  function gpbayFindSettingsFolder() {
    var folder = $();

    try {
      folder = $('.' + GPBAY_SETTINGS_ICON_MARKER).closest('.settings-folder').first();
      if (folder.length) return folder;
    } catch (e) {}

    try {
      folder = $('.settings-folder[data-component="' + GPBAY_SETTINGS_COMPONENT + '"]').first();
      if (folder.length) return folder;
    } catch (e2) {}

    try {
      $('.settings-folder').each(function() {
        var item = $(this);
        var name = item.find('.settings-folder__name').text();
        name = name == null ? '' : String(name).replace(/^\s+|\s+$/g, '');

        if (name == gpbay_gold_settings_name) {
          folder = item;
          return false;
        }
      });
    } catch (e3) {}

    return folder;
  }

  function gpbayPlaceSettingsFolderSecond() {
    try {
      var folder = gpbayFindSettingsFolder();
      if (!folder || !folder.length) return false;

      var parent = folder.parent();
      if (!parent.length) return false;

      var account = parent.children('.settings-folder[data-component="account"]').first();
      var anchor = account.length ? account : parent.children('.settings-folder').not(folder).first();
      if (!anchor.length || anchor[0] === folder[0]) return true;

      var previous = folder.prevAll('.settings-folder').first();
      if (!previous.length || previous[0] !== anchor[0]) folder.insertAfter(anchor);

      return true;
    } catch (e) {}

    return false;
  }

  function gpbayMoveSettingsComponentLastInApi() {
    if (gpbay_gold_settings_order_guard) return;

    try {
      if (!Lampa.SettingsApi || typeof Lampa.SettingsApi.allComponents != 'function') return;

      var components = Lampa.SettingsApi.allComponents();
      var own = components && components[GPBAY_SETTINGS_COMPONENT];
      if (!own) return;

      gpbay_gold_settings_order_guard = true;
      delete components[GPBAY_SETTINGS_COMPONENT];
      components[GPBAY_SETTINGS_COMPONENT] = own;
      gpbay_gold_settings_order_guard = false;
    } catch (e) {
      gpbay_gold_settings_order_guard = false;
    }
  }

  function gpbayScheduleSettingsFolderOrder(delay) {
    if (gpbay_gold_settings_order_timer) clearTimeout(gpbay_gold_settings_order_timer);

    gpbay_gold_settings_order_timer = setTimeout(function() {
      gpbay_gold_settings_order_timer = 0;
      gpbayPlaceSettingsFolderSecond();
    }, Number(delay || 0));
  }

  function gpbaySettingsFolderOrderBurst() {
    var delays = [0, 40, 120, 300, 700, 1500, 3000];

    for (var i = 0; i < delays.length; i++) {
      (function(delay) {
        setTimeout(function() {
          gpbayPlaceSettingsFolderSecond();
        }, delay);
      })(delays[i]);
    }
  }

  function gpbayHookSettingsAddComponent() {
    if (gpbay_gold_settings_order_hooked || !Lampa.SettingsApi ||
        typeof Lampa.SettingsApi.addComponent != 'function') return;

    var original = Lampa.SettingsApi.addComponent;

    Lampa.SettingsApi.addComponent = function(data) {
      var result = original.apply(this, arguments);

      if (!data || data.component != GPBAY_SETTINGS_COMPONENT) {
        gpbayMoveSettingsComponentLastInApi();
        gpbayScheduleSettingsFolderOrder(0);
        setTimeout(function() { gpbayPlaceSettingsFolderSecond(); }, 100);
      }

      return result;
    };

    gpbay_gold_settings_order_hooked = true;
  }

  function gpbayWatchSettingsFolderOrder() {
    gpbaySettingsFolderOrderBurst();
    gpbayHookSettingsAddComponent();

    if (!gpbay_gold_settings_order_observer && typeof MutationObserver != 'undefined') {
      try {
        var root = document.body || document.documentElement;

        if (root) {
          gpbay_gold_settings_order_observer = new MutationObserver(function(mutations) {
            for (var i = 0; i < mutations.length; i++) {
              var nodes = mutations[i].addedNodes || [];

              for (var j = 0; j < nodes.length; j++) {
                var node = nodes[j];
                if (!node || node.nodeType !== 1) continue;

                var added = $(node);
                if (added.hasClass('settings-folder') ||
                    added.find('.settings-folder').length ||
                    added.hasClass(GPBAY_SETTINGS_ICON_MARKER) ||
                    added.find('.' + GPBAY_SETTINGS_ICON_MARKER).length) {
                  gpbayScheduleSettingsFolderOrder(20);
                  return;
                }
              }
            }
          });

          gpbay_gold_settings_order_observer.observe(root, { childList: true, subtree: true });
        }
      } catch (e) {
        gpbay_gold_settings_order_observer = null;
      }
    }

    if (!gpbay_gold_settings_order_observer) {
      try {
        $(document).off('DOMNodeInserted.gpbaySettingsOrder');
        $(document).on('DOMNodeInserted.gpbaySettingsOrder', function(event) {
          var added = $(event.target);

          if (added.hasClass('settings-folder') ||
              added.find('.settings-folder').length ||
              added.hasClass(GPBAY_SETTINGS_ICON_MARKER) ||
              added.find('.' + GPBAY_SETTINGS_ICON_MARKER).length)
            gpbayScheduleSettingsFolderOrder(20);
        });
      } catch (e2) {}

      if (!gpbay_gold_settings_order_interval) {
        gpbay_gold_settings_order_interval = setInterval(function() {
          gpbayPlaceSettingsFolderSecond();
        }, 1000);
      }
    }
  }

  function gpbayRegisterSettings(pluginName) {
    var settingsVersion = 10;

    if (typeof Lampa == 'undefined' || !Lampa.SettingsApi ||
        typeof Lampa.SettingsApi.addComponent != 'function' ||
        typeof Lampa.SettingsApi.addParam != 'function')
      return false;

    if (window.__gpbay_gold_settings_registered === settingsVersion)
      return true;

    try {
      if (typeof Lampa.SettingsApi.removeComponent == 'function')
        Lampa.SettingsApi.removeComponent(GPBAY_SETTINGS_COMPONENT);
      else if (typeof Lampa.SettingsApi.removeParams == 'function')
        Lampa.SettingsApi.removeParams(GPBAY_SETTINGS_COMPONENT);

      gpbayForeignSourcesEnabled();
      gpbay_gold_settings_name = pluginName || 'Lampac';
      gpbayHookSettingsAddComponent();

      Lampa.SettingsApi.addComponent({
        component: GPBAY_SETTINGS_COMPONENT,
        name: gpbay_gold_settings_name,
        icon: gpbayGoldSettingsIcon(),
        after: 'account'
      });

      Lampa.SettingsApi.addParam({
        component: GPBAY_SETTINGS_COMPONENT,
        param: {
          name: GPBAY_FOREIGN_SETTING,
          type: 'trigger',
          default: true
        },
        field: {
          name: 'Зарубежные источники',
          description: 'Включить или отключить зарубежные источники'
        },
        onRender: function(item) {
          gpbaySyncForeignSettingUi(item);
          gpbayCheckForeignAvailability();
        },
        onChange: function(value) {
          gpbayApplyForeignSetting(value);
        }
      });

      gpbayMoveSettingsComponentLastInApi();
      gpbayWatchSettingsFolderOrder();
    } catch (e2) {
      return false;
    }

    window.__gpbay_gold_settings_registered = settingsVersion;
    return true;
  }

  function gpbayEnsureSettings(pluginName, attempt) {
    attempt = Number(attempt || 0);
    if (gpbayRegisterSettings(pluginName)) return;
    if (attempt >= 20 || gpbay_gold_settings_retry_timer) return;

    gpbay_gold_settings_retry_timer = setTimeout(function() {
      gpbay_gold_settings_retry_timer = 0;
      gpbayEnsureSettings(pluginName, attempt + 1);
    }, 250);
  }

  function getPairingReasonCode(resp) {
    try {
      return gpbayCleanText(resp && (resp.reasonCode || resp.reason_code || resp.error || resp.status)).toLowerCase();
    } catch (e) {}
    return '';
  }

  function isPairingNonPairingResponse(resp) {
    if (!resp || resp.authorized === true) return false;
    if (resp.requiresPairing === false || resp.requires_pairing === false) return true;
    var reason = getPairingReasonCode(resp);
    return reason == 'suspended' || reason == 'bot_blocked' || reason == 'blocked' ||
      reason == 'banned' || reason == 'disabled' || reason == 'expired' ||
      reason == 'registration_pending' || reason == 'device_disabled' || reason == 'deactivated' || reason == 'chat_not_found';
  }

  function isPairingBlockedResponse(resp) {
    if (!resp) return false;
    if (resp.blocked === true || resp.suspended === true) return true;
    if ((resp.status || '').toString().toLowerCase() == 'blocked') return true;
    if ((resp.error || '').toString().toLowerCase() == 'user disabled') return true;
    return isPairingNonPairingResponse(resp);
  }

  function isTelegramReconnectResponse(resp) {
    if (!resp) return false;
    if (resp.reconnectRequired === true || resp.reconnect_required === true) return true;
    if (!(resp.suspended === true || resp.blocked === true)) return false;

    var reason = getPairingReasonCode(resp);
    return reason == 'blocked' || reason == 'bot_blocked' || reason == 'telegram_bot_blocked' ||
      reason == 'telegram_unreachable' || reason == 'chat_not_found';
  }

  function getPairingUnavailableTitle(resp) {
    var reason = getPairingReasonCode(resp);
    if (reason == 'expired') return 'Срок доступа истёк';
    if (reason == 'registration_pending') return 'Ожидается подтверждение';
    if (reason == 'device_disabled') return 'Устройство отключено';
    if ((resp && resp.suspended === true) || reason == 'suspended' || reason == 'bot_blocked' ||
        reason == 'telegram_unreachable' || reason == 'deactivated' || reason == 'chat_not_found')
      return 'Доступ приостановлен';
    if (reason == 'banned' || reason == 'disabled' || reason == 'blocked') return 'Доступ ограничен';
    return 'Доступ недоступен';
  }

  function getPairingBlockedMessage(resp) {
    var reason = '';
    var message = '';

    try { reason = gpbayCleanText(resp && (resp.suspensionReason || resp.suspension_reason || resp.banReason || resp.ban_reason)); } catch (e) {}
    try { message = gpbayCleanText(resp && (resp.message || resp.detail)); } catch (e2) {}

    if (message) return message;
    if (reason) return reason;
    return 'Доступ временно недоступен. Откройте Telegram-бота для уточнения статуса.';
  }

  function stopPairingTimer() {
    if (gpbay_pairing_state.timer) {
      clearTimeout(gpbay_pairing_state.timer);
      gpbay_pairing_state.timer = 0;
    }
  }

  function stopPairingRefreshTimer() {
    if (gpbay_pairing_state.refreshTimer) {
      clearTimeout(gpbay_pairing_state.refreshTimer);
      gpbay_pairing_state.refreshTimer = 0;
    }
  }

  function formatPairingCooldown(seconds) {
    var total = Math.max(0, parseInt(seconds || 0, 10));
    var minutes = Math.floor(total / 60);
    var secs = total % 60;
    return ('0' + minutes).slice(-2) + ':' + ('0' + secs).slice(-2);
  }

  function ensurePairingModalCss() {
    if (document.getElementById('gpbay_pairing_modal_css')) return;
    var style = document.createElement('style');
    style.id = 'gpbay_pairing_modal_css';
    style.type = 'text/css';
    style.textContent = '' +
      '.modal.pairing-modal #gpbayPairingRefresh.is-disabled{opacity:.56 !important;cursor:default !important;pointer-events:none !important;}' +
      '@media screen and (max-width:480px){' +
      '.modal.pairing-modal{display:flex !important;align-items:center !important;justify-content:center !important;padding:.85em !important;}' +
      '.modal.pairing-modal .modal__content{max-width:34em !important;position:relative !important;left:auto !important;right:auto !important;bottom:auto !important;top:auto !important;width:100% !important;border-radius:1.2em !important;max-height:calc(100vh - 1.7em) !important;overflow:visible !important;}' +
      '.modal.pairing-modal #gpbayPairingCard{max-height:calc(100vh - 1.7em) !important;overflow-y:auto !important;-webkit-overflow-scrolling:touch !important;}' +
      '}';
    document.head.appendChild(style);
  }

  function setPairingRefreshCooldown(seconds) {
    stopPairingRefreshTimer();
    gpbay_pairing_state.refreshCooldown = Math.max(0, parseInt(seconds || 0, 10));

    var render = function() {
      var button = $('#gpbayPairingRefresh');
      if (!button.length) {
        stopPairingRefreshTimer();
        return;
      }

      if (gpbay_pairing_state.refreshCooldown > 0) {
        button.addClass('is-disabled').text('Новый код через ' + formatPairingCooldown(gpbay_pairing_state.refreshCooldown));
        gpbay_pairing_state.refreshCooldown--;
        gpbay_pairing_state.refreshTimer = setTimeout(render, 1000);
      } else {
        button.removeClass('is-disabled').text('Получить новый код');
      }
    };

    render();
  }

  function tunePairingModalLayout() {
    ensurePairingModalCss();
    var modal = $('.modal');
    if (!modal.length) return;
    var content = modal.find('.modal__content');
    modal.addClass('pairing-modal');
    modal.css({
      position: 'fixed',
      top: '0',
      right: '0',
      bottom: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: window.innerWidth <= 560 ? '.45em' : '.8em',
      boxSizing: 'border-box'
    });
    if (window.innerWidth <= 560) {
      content.css({
        width: '100%',
        maxWidth: '34em',
        margin: '0 auto',
        alignSelf: 'center',
        maxHeight: 'calc(100vh - 1.2em)',
        overflow: 'visible'
      });
    } else {
      content.css({
        width: '',
        maxWidth: '',
        margin: '0 auto',
        alignSelf: 'center',
        maxHeight: 'calc(100vh - 1.6em)',
        overflowY: 'auto'
      });
    }
  }

  function gpbayParseJsonResponse(value) {
    if (value && typeof value == 'object') return value;

    if (typeof value == 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {}
    }

    return {};
  }

  function requestPairingJson(method, url, payload, onSuccess, onError) {
    var completed = false;
    var ajaxStarted = false;

    function success(resp) {
      if (completed) return;
      completed = true;
      if (onSuccess) onSuccess(gpbayParseJsonResponse(resp));
    }

    function fail(data, xhr) {
      if (completed) return;
      completed = true;
      if (onError) onError(data || {}, xhr);
    }

    function ajaxFallback() {
      if (ajaxStarted || completed) return;
      ajaxStarted = true;

      $.ajax({
        url: url,
        method: method,
        type: method,
        dataType: 'json',
        timeout: 10000,
        cache: false,
        contentType: payload ? 'application/json' : undefined,
        data: payload ? JSON.stringify(payload) : undefined,
        success: function(resp) {
          success(resp || {});
        },
        error: function(xhr) {
          var data = xhr && xhr.responseJSON ? xhr.responseJSON : null;
          if (!data && xhr && xhr.responseText) {
            try {
              data = JSON.parse(xhr.responseText);
            } catch (e) {}
          }
          fail(data || {}, xhr);
        }
      });
    }

    if (method == 'GET') {
      try {
        if (Lampa && Lampa.Reguest) {
          var req = new Lampa.Reguest();
          if (req.timeout) req.timeout(10000);

          req.silent(url, function(resp) {
            success(resp);
          }, function() {
            ajaxFallback();
          }, false, {
            dataType: 'json',
            timeout: 10000
          });
          return;
        }
      } catch (e2) {}
    }

    ajaxFallback();
  }

  var Network = Lampa.Reguest;

  var GPBAY_GRAPHITE_SELECT_CLASS = 'gpbay-online-select-graphite';
  var gpbay_graphite_filter = null;
  var gpbay_graphite_listener = null;
  var gpbay_graphite_hide_timer = null;
  var GPBAY_GRAPHITE_CLOSE_MS = 180;

  function gpbayGraphiteEnsureCss() {
    if (document.getElementById('gpbay_graphite_select_css')) return;

    var scope = '.selectbox.gpbay-online-select-graphite ';
    var sourceScope = '.selectbox.gpbay-online-select-graphite.gpbay-graphite-source-menu ';
    var rules = [
      scope + '.selectbox__layer{background:rgba(0,0,0,.18)!important}',
      scope + '.selectbox__content{background-color:#202930!important;background-image:none!important;overflow:hidden!important;border:1px solid rgba(255,255,255,.09)!important;border-right:0!important;-webkit-border-radius:.5em 0 0 .5em!important;border-radius:.5em 0 0 .5em!important;-webkit-box-shadow:none!important;box-shadow:none!important}',
      '@media screen and (min-width:481px){' +
        scope + '.selectbox__content{-webkit-transition:-webkit-transform .18s ease-out,opacity .18s ease-out!important;transition:transform .18s ease-out,opacity .18s ease-out!important;opacity:1!important}' +
        'body:not(.selectbox--open) .selectbox.gpbay-online-select-graphite .selectbox__content{opacity:0!important}' +
      '}',
      scope + '.gpbay-graphite-backdrop{display:block!important;position:absolute!important;left:0!important;top:0!important;width:100%!important;height:100%!important;z-index:0!important;pointer-events:none!important}',
      scope + '.selectbox__content:before{content:""!important;display:block!important;position:absolute!important;top:0!important;left:0!important;right:0!important;bottom:0!important;z-index:1!important;background:rgba(0,0,0,.14)!important;pointer-events:none!important}',
      scope + '.selectbox__head,' + scope + '.selectbox__body{position:relative!important;z-index:2!important}',
      scope + '.selectbox__head{padding:1.04em 1.02em .96em!important;border-bottom:1px solid rgba(255,255,255,.075)!important}',
      scope + '.selectbox__title{font-size:1.38em!important;font-weight:400!important;line-height:1.25!important;color:#f4f7fa!important}',
      scope + '.selectbox__body{padding:0 .8em .6em!important;box-sizing:border-box!important}',
      scope + '.selectbox__body.layer--wheight{margin-top:1em!important}',
      scope + '.selectbox__body .scroll--mask{-webkit-mask-image:none!important;mask-image:none!important}',
      scope + '.selectbox__body .scroll__content{padding:0 0 .4em!important}',
      sourceScope + '.selectbox__body .scroll__body{padding-bottom:2.1em!important;box-sizing:content-box!important}',
      scope + '.selectbox-item{position:relative!important;margin:0!important;padding:.68em 2.5em .68em 2.8em!important;min-height:2.68em!important;box-sizing:border-box!important;background:transparent!important;border:1px solid transparent!important;border-bottom-color:rgba(255,255,255,.055)!important;-webkit-border-radius:.64em!important;border-radius:.64em!important;color:rgba(255,255,255,.94)!important;-webkit-box-shadow:none!important;box-shadow:none!important;-webkit-transition:none!important;transition:none!important;-webkit-animation:none!important;animation:none!important;-webkit-transform:none!important;transform:none!important}',
      scope + '.selectbox-item__title{font-size:1.35em!important;font-weight:400!important;line-height:1.25!important;white-space:normal!important;overflow-wrap:break-word!important;word-wrap:break-word!important}',
      sourceScope + '.selectbox-item.gpbay-graphite-source .selectbox-item__title{font-size:1.45em!important}',
      scope + '.selectbox-item__subtitle{font-size:.88em!important;line-height:1.27!important;margin-top:.24em!important;color:rgba(230,237,243,.66)!important;opacity:1!important}',
      scope + '.selectbox-item.gpbay-graphite-filter-choice .selectbox-item__subtitle{font-size:1.1em!important}',
      scope + '.selectbox-item.selected:not(.focus):not(:hover){background:rgba(108,184,238,.055)!important}',
      scope + '.selectbox-item.focus,' + scope + '.selectbox-item:hover{background:rgba(130,184,221,.125)!important;border-color:rgba(158,214,248,.46)!important;color:#fff!important;-webkit-box-shadow:inset 0 1px 0 rgba(255,255,255,.045)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.045)!important}',
      scope + '.selectbox-item .gpbay-graphite-row-icon{display:block!important;position:absolute!important;width:1.15em!important;height:1.15em!important;top:50%!important;left:.92em!important;margin-top:-.575em!important;fill:none!important;color:rgba(177,210,228,.76)!important;pointer-events:none!important}',
      scope + '.selectbox-item.gpbay-graphite-source{padding-left:5.55em!important}',
      scope + '.selectbox-item.gpbay-graphite-source.gpbay-graphite-source--without-tier{padding-left:3.85em!important}',
      scope + '.selectbox-item.gpbay-graphite-source.gpbay-graphite-source--without-tier.gpbay-graphite-source--no-quality{padding-left:2.8em!important}',
      scope + '.gpbay-graphite-quality{position:absolute!important;left:.72em!important;top:50%!important;width:3.4em!important;height:1.78em!important;margin-top:-.89em!important;box-sizing:border-box!important;border:1px solid rgba(178,204,219,.3)!important;border-radius:.52em!important;background:rgba(130,156,174,.10)!important;color:#e6f1f8!important;text-align:center!important;line-height:1.65em!important;font-size:.81em!important;font-weight:700!important;letter-spacing:-.02em!important;pointer-events:none!important}',
      scope + '.gpbay-graphite-quality--unknown{border-color:rgba(255,255,255,.15)!important;color:rgba(236,243,247,.58)!important}',
      scope + '.gpbay-graphite-tier-mark{display:inline-block!important;width:1.2em!important;height:1.2em!important;vertical-align:-.12em!important;margin-left:.5em!important;opacity:.88!important}',
      scope + '.gpbay-graphite-tier-mark svg{display:block!important;width:100%!important;height:100%!important;fill:none!important;stroke:currentColor!important;stroke-width:1.75!important}',
      scope + '.gpbay-graphite-tier-mark--free{color:rgba(196,213,224,.68)!important}',
      scope + '.gpbay-graphite-tier-mark--gold{color:#e7c875!important}',
      scope + '.gpbay-graphite-tier-mark--platinum{color:#c7def0!important}',
      scope + '.selectbox-item .gpbay-graphite-source-tier{position:absolute!important;left:3.85em!important;top:50%!important;margin:-.6em 0 0 0!important;width:1.2em!important;height:1.2em!important;pointer-events:none!important}',
      scope + '.selectbox__head.gpbay-graphite-head-with-tier{position:relative!important;padding-right:9.4em!important}',
      scope + '.gpbay-graphite-user-tier{position:absolute!important;right:1.02em!important;top:50%!important;display:-webkit-inline-flex!important;display:inline-flex!important;-webkit-align-items:center!important;align-items:center!important;-webkit-transform:translateY(-50%)!important;transform:translateY(-50%)!important;white-space:nowrap!important;font-size:.9em!important;font-weight:600!important;line-height:1.25!important;letter-spacing:.015em!important;text-transform:uppercase!important;pointer-events:none!important}',
      scope + '.gpbay-graphite-user-tier .gpbay-graphite-tier-mark{width:1.2em!important;height:1.2em!important;margin:0 .38em 0 0!important}',
      scope + '.selectbox-item.focus .gpbay-graphite-row-icon{color:#b9e1ff!important}',
      scope + '.selectbox-item.selected:not(.nomark):after,' + scope + '.selectbox-item.picked:after{content:"\\2713"!important;display:block!important;position:absolute!important;top:50%!important;right:.95em!important;width:1.15em!important;height:1.2em!important;margin-top:-.6em!important;border:0!important;-webkit-border-radius:0!important;border-radius:0!important;background:none!important;color:#82caff!important;font-family:Arial,sans-serif!important;font-size:1em!important;font-weight:700!important;line-height:1.2em!important;text-align:center!important;-webkit-transform:none!important;transform:none!important}',
      scope + '.selectbox-item.gpbay-graphite-has-submenu:not(.selected):not(.picked):after{content:"\\203a"!important;display:block!important;position:absolute!important;top:50%!important;right:.94em!important;height:1.2em!important;margin-top:-.6em!important;border:0!important;color:rgba(235,244,250,.75)!important;font-size:1.45em!important;line-height:.8em!important;-webkit-transform:none!important;transform:none!important}',
      scope + '.settings-param-title{margin:.48em .88em .2em!important;color:rgba(255,255,255,.56)!important}',
      scope + '.selectbox-item--checkbox .selectbox-item__checkbox{border-color:rgba(125,190,234,.48)!important}',
      scope + '.selectbox-item--checked .selectbox-item__checkbox{border-color:#6cb8ee!important}',
      '@media screen and (max-width:480px){' +
        scope + '.selectbox__content{border-left:0!important;border-right:0!important;border-bottom:0!important;border-top:1px solid rgba(255,255,255,.09)!important;-webkit-border-radius:0!important;border-radius:0!important;-webkit-box-shadow:none!important;box-shadow:none!important}' +
        scope + '.selectbox__head{padding:.88em .9em .82em!important}' +
        scope + '.selectbox__title{font-size:1.36em!important}' +
        scope + '.selectbox__body{padding:0 .62em .5em!important}' +
        scope + '.selectbox__body.layer--wheight{margin-top:.88em!important}' +
        scope + '.selectbox__body .scroll__content{padding:0 0 .38em!important}' +
        sourceScope + '.selectbox__body .scroll__body{padding-bottom:1.7em!important;box-sizing:content-box!important}' +
        scope + '.selectbox-item{padding:.66em 2.4em .66em 2.65em!important}' +
        scope + '.selectbox-item.gpbay-graphite-source{padding-left:5.55em!important}' +
        scope + '.selectbox-item .gpbay-graphite-row-icon{left:.82em!important}' +
      '}'
    ];

    var style = document.createElement('style');
    style.id = 'gpbay_graphite_select_css';
    style.type = 'text/css';
    style.appendChild(document.createTextNode(rules.join('\n')));
    (document.head || document.documentElement).appendChild(style);
  }

  function gpbayGraphitePopupKind(active) {
    var current = gpbay_graphite_filter;
    if (!current || !active || !active.items || typeof current.get != 'function') return '';

    try {
      if (active.items === current.get('sort')) return 'source';
      var items = current.get('filter');
      if (active.items === items) return 'filter';
      if (items) {
        for (var i = 0; i < items.length; i++) {
          if (items[i] && items[i].items && active.items === items[i].items) {
            if (items[i].stype == 'voice') return 'voice';
            if (items[i].stype == 'season') return 'season';
            return 'filter';
          }
        }
      }

      if (active.onBack && active.onBack === current.onBack) {
        for (var j = 0; j < active.items.length; j++) {
          var candidate = active.items[j];
          if (candidate && (candidate.global_search === true ||
              Object.prototype.hasOwnProperty.call(candidate, 'query'))) return 'search';
        }
      }
    } catch (e) {}
    return '';
  }

  function gpbayGraphiteRowIcon(type) {
    var path = '';
    if (type == 'source')
      path = '<ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v5c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-5M4.5 10.5v5c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-5"/>';
    else if (type == 'reset')
      path = '<path d="M3.8 10a8.3 8.3 0 0 1 14.4-4.7L21 8M21 3v5h-5M20.2 14a8.3 8.3 0 0 1-14.4 4.7L3 16M3 21v-5h5"/>';
    else if (type == 'voice')
      path = '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V22M8.5 22h7"/>';
    else if (type == 'season')
      path = '<path d="m12 2.5 9 5-9 5-9-5ZM3 12l9 5 9-5M3 16.5l9 5 9-5"/>';
    else if (type == 'search-edit')
      path = '<path d="M13 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m11 14 9-9-2-2-9 9-1 4 3-2Z"/>';
    else if (type == 'search-global')
      path = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18"/>';
    else if (type == 'search')
      path = '<circle cx="10.5" cy="10.5" r="6.2"/><path d="m15.2 15.2 5 5"/>';
    else
      path = '<circle cx="12" cy="12" r="7.5"/><path d="m9 12 2 2 4-4"/>';
    return '<svg class="gpbay-graphite-row-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  function gpbayGraphiteTierMark(group, forSource) {
    if (group != 'free' && group != 'gold' && group != 'platinum') return '';
    var path = group == 'platinum'
      ? '<path d="M7 4h10l5 6-10 11L2 10Z"/><path d="M2 10h20M7 4l5 17L17 4"/>'
      : group == 'gold'
        ? '<path d="m3 8 4.5 3 4.5-6 4.5 6L21 8l-2 11H5Z"/><path d="M6 16h12"/>'
        : '<path d="M12 2.6 20.15 7.3v9.4L12 21.4 3.85 16.7V7.3Z"/>';
    return '<span class="gpbay-graphite-tier-mark ' + (forSource ? 'gpbay-graphite-source-tier ' : '') + 'gpbay-graphite-tier-mark--' + group + '" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24">' + path + '</svg></span>';
  }

  function gpbayGraphiteQualityIcon(quality, approximate) {
    var code = quality == null ? '' : String(quality).toLowerCase();
    var label = code == '2160p' ? '4K' : code == '1080p' ? 'FHD' :
      code == '720p' ? 'HD' : code == '480p' ? 'SD' : code == '360p' ? '360' : '—';
    var classes = 'gpbay-graphite-quality';
    if (label == '—') classes += ' gpbay-graphite-quality--unknown';
    return '<span class="' + classes + '" aria-hidden="true">' + label + '</span>';
  }

  function gpbayGraphiteActiveCanvas() {
    var parent;
    try { parent = document.querySelector('.background'); } catch (e) { return null; }
    if (!parent || (' ' + (parent.className || '') + ' ').indexOf(' hide ') >= 0) return null;

    var mobile = false;
    try { mobile = window.innerWidth <= 480; } catch (e2) {}
    var selectors = mobile
      ? ['.background__two.visible', '.background__one.visible', '.background__fade', '.background__two', '.background__one']
      : ['.background__fade', '.background__two.visible', '.background__one.visible', '.background__two', '.background__one'];

    for (var i = 0; i < selectors.length; i++) {
      var canvas = null;
      try { canvas = parent.querySelector(selectors[i]); } catch (e3) {}
      if (!canvas || !canvas.width || !canvas.height || typeof canvas.getContext != 'function') continue;
      try {
        var ctx = canvas.getContext('2d');
        if (!ctx) continue;
        var pixel = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
        if (!pixel || pixel[3] < 20) continue;
      } catch (e4) {}
      return canvas;
    }
    return null;
  }

  function gpbayGraphitePaintBackground(html) {
    if (!html || !html.length) return;
    var content = html.find('.selectbox__content').first();
    if (!content.length) return;
    content.find('.gpbay-graphite-backdrop').remove();

    var source = gpbayGraphiteActiveCanvas();
    if (!source) return;
    try {
      var flat = document.createElement('canvas');
      flat.className = 'gpbay-graphite-backdrop';
      flat.width = 1;
      flat.height = 1;
      var ctx = flat.getContext && flat.getContext('2d');
      if (!ctx || typeof ctx.drawImage != 'function') return;
      var sx = Math.floor(source.width * .2);
      var sy = Math.floor(source.height * .2);
      var sw = Math.max(1, Math.floor(source.width * .6));
      var sh = Math.max(1, Math.floor(source.height * .6));
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, 1, 1);
      ctx.fillStyle = 'rgba(0,0,0,.33)';
      ctx.fillRect(0, 0, 1, 1);
      content.prepend(flat);
    } catch (e) {
      content.find('.gpbay-graphite-backdrop').remove();
    }
  }

  function gpbayGraphiteOnSelectShow(event) {
    var html = event && event.html;
    if (!html || !html.length) {
      try { html = Lampa.Select.render(); } catch (e) { return; }
    }
    if (!html || !html.length) return;

    var kind = gpbayGraphitePopupKind(event && event.active);
    gpbayGraphiteClearDecorations(html);
    if (!kind) return;

    gpbayGraphiteEnsureCss();
    html.addClass(GPBAY_GRAPHITE_SELECT_CLASS);
    if (kind == 'source') {
      html.addClass('gpbay-graphite-source-menu');
      html.find('.selectbox__title').text(Lampa.Lang.translate('lampac_sources_menu_title'));
    }
    gpbayGraphitePaintBackground(html);

    var head = html.find('.selectbox__head').first();
    head.removeClass('gpbay-graphite-head-with-tier').find('.gpbay-graphite-user-tier').remove();
    if (gpbay_user_tier == 'gold' || gpbay_user_tier == 'platinum') {
      var label = gpbay_user_tier == 'platinum' ? 'PLATINUM' : 'GOLD';
      head.addClass('gpbay-graphite-head-with-tier');
      head.append('<span class="gpbay-graphite-user-tier gpbay-graphite-user-tier--' + gpbay_user_tier + '">' +
        gpbayGraphiteTierMark(gpbay_user_tier) + label + '</span>');
    }

    var items = event.active.items;
    var shown = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i] && !items[i].hide && !items[i].separator) shown.push(items[i]);
    }

    html.find('.selectbox-item').each(function(index) {
      var item = shown[index];
      if (!item) return;
      var row = $(this);
      if (kind == 'source') {
        row.addClass('gpbay-graphite-source');
        row.attr('data-gpbay-group', item.group || 'unknown');
        row.attr('data-gpbay-quality', item.quality_id || 'unknown');
        if (item.quality_id) row.prepend(gpbayGraphiteQualityIcon(item.quality_id, item.quality_estimated));
        else {
          row.addClass('gpbay-graphite-source--no-quality');
          row.prepend(gpbayGraphiteRowIcon('source'));
        }
        var showTier = (gpbay_user_tier == 'gold' || gpbay_user_tier == 'platinum') &&
          (item.group == 'free' || item.group == 'gold' || item.group == 'platinum');
        if (showTier) row.prepend(gpbayGraphiteTierMark(item.group, true));
        else row.addClass('gpbay-graphite-source--without-tier');
        return;
      }
      var icon = kind;
      if (kind == 'filter') {
        if (item.stype == 'voice' || item.stype == 'season') row.addClass('gpbay-graphite-filter-choice');
        if (item.reset) icon = 'reset';
        else if (item.stype == 'voice') icon = 'voice';
        else if (item.stype == 'season') icon = 'season';
        else icon = 'filter';
      } else if (kind == 'search') {
        if (item.global_search) icon = 'search-global';
        else if (!item.query) icon = 'search-edit';
      }
      if (item.items) row.addClass('gpbay-graphite-has-submenu');
      if (!row.find('.gpbay-graphite-row-icon').length) row.prepend(gpbayGraphiteRowIcon(icon));
    });
  }

  function gpbayGraphiteClearDecorations(panel) {
    if (!panel || !panel.length) return;
    panel.find('.gpbay-graphite-row-icon,.gpbay-graphite-tier-mark,.gpbay-graphite-quality,' +
      '.gpbay-graphite-backdrop,.gpbay-graphite-dimmer,.gpbay-graphite-user-tier').remove();
    panel.find('.selectbox-item').removeClass('gpbay-graphite-source gpbay-graphite-source--without-tier ' +
      'gpbay-graphite-source--no-quality gpbay-graphite-filter-choice gpbay-graphite-has-submenu')
      .removeAttr('data-gpbay-group').removeAttr('data-gpbay-quality');
    panel.find('.selectbox__head.gpbay-graphite-head-with-tier').removeClass('gpbay-graphite-head-with-tier');
    panel.removeClass(GPBAY_GRAPHITE_SELECT_CLASS + ' gpbay-graphite-source-menu');
  }

  function gpbayGraphiteSelectReset() {
    if (gpbay_graphite_hide_timer !== null) {
      clearTimeout(gpbay_graphite_hide_timer);
      gpbay_graphite_hide_timer = null;
    }
    try {
      if (Lampa.Select && Lampa.Select.render())
        gpbayGraphiteClearDecorations(Lampa.Select.render());
    } catch (e) {}
  }

  function gpbayGraphiteSelectHide() {
    try {
      if (!Lampa.Select || !Lampa.Select.render()) return;
      var panel = Lampa.Select.render();
      if (!panel || !panel.length || !panel.hasClass(GPBAY_GRAPHITE_SELECT_CLASS)) return;

      if (gpbay_graphite_hide_timer !== null) clearTimeout(gpbay_graphite_hide_timer);
      var noAnimation = false;
      try {
        noAnimation = window.innerWidth <= 480 || $('body').hasClass('no--animation');
      } catch (ignore) {}
      if (noAnimation) {
        gpbay_graphite_hide_timer = null;
        gpbayGraphiteClearDecorations(panel);
        return;
      }

      gpbay_graphite_hide_timer = setTimeout(function() {
        gpbay_graphite_hide_timer = null;
        try {
          if (!$('body').hasClass('selectbox--open')) gpbayGraphiteClearDecorations(panel);
        } catch (ignore) {}
      }, GPBAY_GRAPHITE_CLOSE_MS + 40);
    } catch (e) {}
  }

  function gpbayGraphiteSelectToggle(event) {
    if (gpbay_graphite_hide_timer !== null) {
      clearTimeout(gpbay_graphite_hide_timer);
      gpbay_graphite_hide_timer = null;
      gpbayGraphiteOnSelectShow(event);
    }
  }

  function gpbayGraphiteActivate(filter) {
    gpbay_graphite_filter = filter;
    gpbayGraphiteEnsureCss();
    try {
      if (!Lampa.Select || !Lampa.Select.listener || typeof Lampa.Select.listener.follow != 'function') return;
      if (gpbay_graphite_listener) return;
      gpbay_graphite_listener = gpbayGraphiteOnSelectShow;
      Lampa.Select.listener.follow('preshow', gpbayGraphiteSelectReset);
      Lampa.Select.listener.follow('fullshow', gpbay_graphite_listener);
      Lampa.Select.listener.follow('hide', gpbayGraphiteSelectHide);
      Lampa.Select.listener.follow('toggle', gpbayGraphiteSelectToggle);
    } catch (e) {}
  }

  function component(object) {
    gpbay_source_request_generation++;
    gpbaySetUserTier('platinum');
    gpbay_gold_promo_component = this;
    var network = new Network();
    var scroll = new Lampa.Scroll({
      mask: true,
      over: true
    });
    var files = new Lampa.Explorer(object);
    var filter = new Lampa.Filter(object);
    var sources = {};
    var last;
    var source;
    var balanser;
    var initialized;
    var gpbay_foreign_enabled_at_load = gpbayForeignSourcesEnabled();
    var balanser_timer;
    var images = [];
    var number_of_requests = 0;
    var number_of_requests_timer;
    var life_wait_times = 0;
    var life_wait_timer;
    var filter_sources = {};
    var filter_translate = {
      season: Lampa.Lang.translate('torrent_serial_season'),
      voice: Lampa.Lang.translate('torrent_parser_voice'),
      source: Lampa.Lang.translate('settings_rest_source')
    };
    var filter_find = {
      season: [],
      voice: []
    };

    var anonymousCorsSources = [
      'kinotochka',
      'leproduction',
      'vkmovie',
      'kinoteatrkg',
      'animevost',
      'scts'
    ];

    var vpnNoticeSources = [
      'none'
    ];

    if (balansers_with_search == undefined) {
      network.timeout(10000);
      network.silent(account('https://gpbx.me/lite/withsearch'), function(json) {
        balansers_with_search = json;
      }, function() {
        balansers_with_search = [];
      });
    }

    function balanserName(j) {
      var bals = j.balanser;
      var name = j.name.split(' ')[0];
      return (bals || name).toLowerCase();
    }

    function arrayFindCompat(list, predicate) {
      if (!list || !predicate) return null;
      for (var i = 0; i < list.length; i++) {
        if (predicate(list[i], i)) return list[i];
      }
      return null;
    }

    function clarificationSearchAdd(value){
      var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
      var all = Lampa.Storage.get('clarification_search','{}');

      all[id] = value;

      Lampa.Storage.set('clarification_search',all);
    }

    function clarificationSearchDelete(){
      var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
      var all = Lampa.Storage.get('clarification_search','{}');

      delete all[id];

      Lampa.Storage.set('clarification_search',all);
    }

    function clarificationSearchGet(){
      var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
      var all = Lampa.Storage.get('clarification_search','{}');

      return all[id];
    }

    this.showTelegramReconnect = function(resp) {
      var _thisReconnect = this;
      var uid = getPairingUid();
      var platform = getPairingPlatform();
      var botLink = getPairingBotLink(resp, true);
      var botHandle = getPairingBotHandle(resp, true);
      var qrImage = getPairingQrImage(resp, true);
      var serverMessage = getPairingBlockedMessage(resp);

      stopPairingTimer();
      stopPairingRefreshTimer();
      gpbay_pairing_state.active = false;
      gpbay_pairing_state.locked = false;
      gpbay_pairing_state.reconnectActive = true;
      clearInterval(balanser_timer);

      if ($('.modal.pairing-modal').length)
        $('.modal.pairing-modal').remove();

      if (!document.getElementById('gpbay_telegram_reconnect_css')) {
        var style = document.createElement('style');
        style.id = 'gpbay_telegram_reconnect_css';
        style.type = 'text/css';
        style.textContent = '' +
          '.gpbay-telegram-reconnect{max-width:48em;padding:1.15em;border-radius:1.15em;background:rgba(10,15,23,.92);border:1px solid rgba(90,169,255,.23);box-sizing:border-box;color:#fff}' +
          '.gpbay-telegram-reconnect__head{font-size:1.65em;font-weight:800;line-height:1.12;margin-bottom:.42em}' +
          '.gpbay-telegram-reconnect__message{font-size:1em;line-height:1.45;color:rgba(255,255,255,.78)}' +
          '.gpbay-telegram-reconnect__body{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:1em;margin-top:1em}' +
          '.gpbay-telegram-reconnect__qr{width:8.2em;-webkit-flex:0 0 8.2em;flex:0 0 8.2em;text-align:center}' +
          '.gpbay-telegram-reconnect__qr img{display:block;width:7.4em;height:7.4em;margin:0 auto;padding:.28em;border-radius:.78em;background:#fff;box-sizing:border-box}' +
          '.gpbay-telegram-reconnect__handle{margin-top:.4em;font-weight:800;color:#8bd1ff;word-break:break-word}' +
          '.gpbay-telegram-reconnect__steps{font-size:.95em;line-height:1.48;color:rgba(255,255,255,.88)}' +
          '.gpbay-telegram-reconnect__actions{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;gap:.65em;margin-top:1em}' +
          '.gpbay-telegram-reconnect__button{display:inline-block;padding:.72em 1em;border-radius:.78em;background:rgba(70,159,255,.16);border:1px solid rgba(112,184,255,.28);font-weight:750}' +
          '.gpbay-telegram-reconnect__button+.gpbay-telegram-reconnect__button{margin-left:.65em}' +
          '.gpbay-telegram-reconnect__button.focus{background:#fff;color:#111}' +
          '@media screen and (max-width:560px){.gpbay-telegram-reconnect{padding:.88em}.gpbay-telegram-reconnect__head{font-size:1.35em}.gpbay-telegram-reconnect__body{display:block}.gpbay-telegram-reconnect__qr{width:100%;margin-bottom:.8em}.gpbay-telegram-reconnect__actions{display:block}.gpbay-telegram-reconnect__button{display:block;text-align:center;margin-top:.55em}.gpbay-telegram-reconnect__button+.gpbay-telegram-reconnect__button{margin-left:0}}';
        (document.head || document.documentElement).appendChild(style);
      }

      var qrHtml = qrImage
        ? '<div class="gpbay-telegram-reconnect__qr"><img src="' + escapePairingHtml(qrImage) + '" alt="QR"><div class="gpbay-telegram-reconnect__handle">' + escapePairingHtml(botHandle) + '</div></div>'
        : '<div class="gpbay-telegram-reconnect__qr"><div class="gpbay-telegram-reconnect__handle">' + escapePairingHtml(botHandle) + '</div></div>';
      var openButton = botLink
        ? '<div id="gpbayReconnectOpenBot" class="gpbay-telegram-reconnect__button selector">Открыть ' + escapePairingHtml(botHandle) + '</div>'
        : '';
      var card = $('<div class="gpbay-telegram-reconnect">' +
        '<div class="gpbay-telegram-reconnect__head">Доступ временно приостановлен</div>' +
        '<div class="gpbay-telegram-reconnect__message">' + escapePairingHtml(serverMessage) + '</div>' +
        '<div class="gpbay-telegram-reconnect__body">' +
          qrHtml +
          '<div class="gpbay-telegram-reconnect__steps">' +
            '<div>1. Откройте ' + escapePairingHtml(botHandle) + ' в Telegram.</div>' +
            '<div>2. Разблокируйте бота, если он заблокирован.</div>' +
            '<div>3. Нажмите «Запустить» или отправьте <b>/start</b>.</div>' +
            '<div style="margin-top:.55em;opacity:.72">Повторно привязывать устройство не нужно. Экран обновится автоматически после восстановления связи.</div>' +
          '</div>' +
        '</div>' +
        '<div class="gpbay-telegram-reconnect__actions">' + openButton +
          '<div id="gpbayReconnectCheck" class="gpbay-telegram-reconnect__button selector">Проверить доступ</div>' +
        '</div>' +
      '</div>');

      scroll.clear();
      scroll.append(card);
      this.loading(false);
      Lampa.Controller.enable('content');

      function scheduleCheck(delay) {
        stopPairingTimer();
        if (!gpbay_pairing_state.reconnectActive) return;
        gpbay_pairing_state.timer = setTimeout(checkAccess, delay || 6000);
      }

      function checkAccess() {
        if (!gpbay_pairing_state.reconnectActive) {
          stopPairingTimer();
          return;
        }

        requestPairingJson('GET', pairingUrl('access?uid=' + encodeURIComponent(uid) + '&platform=' + encodeURIComponent(platform) + '&_=' + Date.now()), null, function(status) {
          if (!gpbay_pairing_state.reconnectActive) return;
          if (status && status.authorized) {
            gpbay_pairing_state.reconnectActive = false;
            stopPairingTimer();
            Lampa.Noty.show('Доступ восстановлен');
            window.location.reload();
            return;
          }

          if (isTelegramReconnectResponse(status)) {
            scheduleCheck(6000);
            return;
          }

          gpbay_pairing_state.reconnectActive = false;
          stopPairingTimer();
          if (isPairingBlockedResponse(status))
            _thisReconnect.showAccessBlocked(status);
          else if (status && (status.requiresPairing === true || status.requires_pairing === true))
            _thisReconnect.startPairingFlow((status && status.message) || 'Подключите устройство.', false);
          else
            _thisReconnect.showAccessUnavailable((status && status.message) || 'Доступ пока не восстановлен.');
        }, function() {
          scheduleCheck(7000);
        });
      }

      $('#gpbayReconnectOpenBot').off('hover:enter click').on('hover:enter click', function(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (!botLink) return;
        try { window.open(botLink, '_blank'); }
        catch (openError) { try { window.location.href = botLink; } catch (openError2) {} }
      });

      $('#gpbayReconnectCheck').off('hover:enter click').on('hover:enter click', function(e) {
        if (e && e.preventDefault) e.preventDefault();
        checkAccess();
      });

      scheduleCheck(6000);
    };

    this.showAccessBlocked = function(resp) {
      if (isTelegramReconnectResponse(resp)) {
        this.showTelegramReconnect(resp);
        return;
      }

      stopPairingTimer();
      stopPairingRefreshTimer();
      gpbay_pairing_state.active = false;
      gpbay_pairing_state.locked = false;
      gpbay_pairing_state.reconnectActive = false;
      clearInterval(balanser_timer);

      if ($('.modal.pairing-modal').length)
        $('.modal.pairing-modal').remove();

      var html = Lampa.Template.get('lampac_does_not_answer', {});
      html.find('.online-empty__buttons').remove();
      html.find('.online-empty__title').text(getPairingUnavailableTitle(resp));
      html.find('.online-empty__time').text(getPairingBlockedMessage(resp));

      if (getPairingReasonCode(resp) == 'banned') {
        var recovery = $(
          '<div class="gpbay-block-recovery">' +
            '<div class="gpbay-block-recovery__text">' +
              'Если считаете блокировку ошибочной, Вы можете перевыпустить идентификатор этого устройства и пройти привязку заново.' +
            '</div>' +
            '<div class="online-empty__buttons gpbay-block-recovery__buttons">' +
              '<div class="online-empty__button selector gpbay-block-recovery__button">Перевыпустить UID</div>' +
            '</div>' +
          '</div>'
        );

        recovery.css({
          'margin-bottom': '1.8em'
        });
        recovery.find('.gpbay-block-recovery__text').css({
          'font-size': '1.05em',
          'font-weight': '300',
          'line-height': '1.45',
          'color': 'rgba(255,255,255,.78)',
          'max-width': '42em',
          'margin-bottom': '1em'
        });
        recovery.find('.gpbay-block-recovery__buttons').css({
          'margin-bottom': '.55em'
        });
        recovery.find('.gpbay-block-recovery__button').css({
          'margin-bottom': '0'
        });

        var reissueInProgress = false;
        recovery.find('.gpbay-block-recovery__button').on('hover:enter click', function(e) {
          if (e && e.preventDefault) e.preventDefault();
          if (reissueInProgress) return;
          reissueInProgress = true;

          stopPairingTimer();
          stopPairingRefreshTimer();
          gpbay_pairing_state.active = false;
          gpbay_pairing_state.locked = true;
          gpbay_pairing_state.reconnectActive = false;

          var oldUid = gpbayEnsureUid();
          var newUid = gpbayRotateUid();

          if (!newUid || newUid == oldUid) {
            reissueInProgress = false;
            gpbay_pairing_state.locked = false;
            Lampa.Noty.show('Не удалось перевыпустить ID устройства');
            return;
          }

          Lampa.Noty.show('ID устройства перевыпущен');

          setTimeout(function() {
            window.location.reload();
          }, 250);
        });

        html.find('.online-empty__time').after(recovery);
      }

      scroll.clear();
      scroll.append(html);
      this.loading(false);
      Lampa.Controller.enable('content');
    };

    this.showAccessUnavailable = function(message) {
      stopPairingTimer();
      stopPairingRefreshTimer();
      gpbay_pairing_state.active = false;
      gpbay_pairing_state.locked = false;
      gpbay_pairing_state.reconnectActive = false;
      clearInterval(balanser_timer);

      if ($('.modal.pairing-modal').length)
        $('.modal.pairing-modal').remove();

      var html = Lampa.Template.get('lampac_does_not_answer', {});
      html.find('.online-empty__buttons').remove();
      html.find('.online-empty__title').text('Не удалось проверить доступ');
      html.find('.online-empty__time').text(message || 'Сервер авторизации временно не отвечает. Повторите попытку позже. Повторная привязка устройства не требуется.');
      scroll.clear();
      scroll.append(html);
      this.loading(false);
      Lampa.Controller.enable('content');
    };

    this.showPairingModal = function(pairing, baseMessage) {
      var _thisAuth = this;
      gpbay_pairing_state.reconnectActive = false;
      var uid = getPairingUid();
      var botHandle = getPairingBotHandle(pairing);
      var badgeText = getPairingBadgeText(pairing);
      var qrImage = getPairingQrImage(pairing);
      var statusText = baseMessage || pairing.message || 'Откройте Telegram и подтвердите устройство.';
      var deviceName = pairing && pairing.deviceName ? pairing.deviceName : getPairingDeviceName();
      var ttlText = pairing.expiresIn ? ('Код активен около ' + Math.max(1, Math.round(pairing.expiresIn / 60)) + ' мин.') : 'Код обновляется автоматически.';
      var isMobile = window.innerWidth <= 560;
      var isTiny = window.innerWidth <= 400;
      var cardMaxWidth = isMobile ? '34em' : '42em';
      var cardPadding = isMobile ? '.9em .92em .88em' : '1.05em 1.08em 1em';
      var headerGap = isMobile ? '.55em' : '.75em';
      var titleSize = isMobile ? '1.38em' : '1.72em';
      var noteSize = isMobile ? '.92em' : '1em';
      var noteLine = isMobile ? '1.34' : '1.42';
      var codeLabelAlign = 'center';
      var codeAlign = 'center';
      var bottomAlign = 'center';
      var codeFont = isTiny ? '1.74em' : (isMobile ? '1.96em' : '2.28em');
      var codeLetter = isTiny ? '.08em' : '.12em';
      var qrWrapWidth = isMobile ? '7.1em' : '8.6em';
      var qrImgSize = isMobile ? '6em' : '7.5em';
      var qrColumn = qrImage
        ? ('<div style="flex-shrink:0;width:' + qrWrapWidth + ';text-align:center;align-self:' + (isMobile ? 'center' : 'flex-start') + '">' +
            '<div style="display:inline-block;background:#fff;border-radius:' + (isMobile ? '.88em' : '1em') + ';padding:' + (isMobile ? '.26em' : '.34em') + ';box-shadow:0 10px 28px rgba(0,0,0,.22)">' +
              '<img src="' + escapePairingHtml(qrImage) + '" alt="QR" style="width:' + qrImgSize + ';height:' + qrImgSize + ';display:block">' +
            '</div>' +
            '<div style="margin-top:' + (isMobile ? '.42em' : '.55em') + ';font-size:' + (isMobile ? '.74em' : '.8em') + ';font-weight:600;color:#eef2ff;word-break:break-word">' + escapePairingHtml(botHandle) + '</div>' +
            '<div style="margin-top:.18em;font-size:' + (isMobile ? '.67em' : '.72em') + ';line-height:1.28;opacity:.62">' + escapePairingHtml(ttlText) + '</div>' +
          '</div>')
        : '';

      var modalHtml = '<div style="max-width:' + cardMaxWidth + ';color:#fff">' +
        '<div style="background:linear-gradient(180deg,rgba(16,20,28,.985),rgba(9,12,18,.97));border:1px solid rgba(255,255,255,.06);border-radius:1.22em;padding:' + cardPadding + ';box-shadow:0 20px 54px rgba(0,0,0,.38)">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:' + headerGap + ';margin-bottom:' + (isMobile ? '.7em' : '.9em') + ';flex-wrap:wrap">' +
            '<div style="display:inline-block;padding:.24em .68em;border-radius:999px;background:rgba(104,126,255,.16);color:#d9e1ff;font-size:' + (isMobile ? '.74em' : '.78em') + ';font-weight:600">' + escapePairingHtml(badgeText) + '</div>' +
            '<div style="display:inline-block;padding:.3em .58em;border-radius:.75em;background:rgba(255,255,255,.055);font-size:' + (isMobile ? '.74em' : '.8em') + ';opacity:.92">Устройство: ' + escapePairingHtml(deviceName) + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:' + (isMobile ? '.78em' : '1.05em') + '">' +
            '<div style="min-width:0;flex:1;padding-right:' + (isMobile ? '0' : '.1em') + '">' +
              '<div style="font-size:' + titleSize + ';font-weight:800;line-height:1.08;letter-spacing:-.03em;margin-bottom:.28em;text-align:left">Подключите устройство</div>' +
              '<div id="gpbayPairingNote" style="max-width:' + (isMobile ? '100%' : '18em') + ';font-size:' + noteSize + ';line-height:' + noteLine + ';opacity:.84;text-align:left">' + escapePairingHtml(statusText) + '</div>' +
            '</div>' +
            qrColumn +
          '</div>' +
          '<div style="margin-top:' + (isMobile ? '.78em' : '.95em') + ';padding:' + (isMobile ? '.82em .86em' : '.95em 1.02em') + ';border-radius:1.02em;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)">' +
            '<div style="opacity:.56;font-size:' + (isMobile ? '.72em' : '.76em') + ';letter-spacing:.08em;text-transform:uppercase;margin-bottom:.42em;text-align:' + codeLabelAlign + '">Код подтверждения</div>' +
            '<div id="gpbayPairingCode" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:' + codeFont + ';font-weight:800;letter-spacing:' + codeLetter + ';line-height:1.02;color:#fff;text-align:' + codeAlign + '">' + escapePairingHtml(pairing.code || '---- ----') + '</div>' +
          '</div>' +
          '<div style="margin-top:' + (isMobile ? '.62em' : '.72em') + ';font-size:' + (isMobile ? '.84em' : '.9em') + ';line-height:1.45;opacity:.8;text-align:' + bottomAlign + '">' +
            'Откройте <span style="font-weight:700;color:#eef2ff">' + escapePairingHtml(botHandle) + '</span> и отправьте код. После подтверждения экран обновится автоматически.' +
          '</div>' +
          '<div style="margin-top:' + (isMobile ? '.62em' : '.72em') + ';display:flex;justify-content:center">' +
            '<div id="gpbayPairingRefresh" class="selector" style="display:inline-flex;align-items:center;justify-content:center;padding:' + (isMobile ? '.72em 1em' : '.78em 1.16em') + ';border-radius:.92em;background:rgba(104,126,255,.16);border:1px solid rgba(148,167,255,.22);font-size:' + (isMobile ? '.84em' : '.9em') + ';font-weight:700;color:#eef2ff;cursor:pointer">Получить новый код</div>' +
          '</div>' +
        '</div>' +
      '</div>';

      stopPairingTimer();
      gpbay_pairing_state.active = true;
      gpbay_pairing_state.pairingId = pairing && pairing.pairingId ? pairing.pairingId : '';
      if ($('.modal').length) $('.modal').remove();
      Lampa.Modal.open({
        title: '',
        align: 'center',
        zIndex: 300,
        html: $(modalHtml),
        onBack: function() {
          stopPairingTimer();
          stopPairingRefreshTimer();
          gpbay_pairing_state.active = false;
          $('.modal').removeClass('pairing-modal');
          Lampa.Activity.push({component: 'main'});
          window.location.reload();
        }
      });

      tunePairingModalLayout();
      setPairingRefreshCooldown(pairing && pairing.retryAfterSeconds ? pairing.retryAfterSeconds : 0);
      $('#gpbayPairingRefresh').off('hover:enter click').on('hover:enter click', function(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (gpbay_pairing_state.refreshCooldown > 0) return;
        stopPairingTimer();
        stopPairingRefreshTimer();
        _thisAuth.startPairingFlow('Получаем новый код...', true);
      });

      var poll = function() {
        if (!gpbay_pairing_state.active || !$('.modal').length) {
          stopPairingTimer();
          return;
        }
        requestPairingJson('GET', pairingUrl('check?pairingId=' + encodeURIComponent(pairing.pairingId || '') + '&uid=' + encodeURIComponent(uid) + '&_=' + Date.now()), null, function(resp) {
          var note = $('#gpbayPairingNote');
          if (isPairingBlockedResponse(resp)) {
            stopPairingTimer();
            stopPairingRefreshTimer();
            gpbay_pairing_state.active = false;
            if ($('.modal').length) $('.modal').remove();
            _thisAuth.showAccessBlocked(resp);
            return;
          }
          if (resp && resp.status == 'success' && resp.authorized) {
            stopPairingTimer();
            stopPairingRefreshTimer();
            gpbay_pairing_state.active = false;
            if ($('.modal').length) $('.modal').remove();
            Lampa.Noty.show(resp.message || 'Устройство привязано');
            window.location.reload();
            return;
          }
          if (resp && (resp.status == 'expired' || resp.status == 'not_found')) {
            stopPairingTimer();
            stopPairingRefreshTimer();
            _thisAuth.startPairingFlow(resp.status == 'expired' ? 'Код истёк. Получаем новый...' : 'Получаем новый код...', true);
            return;
          }
          if (resp && resp.status == 'success' && !resp.authorized) {
            if (note.length) note.text(resp.message || 'Привязка подтверждена. Ожидаем разрешение доступа...');
          } else if (resp && resp.message && note.length) {
            note.text(resp.message);
          }
          stopPairingTimer();
          gpbay_pairing_state.timer = setTimeout(poll, 6000);
        }, function() {
          stopPairingTimer();
          gpbay_pairing_state.timer = setTimeout(poll, 7000);
        });
      };

      gpbay_pairing_state.timer = setTimeout(poll, 6000);
    };

    this.schedulePairingStartRetry = function(message, forceNew) {
      var _thisAuth = this;
      var delay;

      stopPairingTimer();
      gpbay_pairing_state.startRetryCount++;
      delay = Math.min(15000, 2000 + (gpbay_pairing_state.startRetryCount * 1500));

      gpbay_pairing_state.timer = setTimeout(function() {
        _thisAuth.startPairingFlow(message || 'Получаем код авторизации...', forceNew === true);
      }, delay);
    };

    this.startPairingFlow = function(message, forceNew) {
      var _thisAuth = this;
      gpbay_pairing_state.reconnectActive = false;
      var pairingUid = getPairingUid();
      var platform = getPairingPlatform();

      if (gpbay_pairing_state.locked) return;
      gpbay_pairing_state.locked = true;

      var startQuery = [
        'uid=' + encodeURIComponent(pairingUid),
        'lampac_uid=' + encodeURIComponent(pairingUid),
        'deviceName=' + encodeURIComponent(getPairingDeviceName()),
        'platform=' + encodeURIComponent(platform),
        'appVersion=' + encodeURIComponent(getPairingAppVersion()),
        'profileId=' + encodeURIComponent(getPairingProfileId()),
        'rchType=' + encodeURIComponent(getPairingRchType()),
        'forceNew=' + (forceNew ? '1' : '0'),
        '_=' + Date.now()
      ].join('&');

      requestPairingJson('GET', pairingUrl('start-get?' + startQuery), null, function(resp) {
        gpbay_pairing_state.locked = false;

        if (isPairingBlockedResponse(resp) || isPairingNonPairingResponse(resp)) {
          _thisAuth.showAccessBlocked(resp);
          return;
        }

        if (resp && resp.uid) {
          var serverUid = gpbayUidClean(resp.uid);
          if (!serverUid || serverUid != pairingUid) {
            _thisAuth.schedulePairingStartRetry('Получаем код авторизации...', false);
            return;
          }
        }

        if (resp && resp.uidConflict) {
          if (!gpbay_pairing_state.uidRotated) {
            var rotated = gpbayRotateUid();
            if (rotated) {
              gpbay_pairing_state.uidRotated = true;
              gpbay_pairing_state.startRetryCount = 0;
              _thisAuth.startPairingFlow('Подключите это устройство.', false);
              return;
            }
          }

          _thisAuth.schedulePairingStartRetry('Получаем код авторизации...', false);
          return;
        }

        if (resp && resp.alreadyAuthorized) {
          requestPairingJson('GET', pairingUrl('access?uid=' + encodeURIComponent(pairingUid) + '&platform=' + encodeURIComponent(platform) + '&_=' + Date.now()), null, function(status) {
            if (isPairingBlockedResponse(status) || isPairingNonPairingResponse(status)) {
              _thisAuth.showAccessBlocked(status);
              return;
            }
            if (status && status.authorized) {
              window.location.reload();
              return;
            }

            if (status && status.uidConflict && !gpbay_pairing_state.uidRotated) {
              var rotated = gpbayRotateUid();
              if (rotated) {
                gpbay_pairing_state.uidRotated = true;
                gpbay_pairing_state.startRetryCount = 0;
                _thisAuth.startPairingFlow('Подключите это устройство.', false);
                return;
              }
            }

            _thisAuth.schedulePairingStartRetry((status && status.message) || 'Получаем код авторизации...', true);
          }, function(data) {
            if (isPairingBlockedResponse(data)) {
              _thisAuth.showAccessBlocked(data);
              return;
            }
            _thisAuth.schedulePairingStartRetry('Получаем код авторизации...', true);
          });
          return;
        }

        if (!resp || !resp.pairingId || !resp.code) {
          _thisAuth.schedulePairingStartRetry((resp && resp.message) || 'Получаем код авторизации...', forceNew === true);
          return;
        }

        gpbay_pairing_state.startRetryCount = 0;
        _thisAuth.showPairingModal(resp, message || resp.message);
      }, function(data) {
        gpbay_pairing_state.locked = false;
        if (isPairingBlockedResponse(data)) {
          _thisAuth.showAccessBlocked(data);
          return;
        }
        _thisAuth.schedulePairingStartRetry(message || 'Получаем код авторизации...', forceNew === true);
      });
    };

    this.ensureAuthorized = function() {
      var _thisAuth = this;
      return new Promise(function(resolve, reject) {
        var platform = getPairingPlatform();
        var uid = getPairingUid();

        requestPairingJson('GET', pairingUrl('access?uid=' + encodeURIComponent(uid) + '&platform=' + encodeURIComponent(platform) + '&_=' + Date.now()), null, function(resp) {
          if (isPairingBlockedResponse(resp) || isPairingNonPairingResponse(resp)) {
            _thisAuth.showAccessBlocked(resp);
            reject({ authorized: false, blocked: true, response: resp });
            return;
          }

          if (resp && resp.authorized) {
            resolve(resp);
            return;
          }

          if (resp && resp.uidConflict && !gpbay_pairing_state.uidRotated) {
            var rotated = gpbayRotateUid();
            if (rotated) gpbay_pairing_state.uidRotated = true;
          }

          if (resp && (resp.requiresPairing === false || resp.requires_pairing === false)) {
            _thisAuth.showAccessBlocked(resp);
            reject({ authorized: false, blocked: true, response: resp });
            return;
          }

          _thisAuth.startPairingFlow((resp && resp.message) || 'Подключите устройство.', false);
          reject({ authorized: false, pairing: true });
        }, function(data) {
          if (isPairingBlockedResponse(data) || isPairingNonPairingResponse(data)) {
            _thisAuth.showAccessBlocked(data);
            reject({ authorized: false, blocked: true, response: data });
            return;
          }
          _thisAuth.showAccessUnavailable('Сервер авторизации временно не отвечает. Повторная привязка устройства не требуется. Попробуйте открыть раздел позже.');
          reject({ authorized: false, network: true });
        });
      });
    };

    function gpbayFilterIcon(type) {
      var body = '';

      if (type == 'source') {
        body = '<ellipse cx="12" cy="5.5" rx="7.5" ry="3" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 5.5v5c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-5" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 10.5v5c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-5" stroke="currentColor" stroke-width="1.7"/>';
      } else if (type == 'filter') {
        body = '<path d="M4 5h16l-6.25 7.1v5.15l-3.5 1.75v-6.9L4 5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>';
      } else {
        body = '<circle cx="10.5" cy="10.5" r="5.8" stroke="currentColor" stroke-width="1.8"/><path d="m15 15 4.2 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';
      }

      return '<svg class="gpbay-filter-icon gpbay-filter-icon--' + type + '" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + body + '</svg>';
    }

    function gpbayUpdateSourceButtonTier() {
      var button = filter.render().find('.filter--sort').first();
      if (!button.length) return;
      button.find('.gpbay-filter-source-tier').remove();
      if (!gpbayGoldUserHasGroup()) return;

      var current = sources[balanser];
      var group = current && current.group;
      if (group != 'free' && group != 'gold' && group != 'platinum') return;
      var value = button.children('div:not(.hide)').first();
      if (!value.length) return;
      value.prepend(gpbayGraphiteTierMark(group));
      value.children('.gpbay-graphite-tier-mark').first().addClass('gpbay-filter-source-tier');
    }

    function gpbayDecorateFilter() {
      var root = filter.render();
      var sourceButton = root.find('.filter--sort').first();
      var filterButton = root.find('.filter--filter').first();
      var searchButton = root.find('.filter--search').first();

      if (!filterButton.length) {
        filterButton = root.find('.torrent-filter>.simple-button--filter').not('.filter--sort').not('.filter--search').first();
      }

      function addIcon(button, type) {
        if (!button || !button.length || button.find('.gpbay-filter-icon').length) return false;
        var label = button.children('span').first();
        if (label.length) label.prepend(gpbayFilterIcon(type));
        else button.prepend(gpbayFilterIcon(type));
        return true;
      }

      addIcon(sourceButton, 'source');
      gpbayUpdateSourceButtonTier();
      addIcon(filterButton, 'filter');
      addIcon(searchButton, 'search');

      if (searchButton.length && searchButton.find('.gpbay-filter-icon--search').length) {
        var nativeSearch = searchButton.find('svg').not('.gpbay-filter-icon').first();
        if (nativeSearch.length) nativeSearch.addClass('gpbay-filter-native-search-icon');
      }
    }

    this.initialize = function() {
      var _this = this;
      this.loading(true);
      filter.onSearch = function(value) {
        clarificationSearchAdd(value);

        Lampa.Activity.replace({
          search: value,
          clarification: true,
          similar: true
        });
      };
      filter.onBack = function() {
        _this.start();
      };
      filter.render().find('.selector').on('hover:enter', function() {
        clearInterval(balanser_timer);
      });
      filter.render().find('.filter--search').appendTo(filter.render().find('.torrent-filter'));
      filter.render().addClass('gpbay-online-filter');
      gpbayGraphiteActivate(filter);
      gpbayDecorateFilter();
      files.render().addClass('gpbay-online-ui');
      filter.onSelect = function(type, a, b) {
        if (type == 'filter') {
          if (a.reset) {
            clarificationSearchDelete();

            _this.replaceChoice({
              season: 0,
              voice: 0,
              voice_url: '',
              voice_name: ''
            });
            setTimeout(function() {
              Lampa.Select.close();
              Lampa.Activity.replace({
                clarification: 0,
                similar: 0
              });
            }, 10);
          } else {
            var url = filter_find[a.stype][b.index].url;
            var choice = _this.getChoice();
            if (a.stype == 'voice') {
              choice.voice_name = filter_find.voice[b.index].title;
              choice.voice_url = url;
            }
            choice[a.stype] = b.index;
            _this.saveChoice(choice);
            _this.reset();
            _this.request(url);
            setTimeout(Lampa.Select.close, 10);
          }
        } else if (type == 'sort') {
          Lampa.Select.close();
          object.lampac_custom_select = a.source;
          _this.changeBalanser(a.source);
        }
      };
      if (filter.addButtonBack) filter.addButtonBack();
      filter.render().find('.filter--sort span').text(Lampa.Lang.translate('lampac_balanser'));
      gpbayDecorateFilter();
      scroll.body().addClass('torrent-list');
      files.appendFiles(scroll.render());
      files.appendHead(filter.render());
      scroll.minus(files.render().find('.explorer__files-head'));
      scroll.body().append(Lampa.Template.get('lampac_content_loading'));
      Lampa.Controller.enable('content');
      this.loading(false);
      this.ensureAuthorized().then(function() {
        if(object.balanser){
          files.render().find('.filter--search').remove();
          sources = {};
          sources[object.balanser] = {name: object.balanser};
          balanser = object.balanser;
          filter_sources = [];

          return network["native"](account(object.url.replace('rjson=','nojson=')), _this.parse.bind(_this), function(er){
            files.render().find('.torrent-filter').remove();
            _this.empty();
          }, false, {
            dataType: 'text',
            headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
          });
        }
        return _this.externalids().then(function() {
          return _this.createSource();
        }).then(function(json) {
          if (!arrayFindCompat(balansers_with_search, function(b) {
              return balanser.slice(0, b.length) == b;
            })) {
            filter.render().find('.filter--search').addClass('hide');
          }
          _this.search();
        });
      })["catch"](function(e) {
        if (e && e.gpbayObsoleteSourceRequest) return;
        if (e && e.authorized === false) return;
        if (e && e.gpbayForeignNoSources) {
          _this.emptyForeignSources();
          return;
        }
        _this.noConnectToServer(e);
      });
    };

    this.rch = function(json, noreset) {
      var _this2 = this;
      rchRun(json, function() {
        if (!noreset) _this2.find();
        else noreset();
      });
    };

    this.externalids = function() {
      return new Promise(function(resolve, reject) {
        if (!object.movie.imdb_id || !object.movie.kinopoisk_id) {
          var query = [];
          query.push('id=' + encodeURIComponent(object.movie.id));
          query.push('serial=' + (object.movie.name ? 1 : 0));
          if (object.movie.imdb_id) query.push('imdb_id=' + (object.movie.imdb_id || ''));
          if (object.movie.kinopoisk_id) query.push('kinopoisk_id=' + (object.movie.kinopoisk_id || ''));
          var url = Defined.localhost + 'externalids?' + query.join('&');
          network.timeout(10000);
          network.silent(account(url), function(json) {
            for (var name in json) {
              object.movie[name] = json[name];
            }
            resolve();
          }, function() {
            resolve();
          }, false, {
            headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
          });
        } else resolve();
      });
    };

    this.updateBalanser = function(balanser_name) {
      var last_select_balanser = Lampa.Storage.cache('online_last_balanser', 3000, {});
      last_select_balanser[object.movie.id] = balanser_name;
      Lampa.Storage.set('online_last_balanser', last_select_balanser);
    };

    this.changeBalanser = function(balanser_name) {
      this.updateBalanser(balanser_name);
      Lampa.Storage.set('online_balanser', balanser_name);
      var to = this.getChoice(balanser_name);
      var from = this.getChoice();
      if (from.voice_name) to.voice_name = from.voice_name;
      this.saveChoice(to, balanser_name);
      Lampa.Activity.replace();
    };

    this.requestParams = function(url) {
      var query = [];
      var card_source = object.movie.source || 'tmdb';
      query.push('id=' + encodeURIComponent(object.movie.id));
      if (object.movie.imdb_id) query.push('imdb_id=' + (object.movie.imdb_id || ''));
      if (object.movie.kinopoisk_id) query.push('kinopoisk_id=' + (object.movie.kinopoisk_id || ''));
      if (object.movie.tmdb_id) query.push('tmdb_id=' + (object.movie.tmdb_id || ''));
      query.push('title=' + encodeURIComponent(object.clarification ? object.search : object.movie.title || object.movie.name));
      query.push('original_title=' + encodeURIComponent(object.movie.original_title || object.movie.original_name));
      query.push('serial=' + (object.movie.name ? 1 : 0));
      query.push('original_language=' + (object.movie.original_language || ''));
      query.push('year=' + ((object.movie.release_date || object.movie.first_air_date || '0000') + '').slice(0, 4));
      query.push('source=' + card_source);
      query.push('clarification=' + (object.clarification ? 1 : 0));
      query.push('similar=' + (object.similar ? true : false));
      query.push('rchtype=' + (((window.rch_nws && window.rch_nws[hostkey]) ? window.rch_nws[hostkey].type : (window.rch && window.rch[hostkey]) ? window.rch[hostkey].type : '') || ''));
      if (Lampa.Storage.get('account_email', '')) query.push('cub_id=' + Lampa.Utils.hash(Lampa.Storage.get('account_email', '')));
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + query.join('&');
    };

    this.getLastChoiceBalanser = function() {
      var last_select_balanser = Lampa.Storage.cache('online_last_balanser', 3000, {});
      if (last_select_balanser[object.movie.id]) {
        return last_select_balanser[object.movie.id];
      } else {
        return Lampa.Storage.get('online_balanser', filter_sources.length ? filter_sources[0] : '');
      }
    };

    function gpbaySourceMenuItems() {
      var result = [];
      for (var i = 0; i < filter_sources.length; i++) {
        var id = filter_sources[i];
        var info = sources[id];
        if (!info) continue;
        var visibleTitle = info.name;
        if (info.quality_id) {
          visibleTitle = String(visibleTitle).replace(/\s+(?:-|~)\s+(?:(?:2160|1080|720|480|360)p|4K(?:\s+HDR)?)$/i, '');
        }
        result.push({
          title: visibleTitle,
          source: id,
          selected: id == balanser,
          ghost: !info.show,
          group: info.group,
          quality_id: info.quality_id,
          quality_estimated: info.quality_estimated
        });
      }
      return result;
    }

    function gpbayReadSource(j) {
      var group = j.group;
      if (group != 'free' && group != 'gold' && group != 'platinum') group = null;
      var quality = j.quality_id;
      var fromLabel = false;
      if (!quality && j.name) {
        var matched = String(j.name).match(/(?:^|\s)(?:-|~)\s*(2160|1080|720|480|360)\s*p(?:\s|$)/i);
        if (matched) { quality = matched[1] + 'p'; fromLabel = true; }
        else if (/(?:^|\s)(?:-|~)\s*4K(?:\s+HDR)?(?:\s|$)/i.test(String(j.name))) {
          quality = '2160p'; fromLabel = true;
        }
      }
      if (quality != '2160p' && quality != '1080p' && quality != '720p' &&
          quality != '480p' && quality != '360p') quality = null;
      return {
        url: j.url,
        name: j.name,
        show: typeof j.show == 'undefined' ? true : j.show,
        group: group,
        quality_id: quality,
        quality_estimated: j.quality_estimated === true ||
          (fromLabel && /\s~\s/.test(String(j.name))),
        sort_index: typeof j.sort_index == 'number' ? j.sort_index : null
      };
    }

    this.startSource = function(json) {
      return new Promise(function(resolve, reject) {
        var originalCount = json ? json.length : 0;
        json = gpbayFilterForeignSources(json || []);
        sources = {};
        json.forEach(function(j) {
          var name = balanserName(j);
          sources[name] = gpbayReadSource(j);
        });
        filter_sources = Lampa.Arrays.getKeys(sources);
        if (filter_sources.length) {
          var last_select_balanser = Lampa.Storage.cache('online_last_balanser', 3000, {});
          if (last_select_balanser[object.movie.id]) {
            balanser = last_select_balanser[object.movie.id];
          } else {
            balanser = Lampa.Storage.get('online_balanser', filter_sources[0]);
          }
          if (!sources[balanser]) balanser = filter_sources[0];
          if (!sources[balanser].show && !object.lampac_custom_select) balanser = filter_sources[0];
          source = sources[balanser].url;
          Lampa.Storage.set('active_balanser', balanser);
          resolve(json);
        } else {
          reject(originalCount && !gpbayForeignSourcesEnabled() ? { gpbayForeignNoSources: true } : null);
        }
      });
    };

    this.lifeSource = function(isCurrent) {
      var _this3 = this;
      return new Promise(function(resolve, reject) {
        var url = _this3.requestParams(Defined.localhost + 'lifeevents?memkey=' + (_this3.memkey || ''));
        var red = false;
        var gou = function gou(json, any) {
          if (json.accsdb) return reject(json);
          var last_balanser = _this3.getLastChoiceBalanser();
          var online = gpbayFilterForeignSources(json.online || []);
          if (!red) {
            var _filter = online.filter(function(c) {
              return any ? c.show : c.show && c.name.toLowerCase() == last_balanser;
            });
            if (_filter.length) {
              red = true;
              resolve(online.filter(function(c) {
                return c.show;
              }));
            } else if (any) {
              reject(!online.length && (json.online || []).length && !gpbayForeignSourcesEnabled()
                ? { gpbayForeignNoSources: true } : null);
            }
          }
        };
        var fin = function fin(call) {
          if (isCurrent && !isCurrent()) return reject({ gpbayObsoleteSourceRequest: true });
          network.timeout(3000);
          network.silent(account(url), function(json) {
            if (isCurrent && !isCurrent()) return reject({ gpbayObsoleteSourceRequest: true });
            life_wait_times++;
            filter_sources = [];
            sources = {};
            gpbayFilterForeignSources(json.online || []).forEach(function(j) {
              var name = balanserName(j);
              sources[name] = gpbayReadSource(j);
            });
            filter_sources = Lampa.Arrays.getKeys(sources);
            filter.set('sort', gpbaySourceMenuItems());
            filter.chosen('sort', [sources[balanser] ? sources[balanser].name : balanser]);
            gpbayUpdateSourceButtonTier();
            gou(json);
            var lastb = _this3.getLastChoiceBalanser();
            if (life_wait_times > 15 || json.ready) {
              filter.render().find('.lampac-balanser-loader').remove();
              gou(json, true);
            } else if (!red && sources[lastb] && sources[lastb].show) {
              gou(json, true);
              life_wait_timer = setTimeout(fin, 1000);
            } else {
              life_wait_timer = setTimeout(fin, 1000);
            }
          }, function() {
            if (isCurrent && !isCurrent()) return reject({ gpbayObsoleteSourceRequest: true });
            life_wait_times++;
            if (life_wait_times > 15) {
              reject();
            } else {
              life_wait_timer = setTimeout(fin, 1000);
            }
          }, false, {
            headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
          });
        };
        fin();
      });
    };

    this.createSource = function() {
      var _this4 = this;
      var generation = ++gpbay_source_request_generation;
      gpbaySetUserTier('platinum');
      function isCurrent() {
        return generation === gpbay_source_request_generation && gpbay_gold_promo_component === _this4;
      }
      return new Promise(function(resolve, reject) {
        var url = _this4.requestParams(Defined.localhost + 'lite/events?life=true&gpbaymeta=true');
        network.timeout(15000);
        network.silent(account(url), function(json) {
          if (!isCurrent()) return reject({ gpbayObsoleteSourceRequest: true });
          if (json && json.accsdb) {
            return reject(json);
          }

          gpbaySetUserTier('platinum');

          if (json && json.life) {
            _this4.memkey = json.memkey;
            if (json.title) {
              if (object.movie.name) object.movie.name = json.title;
              if (object.movie.title) object.movie.title = json.title;
            }
            filter.render().find('.filter--sort').append('<span class="lampac-balanser-loader" style="width: 1.2em; height: 1.2em; margin-top: 0; background: url(./img/loader.svg) no-repeat 50% 50%; background-size: contain; margin-left: 0.5em"></span>');
            _this4.lifeSource(isCurrent).then(function(rows) {
              if (!isCurrent()) throw { gpbayObsoleteSourceRequest: true };
              return _this4.startSource(rows);
            }).then(resolve)["catch"](reject);
          } else {
            var online = json && json.online ? json.online : json;
            _this4.startSource(online || []).then(resolve)["catch"](reject);
          }
        }, function(error) {
          if (!isCurrent()) return reject({ gpbayObsoleteSourceRequest: true });
          reject(error);
        }, false, {
          headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
        });
      });
    };

    this.create = function() {
      return this.render();
    };
    this.search = function() {
      this.filter({
        source: filter_sources
      }, this.getChoice());
      this.find();
    };
    this.find = function() {
      this.request(this.requestParams(source));
    };
    this.request = function(url) {
      number_of_requests++;
      if (number_of_requests < 10) {
        network["native"](account(url), this.parse.bind(this), this.doesNotAnswer.bind(this), false, {
          dataType: 'text',
          headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
        });
        clearTimeout(number_of_requests_timer);
        number_of_requests_timer = setTimeout(function() {
          number_of_requests = 0;
        }, 4000);
      } else this.empty();
    };

    this.parseJsonDate = function(str, name) {
      try {
        var html = $('<div>' + str + '</div>');
        var elems = [];
        html.find(name).each(function() {
          var item = $(this);
          var data = JSON.parse(item.attr('data-json'));
          var season = item.attr('s');
          var episode = item.attr('e');
          var text = item.text();
          if (!object.movie.name) {
            if (text.match(/\d+p/i)) {
              if (!data.quality) {
                data.quality = {};
                data.quality[text] = data.url;
              }
              text = object.movie.title;
            }
            if (text == 'По умолчанию') {
              text = object.movie.title;
            }
          }
          if (episode) data.episode = parseInt(episode);
          if (season) data.season = parseInt(season);
          if (text) data.text = text;
          data.active = item.hasClass('active');
          elems.push(data);
        });
        return elems;
      } catch (e) {
        return [];
      }
    };

    this.getFileUrl = function(file, call, waiting_rch) {
      var _this = this;

      if(Lampa.Storage.field('player') !== 'inner' && file.stream && Lampa.Platform.is('apple')){
        var newfile = Lampa.Arrays.clone(file);
        newfile.method = 'play';
        newfile.url = file.stream;
        call(newfile, {});
      }
      else if (file.method == 'play') call(file, {});
      else {
        Lampa.Loading.start(function() {
          Lampa.Loading.stop();
          Lampa.Controller.toggle('content');
          network.clear();
        });
        network["native"](account(file.url), function(json) {
          if(json.rch){
            if(waiting_rch) {
              waiting_rch = false;
              Lampa.Loading.stop();
              call(false, {});
            }
            else {
              _this.rch(json,function(){
                Lampa.Loading.stop();
                _this.getFileUrl(file, call, true);
              });
            }
          }
          else{
            Lampa.Loading.stop();
            call(json, json);
          }
        }, function() {
          Lampa.Loading.stop();
          call(false, {});
        }, false, {
          headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
        });
      }
    };

    this.toPlayElement = function(file) {
      var play = {
        title: file.title,
        url: file.url,
        quality: file.qualitys,
        timeline: file.timeline,
        subtitles: file.subtitles,
        segments: file.segments,
        callback: file.mark,
        season: file.season,
        episode: file.episode,
        voice_name: file.voice_name,
        thumbnail: file.thumbnail
      };
      return play;
    };

    this.orUrlReserve = function(data) {
      if (data.url && typeof data.url == 'string' && data.url.indexOf(" or ") !== -1) {
        var urls = data.url.split(" or ");
        data.url = urls[0];
        data.url_reserve = urls[1];
      }
    };

    this.shouldForceHlsjs = function(data) {
      if (!data)
        return false;

      var forceHlsBalanser = ((balanser || '') + '').toLowerCase();
      if (['kinozpub', 'alyou', 'novahd'].indexOf(forceHlsBalanser) !== -1 && Lampa.Platform.is('tizen'))
        return true;

      var urls = [];

      if (data.url && typeof data.url == 'string')
        urls.push(data.url);

      if (data.url_reserve && typeof data.url_reserve == 'string')
        urls.push(data.url_reserve);

      if (data.quality &&