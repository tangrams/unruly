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
  mergeObject: {get: function() {
      return mergeObject;
    }},
  calculateOrder: {get: function() {
      return calculateOrder;
    }},
  mergeStyles: {get: function() {
      return mergeStyles;
    }},
  parseRuleTree: {get: function() {
      return parseRuleTree;
    }},
  parseRules: {get: function() {
      return parseRules;
    }},
  doesMatch: {get: function() {
      return doesMatch;
    }},
  matchFeature: {get: function() {
      return matchFeature;
    }},
  __esModule: {value: true}
});
var match = require('match-feature').match;
var whiteList = ['filter', 'style', 'geometry'];
var ruleCache = {};
var treeStyles = [];
function mergeTrees(trees, numTrees, context) {
  var style = {};
  var deepestOrder,
      orderReset;
  var visible = true;
  var len = 0;
  for (var t = 0; t < numTrees; t++) {
    if (trees[t].length > len) {
      len = trees[t].length;
    }
  }
  for (var x = 0; x < len; x++) {
    for (var t$__7 = 0; t$__7 < numTrees; t$__7++) {
      treeStyles[t$__7] = trees[t$__7][x];
    }
    var styles$__8 = treeStyles;
    mergeObjects(style, styles$__8, numTrees);
    for (var t$__9 = 0; t$__9 < numTrees; t$__9++) {
      if (!styles$__8[t$__9]) {
        continue;
      }
      if (styles$__8[t$__9].visible === false) {
        visible = false;
      }
      if (styles$__8[t$__9].order !== undefined) {
        deepestOrder = t$__9;
      }
      if (styles$__8[t$__9].orderReset !== undefined) {
        orderReset = x;
      }
    }
  }
  style.visible = visible;
  if (deepestOrder !== undefined) {
    var orderTree = trees[deepestOrder];
    if (orderTree.length <= 1) {
      style.order = orderTree[0].order;
    } else {
      style.order = [];
      for (var x$__10 = orderReset || 0; x$__10 < orderTree.length; x$__10++) {
        if (orderTree[x$__10] && orderTree[x$__10].order) {
          style.order.push(orderTree[x$__10].order);
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
      style: this.style
    };
  }
}, {});
Rule.id = 0;
var RuleLeaf = function RuleLeaf($__4) {
  var $__5 = $__4,
      name = $__5.name,
      parent = $__5.parent,
      style = $__5.style,
      filter = $__5.filter;
  $traceurRuntime.superConstructor($RuleLeaf).call(this, name, parent, style, filter);
};
var $RuleLeaf = RuleLeaf;
($traceurRuntime.createClass)(RuleLeaf, {}, {}, Rule);
var state = {};
var styles = [];
var RuleTree = function RuleTree($__4) {
  var $__5 = $__4,
      name = $__5.name,
      parent = $__5.parent,
      style = $__5.style,
      rules = $__5.rules,
      filter = $__5.filter;
  $traceurRuntime.superConstructor($RuleTree).call(this, name, parent, style, filter);
  this.rules = rules || [];
};
var $RuleTree = RuleTree;
($traceurRuntime.createClass)(RuleTree, {
  addRule: function(rule) {
    this.rules.push(rule);
  },
  findMatchingRules: function(context) {
    var flatten = arguments[1] !== (void 0) ? arguments[1] : false;
    state.key = '';
    state.numStyles = 0;
    matchFeature(context, this.rules, styles, state);
    var key = state.key;
    if (state.numStyles > 0) {
      if (flatten === true) {
        if (!ruleCache[key]) {
          ruleCache[key] = mergeTrees(styles, state.numStyles, context);
        }
        return ruleCache[key];
      } else {
        return rules.map((function(x) {
          return mergeStyles(x.calculatedStyle, context);
        }));
      }
    }
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
function mergeObjects(newObj, sources, numSources) {
  for (var s = 0; s < numSources; s++) {
    mergeObject(newObj, sources[s]);
  }
  return newObj;
}
function mergeObject(newObj, source) {
  if (source) {
    for (var key in source) {
      var value = source[key];
      if (typeof value === 'object' && !Array.isArray(value)) {
        newObj[key] = mergeObject(newObj[key] || {}, value);
      } else {
        newObj[key] = value;
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
function mergeStyles(styles) {
  styles = styles.filter((function(x) {
    return x;
  }));
  var style = mergeObjects({}, styles, styles.length);
  style.visible = !styles.some((function(x) {
    return x.visible === false;
  }));
  var orderStart = 0;
  for (var i = styles.length - 1; i >= 0; i -= 1) {
    if (styles[i].orderReset) {
      orderStart = i;
      break;
    }
  }
  style.order = styles.slice(orderStart).filter((function(style) {
    return style.order;
  })).map((function(style) {
    return style.order;
  }));
  if (style.order.length === 1 && typeof style.order[0] === 'number') {
    style.order = style.order[0];
  } else {
    style.order = calculateOrder(style.order, context);
  }
  return style;
}
function parseRuleTree(name, rule, parent) {
  var $__5,
      $__6;
  var properties = {
    name: name,
    parent: parent
  };
  var $__4 = groupProps(rule),
      whiteListed = ($__5 = $__4[$traceurRuntime.toProperty(Symbol.iterator)](), ($__6 = $__5.next()).done ? void 0 : $__6.value),
      nonWhiteListed = ($__6 = $__5.next()).done ? void 0 : $__6.value;
  var empty = isEmpty(nonWhiteListed);
  var Create = empty ? RuleLeaf : RuleTree;
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
    var root = new RuleTree({name: key});
    parseRuleTree(key, rule, root);
    ruleTrees[key] = root;
  }
  return ruleTrees;
}
function doesMatch(filter, context) {
  return ((typeof filter === 'function' && filter(context)) || (filter == null));
}
function matchFeature(context, rules, collectedStyles) {
  var state = arguments[3] !== (void 0) ? arguments[3] : {
    key: '',
    numStyles: 0
  };
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
          collectedStyles[state.numStyles++] = current.calculatedStyle;
          state.key += current.id + '/';
        }
      }
    } else if (current instanceof RuleTree) {
      if (doesMatch(current.filter, context)) {
        matched = true;
        childMatched = matchFeature(context, current.rules, collectedStyles, state);
        if (!childMatched && current.style) {
          collectedStyles[state.numStyles++] = current.calculatedStyle;
          state.key += current.id + '/';
        }
      }
    }
  }
  return matched;
}
