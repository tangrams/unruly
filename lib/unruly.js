"use strict";
'use strict';
Object.defineProperties(module.exports, {
  whiteList: {get: function() {
      return whiteList;
    }},
  ruleCache: {get: function() {
      return ruleCache;
    }},
  mergeTrees: {get: function() {
      return mergeTrees;
    }},
  RuleLeaf: {get: function() {
      return RuleLeaf;
    }},
  RuleTree: {get: function() {
      return RuleTree;
    }},
  walkUp: {get: function() {
      return walkUp;
    }},
  walkDown: {get: function() {
      return walkDown;
    }},
  groupProps: {get: function() {
      return groupProps;
    }},
  calculateStyle: {get: function() {
      return calculateStyle;
    }},
  mergeObjects: {get: function() {
      return mergeObjects;
    }},
  calculateOrder: {get: function() {
      return calculateOrder;
    }},
  parseRuleTree: {get: function() {
      return parseRuleTree;
    }},
  parseRules: {get: function() {
      return parseRules;
    }},
  matchFeature: {get: function() {
      return matchFeature;
    }},
  __esModule: {value: true}
});
var match = require('match-feature').match;
var whiteList = ['filter', 'style', 'geometry'];
var ruleCache = {};
function cacheKey(rules) {
  return rules.map((function(r) {
    return r.id;
  })).join('/');
}
function mergeTrees(matchingTrees, context) {
  var style = {};
  var deepestOrder,
      orderReset;
  var visible = true;
  matchingTrees.sort((function(a, b) {
    return a.length > b.length ? -1 : (b.length > a.length ? 1 : 0);
  }));
  var len = matchingTrees[0].length;
  var $__8 = function(x) {
    var styles = matchingTrees.map((function(tree) {
      return tree[x];
    }));
    mergeObjects.apply((void 0), $traceurRuntime.spread([style], styles));
    for (var i = 0; i < styles.length; i++) {
      if (!styles[i]) {
        continue;
      }
      if (styles[i].visible === false) {
        visible = false;
      }
      if (styles[i].order !== undefined) {
        deepestOrder = i;
      }
      if (styles[i].orderReset !== undefined) {
        orderReset = x;
      }
    }
  };
  for (var x = 0; x < len; x++) {
    $__8(x);
  }
  style.visible = visible;
  if (deepestOrder !== undefined) {
    var orderTree = matchingTrees[deepestOrder];
    if (orderTree.length <= 1) {
      style.order = orderTree[0].order;
    } else {
      style.order = [];
      for (var x$__9 = orderReset || 0; x$__9 < orderTree.length; x$__9++) {
        if (orderTree[x$__9] && orderTree[x$__9].order) {
          style.order.push(orderTree[x$__9].order);
        }
      }
      if (style.order.length === 1 && typeof style.order[0] === 'number') {
        style.order = style.order[0];
      } else if (!style.order.some((function(v) {
        return typeof v === 'function';
      }))) {
        style.order = calculateOrder(style.order, context);
      }
    }
  }
  return style;
}
var Rule = function Rule(name, parent, style, filter) {
  this.id = $Rule.id++;
  this.name = name;
  this.style = style || {};
  this.filter = filter;
  this.parent = parent;
  this.buildFilter();
  this.buildStyle();
  this.gatherParentStyles();
};
var $Rule = Rule;
($traceurRuntime.createClass)(Rule, {
  buildStyle: function() {
    this.calculatedStyle = calculateStyle(this);
  },
  buildFilter: function() {
    var type = typeof this.filter;
    if (type === 'object') {
      this.filter = match(this.filter);
    }
  },
  gatherParentStyles: function() {
    this.parentStyles = this.calculatedStyle.slice(0, this.calculatedStyle.length - 1);
  },
  toJSON: function() {
    return {
      name: this.name,
      sytle: this.style
    };
  }
}, {});
Rule.id = 0;
var RuleLeaf = function RuleLeaf($__5) {
  var $__6 = $__5,
      name = $__6.name,
      parent = $__6.parent,
      style = $__6.style,
      filter = $__6.filter;
  $traceurRuntime.superConstructor($RuleLeaf).call(this, name, parent, style, filter);
};
var $RuleLeaf = RuleLeaf;
($traceurRuntime.createClass)(RuleLeaf, {}, {}, Rule);
var RuleTree = function RuleTree($__5) {
  var $__6 = $__5,
      name = $__6.name,
      parent = $__6.parent,
      style = $__6.style,
      rules = $__6.rules,
      filter = $__6.filter;
  $traceurRuntime.superConstructor($RuleTree).call(this, name, parent, style, filter);
  this.rules = rules || [];
};
var $RuleTree = RuleTree;
($traceurRuntime.createClass)(RuleTree, {
  addRule: function(rule) {
    this.rules.push(rule);
  },
  findMatchingRules: function(context) {
    var rules = [];
    matchFeature(context, this.rules, rules);
    if (rules.length > 0) {
      var key = cacheKey(rules);
      if (!ruleCache[key]) {
        ruleCache[key] = mergeTrees(rules.map((function(x) {
          return x.calculatedStyle;
        })), context);
      }
      return ruleCache[key];
    }
    return {};
  }
}, {}, Rule);
function isWhiteListed(key) {
  return whiteList.indexOf(key) > -1;
}
function isEmpty(obj) {
  return Object.getOwnPropertyNames(obj).length === 0;
}
function walkUp(rule, cb) {
  if (rule.parent) {
    walkUp(rule.parent, cb);
  }
  cb(rule);
}
function walkDown(rule, cb) {
  if (rule.rules) {
    rule.rules.forEach((function(r) {
      walkDown(r, cb);
    }));
  }
  cb(rule);
}
function groupProps(obj) {
  var whiteListed = {},
      nonWhiteListed = {};
  for (var key in obj) {
    if (isWhiteListed(key)) {
      whiteListed[key] = obj[key];
    } else {
      nonWhiteListed[key] = obj[key];
    }
  }
  return [whiteListed, nonWhiteListed];
}
function calculateStyle(rule) {
  var styles = arguments[1] !== (void 0) ? arguments[1] : [];
  walkUp(rule, (function(r) {
    if (r.style) {
      styles.push(r.style);
    }
  }));
  return styles;
}
function mergeObjects(newObj) {
  for (var sources = [],
      $__3 = 1; $__3 < arguments.length; $__3++)
    sources[$__3 - 1] = arguments[$__3];
  for (var $__1 = sources[$traceurRuntime.toProperty(Symbol.iterator)](),
      $__2 = void 0; !($__2 = $__1.next()).done; ) {
    var source = $__2.value;
    {
      if (!source) {
        continue;
      }
      for (var key = void 0 in source) {
        var value = source[key];
        if (typeof value === 'object' && !Array.isArray(value)) {
          newObj[key] = mergeObjects(newObj[key] || {}, value);
        } else {
          newObj[key] = value;
        }
      }
    }
  }
  return newObj;
}
function calculateOrder(orders) {
  var context = arguments[1] !== (void 0) ? arguments[1] : null;
  var defaultOrder = arguments[2] !== (void 0) ? arguments[2] : 0;
  var sum = defaultOrder;
  for (var $__1 = orders[$traceurRuntime.toProperty(Symbol.iterator)](),
      $__2 = void 0; !($__2 = $__1.next()).done; ) {
    var order = $__2.value;
    {
      if (typeof order === 'function') {
        order = order(context);
      } else {
        order = parseFloat(order);
      }
      if (!order || isNaN(order)) {
        continue;
      }
      sum += order;
    }
  }
  return sum;
}
function parseRuleTree(name, rule, parent) {
  var $__6,
      $__7;
  var properties = {
    name: name,
    parent: parent
  };
  var $__5 = groupProps(rule),
      whiteListed = ($__6 = $__5[$traceurRuntime.toProperty(Symbol.iterator)](), ($__7 = $__6.next()).done ? void 0 : $__7.value),
      nonWhiteListed = ($__7 = $__6.next()).done ? void 0 : $__7.value;
  var empty = isEmpty(nonWhiteListed);
  var Create;
  if (empty && parent != null) {
    Create = RuleLeaf;
  } else {
    Create = RuleTree;
  }
  var r = new Create(Object.assign(properties, whiteListed));
  if (parent) {
    parent.addRule(r);
  }
  if (!empty) {
    for (var key in nonWhiteListed) {
      var property = nonWhiteListed[key];
      if (typeof property === 'object') {
        parseRuleTree(key, property, r);
      }
    }
  }
  return r;
}
function parseRules(rules) {
  var ruleTrees = {};
  for (var key in rules) {
    var rule = rules[key];
    ruleTrees[key] = parseRuleTree(key, rule);
  }
  return ruleTrees;
}
function doesMatch(filter, context) {
  return ((typeof filter === 'function' && filter(context)) || (filter == null));
}
function matchFeature(context, rules, collectedRules) {
  var matched = false;
  var childMatched = false;
  if (rules.length === 0) {
    return ;
  }
  for (var r = 0; r < rules.length; r++) {
    var current = rules[r];
    if (current instanceof RuleLeaf) {
      if (doesMatch(current.filter, context)) {
        matched = true;
        if (current.style) {
          collectedRules.push(current);
        }
      }
    } else if (current instanceof RuleTree) {
      if (doesMatch(current.filter, context)) {
        matched = true;
        childMatched = matchFeature(context, current.rules, collectedRules);
        if (!childMatched && current.style) {
          collectedRules.push(current);
        }
      }
    }
  }
  return matched;
}
