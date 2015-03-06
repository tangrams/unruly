"use strict";

var _slicedToArray = function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { var _arr = []; for (var _iterator = arr[Symbol.iterator](), _step; !(_step = _iterator.next()).done;) { _arr.push(_step.value); if (i && _arr.length === i) break; } return _arr; } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } };

var _toConsumableArray = function (arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } };

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc && desc.writable) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

var _prototypeProperties = function (child, staticProps, instanceProps) { if (staticProps) Object.defineProperties(child, staticProps); if (instanceProps) Object.defineProperties(child.prototype, instanceProps); };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

exports.mergeTrees = mergeTrees;
exports.walkUp = walkUp;
exports.walkDown = walkDown;
exports.groupProps = groupProps;
exports.calculateStyle = calculateStyle;
exports.mergeObjects = mergeObjects;
exports.calculateOrder = calculateOrder;
exports.parseRuleTree = parseRuleTree;
exports.parseRules = parseRules;
exports.matchFeature = matchFeature;

var _require = require("match-feature");

var match = _require.match;
var whiteList = exports.whiteList = ["filter", "style", "geometry", "properties"];

var ruleCache = exports.ruleCache = {};

function cacheKey(rules) {
    return rules.map(function (r) {
        return r.id;
    }).join("/");
}

function mergeTrees(matchingTrees, context) {
    var style = {};
    var deepestOrder = undefined,
        orderReset = undefined;
    var visible = undefined;

    // Find deepest tree
    matchingTrees.sort(function (a, b) {
        return a.length > b.length ? -1 : b.length > a.length ? 1 : 0;
    });
    var len = matchingTrees[0].length;

    // Iterate trees in parallel
    for (var x = 0; x < len; x++) {
        (function (x) {
            var styles = matchingTrees.map(function (tree) {
                return tree[x];
            });
            mergeObjects.apply(undefined, [style].concat(_toConsumableArray(styles)));

            for (var i = 0; i < styles.length; i++) {
                if (!styles[i]) {
                    continue;
                }

                // `visible` property is only true if all matching rules are visible
                if (styles[i].visible === false) {
                    visible = false;
                } else if (visible === undefined) {
                    visible = true;
                }

                // Make note of the style positions of order-related properties
                if (styles[i].order !== undefined) {
                    deepestOrder = i;
                }

                if (styles[i].orderReset !== undefined) {
                    orderReset = x;
                }
            }
        })(x);
    }

    if (visible === undefined) {
        return null;
    }

    style.visible = visible;

    // Order must be calculated based on the deepest tree that had an order property
    if (deepestOrder !== undefined) {
        var orderTree = matchingTrees[deepestOrder];

        if (orderTree.length <= 1) {
            style.order = orderTree[0].order;
        } else {
            style.order = [];
            for (var x = orderReset || 0; x < orderTree.length; x++) {
                if (orderTree[x] && orderTree[x].order) {
                    style.order.push(orderTree[x].order);
                }
            }

            // Order can be cached if it is only a single value
            if (style.order.length === 1 && typeof style.order[0] === "number") {
                style.order = style.order[0];
            }
            // Or if there are no function dependencies
            else if (!style.order.some(function (v) {
                return typeof v === "function";
            })) {
                style.order = calculateOrder(style.order, context);
            }
        }
    }

    return style;
}

var Rule = (function () {
    function Rule(name, parent, style, filter, properties) {
        _classCallCheck(this, Rule);

        this.id = Rule.id++;
        this.name = name;
        this.style = style;
        this.filter = filter;
        this.properties = properties;
        this.parent = parent;
        this.buildFilter();
        this.buildStyle();
    }

    _prototypeProperties(Rule, null, {
        buildStyle: {
            value: function buildStyle() {
                this.calculatedStyle = calculateStyle(this);
            },
            writable: true,
            configurable: true
        },
        buildFilter: {
            value: function buildFilter() {
                var type = typeof this.filter;
                if (type === "object") {
                    this.filter = match(this.filter);
                }
            },
            writable: true,
            configurable: true
        },
        toJSON: {
            value: function toJSON() {
                return {
                    name: this.name,
                    sytle: this.style
                };
            },
            writable: true,
            configurable: true
        }
    });

    return Rule;
})();

Rule.id = 0;

var RuleLeaf = exports.RuleLeaf = (function (Rule) {
    function RuleLeaf(_ref) {
        var name = _ref.name;
        var parent = _ref.parent;
        var style = _ref.style;
        var filter = _ref.filter;
        var properties = _ref.properties;

        _classCallCheck(this, RuleLeaf);

        _get(Object.getPrototypeOf(RuleLeaf.prototype), "constructor", this).call(this, name, parent, style, filter, properties);
    }

    _inherits(RuleLeaf, Rule);

    return RuleLeaf;
})(Rule);

