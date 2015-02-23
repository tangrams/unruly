'use strict';

const {match} = require('match-feature');

export const whiteList = ['filter', 'style', 'geometry'];

export let ruleCache = {};

let treeStyles = []; // one-time allocated object reused during style merging

export function mergeTrees(trees, numTrees, context) {
    let style = {};
    let deepestOrder, orderReset;
    let visible = true;

    // Find deepest tree
    let len = 0;
    for (let t=0; t < numTrees; t++) {
        if (trees[t].length > len) {
            len = trees[t].length;
        }
    }

    // Iterate trees in parallel
    for (let x = 0; x < len; x++) {
        // Collect current matching tree styles
        for (let t=0; t < numTrees; t++) {
            treeStyles[t] = trees[t][x];
        }
        let styles = treeStyles;

        // Merge all styles at this level together
        mergeObjects(style, styles, numTrees);

        // Additional property-specific logic
        for (let t=0; t < numTrees; t++) {
            if (!styles[t]) {
                continue;
            }

            // `visible` property is only true if all matching rules are visible
            if (styles[t].visible === false) {
                visible = false;
            }

            // Make note of the style positions of order-related properties
            if (styles[t].order !== undefined) {
                deepestOrder = t;
            }

            if (styles[t].orderReset !== undefined) {
                orderReset = x;
            }
        }
    }

    style.visible = visible;

    // Order must be calculated based on the deepest tree that had an order property
    if (deepestOrder !== undefined) {
        let orderTree = trees[deepestOrder];

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
            style: this.style
        };
    }

}

Rule.id = 0;


export class RuleLeaf extends Rule {
    constructor({name, parent, style, filter}) {
        super(name, parent, style, filter);
    }

}

// One-time allocated objects that are reused during the rule matching process
let state = {};
let styles = [];

export class RuleTree extends Rule {
    constructor({name, parent, style, rules, filter}) {
        super(name, parent, style, filter);
        this.rules = rules || [];
    }

    addRule(rule) {
        this.rules.push(rule);
    }

    findMatchingRules(context, flatten = false) {
        state.key = '';         // cache key
        state.numStyles = 0;    // number of styles matched so far

        matchFeature(context, this.rules, styles, state);
        let key = state.key;

        if (state.numStyles > 0) {
            if (flatten === true) {
                if (!ruleCache[key]) {
                    ruleCache[key] = mergeTrees(styles, state.numStyles, context);
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

// Deep merge an array of objects into a target
// Array length is passed explicitly so `sources` can be a one-time allocated, reusable array
export function mergeObjects(newObj, sources, numSources) {
    for (let s=0; s < numSources; s++) {
        mergeObject(newObj, sources[s]);
    }
    return newObj;
}

// Deep merge an object into a target
export function mergeObject(newObj, source) {
    if (source) {
        for (let key in source) {
            let value = source[key];
            if (typeof value === 'object' && !Array.isArray(value)) {
                newObj[key] = mergeObject(newObj[key] || {}, value);
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
    let style = mergeObjects({}, styles, styles.length);
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


export function doesMatch(filter, context) {
    return ((typeof filter === 'function' && filter(context)) || (filter == null));
}

export function matchFeature(context, rules, collectedStyles, state = { key: '', numStyles: 0 }) {
    let matched = false;
    let childMatched = false;

    if (rules.length === 0) { return; }

    for (let r=0; r < rules.length; r++) {
        let current = rules[r];

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
                childMatched = matchFeature(
                    context,
                    current.rules,
                    collectedStyles,
                    state
                );

                if (!childMatched && current.style) {
                    collectedStyles[state.numStyles++] = current.calculatedStyle;
                    state.key += current.id + '/';
                }
            }
        }
    }

    return matched;
}
