/*! tether 1.4.0 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require, exports, module);
  } else {
    root.Tether = factory();
  }
}(this, function(require, exports, module) {

'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var TetherBase = undefined;
if (typeof TetherBase === 'undefined') {
  TetherBase = { modules: [] };
}

var zeroElement = null;

// Same as native getBoundingClientRect, except it takes into account parent <frame> offsets
// if the element lies within a nested document (<frame> or <iframe>-like).
function getActualBoundingClientRect(node) {
  var boundingRect = node.getBoundingClientRect();

  // The original object returned by getBoundingClientRect is immutable, so we clone it
  // We can't use extend because the properties are not considered part of the object by hasOwnProperty in IE9
  var rect = {};
  for (var k in boundingRect) {
    rect[k] = boundingRect[k];
  }

  if (node.ownerDocument !== document) {
    var _frameElement = node.ownerDocument.defaultView.frameElement;
    if (_frameElement) {
      var frameRect = getActualBoundingClientRect(_frameElement);
      rect.top += frameRect.top;
      rect.bottom += frameRect.top;
      rect.left += frameRect.left;
      rect.right += frameRect.left;
    }
  }

  return rect;
}

function getScrollParents(el) {
  // In firefox if the el is inside an iframe with display: none; window.getComputedStyle() will return null;
  // https://bugzilla.mozilla.org/show_bug.cgi?id=548397
  var computedStyle = getComputedStyle(el) || {};
  var position = computedStyle.position;
  var parents = [];

  if (position === 'fixed') {
    return [el];
  }

  var parent = el;
  while ((parent = parent.parentNode) && parent && parent.nodeType === 1) {
    var style = undefined;
    try {
      style = getComputedStyle(parent);
    } catch (err) {}

    if (typeof style === 'undefined' || style === null) {
      parents.push(parent);
      return parents;
    }

    var _style = style;
    var overflow = _style.overflow;
    var overflowX = _style.overflowX;
    var overflowY = _style.overflowY;

    if (/(auto|scroll)/.test(overflow + overflowY + overflowX)) {
      if (position !== 'absolute' || ['relative', 'absolute', 'fixed'].indexOf(style.position) >= 0) {
        parents.push(parent);
      }
    }
  }

  parents.push(el.ownerDocument.body);

  // If the node is within a frame, account for the parent window scroll
  if (el.ownerDocument !== document) {
    parents.push(el.ownerDocument.defaultView);
  }

  return parents;
}

var uniqueId = (function () {
  var id = 0;
  return function () {
    return ++id;
  };
})();

var zeroPosCache = {};
var getOrigin = function getOrigin() {
  // getBoundingClientRect is unfortunately too accurate.  It introduces a pixel or two of
  // jitter as the user scrolls that messes with our ability to detect if two positions
  // are equivilant or not.  We place an element at the top left of the page that will
  // get the same jitter, so we can cancel the two out.
  var node = zeroElement;
  if (!node || !document.body.contains(node)) {
    node = document.createElement('div');
    node.setAttribute('data-tether-id', uniqueId());
    extend(node.style, {
      top: 0,
      left: 0,
      position: 'absolute'
    });

    document.body.appendChild(node);

    zeroElement = node;
  }

  var id = node.getAttribute('data-tether-id');
  if (typeof zeroPosCache[id] === 'undefined') {
    zeroPosCache[id] = getActualBoundingClientRect(node);

    // Clear the cache when this position call is done
    defer(function () {
      delete zeroPosCache[id];
    });
  }

  return zeroPosCache[id];
};

function removeUtilElements() {
  if (zeroElement) {
    document.body.removeChild(zeroElement);
  }
  zeroElement = null;
};

function getBounds(el) {
  var doc = undefined;
  if (el === document) {
    doc = document;
    el = document.documentElement;
  } else {
    doc = el.ownerDocument;
  }

  var docEl = doc.documentElement;

  var box = getActualBoundingClientRect(el);

  var origin = getOrigin();

  box.top -= origin.top;
  box.left -= origin.left;

  if (typeof box.width === 'undefined') {
    box.width = document.body.scrollWidth - box.left - box.right;
  }
  if (typeof box.height === 'undefined') {
    box.height = document.body.scrollHeight - box.top - box.bottom;
  }

  box.top = box.top - docEl.clientTop;
  box.left = box.left - docEl.clientLeft;
  box.right = doc.body.clientWidth - box.width - box.left;
  box.bottom = doc.body.clientHeight - box.height - box.top;

  return box;
}

function getOffsetParent(el) {
  return el.offsetParent || document.documentElement;
}

var _scrollBarSize = null;
function getScrollBarSize() {
  if (_scrollBarSize) {
    return _scrollBarSize;
  }
  var inner = document.createElement('div');
  inner.style.width = '100%';
  inner.style.height = '200px';

  var outer = document.createElement('div');
  extend(outer.style, {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    visibility: 'hidden',
    width: '200px',
    height: '150px',
    overflow: 'hidden'
  });

  outer.appendChild(inner);

  document.body.appendChild(outer);

  var widthContained = inner.offsetWidth;
  outer.style.overflow = 'scroll';
  var widthScroll = inner.offsetWidth;

  if (widthContained === widthScroll) {
    widthScroll = outer.clientWidth;
  }

  document.body.removeChild(outer);

  var width = widthContained - widthScroll;

  _scrollBarSize = { width: width, height: width };
  return _scrollBarSize;
}

function extend() {
  var out = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var args = [];

  Array.prototype.push.apply(args, arguments);

  args.slice(1).forEach(function (obj) {
    if (obj) {
      for (var key in obj) {
        if (({}).hasOwnProperty.call(obj, key)) {
          out[key] = obj[key];
        }
      }
    }
  });

  return out;
}

function removeClass(el, name) {
  if (typeof el.classList !== 'undefined') {
    name.split(' ').forEach(function (cls) {
      if (cls.trim()) {
        el.classList.remove(cls);
      }
    });
  } else {
    var regex = new RegExp('(^| )' + name.split(' ').join('|') + '( |$)', 'gi');
    var className = getClassName(el).replace(regex, ' ');
    setClassName(el, className);
  }
}

function addClass(el, name) {
  if (typeof el.classList !== 'undefined') {
    name.split(' ').forEach(function (cls) {
      if (cls.trim()) {
        el.classList.add(cls);
      }
    });
  } else {
    removeClass(el, name);
    var cls = getClassName(el) + (' ' + name);
    setClassName(el, cls);
  }
}

function hasClass(el, name) {
  if (typeof el.classList !== 'undefined') {
    return el.classList.contains(name);
  }
  var className = getClassName(el);
  return new RegExp('(^| )' + name + '( |$)', 'gi').test(className);
}

function getClassName(el) {
  // Can't use just SVGAnimatedString here since nodes within a Frame in IE have
  // completely separately SVGAnimatedString base classes
  if (el.className instanceof el.ownerDocument.defaultView.SVGAnimatedString) {
    return el.className.baseVal;
  }
  return el.className;
}

function setClassName(el, className) {
  el.setAttribute('class', className);
}

function updateClasses(el, add, all) {
  // Of the set of 'all' classes, we need the 'add' classes, and only the
  // 'add' classes to be set.
  all.forEach(function (cls) {
    if (add.indexOf(cls) === -1 && hasClass(el, cls)) {
      removeClass(el, cls);
    }
  });

  add.forEach(function (cls) {
    if (!hasClass(el, cls)) {
      addClass(el, cls);
    }
  });
}

var deferred = [];

var defer = function defer(fn) {
  deferred.push(fn);
};

var flush = function flush() {
  var fn = undefined;
  while (fn = deferred.pop()) {
    fn();
  }
};

var Evented = (function () {
  function Evented() {
    _classCallCheck(this, Evented);
  }

  _createClass(Evented, [{
    key: 'on',
    value: function on(event, handler, ctx) {
      var once = arguments.length <= 3 || arguments[3] === undefined ? false : arguments[3];

      if (typeof this.bindings === 'undefined') {
        this.bindings = {};
      }
      if (typeof this.bindings[event] === 'undefined') {
        this.bindings[event] = [];
      }
      this.bindings[event].push({ handler: handler, ctx: ctx, once: once });
    }
  }, {
    key: 'once',
    value: function once(event, handler, ctx) {
      this.on(event, handler, ctx, true);
    }
  }, {
    key: 'off',
    value: function off(event, handler) {
      if (typeof this.bindings === 'undefined' || typeof this.bindings[event] === 'undefined') {
        return;
      }

      if (typeof handler === 'undefined') {
        delete this.bindings[event];
      } else {
        var i = 0;
        while (i < this.bindings[event].length) {
          if (this.bindings[event][i].handler === handler) {
            this.bindings[event].splice(i, 1);
          } else {
            ++i;
          }
        }
      }
    }
  }, {
    key: 'trigger',
    value: function trigger(event) {
      if (typeof this.bindings !== 'undefined' && this.bindings[event]) {
        var i = 0;

        for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }

        while (i < this.bindings[event].length) {
          var _bindings$event$i = this.bindings[event][i];
          var handler = _bindings$event$i.handler;
          var ctx = _bindings$event$i.ctx;
          var once = _bindings$event$i.once;

          var context = ctx;
          if (typeof context === 'undefined') {
            context = this;
          }

          handler.apply(context, args);

          if (once) {
            this.bindings[event].splice(i, 1);
          } else {
            ++i;
          }
        }
      }
    }
  }]);

  return Evented;
})();

TetherBase.Utils = {
  getActualBoundingClientRect: getActualBoundingClientRect,
  getScrollParents: getScrollParents,
  getBounds: getBounds,
  getOffsetParent: getOffsetParent,
  extend: extend,
  addClass: addClass,
  removeClass: removeClass,
  hasClass: hasClass,
  updateClasses: updateClasses,
  defer: defer,
  flush: flush,
  uniqueId: uniqueId,
  Evented: Evented,
  getScrollBarSize: getScrollBarSize,
  removeUtilElements: removeUtilElements
};
/* globals TetherBase, performance */

'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x6, _x7, _x8) { var _again = true; _function: while (_again) { var object = _x6, property = _x7, receiver = _x8; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x6 = parent; _x7 = property; _x8 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

if (typeof TetherBase === 'undefined') {
  throw new Error('You must include the utils.js file before tether.js');
}

var _TetherBase$Utils = TetherBase.Utils;
var getScrollParents = _TetherBase$Utils.getScrollParents;
var getBounds = _TetherBase$Utils.getBounds;
var getOffsetParent = _TetherBase$Utils.getOffsetParent;
var extend = _TetherBase$Utils.extend;
var addClass = _TetherBase$Utils.addClass;
var removeClass = _TetherBase$Utils.removeClass;
var updateClasses = _TetherBase$Utils.updateClasses;
var defer = _TetherBase$Utils.defer;
var flush = _TetherBase$Utils.flush;
var getScrollBarSize = _TetherBase$Utils.getScrollBarSize;
var removeUtilElements = _TetherBase$Utils.removeUtilElements;

function within(a, b) {
  var diff = arguments.length <= 2 || arguments[2] === undefined ? 1 : arguments[2];

  return a + diff >= b && b >= a - diff;
}

var transformKey = (function () {
  if (typeof document === 'undefined') {
    return '';
  }
  var el = document.createElement('div');

  var transforms = ['transform', 'WebkitTransform', 'OTransform', 'MozTransform', 'msTransform'];
  for (var i = 0; i < transforms.length; ++i) {
    var key = transforms[i];
    if (el.style[key] !== undefined) {
      return key;
    }
  }
})();

var tethers = [];

var position = function position() {
  tethers.forEach(function (tether) {
    tether.position(false);
  });
  flush();
};

function now() {
  if (typeof performance !== 'undefined' && typeof performance.now !== 'undefined') {
    return performance.now();
  }
  return +new Date();
}

(function () {
  var lastCall = null;
  var lastDuration = null;
  var pendingTimeout = null;

  var tick = function tick() {
    if (typeof lastDuration !== 'undefined' && lastDuration > 16) {
      // We voluntarily throttle ourselves if we can't manage 60fps
      lastDuration = Math.min(lastDuration - 16, 250);

      // Just in case this is the last event, remember to position just once more
      pendingTimeout = setTimeout(tick, 250);
      return;
    }

    if (typeof lastCall !== 'undefined' && now() - lastCall < 10) {
      // Some browsers call events a little too frequently, refuse to run more than is reasonable
      return;
    }

    if (pendingTimeout != null) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }

    lastCall = now();
    position();
    lastDuration = now() - lastCall;
  };

  if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
    ['resize', 'scroll', 'touchmove'].forEach(function (event) {
      window.addEventListener(event, tick);
    });
  }
})();

var MIRROR_LR = {
  center: 'center',
  left: 'right',
  right: 'left'
};

var MIRROR_TB = {
  middle: 'middle',
  top: 'bottom',
  bottom: 'top'
};

var OFFSET_MAP = {
  top: 0,
  left: 0,
  middle: '50%',
  center: '50%',
  bottom: '100%',
  right: '100%'
};

var autoToFixedAttachment = function autoToFixedAttachment(attachment, relativeToAttachment) {
  var left = attachment.left;
  var top = attachment.top;

  if (left === 'auto') {
    left = MIRROR_LR[relativeToAttachment.left];
  }

  if (top === 'auto') {
    top = MIRROR_TB[relativeToAttachment.top];
  }

  return { left: left, top: top };
};

var attachmentToOffset = function attachmentToOffset(attachment) {
  var left = attachment.left;
  var top = attachment.top;

  if (typeof OFFSET_MAP[attachment.left] !== 'undefined') {
    left = OFFSET_MAP[attachment.left];
  }

  if (typeof OFFSET_MAP[attachment.top] !== 'undefined') {
    top = OFFSET_MAP[attachment.top];
  }

  return { left: left, top: top };
};

function addOffset() {
  var out = { top: 0, left: 0 };

  for (var _len = arguments.length, offsets = Array(_len), _key = 0; _key < _len; _key++) {
    offsets[_key] = arguments[_key];
  }

  offsets.forEach(function (_ref) {
    var top = _ref.top;
    var left = _ref.left;

    if (typeof top === 'string') {
      top = parseFloat(top, 10);
    }
    if (typeof left === 'string') {
      left = parseFloat(left, 10);
    }

    out.top += top;
    out.left += left;
  });

  return out;
}

function offsetToPx(offset, size) {
  if (typeof offset.left === 'string' && offset.left.indexOf('%') !== -1) {
    offset.left = parseFloat(offset.left, 10) / 100 * size.width;
  }
  if (typeof offset.top === 'string' && offset.top.indexOf('%') !== -1) {
    offset.top = parseFloat(offset.top, 10) / 100 * size.height;
  }

  return offset;
}

var parseOffset = function parseOffset(value) {
  var _value$split = value.split(' ');

  var _value$split2 = _slicedToArray(_value$split, 2);

  var top = _value$split2[0];
  var left = _value$split2[1];

  return { top: top, left: left };
};
var parseAttachment = parseOffset;

var TetherClass = (function (_Evented) {
  _inherits(TetherClass, _Evented);

  function TetherClass(options) {
    var _this = this;

    _classCallCheck(this, TetherClass);

    _get(Object.getPrototypeOf(TetherClass.prototype), 'constructor', this).call(this);
    this.position = this.position.bind(this);

    tethers.push(this);

    this.history = [];

    this.setOptions(options, false);

    TetherBase.modules.forEach(function (module) {
      if (typeof module.initialize !== 'undefined') {
        module.initialize.call(_this);
      }
    });

    this.position();
  }

  _createClass(TetherClass, [{
    key: 'getClass',
    value: function getClass() {
      var key = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
      var classes = this.options.classes;

      if (typeof classes !== 'undefined' && classes[key]) {
        return this.options.classes[key];
      } else if (this.options.classPrefix) {
        return this.options.classPrefix + '-' + key;
      } else {
        return key;
      }
    }
  }, {
    key: 'setOptions',
    value: function setOptions(options) {
      var _this2 = this;

      var pos = arguments.length <= 1 || arguments[1] === undefined ? true : arguments[1];

      var defaults = {
        offset: '0 0',
        targetOffset: '0 0',
        targetAttachment: 'auto auto',
        classPrefix: 'tether'
      };

      this.options = extend(defaults, options);

      var _options = this.options;
      var element = _options.element;
      var target = _options.target;
      var targetModifier = _options.targetModifier;

      this.element = element;
      this.target = target;
      this.targetModifier = targetModifier;

      if (this.target === 'viewport') {
        this.target = document.body;
        this.targetModifier = 'visible';
      } else if (this.target === 'scroll-handle') {
        this.target = document.body;
        this.targetModifier = 'scroll-handle';
      }

      ['element', 'target'].forEach(function (key) {
        if (typeof _this2[key] === 'undefined') {
          throw new Error('Tether Error: Both element and target must be defined');
        }

        if (typeof _this2[key].jquery !== 'undefined') {
          _this2[key] = _this2[key][0];
        } else if (typeof _this2[key] === 'string') {
          _this2[key] = document.querySelector(_this2[key]);
        }
      });

      addClass(this.element, this.getClass('element'));
      if (!(this.options.addTargetClasses === false)) {
        addClass(this.target, this.getClass('target'));
      }

      if (!this.options.attachment) {
        throw new Error('Tether Error: You must provide an attachment');
      }

      this.targetAttachment = parseAttachment(this.options.targetAttachment);
      this.attachment = parseAttachment(this.options.attachment);
      this.offset = parseOffset(this.options.offset);
      this.targetOffset = parseOffset(this.options.targetOffset);

      if (typeof this.scrollParents !== 'undefined') {
        this.disable();
      }

      if (this.targetModifier === 'scroll-handle') {
        this.scrollParents = [this.target];
      } else {
        this.scrollParents = getScrollParents(this.target);
      }

      if (!(this.options.enabled === false)) {
        this.enable(pos);
      }
    }
  }, {
    key: 'getTargetBounds',
    value: function getTargetBounds() {
      if (typeof this.targetModifier !== 'undefined') {
        if (this.targetModifier === 'visible') {
          if (this.target === document.body) {
            return { top: pageYOffset, left: pageXOffset, height: innerHeight, width: innerWidth };
          } else {
            var bounds = getBounds(this.target);

            var out = {
              height: bounds.height,
              width: bounds.width,
              top: bounds.top,
              left: bounds.left
            };

            out.height = Math.min(out.height, bounds.height - (pageYOffset - bounds.top));
            out.height = Math.min(out.height, bounds.height - (bounds.top + bounds.height - (pageYOffset + innerHeight)));
            out.height = Math.min(innerHeight, out.height);
            out.height -= 2;

            out.width = Math.min(out.width, bounds.width - (pageXOffset - bounds.left));
            out.width = Math.min(out.width, bounds.width - (bounds.left + bounds.width - (pageXOffset + innerWidth)));
            out.width = Math.min(innerWidth, out.width);
            out.width -= 2;

            if (out.top < pageYOffset) {
              out.top = pageYOffset;
            }
            if (out.left < pageXOffset) {
              out.left = pageXOffset;
            }

            return out;
          }
        } else if (this.targetModifier === 'scroll-handle') {
          var bounds = undefined;
          var target = this.target;
          if (target === document.body) {
            target = document.documentElement;

            bounds = {
              left: pageXOffset,
              top: pageYOffset,
              height: innerHeight,
              width: innerWidth
            };
          } else {
            bounds = getBounds(target);
          }

          var style = getComputedStyle(target);

          var hasBottomScroll = target.scrollWidth > target.clientWidth || [style.overflow, style.overflowX].indexOf('scroll') >= 0 || this.target !== document.body;

          var scrollBottom = 0;
          if (hasBottomScroll) {
            scrollBottom = 15;
          }

          var height = bounds.height - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth) - scrollBottom;

          var out = {
            width: 15,
            height: height * 0.975 * (height / target.scrollHeight),
            left: bounds.left + bounds.width - parseFloat(style.borderLeftWidth) - 15
          };

          var fitAdj = 0;
          if (height < 408 && this.target === document.body) {
            fitAdj = -0.00011 * Math.pow(height, 2) - 0.00727 * height + 22.58;
          }

          if (this.target !== document.body) {
            out.height = Math.max(out.height, 24);
          }

          var scrollPercentage = this.target.scrollTop / (target.scrollHeight - height);
          out.top = scrollPercentage * (height - out.height - fitAdj) + bounds.top + parseFloat(style.borderTopWidth);

          if (this.target === document.body) {
            out.height = Math.max(out.height, 24);
          }

          return out;
        }
      } else {
        return getBounds(this.target);
      }
    }
  }, {
    key: 'clearCache',
    value: function clearCache() {
      this._cache = {};
    }
  }, {
    key: 'cache',
    value: function cache(k, getter) {
      // More than one module will often need the same DOM info, so
      // we keep a cache which is cleared on each position call
      if (typeof this._cache === 'undefined') {
        this._cache = {};
      }

      if (typeof this._cache[k] === 'undefined') {
        this._cache[k] = getter.call(this);
      }

      return this._cache[k];
    }
  }, {
    key: 'enable',
    value: function enable() {
      var _this3 = this;

      var pos = arguments.length <= 0 || arguments[0] === undefined ? true : arguments[0];

      if (!(this.options.addTargetClasses === false)) {
        addClass(this.target, this.getClass('enabled'));
      }
      addClass(this.element, this.getClass('enabled'));
      this.enabled = true;

      this.scrollParents.forEach(function (parent) {
        if (parent !== _this3.target.ownerDocument) {
          parent.addEventListener('scroll', _this3.position);
        }
      });

      if (pos) {
        this.position();
      }
    }
  }, {
    key: 'disable',
    value: function disable() {
      var _this4 = this;

      removeClass(this.target, this.getClass('enabled'));
      removeClass(this.element, this.getClass('enabled'));
      this.enabled = false;

      if (typeof this.scrollParents !== 'undefined') {
        this.scrollParents.forEach(function (parent) {
          parent.removeEventListener('scroll', _this4.position);
        });
      }
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      var _this5 = this;

      this.disable();

      tethers.forEach(function (tether, i) {
        if (tether === _this5) {
          tethers.splice(i, 1);
        }
      });

      // Remove any elements we were using for convenience from the DOM
      if (tethers.length === 0) {
        removeUtilElements();
      }
    }
  }, {
    key: 'updateAttachClasses',
    value: function updateAttachClasses(elementAttach, targetAttach) {
      var _this6 = this;

      elementAttach = elementAttach || this.attachment;
      targetAttach = targetAttach || this.targetAttachment;
      var sides = ['left', 'top', 'bottom', 'right', 'middle', 'center'];

      if (typeof this._addAttachClasses !== 'undefined' && this._addAttachClasses.length) {
        // updateAttachClasses can be called more than once in a position call, so
        // we need to clean up after ourselves such that when the last defer gets
        // ran it doesn't add any extra classes from previous calls.
        this._addAttachClasses.splice(0, this._addAttachClasses.length);
      }

      if (typeof this._addAttachClasses === 'undefined') {
        this._addAttachClasses = [];
      }
      var add = this._addAttachClasses;

      if (elementAttach.top) {
        add.push(this.getClass('element-attached') + '-' + elementAttach.top);
      }
      if (elementAttach.left) {
        add.push(this.getClass('element-attached') + '-' + elementAttach.left);
      }
      if (targetAttach.top) {
        add.push(this.getClass('target-attached') + '-' + targetAttach.top);
      }
      if (targetAttach.left) {
        add.push(this.getClass('target-attached') + '-' + targetAttach.left);
      }

      var all = [];
      sides.forEach(function (side) {
        all.push(_this6.getClass('element-attached') + '-' + side);
        all.push(_this6.getClass('target-attached') + '-' + side);
      });

      defer(function () {
        if (!(typeof _this6._addAttachClasses !== 'undefined')) {
          return;
        }

        updateClasses(_this6.element, _this6._addAttachClasses, all);
        if (!(_this6.options.addTargetClasses === false)) {
          updateClasses(_this6.target, _this6._addAttachClasses, all);
        }

        delete _this6._addAttachClasses;
      });
    }
  }, {
    key: 'position',
    value: function position() {
      var _this7 = this;

      var flushChanges = arguments.length <= 0 || arguments[0] === undefined ? true : arguments[0];

      // flushChanges commits the changes immediately, leave true unless you are positioning multiple
      // tethers (in which case call Tether.Utils.flush yourself when you're done)

      if (!this.enabled) {
        return;
      }

      this.clearCache();

      // Turn 'auto' attachments into the appropriate corner or edge
      var targetAttachment = autoToFixedAttachment(this.targetAttachment, this.attachment);

      this.updateAttachClasses(this.attachment, targetAttachment);

      var elementPos = this.cache('element-bounds', function () {
        return getBounds(_this7.element);
      });

      var width = elementPos.width;
      var height = elementPos.height;

      if (width === 0 && height === 0 && typeof this.lastSize !== 'undefined') {
        var _lastSize = this.lastSize;

        // We cache the height and width to make it possible to position elements that are
        // getting hidden.
        width = _lastSize.width;
        height = _lastSize.height;
      } else {
        this.lastSize = { width: width, height: height };
      }

      var targetPos = this.cache('target-bounds', function () {
        return _this7.getTargetBounds();
      });
      var targetSize = targetPos;

      // Get an actual px offset from the attachment
      var offset = offsetToPx(attachmentToOffset(this.attachment), { width: width, height: height });
      var targetOffset = offsetToPx(attachmentToOffset(targetAttachment), targetSize);

      var manualOffset = offsetToPx(this.offset, { width: width, height: height });
      var manualTargetOffset = offsetToPx(this.targetOffset, targetSize);

      // Add the manually provided offset
      offset = addOffset(offset, manualOffset);
      targetOffset = addOffset(targetOffset, manualTargetOffset);

      // It's now our goal to make (element position + offset) == (target position + target offset)
      var left = targetPos.left + targetOffset.left - offset.left;
      var top = targetPos.top + targetOffset.top - offset.top;

      for (var i = 0; i < TetherBase.modules.length; ++i) {
        var _module2 = TetherBase.modules[i];
        var ret = _module2.position.call(this, {
          left: left,
          top: top,
          targetAttachment: targetAttachment,
          targetPos: targetPos,
          elementPos: elementPos,
          offset: offset,
          targetOffset: targetOffset,
          manualOffset: manualOffset,
          manualTargetOffset: manualTargetOffset,
          scrollbarSize: scrollbarSize,
          attachment: this.attachment
        });

        if (ret === false) {
          return false;
        } else if (typeof ret === 'undefined' || typeof ret !== 'object') {
          continue;
        } else {
          top = ret.top;
          left = ret.left;
        }
      }

      // We describe the position three different ways to give the optimizer
      // a chance to decide the best possible way to position the element
      // with the fewest repaints.
      var next = {
        // It's position relative to the page (absolute positioning when
        // the element is a child of the body)
        page: {
          top: top,
          left: left
        },

        // It's position relative to the viewport (fixed positioning)
        viewport: {
          top: top - pageYOffset,
          bottom: pageYOffset - top - height + innerHeight,
          left: left - pageXOffset,
          right: pageXOffset - left - width + innerWidth
        }
      };

      var doc = this.target.ownerDocument;
      var win = doc.defaultView;

      var scrollbarSize = undefined;
      if (win.innerHeight > doc.documentElement.clientHeight) {
        scrollbarSize = this.cache('scrollbar-size', getScrollBarSize);
        next.viewport.bottom -= scrollbarSize.height;
      }

      if (win.innerWidth > doc.documentElement.clientWidth) {
        scrollbarSize = this.cache('scrollbar-size', getScrollBarSize);
        next.viewport.right -= scrollbarSize.width;
      }

      if (['', 'static'].indexOf(doc.body.style.position) === -1 || ['', 'static'].indexOf(doc.body.parentElement.style.position) === -1) {
        // Absolute positioning in the body will be relative to the page, not the 'initial containing block'
        next.page.bottom = doc.body.scrollHeight - top - height;
        next.page.right = doc.body.scrollWidth - left - width;
      }

      if (typeof this.options.optimizations !== 'undefined' && this.options.optimizations.moveElement !== false && !(typeof this.targetModifier !== 'undefined')) {
        (function () {
          var offsetParent = _this7.cache('target-offsetparent', function () {
            return getOffsetParent(_this7.target);
          });
          var offsetPosition = _this7.cache('target-offsetparent-bounds', function () {
            return getBounds(offsetParent);
          });
          var offsetParentStyle = getComputedStyle(offsetParent);
          var offsetParentSize = offsetPosition;

          var offsetBorder = {};
          ['Top', 'Left', 'Bottom', 'Right'].forEach(function (side) {
            offsetBorder[side.toLowerCase()] = parseFloat(offsetParentStyle['border' + side + 'Width']);
          });

          offsetPosition.right = doc.body.scrollWidth - offsetPosition.left - offsetParentSize.width + offsetBorder.right;
          offsetPosition.bottom = doc.body.scrollHeight - offsetPosition.top - offsetParentSize.height + offsetBorder.bottom;

          if (next.page.top >= offsetPosition.top + offsetBorder.top && next.page.bottom >= offsetPosition.bottom) {
            if (next.page.left >= offsetPosition.left + offsetBorder.left && next.page.right >= offsetPosition.right) {
              // We're within the visible part of the target's scroll parent
              var scrollTop = offsetParent.scrollTop;
              var scrollLeft = offsetParent.scrollLeft;

              // It's position relative to the target's offset parent (absolute positioning when
              // the element is moved to be a child of the target's offset parent).
              next.offset = {
                top: next.page.top - offsetPosition.top + scrollTop - offsetBorder.top,
                left: next.page.left - offsetPosition.left + scrollLeft - offsetBorder.left
              };
            }
          }
        })();
      }

      // We could also travel up the DOM and try each containing context, rather than only
      // looking at the body, but we're gonna get diminishing returns.

      this.move(next);

      this.history.unshift(next);

      if (this.history.length > 3) {
        this.history.pop();
      }

      if (flushChanges) {
        flush();
      }

      return true;
    }

    // THE ISSUE
  }, {
    key: 'move',
    value: function move(pos) {
      var _this8 = this;

      if (!(typeof this.element.parentNode !== 'undefined')) {
        return;
      }

      var same = {};

      for (var type in pos) {
        same[type] = {};

        for (var key in pos[type]) {
          var found = false;

          for (var i = 0; i < this.history.length; ++i) {
            var point = this.history[i];
            if (typeof point[type] !== 'undefined' && !within(point[type][key], pos[type][key])) {
              found = true;
              break;
            }
          }

          if (!found) {
            same[type][key] = true;
          }
        }
      }

      var css = { top: '', left: '', right: '', bottom: '' };

      var transcribe = function transcribe(_same, _pos) {
        var hasOptimizations = typeof _this8.options.optimizations !== 'undefined';
        var gpu = hasOptimizations ? _this8.options.optimizations.gpu : null;
        if (gpu !== false) {
          var yPos = undefined,
              xPos = undefined;
          if (_same.top) {
            css.top = 0;
            yPos = _pos.top;
          } else {
            css.bottom = 0;
            yPos = -_pos.bottom;
          }

          if (_same.left) {
            css.left = 0;
            xPos = _pos.left;
          } else {
            css.right = 0;
            xPos = -_pos.right;
          }

          if (window.matchMedia) {
            // HubSpot/tether#207
            var retina = window.matchMedia('only screen and (min-resolution: 1.3dppx)').matches || window.matchMedia('only screen and (-webkit-min-device-pixel-ratio: 1.3)').matches;
            if (!retina) {
              xPos = Math.round(xPos);
              yPos = Math.round(yPos);
            }
          }

          css[transformKey] = 'translateX(' + xPos + 'px) translateY(' + yPos + 'px)';

          if (transformKey !== 'msTransform') {
            // The Z transform will keep this in the GPU (faster, and prevents artifacts),
            // but IE9 doesn't support 3d transforms and will choke.
            css[transformKey] += " translateZ(0)";
          }
        } else {
          if (_same.top) {
            css.top = _pos.top + 'px';
          } else {
            css.bottom = _pos.bottom + 'px';
          }

          if (_same.left) {
            css.left = _pos.left + 'px';
          } else {
            css.right = _pos.right + 'px';
          }
        }
      };

      var moved = false;
      if ((same.page.top || same.page.bottom) && (same.page.left || same.page.right)) {
        css.position = 'absolute';
        transcribe(same.page, pos.page);
      } else if ((same.viewport.top || same.viewport.bottom) && (same.viewport.left || same.viewport.right)) {
        css.position = 'fixed';
        transcribe(same.viewport, pos.viewport);
      } else if (typeof same.offset !== 'undefined' && same.offset.top && same.offset.left) {
        (function () {
          css.position = 'absolute';
          var offsetParent = _this8.cache('target-offsetparent', function () {
            return getOffsetParent(_this8.target);
          });

          if (getOffsetParent(_this8.element) !== offsetParent) {
            defer(function () {
              _this8.element.parentNode.removeChild(_this8.element);
              offsetParent.appendChild(_this8.element);
            });
          }

          transcribe(same.offset, pos.offset);
          moved = true;
        })();
      } else {
        css.position = 'absolute';
        transcribe({ top: true, left: true }, pos.page);
      }

      if (!moved) {
        if (this.options.bodyElement) {
          this.options.bodyElement.appendChild(this.element);
        } else {
          var offsetParentIsBody = true;
          var currentNode = this.element.parentNode;
          while (currentNode && currentNode.nodeType === 1 && currentNode.tagName !== 'BODY') {
            if (getComputedStyle(currentNode).position !== 'static') {
              offsetParentIsBody = false;
              break;
            }

            currentNode = currentNode.parentNode;
          }

          if (!offsetParentIsBody) {
            this.element.parentNode.removeChild(this.element);
            this.element.ownerDocument.body.appendChild(this.element);
          }
        }
      }

      // Any css change will trigger a repaint, so let's avoid one if nothing changed
      var writeCSS = {};
      var write = false;
      for (var key in css) {
        var val = css[key];
        var elVal = this.element.style[key];

        if (elVal !== val) {
          write = true;
          writeCSS[key] = val;
        }
      }

      if (write) {
        defer(function () {
          extend(_this8.element.style, writeCSS);
          _this8.trigger('repositioned');
        });
      }
    }
  }]);

  return TetherClass;
})(Evented);

TetherClass.modules = [];

TetherBase.position = position;

var Tether = extend(TetherClass, TetherBase);
/* globals TetherBase */

'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

var _TetherBase$Utils = TetherBase.Utils;
var getBounds = _TetherBase$Utils.getBounds;
var extend = _TetherBase$Utils.extend;
var updateClasses = _TetherBase$Utils.updateClasses;
var defer = _TetherBase$Utils.defer;

var BOUNDS_FORMAT = ['left', 'top', 'right', 'bottom'];

function getBoundingRect(tether, to) {
  if (to === 'scrollParent') {
    to = tether.scrollParents[0];
  } else if (to === 'window') {
    to = [pageXOffset, pageYOffset, innerWidth + pageXOffset, innerHeight + pageYOffset];
  }

  if (to === document) {
    to = to.documentElement;
  }

  if (typeof to.nodeType !== 'undefined') {
    (function () {
      var node = to;
      var size = getBounds(to);
      var pos = size;
      var style = getComputedStyle(to);

      to = [pos.left, pos.top, size.width + pos.left, size.height + pos.top];

      // Account any parent Frames scroll offset
      if (node.ownerDocument !== document) {
        var win = node.ownerDocument.defaultView;
        to[0] += win.pageXOffset;
        to[1] += win.pageYOffset;
        to[2] += win.pageXOffset;
        to[3] += win.pageYOffset;
      }

      BOUNDS_FORMAT.forEach(function (side, i) {
        side = side[0].toUpperCase() + side.substr(1);
        if (side === 'Top' || side === 'Left') {
          to[i] += parseFloat(style['border' + side + 'Width']);
        } else {
          to[i] -= parseFloat(style['border' + side + 'Width']);
        }
      });
    })();
  }

  return to;
}

