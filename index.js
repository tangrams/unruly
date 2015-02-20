'use strict';

const {match} = require('match-feature');

export const whiteList = ['filter', 'style', 'geometry'];

export let ruleCache = {};

function cacheKey (rules) {
    return rules.map(r => r.id).join('/');
}

export function mergeWithDepth(matchingTrees, context) {
    let style = {
        visible: true
    };
    let deepestOrder;

    // Find deepest tree
    matchingTrees.sort((a, b) => a.length > b.length ? -1 : (b.length > a.length ? 1 : 0));
    let len = matchingTrees[0].length;

    // Iterate trees in parallel
    for (let x = 0; x < len; x++) {
        for (let t=0; t < matchingTrees.length; t++) {
            // Get style for this tree at current depth
            let treeStyle = matchingTrees[t][x];
            if (!treeStyle) {
                continue;
            }

            for (let key in treeStyle) {
                // `visible` property is only true if all matching rules are visible
                if (key === 'visible') {
                    style[key] = style[key] && treeStyle[key];
                }
                // Regular properties are just copied, deepest tree wins
                else {
                    style[key] = treeStyle[key];
                }

                // Make note of the deepest tree that had an order property
                if (key === 'order') {
                    deepestOrder = t;
                }

            }
        }
    }

    // Order must be calculated based on the deepest tree that had an order property
    if (deepestOrder !== undefined) {
        let matchingOrderTree = matchingTrees[deepestOrder];

        if (matchingOrderTree.length <= 1) {
            style.order = matchingOrderTree[0].order;
        }
        else {
            let orders = matchingOrderTree.filter(x => x.order).map(x => x.order);
            style.order = orders.slice(style.orderReset);

            // Order can be cached if it is only a single value
            if (style.order.length === 1 && typeof style.order[0] === 'number') {
                style.order = style.order[0];
            }
            // Or if there are no function dependencies
            else if (!style.order.some(v => typeof v === 'function')) {
                style.order = calculateOrder(style.order, context);
            }
        }
    }

    return style;
}


class Rule {

    constructor(name, parent, style, filter) {
        this.id = Rule.id++;
        this.name = name;
        this.style = style;
        this.filter = filter;
        this.parent = parent;
        this.buildFilter();
        this.buildStyle();
        this.gatherParentStyles();
    }

    buildStyle() {
        this.calculatedStyle = calculateStyle(this);
    }

    buildFilter() {
        var type = typeof this.filter;
        if (type === 'object') {
            this.filter = match(this.filter);
        }
    }

    gatherParentStyles() {
        this.parentStyles = this.calculatedStyle.slice(
            0, this.calculatedStyle.length - 1
        );
    }

    toJSON() {
        return {
            name: this.name,
            sytle: this.style
        };
    }

}

Rule.id = 0;


export class RuleLeaf extends Rule {
    constructor({name, parent, style, filter}) {
        super(name, parent, style, filter);
    }

}

export class RuleTree extends Rule {
    constructor({name, parent, style, rules, filter}) {
        super(name, parent, style, filter);
        this.rules = rules || [];
    }

    addRule(rule) {
        this.rules.push(rule);
    }

    findMatchingRules(context, flatten = false) {
        let rules  = [];

        matchFeature(context, this.rules, rules);

        if (rules.length > 0) {
            if (flatten === true) {
                let key = cacheKey(rules);
                if (!ruleCache[key]) {
                    ruleCache[key] = mergeWithDepth(rules.map(x => x.calculatedStyle), context);
                }
                return ruleCache[key];
            } else {
                return rules.map(x => mergeStyles(x.calculatedStyle, context));
            }
        }
    }

}

function isWhiteListed(key) {
    return whiteList.indexOf(key) > -1;
}

function isEmpty(obj) {
    return Object.getOwnPropertyNames(obj).length === 0;
}

export function walkUp(rule, cb) {

    if (rule.parent) {
        walkUp(rule.parent, cb);
    }

    cb(rule);
}

export function walkDown(rule, cb) {

    if (rule.rules) {
        rule.rules.forEach((r) => {
            walkDown(r, cb);
        });
    }

    cb(rule);
}

export function groupProps(obj) {
    let whiteListed = {}, nonWhiteListed = {};

    for (let key in obj) {
        if (isWhiteListed(key)) {
            whiteListed[key] = obj[key];
        } else {
            nonWhiteListed[key] = obj[key];
        }
    }
    return [whiteListed, nonWhiteListed];
}

export function calculateStyle(rule, styles = []) {

    walkUp(rule, (r) =>{
        if (r.style) {
            styles.push(r.style);
        }
    });

    return styles;
}

export function cloneStyle(newObj, ...sources) {

    for (let source of sources) {
        for (let key in source) {
            let value = source[key];
            if (typeof value === 'object' && !Array.isArray(value)) {
                newObj[key] = cloneStyle(newObj[key] || {}, value);
            } else {
                newObj[key] = value;
            }
        }

    }
    return newObj;
}

export function calculateOrder(orders, context = null, defaultOrder = 0) {
    let sum = defaultOrder;

    for (let order of orders) {
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
    return sum;
}


export function mergeStyles(styles) {

    styles = styles.filter(x => x);
    let style = cloneStyle({}, ...styles);
    style.visible = !styles.some(x => x.visible === false);

    let orderStart = 0;
    for (let i = styles.length - 1; i >= 0; i -= 1) {
        if (styles[i].orderReset) {
            orderStart = i;
            break;
        }
    }
    style.order = styles.slice(orderStart).
        filter(style => style.order).map(style => style.order);

    if (style.order.length === 1 && typeof style.order[0] === 'number') {
        style.order = style.order[0];
    } else {
        style.order = calculateOrder(style.order, context);
    }
    return style;
}


export function parseRuleTree(name, rule, parent) {

    let properties = {name, parent};
    let [whiteListed, nonWhiteListed] = groupProps(rule);
    let empty = isEmpty(nonWhiteListed);
    let Create = empty ? RuleLeaf : RuleTree;
    let r = new Create(Object.assign(properties, whiteListed));

    if (parent) {
        parent.addRule(r);
    }

    if (!empty) {
        for (let key in nonWhiteListed) {
            let property = nonWhiteListed[key];
            if (typeof property === 'object') {
                parseRuleTree(key, property, r);
            }
        }

    }

    return r;
}


export function parseRules(rules) {
    let ruleTrees = {};

    for (let key in rules) {
        let rule = rules[key];
        let root = new RuleTree({name: key});
        parseRuleTree(key, rule, root);
        ruleTrees[key] = root;
    }

    return ruleTrees;
}


function doesMatch(filter, context) {
    return ((typeof filter === 'function' && filter(context)) || (filter == null));
}

export function matchFeature(context, rules, collectedRules) {
    let matched = false;
    let childMatched = false;

    if (rules.length === 0) { return; }

    for (let r=0; r < rules.length; r++) {
        let current = rules[r];

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
                childMatched = matchFeature(
                    context,
                    current.rules,
                    collectedRules
                );

                if (!childMatched && current.style) {
                    collectedRules.push(current);
                }
            }
        }
    }

    return matched;
}