var RuleTree = exports.RuleTree = (function (Rule) {
    function RuleTree(_ref) {
        var name = _ref.name;
        var parent = _ref.parent;
        var style = _ref.style;
        var rules = _ref.rules;
        var filter = _ref.filter;
        var properties = _ref.properties;

        _classCallCheck(this, RuleTree);

        _get(Object.getPrototypeOf(RuleTree.prototype), "constructor", this).call(this, name, parent, style, filter, properties);
        this.rules = rules || [];
    }

    _inherits(RuleTree, Rule);

    _prototypeProperties(RuleTree, null, {
        addRule: {
            value: function addRule(rule) {
                this.rules.push(rule);
            },
            writable: true,
            configurable: true
        },
        findMatchingRules: {
            value: function findMatchingRules(context) {
                var rules = [];
                //TODO, should this function take a RuleTree
                matchFeature(context, [this], rules);

                if (rules.length > 0) {

                    var key = cacheKey(rules);
                    if (!ruleCache[key]) {
                        ruleCache[key] = mergeTrees(rules.map(function (x) {
                            return x && x.calculatedStyle;
                        }), context);
                    }
                    return ruleCache[key];
                }
            },
            writable: true,
            configurable: true
        }
    });

    return RuleTree;
})(Rule);

function isWhiteListed(key) {
    return whiteList.indexOf(key) > -1;
}

function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

function walkUp(rule, cb) {

    if (rule.parent) {
        walkUp(rule.parent, cb);
    }

    cb(rule);
}

function walkDown(rule, cb) {

    if (rule.rules) {
        rule.rules.forEach(function (r) {
            walkDown(r, cb);
        });
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

    var styles = [];

    if (rule.parent) {
        var cs = rule.parent.calculatedStyle || [];
        styles.push.apply(styles, _toConsumableArray(cs));
    }

    styles.push(rule.style);
    return styles;
}

function mergeObjects(newObj) {
    for (var _len = arguments.length, sources = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        sources[_key - 1] = arguments[_key];
    }

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {

        for (var _iterator = sources[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var source = _step.value;

            if (!source) {
                continue;
            }
            for (var key in source) {
                var value = source[key];
                if (typeof value === "object" && !Array.isArray(value)) {
                    newObj[key] = mergeObjects(newObj[key] || {}, value);
                } else {
                    newObj[key] = value;
                }
            }
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator["return"]) {
                _iterator["return"]();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    return newObj;
}

function calculateOrder(orders) {
    var context = arguments[1] === undefined ? null : arguments[1];
    var defaultOrder = arguments[2] === undefined ? 0 : arguments[2];

    var sum = defaultOrder;

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = orders[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var order = _step.value;

            if (typeof order === "function") {
                order = order(context);
            } else {
                order = parseFloat(order);
            }

            if (!order || isNaN(order)) {
                continue;
            }
            sum += order;
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator["return"]) {
                _iterator["return"]();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    return sum;
}

function parseRuleTree(name, rule, parent) {

    var properties = { name: name, parent: parent };

    var _groupProps = groupProps(rule);

    var _groupProps2 = _slicedToArray(_groupProps, 2);

    var whiteListed = _groupProps2[0];
    var nonWhiteListed = _groupProps2[1];

    var empty = isEmpty(nonWhiteListed);
    var Create = undefined;

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
            if (typeof property === "object") {
                parseRuleTree(key, property, r);
            } else {
                console.error("Property must be an object");
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
    return typeof filter === "function" && filter(context) || filter == null;
}

function matchFeature(context, rules, collectedRules) {
    var matched = false;
    var childMatched = false;

    if (rules.length === 0) {
        return;
    }

    for (var r = 0; r < rules.length; r++) {
        var current = rules[r];
        context.properties = current.properties;

        if (current instanceof RuleLeaf) {

            if (doesMatch(current.filter, context)) {
                matched = true;
                collectedRules.push(current);
            }
        } else if (current instanceof RuleTree) {
            if (doesMatch(current.filter, context)) {
                matched = true;

                childMatched = matchFeature(context, current.rules, collectedRules);

                if (!childMatched) {
                    collectedRules.push(current);
                }
            }
        }

        context.properties = null;
    }

    return matched;
}

Object.defineProperty(exports, "__esModule", {
    value: true
});

