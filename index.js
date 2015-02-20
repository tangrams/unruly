'use strict';

const {match} = require('match-feature');

export const whiteList = ['filter', 'style', 'geometry'];

function sortRules(a, b) {
    if (a.weight > b.weight) { return -1; }
    if (a.weight < b.weight) { return 1; }
    // this might not be need because the last one always
    // wins, which is what we want anyway
    if (a.weight === b.weight) {
        if (a.position > b.position) { return -1; }
        if (a.position < b.position) { return 1; }
    }
    return 0;

}


export let ruleCache = {};

function cacheKey (rules) {
    return rules.map(r => r.id).join('/');
}

export function mergeWithDepth(matchingTrees) {
    let properties = {};
    let style = {};
    let deepestOrder;
    let orderReset = 0;

    for (let x = 0; x < matchingTrees.length; x += 1) {
        let tree = matchingTrees[x];

        for (let i = 0; i < tree.length; i +=1 ) {
            let style = tree[i];

            for (let key in style) {
                if (!Array.isArray(properties[key])) {
                    properties[key] = [];
                }
                properties[key].push({
                    key: key,
                    value: style[key],
                    position: x,
                    weight: i,
                });
            }
        }
    }

    for (let prop in properties)  {
        properties[prop].sort(sortRules);

        if (prop === 'visible') {
            style[prop] = !properties[prop].some(x => x.value === false);
            continue;
        }

        if (prop === 'order') {
            deepestOrder = properties[prop][0];
            continue;
        }

        if (prop === 'orderReset') {
            orderReset = properties[prop][0].weight;
            continue;
        }

        style[prop] = properties[prop][0].value;
    }

    if (deepestOrder) {
        let matchingOrderTree = matchingTrees[deepestOrder.position];

        let orders = matchingOrderTree.filter(x => x.order).map(x => x.order);

        orders = orders.slice(orderReset);

        if (orders.length <= 1) {
            style.order = orders[0];
        } else {
            style.order = calculateOrder(orders);
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
                    ruleCache[key] = [mergeWithDepth(rules.map(x => x.calculatedStyle))];
                }
                return ruleCache[key];
            } else {
                return rules.map( x => mergeStyles(x.calculatedStyle));
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
            order = order();
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
        style.order = calculateOrder(style.order);
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
