'use strict';

const {match} = require('match-feature');

export const whiteList = ['filter', 'style', 'geometry'];

export let ruleCache = {};

function cacheKey (rules) {
    return rules.map(r => r.id).join('/');
}

export function mergeTrees(matchingTrees, context) {
    let style = {};
    let deepestOrder, orderReset;
    let visible = true;

    // Find deepest tree
    matchingTrees.sort((a, b) => a.length > b.length ? -1 : (b.length > a.length ? 1 : 0));
    let len = matchingTrees[0].length;

    // Iterate trees in parallel
    for (let x = 0; x < len; x++) {
        let styles = matchingTrees.map(tree => tree[x]);
        mergeObjects(style, ...styles);

        for (let i=0; i < styles.length; i++) {
            if (!styles[i]) {
                continue;
            }

            // `visible` property is only true if all matching rules are visible
            if (styles[i].visible === false) {
                visible = false;
            }

            // Make note of the style positions of order-related properties
            if (styles[i].order !== undefined) {
                deepestOrder = i;
            }

            if (styles[i].orderReset !== undefined) {
                orderReset = x;
            }
        }
    }

    style.visible = visible;

    // Order must be calculated based on the deepest tree that had an order property
    if (deepestOrder !== undefined) {
        let orderTree = matchingTrees[deepestOrder];

        if (orderTree.length <= 1) {
            style.order = orderTree[0].order;
        }
        else {
            style.order = [];
            for (let x = orderReset || 0; x < orderTree.length; x++) {
                if (orderTree[x] && orderTree[x].order) {
                    style.order.push(orderTree[x].order);
                }
            }

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
        this.style = style || {}; // TODO: would be better to skip null styles later when merging
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

    findMatchingRules(context) {
        let rules  = [];

        matchFeature(context, this.rules, rules);

        if (rules.length > 0) {

            let key = cacheKey(rules);
            if (!ruleCache[key]) {
                ruleCache[key] = mergeTrees(rules.map(x => x.calculatedStyle), context);
            }
            return ruleCache[key];
        }
        return {};
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

export function mergeObjects(newObj, ...sources) {

    for (let source of sources) {
        if (!source) {
            continue;
        }
        for (let key in source) {
            let value = source[key];
            if (typeof value === 'object' && !Array.isArray(value)) {
                newObj[key] = mergeObjects(newObj[key] || {}, value);
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


export function parseRuleTree(name, rule, parent) {

    let properties = {name, parent};
    let [whiteListed, nonWhiteListed] = groupProps(rule);
    let empty = isEmpty(nonWhiteListed);
    let Create;

    if (empty && parent != null) {
        Create = RuleLeaf;
    } else {
        Create = RuleTree;
    }

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
        ruleTrees[key] = parseRuleTree(key, rule);
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
