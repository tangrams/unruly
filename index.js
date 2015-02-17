'use strict';

const {match} = require('match-feature');

export const whiteList = ['filter', 'style', 'geometry'];

class Rule {

    constructor(name, parent, style, filter) {
        this.name = name;
        this.style = style;
        this.filter = filter;
        this.parent = parent;
        this.buildFilter();
        this.buildStyle();
        this.gatherParentStyles();
    }

    buildStyle() {
        this.calculateStyled = calculateStyle(this);
    }

    buildFilter() {
        var type = typeof this.filter;
        if (type === 'object') {
            this.filter = match(this.filter);
        }
    }

    gatherParentStyles() {
        this.parentStyles = this.calculateStyled.slice(
            0, this.calculateStyled.length - 1
        );
    }

    toJSON() {
        return {
            name: this.name,
            sytle: this.style
        };
    }

}


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
        let rules = [], builtStyles = [];

        matchFeature(context, this.rules, rules);

        if (rules.length > 1) {
            if (flatten === true) {
                let parents = mergeStyles(rules.map( x =>  mergeStyles(x.parentStyles) ));
                return parents;
            } else {
                builtStyles = rules.map( x => mergeStyles(x.calculateStyled));
            }
        } else if (rules.length === 1) {
            builtStyles = mergeStyles(rules[0].calculatedStyled);
        }

        return builtStyles;
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
        ruleTrees[key] = parseRuleTree(key, rule);
    }

    return ruleTrees;
}


function doesMatch(filter, context) {
    return ((typeof filter === 'function' && filter(context)) ||
            (filter == null));
}

export function matchFeature(context, rules, collectedRules) {
    let matched = false;
    let childMatched = false;

    if (rules.length === 0) { return; }

    for (let current of rules) {

        if (current instanceof RuleLeaf) {

            if (doesMatch(current.filter, context)) {
                matched = true;
                collectedRules.push(current);
            }

        } else if (current instanceof RuleTree) {
            if (doesMatch(current.filter, context)) {

                matched = true;
                childMatched = matchFeature(
                    context,
                    current.rules,
                    collectedRules
                );

                if (!childMatched) {
                    collectedRules.push(current);
                }
            }
        }
    }

    return matched;
}