TetherBase.modules.push({
  position: function position(_ref) {
    var _this = this;

    var top = _ref.top;
    var left = _ref.left;
    var targetAttachment = _ref.targetAttachment;

    if (!this.options.constraints) {
      return true;
    }

    var _cache = this.cache('element-bounds', function () {
      return getBounds(_this.element);
    });

    var height = _cache.height;
    var width = _cache.width;

    if (width === 0 && height === 0 && typeof this.lastSize !== 'undefined') {
      var _lastSize = this.lastSize;

      // Handle the item getting hidden as a result of our positioning without glitching
      // the classes in and out
      width = _lastSize.width;
      height = _lastSize.height;
    }

    var targetSize = this.cache('target-bounds', function () {
      return _this.getTargetBounds();
    });

    var targetHeight = targetSize.height;
    var targetWidth = targetSize.width;

    var allClasses = [this.getClass('pinned'), this.getClass('out-of-bounds')];

    this.options.constraints.forEach(function (constraint) {
      var outOfBoundsClass = constraint.outOfBoundsClass;
      var pinnedClass = constraint.pinnedClass;

      if (outOfBoundsClass) {
        allClasses.push(outOfBoundsClass);
      }
      if (pinnedClass) {
        allClasses.push(pinnedClass);
      }
    });

    allClasses.forEach(function (cls) {
      ['left', 'top', 'right', 'bottom'].forEach(function (side) {
        allClasses.push(cls + '-' + side);
      });
    });

    var addClasses = [];

    var tAttachment = extend({}, targetAttachment);
    var eAttachment = extend({}, this.attachment);

    this.options.constraints.forEach(function (constraint) {
      var to = constraint.to;
      var attachment = constraint.attachment;
      var pin = constraint.pin;

      if (typeof attachment === 'undefined') {
        attachment = '';
      }

      var changeAttachX = undefined,
          changeAttachY = undefined;
      if (attachment.indexOf(' ') >= 0) {
        var _attachment$split = attachment.split(' ');

        var _attachment$split2 = _slicedToArray(_attachment$split, 2);

        changeAttachY = _attachment$split2[0];
        changeAttachX = _attachment$split2[1];
      } else {
        changeAttachX = changeAttachY = attachment;
      }

      var bounds = getBoundingRect(_this, to);

      if (changeAttachY === 'target' || changeAttachY === 'both') {
        if (top < bounds[1] && tAttachment.top === 'top') {
          top += targetHeight;
          tAttachment.top = 'bottom';
        }

        if (top + height > bounds[3] && tAttachment.top === 'bottom') {
          top -= targetHeight;
          tAttachment.top = 'top';
        }
      }

      if (changeAttachY === 'together') {
        if (tAttachment.top === 'top') {
          if (eAttachment.top === 'bottom' && top < bounds[1]) {
            top += targetHeight;
            tAttachment.top = 'bottom';

            top += height;
            eAttachment.top = 'top';
          } else if (eAttachment.top === 'top' && top + height > bounds[3] && top - (height - targetHeight) >= bounds[1]) {
            top -= height - targetHeight;
            tAttachment.top = 'bottom';

            eAttachment.top = 'bottom';
          }
        }

        if (tAttachment.top === 'bottom') {
          if (eAttachment.top === 'top' && top + height > bounds[3]) {
            top -= targetHeight;
            tAttachment.top = 'top';

            top -= height;
            eAttachment.top = 'bottom';
          } else if (eAttachment.top === 'bottom' && top < bounds[1] && top + (height * 2 - targetHeight) <= bounds[3]) {
            top += height - targetHeight;
            tAttachment.top = 'top';

            eAttachment.top = 'top';
          }
        }

        if (tAttachment.top === 'middle') {
          if (top + height > bounds[3] && eAttachment.top === 'top') {
            top -= height;
            eAttachment.top = 'bottom';
          } else if (top < bounds[1] && eAttachment.top === 'bottom') {
            top += height;
            eAttachment.top = 'top';
          }
        }
      }

      if (changeAttachX === 'target' || changeAttachX === 'both') {
        if (left < bounds[0] && tAttachment.left === 'left') {
          left += targetWidth;
          tAttachment.left = 'right';
        }

        if (left + width > bounds[2] && tAttachment.left === 'right') {
          left -= targetWidth;
          tAttachment.left = 'left';
        }
      }

      if (changeAttachX === 'together') {
        if (left < bounds[0] && tAttachment.left === 'left') {
          if (eAttachment.left === 'right') {
            left += targetWidth;
            tAttachment.left = 'right';

            left += width;
            eAttachment.left = 'left';
          } else if (eAttachment.left === 'left') {
            left += targetWidth;
            tAttachment.left = 'right';

            left -= width;
            eAttachment.left = 'right';
          }
        } else if (left + width > bounds[2] && tAttachment.left === 'right') {
          if (eAttachment.left === 'left') {
            left -= targetWidth;
            tAttachment.left = 'left';

            left -= width;
            eAttachment.left = 'right';
          } else if (eAttachment.left === 'right') {
            left -= targetWidth;
            tAttachment.left = 'left';

            left += width;
            eAttachment.left = 'left';
          }
        } else if (tAttachment.left === 'center') {
          if (left + width > bounds[2] && eAttachment.left === 'left') {
            left -= width;
            eAttachment.left = 'right';
          } else if (left < bounds[0] && eAttachment.left === 'right') {
            left += width;
            eAttachment.left = 'left';
          }
        }
      }

      if (changeAttachY === 'element' || changeAttachY === 'both') {
        if (top < bounds[1] && eAttachment.top === 'bottom') {
          top += height;
          eAttachment.top = 'top';
        }

        if (top + height > bounds[3] && eAttachment.top === 'top') {
          top -= height;
          eAttachment.top = 'bottom';
        }
      }

      if (changeAttachX === 'element' || changeAttachX === 'both') {
        if (left < bounds[0]) {
          if (eAttachment.left === 'right') {
            left += width;
            eAttachment.left = 'left';
          } else if (eAttachment.left === 'center') {
            left += width / 2;
            eAttachment.left = 'left';
          }
        }

        if (left + width > bounds[2]) {
          if (eAttachment.left === 'left') {
            left -= width;
            eAttachment.left = 'right';
          } else if (eAttachment.left === 'center') {
            left -= width / 2;
            eAttachment.left = 'right';
          }
        }
      }

      if (typeof pin === 'string') {
        pin = pin.split(',').map(function (p) {
          return p.trim();
        });
      } else if (pin === true) {
        pin = ['top', 'left', 'right', 'bottom'];
      }

      pin = pin || [];

      var pinned = [];
      var oob = [];

      if (top < bounds[1]) {
        if (pin.indexOf('top') >= 0) {
          top = bounds[1];
          pinned.push('top');
        } else {
          oob.push('top');
        }
      }

      if (top + height > bounds[3]) {
        if (pin.indexOf('bottom') >= 0) {
          top = bounds[3] - height;
          pinned.push('bottom');
        } else {
          oob.push('bottom');
        }
      }

      if (left < bounds[0]) {
        if (pin.indexOf('left') >= 0) {
          left = bounds[0];
          pinned.push('left');
        } else {
          oob.push('left');
        }
      }

      if (left + width > bounds[2]) {
        if (pin.indexOf('right') >= 0) {
          left = bounds[2] - width;
          pinned.push('right');
        } else {
          oob.push('right');
        }
      }

      if (pinned.length) {
        (function () {
          var pinnedClass = undefined;
          if (typeof _this.options.pinnedClass !== 'undefined') {
            pinnedClass = _this.options.pinnedClass;
          } else {
            pinnedClass = _this.getClass('pinned');
          }

          addClasses.push(pinnedClass);
          pinned.forEach(function (side) {
            addClasses.push(pinnedClass + '-' + side);
          });
        })();
      }

      if (oob.length) {
        (function () {
          var oobClass = undefined;
          if (typeof _this.options.outOfBoundsClass !== 'undefined') {
            oobClass = _this.options.outOfBoundsClass;
          } else {
            oobClass = _this.getClass('out-of-bounds');
          }

          addClasses.push(oobClass);
          oob.forEach(function (side) {
            addClasses.push(oobClass + '-' + side);
          });
        })();
      }

      if (pinned.indexOf('left') >= 0 || pinned.indexOf('right') >= 0) {
        eAttachment.left = tAttachment.left = false;
      }
      if (pinned.indexOf('top') >= 0 || pinned.indexOf('bottom') >= 0) {
        eAttachment.top = tAttachment.top = false;
      }

      if (tAttachment.top !== targetAttachment.top || tAttachment.left !== targetAttachment.left || eAttachment.top !== _this.attachment.top || eAttachment.left !== _this.attachment.left) {
        _this.updateAttachClasses(eAttachment, tAttachment);
        _this.trigger('update', {
          attachment: eAttachment,
          targetAttachment: tAttachment
        });
      }
    });

    defer(function () {
      if (!(_this.options.addTargetClasses === false)) {
        updateClasses(_this.target, addClasses, allClasses);
      }
      updateClasses(_this.element, addClasses, allClasses);
    });

    return { top: top, left: left };
  }
});
/* globals TetherBase */

'use strict';

var _TetherBase$Utils = TetherBase.Utils;
var getBounds = _TetherBase$Utils.getBounds;
var updateClasses = _TetherBase$Utils.updateClasses;
var defer = _TetherBase$Utils.defer;

TetherBase.modules.push({
  position: function position(_ref) {
    var _this = this;

    var top = _ref.top;
    var left = _ref.left;

    var _cache = this.cache('element-bounds', function () {
      return getBounds(_this.element);
    });

    var height = _cache.height;
    var width = _cache.width;

    var targetPos = this.getTargetBounds();

    var bottom = top + height;
    var right = left + width;

    var abutted = [];
    if (top <= targetPos.bottom && bottom >= targetPos.top) {
      ['left', 'right'].forEach(function (side) {
        var targetPosSide = targetPos[side];
        if (targetPosSide === left || targetPosSide === right) {
          abutted.push(side);
        }
      });
    }

    if (left <= targetPos.right && right >= targetPos.left) {
      ['top', 'bottom'].forEach(function (side) {
        var targetPosSide = targetPos[side];
        if (targetPosSide === top || targetPosSide === bottom) {
          abutted.push(side);
        }
      });
    }

    var allClasses = [];
    var addClasses = [];

    var sides = ['left', 'top', 'right', 'bottom'];
    allClasses.push(this.getClass('abutted'));
    sides.forEach(function (side) {
      allClasses.push(_this.getClass('abutted') + '-' + side);
    });

    if (abutted.length) {
      addClasses.push(this.getClass('abutted'));
    }

    abutted.forEach(function (side) {
      addClasses.push(_this.getClass('abutted') + '-' + side);
    });

    defer(function () {
      if (!(_this.options.addTargetClasses === false)) {
        updateClasses(_this.target, addClasses, allClasses);
      }
      updateClasses(_this.element, addClasses, allClasses);
    });

    return true;
  }
});
/* globals TetherBase */

'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

TetherBase.modules.push({
  position: function position(_ref) {
    var top = _ref.top;
    var left = _ref.left;

    if (!this.options.shift) {
      return;
    }

    var shift = this.options.shift;
    if (typeof this.options.shift === 'function') {
      shift = this.options.shift.call(this, { top: top, left: left });
    }

    var shiftTop = undefined,
        shiftLeft = undefined;
    if (typeof shift === 'string') {
      shift = shift.split(' ');
      shift[1] = shift[1] || shift[0];

      var _shift = shift;

      var _shift2 = _slicedToArray(_shift, 2);

      shiftTop = _shift2[0];
      shiftLeft = _shift2[1];

      shiftTop = parseFloat(shiftTop, 10);
      shiftLeft = parseFloat(shiftLeft, 10);
    } else {
      shiftTop = shift.top;
      shiftLeft = shift.left;
    }

    top += shiftTop;
    left += shiftLeft;

    return { top: top, left: left };
  }
});
return Tether;

}));

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-alpha.6): util.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Util = function ($) {

  /**
   * ------------------------------------------------------------------------
   * Private TransitionEnd Helpers
   * ------------------------------------------------------------------------
   */

  var transition = false;

  var MAX_UID = 1000000;

  var TransitionEndEvent = {
    WebkitTransition: 'webkitTransitionEnd',
    MozTransition: 'transitionend',
    OTransition: 'oTransitionEnd otransitionend',
    transition: 'transitionend'
  };

  // shoutout AngusCroll (https://goo.gl/pxwQGp)
  function toType(obj) {
    return {}.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
  }

  function isElement(obj) {
    return (obj[0] || obj).nodeType;
  }

  function getSpecialTransitionEndEvent() {
    return {
      bindType: transition.end,
      delegateType: transition.end,
      handle: function handle(event) {
        if ($(event.target).is(this)) {
          return event.handleObj.handler.apply(this, arguments); // eslint-disable-line prefer-rest-params
        }
        return undefined;
      }
    };
  }

  function transitionEndTest() {
    if (window.QUnit) {
      return false;
    }

    var el = document.createElement('bootstrap');

    for (var name in TransitionEndEvent) {
      if (el.style[name] !== undefined) {
        return {
          end: TransitionEndEvent[name]
        };
      }
    }

    return false;
  }

  function transitionEndEmulator(duration) {
    var _this = this;

    var called = false;

    $(this).one(Util.TRANSITION_END, function () {
      called = true;
    });

    setTimeout(function () {
      if (!called) {
        Util.triggerTransitionEnd(_this);
      }
    }, duration);

    return this;
  }

  function setTransitionEndSupport() {
    transition = transitionEndTest();

    $.fn.emulateTransitionEnd = transitionEndEmulator;

    if (Util.supportsTransitionEnd()) {
      $.event.special[Util.TRANSITION_END] = getSpecialTransitionEndEvent();
    }
  }

  /**
   * --------------------------------------------------------------------------
   * Public Util Api
   * --------------------------------------------------------------------------
   */

  var Util = {

    TRANSITION_END: 'bsTransitionEnd',

    getUID: function getUID(prefix) {
      do {
        // eslint-disable-next-line no-bitwise
        prefix += ~~(Math.random() * MAX_UID); // "~~" acts like a faster Math.floor() here
      } while (document.getElementById(prefix));
      return prefix;
    },
    getSelectorFromElement: function getSelectorFromElement(element) {
      var selector = element.getAttribute('data-target');

      if (!selector) {
        selector = element.getAttribute('href') || '';
        selector = /^#[a-z]/i.test(selector) ? selector : null;
      }

      return selector;
    },
    reflow: function reflow(element) {
      return element.offsetHeight;
    },
    triggerTransitionEnd: function triggerTransitionEnd(element) {
      $(element).trigger(transition.end);
    },
    supportsTransitionEnd: function supportsTransitionEnd() {
      return Boolean(transition);
    },
    typeCheckConfig: function typeCheckConfig(componentName, config, configTypes) {
      for (var property in configTypes) {
        if (configTypes.hasOwnProperty(property)) {
          var expectedTypes = configTypes[property];
          var value = config[property];
          var valueType = value && isElement(value) ? 'element' : toType(value);

          if (!new RegExp(expectedTypes).test(valueType)) {
            throw new Error(componentName.toUpperCase() + ': ' + ('Option "' + property + '" provided type "' + valueType + '" ') + ('but expected type "' + expectedTypes + '".'));
          }
        }
      }
    }
  };

  setTransitionEndSupport();

  return Util;
}(jQuery);
//# sourceMappingURL=util.js.map

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-alpha.6): modal.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Modal = function ($) {

  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */

  var NAME = 'modal';
  var VERSION = '4.0.0-alpha.6';
  var DATA_KEY = 'bs.modal';
  var EVENT_KEY = '.' + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var TRANSITION_DURATION = 300;
  var BACKDROP_TRANSITION_DURATION = 150;
  var ESCAPE_KEYCODE = 27; // KeyboardEvent.which value for Escape (Esc) key

  var Default = {
    backdrop: true,
    keyboard: true,
    focus: true,
    show: true
  };

  var DefaultType = {
    backdrop: '(boolean|string)',
    keyboard: 'boolean',
    focus: 'boolean',
    show: 'boolean'
  };

  var Event = {
    HIDE: 'hide' + EVENT_KEY,
    HIDDEN: 'hidden' + EVENT_KEY,
    SHOW: 'show' + EVENT_KEY,
    SHOWN: 'shown' + EVENT_KEY,
    FOCUSIN: 'focusin' + EVENT_KEY,
    RESIZE: 'resize' + EVENT_KEY,
    CLICK_DISMISS: 'click.dismiss' + EVENT_KEY,
    KEYDOWN_DISMISS: 'keydown.dismiss' + EVENT_KEY,
    MOUSEUP_DISMISS: 'mouseup.dismiss' + EVENT_KEY,
    MOUSEDOWN_DISMISS: 'mousedown.dismiss' + EVENT_KEY,
    CLICK_DATA_API: 'click' + EVENT_KEY + DATA_API_KEY
  };

  var ClassName = {
    SCROLLBAR_MEASURER: 'modal-scrollbar-measure',
    BACKDROP: 'modal-backdrop',
    OPEN: 'modal-open',
    FADE: 'fade',
    SHOW: 'show'
  };

  var Selector = {
    DIALOG: '.modal-dialog',
    DATA_TOGGLE: '[data-toggle="modal"]',
    DATA_DISMISS: '[data-dismiss="modal"]',
    FIXED_CONTENT: '.fixed-top, .fixed-bottom, .is-fixed, .sticky-top'
  };

  /**
   * ------------------------------------------------------------------------
   * Class Definition
   * ------------------------------------------------------------------------
   */

  var Modal = function () {
    function Modal(element, config) {
      _classCallCheck(this, Modal);

      this._config = this._getConfig(config);
      this._element = element;
      this._dialog = $(element).find(Selector.DIALOG)[0];
      this._backdrop = null;
      this._isShown = false;
      this._isBodyOverflowing = false;
      this._ignoreBackdropClick = false;
      this._isTransitioning = false;
      this._originalBodyPadding = 0;
      this._scrollbarWidth = 0;
    }

    // getters

    // public

    Modal.prototype.toggle = function toggle(relatedTarget) {
      return this._isShown ? this.hide() : this.show(relatedTarget);
    };

    Modal.prototype.show = function show(relatedTarget) {
      var _this = this;

      if (this._isTransitioning) {
        throw new Error('Modal is transitioning');
      }

      if (Util.supportsTransitionEnd() && $(this._element).hasClass(ClassName.FADE)) {
        this._isTransitioning = true;
      }
      var showEvent = $.Event(Event.SHOW, {
        relatedTarget: relatedTarget
      });

      $(this._element).trigger(showEvent);

      if (this._isShown || showEvent.isDefaultPrevented()) {
        return;
      }

      this._isShown = true;

      this._checkScrollbar();
      this._setScrollbar();

      $(document.body).addClass(ClassName.OPEN);

      this._setEscapeEvent();
      this._setResizeEvent();

      $(this._element).on(Event.CLICK_DISMISS, Selector.DATA_DISMISS, function (event) {
        return _this.hide(event);
      });

      $(this._dialog).on(Event.MOUSEDOWN_DISMISS, function () {
        $(_this._element).one(Event.MOUSEUP_DISMISS, function (event) {
          if ($(event.target).is(_this._element)) {
            _this._ignoreBackdropClick = true;
          }
        });
      });

      this._showBackdrop(function () {
        return _this._showElement(relatedTarget);
      });
    };

    Modal.prototype.hide = function hide(event) {
      var _this2 = this;

      if (event) {
        event.preventDefault();
      }

      if (this._isTransitioning) {
        throw new Error('Modal is transitioning');
      }

      var transition = Util.supportsTransitionEnd() && $(this._element).hasClass(ClassName.FADE);
      if (transition) {
        this._isTransitioning = true;
      }

      var hideEvent = $.Event(Event.HIDE);
      $(this._element).trigger(hideEvent);

      if (!this._isShown || hideEvent.isDefaultPrevented()) {
        return;
      }

      this._isShown = false;

      this._setEscapeEvent();
      this._setResizeEvent();

      $(document).off(Event.FOCUSIN);

      $(this._element).removeClass(ClassName.SHOW);

      $(this._element).off(Event.CLICK_DISMISS);
      $(this._dialog).off(Event.MOUSEDOWN_DISMISS);

      if (transition) {
        $(this._element).one(Util.TRANSITION_END, function (event) {
          return _this2._hideModal(event);
        }).emulateTransitionEnd(TRANSITION_DURATION);
      } else {
        this._hideModal();
      }
    };

    Modal.prototype.dispose = function dispose() {
      $.removeData(this._element, DATA_KEY);

      $(window, document, this._element, this._backdrop).off(EVENT_KEY);

      this._config = null;
      this._element = null;
      this._dialog = null;
      this._backdrop = null;
      this._isShown = null;
      this._isBodyOverflowing = null;
      this._ignoreBackdropClick = null;
      this._originalBodyPadding = null;
      this._scrollbarWidth = null;
    };

    // private

    Modal.prototype._getConfig = function _getConfig(config) {
      config = $.extend({}, Default, config);
      Util.typeCheckConfig(NAME, config, DefaultType);
      return config;
    };

    Modal.prototype._showElement = function _showElement(relatedTarget) {
      var _this3 = this;

      var transition = Util.supportsTransitionEnd() && $(this._element).hasClass(ClassName.FADE);

      if (!this._element.parentNode || this._element.parentNode.nodeType !== Node.ELEMENT_NODE) {
        // don't move modals dom position
        document.body.appendChild(this._element);
      }

      this._element.style.display = 'block';
      this._element.removeAttribute('aria-hidden');
      this._element.scrollTop = 0;

      if (transition) {
        Util.reflow(this._element);
      }

      $(this._element).addClass(ClassName.SHOW);

      if (this._config.focus) {
        this._enforceFocus();
      }

      var shownEvent = $.Event(Event.SHOWN, {
        relatedTarget: relatedTarget
      });

      var transitionComplete = function transitionComplete() {
        if (_this3._config.focus) {
          _this3._element.focus();
        }
        _this3._isTransitioning = false;
        $(_this3._element).trigger(shownEvent);
      };

      if (transition) {
        $(this._dialog).one(Util.TRANSITION_END, transitionComplete).emulateTransitionEnd(TRANSITION_DURATION);
      } else {
        transitionComplete();
      }
    };

    Modal.prototype._enforceFocus = function _enforceFocus() {
      var _this4 = this;

      $(document).off(Event.FOCUSIN) // guard against infinite focus loop
      .on(Event.FOCUSIN, function (event) {
        if (document !== event.target && _this4._element !== event.target && !$(_this4._element).has(event.target).length) {
          _this4._element.focus();
        }
      });
    };

    Modal.prototype._setEscapeEvent = function _setEscapeEvent() {
      var _this5 = this;

      if (this._isShown && this._config.keyboard) {
        $(this._element).on(Event.KEYDOWN_DISMISS, function (event) {
          if (event.which === ESCAPE_KEYCODE) {
            _this5.hide();
          }
        });
      } else if (!this._isShown) {
        $(this._element).off(Event.KEYDOWN_DISMISS);
      }
    };

    Modal.prototype._setResizeEvent = function _setResizeEvent() {
      var _this6 = this;

      if (this._isShown) {
        $(window).on(Event.RESIZE, function (event) {
          return _this6._handleUpdate(event);
        });
      } else {
        $(window).off(Event.RESIZE);
      }
    };

    Modal.prototype._hideModal = function _hideModal() {
      var _this7 = this;

      this._element.style.display = 'none';
      this._element.setAttribute('aria-hidden', 'true');
      this._isTransitioning = false;
      this._showBackdrop(function () {
        $(document.body).removeClass(ClassName.OPEN);
        _this7._resetAdjustments();
        _this7._resetScrollbar();
        $(_this7._element).trigger(Event.HIDDEN);
      });
    };

    Modal.prototype._removeBackdrop = function _removeBackdrop() {
      if (this._backdrop) {
        $(this._backdrop).remove();
        this._backdrop = null;
      }
    };

    Modal.prototype._showBackdrop = function _showBackdrop(callback) {
      var _this8 = this;

      var animate = $(this._element).hasClass(ClassName.FADE) ? ClassName.FADE : '';

      if (this._isShown && this._config.backdrop) {
        var doAnimate = Util.supportsTransitionEnd() && animate;

        this._backdrop = document.createElement('div');
        this._backdrop.className = ClassName.BACKDROP;

        if (animate) {
          $(this._backdrop).addClass(animate);
        }

        $(this._backdrop).appendTo(document.body);

        $(this._element).on(Event.CLICK_DISMISS, function (event) {
          if (_this8._ignoreBackdropClick) {
            _this8._ignoreBackdropClick = false;
            return;
          }
          if (event.target !== event.currentTarget) {
            return;
          }
          if (_this8._config.backdrop === 'static') {
            _this8._element.focus();
          } else {
            _this8.hide();
          }
        });

        if (doAnimate) {
          Util.reflow(this._backdrop);
        }

        $(this._backdrop).addClass(ClassName.SHOW);

        if (!callback) {
          return;
        }

        if (!doAnimate) {
          callback();
          return;
        }

        $(this._backdrop).one(Util.TRANSITION_END, callback).emulateTransitionEnd(BACKDROP_TRANSITION_DURATION);
      } else if (!this._isShown && this._backdrop) {
        $(this._backdrop).removeClass(ClassName.SHOW);

        var callbackRemove = function callbackRemove() {
          _this8._removeBackdrop();
          if (callback) {
            callback();
          }
        };

        if (Util.supportsTransitionEnd() && $(this._element).hasClass(ClassName.FADE)) {
          $(this._backdrop).one(Util.TRANSITION_END, callbackRemove).emulateTransitionEnd(BACKDROP_TRANSITION_DURATION);
        } else {
          callbackRemove();
        }
      } else if (callback) {
        callback();
      }
    };

    // ----------------------------------------------------------------------
    // the following methods are used to handle overflowing modals
    // todo (fat): these should probably be refactored out of modal.js
    // ----------------------------------------------------------------------

    Modal.prototype._handleUpdate = function _handleUpdate() {
      this._adjustDialog();
    };

    Modal.prototype._adjustDialog = function _adjustDialog() {
      var isModalOverflowing = this._element.scrollHeight > document.documentElement.clientHeight;

      if (!this._isBodyOverflowing && isModalOverflowing) {
        this._element.style.paddingLeft = this._scrollbarWidth + 'px';
      }

      if (this._isBodyOverflowing && !isModalOverflowing) {
        this._element.style.paddingRight = this._scrollbarWidth + 'px';
      }
    };

    Modal.prototype._resetAdjustments = function _resetAdjustments() {
      this._element.style.paddingLeft = '';
      this._element.style.paddingRight = '';
    };

    Modal.prototype._checkScrollbar = function _checkScrollbar() {
      this._isBodyOverflowing = document.body.clientWidth < window.innerWidth;
      this._scrollbarWidth = this._getScrollbarWidth();
    };

    Modal.prototype._setScrollbar = function _setScrollbar() {
      var bodyPadding = parseInt($(Selector.FIXED_CONTENT).css('padding-right') || 0, 10);

      this._originalBodyPadding = document.body.style.paddingRight || '';

      if (this._isBodyOverflowing) {
        document.body.style.paddingRight = bodyPadding + this._scrollbarWidth + 'px';
      }
    };

    Modal.prototype._resetScrollbar = function _resetScrollbar() {
      document.body.style.paddingRight = this._originalBodyPadding;
    };

    Modal.prototype._getScrollbarWidth = function _getScrollbarWidth() {
      // thx d.walsh
      var scrollDiv = document.createElement('div');
      scrollDiv.className = ClassName.SCROLLBAR_MEASURER;
      document.body.appendChild(scrollDiv);
      var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
      document.body.removeChild(scrollDiv);
      return scrollbarWidth;
    };

    // static

    Modal._jQueryInterface = function _jQueryInterface(config, relatedTarget) {
      return this.each(function () {
        var data = $(this).data(DATA_KEY);
        var _config = $.extend({}, Modal.Default, $(this).data(), (typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object' && config);

        if (!data) {
          data = new Modal(this, _config);
          $(this).data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (data[config] === undefined) {
            throw new Error('No method named "' + config + '"');
          }
          data[config](relatedTarget);
        } else if (_config.show) {
          data.show(relatedTarget);
        }
      });
    };

    _createClass(Modal, null, [{
      key: 'VERSION',
      get: function get() {
        return VERSION;
      }
    }, {
      key: 'Default',
      get: function get() {
        return Default;
      }
    }]);

    return Modal;
  }();

  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */

  $(document).on(Event.CLICK_DATA_API, Selector.DATA_TOGGLE, function (event) {
    var _this9 = this;

    var target = void 0;
    var selector = Util.getSelectorFromElement(this);

    if (selector) {
      target = $(selector)[0];
    }

    var config = $(target).data(DATA_KEY) ? 'toggle' : $.extend({}, $(target).data(), $(this).data());

    if (this.tagName === 'A' || this.tagName === 'AREA') {
      event.preventDefault();
    }

    var $target = $(target).one(Event.SHOW, function (showEvent) {
      if (showEvent.isDefaultPrevented()) {
        // only register focus restorer if modal will actually get shown
        return;
      }

      $target.one(Event.HIDDEN, function () {
        if ($(_this9).is(':visible')) {
          _this9.focus();
        }
      });
    });

    Modal._jQueryInterface.call($(target), config, this);
  });

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Modal._jQueryInterface;
  $.fn[NAME].Constructor = Modal;
  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Modal._jQueryInterface;
  };

  return Modal;
}(jQuery);
//# sourceMappingURL=modal.js.map

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0-alpha.6): tooltip.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */

