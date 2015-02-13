'use strict';
var mf = require('match-feature');

export let whiteList = ['filter', 'style', 'geometry'];

let RuleMixin = {

    buildStyle() {
        return calculateStyle(this);
    },

    buildFilter() {
        var type = typeof this.filter;
        if (type === 'object') {
            this.filter = mf.match(this.filter);
        }
    },

    toJSON() {
        return {
            name: this.name,
            sytle: this.style
        };
    }

};

/**
 *
 */
export class Rule {

    constructor({name, parent, style, filter}) {

        this.name    = name;
        this.parent  = parent;
        this.style   = style;
        this.filter  = filter;

        Object.assign(this, RuleMixin);
        this.buildFilter();
    }
}


export class RuleGroup {

    constructor({name, parent, style, rules, filter}) {

        this.name   = name;
        this.parent = parent;
        this.style  = style;
        this.filter = filter;
        this.rules  = rules || [];

        Object.assign(this, RuleMixin);
        this.buildFilter();
    }

    addRule(rule) {
        this.rules.push(rule);        
    }

    findMatchingRules(context) {
        let rules = [];
        matchFeature(context, this.rules, rules);
        return rules;
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

export function parseRuleTree(name, rule, parent) {

    let properties = {name, parent};
    let [whiteListed, nonWhiteListed] = groupProps(rule);

    let empty = isEmpty(nonWhiteListed);

    let Create = empty ? Rule : RuleGroup;
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
    let ruleTree = {};

    for (let key in rules) {
        let rule = rules[key];
        ruleTree[key] = parseRuleTree(key, rule);
    }

    return ruleTree;
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

        if (current instanceof Rule) {

            if (doesMatch(current.filter, context)) {
                matched = true;
                collectedRules.push(current);
            }

        } else if (current instanceof RuleGroup) {
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
