"use strict";
'use strict';
Object.defineProperties(module.exports, {
  whiteList: {get: function() {
      return whiteList;
    }},
  Rule: {get: function() {
      return Rule;
    }},
  RuleGroup: {get: function() {
      return RuleGroup;
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
  cloneStyle: {get: function() {
      return cloneStyle;
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
  matchFeature: {get: function() {
      return matchFeature;
    }},
  __esModule: {value: true}
});
var match = require('match-feature').match;
var whiteList = ['filter', 'style', 'geometry'];
var RuleMixin = {
  buildStyle: function() {
    return calculateStyle(this);
  },
  buildFilter: function() {
    var type = typeof this.filter;
    if (type === 'object') {
      this.filter = match(this.filter);
    }
  },
  toJSON: function() {
    return {
      name: this.name,
      sytle: this.style
    };
  }
};
var Rule = function Rule($__5) {
  var $__6 = $__5,
      name = $__6.name,
      parent = $__6.parent,
      style = $__6.style,
      filter = $__6.filter;
  this.name = name;
  this.parent = parent;
  this.style = style;
  this.filter = filter;
  Object.assign(this, RuleMixin);
  this.buildFilter();
};
($traceurRuntime.createClass)(Rule, {}, {});
var RuleGroup = function RuleGroup($__5) {
  var $__6 = $__5,
      name = $__6.name,
      parent = $__6.parent,
      style = $__6.style,
      rules = $__6.rules,
      filter = $__6.filter;
  this.name = name;
  this.parent = parent;
  this.style = style;
  this.filter = filter;
  this.rules = rules || [];
  Object.assign(this, RuleMixin);
  this.buildFilter();
};
($traceurRuntime.createClass)(RuleGroup, {addRule: function(rule) {
    this.rules.push(rule);
  }}, {});
var RuleTree = function RuleTree() {
  this.rules = [];
};
($traceurRuntime.createClass)(RuleTree, {
  addRule: function(rule) {
    this.rules.push(rule);
  },
  findMatchingRules: function(context) {
    var flatten = arguments[1] !== (void 0) ? arguments[1] : false;
    var rules = [];
    matchFeature(context, this.rules, rules);
    var builtStyles = rules.map((function(x) {
      return buildStyle(x, context);
    }));
    if (flatten) {
      return [mergeStyles(builtStyles, context)];
    }
    return builtStyles;
  }
}, {});
function buildStyle(rule, context) {
  return mergeStyles(calculateStyle(rule), context);
}
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
  if (!(rule instanceof RuleTree)) {
    cb(rule);
  }
}
function walkDown(rule, cb) {
  if (rule.rules) {
    rule.rules.forEach((function(r) {
      walkDown(r, cb);
    }));
  }
  if (!(rule instanceof RuleTree)) {
    cb(rule);
  }
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
function cloneStyle(newObj) {
  for (var sources = [],
      $__3 = 1; $__3 < arguments.length; $__3++)
    sources[$__3 - 1] = arguments[$__3];
  for (var $__1 = sources[$traceurRuntime.toProperty(Symbol.iterator)](),
      $__2 = void 0; !($__2 = $__1.next()).done; ) {
    var source = $__2.value;
    {
      for (var key = void 0 in source) {
        var value = source[key];
        if (typeof value === 'object' && !Array.isArray(value)) {
          newObj[key] = cloneStyle(newObj[key] || {}, value);
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
function mergeStyles(styles, context) {
  styles = styles.filter((function(x) {
    return x;
  }));
  var style = cloneStyle.apply((void 0), $traceurRuntime.spread([{}], styles));
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
  var Create = empty ? Rule : RuleGroup;
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
  var ruleTree = new RuleTree();
  for (var key in rules) {
    var rule = rules[key];
    parseRuleTree(key, rule, ruleTree);
  }
  return ruleTree;
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
  for (var $__1 = rules[$traceurRuntime.toProperty(Symbol.iterator)](),
      $__2 = void 0; !($__2 = $__1.next()).done; ) {
    var current = $__2.value;
    {
      if (current instanceof Rule) {
        if (doesMatch(current.filter, context)) {
          matched = true;
          collectedRules.push(current);
        }
      } else if (current instanceof RuleGroup) {
        if (doesMatch(current.filter, context)) {
          matched = true;
          childMatched = matchFeature(context, current.rules, collectedRules);
          if (!childMatched) {
            collectedRules.push(current);
          }
        }
      }
    }
  }
  return matched;
}