var Tooltip = function ($) {

  /**
   * Check for Tether dependency
   * Tether - http://tether.io/
   */
  if (typeof Tether === 'undefined') {
    throw new Error('Bootstrap tooltips require Tether (http://tether.io/)');
  }

  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */

  var NAME = 'tooltip';
  var VERSION = '4.0.0-alpha.6';
  var DATA_KEY = 'bs.tooltip';
  var EVENT_KEY = '.' + DATA_KEY;
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var TRANSITION_DURATION = 150;
  var CLASS_PREFIX = 'bs-tether';

  var Default = {
    animation: true,
    template: '<div class="tooltip" role="tooltip">' + '<div class="tooltip-inner"></div></div>',
    trigger: 'hover focus',
    title: '',
    delay: 0,
    html: false,
    selector: false,
    placement: 'top',
    offset: '0 0',
    constraints: [],
    container: false
  };

  var DefaultType = {
    animation: 'boolean',
    template: 'string',
    title: '(string|element|function)',
    trigger: 'string',
    delay: '(number|object)',
    html: 'boolean',
    selector: '(string|boolean)',
    placement: '(string|function)',
    offset: 'string',
    constraints: 'array',
    container: '(string|element|boolean)'
  };

  var AttachmentMap = {
    TOP: 'bottom center',
    RIGHT: 'middle left',
    BOTTOM: 'top center',
    LEFT: 'middle right'
  };

  var HoverState = {
    SHOW: 'show',
    OUT: 'out'
  };

  var Event = {
    HIDE: 'hide' + EVENT_KEY,
    HIDDEN: 'hidden' + EVENT_KEY,
    SHOW: 'show' + EVENT_KEY,
    SHOWN: 'shown' + EVENT_KEY,
    INSERTED: 'inserted' + EVENT_KEY,
    CLICK: 'click' + EVENT_KEY,
    FOCUSIN: 'focusin' + EVENT_KEY,
    FOCUSOUT: 'focusout' + EVENT_KEY,
    MOUSEENTER: 'mouseenter' + EVENT_KEY,
    MOUSELEAVE: 'mouseleave' + EVENT_KEY
  };

  var ClassName = {
    FADE: 'fade',
    SHOW: 'show'
  };

  var Selector = {
    TOOLTIP: '.tooltip',
    TOOLTIP_INNER: '.tooltip-inner'
  };

  var TetherClass = {
    element: false,
    enabled: false
  };

  var Trigger = {
    HOVER: 'hover',
    FOCUS: 'focus',
    CLICK: 'click',
    MANUAL: 'manual'
  };

  /**
   * ------------------------------------------------------------------------
   * Class Definition
   * ------------------------------------------------------------------------
   */

  var Tooltip = function () {
    function Tooltip(element, config) {
      _classCallCheck(this, Tooltip);

      // private
      this._isEnabled = true;
      this._timeout = 0;
      this._hoverState = '';
      this._activeTrigger = {};
      this._isTransitioning = false;
      this._tether = null;

      // protected
      this.element = element;
      this.config = this._getConfig(config);
      this.tip = null;

      this._setListeners();
    }

    // getters

    // public

    Tooltip.prototype.enable = function enable() {
      this._isEnabled = true;
    };

    Tooltip.prototype.disable = function disable() {
      this._isEnabled = false;
    };

    Tooltip.prototype.toggleEnabled = function toggleEnabled() {
      this._isEnabled = !this._isEnabled;
    };

    Tooltip.prototype.toggle = function toggle(event) {
      if (event) {
        var dataKey = this.constructor.DATA_KEY;
        var context = $(event.currentTarget).data(dataKey);

        if (!context) {
          context = new this.constructor(event.currentTarget, this._getDelegateConfig());
          $(event.currentTarget).data(dataKey, context);
        }

        context._activeTrigger.click = !context._activeTrigger.click;

        if (context._isWithActiveTrigger()) {
          context._enter(null, context);
        } else {
          context._leave(null, context);
        }
      } else {

        if ($(this.getTipElement()).hasClass(ClassName.SHOW)) {
          this._leave(null, this);
          return;
        }

        this._enter(null, this);
      }
    };

    Tooltip.prototype.dispose = function dispose() {
      clearTimeout(this._timeout);

      this.cleanupTether();

      $.removeData(this.element, this.constructor.DATA_KEY);

      $(this.element).off(this.constructor.EVENT_KEY);
      $(this.element).closest('.modal').off('hide.bs.modal');

      if (this.tip) {
        $(this.tip).remove();
      }

      this._isEnabled = null;
      this._timeout = null;
      this._hoverState = null;
      this._activeTrigger = null;
      this._tether = null;

      this.element = null;
      this.config = null;
      this.tip = null;
    };

    Tooltip.prototype.show = function show() {
      var _this = this;

      if ($(this.element).css('display') === 'none') {
        throw new Error('Please use show on visible elements');
      }

      var showEvent = $.Event(this.constructor.Event.SHOW);
      if (this.isWithContent() && this._isEnabled) {
        if (this._isTransitioning) {
          throw new Error('Tooltip is transitioning');
        }
        $(this.element).trigger(showEvent);

        var isInTheDom = $.contains(this.element.ownerDocument.documentElement, this.element);

        if (showEvent.isDefaultPrevented() || !isInTheDom) {
          return;
        }

        var tip = this.getTipElement();
        var tipId = Util.getUID(this.constructor.NAME);

        tip.setAttribute('id', tipId);
        this.element.setAttribute('aria-describedby', tipId);

        this.setContent();

        if (this.config.animation) {
          $(tip).addClass(ClassName.FADE);
        }

        var placement = typeof this.config.placement === 'function' ? this.config.placement.call(this, tip, this.element) : this.config.placement;

        var attachment = this._getAttachment(placement);

        var container = this.config.container === false ? document.body : $(this.config.container);

        $(tip).data(this.constructor.DATA_KEY, this).appendTo(container);

        $(this.element).trigger(this.constructor.Event.INSERTED);

        this._tether = new Tether({
          attachment: attachment,
          element: tip,
          target: this.element,
          classes: TetherClass,
          classPrefix: CLASS_PREFIX,
          offset: this.config.offset,
          constraints: this.config.constraints,
          addTargetClasses: false
        });

        Util.reflow(tip);
        this._tether.position();

        $(tip).addClass(ClassName.SHOW);

        var complete = function complete() {
          var prevHoverState = _this._hoverState;
          _this._hoverState = null;
          _this._isTransitioning = false;

          $(_this.element).trigger(_this.constructor.Event.SHOWN);

          if (prevHoverState === HoverState.OUT) {
            _this._leave(null, _this);
          }
        };

        if (Util.supportsTransitionEnd() && $(this.tip).hasClass(ClassName.FADE)) {
          this._isTransitioning = true;
          $(this.tip).one(Util.TRANSITION_END, complete).emulateTransitionEnd(Tooltip._TRANSITION_DURATION);
          return;
        }

        complete();
      }
    };

    Tooltip.prototype.hide = function hide(callback) {
      var _this2 = this;

      var tip = this.getTipElement();
      var hideEvent = $.Event(this.constructor.Event.HIDE);
      if (this._isTransitioning) {
        throw new Error('Tooltip is transitioning');
      }
      var complete = function complete() {
        if (_this2._hoverState !== HoverState.SHOW && tip.parentNode) {
          tip.parentNode.removeChild(tip);
        }

        _this2.element.removeAttribute('aria-describedby');
        $(_this2.element).trigger(_this2.constructor.Event.HIDDEN);
        _this2._isTransitioning = false;
        _this2.cleanupTether();

        if (callback) {
          callback();
        }
      };

      $(this.element).trigger(hideEvent);

      if (hideEvent.isDefaultPrevented()) {
        return;
      }

      $(tip).removeClass(ClassName.SHOW);

      this._activeTrigger[Trigger.CLICK] = false;
      this._activeTrigger[Trigger.FOCUS] = false;
      this._activeTrigger[Trigger.HOVER] = false;

      if (Util.supportsTransitionEnd() && $(this.tip).hasClass(ClassName.FADE)) {
        this._isTransitioning = true;
        $(tip).one(Util.TRANSITION_END, complete).emulateTransitionEnd(TRANSITION_DURATION);
      } else {
        complete();
      }

      this._hoverState = '';
    };

    // protected

    Tooltip.prototype.isWithContent = function isWithContent() {
      return Boolean(this.getTitle());
    };

    Tooltip.prototype.getTipElement = function getTipElement() {
      return this.tip = this.tip || $(this.config.template)[0];
    };

    Tooltip.prototype.setContent = function setContent() {
      var $tip = $(this.getTipElement());

      this.setElementContent($tip.find(Selector.TOOLTIP_INNER), this.getTitle());

      $tip.removeClass(ClassName.FADE + ' ' + ClassName.SHOW);

      this.cleanupTether();
    };

    Tooltip.prototype.setElementContent = function setElementContent($element, content) {
      var html = this.config.html;
      if ((typeof content === 'undefined' ? 'undefined' : _typeof(content)) === 'object' && (content.nodeType || content.jquery)) {
        // content is a DOM node or a jQuery
        if (html) {
          if (!$(content).parent().is($element)) {
            $element.empty().append(content);
          }
        } else {
          $element.text($(content).text());
        }
      } else {
        $element[html ? 'html' : 'text'](content);
      }
    };

    Tooltip.prototype.getTitle = function getTitle() {
      var title = this.element.getAttribute('data-original-title');

      if (!title) {
        title = typeof this.config.title === 'function' ? this.config.title.call(this.element) : this.config.title;
      }

      return title;
    };

    Tooltip.prototype.cleanupTether = function cleanupTether() {
      if (this._tether) {
        this._tether.destroy();
      }
    };

    // private

    Tooltip.prototype._getAttachment = function _getAttachment(placement) {
      return AttachmentMap[placement.toUpperCase()];
    };

    Tooltip.prototype._setListeners = function _setListeners() {
      var _this3 = this;

      var triggers = this.config.trigger.split(' ');

      triggers.forEach(function (trigger) {
        if (trigger === 'click') {
          $(_this3.element).on(_this3.constructor.Event.CLICK, _this3.config.selector, function (event) {
            return _this3.toggle(event);
          });
        } else if (trigger !== Trigger.MANUAL) {
          var eventIn = trigger === Trigger.HOVER ? _this3.constructor.Event.MOUSEENTER : _this3.constructor.Event.FOCUSIN;
          var eventOut = trigger === Trigger.HOVER ? _this3.constructor.Event.MOUSELEAVE : _this3.constructor.Event.FOCUSOUT;

          $(_this3.element).on(eventIn, _this3.config.selector, function (event) {
            return _this3._enter(event);
          }).on(eventOut, _this3.config.selector, function (event) {
            return _this3._leave(event);
          });
        }

        $(_this3.element).closest('.modal').on('hide.bs.modal', function () {
          return _this3.hide();
        });
      });

      if (this.config.selector) {
        this.config = $.extend({}, this.config, {
          trigger: 'manual',
          selector: ''
        });
      } else {
        this._fixTitle();
      }
    };

    Tooltip.prototype._fixTitle = function _fixTitle() {
      var titleType = _typeof(this.element.getAttribute('data-original-title'));
      if (this.element.getAttribute('title') || titleType !== 'string') {
        this.element.setAttribute('data-original-title', this.element.getAttribute('title') || '');
        this.element.setAttribute('title', '');
      }
    };

    Tooltip.prototype._enter = function _enter(event, context) {
      var dataKey = this.constructor.DATA_KEY;

      context = context || $(event.currentTarget).data(dataKey);

      if (!context) {
        context = new this.constructor(event.currentTarget, this._getDelegateConfig());
        $(event.currentTarget).data(dataKey, context);
      }

      if (event) {
        context._activeTrigger[event.type === 'focusin' ? Trigger.FOCUS : Trigger.HOVER] = true;
      }

      if ($(context.getTipElement()).hasClass(ClassName.SHOW) || context._hoverState === HoverState.SHOW) {
        context._hoverState = HoverState.SHOW;
        return;
      }

      clearTimeout(context._timeout);

      context._hoverState = HoverState.SHOW;

      if (!context.config.delay || !context.config.delay.show) {
        context.show();
        return;
      }

      context._timeout = setTimeout(function () {
        if (context._hoverState === HoverState.SHOW) {
          context.show();
        }
      }, context.config.delay.show);
    };

    Tooltip.prototype._leave = function _leave(event, context) {
      var dataKey = this.constructor.DATA_KEY;

      context = context || $(event.currentTarget).data(dataKey);

      if (!context) {
        context = new this.constructor(event.currentTarget, this._getDelegateConfig());
        $(event.currentTarget).data(dataKey, context);
      }

      if (event) {
        context._activeTrigger[event.type === 'focusout' ? Trigger.FOCUS : Trigger.HOVER] = false;
      }

      if (context._isWithActiveTrigger()) {
        return;
      }

      clearTimeout(context._timeout);

      context._hoverState = HoverState.OUT;

      if (!context.config.delay || !context.config.delay.hide) {
        context.hide();
        return;
      }

      context._timeout = setTimeout(function () {
        if (context._hoverState === HoverState.OUT) {
          context.hide();
        }
      }, context.config.delay.hide);
    };

    Tooltip.prototype._isWithActiveTrigger = function _isWithActiveTrigger() {
      for (var trigger in this._activeTrigger) {
        if (this._activeTrigger[trigger]) {
          return true;
        }
      }

      return false;
    };

    Tooltip.prototype._getConfig = function _getConfig(config) {
      config = $.extend({}, this.constructor.Default, $(this.element).data(), config);

      if (config.delay && typeof config.delay === 'number') {
        config.delay = {
          show: config.delay,
          hide: config.delay
        };
      }

      Util.typeCheckConfig(NAME, config, this.constructor.DefaultType);

      return config;
    };

    Tooltip.prototype._getDelegateConfig = function _getDelegateConfig() {
      var config = {};

      if (this.config) {
        for (var key in this.config) {
          if (this.constructor.Default[key] !== this.config[key]) {
            config[key] = this.config[key];
          }
        }
      }

      return config;
    };

    // static

    Tooltip._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var data = $(this).data(DATA_KEY);
        var _config = (typeof config === 'undefined' ? 'undefined' : _typeof(config)) === 'object' && config;

        if (!data && /dispose|hide/.test(config)) {
          return;
        }

        if (!data) {
          data = new Tooltip(this, _config);
          $(this).data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (data[config] === undefined) {
            throw new Error('No method named "' + config + '"');
          }
          data[config]();
        }
      });
    };

    _createClass(Tooltip, null, [{
      key: 'VERSION',
      get: function get() {
        return VERSION;
      }
    }, {
      key: 'Default',
      get: function get() {
        return Default;
      }
    }, {
      key: 'NAME',
      get: function get() {
        return NAME;
      }
    }, {
      key: 'DATA_KEY',
      get: function get() {
        return DATA_KEY;
      }
    }, {
      key: 'Event',
      get: function get() {
        return Event;
      }
    }, {
      key: 'EVENT_KEY',
      get: function get() {
        return EVENT_KEY;
      }
    }, {
      key: 'DefaultType',
      get: function get() {
        return DefaultType;
      }
    }]);

    return Tooltip;
  }();

  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Tooltip._jQueryInterface;
  $.fn[NAME].Constructor = Tooltip;
  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Tooltip._jQueryInterface;
  };

  return Tooltip;
}(jQuery); /* global Tether */
//# sourceMappingURL=tooltip.js.map

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRldGhlci5qcyIsInV0aWwuanMiLCJtb2RhbC5qcyIsInRvb2x0aXAuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbnhEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdmhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoic3VpdGNhc2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiEgdGV0aGVyIDEuNC4wICovXG5cbihmdW5jdGlvbihyb290LCBmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoZmFjdG9yeSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHJlcXVpcmUsIGV4cG9ydHMsIG1vZHVsZSk7XG4gIH0gZWxzZSB7XG4gICAgcm9vdC5UZXRoZXIgPSBmYWN0b3J5KCk7XG4gIH1cbn0odGhpcywgZnVuY3Rpb24ocmVxdWlyZSwgZXhwb3J0cywgbW9kdWxlKSB7XG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9jcmVhdGVDbGFzcyA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSkoKTtcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbnZhciBUZXRoZXJCYXNlID0gdW5kZWZpbmVkO1xuaWYgKHR5cGVvZiBUZXRoZXJCYXNlID09PSAndW5kZWZpbmVkJykge1xuICBUZXRoZXJCYXNlID0geyBtb2R1bGVzOiBbXSB9O1xufVxuXG52YXIgemVyb0VsZW1lbnQgPSBudWxsO1xuXG4vLyBTYW1lIGFzIG5hdGl2ZSBnZXRCb3VuZGluZ0NsaWVudFJlY3QsIGV4Y2VwdCBpdCB0YWtlcyBpbnRvIGFjY291bnQgcGFyZW50IDxmcmFtZT4gb2Zmc2V0c1xuLy8gaWYgdGhlIGVsZW1lbnQgbGllcyB3aXRoaW4gYSBuZXN0ZWQgZG9jdW1lbnQgKDxmcmFtZT4gb3IgPGlmcmFtZT4tbGlrZSkuXG5mdW5jdGlvbiBnZXRBY3R1YWxCb3VuZGluZ0NsaWVudFJlY3Qobm9kZSkge1xuICB2YXIgYm91bmRpbmdSZWN0ID0gbm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAvLyBUaGUgb3JpZ2luYWwgb2JqZWN0IHJldHVybmVkIGJ5IGdldEJvdW5kaW5nQ2xpZW50UmVjdCBpcyBpbW11dGFibGUsIHNvIHdlIGNsb25lIGl0XG4gIC8vIFdlIGNhbid0IHVzZSBleHRlbmQgYmVjYXVzZSB0aGUgcHJvcGVydGllcyBhcmUgbm90IGNvbnNpZGVyZWQgcGFydCBvZiB0aGUgb2JqZWN0IGJ5IGhhc093blByb3BlcnR5IGluIElFOVxuICB2YXIgcmVjdCA9IHt9O1xuICBmb3IgKHZhciBrIGluIGJvdW5kaW5nUmVjdCkge1xuICAgIHJlY3Rba10gPSBib3VuZGluZ1JlY3Rba107XG4gIH1cblxuICBpZiAobm9kZS5vd25lckRvY3VtZW50ICE9PSBkb2N1bWVudCkge1xuICAgIHZhciBfZnJhbWVFbGVtZW50ID0gbm9kZS5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LmZyYW1lRWxlbWVudDtcbiAgICBpZiAoX2ZyYW1lRWxlbWVudCkge1xuICAgICAgdmFyIGZyYW1lUmVjdCA9IGdldEFjdHVhbEJvdW5kaW5nQ2xpZW50UmVjdChfZnJhbWVFbGVtZW50KTtcbiAgICAgIHJlY3QudG9wICs9IGZyYW1lUmVjdC50b3A7XG4gICAgICByZWN0LmJvdHRvbSArPSBmcmFtZVJlY3QudG9wO1xuICAgICAgcmVjdC5sZWZ0ICs9IGZyYW1lUmVjdC5sZWZ0O1xuICAgICAgcmVjdC5yaWdodCArPSBmcmFtZVJlY3QubGVmdDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVjdDtcbn1cblxuZnVuY3Rpb24gZ2V0U2Nyb2xsUGFyZW50cyhlbCkge1xuICAvLyBJbiBmaXJlZm94IGlmIHRoZSBlbCBpcyBpbnNpZGUgYW4gaWZyYW1lIHdpdGggZGlzcGxheTogbm9uZTsgd2luZG93LmdldENvbXB1dGVkU3R5bGUoKSB3aWxsIHJldHVybiBudWxsO1xuICAvLyBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD01NDgzOTdcbiAgdmFyIGNvbXB1dGVkU3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKGVsKSB8fCB7fTtcbiAgdmFyIHBvc2l0aW9uID0gY29tcHV0ZWRTdHlsZS5wb3NpdGlvbjtcbiAgdmFyIHBhcmVudHMgPSBbXTtcblxuICBpZiAocG9zaXRpb24gPT09ICdmaXhlZCcpIHtcbiAgICByZXR1cm4gW2VsXTtcbiAgfVxuXG4gIHZhciBwYXJlbnQgPSBlbDtcbiAgd2hpbGUgKChwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZSkgJiYgcGFyZW50ICYmIHBhcmVudC5ub2RlVHlwZSA9PT0gMSkge1xuICAgIHZhciBzdHlsZSA9IHVuZGVmaW5lZDtcbiAgICB0cnkge1xuICAgICAgc3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKHBhcmVudCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7fVxuXG4gICAgaWYgKHR5cGVvZiBzdHlsZSA9PT0gJ3VuZGVmaW5lZCcgfHwgc3R5bGUgPT09IG51bGwpIHtcbiAgICAgIHBhcmVudHMucHVzaChwYXJlbnQpO1xuICAgICAgcmV0dXJuIHBhcmVudHM7XG4gICAgfVxuXG4gICAgdmFyIF9zdHlsZSA9IHN0eWxlO1xuICAgIHZhciBvdmVyZmxvdyA9IF9zdHlsZS5vdmVyZmxvdztcbiAgICB2YXIgb3ZlcmZsb3dYID0gX3N0eWxlLm92ZXJmbG93WDtcbiAgICB2YXIgb3ZlcmZsb3dZID0gX3N0eWxlLm92ZXJmbG93WTtcblxuICAgIGlmICgvKGF1dG98c2Nyb2xsKS8udGVzdChvdmVyZmxvdyArIG92ZXJmbG93WSArIG92ZXJmbG93WCkpIHtcbiAgICAgIGlmIChwb3NpdGlvbiAhPT0gJ2Fic29sdXRlJyB8fCBbJ3JlbGF0aXZlJywgJ2Fic29sdXRlJywgJ2ZpeGVkJ10uaW5kZXhPZihzdHlsZS5wb3NpdGlvbikgPj0gMCkge1xuICAgICAgICBwYXJlbnRzLnB1c2gocGFyZW50KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJlbnRzLnB1c2goZWwub3duZXJEb2N1bWVudC5ib2R5KTtcblxuICAvLyBJZiB0aGUgbm9kZSBpcyB3aXRoaW4gYSBmcmFtZSwgYWNjb3VudCBmb3IgdGhlIHBhcmVudCB3aW5kb3cgc2Nyb2xsXG4gIGlmIChlbC5vd25lckRvY3VtZW50ICE9PSBkb2N1bWVudCkge1xuICAgIHBhcmVudHMucHVzaChlbC5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3KTtcbiAgfVxuXG4gIHJldHVybiBwYXJlbnRzO1xufVxuXG52YXIgdW5pcXVlSWQgPSAoZnVuY3Rpb24gKCkge1xuICB2YXIgaWQgPSAwO1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiArK2lkO1xuICB9O1xufSkoKTtcblxudmFyIHplcm9Qb3NDYWNoZSA9IHt9O1xudmFyIGdldE9yaWdpbiA9IGZ1bmN0aW9uIGdldE9yaWdpbigpIHtcbiAgLy8gZ2V0Qm91bmRpbmdDbGllbnRSZWN0IGlzIHVuZm9ydHVuYXRlbHkgdG9vIGFjY3VyYXRlLiAgSXQgaW50cm9kdWNlcyBhIHBpeGVsIG9yIHR3byBvZlxuICAvLyBqaXR0ZXIgYXMgdGhlIHVzZXIgc2Nyb2xscyB0aGF0IG1lc3NlcyB3aXRoIG91ciBhYmlsaXR5IHRvIGRldGVjdCBpZiB0d28gcG9zaXRpb25zXG4gIC8vIGFyZSBlcXVpdmlsYW50IG9yIG5vdC4gIFdlIHBsYWNlIGFuIGVsZW1lbnQgYXQgdGhlIHRvcCBsZWZ0IG9mIHRoZSBwYWdlIHRoYXQgd2lsbFxuICAvLyBnZXQgdGhlIHNhbWUgaml0dGVyLCBzbyB3ZSBjYW4gY2FuY2VsIHRoZSB0d28gb3V0LlxuICB2YXIgbm9kZSA9IHplcm9FbGVtZW50O1xuICBpZiAoIW5vZGUgfHwgIWRvY3VtZW50LmJvZHkuY29udGFpbnMobm9kZSkpIHtcbiAgICBub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgbm9kZS5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGV0aGVyLWlkJywgdW5pcXVlSWQoKSk7XG4gICAgZXh0ZW5kKG5vZGUuc3R5bGUsIHtcbiAgICAgIHRvcDogMCxcbiAgICAgIGxlZnQ6IDAsXG4gICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJ1xuICAgIH0pO1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub2RlKTtcblxuICAgIHplcm9FbGVtZW50ID0gbm9kZTtcbiAgfVxuXG4gIHZhciBpZCA9IG5vZGUuZ2V0QXR0cmlidXRlKCdkYXRhLXRldGhlci1pZCcpO1xuICBpZiAodHlwZW9mIHplcm9Qb3NDYWNoZVtpZF0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgemVyb1Bvc0NhY2hlW2lkXSA9IGdldEFjdHVhbEJvdW5kaW5nQ2xpZW50UmVjdChub2RlKTtcblxuICAgIC8vIENsZWFyIHRoZSBjYWNoZSB3aGVuIHRoaXMgcG9zaXRpb24gY2FsbCBpcyBkb25lXG4gICAgZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgZGVsZXRlIHplcm9Qb3NDYWNoZVtpZF07XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gemVyb1Bvc0NhY2hlW2lkXTtcbn07XG5cbmZ1bmN0aW9uIHJlbW92ZVV0aWxFbGVtZW50cygpIHtcbiAgaWYgKHplcm9FbGVtZW50KSB7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh6ZXJvRWxlbWVudCk7XG4gIH1cbiAgemVyb0VsZW1lbnQgPSBudWxsO1xufTtcblxuZnVuY3Rpb24gZ2V0Qm91bmRzKGVsKSB7XG4gIHZhciBkb2MgPSB1bmRlZmluZWQ7XG4gIGlmIChlbCA9PT0gZG9jdW1lbnQpIHtcbiAgICBkb2MgPSBkb2N1bWVudDtcbiAgICBlbCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcbiAgfSBlbHNlIHtcbiAgICBkb2MgPSBlbC5vd25lckRvY3VtZW50O1xuICB9XG5cbiAgdmFyIGRvY0VsID0gZG9jLmRvY3VtZW50RWxlbWVudDtcblxuICB2YXIgYm94ID0gZ2V0QWN0dWFsQm91bmRpbmdDbGllbnRSZWN0KGVsKTtcblxuICB2YXIgb3JpZ2luID0gZ2V0T3JpZ2luKCk7XG5cbiAgYm94LnRvcCAtPSBvcmlnaW4udG9wO1xuICBib3gubGVmdCAtPSBvcmlnaW4ubGVmdDtcblxuICBpZiAodHlwZW9mIGJveC53aWR0aCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBib3gud2lkdGggPSBkb2N1bWVudC5ib2R5LnNjcm9sbFdpZHRoIC0gYm94LmxlZnQgLSBib3gucmlnaHQ7XG4gIH1cbiAgaWYgKHR5cGVvZiBib3guaGVpZ2h0ID09PSAndW5kZWZpbmVkJykge1xuICAgIGJveC5oZWlnaHQgPSBkb2N1bWVudC5ib2R5LnNjcm9sbEhlaWdodCAtIGJveC50b3AgLSBib3guYm90dG9tO1xuICB9XG5cbiAgYm94LnRvcCA9IGJveC50b3AgLSBkb2NFbC5jbGllbnRUb3A7XG4gIGJveC5sZWZ0ID0gYm94LmxlZnQgLSBkb2NFbC5jbGllbnRMZWZ0O1xuICBib3gucmlnaHQgPSBkb2MuYm9keS5jbGllbnRXaWR0aCAtIGJveC53aWR0aCAtIGJveC5sZWZ0O1xuICBib3guYm90dG9tID0gZG9jLmJvZHkuY2xpZW50SGVpZ2h0IC0gYm94LmhlaWdodCAtIGJveC50b3A7XG5cbiAgcmV0dXJuIGJveDtcbn1cblxuZnVuY3Rpb24gZ2V0T2Zmc2V0UGFyZW50KGVsKSB7XG4gIHJldHVybiBlbC5vZmZzZXRQYXJlbnQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xufVxuXG52YXIgX3Njcm9sbEJhclNpemUgPSBudWxsO1xuZnVuY3Rpb24gZ2V0U2Nyb2xsQmFyU2l6ZSgpIHtcbiAgaWYgKF9zY3JvbGxCYXJTaXplKSB7XG4gICAgcmV0dXJuIF9zY3JvbGxCYXJTaXplO1xuICB9XG4gIHZhciBpbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBpbm5lci5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgaW5uZXIuc3R5bGUuaGVpZ2h0ID0gJzIwMHB4JztcblxuICB2YXIgb3V0ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgZXh0ZW5kKG91dGVyLnN0eWxlLCB7XG4gICAgcG9zaXRpb246ICdhYnNvbHV0ZScsXG4gICAgdG9wOiAwLFxuICAgIGxlZnQ6IDAsXG4gICAgcG9pbnRlckV2ZW50czogJ25vbmUnLFxuICAgIHZpc2liaWxpdHk6ICdoaWRkZW4nLFxuICAgIHdpZHRoOiAnMjAwcHgnLFxuICAgIGhlaWdodDogJzE1MHB4JyxcbiAgICBvdmVyZmxvdzogJ2hpZGRlbidcbiAgfSk7XG5cbiAgb3V0ZXIuYXBwZW5kQ2hpbGQoaW5uZXIpO1xuXG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQob3V0ZXIpO1xuXG4gIHZhciB3aWR0aENvbnRhaW5lZCA9IGlubmVyLm9mZnNldFdpZHRoO1xuICBvdXRlci5zdHlsZS5vdmVyZmxvdyA9ICdzY3JvbGwnO1xuICB2YXIgd2lkdGhTY3JvbGwgPSBpbm5lci5vZmZzZXRXaWR0aDtcblxuICBpZiAod2lkdGhDb250YWluZWQgPT09IHdpZHRoU2Nyb2xsKSB7XG4gICAgd2lkdGhTY3JvbGwgPSBvdXRlci5jbGllbnRXaWR0aDtcbiAgfVxuXG4gIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQob3V0ZXIpO1xuXG4gIHZhciB3aWR0aCA9IHdpZHRoQ29udGFpbmVkIC0gd2lkdGhTY3JvbGw7XG5cbiAgX3Njcm9sbEJhclNpemUgPSB7IHdpZHRoOiB3aWR0aCwgaGVpZ2h0OiB3aWR0aCB9O1xuICByZXR1cm4gX3Njcm9sbEJhclNpemU7XG59XG5cbmZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgdmFyIG91dCA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzBdO1xuXG4gIHZhciBhcmdzID0gW107XG5cbiAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkoYXJncywgYXJndW1lbnRzKTtcblxuICBhcmdzLnNsaWNlKDEpLmZvckVhY2goZnVuY3Rpb24gKG9iaikge1xuICAgIGlmIChvYmopIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgaWYgKCh7fSkuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAgICBvdXRba2V5XSA9IG9ialtrZXldO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiByZW1vdmVDbGFzcyhlbCwgbmFtZSkge1xuICBpZiAodHlwZW9mIGVsLmNsYXNzTGlzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBuYW1lLnNwbGl0KCcgJykuZm9yRWFjaChmdW5jdGlvbiAoY2xzKSB7XG4gICAgICBpZiAoY2xzLnRyaW0oKSkge1xuICAgICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKGNscyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIHJlZ2V4ID0gbmV3IFJlZ0V4cCgnKF58ICknICsgbmFtZS5zcGxpdCgnICcpLmpvaW4oJ3wnKSArICcoIHwkKScsICdnaScpO1xuICAgIHZhciBjbGFzc05hbWUgPSBnZXRDbGFzc05hbWUoZWwpLnJlcGxhY2UocmVnZXgsICcgJyk7XG4gICAgc2V0Q2xhc3NOYW1lKGVsLCBjbGFzc05hbWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFkZENsYXNzKGVsLCBuYW1lKSB7XG4gIGlmICh0eXBlb2YgZWwuY2xhc3NMaXN0ICE9PSAndW5kZWZpbmVkJykge1xuICAgIG5hbWUuc3BsaXQoJyAnKS5mb3JFYWNoKGZ1bmN0aW9uIChjbHMpIHtcbiAgICAgIGlmIChjbHMudHJpbSgpKSB7XG4gICAgICAgIGVsLmNsYXNzTGlzdC5hZGQoY2xzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICByZW1vdmVDbGFzcyhlbCwgbmFtZSk7XG4gICAgdmFyIGNscyA9IGdldENsYXNzTmFtZShlbCkgKyAoJyAnICsgbmFtZSk7XG4gICAgc2V0Q2xhc3NOYW1lKGVsLCBjbHMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhc0NsYXNzKGVsLCBuYW1lKSB7XG4gIGlmICh0eXBlb2YgZWwuY2xhc3NMaXN0ICE9PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBlbC5jbGFzc0xpc3QuY29udGFpbnMobmFtZSk7XG4gIH1cbiAgdmFyIGNsYXNzTmFtZSA9IGdldENsYXNzTmFtZShlbCk7XG4gIHJldHVybiBuZXcgUmVnRXhwKCcoXnwgKScgKyBuYW1lICsgJyggfCQpJywgJ2dpJykudGVzdChjbGFzc05hbWUpO1xufVxuXG5mdW5jdGlvbiBnZXRDbGFzc05hbWUoZWwpIHtcbiAgLy8gQ2FuJ3QgdXNlIGp1c3QgU1ZHQW5pbWF0ZWRTdHJpbmcgaGVyZSBzaW5jZSBub2RlcyB3aXRoaW4gYSBGcmFtZSBpbiBJRSBoYXZlXG4gIC8vIGNvbXBsZXRlbHkgc2VwYXJhdGVseSBTVkdBbmltYXRlZFN0cmluZyBiYXNlIGNsYXNzZXNcbiAgaWYgKGVsLmNsYXNzTmFtZSBpbnN0YW5jZW9mIGVsLm93bmVyRG9jdW1lbnQuZGVmYXVsdFZpZXcuU1ZHQW5pbWF0ZWRTdHJpbmcpIHtcbiAgICByZXR1cm4gZWwuY2xhc3NOYW1lLmJhc2VWYWw7XG4gIH1cbiAgcmV0dXJuIGVsLmNsYXNzTmFtZTtcbn1cblxuZnVuY3Rpb24gc2V0Q2xhc3NOYW1lKGVsLCBjbGFzc05hbWUpIHtcbiAgZWwuc2V0QXR0cmlidXRlKCdjbGFzcycsIGNsYXNzTmFtZSk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUNsYXNzZXMoZWwsIGFkZCwgYWxsKSB7XG4gIC8vIE9mIHRoZSBzZXQgb2YgJ2FsbCcgY2xhc3Nlcywgd2UgbmVlZCB0aGUgJ2FkZCcgY2xhc3NlcywgYW5kIG9ubHkgdGhlXG4gIC8vICdhZGQnIGNsYXNzZXMgdG8gYmUgc2V0LlxuICBhbGwuZm9yRWFjaChmdW5jdGlvbiAoY2xzKSB7XG4gICAgaWYgKGFkZC5pbmRleE9mKGNscykgPT09IC0xICYmIGhhc0NsYXNzKGVsLCBjbHMpKSB7XG4gICAgICByZW1vdmVDbGFzcyhlbCwgY2xzKTtcbiAgICB9XG4gIH0pO1xuXG4gIGFkZC5mb3JFYWNoKGZ1bmN0aW9uIChjbHMpIHtcbiAgICBpZiAoIWhhc0NsYXNzKGVsLCBjbHMpKSB7XG4gICAgICBhZGRDbGFzcyhlbCwgY2xzKTtcbiAgICB9XG4gIH0pO1xufVxuXG52YXIgZGVmZXJyZWQgPSBbXTtcblxudmFyIGRlZmVyID0gZnVuY3Rpb24gZGVmZXIoZm4pIHtcbiAgZGVmZXJyZWQucHVzaChmbik7XG59O1xuXG52YXIgZmx1c2ggPSBmdW5jdGlvbiBmbHVzaCgpIHtcbiAgdmFyIGZuID0gdW5kZWZpbmVkO1xuICB3aGlsZSAoZm4gPSBkZWZlcnJlZC5wb3AoKSkge1xuICAgIGZuKCk7XG4gIH1cbn07XG5cbnZhciBFdmVudGVkID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gRXZlbnRlZCgpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgRXZlbnRlZCk7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoRXZlbnRlZCwgW3tcbiAgICBrZXk6ICdvbicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIG9uKGV2ZW50LCBoYW5kbGVyLCBjdHgpIHtcbiAgICAgIHZhciBvbmNlID0gYXJndW1lbnRzLmxlbmd0aCA8PSAzIHx8IGFyZ3VtZW50c1szXSA9PT0gdW5kZWZpbmVkID8gZmFsc2UgOiBhcmd1bWVudHNbM107XG5cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5iaW5kaW5ncyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhpcy5iaW5kaW5ncyA9IHt9O1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiB0aGlzLmJpbmRpbmdzW2V2ZW50XSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhpcy5iaW5kaW5nc1tldmVudF0gPSBbXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYmluZGluZ3NbZXZlbnRdLnB1c2goeyBoYW5kbGVyOiBoYW5kbGVyLCBjdHg6IGN0eCwgb25jZTogb25jZSB9KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdvbmNlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gb25jZShldmVudCwgaGFuZGxlciwgY3R4KSB7XG4gICAgICB0aGlzLm9uKGV2ZW50LCBoYW5kbGVyLCBjdHgsIHRydWUpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ29mZicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIG9mZihldmVudCwgaGFuZGxlcikge1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLmJpbmRpbmdzID09PSAndW5kZWZpbmVkJyB8fCB0eXBlb2YgdGhpcy5iaW5kaW5nc1tldmVudF0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICBkZWxldGUgdGhpcy5iaW5kaW5nc1tldmVudF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgIHdoaWxlIChpIDwgdGhpcy5iaW5kaW5nc1tldmVudF0ubGVuZ3RoKSB7XG4gICAgICAgICAgaWYgKHRoaXMuYmluZGluZ3NbZXZlbnRdW2ldLmhhbmRsZXIgPT09IGhhbmRsZXIpIHtcbiAgICAgICAgICAgIHRoaXMuYmluZGluZ3NbZXZlbnRdLnNwbGljZShpLCAxKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgKytpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3RyaWdnZXInLFxuICAgIHZhbHVlOiBmdW5jdGlvbiB0cmlnZ2VyKGV2ZW50KSB7XG4gICAgICBpZiAodHlwZW9mIHRoaXMuYmluZGluZ3MgIT09ICd1bmRlZmluZWQnICYmIHRoaXMuYmluZGluZ3NbZXZlbnRdKSB7XG4gICAgICAgIHZhciBpID0gMDtcblxuICAgICAgICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IEFycmF5KF9sZW4gPiAxID8gX2xlbiAtIDEgOiAwKSwgX2tleSA9IDE7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICAgICAgICBhcmdzW19rZXkgLSAxXSA9IGFyZ3VtZW50c1tfa2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIHdoaWxlIChpIDwgdGhpcy5iaW5kaW5nc1tldmVudF0ubGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIF9iaW5kaW5ncyRldmVudCRpID0gdGhpcy5iaW5kaW5nc1tldmVudF1baV07XG4gICAgICAgICAgdmFyIGhhbmRsZXIgPSBfYmluZGluZ3MkZXZlbnQkaS5oYW5kbGVyO1xuICAgICAgICAgIHZhciBjdHggPSBfYmluZGluZ3MkZXZlbnQkaS5jdHg7XG4gICAgICAgICAgdmFyIG9uY2UgPSBfYmluZGluZ3MkZXZlbnQkaS5vbmNlO1xuXG4gICAgICAgICAgdmFyIGNvbnRleHQgPSBjdHg7XG4gICAgICAgICAgaWYgKHR5cGVvZiBjb250ZXh0ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaGFuZGxlci5hcHBseShjb250ZXh0LCBhcmdzKTtcblxuICAgICAgICAgIGlmIChvbmNlKSB7XG4gICAgICAgICAgICB0aGlzLmJpbmRpbmdzW2V2ZW50XS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICsraTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gRXZlbnRlZDtcbn0pKCk7XG5cblRldGhlckJhc2UuVXRpbHMgPSB7XG4gIGdldEFjdHVhbEJvdW5kaW5nQ2xpZW50UmVjdDogZ2V0QWN0dWFsQm91bmRpbmdDbGllbnRSZWN0LFxuICBnZXRTY3JvbGxQYXJlbnRzOiBnZXRTY3JvbGxQYXJlbnRzLFxuICBnZXRCb3VuZHM6IGdldEJvdW5kcyxcbiAgZ2V0T2Zmc2V0UGFyZW50OiBnZXRPZmZzZXRQYXJlbnQsXG4gIGV4dGVuZDogZXh0ZW5kLFxuICBhZGRDbGFzczogYWRkQ2xhc3MsXG4gIHJlbW92ZUNsYXNzOiByZW1vdmVDbGFzcyxcbiAgaGFzQ2xhc3M6IGhhc0NsYXNzLFxuICB1cGRhdGVDbGFzc2VzOiB1cGRhdGVDbGFzc2VzLFxuICBkZWZlcjogZGVmZXIsXG4gIGZsdXNoOiBmbHVzaCxcbiAgdW5pcXVlSWQ6IHVuaXF1ZUlkLFxuICBFdmVudGVkOiBFdmVudGVkLFxuICBnZXRTY3JvbGxCYXJTaXplOiBnZXRTY3JvbGxCYXJTaXplLFxuICByZW1vdmVVdGlsRWxlbWVudHM6IHJlbW92ZVV0aWxFbGVtZW50c1xufTtcbi8qIGdsb2JhbHMgVGV0aGVyQmFzZSwgcGVyZm9ybWFuY2UgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3NsaWNlZFRvQXJyYXkgPSAoZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBzbGljZUl0ZXJhdG9yKGFyciwgaSkgeyB2YXIgX2FyciA9IFtdOyB2YXIgX24gPSB0cnVlOyB2YXIgX2QgPSBmYWxzZTsgdmFyIF9lID0gdW5kZWZpbmVkOyB0cnkgeyBmb3IgKHZhciBfaSA9IGFycltTeW1ib2wuaXRlcmF0b3JdKCksIF9zOyAhKF9uID0gKF9zID0gX2kubmV4dCgpKS5kb25lKTsgX24gPSB0cnVlKSB7IF9hcnIucHVzaChfcy52YWx1ZSk7IGlmIChpICYmIF9hcnIubGVuZ3RoID09PSBpKSBicmVhazsgfSB9IGNhdGNoIChlcnIpIHsgX2QgPSB0cnVlOyBfZSA9IGVycjsgfSBmaW5hbGx5IHsgdHJ5IHsgaWYgKCFfbiAmJiBfaVsncmV0dXJuJ10pIF9pWydyZXR1cm4nXSgpOyB9IGZpbmFsbHkgeyBpZiAoX2QpIHRocm93IF9lOyB9IH0gcmV0dXJuIF9hcnI7IH0gcmV0dXJuIGZ1bmN0aW9uIChhcnIsIGkpIHsgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkgeyByZXR1cm4gYXJyOyB9IGVsc2UgaWYgKFN5bWJvbC5pdGVyYXRvciBpbiBPYmplY3QoYXJyKSkgeyByZXR1cm4gc2xpY2VJdGVyYXRvcihhcnIsIGkpOyB9IGVsc2UgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlJyk7IH0gfTsgfSkoKTtcblxudmFyIF9jcmVhdGVDbGFzcyA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSkoKTtcblxudmFyIF9nZXQgPSBmdW5jdGlvbiBnZXQoX3g2LCBfeDcsIF94OCkgeyB2YXIgX2FnYWluID0gdHJ1ZTsgX2Z1bmN0aW9uOiB3aGlsZSAoX2FnYWluKSB7IHZhciBvYmplY3QgPSBfeDYsIHByb3BlcnR5ID0gX3g3LCByZWNlaXZlciA9IF94ODsgX2FnYWluID0gZmFsc2U7IGlmIChvYmplY3QgPT09IG51bGwpIG9iamVjdCA9IEZ1bmN0aW9uLnByb3RvdHlwZTsgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iamVjdCwgcHJvcGVydHkpOyBpZiAoZGVzYyA9PT0gdW5kZWZpbmVkKSB7IHZhciBwYXJlbnQgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqZWN0KTsgaWYgKHBhcmVudCA9PT0gbnVsbCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9IGVsc2UgeyBfeDYgPSBwYXJlbnQ7IF94NyA9IHByb3BlcnR5OyBfeDggPSByZWNlaXZlcjsgX2FnYWluID0gdHJ1ZTsgZGVzYyA9IHBhcmVudCA9IHVuZGVmaW5lZDsgY29udGludWUgX2Z1bmN0aW9uOyB9IH0gZWxzZSBpZiAoJ3ZhbHVlJyBpbiBkZXNjKSB7IHJldHVybiBkZXNjLnZhbHVlOyB9IGVsc2UgeyB2YXIgZ2V0dGVyID0gZGVzYy5nZXQ7IGlmIChnZXR0ZXIgPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9IHJldHVybiBnZXR0ZXIuY2FsbChyZWNlaXZlcik7IH0gfSB9O1xuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxuZnVuY3Rpb24gX2luaGVyaXRzKHN1YkNsYXNzLCBzdXBlckNsYXNzKSB7IGlmICh0eXBlb2Ygc3VwZXJDbGFzcyAhPT0gJ2Z1bmN0aW9uJyAmJiBzdXBlckNsYXNzICE9PSBudWxsKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ1N1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgJyArIHR5cGVvZiBzdXBlckNsYXNzKTsgfSBzdWJDbGFzcy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ2xhc3MgJiYgc3VwZXJDbGFzcy5wcm90b3R5cGUsIHsgY29uc3RydWN0b3I6IHsgdmFsdWU6IHN1YkNsYXNzLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9IH0pOyBpZiAoc3VwZXJDbGFzcykgT2JqZWN0LnNldFByb3RvdHlwZU9mID8gT2JqZWN0LnNldFByb3RvdHlwZU9mKHN1YkNsYXNzLCBzdXBlckNsYXNzKSA6IHN1YkNsYXNzLl9fcHJvdG9fXyA9IHN1cGVyQ2xhc3M7IH1cblxuaWYgKHR5cGVvZiBUZXRoZXJCYXNlID09PSAndW5kZWZpbmVkJykge1xuICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IGluY2x1ZGUgdGhlIHV0aWxzLmpzIGZpbGUgYmVmb3JlIHRldGhlci5qcycpO1xufVxuXG52YXIgX1RldGhlckJhc2UkVXRpbHMgPSBUZXRoZXJCYXNlLlV0aWxzO1xudmFyIGdldFNjcm9sbFBhcmVudHMgPSBfVGV0aGVyQmFzZSRVdGlscy5nZXRTY3JvbGxQYXJlbnRzO1xudmFyIGdldEJvdW5kcyA9IF9UZXRoZXJCYXNlJFV0aWxzLmdldEJvdW5kcztcbnZhciBnZXRPZmZzZXRQYXJlbnQgPSBfVGV0aGVyQmFzZSRVdGlscy5nZXRPZmZzZXRQYXJlbnQ7XG52YXIgZXh0ZW5kID0gX1RldGhlckJhc2UkVXRpbHMuZXh0ZW5kO1xudmFyIGFkZENsYXNzID0gX1RldGhlckJhc2UkVXRpbHMuYWRkQ2xhc3M7XG52YXIgcmVtb3ZlQ2xhc3MgPSBfVGV0aGVyQmFzZSRVdGlscy5yZW1vdmVDbGFzcztcbnZhciB1cGRhdGVDbGFzc2VzID0gX1RldGhlckJhc2UkVXRpbHMudXBkYXRlQ2xhc3NlcztcbnZhciBkZWZlciA9IF9UZXRoZXJCYXNlJFV0aWxzLmRlZmVyO1xudmFyIGZsdXNoID0gX1RldGhlckJhc2UkVXRpbHMuZmx1c2g7XG52YXIgZ2V0U2Nyb2xsQmFyU2l6ZSA9IF9UZXRoZXJCYXNlJFV0aWxzLmdldFNjcm9sbEJhclNpemU7XG52YXIgcmVtb3ZlVXRpbEVsZW1lbnRzID0gX1RldGhlckJhc2UkVXRpbHMucmVtb3ZlVXRpbEVsZW1lbnRzO1xuXG5mdW5jdGlvbiB3aXRoaW4oYSwgYikge1xuICB2YXIgZGlmZiA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMiB8fCBhcmd1bWVudHNbMl0gPT09IHVuZGVmaW5lZCA/IDEgOiBhcmd1bWVudHNbMl07XG5cbiAgcmV0dXJuIGEgKyBkaWZmID49IGIgJiYgYiA+PSBhIC0gZGlmZjtcbn1cblxudmFyIHRyYW5zZm9ybUtleSA9IChmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gIHZhciB0cmFuc2Zvcm1zID0gWyd0cmFuc2Zvcm0nLCAnV2Via2l0VHJhbnNmb3JtJywgJ09UcmFuc2Zvcm0nLCAnTW96VHJhbnNmb3JtJywgJ21zVHJhbnNmb3JtJ107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdHJhbnNmb3Jtcy5sZW5ndGg7ICsraSkge1xuICAgIHZhciBrZXkgPSB0cmFuc2Zvcm1zW2ldO1xuICAgIGlmIChlbC5zdHlsZVtrZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBrZXk7XG4gICAgfVxuICB9XG59KSgpO1xuXG52YXIgdGV0aGVycyA9IFtdO1xuXG52YXIgcG9zaXRpb24gPSBmdW5jdGlvbiBwb3NpdGlvbigpIHtcbiAgdGV0aGVycy5mb3JFYWNoKGZ1bmN0aW9uICh0ZXRoZXIpIHtcbiAgICB0ZXRoZXIucG9zaXRpb24oZmFsc2UpO1xuICB9KTtcbiAgZmx1c2goKTtcbn07XG5cbmZ1bmN0aW9uIG5vdygpIHtcbiAgaWYgKHR5cGVvZiBwZXJmb3JtYW5jZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHBlcmZvcm1hbmNlLm5vdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gcGVyZm9ybWFuY2Uubm93KCk7XG4gIH1cbiAgcmV0dXJuICtuZXcgRGF0ZSgpO1xufVxuXG4oZnVuY3Rpb24gKCkge1xuICB2YXIgbGFzdENhbGwgPSBudWxsO1xuICB2YXIgbGFzdER1cmF0aW9uID0gbnVsbDtcbiAgdmFyIHBlbmRpbmdUaW1lb3V0ID0gbnVsbDtcblxuICB2YXIgdGljayA9IGZ1bmN0aW9uIHRpY2soKSB7XG4gICAgaWYgKHR5cGVvZiBsYXN0RHVyYXRpb24gIT09ICd1bmRlZmluZWQnICYmIGxhc3REdXJhdGlvbiA+IDE2KSB7XG4gICAgICAvLyBXZSB2b2x1bnRhcmlseSB0aHJvdHRsZSBvdXJzZWx2ZXMgaWYgd2UgY2FuJ3QgbWFuYWdlIDYwZnBzXG4gICAgICBsYXN0RHVyYXRpb24gPSBNYXRoLm1pbihsYXN0RHVyYXRpb24gLSAxNiwgMjUwKTtcblxuICAgICAgLy8gSnVzdCBpbiBjYXNlIHRoaXMgaXMgdGhlIGxhc3QgZXZlbnQsIHJlbWVtYmVyIHRvIHBvc2l0aW9uIGp1c3Qgb25jZSBtb3JlXG4gICAgICBwZW5kaW5nVGltZW91dCA9IHNldFRpbWVvdXQodGljaywgMjUwKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGxhc3RDYWxsICE9PSAndW5kZWZpbmVkJyAmJiBub3coKSAtIGxhc3RDYWxsIDwgMTApIHtcbiAgICAgIC8vIFNvbWUgYnJvd3NlcnMgY2FsbCBldmVudHMgYSBsaXR0bGUgdG9vIGZyZXF1ZW50bHksIHJlZnVzZSB0byBydW4gbW9yZSB0aGFuIGlzIHJlYXNvbmFibGVcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocGVuZGluZ1RpbWVvdXQgIT0gbnVsbCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHBlbmRpbmdUaW1lb3V0KTtcbiAgICAgIHBlbmRpbmdUaW1lb3V0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBsYXN0Q2FsbCA9IG5vdygpO1xuICAgIHBvc2l0aW9uKCk7XG4gICAgbGFzdER1cmF0aW9uID0gbm93KCkgLSBsYXN0Q2FsbDtcbiAgfTtcblxuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgIFsncmVzaXplJywgJ3Njcm9sbCcsICd0b3VjaG1vdmUnXS5mb3JFYWNoKGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIHRpY2spO1xuICAgIH0pO1xuICB9XG59KSgpO1xuXG52YXIgTUlSUk9SX0xSID0ge1xuICBjZW50ZXI6ICdjZW50ZXInLFxuICBsZWZ0OiAncmlnaHQnLFxuICByaWdodDogJ2xlZnQnXG59O1xuXG52YXIgTUlSUk9SX1RCID0ge1xuICBtaWRkbGU6ICdtaWRkbGUnLFxuICB0b3A6ICdib3R0b20nLFxuICBib3R0b206ICd0b3AnXG59O1xuXG52YXIgT0ZGU0VUX01BUCA9IHtcbiAgdG9wOiAwLFxuICBsZWZ0OiAwLFxuICBtaWRkbGU6ICc1MCUnLFxuICBjZW50ZXI6ICc1MCUnLFxuICBib3R0b206ICcxMDAlJyxcbiAgcmlnaHQ6ICcxMDAlJ1xufTtcblxudmFyIGF1dG9Ub0ZpeGVkQXR0YWNobWVudCA9IGZ1bmN0aW9uIGF1dG9Ub0ZpeGVkQXR0YWNobWVudChhdHRhY2htZW50LCByZWxhdGl2ZVRvQXR0YWNobWVudCkge1xuICB2YXIgbGVmdCA9IGF0dGFjaG1lbnQubGVmdDtcbiAgdmFyIHRvcCA9IGF0dGFjaG1lbnQudG9wO1xuXG4gIGlmIChsZWZ0ID09PSAnYXV0bycpIHtcbiAgICBsZWZ0ID0gTUlSUk9SX0xSW3JlbGF0aXZlVG9BdHRhY2htZW50LmxlZnRdO1xuICB9XG5cbiAgaWYgKHRvcCA9PT0gJ2F1dG8nKSB7XG4gICAgdG9wID0gTUlSUk9SX1RCW3JlbGF0aXZlVG9BdHRhY2htZW50LnRvcF07XG4gIH1cblxuICByZXR1cm4geyBsZWZ0OiBsZWZ0LCB0b3A6IHRvcCB9O1xufTtcblxudmFyIGF0dGFjaG1lbnRUb09mZnNldCA9IGZ1bmN0aW9uIGF0dGFjaG1lbnRUb09mZnNldChhdHRhY2htZW50KSB7XG4gIHZhciBsZWZ0ID0gYXR0YWNobWVudC5sZWZ0O1xuICB2YXIgdG9wID0gYXR0YWNobWVudC50b3A7XG5cbiAgaWYgKHR5cGVvZiBPRkZTRVRfTUFQW2F0dGFjaG1lbnQubGVmdF0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbGVmdCA9IE9GRlNFVF9NQVBbYXR0YWNobWVudC5sZWZ0XTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgT0ZGU0VUX01BUFthdHRhY2htZW50LnRvcF0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdG9wID0gT0ZGU0VUX01BUFthdHRhY2htZW50LnRvcF07XG4gIH1cblxuICByZXR1cm4geyBsZWZ0OiBsZWZ0LCB0b3A6IHRvcCB9O1xufTtcblxuZnVuY3Rpb24gYWRkT2Zmc2V0KCkge1xuICB2YXIgb3V0ID0geyB0b3A6IDAsIGxlZnQ6IDAgfTtcblxuICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgb2Zmc2V0cyA9IEFycmF5KF9sZW4pLCBfa2V5ID0gMDsgX2tleSA8IF9sZW47IF9rZXkrKykge1xuICAgIG9mZnNldHNbX2tleV0gPSBhcmd1bWVudHNbX2tleV07XG4gIH1cblxuICBvZmZzZXRzLmZvckVhY2goZnVuY3Rpb24gKF9yZWYpIHtcbiAgICB2YXIgdG9wID0gX3JlZi50b3A7XG4gICAgdmFyIGxlZnQgPSBfcmVmLmxlZnQ7XG5cbiAgICBpZiAodHlwZW9mIHRvcCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRvcCA9IHBhcnNlRmxvYXQodG9wLCAxMCk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgbGVmdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGxlZnQgPSBwYXJzZUZsb2F0KGxlZnQsIDEwKTtcbiAgICB9XG5cbiAgICBvdXQudG9wICs9IHRvcDtcbiAgICBvdXQubGVmdCArPSBsZWZ0O1xuICB9KTtcblxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBvZmZzZXRUb1B4KG9mZnNldCwgc2l6ZSkge1xuICBpZiAodHlwZW9mIG9mZnNldC5sZWZ0ID09PSAnc3RyaW5nJyAmJiBvZmZzZXQubGVmdC5pbmRleE9mKCclJykgIT09IC0xKSB7XG4gICAgb2Zmc2V0LmxlZnQgPSBwYXJzZUZsb2F0KG9mZnNldC5sZWZ0LCAxMCkgLyAxMDAgKiBzaXplLndpZHRoO1xuICB9XG4gIGlmICh0eXBlb2Ygb2Zmc2V0LnRvcCA9PT0gJ3N0cmluZycgJiYgb2Zmc2V0LnRvcC5pbmRleE9mKCclJykgIT09IC0xKSB7XG4gICAgb2Zmc2V0LnRvcCA9IHBhcnNlRmxvYXQob2Zmc2V0LnRvcCwgMTApIC8gMTAwICogc2l6ZS5oZWlnaHQ7XG4gIH1cblxuICByZXR1cm4gb2Zmc2V0O1xufVxuXG52YXIgcGFyc2VPZmZzZXQgPSBmdW5jdGlvbiBwYXJzZU9mZnNldCh2YWx1ZSkge1xuICB2YXIgX3ZhbHVlJHNwbGl0ID0gdmFsdWUuc3BsaXQoJyAnKTtcblxuICB2YXIgX3ZhbHVlJHNwbGl0MiA9IF9zbGljZWRUb0FycmF5KF92YWx1ZSRzcGxpdCwgMik7XG5cbiAgdmFyIHRvcCA9IF92YWx1ZSRzcGxpdDJbMF07XG4gIHZhciBsZWZ0ID0gX3ZhbHVlJHNwbGl0MlsxXTtcblxuICByZXR1cm4geyB0b3A6IHRvcCwgbGVmdDogbGVmdCB9O1xufTtcbnZhciBwYXJzZUF0dGFjaG1lbnQgPSBwYXJzZU9mZnNldDtcblxudmFyIFRldGhlckNsYXNzID0gKGZ1bmN0aW9uIChfRXZlbnRlZCkge1xuICBfaW5oZXJpdHMoVGV0aGVyQ2xhc3MsIF9FdmVudGVkKTtcblxuICBmdW5jdGlvbiBUZXRoZXJDbGFzcyhvcHRpb25zKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBUZXRoZXJDbGFzcyk7XG5cbiAgICBfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihUZXRoZXJDbGFzcy5wcm90b3R5cGUpLCAnY29uc3RydWN0b3InLCB0aGlzKS5jYWxsKHRoaXMpO1xuICAgIHRoaXMucG9zaXRpb24gPSB0aGlzLnBvc2l0aW9uLmJpbmQodGhpcyk7XG5cbiAgICB0ZXRoZXJzLnB1c2godGhpcyk7XG5cbiAgICB0aGlzLmhpc3RvcnkgPSBbXTtcblxuICAgIHRoaXMuc2V0T3B0aW9ucyhvcHRpb25zLCBmYWxzZSk7XG5cbiAgICBUZXRoZXJCYXNlLm1vZHVsZXMuZm9yRWFjaChmdW5jdGlvbiAobW9kdWxlKSB7XG4gICAgICBpZiAodHlwZW9mIG1vZHVsZS5pbml0aWFsaXplICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBtb2R1bGUuaW5pdGlhbGl6ZS5jYWxsKF90aGlzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMucG9zaXRpb24oKTtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhUZXRoZXJDbGFzcywgW3tcbiAgICBrZXk6ICdnZXRDbGFzcycsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGdldENsYXNzKCkge1xuICAgICAgdmFyIGtleSA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/ICcnIDogYXJndW1lbnRzWzBdO1xuICAgICAgdmFyIGNsYXNzZXMgPSB0aGlzLm9wdGlvbnMuY2xhc3NlcztcblxuICAgICAgaWYgKHR5cGVvZiBjbGFzc2VzICE9PSAndW5kZWZpbmVkJyAmJiBjbGFzc2VzW2tleV0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5jbGFzc2VzW2tleV07XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5jbGFzc1ByZWZpeCkge1xuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmNsYXNzUHJlZml4ICsgJy0nICsga2V5O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGtleTtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdzZXRPcHRpb25zJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2V0T3B0aW9ucyhvcHRpb25zKSB7XG4gICAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgICAgdmFyIHBvcyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMSB8fCBhcmd1bWVudHNbMV0gPT09IHVuZGVmaW5lZCA/IHRydWUgOiBhcmd1bWVudHNbMV07XG5cbiAgICAgIHZhciBkZWZhdWx0cyA9IHtcbiAgICAgICAgb2Zmc2V0OiAnMCAwJyxcbiAgICAgICAgdGFyZ2V0T2Zmc2V0OiAnMCAwJyxcbiAgICAgICAgdGFyZ2V0QXR0YWNobWVudDogJ2F1dG8gYXV0bycsXG4gICAgICAgIGNsYXNzUHJlZml4OiAndGV0aGVyJ1xuICAgICAgfTtcblxuICAgICAgdGhpcy5vcHRpb25zID0gZXh0ZW5kKGRlZmF1bHRzLCBvcHRpb25zKTtcblxuICAgICAgdmFyIF9vcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgICAgdmFyIGVsZW1lbnQgPSBfb3B0aW9ucy5lbGVtZW50O1xuICAgICAgdmFyIHRhcmdldCA9IF9vcHRpb25zLnRhcmdldDtcbiAgICAgIHZhciB0YXJnZXRNb2RpZmllciA9IF9vcHRpb25zLnRhcmdldE1vZGlmaWVyO1xuXG4gICAgICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50O1xuICAgICAgdGhpcy50YXJnZXQgPSB0YXJnZXQ7XG4gICAgICB0aGlzLnRhcmdldE1vZGlmaWVyID0gdGFyZ2V0TW9kaWZpZXI7XG5cbiAgICAgIGlmICh0aGlzLnRhcmdldCA9PT0gJ3ZpZXdwb3J0Jykge1xuICAgICAgICB0aGlzLnRhcmdldCA9IGRvY3VtZW50LmJvZHk7XG4gICAgICAgIHRoaXMudGFyZ2V0TW9kaWZpZXIgPSAndmlzaWJsZSc7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMudGFyZ2V0ID09PSAnc2Nyb2xsLWhhbmRsZScpIHtcbiAgICAgICAgdGhpcy50YXJnZXQgPSBkb2N1bWVudC5ib2R5O1xuICAgICAgICB0aGlzLnRhcmdldE1vZGlmaWVyID0gJ3Njcm9sbC1oYW5kbGUnO1xuICAgICAgfVxuXG4gICAgICBbJ2VsZW1lbnQnLCAndGFyZ2V0J10uZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIGlmICh0eXBlb2YgX3RoaXMyW2tleV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUZXRoZXIgRXJyb3I6IEJvdGggZWxlbWVudCBhbmQgdGFyZ2V0IG11c3QgYmUgZGVmaW5lZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBfdGhpczJba2V5XS5qcXVlcnkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgX3RoaXMyW2tleV0gPSBfdGhpczJba2V5XVswXTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgX3RoaXMyW2tleV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgX3RoaXMyW2tleV0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKF90aGlzMltrZXldKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGFkZENsYXNzKHRoaXMuZWxlbWVudCwgdGhpcy5nZXRDbGFzcygnZWxlbWVudCcpKTtcbiAgICAgIGlmICghKHRoaXMub3B0aW9ucy5hZGRUYXJnZXRDbGFzc2VzID09PSBmYWxzZSkpIHtcbiAgICAgICAgYWRkQ2xhc3ModGhpcy50YXJnZXQsIHRoaXMuZ2V0Q2xhc3MoJ3RhcmdldCcpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuYXR0YWNobWVudCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RldGhlciBFcnJvcjogWW91IG11c3QgcHJvdmlkZSBhbiBhdHRhY2htZW50Jyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMudGFyZ2V0QXR0YWNobWVudCA9IHBhcnNlQXR0YWNobWVudCh0aGlzLm9wdGlvbnMudGFyZ2V0QXR0YWNobWVudCk7XG4gICAgICB0aGlzLmF0dGFjaG1lbnQgPSBwYXJzZUF0dGFjaG1lbnQodGhpcy5vcHRpb25zLmF0dGFjaG1lbnQpO1xuICAgICAgdGhpcy5vZmZzZXQgPSBwYXJzZU9mZnNldCh0aGlzLm9wdGlvbnMub2Zmc2V0KTtcbiAgICAgIHRoaXMudGFyZ2V0T2Zmc2V0ID0gcGFyc2VPZmZzZXQodGhpcy5vcHRpb25zLnRhcmdldE9mZnNldCk7XG5cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5zY3JvbGxQYXJlbnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLmRpc2FibGUoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMudGFyZ2V0TW9kaWZpZXIgPT09ICdzY3JvbGwtaGFuZGxlJykge1xuICAgICAgICB0aGlzLnNjcm9sbFBhcmVudHMgPSBbdGhpcy50YXJnZXRdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zY3JvbGxQYXJlbnRzID0gZ2V0U2Nyb2xsUGFyZW50cyh0aGlzLnRhcmdldCk7XG4gICAgICB9XG5cbiAgICAgIGlmICghKHRoaXMub3B0aW9ucy5lbmFibGVkID09PSBmYWxzZSkpIHtcbiAgICAgICAgdGhpcy5lbmFibGUocG9zKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdnZXRUYXJnZXRCb3VuZHMnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRUYXJnZXRCb3VuZHMoKSB7XG4gICAgICBpZiAodHlwZW9mIHRoaXMudGFyZ2V0TW9kaWZpZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGlmICh0aGlzLnRhcmdldE1vZGlmaWVyID09PSAndmlzaWJsZScpIHtcbiAgICAgICAgICBpZiAodGhpcy50YXJnZXQgPT09IGRvY3VtZW50LmJvZHkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHRvcDogcGFnZVlPZmZzZXQsIGxlZnQ6IHBhZ2VYT2Zmc2V0LCBoZWlnaHQ6IGlubmVySGVpZ2h0LCB3aWR0aDogaW5uZXJXaWR0aCB9O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgYm91bmRzID0gZ2V0Qm91bmRzKHRoaXMudGFyZ2V0KTtcblxuICAgICAgICAgICAgdmFyIG91dCA9IHtcbiAgICAgICAgICAgICAgaGVpZ2h0OiBib3VuZHMuaGVpZ2h0LFxuICAgICAgICAgICAgICB3aWR0aDogYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgICB0b3A6IGJvdW5kcy50b3AsXG4gICAgICAgICAgICAgIGxlZnQ6IGJvdW5kcy5sZWZ0XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBvdXQuaGVpZ2h0ID0gTWF0aC5taW4ob3V0LmhlaWdodCwgYm91bmRzLmhlaWdodCAtIChwYWdlWU9mZnNldCAtIGJvdW5kcy50b3ApKTtcbiAgICAgICAgICAgIG91dC5oZWlnaHQgPSBNYXRoLm1pbihvdXQuaGVpZ2h0LCBib3VuZHMuaGVpZ2h0IC0gKGJvdW5kcy50b3AgKyBib3VuZHMuaGVpZ2h0IC0gKHBhZ2VZT2Zmc2V0ICsgaW5uZXJIZWlnaHQpKSk7XG4gICAgICAgICAgICBvdXQuaGVpZ2h0ID0gTWF0aC5taW4oaW5uZXJIZWlnaHQsIG91dC5oZWlnaHQpO1xuICAgICAgICAgICAgb3V0LmhlaWdodCAtPSAyO1xuXG4gICAgICAgICAgICBvdXQud2lkdGggPSBNYXRoLm1pbihvdXQud2lkdGgsIGJvdW5kcy53aWR0aCAtIChwYWdlWE9mZnNldCAtIGJvdW5kcy5sZWZ0KSk7XG4gICAgICAgICAgICBvdXQud2lkdGggPSBNYXRoLm1pbihvdXQud2lkdGgsIGJvdW5kcy53aWR0aCAtIChib3VuZHMubGVmdCArIGJvdW5kcy53aWR0aCAtIChwYWdlWE9mZnNldCArIGlubmVyV2lkdGgpKSk7XG4gICAgICAgICAgICBvdXQud2lkdGggPSBNYXRoLm1pbihpbm5lcldpZHRoLCBvdXQud2lkdGgpO1xuICAgICAgICAgICAgb3V0LndpZHRoIC09IDI7XG5cbiAgICAgICAgICAgIGlmIChvdXQudG9wIDwgcGFnZVlPZmZzZXQpIHtcbiAgICAgICAgICAgICAgb3V0LnRvcCA9IHBhZ2VZT2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG91dC5sZWZ0IDwgcGFnZVhPZmZzZXQpIHtcbiAgICAgICAgICAgICAgb3V0LmxlZnQgPSBwYWdlWE9mZnNldDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG91dDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy50YXJnZXRNb2RpZmllciA9PT0gJ3Njcm9sbC1oYW5kbGUnKSB7XG4gICAgICAgICAgdmFyIGJvdW5kcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB2YXIgdGFyZ2V0ID0gdGhpcy50YXJnZXQ7XG4gICAgICAgICAgaWYgKHRhcmdldCA9PT0gZG9jdW1lbnQuYm9keSkge1xuICAgICAgICAgICAgdGFyZ2V0ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xuXG4gICAgICAgICAgICBib3VuZHMgPSB7XG4gICAgICAgICAgICAgIGxlZnQ6IHBhZ2VYT2Zmc2V0LFxuICAgICAgICAgICAgICB0b3A6IHBhZ2VZT2Zmc2V0LFxuICAgICAgICAgICAgICBoZWlnaHQ6IGlubmVySGVpZ2h0LFxuICAgICAgICAgICAgICB3aWR0aDogaW5uZXJXaWR0aFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYm91bmRzID0gZ2V0Qm91bmRzKHRhcmdldCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFyIHN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZSh0YXJnZXQpO1xuXG4gICAgICAgICAgdmFyIGhhc0JvdHRvbVNjcm9sbCA9IHRhcmdldC5zY3JvbGxXaWR0aCA+IHRhcmdldC5jbGllbnRXaWR0aCB8fCBbc3R5bGUub3ZlcmZsb3csIHN0eWxlLm92ZXJmbG93WF0uaW5kZXhPZignc2Nyb2xsJykgPj0gMCB8fCB0aGlzLnRhcmdldCAhPT0gZG9jdW1lbnQuYm9keTtcblxuICAgICAgICAgIHZhciBzY3JvbGxCb3R0b20gPSAwO1xuICAgICAgICAgIGlmIChoYXNCb3R0b21TY3JvbGwpIHtcbiAgICAgICAgICAgIHNjcm9sbEJvdHRvbSA9IDE1O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBoZWlnaHQgPSBib3VuZHMuaGVpZ2h0IC0gcGFyc2VGbG9hdChzdHlsZS5ib3JkZXJUb3BXaWR0aCkgLSBwYXJzZUZsb2F0KHN0eWxlLmJvcmRlckJvdHRvbVdpZHRoKSAtIHNjcm9sbEJvdHRvbTtcblxuICAgICAgICAgIHZhciBvdXQgPSB7XG4gICAgICAgICAgICB3aWR0aDogMTUsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCAqIDAuOTc1ICogKGhlaWdodCAvIHRhcmdldC5zY3JvbGxIZWlnaHQpLFxuICAgICAgICAgICAgbGVmdDogYm91bmRzLmxlZnQgKyBib3VuZHMud2lkdGggLSBwYXJzZUZsb2F0KHN0eWxlLmJvcmRlckxlZnRXaWR0aCkgLSAxNVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICB2YXIgZml0QWRqID0gMDtcbiAgICAgICAgICBpZiAoaGVpZ2h0IDwgNDA4ICYmIHRoaXMudGFyZ2V0ID09PSBkb2N1bWVudC5ib2R5KSB7XG4gICAgICAgICAgICBmaXRBZGogPSAtMC4wMDAxMSAqIE1hdGgucG93KGhlaWdodCwgMikgLSAwLjAwNzI3ICogaGVpZ2h0ICsgMjIuNTg7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHRoaXMudGFyZ2V0ICE9PSBkb2N1bWVudC5ib2R5KSB7XG4gICAgICAgICAgICBvdXQuaGVpZ2h0ID0gTWF0aC5tYXgob3V0LmhlaWdodCwgMjQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBzY3JvbGxQZXJjZW50YWdlID0gdGhpcy50YXJnZXQuc2Nyb2xsVG9wIC8gKHRhcmdldC5zY3JvbGxIZWlnaHQgLSBoZWlnaHQpO1xuICAgICAgICAgIG91dC50b3AgPSBzY3JvbGxQZXJjZW50YWdlICogKGhlaWdodCAtIG91dC5oZWlnaHQgLSBmaXRBZGopICsgYm91bmRzLnRvcCArIHBhcnNlRmxvYXQoc3R5bGUuYm9yZGVyVG9wV2lkdGgpO1xuXG4gICAgICAgICAgaWYgKHRoaXMudGFyZ2V0ID09PSBkb2N1bWVudC5ib2R5KSB7XG4gICAgICAgICAgICBvdXQuaGVpZ2h0ID0gTWF0aC5tYXgob3V0LmhlaWdodCwgMjQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBvdXQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBnZXRCb3VuZHModGhpcy50YXJnZXQpO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2NsZWFyQ2FjaGUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBjbGVhckNhY2hlKCkge1xuICAgICAgdGhpcy5fY2FjaGUgPSB7fTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdjYWNoZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGNhY2hlKGssIGdldHRlcikge1xuICAgICAgLy8gTW9yZSB0aGFuIG9uZSBtb2R1bGUgd2lsbCBvZnRlbiBuZWVkIHRoZSBzYW1lIERPTSBpbmZvLCBzb1xuICAgICAgLy8gd2Uga2VlcCBhIGNhY2hlIHdoaWNoIGlzIGNsZWFyZWQgb24gZWFjaCBwb3NpdGlvbiBjYWxsXG4gICAgICBpZiAodHlwZW9mIHRoaXMuX2NhY2hlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLl9jYWNoZSA9IHt9O1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIHRoaXMuX2NhY2hlW2tdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLl9jYWNoZVtrXSA9IGdldHRlci5jYWxsKHRoaXMpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVba107XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnZW5hYmxlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZW5hYmxlKCkge1xuICAgICAgdmFyIF90aGlzMyA9IHRoaXM7XG5cbiAgICAgIHZhciBwb3MgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDAgfHwgYXJndW1lbnRzWzBdID09PSB1bmRlZmluZWQgPyB0cnVlIDogYXJndW1lbnRzWzBdO1xuXG4gICAgICBpZiAoISh0aGlzLm9wdGlvbnMuYWRkVGFyZ2V0Q2xhc3NlcyA9PT0gZmFsc2UpKSB7XG4gICAgICAgIGFkZENsYXNzKHRoaXMudGFyZ2V0LCB0aGlzLmdldENsYXNzKCdlbmFibGVkJykpO1xuICAgICAgfVxuICAgICAgYWRkQ2xhc3ModGhpcy5lbGVtZW50LCB0aGlzLmdldENsYXNzKCdlbmFibGVkJykpO1xuICAgICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcblxuICAgICAgdGhpcy5zY3JvbGxQYXJlbnRzLmZvckVhY2goZnVuY3Rpb24gKHBhcmVudCkge1xuICAgICAgICBpZiAocGFyZW50ICE9PSBfdGhpczMudGFyZ2V0Lm93bmVyRG9jdW1lbnQpIHtcbiAgICAgICAgICBwYXJlbnQuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgX3RoaXMzLnBvc2l0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGlmIChwb3MpIHtcbiAgICAgICAgdGhpcy5wb3NpdGlvbigpO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2Rpc2FibGUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBkaXNhYmxlKCkge1xuICAgICAgdmFyIF90aGlzNCA9IHRoaXM7XG5cbiAgICAgIHJlbW92ZUNsYXNzKHRoaXMudGFyZ2V0LCB0aGlzLmdldENsYXNzKCdlbmFibGVkJykpO1xuICAgICAgcmVtb3ZlQ2xhc3ModGhpcy5lbGVtZW50LCB0aGlzLmdldENsYXNzKCdlbmFibGVkJykpO1xuICAgICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG5cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5zY3JvbGxQYXJlbnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLnNjcm9sbFBhcmVudHMuZm9yRWFjaChmdW5jdGlvbiAocGFyZW50KSB7XG4gICAgICAgICAgcGFyZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIF90aGlzNC5wb3NpdGlvbik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2Rlc3Ryb3knLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBkZXN0cm95KCkge1xuICAgICAgdmFyIF90aGlzNSA9IHRoaXM7XG5cbiAgICAgIHRoaXMuZGlzYWJsZSgpO1xuXG4gICAgICB0ZXRoZXJzLmZvckVhY2goZnVuY3Rpb24gKHRldGhlciwgaSkge1xuICAgICAgICBpZiAodGV0aGVyID09PSBfdGhpczUpIHtcbiAgICAgICAgICB0ZXRoZXJzLnNwbGljZShpLCAxKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIFJlbW92ZSBhbnkgZWxlbWVudHMgd2Ugd2VyZSB1c2luZyBmb3IgY29udmVuaWVuY2UgZnJvbSB0aGUgRE9NXG4gICAgICBpZiAodGV0aGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmVtb3ZlVXRpbEVsZW1lbnRzKCk7XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAndXBkYXRlQXR0YWNoQ2xhc3NlcycsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHVwZGF0ZUF0dGFjaENsYXNzZXMoZWxlbWVudEF0dGFjaCwgdGFyZ2V0QXR0YWNoKSB7XG4gICAgICB2YXIgX3RoaXM2ID0gdGhpcztcblxuICAgICAgZWxlbWVudEF0dGFjaCA9IGVsZW1lbnRBdHRhY2ggfHwgdGhpcy5hdHRhY2htZW50O1xuICAgICAgdGFyZ2V0QXR0YWNoID0gdGFyZ2V0QXR0YWNoIHx8IHRoaXMudGFyZ2V0QXR0YWNobWVudDtcbiAgICAgIHZhciBzaWRlcyA9IFsnbGVmdCcsICd0b3AnLCAnYm90dG9tJywgJ3JpZ2h0JywgJ21pZGRsZScsICdjZW50ZXInXTtcblxuICAgICAgaWYgKHR5cGVvZiB0aGlzLl9hZGRBdHRhY2hDbGFzc2VzICE9PSAndW5kZWZpbmVkJyAmJiB0aGlzLl9hZGRBdHRhY2hDbGFzc2VzLmxlbmd0aCkge1xuICAgICAgICAvLyB1cGRhdGVBdHRhY2hDbGFzc2VzIGNhbiBiZSBjYWxsZWQgbW9yZSB0aGFuIG9uY2UgaW4gYSBwb3NpdGlvbiBjYWxsLCBzb1xuICAgICAgICAvLyB3ZSBuZWVkIHRvIGNsZWFuIHVwIGFmdGVyIG91cnNlbHZlcyBzdWNoIHRoYXQgd2hlbiB0aGUgbGFzdCBkZWZlciBnZXRzXG4gICAgICAgIC8vIHJhbiBpdCBkb2Vzbid0IGFkZCBhbnkgZXh0cmEgY2xhc3NlcyBmcm9tIHByZXZpb3VzIGNhbGxzLlxuICAgICAgICB0aGlzLl9hZGRBdHRhY2hDbGFzc2VzLnNwbGljZSgwLCB0aGlzLl9hZGRBdHRhY2hDbGFzc2VzLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5fYWRkQXR0YWNoQ2xhc3NlcyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhpcy5fYWRkQXR0YWNoQ2xhc3NlcyA9IFtdO1xuICAgICAgfVxuICAgICAgdmFyIGFkZCA9IHRoaXMuX2FkZEF0dGFjaENsYXNzZXM7XG5cbiAgICAgIGlmIChlbGVtZW50QXR0YWNoLnRvcCkge1xuICAgICAgICBhZGQucHVzaCh0aGlzLmdldENsYXNzKCdlbGVtZW50LWF0dGFjaGVkJykgKyAnLScgKyBlbGVtZW50QXR0YWNoLnRvcCk7XG4gICAgICB9XG4gICAgICBpZiAoZWxlbWVudEF0dGFjaC5sZWZ0KSB7XG4gICAgICAgIGFkZC5wdXNoKHRoaXMuZ2V0Q2xhc3MoJ2VsZW1lbnQtYXR0YWNoZWQnKSArICctJyArIGVsZW1lbnRBdHRhY2gubGVmdCk7XG4gICAgICB9XG4gICAgICBpZiAodGFyZ2V0QXR0YWNoLnRvcCkge1xuICAgICAgICBhZGQucHVzaCh0aGlzLmdldENsYXNzKCd0YXJnZXQtYXR0YWNoZWQnKSArICctJyArIHRhcmdldEF0dGFjaC50b3ApO1xuICAgICAgfVxuICAgICAgaWYgKHRhcmdldEF0dGFjaC5sZWZ0KSB7XG4gICAgICAgIGFkZC5wdXNoKHRoaXMuZ2V0Q2xhc3MoJ3RhcmdldC1hdHRhY2hlZCcpICsgJy0nICsgdGFyZ2V0QXR0YWNoLmxlZnQpO1xuICAgICAgfVxuXG4gICAgICB2YXIgYWxsID0gW107XG4gICAgICBzaWRlcy5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICAgIGFsbC5wdXNoKF90aGlzNi5nZXRDbGFzcygnZWxlbWVudC1hdHRhY2hlZCcpICsgJy0nICsgc2lkZSk7XG4gICAgICAgIGFsbC5wdXNoKF90aGlzNi5nZXRDbGFzcygndGFyZ2V0LWF0dGFjaGVkJykgKyAnLScgKyBzaWRlKTtcbiAgICAgIH0pO1xuXG4gICAgICBkZWZlcihmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghKHR5cGVvZiBfdGhpczYuX2FkZEF0dGFjaENsYXNzZXMgIT09ICd1bmRlZmluZWQnKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHVwZGF0ZUNsYXNzZXMoX3RoaXM2LmVsZW1lbnQsIF90aGlzNi5fYWRkQXR0YWNoQ2xhc3NlcywgYWxsKTtcbiAgICAgICAgaWYgKCEoX3RoaXM2Lm9wdGlvbnMuYWRkVGFyZ2V0Q2xhc3NlcyA9PT0gZmFsc2UpKSB7XG4gICAgICAgICAgdXBkYXRlQ2xhc3NlcyhfdGhpczYudGFyZ2V0LCBfdGhpczYuX2FkZEF0dGFjaENsYXNzZXMsIGFsbCk7XG4gICAgICAgIH1cblxuICAgICAgICBkZWxldGUgX3RoaXM2Ll9hZGRBdHRhY2hDbGFzc2VzO1xuICAgICAgfSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAncG9zaXRpb24nLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBwb3NpdGlvbigpIHtcbiAgICAgIHZhciBfdGhpczcgPSB0aGlzO1xuXG4gICAgICB2YXIgZmx1c2hDaGFuZ2VzID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IGFyZ3VtZW50c1swXTtcblxuICAgICAgLy8gZmx1c2hDaGFuZ2VzIGNvbW1pdHMgdGhlIGNoYW5nZXMgaW1tZWRpYXRlbHksIGxlYXZlIHRydWUgdW5sZXNzIHlvdSBhcmUgcG9zaXRpb25pbmcgbXVsdGlwbGVcbiAgICAgIC8vIHRldGhlcnMgKGluIHdoaWNoIGNhc2UgY2FsbCBUZXRoZXIuVXRpbHMuZmx1c2ggeW91cnNlbGYgd2hlbiB5b3UncmUgZG9uZSlcblxuICAgICAgaWYgKCF0aGlzLmVuYWJsZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmNsZWFyQ2FjaGUoKTtcblxuICAgICAgLy8gVHVybiAnYXV0bycgYXR0YWNobWVudHMgaW50byB0aGUgYXBwcm9wcmlhdGUgY29ybmVyIG9yIGVkZ2VcbiAgICAgIHZhciB0YXJnZXRBdHRhY2htZW50ID0gYXV0b1RvRml4ZWRBdHRhY2htZW50KHRoaXMudGFyZ2V0QXR0YWNobWVudCwgdGhpcy5hdHRhY2htZW50KTtcblxuICAgICAgdGhpcy51cGRhdGVBdHRhY2hDbGFzc2VzKHRoaXMuYXR0YWNobWVudCwgdGFyZ2V0QXR0YWNobWVudCk7XG5cbiAgICAgIHZhciBlbGVtZW50UG9zID0gdGhpcy5jYWNoZSgnZWxlbWVudC1ib3VuZHMnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBnZXRCb3VuZHMoX3RoaXM3LmVsZW1lbnQpO1xuICAgICAgfSk7XG5cbiAgICAgIHZhciB3aWR0aCA9IGVsZW1lbnRQb3Mud2lkdGg7XG4gICAgICB2YXIgaGVpZ2h0ID0gZWxlbWVudFBvcy5oZWlnaHQ7XG5cbiAgICAgIGlmICh3aWR0aCA9PT0gMCAmJiBoZWlnaHQgPT09IDAgJiYgdHlwZW9mIHRoaXMubGFzdFNpemUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHZhciBfbGFzdFNpemUgPSB0aGlzLmxhc3RTaXplO1xuXG4gICAgICAgIC8vIFdlIGNhY2hlIHRoZSBoZWlnaHQgYW5kIHdpZHRoIHRvIG1ha2UgaXQgcG9zc2libGUgdG8gcG9zaXRpb24gZWxlbWVudHMgdGhhdCBhcmVcbiAgICAgICAgLy8gZ2V0dGluZyBoaWRkZW4uXG4gICAgICAgIHdpZHRoID0gX2xhc3RTaXplLndpZHRoO1xuICAgICAgICBoZWlnaHQgPSBfbGFzdFNpemUuaGVpZ2h0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sYXN0U2l6ZSA9IHsgd2lkdGg6IHdpZHRoLCBoZWlnaHQ6IGhlaWdodCB9O1xuICAgICAgfVxuXG4gICAgICB2YXIgdGFyZ2V0UG9zID0gdGhpcy5jYWNoZSgndGFyZ2V0LWJvdW5kcycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIF90aGlzNy5nZXRUYXJnZXRCb3VuZHMoKTtcbiAgICAgIH0pO1xuICAgICAgdmFyIHRhcmdldFNpemUgPSB0YXJnZXRQb3M7XG5cbiAgICAgIC8vIEdldCBhbiBhY3R1YWwgcHggb2Zmc2V0IGZyb20gdGhlIGF0dGFjaG1lbnRcbiAgICAgIHZhciBvZmZzZXQgPSBvZmZzZXRUb1B4KGF0dGFjaG1lbnRUb09mZnNldCh0aGlzLmF0dGFjaG1lbnQpLCB7IHdpZHRoOiB3aWR0aCwgaGVpZ2h0OiBoZWlnaHQgfSk7XG4gICAgICB2YXIgdGFyZ2V0T2Zmc2V0ID0gb2Zmc2V0VG9QeChhdHRhY2htZW50VG9PZmZzZXQodGFyZ2V0QXR0YWNobWVudCksIHRhcmdldFNpemUpO1xuXG4gICAgICB2YXIgbWFudWFsT2Zmc2V0ID0gb2Zmc2V0VG9QeCh0aGlzLm9mZnNldCwgeyB3aWR0aDogd2lkdGgsIGhlaWdodDogaGVpZ2h0IH0pO1xuICAgICAgdmFyIG1hbnVhbFRhcmdldE9mZnNldCA9IG9mZnNldFRvUHgodGhpcy50YXJnZXRPZmZzZXQsIHRhcmdldFNpemUpO1xuXG4gICAgICAvLyBBZGQgdGhlIG1hbnVhbGx5IHByb3ZpZGVkIG9mZnNldFxuICAgICAgb2Zmc2V0ID0gYWRkT2Zmc2V0KG9mZnNldCwgbWFudWFsT2Zmc2V0KTtcbiAgICAgIHRhcmdldE9mZnNldCA9IGFkZE9mZnNldCh0YXJnZXRPZmZzZXQsIG1hbnVhbFRhcmdldE9mZnNldCk7XG5cbiAgICAgIC8vIEl0J3Mgbm93IG91ciBnb2FsIHRvIG1ha2UgKGVsZW1lbnQgcG9zaXRpb24gKyBvZmZzZXQpID09ICh0YXJnZXQgcG9zaXRpb24gKyB0YXJnZXQgb2Zmc2V0KVxuICAgICAgdmFyIGxlZnQgPSB0YXJnZXRQb3MubGVmdCArIHRhcmdldE9mZnNldC5sZWZ0IC0gb2Zmc2V0LmxlZnQ7XG4gICAgICB2YXIgdG9wID0gdGFyZ2V0UG9zLnRvcCArIHRhcmdldE9mZnNldC50b3AgLSBvZmZzZXQudG9wO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IFRldGhlckJhc2UubW9kdWxlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgX21vZHVsZTIgPSBUZXRoZXJCYXNlLm1vZHVsZXNbaV07XG4gICAgICAgIHZhciByZXQgPSBfbW9kdWxlMi5wb3NpdGlvbi5jYWxsKHRoaXMsIHtcbiAgICAgICAgICBsZWZ0OiBsZWZ0LFxuICAgICAgICAgIHRvcDogdG9wLFxuICAgICAgICAgIHRhcmdldEF0dGFjaG1lbnQ6IHRhcmdldEF0dGFjaG1lbnQsXG4gICAgICAgICAgdGFyZ2V0UG9zOiB0YXJnZXRQb3MsXG4gICAgICAgICAgZWxlbWVudFBvczogZWxlbWVudFBvcyxcbiAgICAgICAgICBvZmZzZXQ6IG9mZnNldCxcbiAgICAgICAgICB0YXJnZXRPZmZzZXQ6IHRhcmdldE9mZnNldCxcbiAgICAgICAgICBtYW51YWxPZmZzZXQ6IG1hbnVhbE9mZnNldCxcbiAgICAgICAgICBtYW51YWxUYXJnZXRPZmZzZXQ6IG1hbnVhbFRhcmdldE9mZnNldCxcbiAgICAgICAgICBzY3JvbGxiYXJTaXplOiBzY3JvbGxiYXJTaXplLFxuICAgICAgICAgIGF0dGFjaG1lbnQ6IHRoaXMuYXR0YWNobWVudFxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAocmV0ID09PSBmYWxzZSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgcmV0ID09PSAndW5kZWZpbmVkJyB8fCB0eXBlb2YgcmV0ICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRvcCA9IHJldC50b3A7XG4gICAgICAgICAgbGVmdCA9IHJldC5sZWZ0O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFdlIGRlc2NyaWJlIHRoZSBwb3NpdGlvbiB0aHJlZSBkaWZmZXJlbnQgd2F5cyB0byBnaXZlIHRoZSBvcHRpbWl6ZXJcbiAgICAgIC8vIGEgY2hhbmNlIHRvIGRlY2lkZSB0aGUgYmVzdCBwb3NzaWJsZSB3YXkgdG8gcG9zaXRpb24gdGhlIGVsZW1lbnRcbiAgICAgIC8vIHdpdGggdGhlIGZld2VzdCByZXBhaW50cy5cbiAgICAgIHZhciBuZXh0ID0ge1xuICAgICAgICAvLyBJdCdzIHBvc2l0aW9uIHJlbGF0aXZlIHRvIHRoZSBwYWdlIChhYnNvbHV0ZSBwb3NpdGlvbmluZyB3aGVuXG4gICAgICAgIC8vIHRoZSBlbGVtZW50IGlzIGEgY2hpbGQgb2YgdGhlIGJvZHkpXG4gICAgICAgIHBhZ2U6IHtcbiAgICAgICAgICB0b3A6IHRvcCxcbiAgICAgICAgICBsZWZ0OiBsZWZ0XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSXQncyBwb3NpdGlvbiByZWxhdGl2ZSB0byB0aGUgdmlld3BvcnQgKGZpeGVkIHBvc2l0aW9uaW5nKVxuICAgICAgICB2aWV3cG9ydDoge1xuICAgICAgICAgIHRvcDogdG9wIC0gcGFnZVlPZmZzZXQsXG4gICAgICAgICAgYm90dG9tOiBwYWdlWU9mZnNldCAtIHRvcCAtIGhlaWdodCArIGlubmVySGVpZ2h0LFxuICAgICAgICAgIGxlZnQ6IGxlZnQgLSBwYWdlWE9mZnNldCxcbiAgICAgICAgICByaWdodDogcGFnZVhPZmZzZXQgLSBsZWZ0IC0gd2lkdGggKyBpbm5lcldpZHRoXG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHZhciBkb2MgPSB0aGlzLnRhcmdldC5vd25lckRvY3VtZW50O1xuICAgICAgdmFyIHdpbiA9IGRvYy5kZWZhdWx0VmlldztcblxuICAgICAgdmFyIHNjcm9sbGJhclNpemUgPSB1bmRlZmluZWQ7XG4gICAgICBpZiAod2luLmlubmVySGVpZ2h0ID4gZG9jLmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQpIHtcbiAgICAgICAgc2Nyb2xsYmFyU2l6ZSA9IHRoaXMuY2FjaGUoJ3Njcm9sbGJhci1zaXplJywgZ2V0U2Nyb2xsQmFyU2l6ZSk7XG4gICAgICAgIG5leHQudmlld3BvcnQuYm90dG9tIC09IHNjcm9sbGJhclNpemUuaGVpZ2h0O1xuICAgICAgfVxuXG4gICAgICBpZiAod2luLmlubmVyV2lkdGggPiBkb2MuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoKSB7XG4gICAgICAgIHNjcm9sbGJhclNpemUgPSB0aGlzLmNhY2hlKCdzY3JvbGxiYXItc2l6ZScsIGdldFNjcm9sbEJhclNpemUpO1xuICAgICAgICBuZXh0LnZpZXdwb3J0LnJpZ2h0IC09IHNjcm9sbGJhclNpemUud2lkdGg7XG4gICAgICB9XG5cbiAgICAgIGlmIChbJycsICdzdGF0aWMnXS5pbmRleE9mKGRvYy5ib2R5LnN0eWxlLnBvc2l0aW9uKSA9PT0gLTEgfHwgWycnLCAnc3RhdGljJ10uaW5kZXhPZihkb2MuYm9keS5wYXJlbnRFbGVtZW50LnN0eWxlLnBvc2l0aW9uKSA9PT0gLTEpIHtcbiAgICAgICAgLy8gQWJzb2x1dGUgcG9zaXRpb25pbmcgaW4gdGhlIGJvZHkgd2lsbCBiZSByZWxhdGl2ZSB0byB0aGUgcGFnZSwgbm90IHRoZSAnaW5pdGlhbCBjb250YWluaW5nIGJsb2NrJ1xuICAgICAgICBuZXh0LnBhZ2UuYm90dG9tID0gZG9jLmJvZHkuc2Nyb2xsSGVpZ2h0IC0gdG9wIC0gaGVpZ2h0O1xuICAgICAgICBuZXh0LnBhZ2UucmlnaHQgPSBkb2MuYm9keS5zY3JvbGxXaWR0aCAtIGxlZnQgLSB3aWR0aDtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMub3B0aW1pemF0aW9ucyAhPT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5vcHRpb25zLm9wdGltaXphdGlvbnMubW92ZUVsZW1lbnQgIT09IGZhbHNlICYmICEodHlwZW9mIHRoaXMudGFyZ2V0TW9kaWZpZXIgIT09ICd1bmRlZmluZWQnKSkge1xuICAgICAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciBvZmZzZXRQYXJlbnQgPSBfdGhpczcuY2FjaGUoJ3RhcmdldC1vZmZzZXRwYXJlbnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0T2Zmc2V0UGFyZW50KF90aGlzNy50YXJnZXQpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHZhciBvZmZzZXRQb3NpdGlvbiA9IF90aGlzNy5jYWNoZSgndGFyZ2V0LW9mZnNldHBhcmVudC1ib3VuZHMnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0Qm91bmRzKG9mZnNldFBhcmVudCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdmFyIG9mZnNldFBhcmVudFN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZShvZmZzZXRQYXJlbnQpO1xuICAgICAgICAgIHZhciBvZmZzZXRQYXJlbnRTaXplID0gb2Zmc2V0UG9zaXRpb247XG5cbiAgICAgICAgICB2YXIgb2Zmc2V0Qm9yZGVyID0ge307XG4gICAgICAgICAgWydUb3AnLCAnTGVmdCcsICdCb3R0b20nLCAnUmlnaHQnXS5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICAgICAgICBvZmZzZXRCb3JkZXJbc2lkZS50b0xvd2VyQ2FzZSgpXSA9IHBhcnNlRmxvYXQob2Zmc2V0UGFyZW50U3R5bGVbJ2JvcmRlcicgKyBzaWRlICsgJ1dpZHRoJ10pO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgb2Zmc2V0UG9zaXRpb24ucmlnaHQgPSBkb2MuYm9keS5zY3JvbGxXaWR0aCAtIG9mZnNldFBvc2l0aW9uLmxlZnQgLSBvZmZzZXRQYXJlbnRTaXplLndpZHRoICsgb2Zmc2V0Qm9yZGVyLnJpZ2h0O1xuICAgICAgICAgIG9mZnNldFBvc2l0aW9uLmJvdHRvbSA9IGRvYy5ib2R5LnNjcm9sbEhlaWdodCAtIG9mZnNldFBvc2l0aW9uLnRvcCAtIG9mZnNldFBhcmVudFNpemUuaGVpZ2h0ICsgb2Zmc2V0Qm9yZGVyLmJvdHRvbTtcblxuICAgICAgICAgIGlmIChuZXh0LnBhZ2UudG9wID49IG9mZnNldFBvc2l0aW9uLnRvcCArIG9mZnNldEJvcmRlci50b3AgJiYgbmV4dC5wYWdlLmJvdHRvbSA+PSBvZmZzZXRQb3NpdGlvbi5ib3R0b20pIHtcbiAgICAgICAgICAgIGlmIChuZXh0LnBhZ2UubGVmdCA+PSBvZmZzZXRQb3NpdGlvbi5sZWZ0ICsgb2Zmc2V0Qm9yZGVyLmxlZnQgJiYgbmV4dC5wYWdlLnJpZ2h0ID49IG9mZnNldFBvc2l0aW9uLnJpZ2h0KSB7XG4gICAgICAgICAgICAgIC8vIFdlJ3JlIHdpdGhpbiB0aGUgdmlzaWJsZSBwYXJ0IG9mIHRoZSB0YXJnZXQncyBzY3JvbGwgcGFyZW50XG4gICAgICAgICAgICAgIHZhciBzY3JvbGxUb3AgPSBvZmZzZXRQYXJlbnQuc2Nyb2xsVG9wO1xuICAgICAgICAgICAgICB2YXIgc2Nyb2xsTGVmdCA9IG9mZnNldFBhcmVudC5zY3JvbGxMZWZ0O1xuXG4gICAgICAgICAgICAgIC8vIEl0J3MgcG9zaXRpb24gcmVsYXRpdmUgdG8gdGhlIHRhcmdldCdzIG9mZnNldCBwYXJlbnQgKGFic29sdXRlIHBvc2l0aW9uaW5nIHdoZW5cbiAgICAgICAgICAgICAgLy8gdGhlIGVsZW1lbnQgaXMgbW92ZWQgdG8gYmUgYSBjaGlsZCBvZiB0aGUgdGFyZ2V0J3Mgb2Zmc2V0IHBhcmVudCkuXG4gICAgICAgICAgICAgIG5leHQub2Zmc2V0ID0ge1xuICAgICAgICAgICAgICAgIHRvcDogbmV4dC5wYWdlLnRvcCAtIG9mZnNldFBvc2l0aW9uLnRvcCArIHNjcm9sbFRvcCAtIG9mZnNldEJvcmRlci50b3AsXG4gICAgICAgICAgICAgICAgbGVmdDogbmV4dC5wYWdlLmxlZnQgLSBvZmZzZXRQb3NpdGlvbi5sZWZ0ICsgc2Nyb2xsTGVmdCAtIG9mZnNldEJvcmRlci5sZWZ0XG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KSgpO1xuICAgICAgfVxuXG4gICAgICAvLyBXZSBjb3VsZCBhbHNvIHRyYXZlbCB1cCB0aGUgRE9NIGFuZCB0cnkgZWFjaCBjb250YWluaW5nIGNvbnRleHQsIHJhdGhlciB0aGFuIG9ubHlcbiAgICAgIC8vIGxvb2tpbmcgYXQgdGhlIGJvZHksIGJ1dCB3ZSdyZSBnb25uYSBnZXQgZGltaW5pc2hpbmcgcmV0dXJucy5cblxuICAgICAgdGhpcy5tb3ZlKG5leHQpO1xuXG4gICAgICB0aGlzLmhpc3RvcnkudW5zaGlmdChuZXh0KTtcblxuICAgICAgaWYgKHRoaXMuaGlzdG9yeS5sZW5ndGggPiAzKSB7XG4gICAgICAgIHRoaXMuaGlzdG9yeS5wb3AoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGZsdXNoQ2hhbmdlcykge1xuICAgICAgICBmbHVzaCgpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBUSEUgSVNTVUVcbiAgfSwge1xuICAgIGtleTogJ21vdmUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBtb3ZlKHBvcykge1xuICAgICAgdmFyIF90aGlzOCA9IHRoaXM7XG5cbiAgICAgIGlmICghKHR5cGVvZiB0aGlzLmVsZW1lbnQucGFyZW50Tm9kZSAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIHNhbWUgPSB7fTtcblxuICAgICAgZm9yICh2YXIgdHlwZSBpbiBwb3MpIHtcbiAgICAgICAgc2FtZVt0eXBlXSA9IHt9O1xuXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBwb3NbdHlwZV0pIHtcbiAgICAgICAgICB2YXIgZm91bmQgPSBmYWxzZTtcblxuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5oaXN0b3J5Lmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICB2YXIgcG9pbnQgPSB0aGlzLmhpc3RvcnlbaV07XG4gICAgICAgICAgICBpZiAodHlwZW9mIHBvaW50W3R5cGVdICE9PSAndW5kZWZpbmVkJyAmJiAhd2l0aGluKHBvaW50W3R5cGVdW2tleV0sIHBvc1t0eXBlXVtrZXldKSkge1xuICAgICAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghZm91bmQpIHtcbiAgICAgICAgICAgIHNhbWVbdHlwZV1ba2V5XSA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciBjc3MgPSB7IHRvcDogJycsIGxlZnQ6ICcnLCByaWdodDogJycsIGJvdHRvbTogJycgfTtcblxuICAgICAgdmFyIHRyYW5zY3JpYmUgPSBmdW5jdGlvbiB0cmFuc2NyaWJlKF9zYW1lLCBfcG9zKSB7XG4gICAgICAgIHZhciBoYXNPcHRpbWl6YXRpb25zID0gdHlwZW9mIF90aGlzOC5vcHRpb25zLm9wdGltaXphdGlvbnMgIT09ICd1bmRlZmluZWQnO1xuICAgICAgICB2YXIgZ3B1ID0gaGFzT3B0aW1pemF0aW9ucyA/IF90aGlzOC5vcHRpb25zLm9wdGltaXphdGlvbnMuZ3B1IDogbnVsbDtcbiAgICAgICAgaWYgKGdwdSAhPT0gZmFsc2UpIHtcbiAgICAgICAgICB2YXIgeVBvcyA9IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgeFBvcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICBpZiAoX3NhbWUudG9wKSB7XG4gICAgICAgICAgICBjc3MudG9wID0gMDtcbiAgICAgICAgICAgIHlQb3MgPSBfcG9zLnRvcDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3NzLmJvdHRvbSA9IDA7XG4gICAgICAgICAgICB5UG9zID0gLV9wb3MuYm90dG9tO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChfc2FtZS5sZWZ0KSB7XG4gICAgICAgICAgICBjc3MubGVmdCA9IDA7XG4gICAgICAgICAgICB4UG9zID0gX3Bvcy5sZWZ0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjc3MucmlnaHQgPSAwO1xuICAgICAgICAgICAgeFBvcyA9IC1fcG9zLnJpZ2h0O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh3aW5kb3cubWF0Y2hNZWRpYSkge1xuICAgICAgICAgICAgLy8gSHViU3BvdC90ZXRoZXIjMjA3XG4gICAgICAgICAgICB2YXIgcmV0aW5hID0gd2luZG93Lm1hdGNoTWVkaWEoJ29ubHkgc2NyZWVuIGFuZCAobWluLXJlc29sdXRpb246IDEuM2RwcHgpJykubWF0Y2hlcyB8fCB3aW5kb3cubWF0Y2hNZWRpYSgnb25seSBzY3JlZW4gYW5kICgtd2Via2l0LW1pbi1kZXZpY2UtcGl4ZWwtcmF0aW86IDEuMyknKS5tYXRjaGVzO1xuICAgICAgICAgICAgaWYgKCFyZXRpbmEpIHtcbiAgICAgICAgICAgICAgeFBvcyA9IE1hdGgucm91bmQoeFBvcyk7XG4gICAgICAgICAgICAgIHlQb3MgPSBNYXRoLnJvdW5kKHlQb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNzc1t0cmFuc2Zvcm1LZXldID0gJ3RyYW5zbGF0ZVgoJyArIHhQb3MgKyAncHgpIHRyYW5zbGF0ZVkoJyArIHlQb3MgKyAncHgpJztcblxuICAgICAgICAgIGlmICh0cmFuc2Zvcm1LZXkgIT09ICdtc1RyYW5zZm9ybScpIHtcbiAgICAgICAgICAgIC8vIFRoZSBaIHRyYW5zZm9ybSB3aWxsIGtlZXAgdGhpcyBpbiB0aGUgR1BVIChmYXN0ZXIsIGFuZCBwcmV2ZW50cyBhcnRpZmFjdHMpLFxuICAgICAgICAgICAgLy8gYnV0IElFOSBkb2Vzbid0IHN1cHBvcnQgM2QgdHJhbnNmb3JtcyBhbmQgd2lsbCBjaG9rZS5cbiAgICAgICAgICAgIGNzc1t0cmFuc2Zvcm1LZXldICs9IFwiIHRyYW5zbGF0ZVooMClcIjtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKF9zYW1lLnRvcCkge1xuICAgICAgICAgICAgY3NzLnRvcCA9IF9wb3MudG9wICsgJ3B4JztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3NzLmJvdHRvbSA9IF9wb3MuYm90dG9tICsgJ3B4JztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoX3NhbWUubGVmdCkge1xuICAgICAgICAgICAgY3NzLmxlZnQgPSBfcG9zLmxlZnQgKyAncHgnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjc3MucmlnaHQgPSBfcG9zLnJpZ2h0ICsgJ3B4JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHZhciBtb3ZlZCA9IGZhbHNlO1xuICAgICAgaWYgKChzYW1lLnBhZ2UudG9wIHx8IHNhbWUucGFnZS5ib3R0b20pICYmIChzYW1lLnBhZ2UubGVmdCB8fCBzYW1lLnBhZ2UucmlnaHQpKSB7XG4gICAgICAgIGNzcy5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgIHRyYW5zY3JpYmUoc2FtZS5wYWdlLCBwb3MucGFnZSk7XG4gICAgICB9IGVsc2UgaWYgKChzYW1lLnZpZXdwb3J0LnRvcCB8fCBzYW1lLnZpZXdwb3J0LmJvdHRvbSkgJiYgKHNhbWUudmlld3BvcnQubGVmdCB8fCBzYW1lLnZpZXdwb3J0LnJpZ2h0KSkge1xuICAgICAgICBjc3MucG9zaXRpb24gPSAnZml4ZWQnO1xuICAgICAgICB0cmFuc2NyaWJlKHNhbWUudmlld3BvcnQsIHBvcy52aWV3cG9ydCk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBzYW1lLm9mZnNldCAhPT0gJ3VuZGVmaW5lZCcgJiYgc2FtZS5vZmZzZXQudG9wICYmIHNhbWUub2Zmc2V0LmxlZnQpIHtcbiAgICAgICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBjc3MucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgICAgICAgIHZhciBvZmZzZXRQYXJlbnQgPSBfdGhpczguY2FjaGUoJ3RhcmdldC1vZmZzZXRwYXJlbnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0T2Zmc2V0UGFyZW50KF90aGlzOC50YXJnZXQpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgaWYgKGdldE9mZnNldFBhcmVudChfdGhpczguZWxlbWVudCkgIT09IG9mZnNldFBhcmVudCkge1xuICAgICAgICAgICAgZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICBfdGhpczguZWxlbWVudC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKF90aGlzOC5lbGVtZW50KTtcbiAgICAgICAgICAgICAgb2Zmc2V0UGFyZW50LmFwcGVuZENoaWxkKF90aGlzOC5lbGVtZW50KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRyYW5zY3JpYmUoc2FtZS5vZmZzZXQsIHBvcy5vZmZzZXQpO1xuICAgICAgICAgIG1vdmVkID0gdHJ1ZTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNzcy5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgIHRyYW5zY3JpYmUoeyB0b3A6IHRydWUsIGxlZnQ6IHRydWUgfSwgcG9zLnBhZ2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIW1vdmVkKSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuYm9keUVsZW1lbnQpIHtcbiAgICAgICAgICB0aGlzLm9wdGlvbnMuYm9keUVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5lbGVtZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgb2Zmc2V0UGFyZW50SXNCb2R5ID0gdHJ1ZTtcbiAgICAgICAgICB2YXIgY3VycmVudE5vZGUgPSB0aGlzLmVsZW1lbnQucGFyZW50Tm9kZTtcbiAgICAgICAgICB3aGlsZSAoY3VycmVudE5vZGUgJiYgY3VycmVudE5vZGUubm9kZVR5cGUgPT09IDEgJiYgY3VycmVudE5vZGUudGFnTmFtZSAhPT0gJ0JPRFknKSB7XG4gICAgICAgICAgICBpZiAoZ2V0Q29tcHV0ZWRTdHlsZShjdXJyZW50Tm9kZSkucG9zaXRpb24gIT09ICdzdGF0aWMnKSB7XG4gICAgICAgICAgICAgIG9mZnNldFBhcmVudElzQm9keSA9IGZhbHNlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY3VycmVudE5vZGUgPSBjdXJyZW50Tm9kZS5wYXJlbnROb2RlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghb2Zmc2V0UGFyZW50SXNCb2R5KSB7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmVsZW1lbnQpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50Lm93bmVyRG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLmVsZW1lbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBbnkgY3NzIGNoYW5nZSB3aWxsIHRyaWdnZXIgYSByZXBhaW50LCBzbyBsZXQncyBhdm9pZCBvbmUgaWYgbm90aGluZyBjaGFuZ2VkXG4gICAgICB2YXIgd3JpdGVDU1MgPSB7fTtcbiAgICAgIHZhciB3cml0ZSA9IGZhbHNlO1xuICAgICAgZm9yICh2YXIga2V5IGluIGNzcykge1xuICAgICAgICB2YXIgdmFsID0gY3NzW2tleV07XG4gICAgICAgIHZhciBlbFZhbCA9IHRoaXMuZWxlbWVudC5zdHlsZVtrZXldO1xuXG4gICAgICAgIGlmIChlbFZhbCAhPT0gdmFsKSB7XG4gICAgICAgICAgd3JpdGUgPSB0cnVlO1xuICAgICAgICAgIHdyaXRlQ1NTW2tleV0gPSB2YWw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHdyaXRlKSB7XG4gICAgICAgIGRlZmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBleHRlbmQoX3RoaXM4LmVsZW1lbnQuc3R5bGUsIHdyaXRlQ1NTKTtcbiAgICAgICAgICBfdGhpczgudHJpZ2dlcigncmVwb3NpdGlvbmVkJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBUZXRoZXJDbGFzcztcbn0pKEV2ZW50ZWQpO1xuXG5UZXRoZXJDbGFzcy5tb2R1bGVzID0gW107XG5cblRldGhlckJhc2UucG9zaXRpb24gPSBwb3NpdGlvbjtcblxudmFyIFRldGhlciA9IGV4dGVuZChUZXRoZXJDbGFzcywgVGV0aGVyQmFzZSk7XG4vKiBnbG9iYWxzIFRldGhlckJhc2UgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3NsaWNlZFRvQXJyYXkgPSAoZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBzbGljZUl0ZXJhdG9yKGFyciwgaSkgeyB2YXIgX2FyciA9IFtdOyB2YXIgX24gPSB0cnVlOyB2YXIgX2QgPSBmYWxzZTsgdmFyIF9lID0gdW5kZWZpbmVkOyB0cnkgeyBmb3IgKHZhciBfaSA9IGFycltTeW1ib2wuaXRlcmF0b3JdKCksIF9zOyAhKF9uID0gKF9zID0gX2kubmV4dCgpKS5kb25lKTsgX24gPSB0cnVlKSB7IF9hcnIucHVzaChfcy52YWx1ZSk7IGlmIChpICYmIF9hcnIubGVuZ3RoID09PSBpKSBicmVhazsgfSB9IGNhdGNoIChlcnIpIHsgX2QgPSB0cnVlOyBfZSA9IGVycjsgfSBmaW5hbGx5IHsgdHJ5IHsgaWYgKCFfbiAmJiBfaVsncmV0dXJuJ10pIF9pWydyZXR1cm4nXSgpOyB9IGZpbmFsbHkgeyBpZiAoX2QpIHRocm93IF9lOyB9IH0gcmV0dXJuIF9hcnI7IH0gcmV0dXJuIGZ1bmN0aW9uIChhcnIsIGkpIHsgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkgeyByZXR1cm4gYXJyOyB9IGVsc2UgaWYgKFN5bWJvbC5pdGVyYXRvciBpbiBPYmplY3QoYXJyKSkgeyByZXR1cm4gc2xpY2VJdGVyYXRvcihhcnIsIGkpOyB9IGVsc2UgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlJyk7IH0gfTsgfSkoKTtcblxudmFyIF9UZXRoZXJCYXNlJFV0aWxzID0gVGV0aGVyQmFzZS5VdGlscztcbnZhciBnZXRCb3VuZHMgPSBfVGV0aGVyQmFzZSRVdGlscy5nZXRCb3VuZHM7XG52YXIgZXh0ZW5kID0gX1RldGhlckJhc2UkVXRpbHMuZXh0ZW5kO1xudmFyIHVwZGF0ZUNsYXNzZXMgPSBfVGV0aGVyQmFzZSRVdGlscy51cGRhdGVDbGFzc2VzO1xudmFyIGRlZmVyID0gX1RldGhlckJhc2UkVXRpbHMuZGVmZXI7XG5cbnZhciBCT1VORFNfRk9STUFUID0gWydsZWZ0JywgJ3RvcCcsICdyaWdodCcsICdib3R0b20nXTtcblxuZnVuY3Rpb24gZ2V0Qm91bmRpbmdSZWN0KHRldGhlciwgdG8pIHtcbiAgaWYgKHRvID09PSAnc2Nyb2xsUGFyZW50Jykge1xuICAgIHRvID0gdGV0aGVyLnNjcm9sbFBhcmVudHNbMF07XG4gIH0gZWxzZSBpZiAodG8gPT09ICd3aW5kb3cnKSB7XG4gICAgdG8gPSBbcGFnZVhPZmZzZXQsIHBhZ2VZT2Zmc2V0LCBpbm5lcldpZHRoICsgcGFnZVhPZmZzZXQsIGlubmVySGVpZ2h0ICsgcGFnZVlPZmZzZXRdO1xuICB9XG5cbiAgaWYgKHRvID09PSBkb2N1bWVudCkge1xuICAgIHRvID0gdG8uZG9jdW1lbnRFbGVtZW50O1xuICB9XG5cbiAgaWYgKHR5cGVvZiB0by5ub2RlVHlwZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIG5vZGUgPSB0bztcbiAgICAgIHZhciBzaXplID0gZ2V0Qm91bmRzKHRvKTtcbiAgICAgIHZhciBwb3MgPSBzaXplO1xuICAgICAgdmFyIHN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZSh0byk7XG5cbiAgICAgIHRvID0gW3Bvcy5sZWZ0LCBwb3MudG9wLCBzaXplLndpZHRoICsgcG9zLmxlZnQsIHNpemUuaGVpZ2h0ICsgcG9zLnRvcF07XG5cbiAgICAgIC8vIEFjY291bnQgYW55IHBhcmVudCBGcmFtZXMgc2Nyb2xsIG9mZnNldFxuICAgICAgaWYgKG5vZGUub3duZXJEb2N1bWVudCAhPT0gZG9jdW1lbnQpIHtcbiAgICAgICAgdmFyIHdpbiA9IG5vZGUub3duZXJEb2N1bWVudC5kZWZhdWx0VmlldztcbiAgICAgICAgdG9bMF0gKz0gd2luLnBhZ2VYT2Zmc2V0O1xuICAgICAgICB0b1sxXSArPSB3aW4ucGFnZVlPZmZzZXQ7XG4gICAgICAgIHRvWzJdICs9IHdpbi5wYWdlWE9mZnNldDtcbiAgICAgICAgdG9bM10gKz0gd2luLnBhZ2VZT2Zmc2V0O1xuICAgICAgfVxuXG4gICAgICBCT1VORFNfRk9STUFULmZvckVhY2goZnVuY3Rpb24gKHNpZGUsIGkpIHtcbiAgICAgICAgc2lkZSA9IHNpZGVbMF0udG9VcHBlckNhc2UoKSArIHNpZGUuc3Vic3RyKDEpO1xuICAgICAgICBpZiAoc2lkZSA9PT0gJ1RvcCcgfHwgc2lkZSA9PT0gJ0xlZnQnKSB7XG4gICAgICAgICAgdG9baV0gKz0gcGFyc2VGbG9hdChzdHlsZVsnYm9yZGVyJyArIHNpZGUgKyAnV2lkdGgnXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdG9baV0gLT0gcGFyc2VGbG9hdChzdHlsZVsnYm9yZGVyJyArIHNpZGUgKyAnV2lkdGgnXSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pKCk7XG4gIH1cblxuICByZXR1cm4gdG87XG59XG5cblRldGhlckJhc2UubW9kdWxlcy5wdXNoKHtcbiAgcG9zaXRpb246IGZ1bmN0aW9uIHBvc2l0aW9uKF9yZWYpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgdmFyIHRvcCA9IF9yZWYudG9wO1xuICAgIHZhciBsZWZ0ID0gX3JlZi5sZWZ0O1xuICAgIHZhciB0YXJnZXRBdHRhY2htZW50ID0gX3JlZi50YXJnZXRBdHRhY2htZW50O1xuXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuY29uc3RyYWludHMpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHZhciBfY2FjaGUgPSB0aGlzLmNhY2hlKCdlbGVtZW50LWJvdW5kcycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBnZXRCb3VuZHMoX3RoaXMuZWxlbWVudCk7XG4gICAgfSk7XG5cbiAgICB2YXIgaGVpZ2h0ID0gX2NhY2hlLmhlaWdodDtcbiAgICB2YXIgd2lkdGggPSBfY2FjaGUud2lkdGg7XG5cbiAgICBpZiAod2lkdGggPT09IDAgJiYgaGVpZ2h0ID09PSAwICYmIHR5cGVvZiB0aGlzLmxhc3RTaXplICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgdmFyIF9sYXN0U2l6ZSA9IHRoaXMubGFzdFNpemU7XG5cbiAgICAgIC8vIEhhbmRsZSB0aGUgaXRlbSBnZXR0aW5nIGhpZGRlbiBhcyBhIHJlc3VsdCBvZiBvdXIgcG9zaXRpb25pbmcgd2l0aG91dCBnbGl0Y2hpbmdcbiAgICAgIC8vIHRoZSBjbGFzc2VzIGluIGFuZCBvdXRcbiAgICAgIHdpZHRoID0gX2xhc3RTaXplLndpZHRoO1xuICAgICAgaGVpZ2h0ID0gX2xhc3RTaXplLmhlaWdodDtcbiAgICB9XG5cbiAgICB2YXIgdGFyZ2V0U2l6ZSA9IHRoaXMuY2FjaGUoJ3RhcmdldC1ib3VuZHMnLCBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gX3RoaXMuZ2V0VGFyZ2V0Qm91bmRzKCk7XG4gICAgfSk7XG5cbiAgICB2YXIgdGFyZ2V0SGVpZ2h0ID0gdGFyZ2V0U2l6ZS5oZWlnaHQ7XG4gICAgdmFyIHRhcmdldFdpZHRoID0gdGFyZ2V0U2l6ZS53aWR0aDtcblxuICAgIHZhciBhbGxDbGFzc2VzID0gW3RoaXMuZ2V0Q2xhc3MoJ3Bpbm5lZCcpLCB0aGlzLmdldENsYXNzKCdvdXQtb2YtYm91bmRzJyldO1xuXG4gICAgdGhpcy5vcHRpb25zLmNvbnN0cmFpbnRzLmZvckVhY2goZnVuY3Rpb24gKGNvbnN0cmFpbnQpIHtcbiAgICAgIHZhciBvdXRPZkJvdW5kc0NsYXNzID0gY29uc3RyYWludC5vdXRPZkJvdW5kc0NsYXNzO1xuICAgICAgdmFyIHBpbm5lZENsYXNzID0gY29uc3RyYWludC5waW5uZWRDbGFzcztcblxuICAgICAgaWYgKG91dE9mQm91bmRzQ2xhc3MpIHtcbiAgICAgICAgYWxsQ2xhc3Nlcy5wdXNoKG91dE9mQm91bmRzQ2xhc3MpO1xuICAgICAgfVxuICAgICAgaWYgKHBpbm5lZENsYXNzKSB7XG4gICAgICAgIGFsbENsYXNzZXMucHVzaChwaW5uZWRDbGFzcyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhbGxDbGFzc2VzLmZvckVhY2goZnVuY3Rpb24gKGNscykge1xuICAgICAgWydsZWZ0JywgJ3RvcCcsICdyaWdodCcsICdib3R0b20nXS5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICAgIGFsbENsYXNzZXMucHVzaChjbHMgKyAnLScgKyBzaWRlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdmFyIGFkZENsYXNzZXMgPSBbXTtcblxuICAgIHZhciB0QXR0YWNobWVudCA9IGV4dGVuZCh7fSwgdGFyZ2V0QXR0YWNobWVudCk7XG4gICAgdmFyIGVBdHRhY2htZW50ID0gZXh0ZW5kKHt9LCB0aGlzLmF0dGFjaG1lbnQpO1xuXG4gICAgdGhpcy5vcHRpb25zLmNvbnN0cmFpbnRzLmZvckVhY2goZnVuY3Rpb24gKGNvbnN0cmFpbnQpIHtcbiAgICAgIHZhciB0byA9IGNvbnN0cmFpbnQudG87XG4gICAgICB2YXIgYXR0YWNobWVudCA9IGNvbnN0cmFpbnQuYXR0YWNobWVudDtcbiAgICAgIHZhciBwaW4gPSBjb25zdHJhaW50LnBpbjtcblxuICAgICAgaWYgKHR5cGVvZiBhdHRhY2htZW50ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICBhdHRhY2htZW50ID0gJyc7XG4gICAgICB9XG5cbiAgICAgIHZhciBjaGFuZ2VBdHRhY2hYID0gdW5kZWZpbmVkLFxuICAgICAgICAgIGNoYW5nZUF0dGFjaFkgPSB1bmRlZmluZWQ7XG4gICAgICBpZiAoYXR0YWNobWVudC5pbmRleE9mKCcgJykgPj0gMCkge1xuICAgICAgICB2YXIgX2F0dGFjaG1lbnQkc3BsaXQgPSBhdHRhY2htZW50LnNwbGl0KCcgJyk7XG5cbiAgICAgICAgdmFyIF9hdHRhY2htZW50JHNwbGl0MiA9IF9zbGljZWRUb0FycmF5KF9hdHRhY2htZW50JHNwbGl0LCAyKTtcblxuICAgICAgICBjaGFuZ2VBdHRhY2hZID0gX2F0dGFjaG1lbnQkc3BsaXQyWzBdO1xuICAgICAgICBjaGFuZ2VBdHRhY2hYID0gX2F0dGFjaG1lbnQkc3BsaXQyWzFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2hhbmdlQXR0YWNoWCA9IGNoYW5nZUF0dGFjaFkgPSBhdHRhY2htZW50O1xuICAgICAgfVxuXG4gICAgICB2YXIgYm91bmRzID0gZ2V0Qm91bmRpbmdSZWN0KF90aGlzLCB0byk7XG5cbiAgICAgIGlmIChjaGFuZ2VBdHRhY2hZID09PSAndGFyZ2V0JyB8fCBjaGFuZ2VBdHRhY2hZID09PSAnYm90aCcpIHtcbiAgICAgICAgaWYgKHRvcCA8IGJvdW5kc1sxXSAmJiB0QXR0YWNobWVudC50b3AgPT09ICd0b3AnKSB7XG4gICAgICAgICAgdG9wICs9IHRhcmdldEhlaWdodDtcbiAgICAgICAgICB0QXR0YWNobWVudC50b3AgPSAnYm90dG9tJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0b3AgKyBoZWlnaHQgPiBib3VuZHNbM10gJiYgdEF0dGFjaG1lbnQudG9wID09PSAnYm90dG9tJykge1xuICAgICAgICAgIHRvcCAtPSB0YXJnZXRIZWlnaHQ7XG4gICAgICAgICAgdEF0dGFjaG1lbnQudG9wID0gJ3RvcCc7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGNoYW5nZUF0dGFjaFkgPT09ICd0b2dldGhlcicpIHtcbiAgICAgICAgaWYgKHRBdHRhY2htZW50LnRvcCA9PT0gJ3RvcCcpIHtcbiAgICAgICAgICBpZiAoZUF0dGFjaG1lbnQudG9wID09PSAnYm90dG9tJyAmJiB0b3AgPCBib3VuZHNbMV0pIHtcbiAgICAgICAgICAgIHRvcCArPSB0YXJnZXRIZWlnaHQ7XG4gICAgICAgICAgICB0QXR0YWNobWVudC50b3AgPSAnYm90dG9tJztcblxuICAgICAgICAgICAgdG9wICs9IGhlaWdodDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LnRvcCA9ICd0b3AnO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZUF0dGFjaG1lbnQudG9wID09PSAndG9wJyAmJiB0b3AgKyBoZWlnaHQgPiBib3VuZHNbM10gJiYgdG9wIC0gKGhlaWdodCAtIHRhcmdldEhlaWdodCkgPj0gYm91bmRzWzFdKSB7XG4gICAgICAgICAgICB0b3AgLT0gaGVpZ2h0IC0gdGFyZ2V0SGVpZ2h0O1xuICAgICAgICAgICAgdEF0dGFjaG1lbnQudG9wID0gJ2JvdHRvbSc7XG5cbiAgICAgICAgICAgIGVBdHRhY2htZW50LnRvcCA9ICdib3R0b20nO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0QXR0YWNobWVudC50b3AgPT09ICdib3R0b20nKSB7XG4gICAgICAgICAgaWYgKGVBdHRhY2htZW50LnRvcCA9PT0gJ3RvcCcgJiYgdG9wICsgaGVpZ2h0ID4gYm91bmRzWzNdKSB7XG4gICAgICAgICAgICB0b3AgLT0gdGFyZ2V0SGVpZ2h0O1xuICAgICAgICAgICAgdEF0dGFjaG1lbnQudG9wID0gJ3RvcCc7XG5cbiAgICAgICAgICAgIHRvcCAtPSBoZWlnaHQ7XG4gICAgICAgICAgICBlQXR0YWNobWVudC50b3AgPSAnYm90dG9tJztcbiAgICAgICAgICB9IGVsc2UgaWYgKGVBdHRhY2htZW50LnRvcCA9PT0gJ2JvdHRvbScgJiYgdG9wIDwgYm91bmRzWzFdICYmIHRvcCArIChoZWlnaHQgKiAyIC0gdGFyZ2V0SGVpZ2h0KSA8PSBib3VuZHNbM10pIHtcbiAgICAgICAgICAgIHRvcCArPSBoZWlnaHQgLSB0YXJnZXRIZWlnaHQ7XG4gICAgICAgICAgICB0QXR0YWNobWVudC50b3AgPSAndG9wJztcblxuICAgICAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gJ3RvcCc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRBdHRhY2htZW50LnRvcCA9PT0gJ21pZGRsZScpIHtcbiAgICAgICAgICBpZiAodG9wICsgaGVpZ2h0ID4gYm91bmRzWzNdICYmIGVBdHRhY2htZW50LnRvcCA9PT0gJ3RvcCcpIHtcbiAgICAgICAgICAgIHRvcCAtPSBoZWlnaHQ7XG4gICAgICAgICAgICBlQXR0YWNobWVudC50b3AgPSAnYm90dG9tJztcbiAgICAgICAgICB9IGVsc2UgaWYgKHRvcCA8IGJvdW5kc1sxXSAmJiBlQXR0YWNobWVudC50b3AgPT09ICdib3R0b20nKSB7XG4gICAgICAgICAgICB0b3AgKz0gaGVpZ2h0O1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gJ3RvcCc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChjaGFuZ2VBdHRhY2hYID09PSAndGFyZ2V0JyB8fCBjaGFuZ2VBdHRhY2hYID09PSAnYm90aCcpIHtcbiAgICAgICAgaWYgKGxlZnQgPCBib3VuZHNbMF0gJiYgdEF0dGFjaG1lbnQubGVmdCA9PT0gJ2xlZnQnKSB7XG4gICAgICAgICAgbGVmdCArPSB0YXJnZXRXaWR0aDtcbiAgICAgICAgICB0QXR0YWNobWVudC5sZWZ0ID0gJ3JpZ2h0JztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsZWZ0ICsgd2lkdGggPiBib3VuZHNbMl0gJiYgdEF0dGFjaG1lbnQubGVmdCA9PT0gJ3JpZ2h0Jykge1xuICAgICAgICAgIGxlZnQgLT0gdGFyZ2V0V2lkdGg7XG4gICAgICAgICAgdEF0dGFjaG1lbnQubGVmdCA9ICdsZWZ0JztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoY2hhbmdlQXR0YWNoWCA9PT0gJ3RvZ2V0aGVyJykge1xuICAgICAgICBpZiAobGVmdCA8IGJvdW5kc1swXSAmJiB0QXR0YWNobWVudC5sZWZ0ID09PSAnbGVmdCcpIHtcbiAgICAgICAgICBpZiAoZUF0dGFjaG1lbnQubGVmdCA9PT0gJ3JpZ2h0Jykge1xuICAgICAgICAgICAgbGVmdCArPSB0YXJnZXRXaWR0aDtcbiAgICAgICAgICAgIHRBdHRhY2htZW50LmxlZnQgPSAncmlnaHQnO1xuXG4gICAgICAgICAgICBsZWZ0ICs9IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdsZWZ0JztcbiAgICAgICAgICB9IGVsc2UgaWYgKGVBdHRhY2htZW50LmxlZnQgPT09ICdsZWZ0Jykge1xuICAgICAgICAgICAgbGVmdCArPSB0YXJnZXRXaWR0aDtcbiAgICAgICAgICAgIHRBdHRhY2htZW50LmxlZnQgPSAncmlnaHQnO1xuXG4gICAgICAgICAgICBsZWZ0IC09IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdyaWdodCc7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGxlZnQgKyB3aWR0aCA+IGJvdW5kc1syXSAmJiB0QXR0YWNobWVudC5sZWZ0ID09PSAncmlnaHQnKSB7XG4gICAgICAgICAgaWYgKGVBdHRhY2htZW50LmxlZnQgPT09ICdsZWZ0Jykge1xuICAgICAgICAgICAgbGVmdCAtPSB0YXJnZXRXaWR0aDtcbiAgICAgICAgICAgIHRBdHRhY2htZW50LmxlZnQgPSAnbGVmdCc7XG5cbiAgICAgICAgICAgIGxlZnQgLT0gd2lkdGg7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ3JpZ2h0JztcbiAgICAgICAgICB9IGVsc2UgaWYgKGVBdHRhY2htZW50LmxlZnQgPT09ICdyaWdodCcpIHtcbiAgICAgICAgICAgIGxlZnQgLT0gdGFyZ2V0V2lkdGg7XG4gICAgICAgICAgICB0QXR0YWNobWVudC5sZWZ0ID0gJ2xlZnQnO1xuXG4gICAgICAgICAgICBsZWZ0ICs9IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdsZWZ0JztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodEF0dGFjaG1lbnQubGVmdCA9PT0gJ2NlbnRlcicpIHtcbiAgICAgICAgICBpZiAobGVmdCArIHdpZHRoID4gYm91bmRzWzJdICYmIGVBdHRhY2htZW50LmxlZnQgPT09ICdsZWZ0Jykge1xuICAgICAgICAgICAgbGVmdCAtPSB3aWR0aDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSAncmlnaHQnO1xuICAgICAgICAgIH0gZWxzZSBpZiAobGVmdCA8IGJvdW5kc1swXSAmJiBlQXR0YWNobWVudC5sZWZ0ID09PSAncmlnaHQnKSB7XG4gICAgICAgICAgICBsZWZ0ICs9IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdsZWZ0JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGNoYW5nZUF0dGFjaFkgPT09ICdlbGVtZW50JyB8fCBjaGFuZ2VBdHRhY2hZID09PSAnYm90aCcpIHtcbiAgICAgICAgaWYgKHRvcCA8IGJvdW5kc1sxXSAmJiBlQXR0YWNobWVudC50b3AgPT09ICdib3R0b20nKSB7XG4gICAgICAgICAgdG9wICs9IGhlaWdodDtcbiAgICAgICAgICBlQXR0YWNobWVudC50b3AgPSAndG9wJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0b3AgKyBoZWlnaHQgPiBib3VuZHNbM10gJiYgZUF0dGFjaG1lbnQudG9wID09PSAndG9wJykge1xuICAgICAgICAgIHRvcCAtPSBoZWlnaHQ7XG4gICAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gJ2JvdHRvbSc7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGNoYW5nZUF0dGFjaFggPT09ICdlbGVtZW50JyB8fCBjaGFuZ2VBdHRhY2hYID09PSAnYm90aCcpIHtcbiAgICAgICAgaWYgKGxlZnQgPCBib3VuZHNbMF0pIHtcbiAgICAgICAgICBpZiAoZUF0dGFjaG1lbnQubGVmdCA9PT0gJ3JpZ2h0Jykge1xuICAgICAgICAgICAgbGVmdCArPSB3aWR0aDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSAnbGVmdCc7XG4gICAgICAgICAgfSBlbHNlIGlmIChlQXR0YWNobWVudC5sZWZ0ID09PSAnY2VudGVyJykge1xuICAgICAgICAgICAgbGVmdCArPSB3aWR0aCAvIDI7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ2xlZnQnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsZWZ0ICsgd2lkdGggPiBib3VuZHNbMl0pIHtcbiAgICAgICAgICBpZiAoZUF0dGFjaG1lbnQubGVmdCA9PT0gJ2xlZnQnKSB7XG4gICAgICAgICAgICBsZWZ0IC09IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdyaWdodCc7XG4gICAgICAgICAgfSBlbHNlIGlmIChlQXR0YWNobWVudC5sZWZ0ID09PSAnY2VudGVyJykge1xuICAgICAgICAgICAgbGVmdCAtPSB3aWR0aCAvIDI7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ3JpZ2h0JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBwaW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHBpbiA9IHBpbi5zcGxpdCgnLCcpLm1hcChmdW5jdGlvbiAocCkge1xuICAgICAgICAgIHJldHVybiBwLnRyaW0oKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHBpbiA9PT0gdHJ1ZSkge1xuICAgICAgICBwaW4gPSBbJ3RvcCcsICdsZWZ0JywgJ3JpZ2h0JywgJ2JvdHRvbSddO1xuICAgICAgfVxuXG4gICAgICBwaW4gPSBwaW4gfHwgW107XG5cbiAgICAgIHZhciBwaW5uZWQgPSBbXTtcbiAgICAgIHZhciBvb2IgPSBbXTtcblxuICAgICAgaWYgKHRvcCA8IGJvdW5kc1sxXSkge1xuICAgICAgICBpZiAocGluLmluZGV4T2YoJ3RvcCcpID49IDApIHtcbiAgICAgICAgICB0b3AgPSBib3VuZHNbMV07XG4gICAgICAgICAgcGlubmVkLnB1c2goJ3RvcCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9vYi5wdXNoKCd0b3AnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodG9wICsgaGVpZ2h0ID4gYm91bmRzWzNdKSB7XG4gICAgICAgIGlmIChwaW4uaW5kZXhPZignYm90dG9tJykgPj0gMCkge1xuICAgICAgICAgIHRvcCA9IGJvdW5kc1szXSAtIGhlaWdodDtcbiAgICAgICAgICBwaW5uZWQucHVzaCgnYm90dG9tJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb29iLnB1c2goJ2JvdHRvbScpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChsZWZ0IDwgYm91bmRzWzBdKSB7XG4gICAgICAgIGlmIChwaW4uaW5kZXhPZignbGVmdCcpID49IDApIHtcbiAgICAgICAgICBsZWZ0ID0gYm91bmRzWzBdO1xuICAgICAgICAgIHBpbm5lZC5wdXNoKCdsZWZ0Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb29iLnB1c2goJ2xlZnQnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobGVmdCArIHdpZHRoID4gYm91bmRzWzJdKSB7XG4gICAgICAgIGlmIChwaW4uaW5kZXhPZigncmlnaHQnKSA+PSAwKSB7XG4gICAgICAgICAgbGVmdCA9IGJvdW5kc1syXSAtIHdpZHRoO1xuICAgICAgICAgIHBpbm5lZC5wdXNoKCdyaWdodCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9vYi5wdXNoKCdyaWdodCcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChwaW5uZWQubGVuZ3RoKSB7XG4gICAgICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIHBpbm5lZENsYXNzID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGlmICh0eXBlb2YgX3RoaXMub3B0aW9ucy5waW5uZWRDbGFzcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHBpbm5lZENsYXNzID0gX3RoaXMub3B0aW9ucy5waW5uZWRDbGFzcztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGlubmVkQ2xhc3MgPSBfdGhpcy5nZXRDbGFzcygncGlubmVkJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYWRkQ2xhc3Nlcy5wdXNoKHBpbm5lZENsYXNzKTtcbiAgICAgICAgICBwaW5uZWQuZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgICAgICAgYWRkQ2xhc3Nlcy5wdXNoKHBpbm5lZENsYXNzICsgJy0nICsgc2lkZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvb2IubGVuZ3RoKSB7XG4gICAgICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIG9vYkNsYXNzID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGlmICh0eXBlb2YgX3RoaXMub3B0aW9ucy5vdXRPZkJvdW5kc0NsYXNzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgb29iQ2xhc3MgPSBfdGhpcy5vcHRpb25zLm91dE9mQm91bmRzQ2xhc3M7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9vYkNsYXNzID0gX3RoaXMuZ2V0Q2xhc3MoJ291dC1vZi1ib3VuZHMnKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhZGRDbGFzc2VzLnB1c2gob29iQ2xhc3MpO1xuICAgICAgICAgIG9vYi5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICAgICAgICBhZGRDbGFzc2VzLnB1c2gob29iQ2xhc3MgKyAnLScgKyBzaWRlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHBpbm5lZC5pbmRleE9mKCdsZWZ0JykgPj0gMCB8fCBwaW5uZWQuaW5kZXhPZigncmlnaHQnKSA+PSAwKSB7XG4gICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSB0QXR0YWNobWVudC5sZWZ0ID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAocGlubmVkLmluZGV4T2YoJ3RvcCcpID49IDAgfHwgcGlubmVkLmluZGV4T2YoJ2JvdHRvbScpID49IDApIHtcbiAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gdEF0dGFjaG1lbnQudG9wID0gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGlmICh0QXR0YWNobWVudC50b3AgIT09IHRhcmdldEF0dGFjaG1lbnQudG9wIHx8IHRBdHRhY2htZW50LmxlZnQgIT09IHRhcmdldEF0dGFjaG1lbnQubGVmdCB8fCBlQXR0YWNobWVudC50b3AgIT09IF90aGlzLmF0dGFjaG1lbnQudG9wIHx8IGVBdHRhY2htZW50LmxlZnQgIT09IF90aGlzLmF0dGFjaG1lbnQubGVmdCkge1xuICAgICAgICBfdGhpcy51cGRhdGVBdHRhY2hDbGFzc2VzKGVBdHRhY2htZW50LCB0QXR0YWNobWVudCk7XG4gICAgICAgIF90aGlzLnRyaWdnZXIoJ3VwZGF0ZScsIHtcbiAgICAgICAgICBhdHRhY2htZW50OiBlQXR0YWNobWVudCxcbiAgICAgICAgICB0YXJnZXRBdHRhY2htZW50OiB0QXR0YWNobWVudFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGRlZmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghKF90aGlzLm9wdGlvbnMuYWRkVGFyZ2V0Q2xhc3NlcyA9PT0gZmFsc2UpKSB7XG4gICAgICAgIHVwZGF0ZUNsYXNzZXMoX3RoaXMudGFyZ2V0LCBhZGRDbGFzc2VzLCBhbGxDbGFzc2VzKTtcbiAgICAgIH1cbiAgICAgIHVwZGF0ZUNsYXNzZXMoX3RoaXMuZWxlbWVudCwgYWRkQ2xhc3NlcywgYWxsQ2xhc3Nlcyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4geyB0b3A6IHRvcCwgbGVmdDogbGVmdCB9O1xuICB9XG59KTtcbi8qIGdsb2JhbHMgVGV0aGVyQmFzZSAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfVGV0aGVyQmFzZSRVdGlscyA9IFRldGhlckJhc2UuVXRpbHM7XG52YXIgZ2V0Qm91bmRzID0gX1RldGhlckJhc2UkVXRpbHMuZ2V0Qm91bmRzO1xudmFyIHVwZGF0ZUNsYXNzZXMgPSBfVGV0aGVyQmFzZSRVdGlscy51cGRhdGVDbGFzc2VzO1xudmFyIGRlZmVyID0gX1RldGhlckJhc2UkVXRpbHMuZGVmZXI7XG5cblRldGhlckJhc2UubW9kdWxlcy5wdXNoKHtcbiAgcG9zaXRpb246IGZ1bmN0aW9uIHBvc2l0aW9uKF9yZWYpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgdmFyIHRvcCA9IF9yZWYudG9wO1xuICAgIHZhciBsZWZ0ID0gX3JlZi5sZWZ0O1xuXG4gICAgdmFyIF9jYWNoZSA9IHRoaXMuY2FjaGUoJ2VsZW1lbnQtYm91bmRzJywgZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGdldEJvdW5kcyhfdGhpcy5lbGVtZW50KTtcbiAgICB9KTtcblxuICAgIHZhciBoZWlnaHQgPSBfY2FjaGUuaGVpZ2h0O1xuICAgIHZhciB3aWR0aCA9IF9jYWNoZS53aWR0aDtcblxuICAgIHZhciB0YXJnZXRQb3MgPSB0aGlzLmdldFRhcmdldEJvdW5kcygpO1xuXG4gICAgdmFyIGJvdHRvbSA9IHRvcCArIGhlaWdodDtcbiAgICB2YXIgcmlnaHQgPSBsZWZ0ICsgd2lkdGg7XG5cbiAgICB2YXIgYWJ1dHRlZCA9IFtdO1xuICAgIGlmICh0b3AgPD0gdGFyZ2V0UG9zLmJvdHRvbSAmJiBib3R0b20gPj0gdGFyZ2V0UG9zLnRvcCkge1xuICAgICAgWydsZWZ0JywgJ3JpZ2h0J10uZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgICB2YXIgdGFyZ2V0UG9zU2lkZSA9IHRhcmdldFBvc1tzaWRlXTtcbiAgICAgICAgaWYgKHRhcmdldFBvc1NpZGUgPT09IGxlZnQgfHwgdGFyZ2V0UG9zU2lkZSA9PT0gcmlnaHQpIHtcbiAgICAgICAgICBhYnV0dGVkLnB1c2goc2lkZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChsZWZ0IDw9IHRhcmdldFBvcy5yaWdodCAmJiByaWdodCA+PSB0YXJnZXRQb3MubGVmdCkge1xuICAgICAgWyd0b3AnLCAnYm90dG9tJ10uZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgICB2YXIgdGFyZ2V0UG9zU2lkZSA9IHRhcmdldFBvc1tzaWRlXTtcbiAgICAgICAgaWYgKHRhcmdldFBvc1NpZGUgPT09IHRvcCB8fCB0YXJnZXRQb3NTaWRlID09PSBib3R0b20pIHtcbiAgICAgICAgICBhYnV0dGVkLnB1c2goc2lkZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHZhciBhbGxDbGFzc2VzID0gW107XG4gICAgdmFyIGFkZENsYXNzZXMgPSBbXTtcblxuICAgIHZhciBzaWRlcyA9IFsnbGVmdCcsICd0b3AnLCAncmlnaHQnLCAnYm90dG9tJ107XG4gICAgYWxsQ2xhc3Nlcy5wdXNoKHRoaXMuZ2V0Q2xhc3MoJ2FidXR0ZWQnKSk7XG4gICAgc2lkZXMuZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgYWxsQ2xhc3Nlcy5wdXNoKF90aGlzLmdldENsYXNzKCdhYnV0dGVkJykgKyAnLScgKyBzaWRlKTtcbiAgICB9KTtcblxuICAgIGlmIChhYnV0dGVkLmxlbmd0aCkge1xuICAgICAgYWRkQ2xhc3Nlcy5wdXNoKHRoaXMuZ2V0Q2xhc3MoJ2FidXR0ZWQnKSk7XG4gICAgfVxuXG4gICAgYWJ1dHRlZC5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICBhZGRDbGFzc2VzLnB1c2goX3RoaXMuZ2V0Q2xhc3MoJ2FidXR0ZWQnKSArICctJyArIHNpZGUpO1xuICAgIH0pO1xuXG4gICAgZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKCEoX3RoaXMub3B0aW9ucy5hZGRUYXJnZXRDbGFzc2VzID09PSBmYWxzZSkpIHtcbiAgICAgICAgdXBkYXRlQ2xhc3NlcyhfdGhpcy50YXJnZXQsIGFkZENsYXNzZXMsIGFsbENsYXNzZXMpO1xuICAgICAgfVxuICAgICAgdXBkYXRlQ2xhc3NlcyhfdGhpcy5lbGVtZW50LCBhZGRDbGFzc2VzLCBhbGxDbGFzc2VzKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG59KTtcbi8qIGdsb2JhbHMgVGV0aGVyQmFzZSAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfc2xpY2VkVG9BcnJheSA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIHNsaWNlSXRlcmF0b3IoYXJyLCBpKSB7IHZhciBfYXJyID0gW107IHZhciBfbiA9IHRydWU7IHZhciBfZCA9IGZhbHNlOyB2YXIgX2UgPSB1bmRlZmluZWQ7IHRyeSB7IGZvciAodmFyIF9pID0gYXJyW1N5bWJvbC5pdGVyYXRvcl0oKSwgX3M7ICEoX24gPSAoX3MgPSBfaS5uZXh0KCkpLmRvbmUpOyBfbiA9IHRydWUpIHsgX2Fyci5wdXNoKF9zLnZhbHVlKTsgaWYgKGkgJiYgX2Fyci5sZW5ndGggPT09IGkpIGJyZWFrOyB9IH0gY2F0Y2ggKGVycikgeyBfZCA9IHRydWU7IF9lID0gZXJyOyB9IGZpbmFsbHkgeyB0cnkgeyBpZiAoIV9uICYmIF9pWydyZXR1cm4nXSkgX2lbJ3JldHVybiddKCk7IH0gZmluYWxseSB7IGlmIChfZCkgdGhyb3cgX2U7IH0gfSByZXR1cm4gX2FycjsgfSByZXR1cm4gZnVuY3Rpb24gKGFyciwgaSkgeyBpZiAoQXJyYXkuaXNBcnJheShhcnIpKSB7IHJldHVybiBhcnI7IH0gZWxzZSBpZiAoU3ltYm9sLml0ZXJhdG9yIGluIE9iamVjdChhcnIpKSB7IHJldHVybiBzbGljZUl0ZXJhdG9yKGFyciwgaSk7IH0gZWxzZSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgYXR0ZW1wdCB0byBkZXN0cnVjdHVyZSBub24taXRlcmFibGUgaW5zdGFuY2UnKTsgfSB9OyB9KSgpO1xuXG5UZXRoZXJCYXNlLm1vZHVsZXMucHVzaCh7XG4gIHBvc2l0aW9uOiBmdW5jdGlvbiBwb3NpdGlvbihfcmVmKSB7XG4gICAgdmFyIHRvcCA9IF9yZWYudG9wO1xuICAgIHZhciBsZWZ0ID0gX3JlZi5sZWZ0O1xuXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuc2hpZnQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgc2hpZnQgPSB0aGlzLm9wdGlvbnMuc2hpZnQ7XG4gICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMuc2hpZnQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHNoaWZ0ID0gdGhpcy5vcHRpb25zLnNoaWZ0LmNhbGwodGhpcywgeyB0b3A6IHRvcCwgbGVmdDogbGVmdCB9KTtcbiAgICB9XG5cbiAgICB2YXIgc2hpZnRUb3AgPSB1bmRlZmluZWQsXG4gICAgICAgIHNoaWZ0TGVmdCA9IHVuZGVmaW5lZDtcbiAgICBpZiAodHlwZW9mIHNoaWZ0ID09PSAnc3RyaW5nJykge1xuICAgICAgc2hpZnQgPSBzaGlmdC5zcGxpdCgnICcpO1xuICAgICAgc2hpZnRbMV0gPSBzaGlmdFsxXSB8fCBzaGlmdFswXTtcblxuICAgICAgdmFyIF9zaGlmdCA9IHNoaWZ0O1xuXG4gICAgICB2YXIgX3NoaWZ0MiA9IF9zbGljZWRUb0FycmF5KF9zaGlmdCwgMik7XG5cbiAgICAgIHNoaWZ0VG9wID0gX3NoaWZ0MlswXTtcbiAgICAgIHNoaWZ0TGVmdCA9IF9zaGlmdDJbMV07XG5cbiAgICAgIHNoaWZ0VG9wID0gcGFyc2VGbG9hdChzaGlmdFRvcCwgMTApO1xuICAgICAgc2hpZnRMZWZ0ID0gcGFyc2VGbG9hdChzaGlmdExlZnQsIDEwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2hpZnRUb3AgPSBzaGlmdC50b3A7XG4gICAgICBzaGlmdExlZnQgPSBzaGlmdC5sZWZ0O1xuICAgIH1cblxuICAgIHRvcCArPSBzaGlmdFRvcDtcbiAgICBsZWZ0ICs9IHNoaWZ0TGVmdDtcblxuICAgIHJldHVybiB7IHRvcDogdG9wLCBsZWZ0OiBsZWZ0IH07XG4gIH1cbn0pO1xucmV0dXJuIFRldGhlcjtcblxufSkpO1xuIiwiLyoqXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogQm9vdHN0cmFwICh2NC4wLjAtYWxwaGEuNik6IHV0aWwuanNcbiAqIExpY2Vuc2VkIHVuZGVyIE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2Jsb2IvbWFzdGVyL0xJQ0VOU0UpXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICovXG5cbnZhciBVdGlsID0gZnVuY3Rpb24gKCQpIHtcblxuICAvKipcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIFByaXZhdGUgVHJhbnNpdGlvbkVuZCBIZWxwZXJzXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuICB2YXIgdHJhbnNpdGlvbiA9IGZhbHNlO1xuXG4gIHZhciBNQVhfVUlEID0gMTAwMDAwMDtcblxuICB2YXIgVHJhbnNpdGlvbkVuZEV2ZW50ID0ge1xuICAgIFdlYmtpdFRyYW5zaXRpb246ICd3ZWJraXRUcmFuc2l0aW9uRW5kJyxcbiAgICBNb3pUcmFuc2l0aW9uOiAndHJhbnNpdGlvbmVuZCcsXG4gICAgT1RyYW5zaXRpb246ICdvVHJhbnNpdGlvbkVuZCBvdHJhbnNpdGlvbmVuZCcsXG4gICAgdHJhbnNpdGlvbjogJ3RyYW5zaXRpb25lbmQnXG4gIH07XG5cbiAgLy8gc2hvdXRvdXQgQW5ndXNDcm9sbCAoaHR0cHM6Ly9nb28uZ2wvcHh3UUdwKVxuICBmdW5jdGlvbiB0b1R5cGUob2JqKSB7XG4gICAgcmV0dXJuIHt9LnRvU3RyaW5nLmNhbGwob2JqKS5tYXRjaCgvXFxzKFthLXpBLVpdKykvKVsxXS50b0xvd2VyQ2FzZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gaXNFbGVtZW50KG9iaikge1xuICAgIHJldHVybiAob2JqWzBdIHx8IG9iaikubm9kZVR5cGU7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRTcGVjaWFsVHJhbnNpdGlvbkVuZEV2ZW50KCkge1xuICAgIHJldHVybiB7XG4gICAgICBiaW5kVHlwZTogdHJhbnNpdGlvbi5lbmQsXG4gICAgICBkZWxlZ2F0ZVR5cGU6IHRyYW5zaXRpb24uZW5kLFxuICAgICAgaGFuZGxlOiBmdW5jdGlvbiBoYW5kbGUoZXZlbnQpIHtcbiAgICAgICAgaWYgKCQoZXZlbnQudGFyZ2V0KS5pcyh0aGlzKSkge1xuICAgICAgICAgIHJldHVybiBldmVudC5oYW5kbGVPYmouaGFuZGxlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIHByZWZlci1yZXN0LXBhcmFtc1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyYW5zaXRpb25FbmRUZXN0KCkge1xuICAgIGlmICh3aW5kb3cuUVVuaXQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdib290c3RyYXAnKTtcblxuICAgIGZvciAodmFyIG5hbWUgaW4gVHJhbnNpdGlvbkVuZEV2ZW50KSB7XG4gICAgICBpZiAoZWwuc3R5bGVbbmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGVuZDogVHJhbnNpdGlvbkVuZEV2ZW50W25hbWVdXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZnVuY3Rpb24gdHJhbnNpdGlvbkVuZEVtdWxhdG9yKGR1cmF0aW9uKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgIHZhciBjYWxsZWQgPSBmYWxzZTtcblxuICAgICQodGhpcykub25lKFV0aWwuVFJBTlNJVElPTl9FTkQsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxlZCA9IHRydWU7XG4gICAgfSk7XG5cbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgIFV0aWwudHJpZ2dlclRyYW5zaXRpb25FbmQoX3RoaXMpO1xuICAgICAgfVxuICAgIH0sIGR1cmF0aW9uKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0VHJhbnNpdGlvbkVuZFN1cHBvcnQoKSB7XG4gICAgdHJhbnNpdGlvbiA9IHRyYW5zaXRpb25FbmRUZXN0KCk7XG5cbiAgICAkLmZuLmVtdWxhdGVUcmFuc2l0aW9uRW5kID0gdHJhbnNpdGlvbkVuZEVtdWxhdG9yO1xuXG4gICAgaWYgKFV0aWwuc3VwcG9ydHNUcmFuc2l0aW9uRW5kKCkpIHtcbiAgICAgICQuZXZlbnQuc3BlY2lhbFtVdGlsLlRSQU5TSVRJT05fRU5EXSA9IGdldFNwZWNpYWxUcmFuc2l0aW9uRW5kRXZlbnQoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogUHVibGljIFV0aWwgQXBpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG4gIHZhciBVdGlsID0ge1xuXG4gICAgVFJBTlNJVElPTl9FTkQ6ICdic1RyYW5zaXRpb25FbmQnLFxuXG4gICAgZ2V0VUlEOiBmdW5jdGlvbiBnZXRVSUQocHJlZml4KSB7XG4gICAgICBkbyB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1iaXR3aXNlXG4gICAgICAgIHByZWZpeCArPSB+fihNYXRoLnJhbmRvbSgpICogTUFYX1VJRCk7IC8vIFwifn5cIiBhY3RzIGxpa2UgYSBmYXN0ZXIgTWF0aC5mbG9vcigpIGhlcmVcbiAgICAgIH0gd2hpbGUgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHByZWZpeCkpO1xuICAgICAgcmV0dXJuIHByZWZpeDtcbiAgICB9LFxuICAgIGdldFNlbGVjdG9yRnJvbUVsZW1lbnQ6IGZ1bmN0aW9uIGdldFNlbGVjdG9yRnJvbUVsZW1lbnQoZWxlbWVudCkge1xuICAgICAgdmFyIHNlbGVjdG9yID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGFyZ2V0Jyk7XG5cbiAgICAgIGlmICghc2VsZWN0b3IpIHtcbiAgICAgICAgc2VsZWN0b3IgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgnaHJlZicpIHx8ICcnO1xuICAgICAgICBzZWxlY3RvciA9IC9eI1thLXpdL2kudGVzdChzZWxlY3RvcikgPyBzZWxlY3RvciA6IG51bGw7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzZWxlY3RvcjtcbiAgICB9LFxuICAgIHJlZmxvdzogZnVuY3Rpb24gcmVmbG93KGVsZW1lbnQpIHtcbiAgICAgIHJldHVybiBlbGVtZW50Lm9mZnNldEhlaWdodDtcbiAgICB9LFxuICAgIHRyaWdnZXJUcmFuc2l0aW9uRW5kOiBmdW5jdGlvbiB0cmlnZ2VyVHJhbnNpdGlvbkVuZChlbGVtZW50KSB7XG4gICAgICAkKGVsZW1lbnQpLnRyaWdnZXIodHJhbnNpdGlvbi5lbmQpO1xuICAgIH0sXG4gICAgc3VwcG9ydHNUcmFuc2l0aW9uRW5kOiBmdW5jdGlvbiBzdXBwb3J0c1RyYW5zaXRpb25FbmQoKSB7XG4gICAgICByZXR1cm4gQm9vbGVhbih0cmFuc2l0aW9uKTtcbiAgICB9LFxuICAgIHR5cGVDaGVja0NvbmZpZzogZnVuY3Rpb24gdHlwZUNoZWNrQ29uZmlnKGNvbXBvbmVudE5hbWUsIGNvbmZpZywgY29uZmlnVHlwZXMpIHtcbiAgICAgIGZvciAodmFyIHByb3BlcnR5IGluIGNvbmZpZ1R5cGVzKSB7XG4gICAgICAgIGlmIChjb25maWdUeXBlcy5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcbiAgICAgICAgICB2YXIgZXhwZWN0ZWRUeXBlcyA9IGNvbmZpZ1R5cGVzW3Byb3BlcnR5XTtcbiAgICAgICAgICB2YXIgdmFsdWUgPSBjb25maWdbcHJvcGVydHldO1xuICAgICAgICAgIHZhciB2YWx1ZVR5cGUgPSB2YWx1ZSAmJiBpc0VsZW1lbnQodmFsdWUpID8gJ2VsZW1lbnQnIDogdG9UeXBlKHZhbHVlKTtcblxuICAgICAgICAgIGlmICghbmV3IFJlZ0V4cChleHBlY3RlZFR5cGVzKS50ZXN0KHZhbHVlVHlwZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihjb21wb25lbnROYW1lLnRvVXBwZXJDYXNlKCkgKyAnOiAnICsgKCdPcHRpb24gXCInICsgcHJvcGVydHkgKyAnXCIgcHJvdmlkZWQgdHlwZSBcIicgKyB2YWx1ZVR5cGUgKyAnXCIgJykgKyAoJ2J1dCBleHBlY3RlZCB0eXBlIFwiJyArIGV4cGVjdGVkVHlwZXMgKyAnXCIuJykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBzZXRUcmFuc2l0aW9uRW5kU3VwcG9ydCgpO1xuXG4gIHJldHVybiBVdGlsO1xufShqUXVlcnkpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dXRpbC5qcy5tYXBcbiIsInZhciBfdHlwZW9mID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIgPyBmdW5jdGlvbiAob2JqKSB7IHJldHVybiB0eXBlb2Ygb2JqOyB9IDogZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCAmJiBvYmogIT09IFN5bWJvbC5wcm90b3R5cGUgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajsgfTtcblxudmFyIF9jcmVhdGVDbGFzcyA9IGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmIChcInZhbHVlXCIgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0oKTtcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH1cblxuLyoqXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogQm9vdHN0cmFwICh2NC4wLjAtYWxwaGEuNik6IG1vZGFsLmpzXG4gKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21hc3Rlci9MSUNFTlNFKVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqL1xuXG52YXIgTW9kYWwgPSBmdW5jdGlvbiAoJCkge1xuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogQ29uc3RhbnRzXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuICB2YXIgTkFNRSA9ICdtb2RhbCc7XG4gIHZhciBWRVJTSU9OID0gJzQuMC4wLWFscGhhLjYnO1xuICB2YXIgREFUQV9LRVkgPSAnYnMubW9kYWwnO1xuICB2YXIgRVZFTlRfS0VZID0gJy4nICsgREFUQV9LRVk7XG4gIHZhciBEQVRBX0FQSV9LRVkgPSAnLmRhdGEtYXBpJztcbiAgdmFyIEpRVUVSWV9OT19DT05GTElDVCA9ICQuZm5bTkFNRV07XG4gIHZhciBUUkFOU0lUSU9OX0RVUkFUSU9OID0gMzAwO1xuICB2YXIgQkFDS0RST1BfVFJBTlNJVElPTl9EVVJBVElPTiA9IDE1MDtcbiAgdmFyIEVTQ0FQRV9LRVlDT0RFID0gMjc7IC8vIEtleWJvYXJkRXZlbnQud2hpY2ggdmFsdWUgZm9yIEVzY2FwZSAoRXNjKSBrZXlcblxuICB2YXIgRGVmYXVsdCA9IHtcbiAgICBiYWNrZHJvcDogdHJ1ZSxcbiAgICBrZXlib2FyZDogdHJ1ZSxcbiAgICBmb2N1czogdHJ1ZSxcbiAgICBzaG93OiB0cnVlXG4gIH07XG5cbiAgdmFyIERlZmF1bHRUeXBlID0ge1xuICAgIGJhY2tkcm9wOiAnKGJvb2xlYW58c3RyaW5nKScsXG4gICAga2V5Ym9hcmQ6ICdib29sZWFuJyxcbiAgICBmb2N1czogJ2Jvb2xlYW4nLFxuICAgIHNob3c6ICdib29sZWFuJ1xuICB9O1xuXG4gIHZhciBFdmVudCA9IHtcbiAgICBISURFOiAnaGlkZScgKyBFVkVOVF9LRVksXG4gICAgSElEREVOOiAnaGlkZGVuJyArIEVWRU5UX0tFWSxcbiAgICBTSE9XOiAnc2hvdycgKyBFVkVOVF9LRVksXG4gICAgU0hPV046ICdzaG93bicgKyBFVkVOVF9LRVksXG4gICAgRk9DVVNJTjogJ2ZvY3VzaW4nICsgRVZFTlRfS0VZLFxuICAgIFJFU0laRTogJ3Jlc2l6ZScgKyBFVkVOVF9LRVksXG4gICAgQ0xJQ0tfRElTTUlTUzogJ2NsaWNrLmRpc21pc3MnICsgRVZFTlRfS0VZLFxuICAgIEtFWURPV05fRElTTUlTUzogJ2tleWRvd24uZGlzbWlzcycgKyBFVkVOVF9LRVksXG4gICAgTU9VU0VVUF9ESVNNSVNTOiAnbW91c2V1cC5kaXNtaXNzJyArIEVWRU5UX0tFWSxcbiAgICBNT1VTRURPV05fRElTTUlTUzogJ21vdXNlZG93bi5kaXNtaXNzJyArIEVWRU5UX0tFWSxcbiAgICBDTElDS19EQVRBX0FQSTogJ2NsaWNrJyArIEVWRU5UX0tFWSArIERBVEFfQVBJX0tFWVxuICB9O1xuXG4gIHZhciBDbGFzc05hbWUgPSB7XG4gICAgU0NST0xMQkFSX01FQVNVUkVSOiAnbW9kYWwtc2Nyb2xsYmFyLW1lYXN1cmUnLFxuICAgIEJBQ0tEUk9QOiAnbW9kYWwtYmFja2Ryb3AnLFxuICAgIE9QRU46ICdtb2RhbC1vcGVuJyxcbiAgICBGQURFOiAnZmFkZScsXG4gICAgU0hPVzogJ3Nob3cnXG4gIH07XG5cbiAgdmFyIFNlbGVjdG9yID0ge1xuICAgIERJQUxPRzogJy5tb2RhbC1kaWFsb2cnLFxuICAgIERBVEFfVE9HR0xFOiAnW2RhdGEtdG9nZ2xlPVwibW9kYWxcIl0nLFxuICAgIERBVEFfRElTTUlTUzogJ1tkYXRhLWRpc21pc3M9XCJtb2RhbFwiXScsXG4gICAgRklYRURfQ09OVEVOVDogJy5maXhlZC10b3AsIC5maXhlZC1ib3R0b20sIC5pcy1maXhlZCwgLnN0aWNreS10b3AnXG4gIH07XG5cbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBDbGFzcyBEZWZpbml0aW9uXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuICB2YXIgTW9kYWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gTW9kYWwoZWxlbWVudCwgY29uZmlnKSB7XG4gICAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgTW9kYWwpO1xuXG4gICAgICB0aGlzLl9jb25maWcgPSB0aGlzLl9nZXRDb25maWcoY29uZmlnKTtcbiAgICAgIHRoaXMuX2VsZW1lbnQgPSBlbGVtZW50O1xuICAgICAgdGhpcy5fZGlhbG9nID0gJChlbGVtZW50KS5maW5kKFNlbGVjdG9yLkRJQUxPRylbMF07XG4gICAgICB0aGlzLl9iYWNrZHJvcCA9IG51bGw7XG4gICAgICB0aGlzLl9pc1Nob3duID0gZmFsc2U7XG4gICAgICB0aGlzLl9pc0JvZHlPdmVyZmxvd2luZyA9IGZhbHNlO1xuICAgICAgdGhpcy5faWdub3JlQmFja2Ryb3BDbGljayA9IGZhbHNlO1xuICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICB0aGlzLl9vcmlnaW5hbEJvZHlQYWRkaW5nID0gMDtcbiAgICAgIHRoaXMuX3Njcm9sbGJhcldpZHRoID0gMDtcbiAgICB9XG5cbiAgICAvLyBnZXR0ZXJzXG5cbiAgICAvLyBwdWJsaWNcblxuICAgIE1vZGFsLnByb3RvdHlwZS50b2dnbGUgPSBmdW5jdGlvbiB0b2dnbGUocmVsYXRlZFRhcmdldCkge1xuICAgICAgcmV0dXJuIHRoaXMuX2lzU2hvd24gPyB0aGlzLmhpZGUoKSA6IHRoaXMuc2hvdyhyZWxhdGVkVGFyZ2V0KTtcbiAgICB9O1xuXG4gICAgTW9kYWwucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiBzaG93KHJlbGF0ZWRUYXJnZXQpIHtcbiAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICAgIGlmICh0aGlzLl9pc1RyYW5zaXRpb25pbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNb2RhbCBpcyB0cmFuc2l0aW9uaW5nJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChVdGlsLnN1cHBvcnRzVHJhbnNpdGlvbkVuZCgpICYmICQodGhpcy5fZWxlbWVudCkuaGFzQ2xhc3MoQ2xhc3NOYW1lLkZBREUpKSB7XG4gICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IHRydWU7XG4gICAgICB9XG4gICAgICB2YXIgc2hvd0V2ZW50ID0gJC5FdmVudChFdmVudC5TSE9XLCB7XG4gICAgICAgIHJlbGF0ZWRUYXJnZXQ6IHJlbGF0ZWRUYXJnZXRcbiAgICAgIH0pO1xuXG4gICAgICAkKHRoaXMuX2VsZW1lbnQpLnRyaWdnZXIoc2hvd0V2ZW50KTtcblxuICAgICAgaWYgKHRoaXMuX2lzU2hvd24gfHwgc2hvd0V2ZW50LmlzRGVmYXVsdFByZXZlbnRlZCgpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5faXNTaG93biA9IHRydWU7XG5cbiAgICAgIHRoaXMuX2NoZWNrU2Nyb2xsYmFyKCk7XG4gICAgICB0aGlzLl9zZXRTY3JvbGxiYXIoKTtcblxuICAgICAgJChkb2N1bWVudC5ib2R5KS5hZGRDbGFzcyhDbGFzc05hbWUuT1BFTik7XG5cbiAgICAgIHRoaXMuX3NldEVzY2FwZUV2ZW50KCk7XG4gICAgICB0aGlzLl9zZXRSZXNpemVFdmVudCgpO1xuXG4gICAgICAkKHRoaXMuX2VsZW1lbnQpLm9uKEV2ZW50LkNMSUNLX0RJU01JU1MsIFNlbGVjdG9yLkRBVEFfRElTTUlTUywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIHJldHVybiBfdGhpcy5oaWRlKGV2ZW50KTtcbiAgICAgIH0pO1xuXG4gICAgICAkKHRoaXMuX2RpYWxvZykub24oRXZlbnQuTU9VU0VET1dOX0RJU01JU1MsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgJChfdGhpcy5fZWxlbWVudCkub25lKEV2ZW50Lk1PVVNFVVBfRElTTUlTUywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgaWYgKCQoZXZlbnQudGFyZ2V0KS5pcyhfdGhpcy5fZWxlbWVudCkpIHtcbiAgICAgICAgICAgIF90aGlzLl9pZ25vcmVCYWNrZHJvcENsaWNrID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX3Nob3dCYWNrZHJvcChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBfdGhpcy5fc2hvd0VsZW1lbnQocmVsYXRlZFRhcmdldCk7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgTW9kYWwucHJvdG90eXBlLmhpZGUgPSBmdW5jdGlvbiBoaWRlKGV2ZW50KSB7XG4gICAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgICAgaWYgKGV2ZW50KSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9pc1RyYW5zaXRpb25pbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNb2RhbCBpcyB0cmFuc2l0aW9uaW5nJyk7XG4gICAgICB9XG5cbiAgICAgIHZhciB0cmFuc2l0aW9uID0gVXRpbC5zdXBwb3J0c1RyYW5zaXRpb25FbmQoKSAmJiAkKHRoaXMuX2VsZW1lbnQpLmhhc0NsYXNzKENsYXNzTmFtZS5GQURFKTtcbiAgICAgIGlmICh0cmFuc2l0aW9uKSB7XG4gICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIHZhciBoaWRlRXZlbnQgPSAkLkV2ZW50KEV2ZW50LkhJREUpO1xuICAgICAgJCh0aGlzLl9lbGVtZW50KS50cmlnZ2VyKGhpZGVFdmVudCk7XG5cbiAgICAgIGlmICghdGhpcy5faXNTaG93biB8fCBoaWRlRXZlbnQuaXNEZWZhdWx0UHJldmVudGVkKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9pc1Nob3duID0gZmFsc2U7XG5cbiAgICAgIHRoaXMuX3NldEVzY2FwZUV2ZW50KCk7XG4gICAgICB0aGlzLl9zZXRSZXNpemVFdmVudCgpO1xuXG4gICAgICAkKGRvY3VtZW50KS5vZmYoRXZlbnQuRk9DVVNJTik7XG5cbiAgICAgICQodGhpcy5fZWxlbWVudCkucmVtb3ZlQ2xhc3MoQ2xhc3NOYW1lLlNIT1cpO1xuXG4gICAgICAkKHRoaXMuX2VsZW1lbnQpLm9mZihFdmVudC5DTElDS19ESVNNSVNTKTtcbiAgICAgICQodGhpcy5fZGlhbG9nKS5vZmYoRXZlbnQuTU9VU0VET1dOX0RJU01JU1MpO1xuXG4gICAgICBpZiAodHJhbnNpdGlvbikge1xuICAgICAgICAkKHRoaXMuX2VsZW1lbnQpLm9uZShVdGlsLlRSQU5TSVRJT05fRU5ELCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgICByZXR1cm4gX3RoaXMyLl9oaWRlTW9kYWwoZXZlbnQpO1xuICAgICAgICB9KS5lbXVsYXRlVHJhbnNpdGlvbkVuZChUUkFOU0lUSU9OX0RVUkFUSU9OKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2hpZGVNb2RhbCgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBNb2RhbC5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uIGRpc3Bvc2UoKSB7XG4gICAgICAkLnJlbW92ZURhdGEodGhpcy5fZWxlbWVudCwgREFUQV9LRVkpO1xuXG4gICAgICAkKHdpbmRvdywgZG9jdW1lbnQsIHRoaXMuX2VsZW1lbnQsIHRoaXMuX2JhY2tkcm9wKS5vZmYoRVZFTlRfS0VZKTtcblxuICAgICAgdGhpcy5fY29uZmlnID0gbnVsbDtcbiAgICAgIHRoaXMuX2VsZW1lbnQgPSBudWxsO1xuICAgICAgdGhpcy5fZGlhbG9nID0gbnVsbDtcbiAgICAgIHRoaXMuX2JhY2tkcm9wID0gbnVsbDtcbiAgICAgIHRoaXMuX2lzU2hvd24gPSBudWxsO1xuICAgICAgdGhpcy5faXNCb2R5T3ZlcmZsb3dpbmcgPSBudWxsO1xuICAgICAgdGhpcy5faWdub3JlQmFja2Ryb3BDbGljayA9IG51bGw7XG4gICAgICB0aGlzLl9vcmlnaW5hbEJvZHlQYWRkaW5nID0gbnVsbDtcbiAgICAgIHRoaXMuX3Njcm9sbGJhcldpZHRoID0gbnVsbDtcbiAgICB9O1xuXG4gICAgLy8gcHJpdmF0ZVxuXG4gICAgTW9kYWwucHJvdG90eXBlLl9nZXRDb25maWcgPSBmdW5jdGlvbiBfZ2V0Q29uZmlnKGNvbmZpZykge1xuICAgICAgY29uZmlnID0gJC5leHRlbmQoe30sIERlZmF1bHQsIGNvbmZpZyk7XG4gICAgICBVdGlsLnR5cGVDaGVja0NvbmZpZyhOQU1FLCBjb25maWcsIERlZmF1bHRUeXBlKTtcbiAgICAgIHJldHVybiBjb25maWc7XG4gICAgfTtcblxuICAgIE1vZGFsLnByb3RvdHlwZS5fc2hvd0VsZW1lbnQgPSBmdW5jdGlvbiBfc2hvd0VsZW1lbnQocmVsYXRlZFRhcmdldCkge1xuICAgICAgdmFyIF90aGlzMyA9IHRoaXM7XG5cbiAgICAgIHZhciB0cmFuc2l0aW9uID0gVXRpbC5zdXBwb3J0c1RyYW5zaXRpb25FbmQoKSAmJiAkKHRoaXMuX2VsZW1lbnQpLmhhc0NsYXNzKENsYXNzTmFtZS5GQURFKTtcblxuICAgICAgaWYgKCF0aGlzLl9lbGVtZW50LnBhcmVudE5vZGUgfHwgdGhpcy5fZWxlbWVudC5wYXJlbnROb2RlLm5vZGVUeXBlICE9PSBOb2RlLkVMRU1FTlRfTk9ERSkge1xuICAgICAgICAvLyBkb24ndCBtb3ZlIG1vZGFscyBkb20gcG9zaXRpb25cbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLl9lbGVtZW50KTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWhpZGRlbicpO1xuICAgICAgdGhpcy5fZWxlbWVudC5zY3JvbGxUb3AgPSAwO1xuXG4gICAgICBpZiAodHJhbnNpdGlvbikge1xuICAgICAgICBVdGlsLnJlZmxvdyh0aGlzLl9lbGVtZW50KTtcbiAgICAgIH1cblxuICAgICAgJCh0aGlzLl9lbGVtZW50KS5hZGRDbGFzcyhDbGFzc05hbWUuU0hPVyk7XG5cbiAgICAgIGlmICh0aGlzLl9jb25maWcuZm9jdXMpIHtcbiAgICAgICAgdGhpcy5fZW5mb3JjZUZvY3VzKCk7XG4gICAgICB9XG5cbiAgICAgIHZhciBzaG93bkV2ZW50ID0gJC5FdmVudChFdmVudC5TSE9XTiwge1xuICAgICAgICByZWxhdGVkVGFyZ2V0OiByZWxhdGVkVGFyZ2V0XG4gICAgICB9KTtcblxuICAgICAgdmFyIHRyYW5zaXRpb25Db21wbGV0ZSA9IGZ1bmN0aW9uIHRyYW5zaXRpb25Db21wbGV0ZSgpIHtcbiAgICAgICAgaWYgKF90aGlzMy5fY29uZmlnLmZvY3VzKSB7XG4gICAgICAgICAgX3RoaXMzLl9lbGVtZW50LmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICAgICAgX3RoaXMzLl9pc1RyYW5zaXRpb25pbmcgPSBmYWxzZTtcbiAgICAgICAgJChfdGhpczMuX2VsZW1lbnQpLnRyaWdnZXIoc2hvd25FdmVudCk7XG4gICAgICB9O1xuXG4gICAgICBpZiAodHJhbnNpdGlvbikge1xuICAgICAgICAkKHRoaXMuX2RpYWxvZykub25lKFV0aWwuVFJBTlNJVElPTl9FTkQsIHRyYW5zaXRpb25Db21wbGV0ZSkuZW11bGF0ZVRyYW5zaXRpb25FbmQoVFJBTlNJVElPTl9EVVJBVElPTik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0cmFuc2l0aW9uQ29tcGxldGUoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgTW9kYWwucHJvdG90eXBlLl9lbmZvcmNlRm9jdXMgPSBmdW5jdGlvbiBfZW5mb3JjZUZvY3VzKCkge1xuICAgICAgdmFyIF90aGlzNCA9IHRoaXM7XG5cbiAgICAgICQoZG9jdW1lbnQpLm9mZihFdmVudC5GT0NVU0lOKSAvLyBndWFyZCBhZ2FpbnN0IGluZmluaXRlIGZvY3VzIGxvb3BcbiAgICAgIC5vbihFdmVudC5GT0NVU0lOLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgaWYgKGRvY3VtZW50ICE9PSBldmVudC50YXJnZXQgJiYgX3RoaXM0Ll9lbGVtZW50ICE9PSBldmVudC50YXJnZXQgJiYgISQoX3RoaXM0Ll9lbGVtZW50KS5oYXMoZXZlbnQudGFyZ2V0KS5sZW5ndGgpIHtcbiAgICAgICAgICBfdGhpczQuX2VsZW1lbnQuZm9jdXMoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIE1vZGFsLnByb3RvdHlwZS5fc2V0RXNjYXBlRXZlbnQgPSBmdW5jdGlvbiBfc2V0RXNjYXBlRXZlbnQoKSB7XG4gICAgICB2YXIgX3RoaXM1ID0gdGhpcztcblxuICAgICAgaWYgKHRoaXMuX2lzU2hvd24gJiYgdGhpcy5fY29uZmlnLmtleWJvYXJkKSB7XG4gICAgICAgICQodGhpcy5fZWxlbWVudCkub24oRXZlbnQuS0VZRE9XTl9ESVNNSVNTLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgICBpZiAoZXZlbnQud2hpY2ggPT09IEVTQ0FQRV9LRVlDT0RFKSB7XG4gICAgICAgICAgICBfdGhpczUuaGlkZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKCF0aGlzLl9pc1Nob3duKSB7XG4gICAgICAgICQodGhpcy5fZWxlbWVudCkub2ZmKEV2ZW50LktFWURPV05fRElTTUlTUyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIE1vZGFsLnByb3RvdHlwZS5fc2V0UmVzaXplRXZlbnQgPSBmdW5jdGlvbiBfc2V0UmVzaXplRXZlbnQoKSB7XG4gICAgICB2YXIgX3RoaXM2ID0gdGhpcztcblxuICAgICAgaWYgKHRoaXMuX2lzU2hvd24pIHtcbiAgICAgICAgJCh3aW5kb3cpLm9uKEV2ZW50LlJFU0laRSwgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzNi5faGFuZGxlVXBkYXRlKGV2ZW50KTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAkKHdpbmRvdykub2ZmKEV2ZW50LlJFU0laRSk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIE1vZGFsLnByb3RvdHlwZS5faGlkZU1vZGFsID0gZnVuY3Rpb24gX2hpZGVNb2RhbCgpIHtcbiAgICAgIHZhciBfdGhpczcgPSB0aGlzO1xuXG4gICAgICB0aGlzLl9lbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICB0aGlzLl9lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1oaWRkZW4nLCAndHJ1ZScpO1xuICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICB0aGlzLl9zaG93QmFja2Ryb3AoZnVuY3Rpb24gKCkge1xuICAgICAgICAkKGRvY3VtZW50LmJvZHkpLnJlbW92ZUNsYXNzKENsYXNzTmFtZS5PUEVOKTtcbiAgICAgICAgX3RoaXM3Ll9yZXNldEFkanVzdG1lbnRzKCk7XG4gICAgICAgIF90aGlzNy5fcmVzZXRTY3JvbGxiYXIoKTtcbiAgICAgICAgJChfdGhpczcuX2VsZW1lbnQpLnRyaWdnZXIoRXZlbnQuSElEREVOKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBNb2RhbC5wcm90b3R5cGUuX3JlbW92ZUJhY2tkcm9wID0gZnVuY3Rpb24gX3JlbW92ZUJhY2tkcm9wKCkge1xuICAgICAgaWYgKHRoaXMuX2JhY2tkcm9wKSB7XG4gICAgICAgICQodGhpcy5fYmFja2Ryb3ApLnJlbW92ZSgpO1xuICAgICAgICB0aGlzLl9iYWNrZHJvcCA9IG51bGw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIE1vZGFsLnByb3RvdHlwZS5fc2hvd0JhY2tkcm9wID0gZnVuY3Rpb24gX3Nob3dCYWNrZHJvcChjYWxsYmFjaykge1xuICAgICAgdmFyIF90aGlzOCA9IHRoaXM7XG5cbiAgICAgIHZhciBhbmltYXRlID0gJCh0aGlzLl9lbGVtZW50KS5oYXNDbGFzcyhDbGFzc05hbWUuRkFERSkgPyBDbGFzc05hbWUuRkFERSA6ICcnO1xuXG4gICAgICBpZiAodGhpcy5faXNTaG93biAmJiB0aGlzLl9jb25maWcuYmFja2Ryb3ApIHtcbiAgICAgICAgdmFyIGRvQW5pbWF0ZSA9IFV0aWwuc3VwcG9ydHNUcmFuc2l0aW9uRW5kKCkgJiYgYW5pbWF0ZTtcblxuICAgICAgICB0aGlzLl9iYWNrZHJvcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICB0aGlzLl9iYWNrZHJvcC5jbGFzc05hbWUgPSBDbGFzc05hbWUuQkFDS0RST1A7XG5cbiAgICAgICAgaWYgKGFuaW1hdGUpIHtcbiAgICAgICAgICAkKHRoaXMuX2JhY2tkcm9wKS5hZGRDbGFzcyhhbmltYXRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgICQodGhpcy5fYmFja2Ryb3ApLmFwcGVuZFRvKGRvY3VtZW50LmJvZHkpO1xuXG4gICAgICAgICQodGhpcy5fZWxlbWVudCkub24oRXZlbnQuQ0xJQ0tfRElTTUlTUywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgaWYgKF90aGlzOC5faWdub3JlQmFja2Ryb3BDbGljaykge1xuICAgICAgICAgICAgX3RoaXM4Ll9pZ25vcmVCYWNrZHJvcENsaWNrID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChldmVudC50YXJnZXQgIT09IGV2ZW50LmN1cnJlbnRUYXJnZXQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKF90aGlzOC5fY29uZmlnLmJhY2tkcm9wID09PSAnc3RhdGljJykge1xuICAgICAgICAgICAgX3RoaXM4Ll9lbGVtZW50LmZvY3VzKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF90aGlzOC5oaWRlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoZG9BbmltYXRlKSB7XG4gICAgICAgICAgVXRpbC5yZWZsb3codGhpcy5fYmFja2Ryb3ApO1xuICAgICAgICB9XG5cbiAgICAgICAgJCh0aGlzLl9iYWNrZHJvcCkuYWRkQ2xhc3MoQ2xhc3NOYW1lLlNIT1cpO1xuXG4gICAgICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWRvQW5pbWF0ZSkge1xuICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgJCh0aGlzLl9iYWNrZHJvcCkub25lKFV0aWwuVFJBTlNJVElPTl9FTkQsIGNhbGxiYWNrKS5lbXVsYXRlVHJhbnNpdGlvbkVuZChCQUNLRFJPUF9UUkFOU0lUSU9OX0RVUkFUSU9OKTtcbiAgICAgIH0gZWxzZSBpZiAoIXRoaXMuX2lzU2hvd24gJiYgdGhpcy5fYmFja2Ryb3ApIHtcbiAgICAgICAgJCh0aGlzLl9iYWNrZHJvcCkucmVtb3ZlQ2xhc3MoQ2xhc3NOYW1lLlNIT1cpO1xuXG4gICAgICAgIHZhciBjYWxsYmFja1JlbW92ZSA9IGZ1bmN0aW9uIGNhbGxiYWNrUmVtb3ZlKCkge1xuICAgICAgICAgIF90aGlzOC5fcmVtb3ZlQmFja2Ryb3AoKTtcbiAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChVdGlsLnN1cHBvcnRzVHJhbnNpdGlvbkVuZCgpICYmICQodGhpcy5fZWxlbWVudCkuaGFzQ2xhc3MoQ2xhc3NOYW1lLkZBREUpKSB7XG4gICAgICAgICAgJCh0aGlzLl9iYWNrZHJvcCkub25lKFV0aWwuVFJBTlNJVElPTl9FTkQsIGNhbGxiYWNrUmVtb3ZlKS5lbXVsYXRlVHJhbnNpdGlvbkVuZChCQUNLRFJPUF9UUkFOU0lUSU9OX0RVUkFUSU9OKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjYWxsYmFja1JlbW92ZSgpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyB0aGUgZm9sbG93aW5nIG1ldGhvZHMgYXJlIHVzZWQgdG8gaGFuZGxlIG92ZXJmbG93aW5nIG1vZGFsc1xuICAgIC8vIHRvZG8gKGZhdCk6IHRoZXNlIHNob3VsZCBwcm9iYWJseSBiZSByZWZhY3RvcmVkIG91dCBvZiBtb2RhbC5qc1xuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgIE1vZGFsLnByb3RvdHlwZS5faGFuZGxlVXBkYXRlID0gZnVuY3Rpb24gX2hhbmRsZVVwZGF0ZSgpIHtcbiAgICAgIHRoaXMuX2FkanVzdERpYWxvZygpO1xuICAgIH07XG5cbiAgICBNb2RhbC5wcm90b3R5cGUuX2FkanVzdERpYWxvZyA9IGZ1bmN0aW9uIF9hZGp1c3REaWFsb2coKSB7XG4gICAgICB2YXIgaXNNb2RhbE92ZXJmbG93aW5nID0gdGhpcy5fZWxlbWVudC5zY3JvbGxIZWlnaHQgPiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0O1xuXG4gICAgICBpZiAoIXRoaXMuX2lzQm9keU92ZXJmbG93aW5nICYmIGlzTW9kYWxPdmVyZmxvd2luZykge1xuICAgICAgICB0aGlzLl9lbGVtZW50LnN0eWxlLnBhZGRpbmdMZWZ0ID0gdGhpcy5fc2Nyb2xsYmFyV2lkdGggKyAncHgnO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5faXNCb2R5T3ZlcmZsb3dpbmcgJiYgIWlzTW9kYWxPdmVyZmxvd2luZykge1xuICAgICAgICB0aGlzLl9lbGVtZW50LnN0eWxlLnBhZGRpbmdSaWdodCA9IHRoaXMuX3Njcm9sbGJhcldpZHRoICsgJ3B4JztcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgTW9kYWwucHJvdG90eXBlLl9yZXNldEFkanVzdG1lbnRzID0gZnVuY3Rpb24gX3Jlc2V0QWRqdXN0bWVudHMoKSB7XG4gICAgICB0aGlzLl9lbGVtZW50LnN0eWxlLnBhZGRpbmdMZWZ0ID0gJyc7XG4gICAgICB0aGlzLl9lbGVtZW50LnN0eWxlLnBhZGRpbmdSaWdodCA9ICcnO1xuICAgIH07XG5cbiAgICBNb2RhbC5wcm90b3R5cGUuX2NoZWNrU2Nyb2xsYmFyID0gZnVuY3Rpb24gX2NoZWNrU2Nyb2xsYmFyKCkge1xuICAgICAgdGhpcy5faXNCb2R5T3ZlcmZsb3dpbmcgPSBkb2N1bWVudC5ib2R5LmNsaWVudFdpZHRoIDwgd2luZG93LmlubmVyV2lkdGg7XG4gICAgICB0aGlzLl9zY3JvbGxiYXJXaWR0aCA9IHRoaXMuX2dldFNjcm9sbGJhcldpZHRoKCk7XG4gICAgfTtcblxuICAgIE1vZGFsLnByb3RvdHlwZS5fc2V0U2Nyb2xsYmFyID0gZnVuY3Rpb24gX3NldFNjcm9sbGJhcigpIHtcbiAgICAgIHZhciBib2R5UGFkZGluZyA9IHBhcnNlSW50KCQoU2VsZWN0b3IuRklYRURfQ09OVEVOVCkuY3NzKCdwYWRkaW5nLXJpZ2h0JykgfHwgMCwgMTApO1xuXG4gICAgICB0aGlzLl9vcmlnaW5hbEJvZHlQYWRkaW5nID0gZG9jdW1lbnQuYm9keS5zdHlsZS5wYWRkaW5nUmlnaHQgfHwgJyc7XG5cbiAgICAgIGlmICh0aGlzLl9pc0JvZHlPdmVyZmxvd2luZykge1xuICAgICAgICBkb2N1bWVudC5ib2R5LnN0eWxlLnBhZGRpbmdSaWdodCA9IGJvZHlQYWRkaW5nICsgdGhpcy5fc2Nyb2xsYmFyV2lkdGggKyAncHgnO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBNb2RhbC5wcm90b3R5cGUuX3Jlc2V0U2Nyb2xsYmFyID0gZnVuY3Rpb24gX3Jlc2V0U2Nyb2xsYmFyKCkge1xuICAgICAgZG9jdW1lbnQuYm9keS5zdHlsZS5wYWRkaW5nUmlnaHQgPSB0aGlzLl9vcmlnaW5hbEJvZHlQYWRkaW5nO1xuICAgIH07XG5cbiAgICBNb2RhbC5wcm90b3R5cGUuX2dldFNjcm9sbGJhcldpZHRoID0gZnVuY3Rpb24gX2dldFNjcm9sbGJhcldpZHRoKCkge1xuICAgICAgLy8gdGh4IGQud2Fsc2hcbiAgICAgIHZhciBzY3JvbGxEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgIHNjcm9sbERpdi5jbGFzc05hbWUgPSBDbGFzc05hbWUuU0NST0xMQkFSX01FQVNVUkVSO1xuICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChzY3JvbGxEaXYpO1xuICAgICAgdmFyIHNjcm9sbGJhcldpZHRoID0gc2Nyb2xsRGl2Lm9mZnNldFdpZHRoIC0gc2Nyb2xsRGl2LmNsaWVudFdpZHRoO1xuICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChzY3JvbGxEaXYpO1xuICAgICAgcmV0dXJuIHNjcm9sbGJhcldpZHRoO1xuICAgIH07XG5cbiAgICAvLyBzdGF0aWNcblxuICAgIE1vZGFsLl9qUXVlcnlJbnRlcmZhY2UgPSBmdW5jdGlvbiBfalF1ZXJ5SW50ZXJmYWNlKGNvbmZpZywgcmVsYXRlZFRhcmdldCkge1xuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBkYXRhID0gJCh0aGlzKS5kYXRhKERBVEFfS0VZKTtcbiAgICAgICAgdmFyIF9jb25maWcgPSAkLmV4dGVuZCh7fSwgTW9kYWwuRGVmYXVsdCwgJCh0aGlzKS5kYXRhKCksICh0eXBlb2YgY29uZmlnID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihjb25maWcpKSA9PT0gJ29iamVjdCcgJiYgY29uZmlnKTtcblxuICAgICAgICBpZiAoIWRhdGEpIHtcbiAgICAgICAgICBkYXRhID0gbmV3IE1vZGFsKHRoaXMsIF9jb25maWcpO1xuICAgICAgICAgICQodGhpcykuZGF0YShEQVRBX0tFWSwgZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIGNvbmZpZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBpZiAoZGF0YVtjb25maWddID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gbWV0aG9kIG5hbWVkIFwiJyArIGNvbmZpZyArICdcIicpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkYXRhW2NvbmZpZ10ocmVsYXRlZFRhcmdldCk7XG4gICAgICAgIH0gZWxzZSBpZiAoX2NvbmZpZy5zaG93KSB7XG4gICAgICAgICAgZGF0YS5zaG93KHJlbGF0ZWRUYXJnZXQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgX2NyZWF0ZUNsYXNzKE1vZGFsLCBudWxsLCBbe1xuICAgICAga2V5OiAnVkVSU0lPTicsXG4gICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgcmV0dXJuIFZFUlNJT047XG4gICAgICB9XG4gICAgfSwge1xuICAgICAga2V5OiAnRGVmYXVsdCcsXG4gICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgcmV0dXJuIERlZmF1bHQ7XG4gICAgICB9XG4gICAgfV0pO1xuXG4gICAgcmV0dXJuIE1vZGFsO1xuICB9KCk7XG5cbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBEYXRhIEFwaSBpbXBsZW1lbnRhdGlvblxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cbiAgJChkb2N1bWVudCkub24oRXZlbnQuQ0xJQ0tfREFUQV9BUEksIFNlbGVjdG9yLkRBVEFfVE9HR0xFLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICB2YXIgX3RoaXM5ID0gdGhpcztcblxuICAgIHZhciB0YXJnZXQgPSB2b2lkIDA7XG4gICAgdmFyIHNlbGVjdG9yID0gVXRpbC5nZXRTZWxlY3RvckZyb21FbGVtZW50KHRoaXMpO1xuXG4gICAgaWYgKHNlbGVjdG9yKSB7XG4gICAgICB0YXJnZXQgPSAkKHNlbGVjdG9yKVswXTtcbiAgICB9XG5cbiAgICB2YXIgY29uZmlnID0gJCh0YXJnZXQpLmRhdGEoREFUQV9LRVkpID8gJ3RvZ2dsZScgOiAkLmV4dGVuZCh7fSwgJCh0YXJnZXQpLmRhdGEoKSwgJCh0aGlzKS5kYXRhKCkpO1xuXG4gICAgaWYgKHRoaXMudGFnTmFtZSA9PT0gJ0EnIHx8IHRoaXMudGFnTmFtZSA9PT0gJ0FSRUEnKSB7XG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cblxuICAgIHZhciAkdGFyZ2V0ID0gJCh0YXJnZXQpLm9uZShFdmVudC5TSE9XLCBmdW5jdGlvbiAoc2hvd0V2ZW50KSB7XG4gICAgICBpZiAoc2hvd0V2ZW50LmlzRGVmYXVsdFByZXZlbnRlZCgpKSB7XG4gICAgICAgIC8vIG9ubHkgcmVnaXN0ZXIgZm9jdXMgcmVzdG9yZXIgaWYgbW9kYWwgd2lsbCBhY3R1YWxseSBnZXQgc2hvd25cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAkdGFyZ2V0Lm9uZShFdmVudC5ISURERU4sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCQoX3RoaXM5KS5pcygnOnZpc2libGUnKSkge1xuICAgICAgICAgIF90aGlzOS5mb2N1cygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIE1vZGFsLl9qUXVlcnlJbnRlcmZhY2UuY2FsbCgkKHRhcmdldCksIGNvbmZpZywgdGhpcyk7XG4gIH0pO1xuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogalF1ZXJ5XG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuICAkLmZuW05BTUVdID0gTW9kYWwuX2pRdWVyeUludGVyZmFjZTtcbiAgJC5mbltOQU1FXS5Db25zdHJ1Y3RvciA9IE1vZGFsO1xuICAkLmZuW05BTUVdLm5vQ29uZmxpY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgJC5mbltOQU1FXSA9IEpRVUVSWV9OT19DT05GTElDVDtcbiAgICByZXR1cm4gTW9kYWwuX2pRdWVyeUludGVyZmFjZTtcbiAgfTtcblxuICByZXR1cm4gTW9kYWw7XG59KGpRdWVyeSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1tb2RhbC5qcy5tYXBcbiIsInZhciBfdHlwZW9mID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIgPyBmdW5jdGlvbiAob2JqKSB7IHJldHVybiB0eXBlb2Ygb2JqOyB9IDogZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCAmJiBvYmogIT09IFN5bWJvbC5wcm90b3R5cGUgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajsgfTtcblxudmFyIF9jcmVhdGVDbGFzcyA9IGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmIChcInZhbHVlXCIgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0oKTtcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH1cblxuLyoqXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogQm9vdHN0cmFwICh2NC4wLjAtYWxwaGEuNik6IHRvb2x0aXAuanNcbiAqIExpY2Vuc2VkIHVuZGVyIE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2Jsb2IvbWFzdGVyL0xJQ0VOU0UpXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICovXG5cbnZhciBUb29sdGlwID0gZnVuY3Rpb24gKCQpIHtcblxuICAvKipcbiAgICogQ2hlY2sgZm9yIFRldGhlciBkZXBlbmRlbmN5XG4gICAqIFRldGhlciAtIGh0dHA6Ly90ZXRoZXIuaW8vXG4gICAqL1xuICBpZiAodHlwZW9mIFRldGhlciA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Jvb3RzdHJhcCB0b29sdGlwcyByZXF1aXJlIFRldGhlciAoaHR0cDovL3RldGhlci5pby8pJyk7XG4gIH1cblxuICAvKipcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIENvbnN0YW50c1xuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cbiAgdmFyIE5BTUUgPSAndG9vbHRpcCc7XG4gIHZhciBWRVJTSU9OID0gJzQuMC4wLWFscGhhLjYnO1xuICB2YXIgREFUQV9LRVkgPSAnYnMudG9vbHRpcCc7XG4gIHZhciBFVkVOVF9LRVkgPSAnLicgKyBEQVRBX0tFWTtcbiAgdmFyIEpRVUVSWV9OT19DT05GTElDVCA9ICQuZm5bTkFNRV07XG4gIHZhciBUUkFOU0lUSU9OX0RVUkFUSU9OID0gMTUwO1xuICB2YXIgQ0xBU1NfUFJFRklYID0gJ2JzLXRldGhlcic7XG5cbiAgdmFyIERlZmF1bHQgPSB7XG4gICAgYW5pbWF0aW9uOiB0cnVlLFxuICAgIHRlbXBsYXRlOiAnPGRpdiBjbGFzcz1cInRvb2x0aXBcIiByb2xlPVwidG9vbHRpcFwiPicgKyAnPGRpdiBjbGFzcz1cInRvb2x0aXAtaW5uZXJcIj48L2Rpdj48L2Rpdj4nLFxuICAgIHRyaWdnZXI6ICdob3ZlciBmb2N1cycsXG4gICAgdGl0bGU6ICcnLFxuICAgIGRlbGF5OiAwLFxuICAgIGh0bWw6IGZhbHNlLFxuICAgIHNlbGVjdG9yOiBmYWxzZSxcbiAgICBwbGFjZW1lbnQ6ICd0b3AnLFxuICAgIG9mZnNldDogJzAgMCcsXG4gICAgY29uc3RyYWludHM6IFtdLFxuICAgIGNvbnRhaW5lcjogZmFsc2VcbiAgfTtcblxuICB2YXIgRGVmYXVsdFR5cGUgPSB7XG4gICAgYW5pbWF0aW9uOiAnYm9vbGVhbicsXG4gICAgdGVtcGxhdGU6ICdzdHJpbmcnLFxuICAgIHRpdGxlOiAnKHN0cmluZ3xlbGVtZW50fGZ1bmN0aW9uKScsXG4gICAgdHJpZ2dlcjogJ3N0cmluZycsXG4gICAgZGVsYXk6ICcobnVtYmVyfG9iamVjdCknLFxuICAgIGh0bWw6ICdib29sZWFuJyxcbiAgICBzZWxlY3RvcjogJyhzdHJpbmd8Ym9vbGVhbiknLFxuICAgIHBsYWNlbWVudDogJyhzdHJpbmd8ZnVuY3Rpb24pJyxcbiAgICBvZmZzZXQ6ICdzdHJpbmcnLFxuICAgIGNvbnN0cmFpbnRzOiAnYXJyYXknLFxuICAgIGNvbnRhaW5lcjogJyhzdHJpbmd8ZWxlbWVudHxib29sZWFuKSdcbiAgfTtcblxuICB2YXIgQXR0YWNobWVudE1hcCA9IHtcbiAgICBUT1A6ICdib3R0b20gY2VudGVyJyxcbiAgICBSSUdIVDogJ21pZGRsZSBsZWZ0JyxcbiAgICBCT1RUT006ICd0b3AgY2VudGVyJyxcbiAgICBMRUZUOiAnbWlkZGxlIHJpZ2h0J1xuICB9O1xuXG4gIHZhciBIb3ZlclN0YXRlID0ge1xuICAgIFNIT1c6ICdzaG93JyxcbiAgICBPVVQ6ICdvdXQnXG4gIH07XG5cbiAgdmFyIEV2ZW50ID0ge1xuICAgIEhJREU6ICdoaWRlJyArIEVWRU5UX0tFWSxcbiAgICBISURERU46ICdoaWRkZW4nICsgRVZFTlRfS0VZLFxuICAgIFNIT1c6ICdzaG93JyArIEVWRU5UX0tFWSxcbiAgICBTSE9XTjogJ3Nob3duJyArIEVWRU5UX0tFWSxcbiAgICBJTlNFUlRFRDogJ2luc2VydGVkJyArIEVWRU5UX0tFWSxcbiAgICBDTElDSzogJ2NsaWNrJyArIEVWRU5UX0tFWSxcbiAgICBGT0NVU0lOOiAnZm9jdXNpbicgKyBFVkVOVF9LRVksXG4gICAgRk9DVVNPVVQ6ICdmb2N1c291dCcgKyBFVkVOVF9LRVksXG4gICAgTU9VU0VFTlRFUjogJ21vdXNlZW50ZXInICsgRVZFTlRfS0VZLFxuICAgIE1PVVNFTEVBVkU6ICdtb3VzZWxlYXZlJyArIEVWRU5UX0tFWVxuICB9O1xuXG4gIHZhciBDbGFzc05hbWUgPSB7XG4gICAgRkFERTogJ2ZhZGUnLFxuICAgIFNIT1c6ICdzaG93J1xuICB9O1xuXG4gIHZhciBTZWxlY3RvciA9IHtcbiAgICBUT09MVElQOiAnLnRvb2x0aXAnLFxuICAgIFRPT0xUSVBfSU5ORVI6ICcudG9vbHRpcC1pbm5lcidcbiAgfTtcblxuICB2YXIgVGV0aGVyQ2xhc3MgPSB7XG4gICAgZWxlbWVudDogZmFsc2UsXG4gICAgZW5hYmxlZDogZmFsc2VcbiAgfTtcblxuICB2YXIgVHJpZ2dlciA9IHtcbiAgICBIT1ZFUjogJ2hvdmVyJyxcbiAgICBGT0NVUzogJ2ZvY3VzJyxcbiAgICBDTElDSzogJ2NsaWNrJyxcbiAgICBNQU5VQUw6ICdtYW51YWwnXG4gIH07XG5cbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBDbGFzcyBEZWZpbml0aW9uXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuICB2YXIgVG9vbHRpcCA9IGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBUb29sdGlwKGVsZW1lbnQsIGNvbmZpZykge1xuICAgICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFRvb2x0aXApO1xuXG4gICAgICAvLyBwcml2YXRlXG4gICAgICB0aGlzLl9pc0VuYWJsZWQgPSB0cnVlO1xuICAgICAgdGhpcy5fdGltZW91dCA9IDA7XG4gICAgICB0aGlzLl9ob3ZlclN0YXRlID0gJyc7XG4gICAgICB0aGlzLl9hY3RpdmVUcmlnZ2VyID0ge307XG4gICAgICB0aGlzLl9pc1RyYW5zaXRpb25pbmcgPSBmYWxzZTtcbiAgICAgIHRoaXMuX3RldGhlciA9IG51bGw7XG5cbiAgICAgIC8vIHByb3RlY3RlZFxuICAgICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcbiAgICAgIHRoaXMuY29uZmlnID0gdGhpcy5fZ2V0Q29uZmlnKGNvbmZpZyk7XG4gICAgICB0aGlzLnRpcCA9IG51bGw7XG5cbiAgICAgIHRoaXMuX3NldExpc3RlbmVycygpO1xuICAgIH1cblxuICAgIC8vIGdldHRlcnNcblxuICAgIC8vIHB1YmxpY1xuXG4gICAgVG9vbHRpcC5wcm90b3R5cGUuZW5hYmxlID0gZnVuY3Rpb24gZW5hYmxlKCkge1xuICAgICAgdGhpcy5faXNFbmFibGVkID0gdHJ1ZTtcbiAgICB9O1xuXG4gICAgVG9vbHRpcC5wcm90b3R5cGUuZGlzYWJsZSA9IGZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gICAgICB0aGlzLl9pc0VuYWJsZWQgPSBmYWxzZTtcbiAgICB9O1xuXG4gICAgVG9vbHRpcC5wcm90b3R5cGUudG9nZ2xlRW5hYmxlZCA9IGZ1bmN0aW9uIHRvZ2dsZUVuYWJsZWQoKSB7XG4gICAgICB0aGlzLl9pc0VuYWJsZWQgPSAhdGhpcy5faXNFbmFibGVkO1xuICAgIH07XG5cbiAgICBUb29sdGlwLnByb3RvdHlwZS50b2dnbGUgPSBmdW5jdGlvbiB0b2dnbGUoZXZlbnQpIHtcbiAgICAgIGlmIChldmVudCkge1xuICAgICAgICB2YXIgZGF0YUtleSA9IHRoaXMuY29uc3RydWN0b3IuREFUQV9LRVk7XG4gICAgICAgIHZhciBjb250ZXh0ID0gJChldmVudC5jdXJyZW50VGFyZ2V0KS5kYXRhKGRhdGFLZXkpO1xuXG4gICAgICAgIGlmICghY29udGV4dCkge1xuICAgICAgICAgIGNvbnRleHQgPSBuZXcgdGhpcy5jb25zdHJ1Y3RvcihldmVudC5jdXJyZW50VGFyZ2V0LCB0aGlzLl9nZXREZWxlZ2F0ZUNvbmZpZygpKTtcbiAgICAgICAgICAkKGV2ZW50LmN1cnJlbnRUYXJnZXQpLmRhdGEoZGF0YUtleSwgY29udGV4dCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb250ZXh0Ll9hY3RpdmVUcmlnZ2VyLmNsaWNrID0gIWNvbnRleHQuX2FjdGl2ZVRyaWdnZXIuY2xpY2s7XG5cbiAgICAgICAgaWYgKGNvbnRleHQuX2lzV2l0aEFjdGl2ZVRyaWdnZXIoKSkge1xuICAgICAgICAgIGNvbnRleHQuX2VudGVyKG51bGwsIGNvbnRleHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnRleHQuX2xlYXZlKG51bGwsIGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuXG4gICAgICAgIGlmICgkKHRoaXMuZ2V0VGlwRWxlbWVudCgpKS5oYXNDbGFzcyhDbGFzc05hbWUuU0hPVykpIHtcbiAgICAgICAgICB0aGlzLl9sZWF2ZShudWxsLCB0aGlzKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbnRlcihudWxsLCB0aGlzKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgVG9vbHRpcC5wcm90b3R5cGUuZGlzcG9zZSA9IGZ1bmN0aW9uIGRpc3Bvc2UoKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fdGltZW91dCk7XG5cbiAgICAgIHRoaXMuY2xlYW51cFRldGhlcigpO1xuXG4gICAgICAkLnJlbW92ZURhdGEodGhpcy5lbGVtZW50LCB0aGlzLmNvbnN0cnVjdG9yLkRBVEFfS0VZKTtcblxuICAgICAgJCh0aGlzLmVsZW1lbnQpLm9mZih0aGlzLmNvbnN0cnVjdG9yLkVWRU5UX0tFWSk7XG4gICAgICAkKHRoaXMuZWxlbWVudCkuY2xvc2VzdCgnLm1vZGFsJykub2ZmKCdoaWRlLmJzLm1vZGFsJyk7XG5cbiAgICAgIGlmICh0aGlzLnRpcCkge1xuICAgICAgICAkKHRoaXMudGlwKS5yZW1vdmUoKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5faXNFbmFibGVkID0gbnVsbDtcbiAgICAgIHRoaXMuX3RpbWVvdXQgPSBudWxsO1xuICAgICAgdGhpcy5faG92ZXJTdGF0ZSA9IG51bGw7XG4gICAgICB0aGlzLl9hY3RpdmVUcmlnZ2VyID0gbnVsbDtcbiAgICAgIHRoaXMuX3RldGhlciA9IG51bGw7XG5cbiAgICAgIHRoaXMuZWxlbWVudCA9IG51bGw7XG4gICAgICB0aGlzLmNvbmZpZyA9IG51bGw7XG4gICAgICB0aGlzLnRpcCA9IG51bGw7XG4gICAgfTtcblxuICAgIFRvb2x0aXAucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiBzaG93KCkge1xuICAgICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgICAgaWYgKCQodGhpcy5lbGVtZW50KS5jc3MoJ2Rpc3BsYXknKSA9PT0gJ25vbmUnKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHVzZSBzaG93IG9uIHZpc2libGUgZWxlbWVudHMnKTtcbiAgICAgIH1cblxuICAgICAgdmFyIHNob3dFdmVudCA9ICQuRXZlbnQodGhpcy5jb25zdHJ1Y3Rvci5FdmVudC5TSE9XKTtcbiAgICAgIGlmICh0aGlzLmlzV2l0aENvbnRlbnQoKSAmJiB0aGlzLl9pc0VuYWJsZWQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2lzVHJhbnNpdGlvbmluZykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVG9vbHRpcCBpcyB0cmFuc2l0aW9uaW5nJyk7XG4gICAgICAgIH1cbiAgICAgICAgJCh0aGlzLmVsZW1lbnQpLnRyaWdnZXIoc2hvd0V2ZW50KTtcblxuICAgICAgICB2YXIgaXNJblRoZURvbSA9ICQuY29udGFpbnModGhpcy5lbGVtZW50Lm93bmVyRG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LCB0aGlzLmVsZW1lbnQpO1xuXG4gICAgICAgIGlmIChzaG93RXZlbnQuaXNEZWZhdWx0UHJldmVudGVkKCkgfHwgIWlzSW5UaGVEb20pIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdGlwID0gdGhpcy5nZXRUaXBFbGVtZW50KCk7XG4gICAgICAgIHZhciB0aXBJZCA9IFV0aWwuZ2V0VUlEKHRoaXMuY29uc3RydWN0b3IuTkFNRSk7XG5cbiAgICAgICAgdGlwLnNldEF0dHJpYnV0ZSgnaWQnLCB0aXBJZCk7XG4gICAgICAgIHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGVzY3JpYmVkYnknLCB0aXBJZCk7XG5cbiAgICAgICAgdGhpcy5zZXRDb250ZW50KCk7XG5cbiAgICAgICAgaWYgKHRoaXMuY29uZmlnLmFuaW1hdGlvbikge1xuICAgICAgICAgICQodGlwKS5hZGRDbGFzcyhDbGFzc05hbWUuRkFERSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcGxhY2VtZW50ID0gdHlwZW9mIHRoaXMuY29uZmlnLnBsYWNlbWVudCA9PT0gJ2Z1bmN0aW9uJyA/IHRoaXMuY29uZmlnLnBsYWNlbWVudC5jYWxsKHRoaXMsIHRpcCwgdGhpcy5lbGVtZW50KSA6IHRoaXMuY29uZmlnLnBsYWNlbWVudDtcblxuICAgICAgICB2YXIgYXR0YWNobWVudCA9IHRoaXMuX2dldEF0dGFjaG1lbnQocGxhY2VtZW50KTtcblxuICAgICAgICB2YXIgY29udGFpbmVyID0gdGhpcy5jb25maWcuY29udGFpbmVyID09PSBmYWxzZSA/IGRvY3VtZW50LmJvZHkgOiAkKHRoaXMuY29uZmlnLmNvbnRhaW5lcik7XG5cbiAgICAgICAgJCh0aXApLmRhdGEodGhpcy5jb25zdHJ1Y3Rvci5EQVRBX0tFWSwgdGhpcykuYXBwZW5kVG8oY29udGFpbmVyKTtcblxuICAgICAgICAkKHRoaXMuZWxlbWVudCkudHJpZ2dlcih0aGlzLmNvbnN0cnVjdG9yLkV2ZW50LklOU0VSVEVEKTtcblxuICAgICAgICB0aGlzLl90ZXRoZXIgPSBuZXcgVGV0aGVyKHtcbiAgICAgICAgICBhdHRhY2htZW50OiBhdHRhY2htZW50LFxuICAgICAgICAgIGVsZW1lbnQ6IHRpcCxcbiAgICAgICAgICB0YXJnZXQ6IHRoaXMuZWxlbWVudCxcbiAgICAgICAgICBjbGFzc2VzOiBUZXRoZXJDbGFzcyxcbiAgICAgICAgICBjbGFzc1ByZWZpeDogQ0xBU1NfUFJFRklYLFxuICAgICAgICAgIG9mZnNldDogdGhpcy5jb25maWcub2Zmc2V0LFxuICAgICAgICAgIGNvbnN0cmFpbnRzOiB0aGlzLmNvbmZpZy5jb25zdHJhaW50cyxcbiAgICAgICAgICBhZGRUYXJnZXRDbGFzc2VzOiBmYWxzZVxuICAgICAgICB9KTtcblxuICAgICAgICBVdGlsLnJlZmxvdyh0aXApO1xuICAgICAgICB0aGlzLl90ZXRoZXIucG9zaXRpb24oKTtcblxuICAgICAgICAkKHRpcCkuYWRkQ2xhc3MoQ2xhc3NOYW1lLlNIT1cpO1xuXG4gICAgICAgIHZhciBjb21wbGV0ZSA9IGZ1bmN0aW9uIGNvbXBsZXRlKCkge1xuICAgICAgICAgIHZhciBwcmV2SG92ZXJTdGF0ZSA9IF90aGlzLl9ob3ZlclN0YXRlO1xuICAgICAgICAgIF90aGlzLl9ob3ZlclN0YXRlID0gbnVsbDtcbiAgICAgICAgICBfdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAkKF90aGlzLmVsZW1lbnQpLnRyaWdnZXIoX3RoaXMuY29uc3RydWN0b3IuRXZlbnQuU0hPV04pO1xuXG4gICAgICAgICAgaWYgKHByZXZIb3ZlclN0YXRlID09PSBIb3ZlclN0YXRlLk9VVCkge1xuICAgICAgICAgICAgX3RoaXMuX2xlYXZlKG51bGwsIF90aGlzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKFV0aWwuc3VwcG9ydHNUcmFuc2l0aW9uRW5kKCkgJiYgJCh0aGlzLnRpcCkuaGFzQ2xhc3MoQ2xhc3NOYW1lLkZBREUpKSB7XG4gICAgICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gdHJ1ZTtcbiAgICAgICAgICAkKHRoaXMudGlwKS5vbmUoVXRpbC5UUkFOU0lUSU9OX0VORCwgY29tcGxldGUpLmVtdWxhdGVUcmFuc2l0aW9uRW5kKFRvb2x0aXAuX1RSQU5TSVRJT05fRFVSQVRJT04pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbXBsZXRlKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFRvb2x0aXAucHJvdG90eXBlLmhpZGUgPSBmdW5jdGlvbiBoaWRlKGNhbGxiYWNrKSB7XG4gICAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgICAgdmFyIHRpcCA9IHRoaXMuZ2V0VGlwRWxlbWVudCgpO1xuICAgICAgdmFyIGhpZGVFdmVudCA9ICQuRXZlbnQodGhpcy5jb25zdHJ1Y3Rvci5FdmVudC5ISURFKTtcbiAgICAgIGlmICh0aGlzLl9pc1RyYW5zaXRpb25pbmcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUb29sdGlwIGlzIHRyYW5zaXRpb25pbmcnKTtcbiAgICAgIH1cbiAgICAgIHZhciBjb21wbGV0ZSA9IGZ1bmN0aW9uIGNvbXBsZXRlKCkge1xuICAgICAgICBpZiAoX3RoaXMyLl9ob3ZlclN0YXRlICE9PSBIb3ZlclN0YXRlLlNIT1cgJiYgdGlwLnBhcmVudE5vZGUpIHtcbiAgICAgICAgICB0aXAucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aXApO1xuICAgICAgICB9XG5cbiAgICAgICAgX3RoaXMyLmVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWRlc2NyaWJlZGJ5Jyk7XG4gICAgICAgICQoX3RoaXMyLmVsZW1lbnQpLnRyaWdnZXIoX3RoaXMyLmNvbnN0cnVjdG9yLkV2ZW50LkhJRERFTik7XG4gICAgICAgIF90aGlzMi5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICAgIF90aGlzMi5jbGVhbnVwVGV0aGVyKCk7XG5cbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgJCh0aGlzLmVsZW1lbnQpLnRyaWdnZXIoaGlkZUV2ZW50KTtcblxuICAgICAgaWYgKGhpZGVFdmVudC5pc0RlZmF1bHRQcmV2ZW50ZWQoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgICQodGlwKS5yZW1vdmVDbGFzcyhDbGFzc05hbWUuU0hPVyk7XG5cbiAgICAgIHRoaXMuX2FjdGl2ZVRyaWdnZXJbVHJpZ2dlci5DTElDS10gPSBmYWxzZTtcbiAgICAgIHRoaXMuX2FjdGl2ZVRyaWdnZXJbVHJpZ2dlci5GT0NVU10gPSBmYWxzZTtcbiAgICAgIHRoaXMuX2FjdGl2ZVRyaWdnZXJbVHJpZ2dlci5IT1ZFUl0gPSBmYWxzZTtcblxuICAgICAgaWYgKFV0aWwuc3VwcG9ydHNUcmFuc2l0aW9uRW5kKCkgJiYgJCh0aGlzLnRpcCkuaGFzQ2xhc3MoQ2xhc3NOYW1lLkZBREUpKSB7XG4gICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IHRydWU7XG4gICAgICAgICQodGlwKS5vbmUoVXRpbC5UUkFOU0lUSU9OX0VORCwgY29tcGxldGUpLmVtdWxhdGVUcmFuc2l0aW9uRW5kKFRSQU5TSVRJT05fRFVSQVRJT04pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29tcGxldGUoKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5faG92ZXJTdGF0ZSA9ICcnO1xuICAgIH07XG5cbiAgICAvLyBwcm90ZWN0ZWRcblxuICAgIFRvb2x0aXAucHJvdG90eXBlLmlzV2l0aENvbnRlbnQgPSBmdW5jdGlvbiBpc1dpdGhDb250ZW50KCkge1xuICAgICAgcmV0dXJuIEJvb2xlYW4odGhpcy5nZXRUaXRsZSgpKTtcbiAgICB9O1xuXG4gICAgVG9vbHRpcC5wcm90b3R5cGUuZ2V0VGlwRWxlbWVudCA9IGZ1bmN0aW9uIGdldFRpcEVsZW1lbnQoKSB7XG4gICAgICByZXR1cm4gdGhpcy50aXAgPSB0aGlzLnRpcCB8fCAkKHRoaXMuY29uZmlnLnRlbXBsYXRlKVswXTtcbiAgICB9O1xuXG4gICAgVG9vbHRpcC5wcm90b3R5cGUuc2V0Q29udGVudCA9IGZ1bmN0aW9uIHNldENvbnRlbnQoKSB7XG4gICAgICB2YXIgJHRpcCA9ICQodGhpcy5nZXRUaXBFbGVtZW50KCkpO1xuXG4gICAgICB0aGlzLnNldEVsZW1lbnRDb250ZW50KCR0aXAuZmluZChTZWxlY3Rvci5UT09MVElQX0lOTkVSKSwgdGhpcy5nZXRUaXRsZSgpKTtcblxuICAgICAgJHRpcC5yZW1vdmVDbGFzcyhDbGFzc05hbWUuRkFERSArICcgJyArIENsYXNzTmFtZS5TSE9XKTtcblxuICAgICAgdGhpcy5jbGVhbnVwVGV0aGVyKCk7XG4gICAgfTtcblxuICAgIFRvb2x0aXAucHJvdG90eXBlLnNldEVsZW1lbnRDb250ZW50ID0gZnVuY3Rpb24gc2V0RWxlbWVudENvbnRlbnQoJGVsZW1lbnQsIGNvbnRlbnQpIHtcbiAgICAgIHZhciBodG1sID0gdGhpcy5jb25maWcuaHRtbDtcbiAgICAgIGlmICgodHlwZW9mIGNvbnRlbnQgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGNvbnRlbnQpKSA9PT0gJ29iamVjdCcgJiYgKGNvbnRlbnQubm9kZVR5cGUgfHwgY29udGVudC5qcXVlcnkpKSB7XG4gICAgICAgIC8vIGNvbnRlbnQgaXMgYSBET00gbm9kZSBvciBhIGpRdWVyeVxuICAgICAgICBpZiAoaHRtbCkge1xuICAgICAgICAgIGlmICghJChjb250ZW50KS5wYXJlbnQoKS5pcygkZWxlbWVudCkpIHtcbiAgICAgICAgICAgICRlbGVtZW50LmVtcHR5KCkuYXBwZW5kKGNvbnRlbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAkZWxlbWVudC50ZXh0KCQoY29udGVudCkudGV4dCgpKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgJGVsZW1lbnRbaHRtbCA/ICdodG1sJyA6ICd0ZXh0J10oY29udGVudCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFRvb2x0aXAucHJvdG90eXBlLmdldFRpdGxlID0gZnVuY3Rpb24gZ2V0VGl0bGUoKSB7XG4gICAgICB2YXIgdGl0bGUgPSB0aGlzLmVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLW9yaWdpbmFsLXRpdGxlJyk7XG5cbiAgICAgIGlmICghdGl0bGUpIHtcbiAgICAgICAgdGl0bGUgPSB0eXBlb2YgdGhpcy5jb25maWcudGl0bGUgPT09ICdmdW5jdGlvbicgPyB0aGlzLmNvbmZpZy50aXRsZS5jYWxsKHRoaXMuZWxlbWVudCkgOiB0aGlzLmNvbmZpZy50aXRsZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRpdGxlO1xuICAgIH07XG5cbiAgICBUb29sdGlwLnByb3RvdHlwZS5jbGVhbnVwVGV0aGVyID0gZnVuY3Rpb24gY2xlYW51cFRldGhlcigpIHtcbiAgICAgIGlmICh0aGlzLl90ZXRoZXIpIHtcbiAgICAgICAgdGhpcy5fdGV0aGVyLmRlc3Ryb3koKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gcHJpdmF0ZVxuXG4gICAgVG9vbHRpcC5wcm90b3R5cGUuX2dldEF0dGFjaG1lbnQgPSBmdW5jdGlvbiBfZ2V0QXR0YWNobWVudChwbGFjZW1lbnQpIHtcbiAgICAgIHJldHVybiBBdHRhY2htZW50TWFwW3BsYWNlbWVudC50b1VwcGVyQ2FzZSgpXTtcbiAgICB9O1xuXG4gICAgVG9vbHRpcC5wcm90b3R5cGUuX3NldExpc3RlbmVycyA9IGZ1bmN0aW9uIF9zZXRMaXN0ZW5lcnMoKSB7XG4gICAgICB2YXIgX3RoaXMzID0gdGhpcztcblxuICAgICAgdmFyIHRyaWdnZXJzID0gdGhpcy5jb25maWcudHJpZ2dlci5zcGxpdCgnICcpO1xuXG4gICAgICB0cmlnZ2Vycy5mb3JFYWNoKGZ1bmN0aW9uICh0cmlnZ2VyKSB7XG4gICAgICAgIGlmICh0cmlnZ2VyID09PSAnY2xpY2snKSB7XG4gICAgICAgICAgJChfdGhpczMuZWxlbWVudCkub24oX3RoaXMzLmNvbnN0cnVjdG9yLkV2ZW50LkNMSUNLLCBfdGhpczMuY29uZmlnLnNlbGVjdG9yLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpczMudG9nZ2xlKGV2ZW50KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmICh0cmlnZ2VyICE9PSBUcmlnZ2VyLk1BTlVBTCkge1xuICAgICAgICAgIHZhciBldmVudEluID0gdHJpZ2dlciA9PT0gVHJpZ2dlci5IT1ZFUiA/IF90aGlzMy5jb25zdHJ1Y3Rvci5FdmVudC5NT1VTRUVOVEVSIDogX3RoaXMzLmNvbnN0cnVjdG9yLkV2ZW50LkZPQ1VTSU47XG4gICAgICAgICAgdmFyIGV2ZW50T3V0ID0gdHJpZ2dlciA9PT0gVHJpZ2dlci5IT1ZFUiA/IF90aGlzMy5jb25zdHJ1Y3Rvci5FdmVudC5NT1VTRUxFQVZFIDogX3RoaXMzLmNvbnN0cnVjdG9yLkV2ZW50LkZPQ1VTT1VUO1xuXG4gICAgICAgICAgJChfdGhpczMuZWxlbWVudCkub24oZXZlbnRJbiwgX3RoaXMzLmNvbmZpZy5zZWxlY3RvciwgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMzLl9lbnRlcihldmVudCk7XG4gICAgICAgICAgfSkub24oZXZlbnRPdXQsIF90aGlzMy5jb25maWcuc2VsZWN0b3IsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgcmV0dXJuIF90aGlzMy5fbGVhdmUoZXZlbnQpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgJChfdGhpczMuZWxlbWVudCkuY2xvc2VzdCgnLm1vZGFsJykub24oJ2hpZGUuYnMubW9kYWwnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuIF90aGlzMy5oaWRlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGlmICh0aGlzLmNvbmZpZy5zZWxlY3Rvcikge1xuICAgICAgICB0aGlzLmNvbmZpZyA9ICQuZXh0ZW5kKHt9LCB0aGlzLmNvbmZpZywge1xuICAgICAgICAgIHRyaWdnZXI6ICdtYW51YWwnLFxuICAgICAgICAgIHNlbGVjdG9yOiAnJ1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2ZpeFRpdGxlKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFRvb2x0aXAucHJvdG90eXBlLl9maXhUaXRsZSA9IGZ1bmN0aW9uIF9maXhUaXRsZSgpIHtcbiAgICAgIHZhciB0aXRsZVR5cGUgPSBfdHlwZW9mKHRoaXMuZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwtdGl0bGUnKSk7XG4gICAgICBpZiAodGhpcy5lbGVtZW50LmdldEF0dHJpYnV0ZSgndGl0bGUnKSB8fCB0aXRsZVR5cGUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2RhdGEtb3JpZ2luYWwtdGl0bGUnLCB0aGlzLmVsZW1lbnQuZ2V0QXR0cmlidXRlKCd0aXRsZScpIHx8ICcnKTtcbiAgICAgICAgdGhpcy5lbGVtZW50LnNldEF0dHJpYnV0ZSgndGl0bGUnLCAnJyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIFRvb2x0aXAucHJvdG90eXBlLl9lbnRlciA9IGZ1bmN0aW9uIF9lbnRlcihldmVudCwgY29udGV4dCkge1xuICAgICAgdmFyIGRhdGFLZXkgPSB0aGlzLmNvbnN0cnVjdG9yLkRBVEFfS0VZO1xuXG4gICAgICBjb250ZXh0ID0gY29udGV4dCB8fCAkKGV2ZW50LmN1cnJlbnRUYXJnZXQpLmRhdGEoZGF0YUtleSk7XG5cbiAgICAgIGlmICghY29udGV4dCkge1xuICAgICAgICBjb250ZXh0ID0gbmV3IHRoaXMuY29uc3RydWN0b3IoZXZlbnQuY3VycmVudFRhcmdldCwgdGhpcy5fZ2V0RGVsZWdhdGVDb25maWcoKSk7XG4gICAgICAgICQoZXZlbnQuY3VycmVudFRhcmdldCkuZGF0YShkYXRhS2V5LCBjb250ZXh0KTtcbiAgICAgIH1cblxuICAgICAgaWYgKGV2ZW50KSB7XG4gICAgICAgIGNvbnRleHQuX2FjdGl2ZVRyaWdnZXJbZXZlbnQudHlwZSA9PT0gJ2ZvY3VzaW4nID8gVHJpZ2dlci5GT0NVUyA6IFRyaWdnZXIuSE9WRVJdID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKCQoY29udGV4dC5nZXRUaXBFbGVtZW50KCkpLmhhc0NsYXNzKENsYXNzTmFtZS5TSE9XKSB8fCBjb250ZXh0Ll9ob3ZlclN0YXRlID09PSBIb3ZlclN0YXRlLlNIT1cpIHtcbiAgICAgICAgY29udGV4dC5faG92ZXJTdGF0ZSA9IEhvdmVyU3RhdGUuU0hPVztcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjbGVhclRpbWVvdXQoY29udGV4dC5fdGltZW91dCk7XG5cbiAgICAgIGNvbnRleHQuX2hvdmVyU3RhdGUgPSBIb3ZlclN0YXRlLlNIT1c7XG5cbiAgICAgIGlmICghY29udGV4dC5jb25maWcuZGVsYXkgfHwgIWNvbnRleHQuY29uZmlnLmRlbGF5LnNob3cpIHtcbiAgICAgICAgY29udGV4dC5zaG93KCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29udGV4dC5fdGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoY29udGV4dC5faG92ZXJTdGF0ZSA9PT0gSG92ZXJTdGF0ZS5TSE9XKSB7XG4gICAgICAgICAgY29udGV4dC5zaG93KCk7XG4gICAgICAgIH1cbiAgICAgIH0sIGNvbnRleHQuY29uZmlnLmRlbGF5LnNob3cpO1xuICAgIH07XG5cbiAgICBUb29sdGlwLnByb3RvdHlwZS5fbGVhdmUgPSBmdW5jdGlvbiBfbGVhdmUoZXZlbnQsIGNvbnRleHQpIHtcbiAgICAgIHZhciBkYXRhS2V5ID0gdGhpcy5jb25zdHJ1Y3Rvci5EQVRBX0tFWTtcblxuICAgICAgY29udGV4dCA9IGNvbnRleHQgfHwgJChldmVudC5jdXJyZW50VGFyZ2V0KS5kYXRhKGRhdGFLZXkpO1xuXG4gICAgICBpZiAoIWNvbnRleHQpIHtcbiAgICAgICAgY29udGV4dCA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKGV2ZW50LmN1cnJlbnRUYXJnZXQsIHRoaXMuX2dldERlbGVnYXRlQ29uZmlnKCkpO1xuICAgICAgICAkKGV2ZW50LmN1cnJlbnRUYXJnZXQpLmRhdGEoZGF0YUtleSwgY29udGV4dCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChldmVudCkge1xuICAgICAgICBjb250ZXh0Ll9hY3RpdmVUcmlnZ2VyW2V2ZW50LnR5cGUgPT09ICdmb2N1c291dCcgPyBUcmlnZ2VyLkZPQ1VTIDogVHJpZ2dlci5IT1ZFUl0gPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNvbnRleHQuX2lzV2l0aEFjdGl2ZVRyaWdnZXIoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNsZWFyVGltZW91dChjb250ZXh0Ll90aW1lb3V0KTtcblxuICAgICAgY29udGV4dC5faG92ZXJTdGF0ZSA9IEhvdmVyU3RhdGUuT1VUO1xuXG4gICAgICBpZiAoIWNvbnRleHQuY29uZmlnLmRlbGF5IHx8ICFjb250ZXh0LmNvbmZpZy5kZWxheS5oaWRlKSB7XG4gICAgICAgIGNvbnRleHQuaGlkZSgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnRleHQuX3RpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKGNvbnRleHQuX2hvdmVyU3RhdGUgPT09IEhvdmVyU3RhdGUuT1VUKSB7XG4gICAgICAgICAgY29udGV4dC5oaWRlKCk7XG4gICAgICAgIH1cbiAgICAgIH0sIGNvbnRleHQuY29uZmlnLmRlbGF5LmhpZGUpO1xuICAgIH07XG5cbiAgICBUb29sdGlwLnByb3RvdHlwZS5faXNXaXRoQWN0aXZlVHJpZ2dlciA9IGZ1bmN0aW9uIF9pc1dpdGhBY3RpdmVUcmlnZ2VyKCkge1xuICAgICAgZm9yICh2YXIgdHJpZ2dlciBpbiB0aGlzLl9hY3RpdmVUcmlnZ2VyKSB7XG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVUcmlnZ2VyW3RyaWdnZXJdKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH07XG5cbiAgICBUb29sdGlwLnByb3RvdHlwZS5fZ2V0Q29uZmlnID0gZnVuY3Rpb24gX2dldENvbmZpZyhjb25maWcpIHtcbiAgICAgIGNvbmZpZyA9ICQuZXh0ZW5kKHt9LCB0aGlzLmNvbnN0cnVjdG9yLkRlZmF1bHQsICQodGhpcy5lbGVtZW50KS5kYXRhKCksIGNvbmZpZyk7XG5cbiAgICAgIGlmIChjb25maWcuZGVsYXkgJiYgdHlwZW9mIGNvbmZpZy5kZWxheSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgY29uZmlnLmRlbGF5ID0ge1xuICAgICAgICAgIHNob3c6IGNvbmZpZy5kZWxheSxcbiAgICAgICAgICBoaWRlOiBjb25maWcuZGVsYXlcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgVXRpbC50eXBlQ2hlY2tDb25maWcoTkFNRSwgY29uZmlnLCB0aGlzLmNvbnN0cnVjdG9yLkRlZmF1bHRUeXBlKTtcblxuICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICB9O1xuXG4gICAgVG9vbHRpcC5wcm90b3R5cGUuX2dldERlbGVnYXRlQ29uZmlnID0gZnVuY3Rpb24gX2dldERlbGVnYXRlQ29uZmlnKCkge1xuICAgICAgdmFyIGNvbmZpZyA9IHt9O1xuXG4gICAgICBpZiAodGhpcy5jb25maWcpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMuY29uZmlnKSB7XG4gICAgICAgICAgaWYgKHRoaXMuY29uc3RydWN0b3IuRGVmYXVsdFtrZXldICE9PSB0aGlzLmNvbmZpZ1trZXldKSB7XG4gICAgICAgICAgICBjb25maWdba2V5XSA9IHRoaXMuY29uZmlnW2tleV07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBjb25maWc7XG4gICAgfTtcblxuICAgIC8vIHN0YXRpY1xuXG4gICAgVG9vbHRpcC5falF1ZXJ5SW50ZXJmYWNlID0gZnVuY3Rpb24gX2pRdWVyeUludGVyZmFjZShjb25maWcpIHtcbiAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZGF0YSA9ICQodGhpcykuZGF0YShEQVRBX0tFWSk7XG4gICAgICAgIHZhciBfY29uZmlnID0gKHR5cGVvZiBjb25maWcgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGNvbmZpZykpID09PSAnb2JqZWN0JyAmJiBjb25maWc7XG5cbiAgICAgICAgaWYgKCFkYXRhICYmIC9kaXNwb3NlfGhpZGUvLnRlc3QoY29uZmlnKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZGF0YSkge1xuICAgICAgICAgIGRhdGEgPSBuZXcgVG9vbHRpcCh0aGlzLCBfY29uZmlnKTtcbiAgICAgICAgICAkKHRoaXMpLmRhdGEoREFUQV9LRVksIGRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgaWYgKGRhdGFbY29uZmlnXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG1ldGhvZCBuYW1lZCBcIicgKyBjb25maWcgKyAnXCInKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGF0YVtjb25maWddKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBfY3JlYXRlQ2xhc3MoVG9vbHRpcCwgbnVsbCwgW3tcbiAgICAgIGtleTogJ1ZFUlNJT04nLFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiBWRVJTSU9OO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIGtleTogJ0RlZmF1bHQnLFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiBEZWZhdWx0O1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIGtleTogJ05BTUUnLFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiBOQU1FO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIGtleTogJ0RBVEFfS0VZJyxcbiAgICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICByZXR1cm4gREFUQV9LRVk7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAga2V5OiAnRXZlbnQnLFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiBFdmVudDtcbiAgICAgIH1cbiAgICB9LCB7XG4gICAgICBrZXk6ICdFVkVOVF9LRVknLFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiBFVkVOVF9LRVk7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAga2V5OiAnRGVmYXVsdFR5cGUnLFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiBEZWZhdWx0VHlwZTtcbiAgICAgIH1cbiAgICB9XSk7XG5cbiAgICByZXR1cm4gVG9vbHRpcDtcbiAgfSgpO1xuXG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogalF1ZXJ5XG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuICAkLmZuW05BTUVdID0gVG9vbHRpcC5falF1ZXJ5SW50ZXJmYWNlO1xuICAkLmZuW05BTUVdLkNvbnN0cnVjdG9yID0gVG9vbHRpcDtcbiAgJC5mbltOQU1FXS5ub0NvbmZsaWN0ID0gZnVuY3Rpb24gKCkge1xuICAgICQuZm5bTkFNRV0gPSBKUVVFUllfTk9fQ09ORkxJQ1Q7XG4gICAgcmV0dXJuIFRvb2x0aXAuX2pRdWVyeUludGVyZmFjZTtcbiAgfTtcblxuICByZXR1cm4gVG9vbHRpcDtcbn0oalF1ZXJ5KTsgLyogZ2xvYmFsIFRldGhlciAqL1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dG9vbHRpcC5qcy5tYXBcbiJdfQ==
